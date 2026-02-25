import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Send, X } from 'lucide-react';
import { supportAPI } from '../api/client';
import { useAuthStore } from '../store/authStore';
import type { SupportTicket, TicketMessage } from '../types';

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const ticketId = parseInt(id!);
  const { user } = useAuthStore();
  const bottomRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket]   = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply]     = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await supportAPI.getTicket(ticketId);
      setTicket(res.data.ticket);
      setMessages(res.data.messages ?? []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [ticketId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try { await supportAPI.replyTicket(ticketId, reply.trim()); setReply(''); await load(); } catch {}
    setSending(false);
  };

  const handleClose = async () => {
    if (!confirm('Fermer ce ticket ?')) return;
    await supportAPI.closeTicket(ticketId);
    await load();
  };

  if (loading) return <div className="page-container"><div className="flex justify-center py-20"><div className="spinner" /></div></div>;
  if (!ticket) return <div className="page-container"><div className="alert-error">Ticket introuvable.</div></div>;

  return (
    <div className="page-container max-w-3xl">
      <Link to="/support" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        Retour au support
      </Link>

      <div className="card mb-4">
        <div className="card-header">
          <div>
            <h1 className="text-base font-bold text-slate-900">{ticket.subject}</h1>
            <p className="text-xs text-slate-400 mt-0.5">Ticket #{ticket.id} · Ouvert le {new Date(ticket.createdAt).toLocaleDateString('fr-FR')}</p>
          </div>
          {ticket.status !== 'closed' && (
            <button onClick={handleClose} className="btn-secondary btn-sm text-red-600 hover:bg-red-50 border-red-200">
              <X className="w-3.5 h-3.5" strokeWidth={2} /> Fermer le ticket
            </button>
          )}
        </div>
        <div className="card-body space-y-3 max-h-96 overflow-y-auto">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.userId === user?.id && !msg.isStaff ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-xl px-4 py-3 ${msg.isStaff ? 'bg-brand-50 border border-brand-200' : msg.userId === user?.id ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold ${msg.isStaff ? 'text-brand-700' : msg.userId === user?.id ? 'text-white/70' : 'text-slate-600'}`}>
                    {msg.isStaff ? '🛡 Support' : msg.displayName || msg.username}
                  </span>
                  <span className={`text-[10px] ${msg.userId === user?.id && !msg.isStaff ? 'text-white/40' : 'text-slate-400'}`}>
                    {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className={`text-sm whitespace-pre-wrap ${msg.userId === user?.id && !msg.isStaff ? 'text-white' : 'text-slate-700'}`}>{msg.message}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {ticket.status !== 'closed' && (
          <div className="border-t border-slate-100 p-4">
            <form onSubmit={handleReply} className="flex gap-2">
              <textarea className="input-field flex-1 resize-none" rows={2} placeholder="Votre message…"
                value={reply} onChange={e => setReply(e.target.value)} />
              <button type="submit" disabled={sending || !reply.trim()} className="btn-primary flex-shrink-0 self-end px-4 py-2.5">
                {sending ? <span className="spinner w-4 h-4" /> : <Send className="w-4 h-4" strokeWidth={2} />}
              </button>
            </form>
          </div>
        )}
        {ticket.status === 'closed' && (
          <div className="border-t border-slate-100 px-5 py-3 text-sm text-slate-400 text-center">
            Ce ticket est fermé.
          </div>
        )}
      </div>
    </div>
  );
}
