/**
 * StripeService — checkout, portal, webhooks
 */

import Stripe from 'stripe';
import { config } from '../config/config.js';
import { database } from './database.js';
import { vmProvisioner } from './vmProvisioner.js';

class StripeService {
  constructor() {
    this.stripe = null;
  }

  getClient() {
    if (!this.stripe) {
      if (!config.stripe.secretKey) throw new Error('STRIPE_SECRET_KEY not configured');
      this.stripe = new Stripe(config.stripe.secretKey);
    }
    return this.stripe;
  }

  /**
   * Créer ou récupérer un Customer Stripe pour un utilisateur
   */
  async getOrCreateCustomer(user) {
    const stripe = this.getClient();

    if (user.stripe_customer_id) {
      return user.stripe_customer_id;
    }

    const customer = await stripe.customers.create({
      email: user.email,
      name: user.display_name,
      metadata: { userId: String(user.id), username: user.username }
    });

    await database.updateUser(user.id, { stripe_customer_id: customer.id });
    return customer.id;
  }

  /**
   * Créer automatiquement un Product + Price Stripe pour un plan
   * Appelé lors de la création/mise à jour d'un plan admin
   */
  async getOrCreatePriceForPlan(plan) {
    const stripe = this.getClient();

    const product = await stripe.products.create({
      name: plan.name,
      description: `${plan.vmType === 'lxc' ? 'LXC Container' : 'KVM Virtual Machine'} — ${plan.cpuCores} vCPU, ${plan.ramMb}MB RAM, ${plan.diskGb}GB SSD`,
      metadata: { planId: String(plan.id), vmType: plan.vmType }
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(plan.priceMonthly * 100), // centimes
      currency: 'eur',
      recurring: { interval: 'month' },
      metadata: { planId: String(plan.id) }
    });

    return price.id;
  }

