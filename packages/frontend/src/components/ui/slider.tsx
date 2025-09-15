/**
 * Slider Component
 * Range slider for numeric inputs
 */

import React from 'react';
import { cn } from '../../utils/cn';

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  disabled?: boolean;
}

export const Slider: React.FC<SliderProps> = ({
  value,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  className,
  disabled = false,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onValueChange([newValue]);
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value[0] || min}
        onChange={handleChange}
        disabled={disabled}
        className={cn(
          "w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer",
          "slider-thumb:appearance-none slider-thumb:h-4 slider-thumb:w-4",
          "slider-thumb:rounded-full slider-thumb:bg-blue-600",
          "slider-thumb:cursor-pointer slider-thumb:border-0",
          "focus:outline-none focus:ring-2 focus:ring-blue-500",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
    </div>
  );
};

export default Slider;