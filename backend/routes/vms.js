/**
 * Routes VMs — /api/vms
 * CRUD, power actions, console noVNC, snapshots
 */

import { database } from '../services/database.js';
import { proxmoxService } from '../services/proxmox.js';
import { redisService } from '../services/redis.js';
import { randomUUID } from 'crypto';

export async function vmRoutes(fastify) {
  const formatVm = (vm) => {
    if (!vm) return vm;
    return {
      id: vm.id,
      userId: vm.user_id,
      nodeId: vm.node_id,
      planId: vm.plan_id,
      vmid: vm.vmid,
      vmType: vm.vm_type,
      name: vm.name,
      hostname: vm.hostname,
      status: vm.status,
      osTemplate: vm.os_template,
      cpuCores: vm.cpu_cores,
      ramMb: vm.ram_mb,
      diskGb: vm.disk_gb,
      ipAddress: vm.ip_address,
      ipv6Address: vm.ipv6_address,
      isSuspended: vm.is_suspended,
      planName: vm.plan_name,
      nodeName: vm.node_name,
      createdAt: vm.created_at
    };
  };

  // GET /api/vms — liste des VMs de l'utilisateur
  fastify.get('/', { preHandler: fastify.authenticate }, async (request, reply) => {
    const vms = await database.getVMsByUserId(request.user.id);
    reply.send({ vms: vms.map(formatVm) });
  });

  // GET /api/vms/:id — détail d'une VM
  fastify.get('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const vm = await database.getVMByIdAndUser(parseInt(request.params.id), request.user.id);
    if (!vm) return reply.code(404).send({ error: 'VM not found' });
    reply.send({ vm: formatVm(vm) });
  });

  // DELETE /api/vms/:id — supprimer une VM
  fastify.delete('/:id', { preHandler: fastify.authenticate }, async (request, reply) => {
    const vm = await database.getVMByIdAndUser(parseInt(request.params.id), request.user.id);
    if (!vm) return reply.code(404).send({ error: 'VM not found' });

    const { vmProvisioner } = await import('../services/vmProvisioner.js');
    await vmProvisioner.destroy(vm);

    await database.logAudit(request.user.id, 'vm.delete', 'virtual_machine', vm.id, `Deleted VM ${vm.name}`, request.ip);
    reply.send({ success: true, message: 'VM deletion initiated' });
  });

  // GET /api/vms/:id/status — status live depuis Proxmox
  fastify.get('/:id/status', { preHandler: fastify.authenticate }, async (request, reply) => {
    const vm = await database.getVMByIdAndUser(parseInt(request.params.id), request.user.id);
    if (!vm) return reply.code(404).send({ error: 'VM not found' });

    try {
      const node = {
        name: vm.node_name,
        host: vm.node_host,
        port: vm.node_port,
        pve_user: vm.pve_user, pve_password: vm.pve_password, pve_token_id: vm.pve_token_id,
        pve_token_secret: vm.pve_token_secret,
        verify_ssl: vm.verify_ssl
      };
      const liveStatus = await proxmoxService.getLiveStatus(node, vm.vmid, vm.vm_type);

      // Synchroniser le statut en DB
      if (liveStatus.status !== vm.status) {
        await database.updateVMStatus(vm.id, liveStatus.status);
      }

      reply.send({ status: liveStatus });
    } catch (error) {
      reply.send({ status: { status: vm.status, error: error.message } });
    }
  });

  // POST /api/vms/:id/power — actions power
  fastify.post('/:id/power', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { action } = request.body || {};
    const validActions = ['start', 'stop', 'reboot', 'shutdown'];
    if (!validActions.includes(action)) {
      return reply.code(400).send({ error: 'Invalid action', message: `Action must be one of: ${validActions.join(', ')}` });
    }

    const vm = await database.getVMByIdAndUser(parseInt(request.params.id), request.user.id);
    if (!vm) return reply.code(404).send({ error: 'VM not found' });
    if (vm.is_suspended) return reply.code(403).send({ error: 'VM is suspended', message: 'Please renew your subscription' });

    const node = {
      name: vm.node_name,
      host: vm.node_host,
      port: vm.node_port,
      pve_user: vm.pve_user, pve_password: vm.pve_password, pve_token_id: vm.pve_token_id,
      pve_token_secret: vm.pve_token_secret,
      verify_ssl: vm.verify_ssl
    };

    try {
      await proxmoxService.powerAction(node, vm.vmid, vm.vm_type, action);

      // Mettre à jour le statut DB selon l'action
      const statusMap = { start: 'running', stop: 'stopped', shutdown: 'stopped', reboot: 'running' };
      await database.updateVMStatus(vm.id, statusMap[action]);

      await database.logAudit(request.user.id, `vm.${action}`, 'virtual_machine', vm.id, null, request.ip);
      reply.send({ success: true, action, status: statusMap[action] });
    } catch (error) {
      reply.code(500).send({ error: 'Power action failed', message: error.message });
    }
  });

  // POST /api/vms/:id/console — générer un token noVNC
  fastify.post('/:id/console', { preHandler: fastify.authenticate }, async (request, reply) => {
    const vm = await database.getVMByIdAndUser(parseInt(request.params.id), request.user.id);
    if (!vm) return reply.code(404).send({ error: 'VM not found' });
    if (vm.status !== 'running') return reply.code(400).send({ error: 'VM must be running to open console' });

    const node = {
      name: vm.node_name,
      host: vm.node_host,
      port: vm.node_port,
      pve_user: vm.pve_user, pve_password: vm.pve_password, pve_token_id: vm.pve_token_id,
      pve_token_secret: vm.pve_token_secret,
      verify_ssl: vm.verify_ssl
    };

    try {
      const vncData = await proxmoxService.getVncProxyForVM(node, vm.vmid, vm.vm_type);
      const wsAuthHeaders = await proxmoxService.getWsAuthHeaders(node);
      const wsToken = randomUUID();

      // Stocker dans Redis (TTL 60s, usage unique)
      await redisService.setVncToken(wsToken, {
        nodeHost: node.host,
        nodePort: node.port,
        nodeName: node.name,
        ticket: vncData.ticket,
        port: vncData.port,
        vmid: vm.vmid,
        vmType: vm.vm_type,
        wsAuthHeaders
      }, 60);

      reply.send({ wsToken, vmName: vm.name });
    } catch (error) {
      reply.code(500).send({ error: 'Console unavailable', message: error.message });
    }
  });

  // GET /api/vms/:id/snapshots
  fastify.get('/:id/snapshots', { preHandler: fastify.authenticate }, async (request, reply) => {
    const vm = await database.getVMByIdAndUser(parseInt(request.params.id), request.user.id);
    if (!vm) return reply.code(404).send({ error: 'VM not found' });
    if (vm.vm_type !== 'kvm') return reply.code(400).send({ error: 'Snapshots only available for KVM VMs' });

    const node = {
      name: vm.node_name,
      host: vm.node_host,
      port: vm.node_port,
      pve_user: vm.pve_user, pve_password: vm.pve_password, pve_token_id: vm.pve_token_id,
      pve_token_secret: vm.pve_token_secret,
      verify_ssl: vm.verify_ssl
    };

    try {
      const snapshots = await proxmoxService.listSnapshots(node, vm.vmid);
      reply.send({ snapshots });
    } catch (error) {
      reply.code(500).send({ error: 'Failed to list snapshots', message: error.message });
    }
  });

  // POST /api/vms/:id/snapshots
  fastify.post('/:id/snapshots', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { name, description } = request.body || {};
    if (!name) return reply.code(400).send({ error: 'Snapshot name is required' });

    const vm = await database.getVMByIdAndUser(parseInt(request.params.id), request.user.id);
    if (!vm) return reply.code(404).send({ error: 'VM not found' });
    if (vm.vm_type !== 'kvm') return reply.code(400).send({ error: 'Snapshots only available for KVM VMs' });

    const node = {
      name: vm.node_name,
      host: vm.node_host,
      port: vm.node_port,
      pve_user: vm.pve_user, pve_password: vm.pve_password, pve_token_id: vm.pve_token_id,
      pve_token_secret: vm.pve_token_secret,
      verify_ssl: vm.verify_ssl
    };

    try {
      const upid = await proxmoxService.createSnapshot(node, vm.vmid, name, description || '');
      reply.send({ success: true, upid });
    } catch (error) {
      reply.code(500).send({ error: 'Snapshot creation failed', message: error.message });
    }
  });

  // DELETE /api/vms/:id/snapshots/:snapname
  fastify.delete('/:id/snapshots/:snapname', { preHandler: fastify.authenticate }, async (request, reply) => {
    const vm = await database.getVMByIdAndUser(parseInt(request.params.id), request.user.id);
    if (!vm) return reply.code(404).send({ error: 'VM not found' });

    const node = {
      name: vm.node_name,
      host: vm.node_host,
      port: vm.node_port,
      pve_user: vm.pve_user, pve_password: vm.pve_password, pve_token_id: vm.pve_token_id,
      pve_token_secret: vm.pve_token_secret,
      verify_ssl: vm.verify_ssl
    };

    try {
      await proxmoxService.deleteSnapshot(node, vm.vmid, request.params.snapname);
      reply.send({ success: true });
    } catch (error) {
      reply.code(500).send({ error: 'Snapshot deletion failed', message: error.message });
    }
  });
}
