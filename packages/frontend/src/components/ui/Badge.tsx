import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  dot?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant = 'default',
  dot = false,
  children,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium backdrop-blur-sm border';
  
  const variants = {
    default: 'bg-slate-100/80 text-slate-700 border-slate-200/60',
    success: 'bg-emerald-50/80 text-emerald-700 border-emerald-200/60',
    warning: 'bg-amber-50/80 text-amber-700 border-amber-200/60',
    error: 'bg-red-50/80 text-red-700 border-red-200/60',
    info: 'bg-blue-50/80 text-blue-700 border-blue-200/60'
  };

  return (
    <span
      className={cn(baseClasses, variants[variant], className)}
      {...props}
    >
      {dot && <span className="w-2 h-2 bg-current rounded-full mr-1.5" />}
      {children}
    </span>
  );
};

export const StatusBadge = Badge;
export const PriorityBadge = Badge;