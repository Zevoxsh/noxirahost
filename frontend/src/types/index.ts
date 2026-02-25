// ─── Types partagés Noxira ───────────────────────

export type VMType = 'kvm' | 'lxc';
export type VMStatus = 'running' | 'stopped' | 'suspended' | 'error' | 'provisioning' | 'deleting';
export type PlanTier = 's' | 'm' | 'l';
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete' | 'unpaid';
export type TicketStatus = 'open' | 'in_progress' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface User {
  id: number;
  username: string;
  displayName: string;
  email?: string;
  role: 'admin' | 'user';
  avatarUrl?: string;
  stripeCustomerId?: string;
  isSuspended?: boolean;
  createdAt?: string;
}

export interface Plan {
  id: number;
  name: string;
  slug: string;
  vmType: VMType;
  tier: PlanTier;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  bandwidthGb?: number;
  priceMonthly: number;
  stripePriceId: string;
  maxSnapshots: number;
  isActive: boolean;
}

export interface VirtualMachine {
  id: number;
  userId: number;
  nodeId: number;
  planId: number;
  vmid: number;
  vmType: VMType;
  name: string;
  hostname?: string;
  status: VMStatus;
  osTemplate?: string;
  ipAddress?: string;
  cpuCores: number;
  ramMb: number;
  diskGb: number;
  isSuspended: boolean;
  planName?: string;
  nodeName?: string;
  createdAt: string;
}

export interface LiveStatus {
  status: string;
  cpu?: number;       // 0-1
  mem?: number;       // bytes
  maxmem?: number;
  uptime?: number;    // secondes
  netin?: number;
  netout?: number;
  error?: string;
}

export interface Subscription {
  id: number;
  userId: number;
  vmId?: number;
  planId: number;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  status: SubscriptionStatus;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
  planName?: string;
  vmType?: VMType;
  cpuCores?: number;
  ramMb?: number;
  diskGb?: number;
  priceMonthly?: number;
}

export interface Invoice {
  id: number;
  stripeInvoiceId: string;
  amountPaid: number;
  currency: string;
  status: string;
  hostedInvoiceUrl?: string;
  invoicePdfUrl?: string;
  periodStart?: string;
  periodEnd?: string;
  createdAt: string;
}

export interface ProxmoxNode {
  id: number;
  name: string;
  host: string;
  port: number;
  pveUser: string;
  storage: string;
  bridge: string;
  isActive: boolean;
  vmidStart?: number;
  health?: {
    online: boolean;
    cpu?: number;
    memPercent?: number;
    uptime?: number;
  };
}

export interface ISO {
  id: number;
  nodeId: number;
  storage: string;
  volid: string;
  filename: string;
  sizeBytes?: number;
  nodeName?: string;
}

export interface LxcTemplate {
  id: number;
  nodeId: number;
  storage: string;
  volid: string;
  filename: string;
  osType?: string;
  nodeName?: string;
}

export interface SupportTicket {
  id: number;
  userId: number;
  vmId?: number;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface TicketMessage {
  id: number;
  ticketId: number;
  userId: number;
  message: string;
  isStaff: boolean;
  username: string;
  displayName: string;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  totalVMs: number;
  activeSubscriptions: number;
  monthlyRevenue: number;
}
