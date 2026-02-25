import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  CreditCard, FileText, ExternalLink, Download, ShoppingCart,
  Server, CheckCircle, AlertCircle, Clock, ArrowRight,
  XCircle, RotateCcw, Zap, HardDrive, Cpu, Wifi, Calendar,
  ChevronRight, RefreshCw
} from 'lucide-react';
import { billingAPI, vmAPI } from '../api/client';
import type { Subscription, Invoice } from '../types';

// Extended subscription type with VM data
interface EnrichedSubscription extends Subscription {
  vmName?: string | null;
  vmVmid?: number | null;
  vmIpAddress?: string | null;
  vmOsTemplate?: string | null;
  vmStatus?: string | null;
}

const fmtDate = (d: string | null | undefined, opts?: Intl.DateTimeFormatOptions) =>
  d ? new Date(d).toLocaleDateString('fr-FR', opts ?? { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtAmount = (n: number | undefined | null) =>
  typeof n === 'number' ? `€${n.toFixed(2)}` : '—';

function PeriodBar({ start, end }: { start?: string | null; end?: string | null }) {
  if (!start || !end) return null;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  const now = Date.now();
  const pct = Math.min(100, Math.max(0, Math.round(((now - s) / (e - s)) * 100)));
  const daysLeft = Math.ceil((e - now) / 86400000);
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-500">
        <span>{fmtDate(start, { day: '2-digit', month: 'short' })}</span>
        <span className={daysLeft <= 3 ? 'text-amber-600 font-medium' : ''}>
          {daysLeft > 0 ? `Renouvelle dans ${daysLeft}j` : 'Expiré'}
        </span>
        <span>{fmtDate(end, { day: '2-digit', month: 'short' })}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${pct > 85 ? 'bg-amber-400' : 'bg-brand-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusPill({ status, cancelAtPeriodEnd }: { status: string; cancelAtPeriodEnd?: boolean }) {
  if (cancelAtPeriodEnd) return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="w-3 h-3" /> Résiliation en cours
    </span>
  );
  const map: Record<string, { cls: string; label: string }> = {
    active:     { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Actif' },
    past_due:   { cls: 'bg-red-50 text-red-700 border-red-200',            label: 'Impayé' },
    canceled:   { cls: 'bg-slate-100 text-slate-500 border-slate-200',     label: 'Résilié' },
    trialing:   { cls: 'bg-blue-50 text-blue-700 border-blue-200',         label: 'Essai' },
    incomplete: { cls: 'bg-orange-50 text-orange-700 border-orange-200',   label: 'Incomplet' },
    unpaid:     { cls: 'bg-red-50 text-red-700 border-red-200',            label: 'Impayé' },
  };
  const { cls, label } = map[status] ?? { cls: 'bg-slate-100 text-slate-500 border-slate-200', label: status };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'active' ? 'bg-emerald-500' : 'bg-current'}`} />
      {label}
    </span>
  );
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    paid:          { cls: 'bg-emerald-50 text-emerald-700', label: '✓ Payée' },
    open:          { cls: 'bg-amber-50 text-amber-700',     label: '⏳ En attente' },
    uncollectible: { cls: 'bg-red-50 text-red-600',         label: '✗ Irrécouvrée' },
    void:          { cls: 'bg-slate-100 text-slate-500',    label: 'Annulée' },
  };
  const { cls, label } = map[status] ?? { cls: 'bg-slate-100 text-slate-500', label: status };
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
}

export default function Billing() {
  const [subs, setSubs]           = useState<EnrichedSubscription[]>([]);
  const [invoices, setInvoices]   = useState<Invoice[]>([]);
  const [loading, setLoading]     = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [msg, setMsg]             = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [sr, ir] = await Promise.all([billingAPI.getCurrent(), billingAPI.getInvoices()]);
      setSubs(sr.data.subscriptions ?? []);
      setInvoices(ir.data.invoices ?? []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openPortal = async () => {
    setPortalLoading(true);
    try { const r = await billingAPI.createPortal(); window.location.href = r.data.url; }
    catch { setPortalLoading(false); }
  };

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 5000);
  };

  const handleCancel = async (sub: EnrichedSubscription) => {
    if (!sub.vmVmid) return;
    if (!confirm(`Résilier l'abonnement "${sub.vmName || sub.planName}" ?\n\nLe serveur restera actif jusqu'au ${fmtDate(sub.currentPeriodEnd?.toString())}, puis sera supprimé.`)) return;
    try {
      await vmAPI.cancelVM(sub.vmVmid);
      showMsg('success', 'Résiliation programmée. Le serveur sera supprimé à la fin de la période en cours.');
      load();
    } catch (e: any) {
      showMsg('error', e?.response?.data?.error || 'Erreur lors de la résiliation.');
    }
  };

  const handleUndoCancel = async (sub: EnrichedSubscription) => {
    if (!sub.vmVmid) return;
    try {
      await vmAPI.undoCancelVM(sub.vmVmid);
      showMsg('success', 'Résiliation annulée. Votre abonnement continue normalement.');
      load();
    } catch (e: any) {
      showMsg('error', e?.response?.data?.error || 'Erreur.');
    }
  };

  // Compute summary stats
  const activeSubs   = subs.filter(s => s.status === 'active' || s.status === 'trialing');
  const monthlyTotal = activeSubs.reduce((acc, s) => acc + (s.priceMonthly ?? 0), 0);
  const nextBilling  = activeSubs
    .map(s => s.currentPeriodEnd ? new Date(s.currentPeriodEnd.toString()) : null)
    .filter(Boolean)
    .sort((a, b) => a!.getTime() - b!.getTime())[0];
  const hasPastDue   = subs.some(s => s.status === 'past_due' || s.status === 'unpaid');

  const invoiceNum = (stripeId: string) => {
    const suffix = stripeId.replace(/^in_/, '').slice(-8).toUpperCase();
    return `#${suffix}`;
  };

  if (loading) return (
    <div className="page-container flex items-center justify-center py-24">
      <div className="spinner w-8 h-8" />
    </div>
  );

  return (
    <div className="page-container max-w-5xl">

      {/* Header */}
      <div className="page-header mb-6">
        <div>
          <h1 className="page-title">Facturation</h1>
          <p className="page-subtitle">Gérez vos abonnements et consultez vos factures</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={openPortal} disabled={portalLoading}
            className="btn-secondary inline-flex items-center gap-2">
            {portalLoading ? <div className="spinner w-4 h-4" /> : <CreditCard className="w-4 h-4" strokeWidth={1.75} />}
            Paiement &amp; adresse
          </button>
          <Link to="/order" className="btn-primary">
            <ShoppingCart className="w-4 h-4" strokeWidth={2} />
            Commander
          </Link>
        </div>
      </div>

      {/* Message feedback */}
      {msg && (
        <div className={`mb-5 px-4 py-3 rounded-xl border text-sm font-medium flex items-center gap-2 ${
          msg.type === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {msg.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {msg.text}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Dépense mensuelle</p>
          <p className="text-2xl font-bold text-slate-900">{monthlyTotal > 0 ? fmtAmount(monthlyTotal) : '—'}</p>
          <p className="text-xs text-slate-400 mt-0.5">par mois</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Prochain paiement</p>
          <p className="text-lg font-bold text-slate-900 leading-tight">
            {nextBilling ? nextBilling.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' }) : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {nextBilling ? nextBilling.getFullYear() : 'Aucun service actif'}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-xs text-slate-400 font-medium mb-1">Services actifs</p>
          <p className="text-2xl font-bold text-slate-900">{activeSubs.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">{subs.length} au total</p>
        </div>
        <div className={`rounded-2xl border shadow-sm p-4 ${hasPastDue ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
          <p className={`text-xs font-medium mb-1 ${hasPastDue ? 'text-red-500' : 'text-slate-400'}`}>Statut paiement</p>
          <div className="flex items-center gap-1.5">
            {hasPastDue
              ? <><AlertCircle className="w-5 h-5 text-red-500" /><p className="text-base font-bold text-red-700">Impayé</p></>
              : <><CheckCircle className="w-5 h-5 text-emerald-500" /><p className="text-base font-bold text-slate-900">À jour</p></>
            }
          </div>
          {hasPastDue && (
            <button onClick={openPortal} className="text-xs text-red-600 underline mt-1">Mettre à jour →</button>
          )}
        </div>
      </div>

      {/* ── Services / Subscriptions ───────────────────────────── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
            Mes services
          </h2>
          <button onClick={load} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors" title="Actualiser">
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
          </button>
        </div>

        {subs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
            <div className="empty-state py-16">
              <Server className="empty-state-icon" strokeWidth={1} />
              <p className="empty-state-title">Aucun service</p>
              <p className="empty-state-desc mb-5">Déployez votre premier VPS ou conteneur LXC</p>
              <Link to="/order" className="btn-primary">
                <ShoppingCart className="w-4 h-4" strokeWidth={2} /> Voir les offres
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {subs.map(sub => {
              const isKvm = sub.vmType === 'kvm';
              const isActive = sub.status === 'active' || sub.status === 'trialing';
              const isCanceling = sub.cancelAtPeriodEnd;
              const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd.toString()) : null;
              const daysLeft = periodEnd ? Math.ceil((periodEnd.getTime() - Date.now()) / 86400000) : null;

              return (
                <div key={sub.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  {/* Color strip */}
                  <div className={`h-1 w-full ${
                    isCanceling ? 'bg-amber-400' :
                    sub.status === 'past_due' || sub.status === 'unpaid' ? 'bg-red-400' :
                    isKvm ? 'bg-indigo-400' : 'bg-teal-400'
                  }`} />

                  <div className="p-5">
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isKvm ? 'bg-indigo-50' : 'bg-teal-50'}`}>
                          <Server className={`w-5 h-5 ${isKvm ? 'text-indigo-500' : 'text-teal-500'}`} strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center flex-wrap gap-2">
                            <h3 className="font-semibold text-slate-900 truncate">
                              {sub.vmName || sub.planName || `Service #${sub.id}`}
                            </h3>
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isKvm ? 'bg-indigo-50 text-indigo-600' : 'bg-teal-50 text-teal-600'}`}>
                              {String(sub.vmType ?? 'KVM').toUpperCase()}
                            </span>
                            <StatusPill status={sub.status} cancelAtPeriodEnd={isCanceling} />
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">{sub.planName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xl font-bold text-slate-900">{fmtAmount(sub.priceMonthly)}</p>
                          <p className="text-xs text-slate-400">/mois</p>
                        </div>
                        {sub.vmVmid && (
                          <Link to={`/vms/${sub.vmVmid}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors">
                            Gérer <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Specs row */}
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mb-4 pb-4 border-b border-slate-100">
                      {sub.cpuCores && (
                        <span className="flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5 text-slate-300" /> {sub.cpuCores} vCPU
                        </span>
                      )}
                      {sub.ramMb && (
                        <span className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5 text-slate-300" />
                          {sub.ramMb >= 1024 ? `${sub.ramMb / 1024} GB` : `${sub.ramMb} MB`} RAM
                        </span>
                      )}
                      {sub.diskGb && (
                        <span className="flex items-center gap-1">
                          <HardDrive className="w-3.5 h-3.5 text-slate-300" /> {sub.diskGb} GB SSD
                        </span>
                      )}
                      {sub.vmIpAddress && (
                        <span className="flex items-center gap-1 font-mono">
                          <Wifi className="w-3.5 h-3.5 text-slate-300" /> {sub.vmIpAddress}
                        </span>
                      )}
                      <span className="sm:hidden font-semibold text-slate-700 ml-auto">{fmtAmount(sub.priceMonthly)}/mois</span>
                    </div>

                    {/* Period progress */}
                    <div className="mb-4">
                      <PeriodBar start={sub.currentPeriodStart?.toString()} end={sub.currentPeriodEnd?.toString()} />
                    </div>

                    {/* Cancellation notice + actions */}
                    {isCanceling ? (
                      <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" strokeWidth={2} />
                          <div>
                            <p className="text-sm font-semibold text-amber-800">Résiliation programmée</p>
                            <p className="text-xs text-amber-700">
                              Ce serveur sera supprimé le {fmtDate(sub.currentPeriodEnd?.toString())}
                              {daysLeft !== null && daysLeft > 0 && ` (dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''})`}
                            </p>
                          </div>
                        </div>
                        {sub.vmVmid && (
                          <button onClick={() => handleUndoCancel(sub)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors flex-shrink-0">
                            <RotateCcw className="w-3 h-3" strokeWidth={2.5} />
                            Annuler
                          </button>
                        )}
                      </div>
                    ) : isActive && sub.vmVmid ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          <Calendar className="w-3.5 h-3.5" strokeWidth={2} />
                          Prochaine facturation : <span className="font-medium text-slate-600">{fmtDate(sub.currentPeriodEnd?.toString())}</span>
                        </div>
                        <button onClick={() => handleCancel(sub)}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors">
                          <XCircle className="w-3.5 h-3.5" strokeWidth={2} />
                          Résilier
                        </button>
                      </div>
                    ) : sub.status === 'past_due' || sub.status === 'unpaid' ? (
                      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                        <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        <p className="text-sm text-red-700 font-medium">Paiement en échec — </p>
                        <button onClick={openPortal} className="text-sm text-red-700 underline font-semibold">
                          Mettre à jour le moyen de paiement
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Invoice history ────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
            Historique des factures
            {invoices.length > 0 && (
              <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                {invoices.length}
              </span>
            )}
          </h2>
        </div>

        {invoices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-12 text-center">
            <FileText className="w-10 h-10 text-slate-200 mx-auto mb-3" strokeWidth={1} />
            <p className="text-sm text-slate-400">Aucune facture pour le moment</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Numéro', 'Date', 'Montant', 'Statut', 'Période', 'Actions'].map(h => (
                    <th key={h} className="table-header">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {invoices.map((inv: any) => {
                  const createdAt = inv.created_at ?? inv.createdAt;
                  const rawAmount = inv.amount_paid ?? inv.amountPaid ?? 0;
                  const amount = Number(rawAmount);
                  const pStart = inv.period_start ?? inv.periodStart;
                  const pEnd   = inv.period_end   ?? inv.periodEnd;
                  const stripeId = inv.stripe_invoice_id ?? inv.stripeInvoiceId ?? '';
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="table-cell">
                        <span className="font-mono text-xs text-slate-600">{invoiceNum(stripeId)}</span>
                      </td>
                      <td className="table-cell text-sm text-slate-600">
                        {createdAt ? new Date(createdAt).toLocaleDateString('fr-FR') : '—'}
                      </td>
                      <td className="table-cell">
                        <span className="font-semibold text-slate-900">
                          {Number.isFinite(amount) ? fmtAmount(amount) : '—'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <InvoiceStatusBadge status={inv.status} />
                      </td>
                      <td className="table-cell text-xs text-slate-500">
                        {pStart && pEnd
                          ? `${new Date(pStart).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })}`
                          : '—'}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          {(inv.hosted_invoice_url ?? inv.hostedInvoiceUrl) && (
                            <a href={inv.hosted_invoice_url ?? inv.hostedInvoiceUrl}
                              target="_blank" rel="noreferrer"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                              title="Voir la facture">
                              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                            </a>
                          )}
                          {(inv.invoice_pdf_url ?? inv.invoicePdfUrl) && (
                            <a href={inv.invoice_pdf_url ?? inv.invoicePdfUrl}
                              target="_blank" rel="noreferrer"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Télécharger le PDF">
                              <Download className="w-3.5 h-3.5" strokeWidth={2} />
                            </a>
                          )}
                          {!inv.hosted_invoice_url && !inv.hostedInvoiceUrl && !inv.invoice_pdf_url && !inv.invoicePdfUrl && (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  );
}
