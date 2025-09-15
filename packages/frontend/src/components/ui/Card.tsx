import React from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'interactive';
}

export const Card: React.FC<CardProps> = ({
  className,
  variant = 'default',
  children,
  ...props
}) => {
  const baseClasses = 'bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/60 shadow-sm';
  
  const variants = {
    default: '',
    interactive: 'hover:shadow-lg hover:shadow-slate-200/50 hover:border-slate-300/60 transition-all duration-300 cursor-pointer'
  };

  return (
    <div
      className={cn(baseClasses, variants[variant], className)}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardHeader: React.FC<CardHeaderProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn('px-6 py-5 border-b border-slate-200/60', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent: React.FC<CardContentProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn('px-6 py-5', className)}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter: React.FC<CardFooterProps> = ({
  className,
  children,
  ...props
}) => {
  return (
    <div
      className={cn('px-6 py-5 border-t border-slate-200/60', className)}
      {...props}
    >
      {children}
    </div>
  );
};