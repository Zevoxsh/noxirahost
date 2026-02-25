/**
 * Routes Billing — /api/billing
 * Plans, Stripe checkout, portal, invoices, webhook
 */

import { database } from '../services/database.js';
import { stripeService } from '../services/stripe.js';

export async function billingRoutes(fastify) {
  // GET /api/billing/plans — public
  fastify.get('/plans', async (request, reply) => {
    const plans = await database.getActivePlans();
    reply.send({ plans });
  });

  // GET /api/billing/current — abonnement actif
  fastify.get('/current', { preHandler: fastify.authenticate }, async (request, reply) => {
    const subscriptions = await database.getSubscriptionsByUserId(request.user.id);
    reply.send({ subscriptions });
  });

  // POST /api/billing/checkout — créer une Stripe Checkout Session
  fastify.post('/checkout', { preHandler: fastify.authenticate }, async (request, reply) => {
    const { planId, vmName, osTemplate } = request.body || {};
    if (!planId) return reply.code(400).send({ error: 'planId is required' });

    const plan = await database.getPlanById(parseInt(planId));
    if (!plan || !plan.isActive) return reply.code(404).send({ error: 'Plan not found or inactive' });

    const stripePriceId = plan.stripePriceId;
    if (!stripePriceId || stripePriceId.includes('PLACEHOLDER')) {
      return reply.code(500).send({ error: 'Prix Stripe non configuré', message: 'Contactez un administrateur.' });
    }

    const user = await database.getUserById(request.user.id);

    try {
      const session = await stripeService.createCheckoutSession({ user, plan, stripePriceId, vmName, osTemplate });
      reply.send({ url: session.url, sessionId: session.id });
    } catch (error) {
      fastify.log.error({ error }, 'Stripe checkout creation failed');
      reply.code(500).send({ error: 'Checkout creation failed', message: error.message });
    }
  });

  // POST /api/billing/portal — Stripe Customer Portal
  fastify.post('/portal', { preHandler: fastify.authenticate }, async (request, reply) => {
    const user = await database.getUserById(request.user.id);

    try {
      const session = await stripeService.createPortalSession(user);
      reply.send({ url: session.url });
    } catch (error) {
      reply.code(500).send({ error: 'Portal creation failed', message: error.message });
    }
  });

  // GET /api/billing/invoices
  fastify.get('/invoices', { preHandler: fastify.authenticate }, async (request, reply) => {
    const invoices = await database.getInvoicesByUserId(request.user.id);
    reply.send({ invoices });
  });

  // POST /api/billing/webhook — Stripe webhook (raw body requis)
  fastify.post('/webhook', {
    config: { rawBody: true }
  }, async (request, reply) => {
    const sig = request.headers['stripe-signature'];
    if (!sig) return reply.code(400).send({ error: 'Missing stripe-signature' });

    try {
      const event = stripeService.constructEvent(request.rawBody, sig);
      await stripeService.handleWebhook(event);
      reply.send({ received: true });
    } catch (error) {
      fastify.log.error({ error }, 'Stripe webhook error');
      reply.code(400).send({ error: 'Webhook error', message: error.message });
    }
  });
}
