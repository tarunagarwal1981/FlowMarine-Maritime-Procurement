import React from 'react';
import { useAccessibility } from './AccessibilityProvider';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Settings, Eye, Type, MousePointer, Keyboard, Palette } from 'lucide-react';

export const AccessibilityPanel: React.FC = () => {
  const { settings, updateSettings, announceToScreenReader } = useAccessibility();

  const handleSettingChange = (key: keyof typeof settings, value: any) => {
    updateSettings({ [key]: value });
    announceToScreenReader(`${key} ${value ? 'enabled' : 'disabled'}`);
  };

  const resetToDefaults = () => {
    updateSettings({
      highContrast: false,
      largeText: false,
      reducedMotion: false,
      screenReaderMode: false,
      keyboardNavigation: true,
      focusIndicators: true,
      colorBlindMode: 'none'
    });
    announceToScreenReader('Accessibility settings reset to defaults');
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Accessibility Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Visual Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Visual Settings
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="high-contrast" className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                High Contrast Mode
              </Label>
              <Switch
                id="high-contrast"
                checked={settings.highContrast}
                onCheckedChange={(checked) => handleSettingChange('highContrast', checked)}
                aria-describedby="high-contrast-desc"
              />
            </div>
            <p id="high-contrast-desc" className="text-sm text-muted-foreground col-span-full">
              Increases contrast for better visibility
            </p>

            <div className="flex items-center justify-between">
              <Label htmlFor="large-text" className="flex items-center gap-2">
                <Type className="h-4 w-4" />
                Large Text
              </Label>
              <Switch
                id="large-text"
                checked={settings.largeText}
                onCheckedChange={(checked) => handleSettingChange('largeText', checked)}
                aria-describedby="large-text-desc"
              />
            </div>
            <p id="large-text-desc" className="text-sm text-muted-foreground col-span-full">
              Increases text size throughout the application
            </p>

            <div className="flex items-center justify-between">
              <Label htmlFor="reduced-motion">Reduced Motion</Label>
              <Switch
                id="reduced-motion"
                checked={settings.reducedMotion}
                onCheckedChange={(checked) => handleSettingChange('reducedMotion', checked)}
                aria-describedby="reduced-motion-desc"
              />
            </div>
            <p id="reduced-motion-desc" className="text-sm text-muted-foreground col-span-full">
              Reduces animations and transitions
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color-blind-mode">Color Blind Support</Label>
            <Select
              value={settings.colorBlindMode}
              onValueChange={(value) => handleSettingChange('colorBlindMode', value)}
            >
              <SelectTrigger id="color-blind-mode">
                <SelectValue placeholder="Select color blind mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="protanopia">Protanopia (Red-blind)</SelectItem>
                <SelectItem value="deuteranopia">Deuteranopia (Green-blind)</SelectItem>
                <SelectItem value="tritanopia">Tritanopia (Blue-blind)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Navigation Settings */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Keyboard className="h-4 w-4" />
            Navigation Settings
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="keyboard-nav" className="flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                Keyboard Navigation
              </Label>
              <Switch
                id="keyboard-nav"
                checked={settings.keyboardNavigation}
                onCheckedChange={(checked) => handleSettingChange('keyboardNavigation', checked)}
                aria-describedby="keyboard-nav-desc"
              />
            </div>
            <p id="keyboard-nav-desc" className="text-sm text-muted-foreground col-span-full">
              Enhanced keyboard navigation support
            </p>

            <div className="flex items-center justify-between">
              <Label htmlFor="focus-indicators" className="flex items-center gap-2">
                <MousePointer className="h-4 w-4" />
                Enhanced Focus Indicators
              </Label>
              <Switch
                id="focus-indicators"
                checked={settings.focusIndicators}
                onCheckedChange={(checked) => handleSettingChange('focusIndicators', checked)}
                aria-describedby="focus-indicators-desc"
              />
            </div>
            <p id="focus-indicators-desc" className="text-sm text-muted-foreground col-span-full">
              More visible focus indicators for keyboard navigation
            </p>

            <div className="flex items-center justify-between">
              <Label htmlFor="screen-reader">Screen Reader Mode</Label>
              <Switch
                id="screen-reader"
                checked={settings.screenReaderMode}
                onCheckedChange={(checked) => handleSettingChange('screenReaderMode', checked)}
                aria-describedby="screen-reader-desc"
              />
            </div>
            <p id="screen-reader-desc" className="text-sm text-muted-foreground col-span-full">
              Optimized for screen reader users
            </p>
          </div>
        </div>

        {/* Reset Button */}
        <div className="pt-4 border-t">
          <Button 
            variant="outline" 
            onClick={resetToDefaults}
            className="w-full"
          >
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};