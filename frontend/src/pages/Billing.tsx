import { useEffect, useState } from 'react';
import { CreditCard, FileText, ExternalLink, Download, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { billingAPI } from '../api/client';
import type { Subscription, Invoice } from '../types';

const SUB_STATUS: Record<string, string> = {
  active: 'badge-running', past_due: 'badge-error', canceled: 'badge-stopped',
  trialing: 'badge-provisioning', incomplete: 'badge-suspended', unpaid: 'badge-error',
};

export default function Billing() {
  const [subs, setSubs]         = useState<Subscription[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([billingAPI.getCurrent(), billingAPI.getInvoices()])
      .then(([sr, ir]) => { setSubs(sr.data.subscriptions ?? []); setInvoices(ir.data.invoices ?? []); })
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const openPortal = async () => {
    try { const r = await billingAPI.createPortal(); window.location.href = r.data.url; } catch {}
  };

  if (loading) return <div className="page-container"><div className="flex justify-center py-20"><div className="spinner" /></div></div>;

  return (
    <div className="page-container max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Facturation</h1>
          <p className="page-subtitle">Gérez vos abonnements et consultez vos factures</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openPortal} className="btn-secondary">
            <CreditCard className="w-4 h-4" strokeWidth={1.75} />
            Gérer le paiement
          </button>
          <Link to="/order" className="btn-primary">
            <ShoppingCart className="w-4 h-4" strokeWidth={2} />
            Commander
          </Link>
        </div>
      </div>

      {/* Active subscriptions */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Abonnements actifs</h2>
        {subs.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <CreditCard className="empty-state-icon" strokeWidth={1} />
              <p className="empty-state-title">Aucun abonnement actif</p>
              <p className="empty-state-desc mb-4">Commandez votre premier serveur pour démarrer</p>
              <Link to="/order" className="btn-primary btn-sm"><ShoppingCart className="w-3.5 h-3.5" strokeWidth={2} /> Voir les offres</Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {subs.map(sub => (
              <div key={sub.id} className="card card-body">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-900">{sub.planName || `Plan #${sub.planId}`}</p>
                      <span className={SUB_STATUS[sub.status] || 'badge-stopped'}>{sub.status}</span>
                    </div>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      {sub.cpuCores && <span>{sub.cpuCores} vCPU · {sub.ramMb! >= 1024 ? `${sub.ramMb!/1024} GB` : `${sub.ramMb} MB`} · {sub.diskGb} GB</span>}
                      {sub.currentPeriodEnd && <span className="block">Prochaine facturation : {new Date(sub.currentPeriodEnd).toLocaleDateString('fr-FR')}</span>}
                      {sub.cancelAtPeriodEnd && <span className="block text-orange-600 font-medium">⚠ Annulation en fin de période</span>}
                    </div>
                  </div>
                  {sub.priceMonthly && (
                    <div className="text-right">
                      <p className="text-xl font-bold text-slate-900">€{sub.priceMonthly.toFixed(2)}</p>
                      <p className="text-xs text-slate-400">/mois</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoices */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Historique des factures</h2>
        {invoices.length === 0 ? (
          <div className="card card-body text-center py-8 text-slate-400 text-sm">Aucune facture</div>
        ) : (
          <div className="table-wrap">
            <table className="w-full">
              <thead>
                <tr>
                  {['Date', 'Montant', 'Statut', 'Période', 'Actions'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.id} className="table-row">
                    <td className="table-cell">{new Date(inv.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td className="table-cell font-semibold text-slate-900">€{inv.amountPaid.toFixed(2)}</td>
                    <td className="table-cell">
                      <span className={inv.status === 'paid' ? 'badge-running' : 'badge-error'}>{inv.status}</span>
                    </td>
                    <td className="table-cell text-xs text-slate-500">
                      {inv.periodStart && inv.periodEnd
                        ? `${new Date(inv.periodStart).toLocaleDateString('fr-FR')} — ${new Date(inv.periodEnd).toLocaleDateString('fr-FR')}`
                        : '—'}
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        {inv.hostedInvoiceUrl && (
                          <a href={inv.hostedInvoiceUrl} target="_blank" rel="noreferrer" className="btn-icon btn-sm" title="Voir">
                            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                          </a>
                        )}
                        {inv.invoicePdfUrl && (
                          <a href={inv.invoicePdfUrl} target="_blank" rel="noreferrer" className="btn-icon btn-sm" title="Télécharger">
                            <Download className="w-3.5 h-3.5" strokeWidth={2} />
                          </a>
                        )}
                        {!inv.hostedInvoiceUrl && !inv.invoicePdfUrl && <span className="text-slate-400 text-xs">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
