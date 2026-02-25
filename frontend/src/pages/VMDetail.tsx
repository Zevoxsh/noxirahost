import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Square, RefreshCw, Terminal, Camera, Trash2, AlertTriangle, Cpu, HardDrive, Wifi, Clock } from 'lucide-react';
import { vmAPI } from '../api/client';
import type { VirtualMachine, LiveStatus } from '../types';
import StatusBadge from '../components/ui/StatusBadge';

function fmt(s: number) {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s/60)}min`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}j`;
}

export default function VMDetail() {
  const { id } = useParams<{ id: string }>();
  const vmId   = parseInt(id!);
  const navigate = useNavigate();

  const [vm, setVm]           = useState<VirtualMachine | null>(null);
  const [live, setLive]       = useState<LiveStatus | null>(null);
  const [snapName, setSnapName] = useState('');
  const [snapDesc, setSnapDesc] = useState('');
  const [snaps, setSnaps]     = useState<any[]>([]);
  const [acting, setActing]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [snapMsg, setSnapMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [vmRes, statusRes, snapRes] = await Promise.all([
        vmAPI.get(vmId), vmAPI.getStatus(vmId), vmAPI.listSnapshots(vmId)
      ]);
      setVm(vmRes.data.vm);
      setLive(statusRes.data);
      setSnaps((snapRes.data.snapshots ?? []).filter((s: any) => s.name !== 'current'));
    } catch { setError('Serveur introuvable.'); }
    finally { setLoading(false); }
  }, [vmId]);

  useEffect(() => { load(); }, [load]);

  const power = async (action: 'start' | 'stop' | 'reboot' | 'shutdown') => {
    setActing(true);
    try { await vmAPI.power(vmId, action); await new Promise(r => setTimeout(r, 1500)); await load(); } catch {}
    setActing(false);
  };

  const openConsole = async () => {
    try {
      const res = await vmAPI.getConsoleToken(vmId);
      window.open(`/vms/${vmId}/console?token=${res.data.wsToken}`, '_blank');
    } catch {}
  };

  const createSnap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapName) return;
    try {
      await vmAPI.createSnapshot(vmId, snapName, snapDesc);
      setSnapName(''); setSnapDesc('');
      setSnapMsg('Snapshot créé avec succès.');
      await load();
      setTimeout(() => setSnapMsg(''), 3000);
    } catch {}
  };

  const deleteSnap = async (name: string) => {
    if (!confirm(`Supprimer le snapshot "${name}" ?`)) return;
    await vmAPI.deleteSnapshot(vmId, name);
    await load();
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer définitivement "${vm?.name}" ? Cette action est irréversible.`)) return;
    await vmAPI.delete(vmId);
    navigate('/vms');
  };

  if (loading) return <div className="page-container"><div className="flex items-center justify-center py-20"><div className="spinner w-8 h-8" /></div></div>;
  if (error || !vm) return <div className="page-container"><div className="alert-error">{error || 'Introuvable'}</div></div>;

  const cpuPct = live?.cpu ? Math.round(live.cpu * 100) : 0;
  const ramPct = live?.mem && live?.maxmem ? Math.round((live.mem / live.maxmem) * 100) : 0;

  return (
    <div className="page-container max-w-4xl">
      <Link to="/vms" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        Retour aux serveurs
      </Link>

      {/* Header */}
      <div className="card mb-4">
        <div className="card-body">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                <Terminal className="w-6 h-6 text-brand-600" strokeWidth={1.5} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">{vm.name}</h1>
                <div className="flex items-center gap-3 mt-1">
                  <StatusBadge status={acting ? 'provisioning' : vm.status} />
                  <span className={`badge border ${vm.vmType === 'kvm' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                    {vm.vmType.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">VMID {vm.vmid}</span>
                </div>
              </div>
            </div>
            {/* Power controls */}
            <div className="flex items-center gap-2">
              <button onClick={() => power('start')} disabled={vm.status === 'running' || acting} className="btn-success btn-sm">
                <Play className="w-3.5 h-3.5" strokeWidth={2} /> Démarrer
              </button>
              <button onClick={() => power('reboot')} disabled={vm.status !== 'running' || acting} className="btn-secondary btn-sm">
                <RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Redémarrer
              </button>
              <button onClick={() => power('shutdown')} disabled={vm.status !== 'running' || acting} className="btn-secondary btn-sm">
                <Square className="w-3.5 h-3.5" strokeWidth={2} /> Arrêter
              </button>
              <button onClick={openConsole} className="btn-primary btn-sm">
                <Terminal className="w-3.5 h-3.5" strokeWidth={2} /> Console
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Info */}
        <div className="lg:col-span-2 card card-body space-y-3">
          <h2 className="text-sm font-semibold text-slate-700 mb-3">Informations</h2>
          {[
            { label: 'Adresse IP', value: vm.ipAddress || '—', mono: true },
            { label: 'Nœud', value: vm.nodeName || `Node #${vm.nodeId}` },
            { label: 'Plan', value: vm.planName || `Plan #${vm.planId}` },
            { label: 'Créé le', value: new Date(vm.createdAt).toLocaleDateString('fr-FR') },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-xs font-medium text-slate-500">{row.label}</span>
              <span className={`text-sm text-slate-800 ${row.mono ? 'font-mono' : 'font-medium'}`}>{row.value}</span>
            </div>
          ))}
        </div>

        {/* Live stats */}
        <div className="card card-body space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Utilisation en direct</h2>
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1 text-slate-500"><Cpu className="w-3 h-3" strokeWidth={2}/> CPU</span>
              <span className="font-semibold text-slate-700">{cpuPct}%</span>
            </div>
            <div className="progress-track"><div className="progress-fill bg-brand-500" style={{ width: `${cpuPct}%` }} /></div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="flex items-center gap-1 text-slate-500"><HardDrive className="w-3 h-3" strokeWidth={2}/> RAM</span>
              <span className="font-semibold text-slate-700">{ramPct}%</span>
            </div>
            <div className="progress-track"><div className="progress-fill bg-emerald-500" style={{ width: `${ramPct}%` }} /></div>
          </div>
          {live?.uptime && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Uptime : <span className="font-semibold text-slate-700">{fmt(live.uptime)}</span></span>
            </div>
          )}
          {live?.netin !== undefined && (
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Wifi className="w-3.5 h-3.5" strokeWidth={2} />
              <span>↓ {(live.netin! / 1024 / 1024).toFixed(1)} MB · ↑ {(live.netout! / 1024 / 1024).toFixed(1)} MB</span>
            </div>
          )}
          <div className="pt-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Allocation</div>
            <div className="space-y-1 text-xs text-slate-600">
              <div>{vm.cpuCores} vCPU · {vm.ramMb >= 1024 ? `${vm.ramMb/1024} GB` : `${vm.ramMb} MB`} RAM</div>
              <div>{vm.diskGb} GB Stockage</div>
            </div>
          </div>
        </div>
      </div>

      {/* Snapshots */}
      <div className="card mb-4">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <Camera className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
            Snapshots ({snaps.length})
          </h2>
        </div>
        <div className="card-body">
          {snapMsg && <div className="alert-success mb-3">{snapMsg}</div>}
          <form onSubmit={createSnap} className="flex gap-3 mb-4">
            <input className="input-field flex-1" placeholder="Nom du snapshot" value={snapName} onChange={e => setSnapName(e.target.value)} />
            <input className="input-field flex-1" placeholder="Description (optionnel)" value={snapDesc} onChange={e => setSnapDesc(e.target.value)} />
            <button type="submit" className="btn-secondary flex-shrink-0">
              <Camera className="w-3.5 h-3.5" strokeWidth={2} /> Créer
            </button>
          </form>
          {snaps.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Aucun snapshot</p>
          ) : (
            <div className="space-y-2">
              {snaps.map((s: any) => (
                <div key={s.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    {s.description && <p className="text-xs text-slate-400">{s.description}</p>}
                  </div>
                  <button onClick={() => deleteSnap(s.name)} className="btn-icon btn-sm text-slate-400 hover:text-red-500 hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="card border-red-200">
        <div className="card-header border-red-100 bg-red-50/50">
          <h2 className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
            Zone dangereuse
          </h2>
        </div>
        <div className="card-body flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Supprimer ce serveur</p>
            <p className="text-xs text-slate-500">Action irréversible — toutes les données seront perdues</p>
          </div>
          <button onClick={handleDelete} className="btn-danger btn-sm">
            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} /> Supprimer
          </button>
        </div>
      </div>
    </div>
  );
}
