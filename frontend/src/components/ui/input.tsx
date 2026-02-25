import * as React from 'react';
import { cn } from '../../lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-900',
          'placeholder:text-slate-400 transition-all duration-150',
          'focus:outline-none focus:border-brand-400',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
        onFocus={e => { e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.12), 0 1px 2px rgba(0,0,0,0.04)'; }}
        onBlur={e => { e.target.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)'; }}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
