import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { authAPI } from './api/client';

import Layout from './components/layout/Layout';
import AdminLayout from './components/layout/AdminLayout';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import VMs from './pages/VMs';
import VMDetail from './pages/VMDetail';
import Order from './pages/Order';
import Deploy from './pages/Deploy';
import Console from './pages/Console';
import Billing from './pages/Billing';
import Support from './pages/Support';
import TicketDetail from './pages/TicketDetail';
import Profile from './pages/Profile';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminNodes from './pages/admin/AdminNodes';
import AdminPlans from './pages/admin/AdminPlans';
import AdminUsers from './pages/admin/AdminUsers';
import AdminVMs from './pages/admin/AdminVMs';
import AdminBilling from './pages/admin/AdminBilling';

function Spinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        <p className="text-sm text-slate-500">Chargement…</p>
      </div>
    </div>
  );
}

function ProtectedRoute() {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function AdminRoute() {
  const { user } = useAuthStore();
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const { setUser } = useAuthStore();

  useEffect(() => {
    authAPI.verify()
      .then(res => { if (res.data.user) setUser(res.data.user); })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, [setUser]);

  if (!authChecked) return <Spinner />;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/vms/:id/console" element={<Console />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/order"     element={<Order />} />
            <Route path="/vms"       element={<VMs />} />
            <Route path="/vms/:id"   element={<VMDetail />} />
            <Route path="/deploy"    element={<Deploy />} />
            <Route path="/billing"   element={<Billing />} />
            <Route path="/support"   element={<Support />} />
            <Route path="/support/:id" element={<TicketDetail />} />
            <Route path="/profile"   element={<Profile />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin"           element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/admin/nodes"     element={<AdminNodes />} />
              <Route path="/admin/plans"     element={<AdminPlans />} />
              <Route path="/admin/users"     element={<AdminUsers />} />
              <Route path="/admin/vms"       element={<AdminVMs />} />
              <Route path="/admin/billing"   element={<AdminBilling />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
