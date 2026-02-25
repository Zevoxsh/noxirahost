/**
 * Routes Admin Billing — /api/admin/billing
 */

import { pool } from '../../config/database.js';

export async function adminBillingRoutes(fastify) {
  fastify.get('/overview', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const [mrr, subscriptions, failedInvoices] = await Promise.all([
      pool.query(`
        SELECT COALESCE(SUM(p.price_monthly), 0) as mrr
        FROM subscriptions s JOIN plans p ON p.id = s.plan_id
        WHERE s.status = 'active'
      `),
      pool.query("SELECT status, COUNT(*) FROM subscriptions GROUP BY status"),
      pool.query("SELECT COUNT(*) FROM invoices WHERE status IN ('open', 'uncollectible') AND created_at > NOW() - INTERVAL '30 days'")
    ]);

    reply.send({
      mrr: parseFloat(mrr.rows[0].mrr),
      subscriptionsByStatus: subscriptions.rows,
      failedInvoices: parseInt(failedInvoices.rows[0].count)
    });
  });

  fastify.get('/invoices', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const limit = Math.min(parseInt(request.query.limit || '50'), 200);
    const { rows } = await pool.query(
      `SELECT i.*, u.username, u.display_name FROM invoices i
       JOIN users u ON u.id = i.user_id
       ORDER BY i.created_at DESC LIMIT $1`,
      [limit]
    );
    reply.send({ invoices: rows });
  });
}
