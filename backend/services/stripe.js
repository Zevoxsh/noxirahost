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
  async createCheckoutSession({ user, plan, stripePriceId, vmName, osTemplate }) {
    const stripe = this.getClient();
    const customerId = await this.getOrCreateCustomer(user);
    const metadata = {
      userId: String(user.id),
      planId: String(plan.id),
      vmType: plan.vm_type,
      vmName: vmName || `${plan.name} Server`,
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

  async _handleCheckoutComplete(session) {
    const { userId, planId, vmType, vmName, osTemplate } = session.metadata || {};
    if (!userId || !planId) return;

    const stripe = this.getClient();
    const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
    const plan = await database.getPlanById(parseInt(planId));
    const user = await database.getUserById(parseInt(userId));
    if (!plan || !user) return;

    // Choisir le noeud Proxmox avec le moins de VMs
    const nodes = await database.getActiveNodes();
    if (nodes.length === 0) {
      console.error('[Stripe] No active Proxmox nodes found for provisioning');
      return;
    }
    const node = nodes[0]; // Simplification : premier noeud actif

    // Provisionner la VM
    let dbVm = null;
    try {
      dbVm = await vmProvisioner.create({
        userId: user.id,
        plan,
        node,
        name: vmName || `${plan.name.replace(/\s/g, '-')}-${user.id}`,
        osTemplate: osTemplate || ''
      });
    } catch (error) {
      console.error('[Stripe] VM provisioning failed:', error.message);
    }

    // Créer l'abonnement en DB
    await database.createSubscription({
      userId: user.id,
      vmId: dbVm?.id || null,
      planId: plan.id,
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: session.customer,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000)
    });
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
    if (!plan || !user) return;

    const nodes = await database.getActiveNodes();
    if (nodes.length === 0) {
      console.error('[Stripe] No active Proxmox nodes found for provisioning');
      return;
    }
    const node = nodes[0];

    let dbVm = null;
    try {
      dbVm = await vmProvisioner.create({
        userId: user.id,
        plan,
        node,
        name: vmName || `${plan.name.replace(/\s/g, '-')}-${user.id}`,
        osTemplate: osTemplate || ''
      });
    } catch (error) {
      console.error('[Stripe] VM provisioning failed:', error.message);
    }

    await database.createSubscription({
      userId: user.id,
      vmId: dbVm?.id || null,
      planId: plan.id,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    });
  }

  async _handleSubscriptionUpdated(subscription) {
    const dbSub = await database.getSubscriptionByStripeId(subscription.id);
    if (!dbSub) return;

    await database.updateSubscription(dbSub.id, {
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
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
      periodStart: invoice.period_start ? new Date(invoice.period_start * 1000) : null,
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : null
    });

    // Reprendre la VM si elle était suspendue
    if (dbSub?.vm_id) {
      const vm = await database.getVMById(dbSub.vm_id);
      if (vm?.is_suspended) await vmProvisioner.resume(vm);
    }
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