  /**
   * Créer une Stripe Checkout Session pour souscrire un plan
   */
  async createCheckoutSession({ user, plan, stripePriceId, rootPassword, osTemplate }) {
    const stripe = this.getClient();
    const customerId = await this.getOrCreateCustomer(user);
    const metadata = {
      userId: String(user.id),
      planId: String(plan.id),
      vmType: plan.vmType,
      rootPassword: rootPassword || '',
      osTemplate: osTemplate || ''
    };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: stripePriceId, quantity: 1 }],
      success_url: `${config.frontendUrl}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontendUrl}/billing?canceled=1`,
      metadata,
      subscription_data: { metadata }
    });

    return session;
  }

  /**
   * Créer une Customer Portal Session
   */
  async createPortalSession(user) {
    const stripe = this.getClient();
    if (!user.stripe_customer_id) throw new Error('No Stripe customer associated with this user');

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${config.frontendUrl}/billing`
    });

    return session;
  }

  /**
   * Récupérer les factures Stripe d'un customer
   */
  async getInvoices(stripeCustomerId) {
    const stripe = this.getClient();
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
      limit: 20
    });
    return invoices.data;
  }

  /**
   * Programmer la résiliation à fin de période
   */
  async cancelSubscriptionAtPeriodEnd(stripeSubscriptionId) {
    const stripe = this.getClient();
    await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: true });
  }

  /**
   * Annuler une résiliation programmée
   */
  async reactivateSubscription(stripeSubscriptionId) {
    const stripe = this.getClient();
    await stripe.subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: false });
  }

  /**
   * Construire et vérifier l'événement webhook
   */
  constructEvent(rawBody, signature) {
    const stripe = this.getClient();
    return stripe.webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
  }

  /**
   * Traiter un événement webhook Stripe
   */
  async handleWebhook(event) {
    // Idempotency
    const alreadyProcessed = await database.isStripeEventProcessed(event.id);
    if (alreadyProcessed) {
      console.log(`[Stripe] Event ${event.id} already processed, skipping`);
      return;
    }

    console.log(`[Stripe] Processing event: ${event.type} (${event.id})`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this._handleCheckoutComplete(event.data.object);
        break;

      case 'customer.subscription.created':
        await this._handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await this._handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this._handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.paid':
        await this._handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await this._handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log(`[Stripe] Unhandled event type: ${event.type}`);
    }

    await database.markStripeEventProcessed(event.id, event.type);
  }

  _toDate(ts) {
    return (typeof ts === 'number' && Number.isFinite(ts)) ? new Date(ts * 1000) : null;
  }

  async _handleCheckoutComplete(session) {
    const { userId, planId, vmType, rootPassword, osTemplate } = session.metadata || {};
    if (!userId || !planId) {
      console.error('[Stripe] Checkout completed without required metadata', {
        sessionId: session.id,
        userId,
        planId
      });
      return;
    }

    const stripe = this.getClient();
    const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
    const existingSub = await database.getSubscriptionByStripeId(stripeSubscription.id);
    const plan = await database.getPlanById(parseInt(planId));
    const user = await database.getUserById(parseInt(userId));
    if (!plan || !user) {
      console.error('[Stripe] Checkout completed but plan/user not found', {
        sessionId: session.id,
        planId,
        userId,
        planFound: !!plan,
        userFound: !!user
      });
      return;
    }

    // Choisir le noeud Proxmox avec le moins de VMs
    const nodes = await database.getActiveNodes();
    if (nodes.length === 0) {
      console.error('[Stripe] No active Proxmox nodes found for provisioning');
      return;
    }
    const node = nodes[0]; // Simplification : premier noeud actif

    // Ne pas re-provisionner si la VM existe déjà (ex: créée via invoice.paid fallback)
    let dbVm = existingSub?.vm_id ? { id: existingSub.vm_id } : null;
    if (!dbVm) {
      try {
        dbVm = await vmProvisioner.create({
          userId: user.id,
          plan,
          node,
          name: `${plan.name.replace(/\s/g, '-').toLowerCase()}-${user.id}`,
          rootPassword: rootPassword || '',
          osTemplate: osTemplate || ''
        });
      } catch (error) {
        const details = error?.response?.data ? JSON.stringify(error.response.data) : error?.message;
        console.error('[Stripe] VM provisioning failed:', details);
      }
    } else {
      console.log('[Stripe] VM already provisioned (invoice.paid fallback), skipping re-provisioning');
    }

    // Créer l'abonnement en DB
    if (existingSub) {
      await database.updateSubscription(existingSub.id, {
        vmId: existingSub.vm_id || dbVm?.id || null,
        status: stripeSubscription.status,
        currentPeriodStart: this._toDate(stripeSubscription.current_period_start),
        currentPeriodEnd: this._toDate(stripeSubscription.current_period_end)
      });
    } else {
      await database.createSubscription({
        userId: user.id,
        vmId: dbVm?.id || null,
        planId: plan.id,
        stripeSubscriptionId: stripeSubscription.id,
        stripeCustomerId: session.customer,
        status: stripeSubscription.status,
        currentPeriodStart: this._toDate(stripeSubscription.current_period_start),
        currentPeriodEnd: this._toDate(stripeSubscription.current_period_end)
      });
    }
  }

  async _handleSubscriptionCreated(subscription) {
    const existing = await database.getSubscriptionByStripeId(subscription.id);
    if (existing) return;

    const { userId, planId, vmType, vmName, osTemplate } = subscription.metadata || {};
    if (!userId || !planId) {
      console.warn('[Stripe] Subscription created without metadata, skipping', subscription.id);
      return;
    }

    const plan = await database.getPlanById(parseInt(planId));
    const user = await database.getUserById(parseInt(userId));
    if (!plan || !user) {
      console.error('[Stripe] Subscription created but plan/user not found', {
        subscriptionId: subscription.id,
        planId,
        userId,
        planFound: !!plan,
        userFound: !!user
      });
      return;
    }

    // Ne pas provisionner ici pour éviter un double create avec checkout.session.completed.
    await database.createSubscription({
      userId: user.id,
      vmId: null,
      planId: plan.id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      status: subscription.status,
      currentPeriodStart: this._toDate(subscription.current_period_start),
      currentPeriodEnd: this._toDate(subscription.current_period_end)
    });
  }

  async _handleSubscriptionUpdated(subscription) {
    const dbSub = await database.getSubscriptionByStripeId(subscription.id);
    if (!dbSub) return;

    await database.updateSubscription(dbSub.id, {
      status: subscription.status,
      currentPeriodStart: this._toDate(subscription.current_period_start),
      currentPeriodEnd: this._toDate(subscription.current_period_end),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
  }

  async _handleSubscriptionDeleted(subscription) {
    const dbSub = await database.getSubscriptionByStripeId(subscription.id);
    if (!dbSub) return;

    await database.updateSubscription(dbSub.id, { status: 'canceled' });

    // Suspendre la VM associée
    if (dbSub.vm_id) {
      const vm = await database.getVMById(dbSub.vm_id);
      if (vm) await vmProvisioner.suspend(vm);
    }
  }

  async _handleInvoicePaid(invoice) {
    const dbSub = invoice.subscription
      ? await database.getSubscriptionByStripeId(invoice.subscription)
      : null;

    const user = dbSub?.user_id
      ? { id: dbSub.user_id }
      : (invoice.customer ? await database.getUserByStripeCustomerId(invoice.customer) : null);

    if (!user?.id) {
      console.warn('[Stripe] Invoice paid with no matching user, skipping', invoice.id);
      return;
    }

    await database.upsertInvoice({
      userId: user.id,
      subscriptionId: dbSub?.id || null,
      stripeInvoiceId: invoice.id,
      amountPaid: (invoice.amount_paid || 0) / 100,
      currency: invoice.currency,
      status: 'paid',
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdfUrl: invoice.invoice_pdf,
      periodStart: this._toDate(invoice.period_start),
      periodEnd: this._toDate(invoice.period_end)
    });

    // Reprendre la VM si elle était suspendue
    if (dbSub?.vm_id) {
      const vm = await database.getVMById(dbSub.vm_id);
      if (vm?.is_suspended) await vmProvisioner.resume(vm);
    }

    // Fallback provisionnement : checkout.session.completed n'est pas toujours reçu
    if (!dbSub && invoice.billing_reason === 'subscription_create' && invoice.subscription) {
      console.log('[Stripe] invoice.paid fallback: provisionnement pour nouvelle souscription', invoice.subscription);
      await this._provisionNewSubscription(invoice.subscription, invoice.customer);
    }
  }

  async _provisionNewSubscription(stripeSubscriptionId, stripeCustomerId) {
    // Idempotency : vérifier si déjà en DB
    const existing = await database.getSubscriptionByStripeId(stripeSubscriptionId);
    if (existing) {
      console.log('[Stripe] Souscription déjà en DB, skip provisionnement', stripeSubscriptionId);
      return;
    }

    const stripe = this.getClient();
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const { userId, planId, rootPassword, osTemplate } = stripeSubscription.metadata || {};

    if (!userId || !planId) {
      console.error('[Stripe] Pas de metadata sur la souscription pour provisionnement', stripeSubscriptionId);
      return;
    }

    const plan = await database.getPlanById(parseInt(planId));
    const user = await database.getUserById(parseInt(userId));
    if (!plan || !user) {
      console.error('[Stripe] Plan/user introuvable pour provisionnement', { planId, userId });
      return;
    }

    const nodes = await database.getActiveNodes();
    if (nodes.length === 0) {
      console.error('[Stripe] Aucun noeud Proxmox actif pour provisionnement');
      return;
    }
    const node = nodes[0];

    let dbVm = null;
    try {
      dbVm = await vmProvisioner.create({
        userId: user.id,
        plan,
        node,
        name: `${plan.name.replace(/\s/g, '-').toLowerCase()}-${user.id}`,
        rootPassword: rootPassword || '',
        osTemplate: osTemplate || ''
      });
    } catch (error) {
      const details = error?.response?.data ? JSON.stringify(error.response.data) : error?.message;
      console.error('[Stripe] VM provisioning failed (invoice.paid fallback):', details);
    }

    await database.createSubscription({
      userId: user.id,
      vmId: dbVm?.id || null,
      planId: plan.id,
      stripeSubscriptionId: stripeSubscriptionId,
      stripeCustomerId: stripeCustomerId,
      status: stripeSubscription.status,
      currentPeriodStart: this._toDate(stripeSubscription.current_period_start),
      currentPeriodEnd: this._toDate(stripeSubscription.current_period_end)
    });

    console.log('[Stripe] VM provisionnée via invoice.paid fallback', { userId: user.id, planId: plan.id, vmId: dbVm?.id });
  }

  async _handleInvoicePaymentFailed(invoice) {
    const dbSub = invoice.subscription
      ? await database.getSubscriptionByStripeId(invoice.subscription)
      : null;

    const user = dbSub?.user_id
      ? { id: dbSub.user_id }
      : (invoice.customer ? await database.getUserByStripeCustomerId(invoice.customer) : null);

    if (!user?.id) return;

    await database.upsertInvoice({
      userId: user.id,
      subscriptionId: dbSub?.id || null,
      stripeInvoiceId: invoice.id,
      amountPaid: 0,
      currency: invoice.currency,
      status: 'open',
      hostedInvoiceUrl: invoice.hosted_invoice_url
    });

    // Suspendre la VM après échec de paiement
    if (dbSub.vm_id) {
      const vm = await database.getVMById(dbSub.vm_id);
      if (vm && !vm.is_suspended) {
        await vmProvisioner.suspend(vm);
      }
    }
  }
}

export const stripeService = new StripeService();
