/**
 * Routes Admin Users — /api/admin/users
 */

import { database } from '../../services/database.js';

export async function adminUserRoutes(fastify) {
  fastify.get('/', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const users = await database.getAllUsers();
    reply.send({ users });
  });

  fastify.get('/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const user = await database.getUserById(parseInt(request.params.id));
    if (!user) return reply.code(404).send({ error: 'User not found' });

    const vms = await database.getVMsByUserId(user.id);
    const subscriptions = await database.getSubscriptionsByUserId(user.id);
    reply.send({ user, vms, subscriptions });
  });

  fastify.put('/:id/suspend', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const { reason } = request.body || {};
    const { pool } = await import('../../config/database.js');
    await pool.query(
      'UPDATE users SET is_suspended = TRUE, suspended_reason = $2, updated_at = NOW() WHERE id = $1',
      [parseInt(request.params.id), reason || null]
    );
    await database.logAudit(request.user.id, 'user.suspend', 'user', parseInt(request.params.id), reason, request.ip);
    reply.send({ success: true });
  });

  fastify.put('/:id/unsuspend', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const { pool } = await import('../../config/database.js');
    await pool.query(
      'UPDATE users SET is_suspended = FALSE, suspended_reason = NULL, updated_at = NOW() WHERE id = $1',
      [parseInt(request.params.id)]
    );
    reply.send({ success: true });
  });

  fastify.delete('/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const { pool } = await import('../../config/database.js');
    await pool.query('UPDATE users SET is_active = FALSE WHERE id = $1', [parseInt(request.params.id)]);
    await database.logAudit(request.user.id, 'user.delete', 'user', parseInt(request.params.id), null, request.ip);
    reply.send({ success: true });
  });
}
