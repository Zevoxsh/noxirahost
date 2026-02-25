import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default:     'text-white [background:linear-gradient(135deg,#2563eb_0%,#1d4ed8_100%)] [box-shadow:0_1px_3px_rgba(37,99,235,0.3),inset_0_1px_0_rgba(255,255,255,0.12)] hover:[background:linear-gradient(135deg,#1d4ed8_0%,#1e40af_100%)] hover:-translate-y-px active:translate-y-0',
        secondary:   'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 [box-shadow:0_1px_2px_rgba(0,0,0,0.05)] hover:[box-shadow:0_2px_6px_rgba(0,0,0,0.08)] hover:-translate-y-px active:translate-y-0',
        ghost:       'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        destructive: 'text-white [background:linear-gradient(135deg,#dc2626_0%,#b91c1c_100%)] [box-shadow:0_1px_3px_rgba(220,38,38,0.25)] hover:-translate-y-px active:translate-y-0',
        success:     'text-white [background:linear-gradient(135deg,#059669_0%,#047857_100%)] [box-shadow:0_1px_3px_rgba(5,150,105,0.25)] hover:-translate-y-px active:translate-y-0',
        outline:     'border border-brand-200 text-brand-600 bg-brand-50 hover:bg-brand-100',
        link:        'text-brand-600 underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        default: 'px-4 py-2',
        sm:      'px-3 py-1.5 text-xs',
        xs:      'px-2 py-1 text-xs',
        lg:      'px-6 py-3 text-base',
        icon:    'p-2',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
