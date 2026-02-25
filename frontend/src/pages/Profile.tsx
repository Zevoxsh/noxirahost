import { useState } from 'react';
import { User, Save, CheckCircle } from 'lucide-react';
import { userAPI } from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [form, setForm]   = useState({ displayName: user?.displayName || '', email: user?.email || '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [error, setError]   = useState('');

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await userAPI.updateProfile({ displayName: form.displayName || undefined, email: form.email || undefined });
      setUser(res.data.user);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erreur lors de la sauvegarde.');
    } finally { setSaving(false); }
  };

  const initials = (user?.displayName || user?.username || '?').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="page-container max-w-2xl">
      <h1 className="page-title mb-6">Mon compte</h1>

      <div className="card mb-4">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-500" strokeWidth={1.75} />
            Informations du profil
          </h2>
        </div>
        <div className="card-body">
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
            <div className="w-16 h-16 rounded-full bg-brand-100 border-2 border-brand-200 flex items-center justify-center">
              <span className="text-2xl font-bold text-brand-600">{initials}</span>
            </div>
            <div>
              <p className="font-semibold text-slate-900 text-base">{user?.displayName || user?.username}</p>
              <p className="text-sm text-slate-500">@{user?.username}</p>
              <span className={`badge border mt-1 ${user?.role === 'admin' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-brand-50 text-brand-700 border-brand-200'}`}>
                {user?.role === 'admin' ? 'Administrateur' : 'Client'}
              </span>
            </div>
          </div>

          {saved && <div className="alert-success flex items-center gap-2 mb-4"><CheckCircle className="w-4 h-4" strokeWidth={2} /> Profil mis à jour.</div>}
          {error && <div className="alert-error mb-4">{error}</div>}

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="input-label">Identifiant</label>
              <input className="input-field bg-slate-50 cursor-not-allowed" value={user?.username || ''} disabled />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Nom affiché</label>
                <input className="input-field" placeholder="Jean Dupont"
                  value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Adresse email</label>
                <input type="email" className="input-field" placeholder="jean@exemple.fr"
                  value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <span className="spinner w-4 h-4" /> : <Save className="w-4 h-4" strokeWidth={2} />}
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card card-body">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Informations du compte</h2>
        <div className="space-y-2">
          {[
            { label: 'ID client', value: `#${user?.id}` },
            { label: 'Rôle', value: user?.role === 'admin' ? 'Administrateur' : 'Client' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
              <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{row.label}</span>
              <span className="text-sm font-medium text-slate-800">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
