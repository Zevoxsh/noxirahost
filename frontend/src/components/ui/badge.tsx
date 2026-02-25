import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-brand-50 text-brand-700 border border-brand-200',
        secondary:   'bg-slate-100 text-slate-600 border border-slate-200',
        destructive: 'bg-red-50 text-red-700 border border-red-200',
        success:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
        warning:     'bg-amber-50 text-amber-700 border border-amber-200',
        outline:     'border border-slate-200 text-slate-700',
        /* Status variants */
        running:     'bg-emerald-50 text-emerald-700 border border-emerald-200',
        stopped:     'bg-slate-100 text-slate-600 border border-slate-200',
        error:       'bg-red-50 text-red-700 border border-red-200',
        provisioning:'bg-amber-50 text-amber-700 border border-amber-200',
        suspended:   'bg-orange-50 text-orange-700 border border-orange-200',
      },
      size: {
        default: 'px-2.5 py-0.5',
        sm: 'px-2 py-0.5 text-[10px]',
        lg: 'px-3 py-1',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size }), className)} {...props} />;
}

export { Badge, badgeVariants };
