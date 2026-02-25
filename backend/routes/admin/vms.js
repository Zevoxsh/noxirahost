/**
 * Routes Admin VMs — /api/admin/vms
 */

import { database } from '../../services/database.js';
import { vmProvisioner } from '../../services/vmProvisioner.js';

export async function adminVmRoutes(fastify) {
  fastify.get('/', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const vms = await database.getAllVMs();
    reply.send({ vms });
  });

  fastify.post('/:id/suspend', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const vm = await database.getVMById(parseInt(request.params.id));
    if (!vm) return reply.code(404).send({ error: 'VM not found' });

    await vmProvisioner.suspend(vm);
    await database.logAudit(request.user.id, 'admin.vm.suspend', 'virtual_machine', vm.id, null, request.ip);
    reply.send({ success: true });
  });

  fastify.delete('/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const vm = await database.getVMById(parseInt(request.params.id));
    if (!vm) return reply.code(404).send({ error: 'VM not found' });

    await vmProvisioner.destroy(vm);
    await database.logAudit(request.user.id, 'admin.vm.delete', 'virtual_machine', vm.id, `Admin deleted VM ${vm.name}`, request.ip);
    reply.send({ success: true });
  });
}
