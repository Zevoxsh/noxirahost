import type { LucideIcon } from 'lucide-react';

interface Props {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'amber' | 'orange' | 'purple' | 'rose';
  trend?: { value: string; up: boolean };
  sub?: string;
}

const COLORS = {
  blue:   { bg: 'bg-brand-50',   icon: 'text-brand-600',   border: 'border-brand-100'   },
  green:  { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
  amber:  { bg: 'bg-amber-50',   icon: 'text-amber-600',   border: 'border-amber-100'   },
  orange: { bg: 'bg-orange-50',  icon: 'text-orange-600',  border: 'border-orange-100'  },
  purple: { bg: 'bg-violet-50',  icon: 'text-violet-600',  border: 'border-violet-100'  },
  rose:   { bg: 'bg-rose-50',    icon: 'text-rose-600',    border: 'border-rose-100'    },
};

export default function StatsCard({ label, value, icon: Icon, color = 'blue', trend, sub }: Props) {
  const c = COLORS[color];
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            {label}
          </p>
          <p className="text-2xl font-bold text-slate-900 leading-none">
            {value}
          </p>
          {sub && <p className="text-xs text-slate-400 mt-1.5">{sub}</p>}
          {trend && (
            <p className={`text-xs font-semibold mt-2 ${trend.up ? 'text-emerald-600' : 'text-red-500'}`}>
              {trend.up ? '↑' : '↓'} {trend.value}
            </p>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 ${c.bg} ${c.border}`}>
          <Icon className={`w-5 h-5 ${c.icon}`} strokeWidth={1.75} />
        </div>
      </div>
    </div>
  );
}
