/**
 * DatabaseService — méthodes de requête PostgreSQL
 */

import { pool } from '../config/database.js';

class DatabaseService {
  // ─── Users ─────────────────────────────────────────────
  async getUserByUsername(username) {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return rows[0] || null;
  }

  async getUserById(id) {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async getUserByStripeCustomerId(stripeCustomerId) {
    const { rows } = await pool.query('SELECT * FROM users WHERE stripe_customer_id = $1', [stripeCustomerId]);
    return rows[0] || null;
  }

  async createUser({ username, displayName, email, role, passwordHash }) {
    const { rows } = await pool.query(
      `INSERT INTO users (username, display_name, email, role, password_hash)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [username, displayName || username, email || null, role || 'user', passwordHash]
    );
    return rows[0];
  }

  async updateUserLoginTime(id) {
    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [id]);
  }

  async updateUser(id, fields) {
    const entries = Object.entries(fields);
    const setClause = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = entries.map(([, v]) => v);
    const { rows } = await pool.query(
      `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return rows[0];
  }

  async getAllUsers() {
    const { rows } = await pool.query(
      `SELECT u.*, s.status as subscription_status, p.name as plan_name
       FROM users u
       LEFT JOIN subscriptions s ON s.user_id = u.id AND s.status = 'active'
       LEFT JOIN plans p ON p.id = s.plan_id
       ORDER BY u.created_at DESC`
    );
    return rows;
  }

  // ─── Plans ─────────────────────────────────────────────
  _formatPlan(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      vmType: row.vm_type,
      tier: row.tier,
      cpuCores: parseInt(row.cpu_cores),
      ramMb: parseInt(row.ram_mb),
      diskGb: parseInt(row.disk_gb),
      bandwidthGb: row.bandwidth_gb ? parseInt(row.bandwidth_gb) : null,
      priceMonthly: parseFloat(row.price_monthly),
      stripePriceId: row.stripe_price_id,
      maxSnapshots: parseInt(row.max_snapshots ?? 3),
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  _formatSubscription(row) {
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      vmId: row.vm_id,
      planId: row.plan_id,
      stripeSubscriptionId: row.stripe_subscription_id,
      stripeCustomerId: row.stripe_customer_id,
      status: row.status,
      currentPeriodStart: row.current_period_start,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      planName: row.plan_name,
      vmType: row.vm_type,
      cpuCores: row.cpu_cores !== undefined && row.cpu_cores !== null ? parseInt(row.cpu_cores) : undefined,
      ramMb: row.ram_mb !== undefined && row.ram_mb !== null ? parseInt(row.ram_mb) : undefined,
      diskGb: row.disk_gb !== undefined && row.disk_gb !== null ? parseInt(row.disk_gb) : undefined,
      priceMonthly: row.price_monthly !== undefined && row.price_monthly !== null ? parseFloat(row.price_monthly) : undefined
    };
  }

  async getActivePlans() {
    const { rows } = await pool.query('SELECT * FROM plans WHERE is_active = TRUE ORDER BY vm_type, price_monthly');
    return rows.map(r => this._formatPlan(r));
  }

  async getAllPlans() {
    const { rows } = await pool.query('SELECT * FROM plans ORDER BY vm_type, price_monthly');
    return rows.map(r => this._formatPlan(r));
  }

  async getPlanById(id) {
    const { rows } = await pool.query('SELECT * FROM plans WHERE id = $1', [id]);
    return this._formatPlan(rows[0] || null);
  }

  async createPlan(data) {
    const { rows } = await pool.query(
      `INSERT INTO plans (name, slug, vm_type, tier, cpu_cores, ram_mb, disk_gb, bandwidth_gb, price_monthly, stripe_price_id, max_snapshots)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.name, data.slug, data.vmType, data.tier, data.cpuCores, data.ramMb, data.diskGb,
       data.bandwidthGb || null, data.priceMonthly, data.stripePriceId || 'price_PLACEHOLDER', data.maxSnapshots || 3]
    );
    return this._formatPlan(rows[0]);
  }

  async updatePlan(id, fields) {
    const colMap = { name: 'name', slug: 'slug', vmType: 'vm_type', tier: 'tier',
      cpuCores: 'cpu_cores', ramMb: 'ram_mb', diskGb: 'disk_gb', bandwidthGb: 'bandwidth_gb',
      priceMonthly: 'price_monthly', stripePriceId: 'stripe_price_id',
      maxSnapshots: 'max_snapshots', isActive: 'is_active' };
    const entries = Object.entries(fields).filter(([k]) => colMap[k]);
    if (entries.length === 0) return null;
    const setClause = entries.map(([k], i) => `${colMap[k]} = $${i + 2}`).join(', ');
    const values = entries.map(([, v]) => v);
    const { rows } = await pool.query(
      `UPDATE plans SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`, [id, ...values]
    );
    return this._formatPlan(rows[0]);
  }

  // ─── Proxmox Nodes ──────────────────────────────────────
  async getActiveNodes() {
    const { rows } = await pool.query('SELECT * FROM proxmox_nodes WHERE is_active = TRUE');
    return rows;
  }

  async getAllNodes() {
    const { rows } = await pool.query('SELECT * FROM proxmox_nodes ORDER BY name');
    return rows;
  }

  async getNodeById(id) {
    const { rows } = await pool.query('SELECT * FROM proxmox_nodes WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async getNodeByName(name) {
    const { rows } = await pool.query('SELECT * FROM proxmox_nodes WHERE name = $1', [name]);
    return rows[0] || null;
  }

  async createNode(data) {
    const { rows } = await pool.query(
      `INSERT INTO proxmox_nodes (name, host, port, pve_user, pve_password, pve_token_id, pve_token_secret, use_ssl, verify_ssl, storage, bridge)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [data.name, data.host, data.port || 8006, data.pveUser || 'root@pam',
       data.pvePassword || null, data.pveTokenId || null, data.pveTokenSecret || null,
       data.useSsl !== false, data.verifySsl === true,
       data.storage || 'local', data.bridge || 'vmbr0']
    );
    return rows[0];
  }

  // ─── Virtual Machines ───────────────────────────────────
  async getVMsByUserId(userId) {
    const { rows } = await pool.query(
      `SELECT vm.*, p.name as plan_name, p.vm_type, n.name as node_name
       FROM virtual_machines vm
       JOIN plans p ON p.id = vm.plan_id
       JOIN proxmox_nodes n ON n.id = vm.node_id
       WHERE vm.user_id = $1 AND vm.deleted_at IS NULL
       ORDER BY vm.created_at DESC`,
      [userId]
    );
    return rows;
  }

  async getVMById(id) {
    const { rows } = await pool.query(
      `SELECT vm.*, p.name as plan_name, n.name as node_name, n.host as node_host,
              n.pve_user, n.pve_password, n.pve_token_id, n.pve_token_secret,
              n.port as node_port, n.verify_ssl, n.storage as node_storage, n.bridge as node_bridge
       FROM virtual_machines vm
       JOIN plans p ON p.id = vm.plan_id
       JOIN proxmox_nodes n ON n.id = vm.node_id
       WHERE vm.id = $1 AND vm.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  }

  async getVMByIdAndUser(id, userId) {
    const { rows } = await pool.query(
      `SELECT vm.*, n.name as node_name, n.host as node_host,
              n.pve_user, n.pve_password, n.pve_token_id, n.pve_token_secret,
              n.port as node_port, n.verify_ssl, n.storage as node_storage, n.bridge as node_bridge
       FROM virtual_machines vm
       JOIN proxmox_nodes n ON n.id = vm.node_id
       WHERE vm.id = $1 AND vm.user_id = $2 AND vm.deleted_at IS NULL`,
      [id, userId]
    );
    return rows[0] || null;
  }

  async getAllVMs() {
    const { rows } = await pool.query(
      `SELECT vm.*, u.username, u.display_name, p.name as plan_name, n.name as node_name
       FROM virtual_machines vm
       JOIN users u ON u.id = vm.user_id
       JOIN plans p ON p.id = vm.plan_id
       JOIN proxmox_nodes n ON n.id = vm.node_id
       WHERE vm.deleted_at IS NULL
       ORDER BY vm.created_at DESC`
    );
    return rows;
  }

  async createVM(data) {
    const { rows } = await pool.query(
      `INSERT INTO virtual_machines
        (user_id, node_id, plan_id, vmid, vm_type, name, hostname, status, os_template, cpu_cores, ram_mb, disk_gb)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'provisioning',$8,$9,$10,$11) RETURNING *`,
      [data.userId, data.nodeId, data.planId, data.vmid, data.vmType, data.name, data.hostname || null,
       data.osTemplate || null, data.cpuCores, data.ramMb, data.diskGb]
    );
    return rows[0];
  }

  async updateVMStatus(id, status) {
    const { rows } = await pool.query(
      'UPDATE virtual_machines SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id, status]
    );
    return rows[0];
  }

  async updateVM(id, fields) {
    const colMap = { status: 'status', ipAddress: 'ip_address', ipv6Address: 'ipv6_address',
      isSuspended: 'is_suspended', name: 'name' };
    const entries = Object.entries(fields).filter(([k]) => colMap[k]);
    if (entries.length === 0) return null;
    const setClause = entries.map(([k], i) => `${colMap[k]} = $${i + 2}`).join(', ');
    const values = entries.map(([, v]) => v);
    const { rows } = await pool.query(
      `UPDATE virtual_machines SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return rows[0];
  }

  async softDeleteVM(id) {
    await pool.query('UPDATE virtual_machines SET deleted_at = NOW(), status = $2 WHERE id = $1', [id, 'deleting']);
  }

  async getNextVmid(nodeId) {
    const { rows } = await pool.query(
      'SELECT MAX(vmid) as max_vmid FROM virtual_machines WHERE node_id = $1 AND deleted_at IS NULL',
      [nodeId]
    );
    const currentMax = rows[0]?.max_vmid || 199;
    return Math.max(currentMax + 1, parseInt(process.env.PROXMOX_VMID_START || '200', 10));
  }

  // ─── Billing ────────────────────────────────────────────
  async createSubscription(data) {
    const { rows } = await pool.query(
      `INSERT INTO subscriptions
        (user_id, vm_id, plan_id, stripe_subscription_id, stripe_customer_id, status, current_period_start, current_period_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [data.userId, data.vmId || null, data.planId, data.stripeSubscriptionId,
       data.stripeCustomerId, data.status, data.currentPeriodStart, data.currentPeriodEnd]
    );
    return rows[0];
  }

  async getSubscriptionByStripeId(stripeSubscriptionId) {
    const { rows } = await pool.query(
      'SELECT * FROM subscriptions WHERE stripe_subscription_id = $1', [stripeSubscriptionId]
    );
    return rows[0] || null;
  }

  async getSubscriptionsByUserId(userId) {
    const { rows } = await pool.query(
      `SELECT s.*, p.name as plan_name, p.vm_type, p.cpu_cores, p.ram_mb, p.disk_gb, p.price_monthly
       FROM subscriptions s JOIN plans p ON p.id = s.plan_id
       WHERE s.user_id = $1 ORDER BY s.created_at DESC`,
      [userId]
    );
    return rows.map(r => this._formatSubscription(r));
  }

  async updateSubscription(id, fields) {
    const colMap = { status: 'status', currentPeriodStart: 'current_period_start',
      currentPeriodEnd: 'current_period_end', cancelAtPeriodEnd: 'cancel_at_period_end', vmId: 'vm_id' };
    const entries = Object.entries(fields).filter(([k]) => colMap[k]);
    if (entries.length === 0) return null;
    const setClause = entries.map(([k], i) => `${colMap[k]} = $${i + 2}`).join(', ');
    const values = entries.map(([, v]) => v);
    const { rows } = await pool.query(
      `UPDATE subscriptions SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
    return rows[0];
  }

  async upsertInvoice(data) {
    const { rows } = await pool.query(
      `INSERT INTO invoices (user_id, subscription_id, stripe_invoice_id, amount_paid, currency, status,
        hosted_invoice_url, invoice_pdf_url, period_start, period_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (stripe_invoice_id) DO UPDATE SET status = $6, amount_paid = $4, updated_at = NOW()
       RETURNING *`,
      [data.userId, data.subscriptionId || null, data.stripeInvoiceId, data.amountPaid || 0,
       data.currency || 'eur', data.status, data.hostedInvoiceUrl || null, data.invoicePdfUrl || null,
       data.periodStart || null, data.periodEnd || null]
    );
    return rows[0];
  }

  async getInvoicesByUserId(userId) {
    const { rows } = await pool.query(
      'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    return rows;
  }

  async isStripeEventProcessed(eventId) {
    const { rows } = await pool.query('SELECT 1 FROM stripe_events WHERE stripe_event_id = $1', [eventId]);
    return rows.length > 0;
  }

  async markStripeEventProcessed(eventId, eventType) {
    await pool.query(
      'INSERT INTO stripe_events (stripe_event_id, event_type) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [eventId, eventType]
    );
  }

  // ─── ISOs / Templates ──────────────────────────────────
  async getActiveIsos() {
    const { rows } = await pool.query(
      'SELECT i.*, n.name as node_name FROM isos i JOIN proxmox_nodes n ON n.id = i.node_id WHERE i.is_active = TRUE'
    );
    return rows;
  }

  async getActiveLxcTemplates() {
    const { rows } = await pool.query(
      'SELECT t.*, n.name as node_name FROM lxc_templates t JOIN proxmox_nodes n ON n.id = t.node_id WHERE t.is_active = TRUE'
    );
    return rows;
  }

  async upsertIso(data) {
    await pool.query(
      `INSERT INTO isos (node_id, storage, volid, filename, size_bytes)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (volid) DO UPDATE SET filename = $4, size_bytes = $5`,
      [data.nodeId, data.storage, data.volid, data.filename, data.sizeBytes || null]
    );
  }

  async upsertLxcTemplate(data) {
    await pool.query(
      `INSERT INTO lxc_templates (node_id, storage, volid, filename, os_type)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (volid) DO UPDATE SET filename = $4, os_type = $5`,
      [data.nodeId, data.storage, data.volid, data.filename, data.osType || null]
    );
  }

  // ─── Support ────────────────────────────────────────────
  async getTicketsByUserId(userId) {
    const { rows } = await pool.query(
      'SELECT * FROM support_tickets WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return rows;
  }

  async getTicketById(id) {
    const { rows } = await pool.query('SELECT * FROM support_tickets WHERE id = $1', [id]);
    return rows[0] || null;
  }

  async createTicket(data) {
    const { rows } = await pool.query(
      'INSERT INTO support_tickets (user_id, vm_id, subject, priority) VALUES ($1,$2,$3,$4) RETURNING *',
      [data.userId, data.vmId || null, data.subject, data.priority || 'low']
    );
    return rows[0];
  }

  async getTicketMessages(ticketId) {
    const { rows } = await pool.query(
      `SELECT tm.*, u.username, u.display_name FROM ticket_messages tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.ticket_id = $1 ORDER BY tm.created_at ASC`,
      [ticketId]
    );
    return rows;
  }

  async addTicketMessage(ticketId, userId, message, isStaff = false) {
    const { rows } = await pool.query(
      'INSERT INTO ticket_messages (ticket_id, user_id, message, is_staff) VALUES ($1,$2,$3,$4) RETURNING *',
      [ticketId, userId, message, isStaff]
    );
    await pool.query('UPDATE support_tickets SET updated_at = NOW() WHERE id = $1', [ticketId]);
    return rows[0];
  }

  async closeTicket(id) {
    const { rows } = await pool.query(
      "UPDATE support_tickets SET status = 'closed', closed_at = NOW() WHERE id = $1 RETURNING *",
      [id]
    );
    return rows[0];
  }

  // ─── Admin Stats ────────────────────────────────────────
  async getAdminStats() {
    const [users, vms, subs, revenue] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM users WHERE is_active = TRUE'),
      pool.query("SELECT COUNT(*) FROM virtual_machines WHERE deleted_at IS NULL AND status != 'deleting'"),
      pool.query("SELECT COUNT(*) FROM subscriptions WHERE status = 'active'"),
      pool.query("SELECT COALESCE(SUM(amount_paid),0) as total FROM invoices WHERE status = 'paid' AND created_at > NOW() - INTERVAL '30 days'")
    ]);
    return {
      totalUsers: parseInt(users.rows[0].count),
      totalVMs: parseInt(vms.rows[0].count),
      activeSubscriptions: parseInt(subs.rows[0].count),
      monthlyRevenue: parseFloat(revenue.rows[0].total)
    };
  }

  async getAuditLogs(limit = 50, offset = 0) {
    const { rows } = await pool.query(
      `SELECT al.*, u.username FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ORDER BY al.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return rows;
  }

  async logAudit(userId, action, entityType, entityId, details, ipAddress) {
    await pool.query(
      'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address) VALUES ($1,$2,$3,$4,$5,$6)',
      [userId || null, action, entityType || null, entityId || null, details || null, ipAddress || null]
    );
  }
}

export const database = new DatabaseService();
