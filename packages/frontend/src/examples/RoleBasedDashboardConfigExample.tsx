/**
 * Role-Based Dashboard Configuration Example
 * Demonstrates the complete role-based dashboard configuration system
 */

import React, { useState, useEffect } from 'react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { RoleBasedDashboardConfig } from '../components/dashboard/RoleBasedDashboardConfig';
import { DragDropLayoutManager } from '../components/dashboard/DragDropLayoutManager';
import { DashboardPreferencesManager } from '../components/dashboard/DashboardPreferencesManager';
import { DashboardTemplateSystem } from '../components/dashboard/DashboardTemplateSystem';
import { DashboardCustomizer } from '../components/dashboard/DashboardCustomizer';
import dashboardReducer, {
  setCurrentConfiguration,
  setConfigurations,
  setTemplates,
  setCustomizationMode,
} from '../store/slices/dashboardSlice';
import authReducer from '../store/slices/authSlice';
import { dashboardApi } from '../store/api/dashboardApi';
import {
  DashboardConfiguration,
  DashboardTemplate,
  UserRole,
  ROLE_WIDGET_PERMISSIONS,
  DEFAULT_DASHBOARD_TEMPLATES,
} from '../types/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import {
  Settings,
  User,
  Layout,
  Palette,
  Shield,
  Eye,
  Edit,
  Play,
  Pause,
  RotateCcw,
  Download,
  Upload,
  Share2,
  Info,
} from 'lucide-react';

// Mock data for demonstration
const createMockUser = (role: UserRole) => ({
  id: `user-${role.toLowerCase()}`,
  email: `${role.toLowerCase()}@vessel.com`,
  firstName: 'John',
  lastName: 'Smith',
  role,
  vessels: ['vessel-1', 'vessel-2'],
  permissions: ['dashboard:read', 'dashboard:write'],
});

const createMockConfiguration = (role: UserRole): DashboardConfiguration => {
  const template = DEFAULT_DASHBOARD_TEMPLATES[role];
  const availableWidgets = ROLE_WIDGET_PERMISSIONS[role];
  
  return {
    id: `config-${role.toLowerCase()}`,
    userId: `user-${role.toLowerCase()}`,
    role,
    name: `${role.replace(/_/g, ' ')} Dashboard`,
    isDefault: true,
    customLayouts: {
      executive: {
        id: `exec-${role.toLowerCase()}`,
        name: 'Executive Overview',
        widgets: availableWidgets.slice(0, 3).map((widgetType, index) => ({
          id: `widget-${index}`,
          type: widgetType as any,
          title: widgetType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          dataSource: widgetType,
          configuration: {
            chartType: 'line',
            colors: ['#3b82f6', '#ef4444', '#10b981'],
            showLegend: true,
            animations: true,
          },
          permissions: [],
          size: { width: 4, height: 3 },
          position: { x: (index % 3) * 4, y: Math.floor(index / 3) * 3 },
          isVisible: true,
        })),
        layout: availableWidgets.slice(0, 3).map((_, index) => ({
          i: `widget-${index}`,
          x: (index % 3) * 4,
          y: Math.floor(index / 3) * 3,
          w: 4,
          h: 3,
          isDraggable: true,
          isResizable: true,
        })),
        filters: { timeRange: 'monthly', currency: 'USD' },
        refreshInterval: 300,
      },
      operational: {
        id: `ops-${role.toLowerCase()}`,
        name: 'Operations',
        widgets: [],
        layout: [],
        filters: { timeRange: 'weekly', currency: 'USD' },
        refreshInterval: 180,
      },
      financial: {
        id: `fin-${role.toLowerCase()}`,
        name: 'Financial',
        widgets: [],
        layout: [],
        filters: { timeRange: 'monthly', currency: 'USD' },
        refreshInterval: 600,
      },
    },
    preferences: {
      defaultTimeRange: 'monthly',
      defaultCurrency: 'USD',
      refreshInterval: 300,
      notifications: true,
      theme: 'light',
      compactMode: false,
      showTooltips: true,
      autoRefresh: true,
      soundNotifications: false,
    },
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-15'),
  };
};

