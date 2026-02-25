import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Cloud, Lock, User, AlertCircle } from 'lucide-react';
import { authAPI } from '../api/client';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { setUser } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login({ username, password });
      setUser(res.data.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-96 bg-navy-900 flex-col justify-between p-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg">
            <Cloud className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="text-white font-bold text-base">Noxira</p>
            <p className="text-slate-500 text-xs">Hébergement haute performance</p>
          </div>
        </div>

        <div>
          <h2 className="text-white text-2xl font-bold leading-snug mb-4">
            Vos serveurs,<br />toujours disponibles.
          </h2>
          <div className="space-y-3">
            {['VPS KVM & Conteneurs LXC', 'Console noVNC intégrée', 'Facturation Stripe automatique', 'Support technique réactif'].map(f => (
              <div key={f} className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-400 flex-shrink-0" />
                <p className="text-slate-400 text-sm">{f}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs">© 2025 Noxira — Tous droits réservés</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-lg">
              <Cloud className="w-5 h-5 text-white" strokeWidth={2} />
            </div>
            <p className="text-slate-900 font-bold text-lg">Noxira</p>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-1">Connexion</h1>
          <p className="text-sm text-slate-500 mb-6">Accédez à votre espace client</p>

          {error && (
            <div className="alert-error flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="input-label">Identifiant</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
                <input className="input-field pl-9" placeholder="votre-identifiant"
                  value={username} onChange={e => setUsername(e.target.value)} autoFocus />
              </div>
            </div>
            <div>
              <label className="input-label">Mot de passe</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" strokeWidth={1.75} />
                <input type="password" className="input-field pl-9" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading && <span className="spinner w-4 h-4" />}
              Se connecter
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-5">
            Pas encore de compte ?{' '}
            <Link to="/register" className="text-brand-600 hover:text-brand-700 font-medium">Créer un compte</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
