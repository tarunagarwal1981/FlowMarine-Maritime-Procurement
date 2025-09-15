/**
 * Role-Based Dashboard Configuration Component
 * Manages dashboard configurations based on user roles with templates and permissions
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectCurrentConfiguration,
  selectConfigurations,
  selectTemplates,
  selectDashboardLoading,
  selectDashboardError,
  setCurrentConfiguration,
  createConfiguration,
  updateConfiguration,
  deleteConfiguration,
  setTemplates,
  applyTemplate,
  resetToDefaults,
  clearError,
} from '../../store/slices/dashboardSlice';
import { selectUser } from '../../store/slices/authSlice';
import {
  useGetDashboardConfigurationsQuery,
  useGetDashboardTemplatesQuery,
  useCreateDashboardConfigurationMutation,
  useUpdateDashboardConfigurationMutation,
  useDeleteDashboardConfigurationMutation,
} from '../../store/api/dashboardApi';
import {
  DashboardConfiguration,
  DashboardTemplate,
  UserRole,
  ROLE_WIDGET_PERMISSIONS,
  DEFAULT_DASHBOARD_TEMPLATES,
} from '../../types/dashboard';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import {
  Settings,
  Plus,
  Copy,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  User,
  Shield,
  Layout,
  Palette,
  Save,
  X,
  Check,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface RoleBasedDashboardConfigProps {
  className?: string;
}

export const RoleBasedDashboardConfig: React.FC<RoleBasedDashboardConfigProps> = ({
  className
}) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const currentConfiguration = useAppSelector(selectCurrentConfiguration);
  const configurations = useAppSelector(selectConfigurations);
  const templates = useAppSelector(selectTemplates);
  const isLoading = useAppSelector(selectDashboardLoading);
  const error = useAppSelector(selectDashboardError);

  // API hooks
  const { data: configurationsData, refetch: refetchConfigurations } = useGetDashboardConfigurationsQuery();
  const { data: templatesData } = useGetDashboardTemplatesQuery();
  const [createConfig, { isLoading: isCreating }] = useCreateDashboardConfigurationMutation();
  const [updateConfig, { isLoading: isUpdating }] = useUpdateDashboardConfigurationMutation();
  const [deleteConfig, { isLoading: isDeleting }] = useDeleteDashboardConfigurationMutation();

  // Local state
  const [activeTab, setActiveTab] = useState<'configurations' | 'templates' | 'permissions'>('configurations');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<DashboardConfiguration | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DashboardTemplate | null>(null);
  
  // Form state
  const [configForm, setConfigForm] = useState({
    name: '',
    description: '',
    basedOnTemplate: '',
    isDefault: false,
  });

  // Get user's role and available widgets
  const userRole = user?.role || 'VESSEL_CREW';
  const availableWidgets = ROLE_WIDGET_PERMISSIONS[userRole] || [];
  const userConfigurations = configurations.filter(config => config.role === userRole);

  // Load data on mount
  useEffect(() => {
    if (configurationsData) {
      dispatch(setConfigurations(configurationsData));
    }
  }, [configurationsData, dispatch]);

  useEffect(() => {
    if (templatesData) {
      dispatch(setTemplates(templatesData));
    }
  }, [templatesData, dispatch]);

  // Handle configuration selection
  const handleSelectConfiguration = useCallback((config: DashboardConfiguration) => {
    dispatch(setCurrentConfiguration(config));
  }, [dispatch]);

  // Handle create configuration
  const handleCreateConfiguration = useCallback(async () => {
    if (!configForm.name.trim()) return;

    try {
      const newConfig = await createConfig({
        name: configForm.name,
        role: userRole,
        basedOn: configForm.basedOnTemplate || undefined,
        isDefault: configForm.isDefault,
      }).unwrap();

      dispatch(createConfiguration({
        name: configForm.name,
        role: userRole,
        basedOn: configForm.basedOnTemplate || undefined,
      }));

      setShowCreateDialog(false);
      setConfigForm({ name: '', description: '', basedOnTemplate: '', isDefault: false });
      refetchConfigurations();
    } catch (error) {
      console.error('Failed to create configuration:', error);
    }
  }, [configForm, userRole, createConfig, dispatch, refetchConfigurations]);

  // Handle delete configuration
  const handleDeleteConfiguration = useCallback(async () => {
    if (!selectedConfig) return;

    try {
      await deleteConfig(selectedConfig.id).unwrap();
      dispatch(deleteConfiguration(selectedConfig.id));
      setShowDeleteDialog(false);
      setSelectedConfig(null);
      refetchConfigurations();
    } catch (error) {
      console.error('Failed to delete configuration:', error);
    }
  }, [selectedConfig, deleteConfig, dispatch, refetchConfigurations]);

  // Handle apply template
  const handleApplyTemplate = useCallback(async (template: DashboardTemplate, layoutType: 'executive' | 'operational' | 'financial') => {
    if (!currentConfiguration) return;

    try {
      dispatch(applyTemplate({
        templateId: template.id,
        layoutType,
      }));

      await updateConfig({
        id: currentConfiguration.id,
        updates: currentConfiguration,
      }).unwrap();

      setShowTemplateDialog(false);
    } catch (error) {
      console.error('Failed to apply template:', error);
    }
  }, [currentConfiguration, dispatch, updateConfig]);

  // Handle reset to defaults
  const handleResetToDefaults = useCallback(async () => {
    if (!currentConfiguration) return;

    try {
      dispatch(resetToDefaults(userRole));
      
      await updateConfig({
        id: currentConfiguration.id,
        updates: currentConfiguration,
      }).unwrap();
    } catch (error) {
      console.error('Failed to reset to defaults:', error);
    }
  }, [currentConfiguration, userRole, dispatch, updateConfig]);

  // Get role-specific templates
  const roleTemplates = templates.filter(template => 
    template.role === userRole || template.isPublic
  );

  // Get widget count for each layout
  const getWidgetCount = (config: DashboardConfiguration) => {
    const executive = config.customLayouts.executive.widgets.filter(w => w.isVisible).length;
    const operational = config.customLayouts.operational.widgets.filter(w => w.isVisible).length;
    const financial = config.customLayouts.financial.widgets.filter(w => w.isVisible).length;
    return { executive, operational, financial, total: executive + operational + financial };
  };

  return (
    <div className={cn("role-based-dashboard-config space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Configuration</h2>
          <p className="text-muted-foreground">
            Manage your dashboard layouts and preferences for {userRole.replace(/_/g, ' ').toLowerCase()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {userRole.replace(/_/g, ' ')}
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            {availableWidgets.length} widgets available
          </Badge>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch(clearError())}
              className="ml-2"
            >
              <X className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="configurations" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            Configurations
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Permissions
          </TabsTrigger>
        </TabsList>

        {/* Configurations Tab */}
        <TabsContent value="configurations" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Your Dashboard Configurations</h3>
            <Button onClick={() => setShowCreateDialog(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Configuration
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {userConfigurations.map((config) => {
              const widgetCounts = getWidgetCount(config);
              const isActive = currentConfiguration?.id === config.id;

              return (
                <Card
                  key={config.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-md",
                    isActive && "ring-2 ring-primary"
                  )}
                  onClick={() => handleSelectConfiguration(config)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{config.name}</CardTitle>
                      {config.isDefault && (
                        <Badge variant="default" className="text-xs">Default</Badge>
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      Last updated {new Date(config.updatedAt).toLocaleDateString()}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {/* Widget counts */}
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div className="text-center">
                          <div className="font-medium">{widgetCounts.executive}</div>
                          <div className="text-muted-foreground">Executive</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{widgetCounts.operational}</div>
                          <div className="text-muted-foreground">Operational</div>
                        </div>
                        <div className="text-center">
                          <div className="font-medium">{widgetCounts.financial}</div>
                          <div className="text-muted-foreground">Financial</div>
                        </div>
                      </div>

                      <Separator />

                      {/* Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Handle duplicate
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedConfig(config);
                              setShowDeleteDialog(true);
                            }}
                            disabled={config.isDefault}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {isActive && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Empty state */}
            {userConfigurations.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Layout className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No configurations found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first dashboard configuration to get started
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Configuration
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Available Templates</h3>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {roleTemplates.map((template) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <div className="flex items-center gap-1">
                      {template.isPublic && (
                        <Badge variant="secondary" className="text-xs">Public</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription className="text-sm">
                    {template.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {/* Template tags */}
                    {template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Separator />

                    {/* Apply template button */}
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowTemplateDialog(true);
                      }}
                      disabled={!currentConfiguration}
                    >
                      Apply Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Permissions Tab */}
        <TabsContent value="permissions" className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">Role-Based Widget Permissions</h3>
            <p className="text-muted-foreground">
              Your role ({userRole.replace(/_/g, ' ')}) has access to the following widget types:
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableWidgets.map((widgetType) => (
              <Card key={widgetType}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                      <Layout className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">
                        {widgetType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Widget type: {widgetType}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Role comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role Comparison</CardTitle>
              <CardDescription>
                See what widgets are available for different roles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(ROLE_WIDGET_PERMISSIONS).map(([role, widgets]) => (
                  <div key={role} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={role === userRole ? "default" : "outline"}>
                        {role.replace(/_/g, ' ')}
                      </Badge>
                      {role === userRole && (
                        <Badge variant="secondary" className="text-xs">Your Role</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {widgets.length} widgets
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Configuration Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Configuration</DialogTitle>
            <DialogDescription>
              Create a new dashboard configuration for your role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="config-name">Configuration Name</Label>
              <Input
                id="config-name"
                value={configForm.name}
                onChange={(e) => setConfigForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter configuration name"
              />
            </div>
            <div>
              <Label htmlFor="config-template">Based on Template (Optional)</Label>
              <Select
                value={configForm.basedOnTemplate}
                onValueChange={(value) => setConfigForm(prev => ({ ...prev, basedOnTemplate: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No template</SelectItem>
                  {roleTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConfiguration} disabled={isCreating || !configForm.name.trim()}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Apply Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply Template</DialogTitle>
            <DialogDescription>
              Choose which layout to apply the template to
            </DialogDescription>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium">{selectedTemplate.name}</h4>
                <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
              </div>
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleApplyTemplate(selectedTemplate, 'executive')}
                  className="justify-start"
                >
                  Apply to Executive Layout
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleApplyTemplate(selectedTemplate, 'operational')}
                  className="justify-start"
                >
                  Apply to Operational Layout
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleApplyTemplate(selectedTemplate, 'financial')}
                  className="justify-start"
                >
                  Apply to Financial Layout
                </Button>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Configuration Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Configuration</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedConfig?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfiguration}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RoleBasedDashboardConfig;