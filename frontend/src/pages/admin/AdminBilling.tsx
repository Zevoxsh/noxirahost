import { useEffect, useState } from 'react';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { adminAPI } from '../../api/client';
import StatsCard from '../../components/ui/StatsCard';
import { CreditCard, Users } from 'lucide-react';

export default function AdminBilling() {
  const [overview, setOverview] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([adminAPI.getBillingOverview(), adminAPI.getAllInvoices({ limit: 50 })])
      .then(([ov, iv]) => { setOverview(ov.data); setInvoices(iv.data.invoices ?? []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page-container"><div className="flex justify-center py-20"><div className="spinner" /></div></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturation</h1>
          <p className="page-subtitle">Revenus et factures de la plateforme</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatsCard label="Revenus du mois"    value={`€${(overview?.monthlyRevenue ?? 0).toFixed(2)}`} icon={TrendingUp} color="green" />
        <StatsCard label="Total factures"     value={overview?.totalInvoices ?? 0}  icon={CreditCard} color="blue" />
        <StatsCard label="Abonnements actifs" value={overview?.activeSubscriptions ?? 0} icon={Users} color="purple" />
      </div>

      <div className="table-wrap">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-slate-700">Dernières factures</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr>{['Date', 'Utilisateur', 'Montant', 'Statut', 'Période', ''].map(h => <th key={h} className="table-header">{h}</th>)}</tr>
          </thead>
          <tbody>
            {invoices.length === 0 ? (
              <tr><td colSpan={6} className="table-cell text-center text-slate-400 py-8">Aucune facture</td></tr>
            ) : invoices.map((inv: any) => (
              <tr key={inv.id} className="table-row">
                <td className="table-cell text-xs">{new Date(inv.created_at || inv.createdAt).toLocaleDateString('fr-FR')}</td>
                <td className="table-cell text-xs text-slate-500">{inv.username || `#${inv.user_id}`}</td>
                <td className="table-cell font-semibold">€{(inv.amount_paid ?? inv.amountPaid ?? 0).toFixed(2)}</td>
                <td className="table-cell"><span className={(inv.status === 'paid') ? 'badge-running' : 'badge-error'}>{inv.status}</span></td>
                <td className="table-cell text-xs text-slate-500">
                  {inv.period_start ? `${new Date(inv.period_start).toLocaleDateString('fr-FR')} — ${new Date(inv.period_end).toLocaleDateString('fr-FR')}` : '—'}
                </td>
                <td className="table-cell">
                  {inv.hosted_invoice_url && (
                    <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer" className="btn-icon btn-sm">
                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
