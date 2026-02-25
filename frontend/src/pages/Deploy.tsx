import { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, FileText, Disc, Eye, EyeOff } from 'lucide-react';
import { billingAPI, isoAPI, templateAPI } from '../api/client';
import type { Plan, ISO, LxcTemplate } from '../types';

export default function Deploy() {
  const [params]   = useSearchParams();
  const navigate   = useNavigate();
  const urlPlanId  = params.get('planId');
  const urlType    = (params.get('type') || 'kvm') as 'kvm' | 'lxc';

  const [plans, setPlans]       = useState<Plan[]>([]);
  const [isos, setIsos]         = useState<ISO[]>([]);
  const [templates, setTemplates] = useState<LxcTemplate[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [vmType, setVmType]       = useState<'kvm' | 'lxc'>(urlType);
  const [rootPassword, setRootPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedOS, setSelectedOS] = useState('');
  const [step, setStep]           = useState<1 | 2 | 3>(urlPlanId ? 2 : 1);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    Promise.all([
      billingAPI.getPlans(),
      isoAPI.list(),
      templateAPI.list()
    ]).then(([pr, ir, tr]) => {
      const allPlans = pr.data.plans ?? [];
      setPlans(allPlans);
      setIsos(ir.data.isos ?? []);
      const allTmpl = tr.data.templates ?? [];
      setTemplates(allTmpl.filter((t: LxcTemplate, i: number, arr: LxcTemplate[]) =>
        arr.findIndex(x => x.filename === t.filename) === i
      ));
      if (urlPlanId) {
        const p = allPlans.find((x: Plan) => x.id === parseInt(urlPlanId));
        if (p) { setSelectedPlan(p); setVmType(p.vmType); }
      }
    }).catch(() => {});
  }, [urlPlanId]);

  const checkout = async () => {
    if (!selectedPlan) return;
    setLoading(true); setError('');
    try {
      const res = await billingAPI.createCheckout({ planId: selectedPlan.id, rootPassword, osTemplate: selectedOS || undefined });
      window.location.href = res.data.url;
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Erreur lors du paiement.');
      setLoading(false);
    }
  };

  const filteredPlans = plans.filter(p => p.vmType === vmType && p.isActive);
  const osOptions     = vmType === 'kvm' ? isos : templates;
  const steps         = urlPlanId ? ['Configuration', 'Confirmation'] : ['Offre', 'Configuration', 'Confirmation'];
  const displayStep   = urlPlanId ? step - 1 : step;

  return (
    <div className="page-container max-w-2xl">
      <Link to="/order" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        Retour aux offres
      </Link>

      <h1 className="page-title mb-1">Commander un serveur</h1>
      <p className="page-subtitle mb-6">{selectedPlan ? `Plan : ${selectedPlan.name} — €${selectedPlan.priceMonthly.toFixed(2)}/mois` : 'Choisissez votre offre'}</p>

      {/* Steps */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((label, i) => {
          const done   = displayStep > i + 1;
          const active = displayStep === i + 1;
          return (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-2 ${active ? 'text-slate-900' : done ? 'text-brand-600' : 'text-slate-400'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 flex-shrink-0 transition-all ${
                  done   ? 'bg-brand-600 border-brand-600 text-white' :
                  active ? 'border-brand-600 text-brand-600 bg-white' :
                           'border-slate-200 text-slate-400 bg-white'
                }`}>
                  {done ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : i + 1}
                </div>
                <span className="text-xs font-semibold hidden sm:block">{label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 rounded-full transition-all ${displayStep > i + 1 ? 'bg-brand-600' : 'bg-slate-200'}`} />
              )}
            </div>
          );
        })}
      </div>

      <div className="card">
        {/* Step 1: Plan selection */}
        {step === 1 && (
          <div className="card-body">
            <div className="flex gap-2 mb-4">
              {(['kvm', 'lxc'] as const).map(t => (
                <button key={t} onClick={() => setVmType(t)}
                  className={`btn btn-sm flex-1 justify-center ${vmType === t ? 'btn-primary' : 'btn-secondary'}`}>
                  {t === 'kvm' ? '🖥 VPS KVM' : '📦 LXC Container'}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {filteredPlans.sort((a, b) => a.priceMonthly - b.priceMonthly).map(p => (
                <button key={p.id} onClick={() => setSelectedPlan(p)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all ${selectedPlan?.id === p.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-slate-300 bg-white'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{p.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{p.cpuCores} vCPU · {p.ramMb >= 1024 ? `${p.ramMb/1024} GB` : `${p.ramMb} MB`} RAM · {p.diskGb} GB SSD</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">€{p.priceMonthly.toFixed(2)}</p>
                      <p className="text-xs text-slate-400">/mois</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => { if (selectedPlan) setStep(2); }} disabled={!selectedPlan} className="btn-primary">
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Config */}
        {step === 2 && (
          <div className="card-body space-y-5">
            {selectedPlan && (
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-brand-900">{selectedPlan.name}</p>
                  <p className="text-xs text-brand-600">{selectedPlan.cpuCores} vCPU · {selectedPlan.ramMb >= 1024 ? `${selectedPlan.ramMb/1024} GB` : `${selectedPlan.ramMb} MB`} · {selectedPlan.diskGb} GB SSD</p>
                </div>
                <p className="text-xl font-bold text-brand-700">€{selectedPlan.priceMonthly.toFixed(2)}<span className="text-sm font-normal text-brand-500">/mois</span></p>
              </div>
            )}
            <div>
              <label className="input-label">Mot de passe root *</label>
              <div className="relative">
                <input
                  className="input-field pr-10"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 caractères"
                  value={rootPassword}
                  onChange={e => setRootPassword(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Mot de passe du compte root de votre serveur</p>
            </div>
            <div>
              <label className="input-label">
                {vmType === 'kvm' ? 'Image ISO' : 'Template LXC'}
                <span className="normal-case text-slate-400 ml-1 font-normal">(optionnel)</span>
              </label>
              <div className="space-y-1.5 max-h-52 overflow-y-auto border border-slate-200 rounded-lg p-2 bg-slate-50">
                <button onClick={() => setSelectedOS('')}
                  className={`w-full p-2.5 rounded-lg text-left text-sm transition-all ${!selectedOS ? 'bg-brand-600 text-white' : 'hover:bg-white text-slate-600'}`}>
                  Aucun — configurer plus tard
                </button>
                {(osOptions as any[]).map(os => (
                  <button key={os.volid} onClick={() => setSelectedOS(os.volid)}
                    className={`w-full p-2.5 rounded-lg text-left text-sm transition-all flex items-center gap-2.5 ${selectedOS === os.volid ? 'bg-brand-600 text-white' : 'hover:bg-white text-slate-700'}`}>
                    {vmType === 'kvm'
                      ? <Disc className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
                      : <FileText className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />}
                    <span className="truncate">{os.filename}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              {!urlPlanId && <button onClick={() => setStep(1)} className="btn-secondary">← Retour</button>}
              <button onClick={() => { if (rootPassword.length >= 8) setStep(3); }} disabled={rootPassword.length < 8} className="btn-primary">
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Summary */}
        {step === 3 && selectedPlan && (
          <div className="card-body">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Récapitulatif de la commande</h2>
            {error && <div className="alert-error mb-4">{error}</div>}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-5">
              {[
                { label: 'Type',         value: vmType.toUpperCase() },
                { label: 'Offre',        value: selectedPlan.name },
                { label: 'CPU',          value: `${selectedPlan.cpuCores} vCPU` },
                { label: 'RAM',          value: selectedPlan.ramMb >= 1024 ? `${selectedPlan.ramMb/1024} GB` : `${selectedPlan.ramMb} MB` },
                { label: 'Disque',       value: `${selectedPlan.diskGb} GB SSD` },
                { label: 'Mot de passe', value: '●'.repeat(rootPassword.length) },
                { label: 'OS',           value: selectedOS ? osOptions.find((o: any) => o.volid === selectedOS)?.filename || selectedOS : 'À configurer' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center px-4 py-3 border-b border-slate-100 last:border-0 text-sm">
                  <span className="text-slate-500 w-24 flex-shrink-0">{label}</span>
                  <span className="font-medium text-slate-900">{value}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between bg-brand-50 border border-brand-200 rounded-xl px-5 py-4 mb-5">
              <span className="font-semibold text-slate-800">Total mensuel</span>
              <span className="text-2xl font-bold text-brand-700">€{selectedPlan.priceMonthly.toFixed(2)}/mois</span>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setStep(2)} className="btn-secondary">← Retour</button>
              <button onClick={checkout} disabled={loading} className="btn-primary px-6">
                {loading && <span className="spinner w-4 h-4" />}
                Procéder au paiement
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
