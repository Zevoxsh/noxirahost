import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cloud, AlertCircle } from 'lucide-react';
import { authAPI } from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function Register() {
  const [form, setForm]   = useState({ username: '', displayName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value }))
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (form.password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    setLoading(true);
    try {
      const res = await authAPI.register({ username: form.username, password: form.password, displayName: form.displayName || undefined, email: form.email || undefined });
      setUser(res.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erreur lors de la création du compte.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg">
            <Cloud className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <p className="text-slate-900 font-bold text-lg">Noxira</p>
        </div>

        <div className="card p-8">
          <h1 className="text-xl font-bold text-slate-900 mb-1">Créer un compte</h1>
          <p className="text-sm text-slate-500 mb-6">Rejoignez Noxira en quelques secondes</p>

          {error && (
            <div className="alert-error flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="input-label">Identifiant *</label>
                <input className="input-field" placeholder="john-doe" {...f('username')} />
              </div>
              <div>
                <label className="input-label">Nom affiché</label>
                <input className="input-field" placeholder="John Doe" {...f('displayName')} />
              </div>
            </div>
            <div>
              <label className="input-label">Email</label>
              <input type="email" className="input-field" placeholder="john@example.com" {...f('email')} />
            </div>
            <div>
              <label className="input-label">Mot de passe *</label>
              <input type="password" className="input-field" placeholder="8 caractères minimum" {...f('password')} />
            </div>
            <div>
              <label className="input-label">Confirmer le mot de passe *</label>
              <input type="password" className="input-field" placeholder="••••••••" {...f('confirm')} />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading && <span className="spinner w-4 h-4" />}
              Créer mon compte
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Déjà un compte ?{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Se connecter</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
