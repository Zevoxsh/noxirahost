import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Server, ShoppingCart, CreditCard,
  LifeBuoy, User, LogOut, Zap, Shield, Plus
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { authAPI } from '../../api/client';

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/vms',       icon: Server,          label: 'Mes serveurs' },
  { to: '/billing',   icon: CreditCard,      label: 'Facturation' },
  { to: '/support',   icon: LifeBuoy,        label: 'Support' },
  { to: '/profile',   icon: User,            label: 'Mon compte' },
];

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch {}
    logout();
    navigate('/login');
  };

  const initials = (user?.displayName || user?.username || '?')
    .split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="flex min-h-screen bg-slate-100">

      {/* ── Sidebar blanche ─────────────────────────── */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed inset-y-0 left-0 z-30 shadow-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 border-b border-slate-100 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm leading-tight">Noxira</p>
            <p className="text-[10px] text-slate-400 font-medium">Hébergement VPS & LXC</p>
          </div>
        </div>

        {/* Bouton commander */}
        <div className="px-4 py-4 border-b border-slate-100">
          <NavLink
            to="/order"
            className="flex items-center justify-center gap-2 w-full py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
            Nouveau serveur
          </NavLink>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
            >
              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
              <span>{label}</span>
            </NavLink>
          ))}

          {user?.role === 'admin' && (
            <>
              <span className="nav-section-label">Administration</span>
              <NavLink
                to="/admin/dashboard"
                className={({ isActive }) => isActive ? 'nav-link-active' : 'nav-link'}
              >
                <Shield className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                <span>Panel admin</span>
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                  ADMIN
                </span>
              </NavLink>
            </>
          )}
        </nav>

        {/* Pied de page utilisateur */}
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-slate-50 group transition-colors">
            <div className="w-8 h-8 rounded-lg bg-brand-100 border border-brand-200 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-brand-700">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate leading-tight">
                {user?.displayName || user?.username}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {user?.email || user?.username}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Déconnexion"
              className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Contenu principal ───────────────────────── */}
      <div className="flex-1 flex flex-col ml-64 min-h-screen">

        {/* Topbar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-6 flex-shrink-0 sticky top-0 z-20 shadow-sm">
          <div className="flex-1" />
          <NavLink to="/order" className="btn-primary btn-sm">
            <ShoppingCart className="w-3.5 h-3.5" strokeWidth={2} />
            Commander
          </NavLink>
        </header>

        {/* Page */}
        <main className="flex-1 bg-slate-100">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
