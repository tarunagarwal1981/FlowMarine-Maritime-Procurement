/**
 * Dashboard Preferences Manager
 * Manages personalized dashboard preferences and settings
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectCurrentConfiguration,
  updatePreferences,
  updateFilters,
  markSaved,
} from '../../store/slices/dashboardSlice';
import { selectUser } from '../../store/slices/authSlice';
import { useUpdateDashboardConfigurationMutation } from '../../store/api/dashboardApi';
import { DashboardConfiguration, DashboardFilters } from '../../types/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import {
  Settings,
  Palette,
  Bell,
  Clock,
  Globe,
  Monitor,
  Smartphone,
  Volume2,
  VolumeX,
  Eye,
  Filter,
  Calendar,
  DollarSign,
  Ship,
  Package,
  Users,
  AlertTriangle,
  Save,
  RotateCcw,
  Check,
  Info,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface DashboardPreferencesManagerProps {
  className?: string;
}

export const DashboardPreferencesManager: React.FC<DashboardPreferencesManagerProps> = ({
  className
}) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const currentConfiguration = useAppSelector(selectCurrentConfiguration);
  const [updateConfiguration, { isLoading: isSaving }] = useUpdateDashboardConfigurationMutation();

  const [activeTab, setActiveTab] = useState<'general' | 'display' | 'notifications' | 'filters'>('general');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showSaveAlert, setShowSaveAlert] = useState(false);

  // Local state for preferences
  const [preferences, setPreferences] = useState(
    currentConfiguration?.preferences || {
      defaultTimeRange: 'monthly',
      defaultCurrency: 'USD',
      refreshInterval: 300,
      notifications: true,
      theme: 'light' as const,
      compactMode: false,
      showTooltips: true,
      autoRefresh: true,
      soundNotifications: false,
    }
  );

  // Local state for default filters
  const [defaultFilters, setDefaultFilters] = useState<DashboardFilters>(
    currentConfiguration?.customLayouts.executive.filters || {
      timeRange: 'monthly',
      vessels: [],
      categories: [],
      vendors: [],
      currency: 'USD',
      urgencyLevel: [],
      status: [],
    }
  );

  // Update local state when configuration changes
  useEffect(() => {
    if (currentConfiguration) {
      setPreferences(currentConfiguration.preferences);
      setDefaultFilters(currentConfiguration.customLayouts.executive.filters);
      setHasUnsavedChanges(false);
    }
  }, [currentConfiguration]);

  // Handle preference changes
  const handlePreferenceChange = useCallback((key: string, value: any) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((key: string, value: any) => {
    setDefaultFilters(prev => ({ ...prev, [key]: value }));
    setHasUnsavedChanges(true);
  }, []);

  // Save preferences
  const handleSave = useCallback(async () => {
    if (!currentConfiguration) return;

    try {
      // Update Redux state
      dispatch(updatePreferences(preferences));
      
      // Update default filters for all layouts
      ['executive', 'operational', 'financial'].forEach(layoutType => {
        dispatch(updateFilters({
          layoutType: layoutType as any,
          filters: defaultFilters,
        }));
      });

      // Save to backend
      await updateConfiguration({
        id: currentConfiguration.id,
        updates: {
          ...currentConfiguration,
          preferences,
          customLayouts: {
            ...currentConfiguration.customLayouts,
            executive: {
              ...currentConfiguration.customLayouts.executive,
              filters: defaultFilters,
            },
            operational: {
              ...currentConfiguration.customLayouts.operational,
              filters: defaultFilters,
            },
            financial: {
              ...currentConfiguration.customLayouts.financial,
              filters: defaultFilters,
            },
          },
        },
      }).unwrap();

      dispatch(markSaved());
      setHasUnsavedChanges(false);
      setShowSaveAlert(true);
      setTimeout(() => setShowSaveAlert(false), 3000);
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }, [currentConfiguration, preferences, defaultFilters, dispatch, updateConfiguration]);

  // Reset to defaults
  const handleReset = useCallback(() => {
    const defaultPrefs = {
      defaultTimeRange: 'monthly',
      defaultCurrency: 'USD',
      refreshInterval: 300,
      notifications: true,
      theme: 'light' as const,
      compactMode: false,
      showTooltips: true,
      autoRefresh: true,
      soundNotifications: false,
    };

    const defaultFiltersReset: DashboardFilters = {
      timeRange: 'monthly',
      vessels: [],
      categories: [],
      vendors: [],
      currency: 'USD',
      urgencyLevel: [],
      status: [],
    };

    setPreferences(defaultPrefs);
    setDefaultFilters(defaultFiltersReset);
    setHasUnsavedChanges(true);
  }, []);

  // Currency options
  const currencyOptions = [
    { value: 'USD', label: 'US Dollar (USD)', symbol: '$' },
    { value: 'EUR', label: 'Euro (EUR)', symbol: '€' },
    { value: 'GBP', label: 'British Pound (GBP)', symbol: '£' },
    { value: 'JPY', label: 'Japanese Yen (JPY)', symbol: '¥' },
    { value: 'AUD', label: 'Australian Dollar (AUD)', symbol: 'A$' },
    { value: 'CAD', label: 'Canadian Dollar (CAD)', symbol: 'C$' },
    { value: 'CHF', label: 'Swiss Franc (CHF)', symbol: 'CHF' },
    { value: 'CNY', label: 'Chinese Yuan (CNY)', symbol: '¥' },
  ];

  // Time range options
  const timeRangeOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'yearly', label: 'Yearly' },
  ];

  // Theme options
  const themeOptions = [
    { value: 'light', label: 'Light', icon: Monitor },
    { value: 'dark', label: 'Dark', icon: Monitor },
    { value: 'auto', label: 'Auto', icon: Monitor },
  ];

  if (!currentConfiguration) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Settings className="h-8 w-8 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">No dashboard configuration selected</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("dashboard-preferences-manager space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Preferences</h2>
          <p className="text-muted-foreground">
            Customize your dashboard experience and default settings
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasUnsavedChanges && (
            <Badge variant="outline" className="text-amber-600 border-amber-600">
              Unsaved changes
            </Badge>
          )}
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Save confirmation alert */}
      {showSaveAlert && (
        <Alert className="border-green-200 bg-green-50">
          <Check className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">
            Preferences saved successfully!
          </AlertDescription>
        </Alert>
      )}

      {/* Preferences Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Display
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="filters" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Default Filters
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Regional Settings
              </CardTitle>
              <CardDescription>
                Configure your default currency and time range preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="default-currency">Default Currency</Label>
                  <Select
                    value={preferences.defaultCurrency}
                    onValueChange={(value) => handlePreferenceChange('defaultCurrency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{currency.symbol}</span>
                            {currency.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default-time-range">Default Time Range</Label>
                  <Select
                    value={preferences.defaultTimeRange}
                    onValueChange={(value) => handlePreferenceChange('defaultTimeRange', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeRangeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Refresh Settings
              </CardTitle>
              <CardDescription>
                Control how often your dashboard data refreshes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Auto Refresh</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically refresh dashboard data
                  </p>
                </div>
                <Switch
                  checked={preferences.autoRefresh}
                  onCheckedChange={(checked) => handlePreferenceChange('autoRefresh', checked)}
                />
              </div>

              {preferences.autoRefresh && (
                <div className="space-y-2">
                  <Label>Refresh Interval</Label>
                  <div className="space-y-2">
                    <Slider
                      value={[preferences.refreshInterval]}
                      onValueChange={([value]) => handlePreferenceChange('refreshInterval', value)}
                      min={30}
                      max={1800}
                      step={30}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>30 seconds</span>
                      <span className="font-medium">
                        {preferences.refreshInterval < 60
                          ? `${preferences.refreshInterval}s`
                          : `${Math.floor(preferences.refreshInterval / 60)}m ${preferences.refreshInterval % 60}s`
                        }
                      </span>
                      <span>30 minutes</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Display Tab */}
        <TabsContent value="display" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <div className="grid grid-cols-3 gap-2">
                  {themeOptions.map((theme) => (
                    <Button
                      key={theme.value}
                      variant={preferences.theme === theme.value ? "default" : "outline"}
                      className="flex items-center gap-2 justify-start"
                      onClick={() => handlePreferenceChange('theme', theme.value)}
                    >
                      <theme.icon className="h-4 w-4" />
                      {theme.label}
                    </Button>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Compact Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Reduce spacing and padding for more content
                    </p>
                  </div>
                  <Switch
                    checked={preferences.compactMode}
                    onCheckedChange={(checked) => handlePreferenceChange('compactMode', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Show Tooltips</Label>
                    <p className="text-sm text-muted-foreground">
                      Display helpful tooltips on hover
                    </p>
                  </div>
                  <Switch
                    checked={preferences.showTooltips}
                    onCheckedChange={(checked) => handlePreferenceChange('showTooltips', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Control how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Enable Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive notifications for important events
                  </p>
                </div>
                <Switch
                  checked={preferences.notifications}
                  onCheckedChange={(checked) => handlePreferenceChange('notifications', checked)}
                />
              </div>

              {preferences.notifications && (
                <>
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="flex items-center gap-2">
                        {preferences.soundNotifications ? (
                          <Volume2 className="h-4 w-4" />
                        ) : (
                          <VolumeX className="h-4 w-4" />
                        )}
                        Sound Notifications
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Play sound alerts for notifications
                      </p>
                    </div>
                    <Switch
                      checked={preferences.soundNotifications}
                      onCheckedChange={(checked) => handlePreferenceChange('soundNotifications', checked)}
                    />
                  </div>

                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Browser notifications require permission. Make sure to allow notifications for this site.
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Default Filters Tab */}
        <TabsContent value="filters" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Default Filters
              </CardTitle>
              <CardDescription>
                Set default filters that will be applied when you open dashboards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Time Range
                  </Label>
                  <Select
                    value={defaultFilters.timeRange}
                    onValueChange={(value) => handleFilterChange('timeRange', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeRangeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Currency
                  </Label>
                  <Select
                    value={defaultFilters.currency}
                    onValueChange={(value) => handleFilterChange('currency', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currencyOptions.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono">{currency.symbol}</span>
                            {currency.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  These filters will be applied by default to all new dashboard layouts. 
                  You can still change filters for individual sessions.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardPreferencesManager;