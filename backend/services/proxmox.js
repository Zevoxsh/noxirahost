/**
 * ProxmoxService — wrapper axios pour l'API Proxmox VE
 * Auth: API Token (PVEAPIToken) OU username+password (ticket, mis en cache 90 min)
 */

import axios from 'axios';
import https from 'https';

class ProxmoxService {
  constructor() {
    // Cache tickets par noeud : cacheKey → { ticket, csrf, expiresAt }
    this._ticketCache = new Map();
  }

  // ─── Auth ───────────────────────────────────────────────
  async _getTicket(node) {
    const cacheKey = `${node.host}:${node.port || 8006}:${node.pve_user}`;
    const cached = this._ticketCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached;

    const agent = new https.Agent({ rejectUnauthorized: !!node.verify_ssl });
    const { data } = await axios.post(
      `https://${node.host}:${node.port || 8006}/api2/json/access/ticket`,
      new URLSearchParams({ username: node.pve_user || 'root@pam', password: node.pve_password }),
      { httpsAgent: agent, timeout: 10000 }
    );

    const result = {
      ticket: data.data.ticket,
      csrf: data.data.CSRFPreventionToken,
      expiresAt: Date.now() + 90 * 60 * 1000   // 90 min
    };
    this._ticketCache.set(cacheKey, result);
    return result;
  }

  async _client(node) {
    const baseURL = `https://${node.host}:${node.port || 8006}/api2/json`;
    const agent = new https.Agent({ rejectUnauthorized: !!node.verify_ssl });

    if (node.pve_password) {
      // Auth par mot de passe — ticket Proxmox
      const { ticket, csrf } = await this._getTicket(node);
      return axios.create({
        baseURL,
        headers: {
          Cookie: `PVEAuthCookie=${ticket}`,
          CSRFPreventionToken: csrf
        },
        httpsAgent: agent,
        timeout: 15000
      });
    } else {
      // Auth par API Token (rétro-compatibilité)
      return axios.create({
        baseURL,
        headers: { Authorization: `PVEAPIToken=${node.pve_token_id}=${node.pve_token_secret}` },
        httpsAgent: agent,
        timeout: 15000
      });
    }
  }

  /**
   * Retourne les headers d'authentification pour une connexion WebSocket vers PVE.
   * Pour password : PVEAuthCookie avec le ticket de session (≠ ticket VNC).
   * Pour API token : Authorization header.
   */
  async getWsAuthHeaders(node) {
    if (node.pve_password) {
      const { ticket } = await this._getTicket(node);
      return { Cookie: `PVEAuthCookie=${ticket}` };
    }
    return { Authorization: `PVEAPIToken=${node.pve_token_id}=${node.pve_token_secret}` };
  }

  // ─── Node ───────────────────────────────────────────────
  async getNodeStatus(node) {
    const client = await this._client(node);
    const { data } = await client.get(`/nodes/${node.name}/status`);
    return data.data;
  }

  // ─── VMs (KVM) ──────────────────────────────────────────
  async listVMs(node) {
    const client = await this._client(node);
    const { data } = await client.get(`/nodes/${node.name}/qemu`);
    return data.data || [];
  }

  async getVMStatus(node, vmid) {
    const client = await this._client(node);
    const { data } = await client.get(`/nodes/${node.name}/qemu/${vmid}/status/current`);
    return data.data;
  }

  async createVM(node, params) {
    const client = await this._client(node);
    const { data } = await client.post(`/nodes/${node.name}/qemu`, params);
    return data.data;
  }

  async deleteVM(node, vmid) {
    const client = await this._client(node);
    const { data } = await client.delete(`/nodes/${node.name}/qemu/${vmid}`, {
      params: { purge: 1, 'destroy-unreferenced-disks': 1 }
    });
    return data.data;
  }

  async vmAction(node, vmid, action) {
    const client = await this._client(node);
    const { data } = await client.post(`/nodes/${node.name}/qemu/${vmid}/status/${action}`);
    return data.data;
  }

  async getVncProxy(node, vmid) {
    const client = await this._client(node);
    const { data } = await client.post(`/nodes/${node.name}/qemu/${vmid}/vncproxy`, { websocket: 1 });
    return data.data;
  }

  async listSnapshots(node, vmid) {
    const client = await this._client(node);
    const { data } = await client.get(`/nodes/${node.name}/qemu/${vmid}/snapshot`);
    return data.data || [];
  }

  async createSnapshot(node, vmid, snapname, description = '') {
    const client = await this._client(node);
    const { data } = await client.post(`/nodes/${node.name}/qemu/${vmid}/snapshot`, { snapname, description });
    return data.data;
  }

  async deleteSnapshot(node, vmid, snapname) {
    const client = await this._client(node);
    const { data } = await client.delete(`/nodes/${node.name}/qemu/${vmid}/snapshot/${snapname}`);
    return data.data;
  }

  // ─── Containers (LXC) ───────────────────────────────────
  async listContainers(node) {
    const client = await this._client(node);
    const { data } = await client.get(`/nodes/${node.name}/lxc`);
    return data.data || [];
  }

  async listUsedVmids(node) {
    const [vms, containers] = await Promise.all([
      this.listVMs(node),
      this.listContainers(node)
    ]);
    const used = new Set();
    for (const v of [...vms, ...containers]) {
      const vmid = Number(v?.vmid);
      if (Number.isFinite(vmid)) used.add(vmid);
    }
    return used;
  }

  async getNextAvailableVmid(node, minStart) {
    const used = await this.listUsedVmids(node);
    let vmid = Number(minStart) || 200;
    while (used.has(vmid)) vmid += 1;
    return { vmid, used };
  }

  async getContainerStatus(node, vmid) {
    const client = await this._client(node);
    const { data } = await client.get(`/nodes/${node.name}/lxc/${vmid}/status/current`);
    return data.data;
  }

  async createContainer(node, params) {
    const client = await this._client(node);
    const { data } = await client.post(`/nodes/${node.name}/lxc`, params);
    return data.data;
  }

  async deleteContainer(node, vmid) {
    const client = await this._client(node);
    const { data } = await client.delete(`/nodes/${node.name}/lxc/${vmid}`, { params: { purge: 1 } });
    return data.data;
  }

  async containerAction(node, vmid, action) {
    const client = await this._client(node);
    const { data } = await client.post(`/nodes/${node.name}/lxc/${vmid}/status/${action}`);
    return data.data;
  }

  async getContainerVncProxy(node, vmid) {
    const client = await this._client(node);
    const { data } = await client.post(`/nodes/${node.name}/lxc/${vmid}/vncproxy`, { websocket: 1 });
    return data.data;
  }

  // ─── Storage ────────────────────────────────────────────
  /**
   * Lister tous les storages d'un noeud qui supportent un type de contenu donné
   * contentType: 'iso' | 'vztmpl' | 'images' | etc.
   */
  async listNodeStorages(node, contentType) {
    const client = await this._client(node);
    const { data } = await client.get(`/nodes/${node.name}/storage`, {
      params: { content: contentType }
    });
    return data.data || [];
  }

  /**
   * Lister le contenu d'un storage spécifique
   */
  async listStorageContent(node, storage, contentType) {
    const client = await this._client(node);
    const { data } = await client.get(`/nodes/${node.name}/storage/${storage}/content`, {
      params: { content: contentType }
    });
    return data.data || [];
  }

  /**
   * Scanner TOUS les storages du noeud pour un type de contenu
   * Retourne { storage, items[] }[]
   */
  async scanAllStoragesForContent(node, contentType) {
    const storages = await this.listNodeStorages(node, contentType);
    const results = [];
    for (const s of storages) {
      try {
        const items = await this.listStorageContent(node, s.storage, contentType);
        results.push({ storage: s.storage, items });
      } catch { /* ignorer les storages inaccessibles */ }
    }
    return results;
  }

  // ─── Actions unifiées ───────────────────────────────────
  async powerAction(node, vmid, vmType, action) {
    return vmType === 'kvm'
      ? this.vmAction(node, vmid, action)
      : this.containerAction(node, vmid, action);
  }

  async getLiveStatus(node, vmid, vmType) {
    return vmType === 'kvm'
      ? this.getVMStatus(node, vmid)
      : this.getContainerStatus(node, vmid);
  }

  async getVncProxyForVM(node, vmid, vmType) {
    return vmType === 'kvm'
      ? this.getVncProxy(node, vmid)
      : this.getContainerVncProxy(node, vmid);
  }

  // ─── Paramètres de création ─────────────────────────────
  buildVMCreateParams(vmid, plan, isoVolid, name, storage, bridge, rootPassword) {
    const params = {
      vmid, name,
      memory: plan.ramMb,
      cores: plan.cpuCores,
      sockets: 1,
      net0: `virtio,bridge=${bridge}`,
      scsi0: `${storage}:${plan.diskGb}`,
      ide2: isoVolid ? `${isoVolid},media=cdrom` : undefined,
      boot: 'order=scsi0;ide2',
      ostype: 'l26',
      onboot: 1
    };
    if (rootPassword) params.cipassword = rootPassword;
    return params;
  }

  buildContainerCreateParams(vmid, plan, templateVolid, hostname, storage, bridge, rootPassword) {
    const params = {
      vmid, hostname,
      ostemplate: templateVolid,
      memory: plan.ramMb,
      swap: 512,
      cores: plan.cpuCores,
      rootfs: `${storage}:${plan.diskGb}`,
      net0: `name=eth0,bridge=${bridge},ip=dhcp`,
      unprivileged: 1,
      start: 0
    };
    if (rootPassword) params.password = rootPassword;
    return params;
  }
}

export const proxmoxService = new ProxmoxService();
