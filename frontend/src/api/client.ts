/**
 * Client API — axios instance + namespaces d'API
 * Basé sur NebulaProxyV3/frontend/src/api/client.js
 */

import axios from 'axios';
import { useAuthStore } from '../store/authStore';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' }
});

// Intercepteur 401 → logout + redirect login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      const currentPath = window.location.pathname;
      if (currentPath !== '/login' && currentPath !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────
export const authAPI = {
  login: (credentials: { username: string; password: string }) =>
    api.post('/auth/login', credentials),
  register: (data: { username: string; password: string; displayName?: string; email?: string }) =>
    api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  verify: () => api.get('/auth/verify'),
  getMode: () => api.get('/auth/mode')
};

// ─── User ──────────────────────────────────────────────
export const userAPI = {
  getMe: () => api.get('/user/me'),
  updateProfile: (data: { displayName?: string; email?: string; avatarUrl?: string }) =>
    api.put('/user/profile', data)
};

// ─── VMs ───────────────────────────────────────────────
export const vmAPI = {
  list: () => api.get('/vms'),
  get: (id: number) => api.get(`/vms/${id}`),
  delete: (id: number) => api.delete(`/vms/${id}`),
  getStatus: (id: number) => api.get(`/vms/${id}/status`),
  power: (id: number, action: 'start' | 'stop' | 'reboot' | 'shutdown') =>
    api.post(`/vms/${id}/power`, { action }),
  getConsoleToken: (id: number) => api.post(`/vms/${id}/console`),
  listSnapshots: (id: number) => api.get(`/vms/${id}/snapshots`),
  createSnapshot: (id: number, name: string, description?: string) =>
    api.post(`/vms/${id}/snapshots`, { name, description }),
  deleteSnapshot: (id: number, snapname: string) =>
    api.delete(`/vms/${id}/snapshots/${snapname}`)
};

// ─── Billing ───────────────────────────────────────────
export const billingAPI = {
  getPlans: () => api.get('/billing/plans'),
  getCurrent: () => api.get('/billing/current'),
  createCheckout: (data: { planId: number; vmName?: string; osTemplate?: string }) =>
    api.post('/billing/checkout', data),
  createPortal: () => api.post('/billing/portal'),
  getInvoices: () => api.get('/billing/invoices')
};

// ─── ISOs & Templates ──────────────────────────────────
export const isoAPI = {
  list: () => api.get('/isos'),
  sync: () => api.post('/isos/sync')
};

export const templateAPI = {
  list: () => api.get('/templates'),
  sync: () => api.post('/templates/sync')
};

// ─── Support ───────────────────────────────────────────
export const supportAPI = {
  listTickets: () => api.get('/support/tickets'),
  createTicket: (data: { subject: string; message: string; priority?: string; vmId?: number }) =>
    api.post('/support/tickets', data),
  getTicket: (id: number) => api.get(`/support/tickets/${id}`),
  replyTicket: (id: number, message: string) =>
    api.post(`/support/tickets/${id}/messages`, { message }),
  closeTicket: (id: number) => api.put(`/support/tickets/${id}/close`)
};

// ─── Admin ─────────────────────────────────────────────
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getAuditLogs: (params?: { limit?: number; offset?: number }) =>
    api.get('/admin/audit-logs', { params }),

  // Nodes
  listNodes: () => api.get('/admin/nodes'),
  createNode: (data: object) => api.post('/admin/nodes', data),
  updateNode: (id: number, data: object) => api.put(`/admin/nodes/${id}`, data),
  deleteNode: (id: number) => api.delete(`/admin/nodes/${id}`),
  getNodeHealth: (id: number) => api.get(`/admin/nodes/${id}/health`),

  // Plans
  listPlans: () => api.get('/admin/plans'),
  createPlan: (data: object) => api.post('/admin/plans', data),
  updatePlan: (id: number, data: object) => api.put(`/admin/plans/${id}`, data),
  deletePlan: (id: number) => api.delete(`/admin/plans/${id}`),

  // Users
  listUsers: () => api.get('/admin/users'),
  getUser: (id: number) => api.get(`/admin/users/${id}`),
  suspendUser: (id: number, reason?: string) => api.put(`/admin/users/${id}/suspend`, { reason }),
  unsuspendUser: (id: number) => api.put(`/admin/users/${id}/unsuspend`),
  deleteUser: (id: number) => api.delete(`/admin/users/${id}`),

  // VMs
  listAllVMs: () => api.get('/admin/vms'),
  suspendVM: (id: number) => api.post(`/admin/vms/${id}/suspend`),
  deleteVM: (id: number) => api.delete(`/admin/vms/${id}`),

  // Billing
  getBillingOverview: () => api.get('/admin/billing/overview'),
  getAllInvoices: (params?: { limit?: number }) => api.get('/admin/billing/invoices', { params }),

  // ISOs sync
  syncISOs: () => api.post('/isos/sync'),
  syncTemplates: () => api.post('/templates/sync')
};

export default api;
