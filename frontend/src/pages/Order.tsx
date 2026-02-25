import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, Server, Container, Zap, HardDrive, Wifi, Shield, Clock } from 'lucide-react';
import { billingAPI } from '../api/client';
import type { Plan } from '../types';

const TIER_LABEL: Record<string, string> = { s: 'Starter', m: 'Pro', l: 'Enterprise' };
const TIER_POPULAR: Record<string, boolean> = { s: false, m: true, l: false };

function PlanCard({ plan, vmType }: { plan: Plan; vmType: string }) {
  const popular = TIER_POPULAR[plan.tier];
  const price = Number(plan.priceMonthly);
  return (
    <div className={`card flex flex-col transition-all hover:shadow-md hover:-translate-y-0.5 relative ${popular ? 'border-brand-300 ring-1 ring-brand-300' : ''}`}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-brand-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">⭐ Le plus populaire</span>
        </div>
      )}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-slate-900">{TIER_LABEL[plan.tier]}</p>
          <span className={`badge border text-xs ${vmType === 'kvm' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
            {vmType.toUpperCase()}
          </span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900">€{Math.floor(price)}</span>
          <span className="text-slate-500 text-sm">,{price.toFixed(2).split('.')[1]}</span>
          <span className="text-slate-400 text-xs ml-1">/mois</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Facturation mensuelle</p>
      </div>
      <div className="p-5 flex-1">
        <div className="space-y-2.5">
          {[
            { icon: Zap,      label: `${plan.cpuCores} vCPU` },
            { icon: HardDrive, label: `${plan.ramMb >= 1024 ? `${plan.ramMb/1024} GB` : `${plan.ramMb} MB`} RAM` },
            { icon: Server,   label: `${plan.diskGb} GB SSD NVMe` },
            { icon: Wifi,     label: plan.bandwidthGb ? `${plan.bandwidthGb} GB bande passante` : 'Bande passante illimitée' },
            { icon: Shield,   label: 'Protection DDoS incluse' },
            { icon: Clock,    label: 'SLA 99.9% garanti' },
            { icon: CheckCircle, label: `${plan.maxSnapshots} snapshot${plan.maxSnapshots > 1 ? 's' : ''}` },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2.5">
              <Icon className="w-3.5 h-3.5 text-brand-500 flex-shrink-0" strokeWidth={2} />
              <span className="text-sm text-slate-600">{label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="p-5 pt-0">
        <Link to={`/deploy?planId=${plan.id}&type=${vmType}`}
          className={`w-full justify-center ${popular ? 'btn-primary' : 'btn-secondary'} btn`}>
          Commander maintenant
        </Link>
      </div>
    </div>
  );
}

export default function Order() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tab, setTab]     = useState<'kvm' | 'lxc'>('kvm');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    billingAPI.getPlans()
      .then(r => setPlans(r.data.plans ?? []))
      .catch(err => console.error('[Order] plans fetch error:', err))
      .finally(() => setLoading(false));
  }, []);

  const filtered = plans.filter(p => p.vmType === tab && p.isActive);

  return (
    <div className="page-container max-w-5xl">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Nos offres d'hébergement</h1>
        <p className="text-slate-500">Choisissez votre serveur, déployé en quelques minutes</p>
      </div>

      {/* Tab selector */}
      <div className="flex justify-center mb-8">
        <div className="bg-white border border-slate-200 rounded-xl p-1 flex gap-1 shadow-sm">
          <button onClick={() => setTab('kvm')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${tab === 'kvm' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Server className="w-4 h-4" strokeWidth={1.75} />
            VPS KVM
          </button>
          <button onClick={() => setTab('lxc')}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${tab === 'lxc' ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
            <Container className="w-4 h-4" strokeWidth={1.75} />
            Conteneurs LXC
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="spinner w-8 h-8" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">Aucune offre disponible pour le moment.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {filtered.sort((a, b) => a.priceMonthly - b.priceMonthly).map(p => (
            <PlanCard key={p.id} plan={p} vmType={tab} />
          ))}
        </div>
      )}

      {/* Trust badges */}
      <div className="border-t border-slate-200 pt-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Shield,  label: 'Protection DDoS',   sub: 'Incluse dans tous les plans' },
            { icon: Clock,   label: 'SLA 99.9%',          sub: 'Uptime garanti contractuellement' },
            { icon: Zap,     label: 'Déploiement rapide', sub: 'Prêt en moins de 5 minutes' },
            { icon: Server,  label: 'Support 24/7',       sub: 'Équipe technique disponible' },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="card p-4 text-center">
              <Icon className="w-6 h-6 text-brand-500 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
