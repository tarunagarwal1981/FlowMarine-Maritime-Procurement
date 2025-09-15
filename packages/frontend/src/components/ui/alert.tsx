import React from 'react';
import { cn } from '../../utils/cn';

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'destructive' | 'warning' | 'success';
}

export const Alert: React.FC<AlertProps> = ({ 
  className, 
  variant = 'default', 
  ...props 
}) => {
  const variants = {
    default: 'bg-gray-50 text-gray-900 border-gray-200',
    destructive: 'bg-red-50 text-red-900 border-red-200',
    warning: 'bg-yellow-50 text-yellow-900 border-yellow-200',
    success: 'bg-green-50 text-green-900 border-green-200',
  };

  return (
    <div
      className={cn(
        'relative w-full rounded-lg border p-4',
        variants[variant],
        className
      )}
      {...props}
    />
  );
};

export const AlertDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn('text-sm [&_p]:leading-relaxed', className)}
    {...props}
  />
);