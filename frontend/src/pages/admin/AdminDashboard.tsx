import { useEffect, useState } from 'react';
import { Users, Server, CreditCard, TrendingUp, Activity } from 'lucide-react';
import { adminAPI } from '../../api/client';
import type { AdminStats } from '../../types';
import StatsCard from '../../components/ui/StatsCard';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAPI.getStats().then(r => setStats(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Vue d'ensemble de la plateforme</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatsCard label="Utilisateurs"       value={stats?.totalUsers ?? 0}           icon={Users}      color="blue" />
            <StatsCard label="Serveurs actifs"    value={stats?.totalVMs ?? 0}             icon={Server}     color="green" />
            <StatsCard label="Abonnements"        value={stats?.activeSubscriptions ?? 0}  icon={Activity}   color="purple" />
            <StatsCard label="Revenus du mois"    value={`€${(stats?.monthlyRevenue ?? 0).toFixed(2)}`} icon={TrendingUp} color="orange" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card card-body">
              <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
                Revenus mensuels
              </h2>
              <div className="text-3xl font-bold text-slate-900 mb-1">
                €{(stats?.monthlyRevenue ?? 0).toFixed(2)}
              </div>
              <p className="text-sm text-slate-500">{stats?.activeSubscriptions ?? 0} abonnements actifs</p>
            </div>

            <div className="card card-body">
              <h2 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                <Server className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
                Infrastructure
              </h2>
              <div className="text-3xl font-bold text-slate-900 mb-1">{stats?.totalVMs ?? 0}</div>
              <p className="text-sm text-slate-500">serveurs déployés sur la plateforme</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
