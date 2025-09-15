/**
 * Input Component
 * Maritime-themed input with mobile-first design
 */

import React from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({
    className,
    type = 'text',
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    fullWidth = true,
    id,
    ...props
  }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

    const inputClasses = cn(
      'form-input',
      'block w-full px-4 py-3 text-base border rounded-lg transition-colors min-h-touch',
      'focus:ring-2 focus:ring-maritime-500 focus:border-maritime-500',
      'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
      error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300',
      leftIcon && 'pl-12',
      rightIcon && 'pr-12',
      !fullWidth && 'w-auto',
      className
    );

    const containerClasses = cn(
      'relative',
      fullWidth ? 'w-full' : 'w-auto'
    );

    return (
      <div className={containerClasses}>
        {label && (
          <label
            htmlFor={inputId}
            className="form-label block text-sm font-medium text-gray-700 mb-2"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-500 text-lg">
                {leftIcon}
              </span>
            </div>
          )}
          
          <input
            ref={ref}
            type={type}
            id={inputId}
            className={inputClasses}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-500 text-lg">
                {rightIcon}
              </span>
            </div>
          )}
        </div>
        
        {error && (
          <p className="form-error text-red-600 text-sm mt-1" role="alert">
            {error}
          </p>
        )}
        
        {helperText && !error && (
          <p className="text-gray-500 text-sm mt-1">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };