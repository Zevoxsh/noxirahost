import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LifeBuoy, Plus, X, ChevronRight } from 'lucide-react';
import { supportAPI } from '../api/client';
import type { SupportTicket } from '../types';

const PRI_CLS: Record<string, string> = {
  low: 'badge-stopped', medium: 'badge-provisioning', high: 'badge-error', critical: 'badge-error',
};
const STA_CLS: Record<string, string> = {
  open: 'badge-active', in_progress: 'badge-provisioning', closed: 'badge-stopped',
};

export default function Support() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ subject: '', message: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    supportAPI.listTickets().then(r => setTickets(r.data.tickets ?? [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject || !form.message) return;
    setSubmitting(true);
    try {
      await supportAPI.createTicket({ subject: form.subject, message: form.message, priority: form.priority });
      setForm({ subject: '', message: '', priority: 'medium' });
      setShowForm(false);
      load();
    } catch {} finally { setSubmitting(false); }
  };

  return (
    <div className="page-container max-w-4xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Support</h1>
          <p className="page-subtitle">{tickets.filter(t => t.status !== 'closed').length} ticket(s) ouvert(s)</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus className="w-4 h-4" strokeWidth={2} />
          Nouveau ticket
        </button>
      </div>

      {showForm && (
        <div className="card mb-4">
          <div className="card-header">
            <h2 className="text-sm font-semibold text-slate-700">Nouveau ticket de support</h2>
            <button onClick={() => setShowForm(false)} className="btn-icon"><X className="w-4 h-4" strokeWidth={2} /></button>
          </div>
          <form onSubmit={handleSubmit} className="card-body space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="input-label">Sujet *</label>
                <input className="input-field" placeholder="Décrivez votre problème en quelques mots"
                  value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} />
              </div>
              <div>
                <label className="input-label">Priorité</label>
                <select className="input-field" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                  <option value="low">Faible</option>
                  <option value="medium">Normale</option>
                  <option value="high">Haute</option>
                  <option value="critical">Critique</option>
                </select>
              </div>
            </div>
            <div>
              <label className="input-label">Message *</label>
              <textarea className="input-field resize-none" rows={4} placeholder="Décrivez votre problème en détail…"
                value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting && <span className="spinner w-4 h-4" />}
                Envoyer
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="card flex justify-center py-12"><div className="spinner" /></div>
      ) : tickets.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <LifeBuoy className="empty-state-icon" strokeWidth={1} />
            <p className="empty-state-title">Aucun ticket de support</p>
            <p className="empty-state-desc mb-4">Notre équipe est là pour vous aider</p>
            <button onClick={() => setShowForm(true)} className="btn-primary btn-sm">
              <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Créer un ticket
            </button>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="w-full">
            <thead>
              <tr>{['#', 'Sujet', 'Priorité', 'Statut', 'Créé le', ''].map(h => <th key={h} className="table-header">{h}</th>)}</tr>
            </thead>
            <tbody>
              {tickets.map(t => (
                <tr key={t.id} className="table-row">
                  <td className="table-cell text-slate-400 font-mono text-xs">#{t.id}</td>
                  <td className="table-cell">
                    <Link to={`/support/${t.id}`} className="font-medium text-slate-900 hover:text-brand-600 transition-colors">
                      {t.subject}
                    </Link>
                  </td>
                  <td className="table-cell"><span className={PRI_CLS[t.priority] || 'badge-stopped'}>{t.priority}</span></td>
                  <td className="table-cell"><span className={STA_CLS[t.status] || 'badge-stopped'}>{t.status.replace('_', ' ')}</span></td>
                  <td className="table-cell text-slate-500 text-xs">{new Date(t.createdAt).toLocaleDateString('fr-FR')}</td>
                  <td className="table-cell">
                    <Link to={`/support/${t.id}`} className="btn-icon btn-sm">
                      <ChevronRight className="w-4 h-4" strokeWidth={2} />
                    </Link>
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
