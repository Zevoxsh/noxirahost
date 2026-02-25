import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { adminAPI } from '../../api/client';
import type { Plan } from '../../types';

interface PlanForm {
  name: string; slug: string; vmType: 'kvm' | 'lxc'; tier: 's' | 'm' | 'l';
  cpuCores: string; ramMb: string; diskGb: string; bandwidthGb: string;
  priceMonthly: string; maxSnapshots: string; isActive: boolean;
}
const EMPTY: PlanForm = { name: '', slug: '', vmType: 'kvm', tier: 's', cpuCores: '1', ramMb: '1024', diskGb: '20', bandwidthGb: '', priceMonthly: '4.99', maxSnapshots: '3', isActive: true };

export default function AdminPlans() {
  const [plans, setPlans]   = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | null>(null);
  const [form, setForm]     = useState<PlanForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const load = async () => {
    try { const r = await adminAPI.listPlans(); setPlans(r.data.plans ?? []); }
    catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditPlan(null); setForm(EMPTY); setFormError(''); setShowForm(true); };
  const openEdit   = (p: Plan) => {
    setEditPlan(p);
    setForm({ name: p.name, slug: p.slug, vmType: p.vmType, tier: p.tier, cpuCores: String(p.cpuCores), ramMb: String(p.ramMb), diskGb: String(p.diskGb), bandwidthGb: String(p.bandwidthGb ?? ''), priceMonthly: String(p.priceMonthly), maxSnapshots: String(p.maxSnapshots), isActive: p.isActive });
    setFormError(''); setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('');
    if (!form.name) { setFormError('Le nom est requis.'); return; }
    if (!form.slug) form.slug = form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    setSaving(true);
    try {
      const data = { name: form.name, slug: form.slug, vmType: form.vmType, tier: form.tier, cpuCores: Number(form.cpuCores), ramMb: Number(form.ramMb), diskGb: Number(form.diskGb), bandwidthGb: form.bandwidthGb ? Number(form.bandwidthGb) : undefined, priceMonthly: parseFloat(form.priceMonthly), maxSnapshots: Number(form.maxSnapshots), isActive: form.isActive };
      if (editPlan) await adminAPI.updatePlan(editPlan.id, data);
      else await adminAPI.createPlan(data);
      setShowForm(false); await load();
    } catch (err: any) { setFormError(err.response?.data?.message ?? 'Erreur.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Désactiver ce plan ?')) return;
    await adminAPI.deletePlan(id); await load();
  };

  const f = (key: keyof PlanForm) => ({
    value: form[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(p => ({ ...p, [key]: e.target.value }))
  });

  const stripeOk = (p: Plan) => p.stripePriceId && !p.stripePriceId.includes('PLACEHOLDER');

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Plans</h1>
          <p className="page-subtitle">{plans.length} plan{plans.length !== 1 ? 's' : ''} configuré{plans.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" strokeWidth={2} /> Créer un plan</button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-700">{editPlan ? 'Modifier le plan' : 'Créer un plan'}</h2>
            <button onClick={() => setShowForm(false)} className="btn-icon"><X className="w-4 h-4" strokeWidth={2} /></button>
          </div>
          <form onSubmit={handleSave} className="card-body">
            {formError && <div className="alert-error mb-4">{formError}</div>}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div><label className="input-label">Nom *</label><input className="input-field" placeholder="Starter KVM" {...f('name')} /></div>
              <div><label className="input-label">Slug <span className="normal-case text-slate-400 font-normal">(auto)</span></label><input className="input-field" placeholder="auto-généré" {...f('slug')} /></div>
              <div>
                <label className="input-label">Type VM</label>
                <select className="input-field" value={form.vmType} onChange={e => setForm(p => ({ ...p, vmType: e.target.value as 'kvm' | 'lxc' }))}>
                  <option value="kvm">KVM</option><option value="lxc">LXC</option>
                </select>
              </div>
              <div>
                <label className="input-label">Niveau</label>
                <select className="input-field" value={form.tier} onChange={e => setForm(p => ({ ...p, tier: e.target.value as 's'|'m'|'l' }))}>
                  <option value="s">Starter (S)</option><option value="m">Pro (M)</option><option value="l">Enterprise (L)</option>
                </select>
              </div>
              <div><label className="input-label">vCPU</label><input type="number" min="1" className="input-field" {...f('cpuCores')} /></div>
              <div><label className="input-label">RAM (MB)</label><input type="number" min="512" className="input-field" {...f('ramMb')} /></div>
              <div><label className="input-label">Disque (GB)</label><input type="number" min="5" className="input-field" {...f('diskGb')} /></div>
              <div><label className="input-label">Bande passante (GB)</label><input type="number" className="input-field" placeholder="Illimitée" {...f('bandwidthGb')} /></div>
              <div>
                <label className="input-label">Prix (€/mois) *</label>
                <input type="number" step="0.01" min="0" className="input-field" {...f('priceMonthly')} />
                <p className="text-xs text-slate-400 mt-1">Le prix Stripe est créé automatiquement</p>
              </div>
              <div><label className="input-label">Max snapshots</label><input type="number" min="0" className="input-field" {...f('maxSnapshots')} /></div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="active" checked={form.isActive} onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))} className="w-4 h-4 accent-brand-600" />
                <label htmlFor="active" className="text-sm text-slate-600">Actif (visible par les utilisateurs)</label>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <span className="spinner w-4 h-4" />}
                {editPlan ? 'Mettre à jour' : 'Créer le plan'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead><tr>{['Plan', 'Type', 'Ressources', 'Prix', 'Stripe', 'Statut', ''].map(h => <th key={h} className="table-header">{h}</th>)}</tr></thead>
            <tbody>
              {plans.map(p => (
                <tr key={p.id} className="table-row">
                  <td className="table-cell"><div className="font-semibold text-slate-900">{p.name}</div><div className="text-xs font-mono text-slate-400">{p.slug}</div></td>
                  <td className="table-cell">
                    <span className={`badge border ${p.vmType === 'kvm' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
                      {p.vmType.toUpperCase()}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-slate-600">{p.cpuCores} vCPU · {p.ramMb >= 1024 ? `${p.ramMb/1024}GB` : `${p.ramMb}MB`} · {p.diskGb}GB</td>
                  <td className="table-cell font-semibold text-slate-900">€{p.priceMonthly.toFixed(2)}/mois</td>
                  <td className="table-cell">
                    {stripeOk(p)
                      ? <CheckCircle className="w-4 h-4 text-emerald-500" strokeWidth={1.75} title={p.stripePriceId} />
                      : <AlertCircle className="w-4 h-4 text-amber-500" strokeWidth={1.75} title="Sera créé au prochain achat" />}
                  </td>
                  <td className="table-cell"><span className={p.isActive ? 'badge-running' : 'badge-stopped'}>{p.isActive ? 'Actif' : 'Inactif'}</span></td>
                  <td className="table-cell">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(p)} className="btn-icon btn-sm" title="Modifier"><Edit2 className="w-3.5 h-3.5" strokeWidth={2} /></button>
                      <button onClick={() => handleDelete(p.id)} className="btn-icon btn-sm text-red-500 hover:bg-red-50" title="Désactiver"><Trash2 className="w-3.5 h-3.5" strokeWidth={2} /></button>
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
