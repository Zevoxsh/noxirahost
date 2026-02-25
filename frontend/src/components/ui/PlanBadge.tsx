import type { PlanTier, VMType } from '../../types';

const TIER: Record<PlanTier, string> = { s: 'Starter', m: 'Pro', l: 'Enterprise' };
const TYPE_CLS: Record<VMType, string> = {
  kvm: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  lxc: 'bg-teal-50 text-teal-700 border-teal-200',
};

export default function PlanBadge({ vmType, tier }: { vmType: VMType; tier: PlanTier }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`badge border ${TYPE_CLS[vmType]}`}>{vmType.toUpperCase()}</span>
      <span className="text-xs text-slate-500">{TIER[tier]}</span>
    </div>
  );
}
