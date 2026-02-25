import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, CheckCircle, XCircle, RefreshCw, Database } from 'lucide-react';
import { adminAPI } from '../../api/client';
import type { ProxmoxNode } from '../../types';

interface NodeForm { name: string; host: string; port: string; pveUser: string; pvePassword: string; storage: string; bridge: string; vmidStart: string; }
const EMPTY: NodeForm = { name: '', host: '', port: '8006', pveUser: 'root@pam', pvePassword: '', storage: 'local', bridge: 'vmbr0', vmidStart: '' };

export default function AdminNodes() {
  const [nodes, setNodes]     = useState<ProxmoxNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editNode, setEditNode] = useState<ProxmoxNode | null>(null);
  const [form, setForm]       = useState<NodeForm>(EMPTY);
  const [saving, setSaving]   = useState(false);
  const [formError, setFormError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const load = async () => {
    try { const r = await adminAPI.listNodes(); setNodes(r.data.nodes ?? []); }
    catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditNode(null); setForm(EMPTY); setFormError(''); setShowForm(true); };
  const openEdit   = (n: ProxmoxNode) => {
    setEditNode(n);
    setForm({
      name: n.name,
      host: n.host,
      port: String(n.port || 8006),
      pveUser: (n as any).pve_user || 'root@pam',
      pvePassword: '',
      storage: n.storage || 'local',
      bridge: n.bridge || 'vmbr0',
      vmidStart: String((n as any).vmid_start ?? n.vmidStart ?? '')
    });
    setFormError(''); setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.name || !form.host) { setFormError('Nom et hôte requis.'); return; }
    if (!editNode && !form.pvePassword) { setFormError('Mot de passe requis pour ajouter un nœud.'); return; }
    setSaving(true);
    try {
      if (editNode) {
        await adminAPI.updateNode(editNode.id, {
          pve_user: form.pveUser,
          pve_password: form.pvePassword || undefined,
          storage: form.storage,
          bridge: form.bridge,
          vmid_start: form.vmidStart ? Number(form.vmidStart) : undefined
        });
      } else {
        await adminAPI.createNode({
          name: form.name,
          host: form.host,
          port: Number(form.port) || 8006,
          pveUser: form.pveUser,
          pvePassword: form.pvePassword,
          storage: form.storage,
          bridge: form.bridge,
          vmidStart: form.vmidStart ? Number(form.vmidStart) : undefined
        });
      }
      setShowForm(false); await load();
    } catch (err: any) { setFormError(err.response?.data?.message ?? 'Erreur.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Désactiver ce nœud ?')) return;
    await adminAPI.deleteNode(id); await load();
  };

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const [ir, tr] = await Promise.all([adminAPI.syncISOs(), adminAPI.syncTemplates()]);
      setSyncMsg(`✓ ${ir.data.synced ?? 0} ISO(s) et ${tr.data.synced ?? 0} template(s) synchronisés`);
      setTimeout(() => setSyncMsg(''), 5000);
    } catch { setSyncMsg('Erreur lors de la synchronisation'); }
    finally { setSyncing(false); }
  };

  const f = (key: keyof NodeForm) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value }))
  });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Nœuds Proxmox</h1>
          <p className="page-subtitle">{nodes.length} nœud{nodes.length !== 1 ? 's' : ''} configuré{nodes.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSync} disabled={syncing} className="btn-secondary btn-sm">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} strokeWidth={2} />
            {syncing ? 'Sync…' : 'Sync ISOs/Templates'}
          </button>
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" strokeWidth={2} /> Ajouter un nœud
          </button>
        </div>
      </div>

      {syncMsg && <div className={`mb-4 ${syncMsg.startsWith('✓') ? 'alert-success' : 'alert-error'}`}>{syncMsg}</div>}

      {showForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-700">{editNode ? 'Modifier le nœud' : 'Ajouter un nœud Proxmox'}</h2>
            <button onClick={() => setShowForm(false)} className="btn-icon"><X className="w-4 h-4" strokeWidth={2} /></button>
          </div>
          <form onSubmit={handleSave} className="card-body">
            {formError && <div className="alert-error mb-4">{formError}</div>}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="input-label">Nom du nœud *</label><input className="input-field" placeholder="pve-01" {...f('name')} disabled={!!editNode} /></div>
              <div><label className="input-label">Hôte / IP *</label><input className="input-field" placeholder="192.168.1.100" {...f('host')} disabled={!!editNode} /></div>
              <div><label className="input-label">Port</label><input className="input-field" placeholder="8006" {...f('port')} /></div>
              <div><label className="input-label">Utilisateur</label><input className="input-field" placeholder="root@pam" {...f('pveUser')} /></div>
              <div className="col-span-2">
                <label className="input-label">Mot de passe {editNode ? <span className="normal-case text-slate-400 font-normal ml-1">(vide = conserver)</span> : <span className="text-red-500">*</span>}</label>
                <input type="password" className="input-field" placeholder="••••••••••" {...f('pvePassword')} />
              </div>
              <div><label className="input-label">Stockage VMs</label><input className="input-field" placeholder="local / SAN1" {...f('storage')} /></div>
              <div><label className="input-label">Bridge réseau</label><input className="input-field" placeholder="vmbr0" {...f('bridge')} /></div>
              <div><label className="input-label">VMID min</label><input className="input-field" placeholder="300" {...f('vmidStart')} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <span className="spinner w-4 h-4" />}
                {editNode ? 'Mettre à jour' : 'Ajouter'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card flex justify-center py-16"><div className="spinner" /></div>
      ) : nodes.length === 0 ? (
        <div className="card"><div className="empty-state"><Database className="empty-state-icon" strokeWidth={1} /><p className="empty-state-title">Aucun nœud configuré</p><p className="empty-state-desc mb-4">Ajoutez votre premier serveur Proxmox</p><button onClick={openCreate} className="btn-primary btn-sm"><Plus className="w-3.5 h-3.5" strokeWidth={2} /> Ajouter</button></div></div>
      ) : (
        <div className="space-y-3">
          {nodes.map(node => (
            <div key={node.id} className="card card-body">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  {node.health?.online
                    ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" strokeWidth={1.75} />
                    : <XCircle className="w-5 h-5 text-red-400 flex-shrink-0" strokeWidth={1.75} />}
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{node.name}</p>
                      <span className={node.health?.online ? 'badge-running' : 'badge-stopped'}>
                        {node.health?.online ? 'En ligne' : 'Hors ligne'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{node.host}:{node.port} · {node.storage} · {node.bridge}{(node as any).vmid_start || node.vmidStart ? ` · VMID min ${(node as any).vmid_start ?? node.vmidStart}` : ''}</p>
                    {node.health?.online && (
                      <div className="flex items-center gap-5 mt-2">
                        {node.health.cpu !== undefined && (
                          <div className="flex items-center gap-2">
                            <div className="progress-track w-20"><div className="progress-fill bg-brand-500" style={{ width: `${Math.round(node.health.cpu * 100)}%` }} /></div>
                            <span className="text-xs text-slate-500">CPU {Math.round(node.health.cpu * 100)}%</span>
                          </div>
                        )}
                        {node.health.memPercent !== undefined && (
                          <div className="flex items-center gap-2">
                            <div className="progress-track w-20"><div className="progress-fill bg-emerald-500" style={{ width: `${Math.round(node.health.memPercent * 100)}%` }} /></div>
                            <span className="text-xs text-slate-500">RAM {Math.round(node.health.memPercent * 100)}%</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(node)} className="btn-icon btn-sm" title="Modifier"><Edit2 className="w-3.5 h-3.5" strokeWidth={2} /></button>
                  <button onClick={() => handleDelete(node.id)} className="btn-icon btn-sm text-red-500 hover:bg-red-50" title="Désactiver"><Trash2 className="w-3.5 h-3.5" strokeWidth={2} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
