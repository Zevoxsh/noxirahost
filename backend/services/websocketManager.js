/**
 * WebSocketManager — relay noVNC entre browser et Proxmox VE
 *
 * Flow:
 * 1. POST /api/vms/:id/console → génère wsToken dans Redis (TTL 60s)
 * 2. Browser → wss://panel/ws/console?token=wsToken
 * 3. Backend valide token, ouvre WS vers PVE, relay binaire bidirectionnel
 */

import { WebSocket, WebSocketServer } from 'ws';
import { redisService } from './redis.js';

export class WebSocketManager {
  constructor(httpServer, logger) {
    this.logger = logger || console;
    this.wss = new WebSocketServer({ noServer: true });

    // Gérer les upgrades HTTP → WebSocket
    httpServer.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url, `http://${req.headers.host}`);

      if (url.pathname === '/ws/console') {
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this._handleConsoleConnection(ws, url);
        });
      } else {
        socket.destroy();
      }
    });

    this.logger.info('[WS] WebSocket manager initialized at /ws/console');
  }

  async _handleConsoleConnection(clientWs, url) {
    const wsToken = url.searchParams.get('token');

    if (!wsToken) {
      clientWs.close(4001, 'Missing token');
      return;
    }

    // Récupérer et supprimer le token (usage unique)
    const tokenData = await redisService.popVncToken(wsToken);

    if (!tokenData) {
      clientWs.close(4002, 'Invalid or expired token');
      return;
    }

    const { nodeHost, nodePort, ticket, vmid, vmType } = tokenData;

    // URL WebSocket PVE
    const pveWsUrl = `wss://${nodeHost}:${nodePort || 8006}/api2/json/nodes/${tokenData.nodeName}/${vmType === 'lxc' ? 'lxc' : 'qemu'}/${vmid}/vncwebsocket?port=${tokenData.port}&vncticket=${encodeURIComponent(ticket)}`;

    this.logger.info(`[WS] Opening noVNC relay to: ${nodeHost}:${nodePort}`);

    // Auth: API token si disponible, sinon PVEAuthCookie (ticket VNC)
    const authHeaders = tokenData.pveTokenId && tokenData.pveTokenSecret
      ? { Authorization: `PVEAPIToken=${tokenData.pveTokenId}=${tokenData.pveTokenSecret}` }
      : { Cookie: `PVEAuthCookie=${ticket}` };

    const pveWs = new WebSocket(pveWsUrl, ['binary'], {
      headers: authHeaders,
      rejectUnauthorized: false // Proxmox peut avoir un certificat self-signed
    });

    pveWs.on('open', () => {
      this.logger.info(`[WS] PVE relay established for VM ${vmid}`);
    });

    // Relay: PVE → Browser
    pveWs.on('message', (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    // Relay: Browser → PVE
    clientWs.on('message', (data, isBinary) => {
      if (pveWs.readyState === WebSocket.OPEN) {
        pveWs.send(data, { binary: isBinary });
      }
    });

    // Fermeture propre
    clientWs.on('close', () => {
      if (pveWs.readyState !== WebSocket.CLOSED) pveWs.close();
    });

    pveWs.on('close', () => {
      if (clientWs.readyState !== WebSocket.CLOSED) clientWs.close();
    });

    pveWs.on('error', (err) => {
      this.logger.error(`[WS] PVE WebSocket error: ${err.message}`);
      if (clientWs.readyState !== WebSocket.CLOSED) clientWs.close(1011, 'PVE relay error');
    });

    clientWs.on('error', (err) => {
      this.logger.error(`[WS] Client WebSocket error: ${err.message}`);
      if (pveWs.readyState !== WebSocket.CLOSED) pveWs.close();
    });
  }

  close() {
    this.wss.close();
  }
}
