/**
 * Select Component
 * Maritime-themed select with mobile-first design
 */

import React from 'react';
import { cn } from '../../utils/cn';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
  placeholder?: string;
  fullWidth?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({
    className,
    label,
    error,
    helperText,
    options,
    placeholder,
    fullWidth = true,
    id,
    ...props
  }, ref) => {
    const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;

    const selectClasses = cn(
      'form-select',
      'block w-full px-4 py-3 text-base border rounded-lg transition-colors min-h-touch',
      'focus:ring-2 focus:ring-maritime-500 focus:border-maritime-500',
      'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed',
      'bg-white appearance-none',
      error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300',
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
            htmlFor={selectId}
            className="form-label block text-sm font-medium text-gray-700 mb-2"
          >
            {label}
          </label>
        )}
        
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={selectClasses}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
          
          {/* Custom dropdown arrow */}
          <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
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

Select.displayName = 'Select';

export { Select };