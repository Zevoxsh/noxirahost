import { useEffect, useState } from 'react';
import { Users, UserX, UserCheck, Trash2, RefreshCw } from 'lucide-react';
import { adminAPI } from '../../api/client';

export default function AdminUsers() {
  const [users, setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    adminAPI.listUsers().then(r => setUsers(r.data.users ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSuspend = async (id: number) => {
    const reason = prompt('Raison de la suspension (optionnel)');
    if (reason === null) return;
    await adminAPI.suspendUser(id, reason || undefined);
    load();
  };
  const handleUnsuspend = async (id: number) => { await adminAPI.unsuspendUser(id); load(); };
  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Supprimer l'utilisateur "${username}" ?`)) return;
    await adminAPI.deleteUser(id); load();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Utilisateurs</h1>
          <p className="page-subtitle">{users.length} utilisateur{users.length !== 1 ? 's' : ''} enregistré{users.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={load} className="btn-secondary btn-sm"><RefreshCw className="w-3.5 h-3.5" strokeWidth={2} /> Actualiser</button>
      </div>

      {loading ? (
        <div className="card flex justify-center py-16"><div className="spinner" /></div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead><tr>{['ID', 'Utilisateur', 'Email', 'Rôle', 'Statut', 'Inscrit le', 'Actions'].map(h => <th key={h} className="table-header">{h}</th>)}</tr></thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={7} className="table-cell text-center py-8">
                  <div className="empty-state py-4"><Users className="empty-state-icon" strokeWidth={1} /><p className="empty-state-title">Aucun utilisateur</p></div>
                </td></tr>
              ) : users.map((u: any) => (
                <tr key={u.id} className="table-row">
                  <td className="table-cell text-xs font-mono text-slate-400">#{u.id}</td>
                  <td className="table-cell">
                    <div className="font-semibold text-slate-900">{u.display_name || u.username}</div>
                    <div className="text-xs text-slate-400">@{u.username}</div>
                  </td>
                  <td className="table-cell text-xs text-slate-500">{u.email || '—'}</td>
                  <td className="table-cell">
                    <span className={`badge border ${u.role === 'admin' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                      {u.role === 'admin' ? 'Admin' : 'Client'}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className={u.is_suspended ? 'badge-suspended' : 'badge-running'}>
                      {u.is_suspended ? 'Suspendu' : 'Actif'}
                    </span>
                  </td>
                  <td className="table-cell text-xs text-slate-500">{u.created_at ? new Date(u.created_at).toLocaleDateString('fr-FR') : '—'}</td>
                  <td className="table-cell">
                    <div className="flex items-center gap-1">
                      {u.is_suspended
                        ? <button onClick={() => handleUnsuspend(u.id)} className="btn-icon btn-sm text-emerald-600 hover:bg-emerald-50" title="Réactiver"><UserCheck className="w-3.5 h-3.5" strokeWidth={2} /></button>
                        : u.role !== 'admin' && <button onClick={() => handleSuspend(u.id)} className="btn-icon btn-sm text-amber-600 hover:bg-amber-50" title="Suspendre"><UserX className="w-3.5 h-3.5" strokeWidth={2} /></button>}
                      {u.role !== 'admin' && (
                        <button onClick={() => handleDelete(u.id, u.username)} className="btn-icon btn-sm text-red-500 hover:bg-red-50" title="Supprimer">
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                        </button>
                      )}
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
