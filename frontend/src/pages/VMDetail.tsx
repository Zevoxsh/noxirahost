import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Play, Square, RefreshCw, Terminal, Camera,
  Trash2, AlertTriangle, Cpu, HardDrive, Wifi, Clock,
  Server, Globe, LayoutGrid, Database, XCircle, RotateCcw
} from 'lucide-react';
import { vmAPI } from '../api/client';
import type { VirtualMachine, LiveStatus } from '../types';
import StatusBadge from '../components/ui/StatusBadge';

function fmtUptime(s: number) {
  if (s < 60)    return `${s}s`;
  if (s < 3600)  return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
  return `${Math.floor(s / 86400)}j ${Math.floor((s % 86400) / 3600)}h`;
}

function fmtBytes(b: number) {
  if (b < 1024)        return `${b} B`;
  if (b < 1024 ** 2)   return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3)   return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
}

function GaugeBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}

export default function VMDetail() {
  const { id }   = useParams<{ id: string }>();
  const vmid     = parseInt(id!);
  const navigate = useNavigate();

  const [vm, setVm]             = useState<VirtualMachine | null>(null);
  const [sub, setSub]           = useState<any>(null);
  const [live, setLive]         = useState<LiveStatus | null>(null);
  const [snaps, setSnaps]       = useState<any[]>([]);
  const [snapName, setSnapName] = useState('');
  const [snapDesc, setSnapDesc] = useState('');
  const [acting, setActing]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [snapMsg, setSnapMsg]   = useState('');
  const [cancelMsg, setCancelMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const vmRes  = await vmAPI.get(vmid);
      const vmData = vmRes.data.vm;
      const vType  = (vmData as any)?.vmType ?? (vmData as any)?.vm_type ?? 'kvm';
      const [statusRes, snapRes] = await Promise.all([
        vmAPI.getStatus(vmid),
        vType === 'kvm'
          ? vmAPI.listSnapshots(vmid)
          : Promise.resolve({ data: { snapshots: [] } })
      ]);
      setVm(vmRes.data.vm);
      setSub(vmRes.data.subscription ?? null);
      setLive(statusRes.data.status ?? statusRes.data);
      setSnaps((snapRes.data.snapshots ?? []).filter((s: any) => s.name !== 'current'));
    } catch {
      setError('Serveur introuvable.');
    } finally {
      setLoading(false);
    }
  }, [vmid]);

  useEffect(() => { load(); }, [load]);

  const power = async (action: 'start' | 'stop' | 'reboot' | 'shutdown') => {
    setActing(true);
    try { await vmAPI.power(vmid, action); await new Promise(r => setTimeout(r, 1500)); await load(); } catch {}
    setActing(false);
  };

  const createSnap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapName) return;
    try {
      await vmAPI.createSnapshot(vmid, snapName, snapDesc);
      setSnapName(''); setSnapDesc('');
      setSnapMsg('Snapshot créé.');
      await load();
      setTimeout(() => setSnapMsg(''), 3000);
    } catch {}
  };

  const deleteSnap = async (name: string) => {
    if (!confirm(`Supprimer le snapshot "${name}" ?`)) return;
    await vmAPI.deleteSnapshot(vmid, name);
    await load();
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer définitivement "${vm?.name}" ? Cette action est irréversible.`)) return;
    await vmAPI.delete(vmid);
    navigate('/vms');
  };

  const handleCancel = async () => {
    if (!confirm(`Demander la résiliation de "${vm?.name}" ?\n\nLe serveur restera actif jusqu'à la fin de la période de facturation, puis sera supprimé définitivement.`)) return;
    try {
      await vmAPI.cancelVM(vmid);
      setCancelMsg('Résiliation programmée. Votre serveur sera supprimé à la fin de la période en cours.');
      await load();
    } catch (e: any) {
      setCancelMsg(e?.response?.data?.error || 'Erreur lors de la demande de résiliation.');
    }
  };

  const handleUndoCancel = async () => {
    try {
      await vmAPI.undoCancelVM(vmid);
      setCancelMsg('Résiliation annulée. Votre abonnement continue normalement.');
      await load();
    } catch (e: any) {
      setCancelMsg(e?.response?.data?.error || 'Erreur.');
    }
  };

  if (loading) return (
    <div className="page-container flex items-center justify-center py-24">
      <div className="spinner w-8 h-8" />
    </div>
  );
  if (error || !vm) return (
    <div className="page-container">
      <div className="alert-error">{error || 'Introuvable'}</div>
    </div>
  );

  const vmType  = (vm as any).vmType ?? (vm as any).vm_type ?? 'kvm';
  const isKvm   = vmType === 'kvm';
  const cpuPct  = live?.cpu ? Math.round(live.cpu * 100) : 0;
  const ramPct  = live?.mem && live?.maxmem ? Math.round((live.mem / live.maxmem) * 100) : 0;
  const ramUsed = live?.mem ? fmtBytes(live.mem) : '—';
  const ramMax  = live?.maxmem ? fmtBytes(live.maxmem) : '—';

  return (
    <div className="page-container max-w-5xl">

      <Link to="/vms" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        Retour aux serveurs
      </Link>

      {/* ── Hero card ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 overflow-hidden">
        <div className={`h-1.5 w-full ${isKvm ? 'bg-indigo-400' : 'bg-teal-400'}`} />
        <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-5">
          {/* Icon + name */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${isKvm ? 'bg-indigo-50' : 'bg-teal-50'}`}>
              <Server className={`w-7 h-7 ${isKvm ? 'text-indigo-500' : 'text-teal-500'}`} strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900 truncate">{vm.name}</h1>
              <div className="flex items-center flex-wrap gap-2 mt-1.5">
                <StatusBadge status={acting ? 'provisioning' : vm.status} />
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${isKvm ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-teal-50 text-teal-600 border-teal-200'}`}>
                  {String(vmType).toUpperCase()}
                </span>
                <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                  # {vm.vmid}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center flex-wrap gap-2 flex-shrink-0">
            <button
              onClick={() => power('start')}
              disabled={vm.status === 'running' || acting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-3.5 h-3.5" strokeWidth={2} /> Démarrer
            </button>
            <button
              onClick={() => power('reboot')}
              disabled={vm.status !== 'running' || acting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Redémarrer
            </button>
            <button
              onClick={() => power('shutdown')}
              disabled={vm.status !== 'running' || acting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Square className="w-3.5 h-3.5" strokeWidth={2} /> Arrêter
            </button>
            <Link
              to={`/vms/${vmid}/console`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-sm"
            >
              <Terminal className="w-3.5 h-3.5" strokeWidth={2} /> Console
            </Link>
          </div>
        </div>
      </div>

      {/* ── Info + Stats ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mb-5">

        {/* Info panel — 3 cols */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Informations</h2>
          <div className="space-y-0">
            {[
              { icon: <Globe className="w-3.5 h-3.5" />,        label: 'Adresse IP',  value: (vm as any).ipAddress || '—',  mono: true },
              { icon: <LayoutGrid className="w-3.5 h-3.5" />,   label: 'Nœud',        value: (vm as any).nodeName || `Node #${(vm as any).nodeId}` },
              { icon: <Database className="w-3.5 h-3.5" />,     label: 'Plan',        value: (vm as any).planName || `Plan #${(vm as any).planId}` },
              { icon: <Cpu className="w-3.5 h-3.5" />,          label: 'Ressources',  value: `${vm.cpuCores} vCPU · ${vm.ramMb >= 1024 ? `${vm.ramMb / 1024} GB` : `${vm.ramMb} MB`} RAM · ${vm.diskGb} GB SSD` },
              { icon: <Clock className="w-3.5 h-3.5" />,        label: 'Créé le',     value: new Date((vm as any).createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) },
            ].map(row => (
              <div key={row.label} className="flex items-center py-3 border-b border-slate-50 last:border-0">
                <span className="flex items-center gap-2 text-xs text-slate-400 w-32 flex-shrink-0">
                  {row.icon} {row.label}
                </span>
                <span className={`text-sm text-slate-800 font-medium ${row.mono ? 'font-mono' : ''}`}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Live stats — 2 cols */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-5">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Utilisation live</h2>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="flex items-center gap-1.5 font-medium text-slate-600">
                <Cpu className="w-3.5 h-3.5 text-slate-400" /> CPU
              </span>
              <span className={`font-bold tabular-nums ${cpuPct > 80 ? 'text-red-500' : cpuPct > 50 ? 'text-amber-500' : 'text-slate-700'}`}>
                {cpuPct}%
              </span>
            </div>
            <GaugeBar value={cpuPct} color={cpuPct > 80 ? 'bg-red-400' : cpuPct > 50 ? 'bg-amber-400' : 'bg-brand-500'} />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs mb-2">
              <span className="flex items-center gap-1.5 font-medium text-slate-600">
                <HardDrive className="w-3.5 h-3.5 text-slate-400" /> RAM
              </span>
              <span className={`font-bold tabular-nums ${ramPct > 90 ? 'text-red-500' : ramPct > 70 ? 'text-amber-500' : 'text-slate-700'}`}>
                {ramPct > 0 ? `${ramUsed} / ${ramMax}` : '—'}
              </span>
            </div>
            <GaugeBar value={ramPct} color={ramPct > 90 ? 'bg-red-400' : ramPct > 70 ? 'bg-amber-400' : 'bg-emerald-500'} />
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2.5">
            {live?.uptime ? (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-3.5 h-3.5" /> Uptime
                </span>
                <span className="font-semibold text-slate-700 tabular-nums">{fmtUptime(live.uptime)}</span>
              </div>
            ) : null}
            {live?.netin !== undefined ? (
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <Wifi className="w-3.5 h-3.5" /> Réseau
                </span>
                <span className="font-semibold text-slate-700 tabular-nums">
                  ↓ {fmtBytes(live.netin!)} · ↑ {fmtBytes(live.netout!)}
                </span>
              </div>
            ) : null}
            {!live?.uptime && live?.netin === undefined && (
              <p className="text-xs text-slate-400 text-center">Serveur hors ligne</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Snapshots (KVM only) ──────────────────────────── */}
      {isKvm && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm mb-5 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Camera className="w-4 h-4 text-slate-400" strokeWidth={1.75} />
              Snapshots
              {snaps.length > 0 && (
                <span className="text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                  {snaps.length}
                </span>
              )}
            </h2>
          </div>
          <div className="p-6">
            {snapMsg && <div className="alert-success mb-4">{snapMsg}</div>}
            <form onSubmit={createSnap} className="flex gap-2 mb-5">
              <input
                className="input-field flex-1"
                placeholder="Nom du snapshot"
                value={snapName}
                onChange={e => setSnapName(e.target.value)}
              />
              <input
                className="input-field flex-1"
                placeholder="Description (optionnel)"
                value={snapDesc}
                onChange={e => setSnapDesc(e.target.value)}
              />
              <button type="submit" disabled={!snapName} className="btn-secondary flex-shrink-0">
                <Camera className="w-3.5 h-3.5" strokeWidth={2} />
                Créer
              </button>
            </form>
            {snaps.length === 0 ? (
              <div className="text-center py-8">
                <Camera className="w-8 h-8 text-slate-200 mx-auto mb-2" strokeWidth={1} />
                <p className="text-sm text-slate-400">Aucun snapshot</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {snaps.map((s: any) => (
                  <div key={s.name} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{s.name}</p>
                      {s.description && <p className="text-xs text-slate-400 mt-0.5">{s.description}</p>}
                    </div>
                    <button
                      onClick={() => deleteSnap(s.name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Supprimer le snapshot"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Danger zone ───────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-red-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50/40">
          <h2 className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
            Zone dangereuse
          </h2>
        </div>
        <div className="p-6 space-y-4">
          {cancelMsg && (
            <div className={`text-sm px-4 py-3 rounded-xl border ${cancelMsg.startsWith('Erreur') || cancelMsg.startsWith('Résiliation déjà') ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
              {cancelMsg}
            </div>
          )}

          {/* Cancellation row */}
          {sub && !sub.cancelAtPeriodEnd && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-800">Résilier l'abonnement</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Le serveur restera actif jusqu'au {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : 'fin de période'}, puis sera supprimé
                </p>
              </div>
              <button onClick={handleCancel} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors flex-shrink-0">
                <XCircle className="w-3.5 h-3.5" strokeWidth={2} />
                Résilier
              </button>
            </div>
          )}

          {/* Pending cancellation notice */}
          {sub?.cancelAtPeriodEnd && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-amber-700">Résiliation programmée</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ce serveur sera supprimé le {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
                </p>
              </div>
              <button onClick={handleUndoCancel} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors flex-shrink-0">
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
                Annuler la résiliation
              </button>
            </div>
          )}

          {/* Hard delete (no active subscription, or admin) */}
          {!sub && (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-800">Supprimer ce serveur</p>
                <p className="text-xs text-slate-500 mt-0.5">Action irréversible — toutes les données seront définitivement perdues</p>
              </div>
              <button onClick={handleDelete} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-colors flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
