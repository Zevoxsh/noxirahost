/**
 * Routes Admin Nodes — /api/admin/nodes
 * Auth Proxmox: username+password (recommandé) ou API Token (rétro-compatibilité)
 */

import { database } from '../../services/database.js';
import { proxmoxService } from '../../services/proxmox.js';

export async function adminNodeRoutes(fastify) {
  // GET /api/admin/nodes
  fastify.get('/', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const nodes = await database.getAllNodes();

    const nodesWithHealth = await Promise.all(
      nodes.map(async (node) => {
        try {
          const status = await proxmoxService.getNodeStatus(node);
          return {
            ...node,
            health: {
              cpu: status.cpu || 0,
              memPercent: status.memory ? (status.memory.used / status.memory.total) : 0,
              uptime: status.uptime || 0,
              online: true
            }
          };
        } catch {
          return { ...node, health: { online: false } };
        }
      })
    );

    reply.send({ nodes: nodesWithHealth });
  });

  // GET /api/admin/nodes/:id
  fastify.get('/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const node = await database.getNodeById(parseInt(request.params.id));
    if (!node) return reply.code(404).send({ error: 'Node not found' });
    reply.send({ node });
  });

  // POST /api/admin/nodes
  fastify.post('/', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const { name, host, port, pveUser, pvePassword, pveTokenId, pveTokenSecret, useSsl, verifySsl, storage, bridge, vmidStart } = request.body || {};

    if (!name || !host) {
      return reply.code(400).send({ error: 'name et host sont requis' });
    }
    if (!pvePassword && !pveTokenId) {
      return reply.code(400).send({ error: 'Un mot de passe ou un API Token est requis' });
    }

    try {
      const { pool } = await import('../../config/database.js');
      // Upsert : crée ou met à jour si le nom existe déjà (même inactif)
      const { rows } = await pool.query(
        `INSERT INTO proxmox_nodes (name, host, port, pve_user, pve_password, pve_token_id, pve_token_secret, use_ssl, verify_ssl, storage, bridge, vmid_start, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE)
         ON CONFLICT (name) DO UPDATE SET
           host = EXCLUDED.host,
           port = EXCLUDED.port,
           pve_user = EXCLUDED.pve_user,
           pve_password = COALESCE(EXCLUDED.pve_password, proxmox_nodes.pve_password),
           pve_token_id = COALESCE(EXCLUDED.pve_token_id, proxmox_nodes.pve_token_id),
           pve_token_secret = COALESCE(EXCLUDED.pve_token_secret, proxmox_nodes.pve_token_secret),
           storage = EXCLUDED.storage,
           bridge = EXCLUDED.bridge,
           vmid_start = EXCLUDED.vmid_start,
           is_active = TRUE,
           updated_at = NOW()
         RETURNING *`,
        [name, host, port || 8006, pveUser || 'root@pam',
         pvePassword || null, pveTokenId || null, pveTokenSecret || null,
         useSsl !== false, verifySsl === true,
         storage || 'local', bridge || 'vmbr0', vmidStart || null]
      );
      const node = rows[0];
      await database.logAudit(request.user.id, 'node.upsert', 'proxmox_node', node.id, `Upserted node ${name}`, request.ip);
      reply.code(201).send({ node });
    } catch (error) {
      reply.code(500).send({ error: 'Impossible de créer le nœud', message: error.message });
    }
  });

  // PUT /api/admin/nodes/:id
  fastify.put('/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const { pool } = await import('../../config/database.js');
    const { is_active, pve_user, pve_password, storage, bridge, vmid_start } = request.body || {};
    await pool.query(
      `UPDATE proxmox_nodes SET
        is_active = COALESCE($2, is_active),
        pve_user = COALESCE($3, pve_user),
        pve_password = COALESCE($4, pve_password),
        storage = COALESCE($5, storage),
        bridge = COALESCE($6, bridge),
        vmid_start = COALESCE($7, vmid_start),
        updated_at = NOW()
       WHERE id = $1`,
      [parseInt(request.params.id), is_active, pve_user, pve_password, storage, bridge, vmid_start]
    );
    const node = await database.getNodeById(parseInt(request.params.id));
    reply.send({ node });
  });

  // DELETE /api/admin/nodes/:id
  fastify.delete('/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const { pool } = await import('../../config/database.js');
    await pool.query('UPDATE proxmox_nodes SET is_active = FALSE WHERE id = $1', [parseInt(request.params.id)]);
    reply.send({ success: true });
  });

  // GET /api/admin/nodes/:id/health
  fastify.get('/:id/health', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const node = await database.getNodeById(parseInt(request.params.id));
    if (!node) return reply.code(404).send({ error: 'Node not found' });

    try {
      const status = await proxmoxService.getNodeStatus(node);
      reply.send({ health: status });
    } catch (error) {
      reply.code(503).send({ error: 'Node unreachable', message: error.message });
    }
  });
}
