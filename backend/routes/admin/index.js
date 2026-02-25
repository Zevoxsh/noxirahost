/**
 * Routes Admin globales — /api/admin
 */

import { database } from '../../services/database.js';

export async function adminRoutes(fastify) {
  // GET /api/admin/stats
  fastify.get('/stats', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const stats = await database.getAdminStats();
    reply.send({ stats });
  });

  // GET /api/admin/audit-logs
  fastify.get('/audit-logs', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit || '50'), 200);
    const offset = parseInt(request.query.offset || '0');
    const logs = await database.getAuditLogs(limit, offset);
    reply.send({ logs });
  });
}
