import * as React from 'react';
import { cn } from '../utils/cn';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'active' | 'draft' | 'archived' | 'legacy' | 'error' | 'success';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'draft', className }) => {
  const variants = {
    active: 'bg-[#e8f5e9] text-[#2e7d32]',
    draft: 'bg-surface-container text-on-surface-variant',
    archived: 'bg-error-container text-on-error-container',
    legacy: 'bg-secondary-container text-on-secondary-container',
    error: 'bg-error-container text-on-error-container',
    success: 'bg-[#e8f5e9] text-[#2e7d32]',
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
      variants[variant],
      className
    )}>
      {children}
    </span>
  );
};
