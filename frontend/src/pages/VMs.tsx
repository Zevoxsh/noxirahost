import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Server, Play, Square, RefreshCw, ShoppingCart, RotateCcw, Terminal, AlertCircle } from 'lucide-react';
import { vmAPI } from '../api/client';
import type { VirtualMachine } from '../types';
import StatusBadge from '../components/ui/StatusBadge';

export default function VMs() {
  const [vms, setVms]         = useState<VirtualMachine[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing]   = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    vmAPI.list().then(r => setVms(r.data.vms ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const action = async (vmid: number, fn: () => Promise<any>) => {
    setActing(vmid);
    try { await fn(); await new Promise(r => setTimeout(r, 1200)); load(); } catch {}
    setActing(null);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes serveurs</h1>
          <p className="page-subtitle">{vms.length} serveur{vms.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-secondary btn-sm">
            <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
            Actualiser
          </button>
          <Link to="/order" className="btn-primary">
            <ShoppingCart className="w-4 h-4" strokeWidth={2} />
            Commander
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="spinner w-8 h-8" />
        </div>
      ) : vms.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Server className="empty-state-icon" strokeWidth={1} />
            <p className="empty-state-title">Aucun serveur</p>
            <p className="empty-state-desc mb-5">Déployez votre premier VPS ou conteneur LXC</p>
            <Link to="/order" className="btn-primary">
              <ShoppingCart className="w-4 h-4" strokeWidth={2} />
              Voir les offres
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vms.map(vm => {
            const vmType  = (vm as any).vmType ?? (vm as any).vm_type ?? 'kvm';
            const isKvm   = vmType === 'kvm';
            const isAct   = acting === vm.vmid;
            const running = vm.status === 'running';

            return (
              <div key={vm.vmid} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col overflow-hidden">

                {/* Colored top strip */}
                <div className={`h-1 w-full ${isKvm ? 'bg-indigo-400' : 'bg-teal-400'}`} />

                {/* Header */}
                <div className="p-5 flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isKvm ? 'bg-indigo-50' : 'bg-teal-50'}`}>
                    <Server className={`w-5 h-5 ${isKvm ? 'text-indigo-500' : 'text-teal-500'}`} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        to={`/vms/${vm.vmid}`}
                        className="font-semibold text-slate-900 hover:text-brand-600 transition-colors leading-tight truncate"
                      >
                        {vm.name}
                      </Link>
                      {isAct ? (
                        <span className="flex items-center gap-1 text-xs text-amber-600 font-medium flex-shrink-0 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                          En cours…
                        </span>
                      ) : (
                        <div className="flex-shrink-0 mt-0.5">
                          <StatusBadge status={vm.status} />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${isKvm ? 'bg-indigo-50 text-indigo-600' : 'bg-teal-50 text-teal-600'}`}>
                        {String(vmType).toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400 font-mono"># {vm.vmid}</span>
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="px-5 pb-4 flex-1 space-y-1.5">
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                    <span className="text-slate-400">Adresse IP</span>
                    <span className="font-mono text-slate-700">{(vm as any).ipAddress || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs py-1 border-b border-slate-50">
                    <span className="text-slate-400">Nœud</span>
                    <span className="text-slate-600">{(vm as any).nodeName || '—'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 py-1">
                    <span>{vm.cpuCores} vCPU</span>
                    <span className="text-slate-200">·</span>
                    <span>{vm.ramMb >= 1024 ? `${vm.ramMb / 1024} GB` : `${vm.ramMb} MB`} RAM</span>
                    <span className="text-slate-200">·</span>
                    <span>{vm.diskGb} GB SSD</span>
                  </div>
                  {vm.cancelAtPeriodEnd && (
                    <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={2} />
                      <span>
                        Résiliation le {vm.subPeriodEnd ? new Date(vm.subPeriodEnd).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-1">
                  <button
                    onClick={() => action(vm.vmid, () => vmAPI.power(vm.vmid, 'start'))}
                    disabled={running || isAct}
                    title="Démarrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => action(vm.vmid, () => vmAPI.power(vm.vmid, 'stop'))}
                    disabled={!running || isAct}
                    title="Arrêter"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Square className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  <button
                    onClick={() => action(vm.vmid, () => vmAPI.power(vm.vmid, 'reboot'))}
                    disabled={!running || isAct}
                    title="Redémarrer"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  <Link
                    to={`/vms/${vm.vmid}/console`}
                    title="Console"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                  >
                    <Terminal className="w-3.5 h-3.5" strokeWidth={2} />
                  </Link>
                  <Link
                    to={`/vms/${vm.vmid}`}
                    className="ml-auto text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Gérer →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
