import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Server, Play, Square, RefreshCw, ShoppingCart, Plus, Cpu, HardDrive, Activity } from 'lucide-react';
import { vmAPI } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { VirtualMachine } from '../types';
import StatusBadge from '../components/ui/StatusBadge';
import StatsCard from '../components/ui/StatsCard';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [vms, setVms]       = useState<VirtualMachine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    vmAPI.list().then(r => setVms(r.data.vms ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const running  = vms.filter(v => v.status === 'running').length;
  const stopped  = vms.filter(v => v.status === 'stopped').length;
  const totalCpu = vms.reduce((s, v) => s + (v.cpuCores || 0), 0);
  const totalRam = vms.reduce((s, v) => s + (v.ramMb || 0), 0);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">{greeting}, {user?.displayName || user?.username} 👋</h1>
          <p className="page-subtitle">Voici l'état de votre infrastructure</p>
        </div>
        <Link to="/order" className="btn-primary">
          <Plus className="w-4 h-4" strokeWidth={2} />
          Commander un serveur
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard label="Total serveurs" value={vms.length}  icon={Server}   color="blue"   sub={`${running} en ligne`} />
        <StatsCard label="En ligne"       value={running}     icon={Activity} color="green"  sub={`${stopped} arrêté${stopped !== 1 ? 's' : ''}`} />
        <StatsCard label="vCPU alloués"   value={totalCpu}    icon={Cpu}      color="purple" sub="cœurs virtuels" />
        <StatsCard label="RAM allouée"    value={totalRam >= 1024 ? `${(totalRam/1024).toFixed(1)} GB` : `${totalRam} MB`} icon={HardDrive} color="orange" />
      </div>

      {/* VM list */}
      <div className="table-wrap">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-slate-800">Mes serveurs</h2>
          <Link to="/vms" className="text-xs text-brand-600 hover:text-brand-700 font-medium">Voir tout →</Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="spinner" />
          </div>
        ) : vms.length === 0 ? (
          <div className="empty-state">
            <Server className="empty-state-icon" strokeWidth={1} />
            <p className="empty-state-title">Aucun serveur</p>
            <p className="empty-state-desc mb-4">Commandez votre premier VPS ou conteneur LXC</p>
            <Link to="/order" className="btn-primary btn-sm">
              <ShoppingCart className="w-3.5 h-3.5" strokeWidth={2} />
              Voir les offres
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                {['Serveur', 'Type', 'Statut', 'IP', 'Ressources', 'Actions'].map(h => (
                  <th key={h} className="table-header">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vms.map(vm => {
                const vmType = (vm as any).vmType ?? (vm as any).vm_type ?? 'kvm';
                return (
                <tr key={vm.vmid} className="table-row">
                  <td className="table-cell">
                    <div className="font-semibold text-slate-900">{vm.name}</div>
                    <div className="text-xs text-slate-400 font-mono">#{vm.vmid} · {(vm as any).nodeName || `Node #${(vm as any).nodeId}`}</div>
                  </td>
                  <td className="table-cell">
                    <span className={`badge border ${vmType === 'kvm' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                      {String(vmType).toUpperCase()}
                    </span>
                  </td>
                  <td className="table-cell"><StatusBadge status={vm.status} /></td>
                  <td className="table-cell">
                    <span className="font-mono text-xs text-slate-600">{(vm as any).ipAddress || '—'}</span>
                  </td>
                  <td className="table-cell">
                    <span className="text-xs text-slate-600">{vm.cpuCores} vCPU · {vm.ramMb >= 1024 ? `${vm.ramMb/1024}GB` : `${vm.ramMb}MB`} · {vm.diskGb}GB</span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      <button onClick={() => vmAPI.power(vm.vmid, 'start')} disabled={vm.status === 'running'}
                        className="btn-icon btn-sm" title="Démarrer">
                        <Play className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <button onClick={() => vmAPI.power(vm.vmid, 'stop')} disabled={vm.status !== 'running'}
                        className="btn-icon btn-sm" title="Arrêter">
                        <Square className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <button onClick={() => vmAPI.power(vm.vmid, 'reboot')} disabled={vm.status !== 'running'}
                        className="btn-icon btn-sm" title="Redémarrer">
                        <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                      <Link to={`/vms/${vm.vmid}`} className="btn-ghost btn-sm ml-1 text-brand-600 hover:text-brand-700 hover:bg-brand-50">
                        Gérer
                      </Link>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
