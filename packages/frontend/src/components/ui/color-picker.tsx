/**
 * Color Picker Component
 * Simple color picker for widget customization
 */

import React, { useState } from 'react';
import { Button } from './button';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  className?: string;
}

const PRESET_COLORS = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b',
  '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
  '#ec4899', '#6366f1', '#14b8a6', '#eab308',
  '#a855f7', '#0ea5e9', '#22c55e', '#f97316',
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  color,
  onChange,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={`h-8 w-8 p-0 ${className}`}
          style={{ backgroundColor: color }}
        >
          <span className="sr-only">Pick color</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Custom Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => onChange(e.target.value)}
              className="w-full h-8 rounded border"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium">Preset Colors</label>
            <div className="grid grid-cols-8 gap-1 mt-2">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  className="h-6 w-6 rounded border hover:scale-110 transition-transform"
                  style={{ backgroundColor: presetColor }}
                  onClick={() => {
                    onChange(presetColor);
                    setIsOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColorPicker;