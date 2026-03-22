import * as React from 'react';
import { cn } from '../utils/cn';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined' | 'tonal';
  onClick?: () => void;
}

export const Card: React.FC<CardProps> = ({ children, className, variant = 'default', onClick }) => {
  const variants = {
    default: 'bg-surface-container-lowest',
    elevated: 'bg-surface-container-lowest shadow-md',
    outlined: 'bg-surface-container-lowest border border-outline-variant',
    tonal: 'bg-surface-container-low',
  };

  return (
    <div 
      onClick={onClick}
      className={cn(
        'rounded-2xl p-4 transition-all duration-200',
        variants[variant],
        onClick && 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5',
        className
      )}
    >
      {children}
    </div>
  );
};