const createMockTemplates = (): DashboardTemplate[] => {
  const roles: UserRole[] = ['CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER'];
  
  return roles.map(role => ({
    id: `template-${role.toLowerCase()}`,
    name: `${role.replace(/_/g, ' ')} Template`,
    description: `Standard template for ${role.replace(/_/g, ' ').toLowerCase()}`,
    role,
    category: 'executive' as const,
    layout: createMockConfiguration(role).customLayouts.executive,
    isPublic: true,
    createdBy: 'admin',
    tags: [role.toLowerCase(), 'standard', 'template'],
    createdAt: new Date('2024-01-01'),
  }));
};

// Mock store setup
const createExampleStore = (currentRole: UserRole) => {
  const user = createMockUser(currentRole);
  const configurations = [createMockConfiguration(currentRole)];
  const templates = createMockTemplates();
  
  return configureStore({
    reducer: {
      auth: authReducer,
      dashboard: dashboardReducer,
      [dashboardApi.reducerPath]: dashboardApi.reducer,
    },
    preloadedState: {
      auth: {
        user,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
      dashboard: {
        configurations,
        currentConfiguration: configurations[0],
        templates,
        filterPresets: [],
        isLoading: false,
        error: null,
        draggedWidget: null,
        selectedWidget: null,
        isCustomizing: false,
        unsavedChanges: false,
      },
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(dashboardApi.middleware),
  });
};

export const RoleBasedDashboardConfigExample: React.FC = () => {
  const [currentRole, setCurrentRole] = useState<UserRole>('CAPTAIN');
  const [activeDemo, setActiveDemo] = useState<'config' | 'drag-drop' | 'preferences' | 'templates' | 'customizer'>('config');
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [store, setStore] = useState(() => createExampleStore(currentRole));

  // Update store when role changes
  useEffect(() => {
    const newStore = createExampleStore(currentRole);
    setStore(newStore);
  }, [currentRole]);

  // Handle customization mode toggle
  const handleToggleCustomization = () => {
    setIsCustomizing(!isCustomizing);
    store.dispatch(setCustomizationMode(!isCustomizing));
  };

  // Role options
  const roleOptions: { value: UserRole; label: string; description: string }[] = [
    { value: 'VESSEL_CREW', label: 'Vessel Crew', description: 'Basic operational access' },
    { value: 'CHIEF_ENGINEER', label: 'Chief Engineer', description: 'Engineering and maintenance focus' },
    { value: 'CAPTAIN', label: 'Captain', description: 'Vessel command and oversight' },
    { value: 'SUPERINTENDENT', label: 'Superintendent', description: 'Fleet management and coordination' },
    { value: 'PROCUREMENT_MANAGER', label: 'Procurement Manager', description: 'Procurement operations and analytics' },
    { value: 'FINANCE_TEAM', label: 'Finance Team', description: 'Financial analysis and reporting' },
    { value: 'ADMIN', label: 'Administrator', description: 'Full system access and management' },
  ];

  const currentRoleInfo = roleOptions.find(r => r.value === currentRole);
  const availableWidgets = ROLE_WIDGET_PERMISSIONS[currentRole];

  return (
    <Provider store={store}>
      <DndProvider backend={HTML5Backend}>
        <div className="role-based-dashboard-example p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Role-Based Dashboard Configuration</h1>
              <p className="text-muted-foreground">
                Interactive demonstration of role-based dashboard customization system
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                Demo Mode
              </Badge>
              <Button variant="outline" onClick={() => window.location.reload()}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset Demo
              </Button>
            </div>
          </div>

          {/* Role Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Role Selection
              </CardTitle>
              <CardDescription>
                Select a user role to see how dashboard configuration changes based on permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role-select">Current Role</Label>
                  <Select value={currentRole} onValueChange={(value) => setCurrentRole(value as UserRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          <div>
                            <div className="font-medium">{role.label}</div>
                            <div className="text-sm text-muted-foreground">{role.description}</div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Role Information</Label>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{currentRoleInfo?.label}</span>
                      <Badge variant="secondary">{availableWidgets.length} widgets</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{currentRoleInfo?.description}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Demo Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Demo Controls
              </CardTitle>
              <CardDescription>
                Control the demonstration and explore different features
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="customization-mode"
                    checked={isCustomizing}
                    onCheckedChange={handleToggleCustomization}
                  />
                  <Label htmlFor="customization-mode">Customization Mode</Label>
                </div>

                <Separator orientation="vertical" className="h-6" />

                <div className="flex items-center gap-2">
                  <Button
                    variant={activeDemo === 'config' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveDemo('config')}
                  >
                    <Layout className="h-4 w-4 mr-2" />
                    Configuration
                  </Button>
                  <Button
                    variant={activeDemo === 'drag-drop' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveDemo('drag-drop')}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Drag & Drop
                  </Button>
                  <Button
                    variant={activeDemo === 'preferences' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveDemo('preferences')}
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Preferences
                  </Button>
                  <Button
                    variant={activeDemo === 'templates' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveDemo('templates')}
                  >
                    <Palette className="h-4 w-4 mr-2" />
                    Templates
                  </Button>
                  <Button
                    variant={activeDemo === 'customizer' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveDemo('customizer')}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Full Customizer
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Feature Showcase */}
          <div className="grid gap-6">
            {activeDemo === 'config' && (
              <Card>
                <CardHeader>
                  <CardTitle>Role-Based Configuration Management</CardTitle>
                  <CardDescription>
                    Manage dashboard configurations with role-based permissions and templates
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RoleBasedDashboardConfig />
                </CardContent>
              </Card>
            )}

            {activeDemo === 'drag-drop' && (
              <Card>
                <CardHeader>
                  <CardTitle>Drag & Drop Layout Manager</CardTitle>
                  <CardDescription>
                    Interactive widget layout management with drag-and-drop functionality
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DragDropLayoutManager
                    layoutType="executive"
                    onWidgetSelect={(widget) => console.log('Widget selected:', widget)}
                    onWidgetDelete={(widgetId) => console.log('Widget deleted:', widgetId)}
                    onAddWidget={(widgetType, position) => console.log('Widget added:', widgetType, position)}
                  />
                </CardContent>
              </Card>
            )}

            {activeDemo === 'preferences' && (
              <Card>
                <CardHeader>
                  <CardTitle>Dashboard Preferences Manager</CardTitle>
                  <CardDescription>
                    Personalized dashboard preferences and default settings
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DashboardPreferencesManager />
                </CardContent>
              </Card>
            )}

            {activeDemo === 'templates' && (
              <Card>
                <CardHeader>
                  <CardTitle>Dashboard Template System</CardTitle>
                  <CardDescription>
                    Template management for quick dashboard setup and sharing
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DashboardTemplateSystem />
                </CardContent>
              </Card>
            )}

            {activeDemo === 'customizer' && (
              <Card>
                <CardHeader>
                  <CardTitle>Complete Dashboard Customizer</CardTitle>
                  <CardDescription>
                    Full dashboard customization interface with all features integrated
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DashboardCustomizer />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Role Permissions Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Role Permissions Overview
              </CardTitle>
              <CardDescription>
                Compare widget access across different user roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {roleOptions.map((role) => {
                  const widgets = ROLE_WIDGET_PERMISSIONS[role.value];
                  const isCurrentRole = role.value === currentRole;
                  
                  return (
                    <div
                      key={role.value}
                      className={`p-4 rounded-lg border ${
                        isCurrentRole ? 'border-primary bg-primary/5' : 'border-muted'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{role.label}</span>
                          {isCurrentRole && (
                            <Badge variant="default" className="text-xs">Current</Badge>
                          )}
                        </div>
                        <Badge variant="outline">{widgets.length} widgets</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {widgets.slice(0, 8).map((widget) => (
                          <Badge key={widget} variant="secondary" className="text-xs">
                            {widget.replace(/_/g, ' ')}
                          </Badge>
                        ))}
                        {widgets.length > 8 && (
                          <Badge variant="outline" className="text-xs">
                            +{widgets.length - 8} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Feature Highlights */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Role-Based Access</h3>
                    <p className="text-sm text-muted-foreground">
                      Widget permissions based on user roles
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Layout className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Drag & Drop</h3>
                    <p className="text-sm text-muted-foreground">
                      Intuitive widget layout management
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Palette className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Templates</h3>
                    <p className="text-sm text-muted-foreground">
                      Quick setup with predefined layouts
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <Settings className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Preferences</h3>
                    <p className="text-sm text-muted-foreground">
                      Personalized dashboard settings
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DndProvider>
    </Provider>
  );
};

export default RoleBasedDashboardConfigExample;