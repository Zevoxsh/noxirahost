/**
 * Routes Admin Plans — /api/admin/plans
 */

import { database } from '../../services/database.js';
import { stripeService } from '../../services/stripe.js';

export async function adminPlanRoutes(fastify) {
  fastify.get('/', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const plans = await database.getAllPlans();
    reply.send({ plans });
  });

  // POST /api/admin/plans/sync-stripe — créer les Price Stripe manquants
  fastify.post('/sync-stripe', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const plans = await database.getAllPlans();
    const updated = [];
    const skipped = [];
    const failed = [];

    for (const plan of plans) {
      const missing = !plan.stripePriceId || plan.stripePriceId.includes('PLACEHOLDER');
      if (!missing) {
        skipped.push({ id: plan.id, name: plan.name, stripePriceId: plan.stripePriceId });
        continue;
      }

      try {
        const stripePriceId = await stripeService.getOrCreatePriceForPlan(plan);
        await database.updatePlan(plan.id, { stripePriceId });
        updated.push({ id: plan.id, name: plan.name, stripePriceId });
      } catch (err) {
        failed.push({ id: plan.id, name: plan.name, error: err.message });
      }
    }

    reply.send({ updated, skipped, failed });
  });

  fastify.post('/', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const plan = await database.createPlan(request.body);

    // Auto-créer le Product + Price Stripe
    try {
      const stripePriceId = await stripeService.getOrCreatePriceForPlan(plan);
      await database.updatePlan(plan.id, { stripePriceId });
      plan.stripePriceId = stripePriceId;
    } catch (err) {
      fastify.log.warn({ err: err.message }, 'Stripe price auto-creation failed (plan saved without it)');
    }

    await database.logAudit(request.user.id, 'plan.create', 'plan', plan.id, `Created plan ${plan.name}`, request.ip);
    reply.code(201).send({ plan });
  });

  fastify.put('/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    const id = parseInt(request.params.id);
    const existing = await database.getPlanById(id);
    const plan = await database.updatePlan(id, request.body);

    // Si le prix change, créer un nouveau Price Stripe
    const priceChanged = request.body.priceMonthly !== undefined &&
      parseFloat(request.body.priceMonthly) !== parseFloat(existing?.priceMonthly);
    const noStripePrice = !plan.stripePriceId || plan.stripePriceId.includes('PLACEHOLDER');

    if (priceChanged || noStripePrice) {
      try {
        const stripePriceId = await stripeService.getOrCreatePriceForPlan(plan);
        await database.updatePlan(id, { stripePriceId });
        plan.stripePriceId = stripePriceId;
      } catch (err) {
        fastify.log.warn({ err: err.message }, 'Stripe price auto-creation failed on update');
      }
    }

    reply.send({ plan });
  });

  fastify.delete('/:id', { preHandler: fastify.requireAdmin }, async (request, reply) => {
    await database.updatePlan(parseInt(request.params.id), { isActive: false });
    reply.send({ success: true });
  });
}
