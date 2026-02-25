import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Server, Play, Square, RefreshCw, Trash2, ShoppingCart, RotateCcw } from 'lucide-react';
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

  const action = async (id: number, fn: () => Promise<any>) => {
    setActing(id);
    try { await fn(); await new Promise(r => setTimeout(r, 1200)); load(); } catch {}
    setActing(null);
  };

  const handleDelete = async (vm: VirtualMachine) => {
    if (!confirm(`Supprimer définitivement "${vm.name}" ? Cette action est irréversible.`)) return;
    action(vm.id, () => vmAPI.delete(vm.id));
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Mes serveurs</h1>
          <p className="page-subtitle">{vms.length} serveur{vms.length !== 1 ? 's' : ''} configuré{vms.length !== 1 ? 's' : ''}</p>
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
        <div className="card flex items-center justify-center py-16"><div className="spinner" /></div>
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
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>
                {['Serveur', 'Type', 'Statut', 'Adresse IP', 'Ressources', 'Nœud', 'Actions'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vms.map(vm => {
                const vmType = (vm as any).vmType ?? (vm as any).vm_type ?? 'kvm';
                return (
                <tr key={vm.id} className="table-row">
                  <td className="table-cell">
                    <Link to={`/vms/${vm.id}`} className="font-semibold text-slate-900 hover:text-brand-600 transition-colors">
                      {vm.name}
                    </Link>
                    <div className="text-xs text-slate-400 font-mono">VMID {vm.vmid}</div>
                  </td>
                  <td className="table-cell">
                    <span className={`badge border ${vmType === 'kvm' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                      {String(vmType).toUpperCase()}
                    </span>
                  </td>
                  <td className="table-cell">
                    {acting === vm.id ? (
                      <span className="badge-provisioning">
                        <span className="dot-amber animate-pulse" />
                        En cours…
                      </span>
                    ) : <StatusBadge status={vm.status} />}
                  </td>
                  <td className="table-cell font-mono text-xs text-slate-600">{vm.ipAddress || '—'}</td>
                  <td className="table-cell text-xs text-slate-600">
                    {vm.cpuCores} vCPU · {vm.ramMb >= 1024 ? `${vm.ramMb/1024} GB` : `${vm.ramMb} MB`} · {vm.diskGb} GB
                  </td>
                  <td className="table-cell text-xs text-slate-500">{vm.nodeName || `#${vm.nodeId}`}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => action(vm.id, () => vmAPI.power(vm.id, 'start'))}
                        disabled={vm.status === 'running' || acting === vm.id}
                        className="btn-icon btn-sm" title="Démarrer">
                        <Play className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <button onClick={() => action(vm.id, () => vmAPI.power(vm.id, 'stop'))}
                        disabled={vm.status !== 'running' || acting === vm.id}
                        className="btn-icon btn-sm" title="Arrêter">
                        <Square className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <button onClick={() => action(vm.id, () => vmAPI.power(vm.id, 'reboot'))}
                        disabled={vm.status !== 'running' || acting === vm.id}
                        className="btn-icon btn-sm" title="Redémarrer">
                        <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <Link to={`/vms/${vm.id}`} className="btn-ghost btn-sm text-brand-600 hover:text-brand-700 hover:bg-brand-50 ml-1">
                        Gérer
                      </Link>
                      <button onClick={() => handleDelete(vm)} className="btn-icon btn-sm text-slate-400 hover:text-red-500 hover:bg-red-50" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
