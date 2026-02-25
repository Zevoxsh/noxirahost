import { useEffect, useState } from 'react';
import { Monitor, PauseCircle, Trash2, RefreshCw } from 'lucide-react';
import { adminAPI } from '../../api/client';
import StatusBadge from '../../components/ui/StatusBadge';
import type { VMStatus } from '../../types';

export default function AdminVMs() {
  const [vms, setVms]       = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminAPI.listAllVMs().then(r => setVms(r.data.vms ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSuspend = async (id: number) => {
    if (!confirm('Suspendre cette VM ?')) return;
    await adminAPI.suspendVM(id); load();
  };
  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Supprimer définitivement "${name}" ?`)) return;
    await adminAPI.deleteVM(id); load();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Machines virtuelles</h1>
          <p className="page-subtitle">{vms.length} VM{vms.length !== 1 ? 's' : ''} sur la plateforme</p>
        </div>
        <button onClick={load} className="btn-secondary btn-sm"><RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Actualiser</button>
      </div>

      {loading ? (
        <div className="card flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead><tr>{['VM', 'Type', 'Propriétaire', 'Nœud', 'Statut', 'IP', 'Ressources', 'Actions'].map(h => <th key={h} className="table-header">{h}</th>)}</tr></thead>
            <tbody>
              {vms.length === 0 ? (
                <tr><td colSpan={8} className="table-cell text-center py-8">
                  <div className="empty-state py-4"><Monitor className="empty-state-icon" strokeWidth={1} /><p className="empty-state-title">Aucune VM</p></div>
                </td></tr>
              ) : vms.map((vm: any) => (
                <tr key={vm.id} className="table-row">
                  <td className="table-cell">
                    <div className="font-semibold text-slate-900">{vm.name}</div>
                    <div className="text-xs font-mono text-slate-400">VMID {vm.vmid}</div>
                  </td>
                  <td className="table-cell">
                    <span className={`badge border ${vm.vm_type === 'kvm' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                      {(vm.vm_type || vm.vmType || 'kvm').toUpperCase()}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-slate-500">{vm.username || `#${vm.user_id}`}</td>
                  <td className="table-cell text-xs text-slate-500">{vm.node_name || `#${vm.node_id}`}</td>
                  <td className="table-cell"><StatusBadge status={(vm.status || 'stopped') as VMStatus} /></td>
                  <td className="table-cell font-mono text-xs text-slate-600">{vm.ip_address || vm.ipAddress || '—'}</td>
                  <td className="table-cell text-xs text-slate-600">
                    {vm.cpu_cores || vm.cpuCores} vCPU · {(vm.ram_mb || vm.ramMb) >= 1024 ? `${(vm.ram_mb || vm.ramMb)/1024}GB` : `${vm.ram_mb || vm.ramMb}MB`}
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      {vm.status !== 'suspended' && (
                        <button onClick={() => handleSuspend(vm.id)} className="btn-icon btn-sm text-amber-500 hover:bg-amber-50" title="Suspendre">
                          <PauseCircle className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      )}
                      <button onClick={() => handleDelete(vm.id, vm.name)} className="btn-icon btn-sm text-red-500 hover:bg-red-50" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
