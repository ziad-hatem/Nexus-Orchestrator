import * as React from 'react';
import { cn } from '../utils/cn';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'tonal' | 'error';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'bg-primary text-on-primary hover:bg-primary-container shadow-sm',
      secondary: 'bg-secondary-container text-on-secondary-container hover:bg-surface-container-high',
      outline: 'border border-outline-variant text-primary hover:bg-surface-container-low',
      ghost: 'text-on-surface-variant hover:bg-surface-container-low',
      tonal: 'bg-surface-container-low text-on-surface hover:bg-surface-container',
      error: 'bg-error text-on-error hover:bg-error/90',
    };

    const sizes = {
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm font-medium',
      lg: 'h-12 px-6 text-base font-semibold',
      icon: 'h-10 w-10 flex items-center justify-center p-0',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center rounded-xl transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
