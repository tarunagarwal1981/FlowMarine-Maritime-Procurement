/**
 * Dashboard Template System
 * Manages dashboard templates for quick setup and role-based configurations
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectTemplates,
  selectCurrentConfiguration,
  setTemplates,
  applyTemplate,
  createConfiguration,
} from '../../store/slices/dashboardSlice';
import { selectUser } from '../../store/slices/authSlice';
import {
  useGetDashboardTemplatesQuery,
  useCreateDashboardTemplateMutation,
  useUpdateDashboardTemplateMutation,
  useDeleteDashboardTemplateMutation,
  useCreateDashboardConfigurationMutation,
} from '../../store/api/dashboardApi';
import {
  DashboardTemplate,
  DashboardLayout,
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
import { ScrollArea } from '../ui/scroll-area';
import {
  Palette,
  Plus,
  Copy,
  Trash2,
  Download,
  Upload,
  Share2,
  Star,
  StarOff,
  Eye,
  Edit,
  Save,
  X,
  Check,
  AlertTriangle,
  Info,
  Layout,
  Users,
  Globe,
  Lock,
  Unlock,
  Tag,
  Search,
  Filter,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface DashboardTemplateSystemProps {
  className?: string;
}

export const DashboardTemplateSystem: React.FC<DashboardTemplateSystemProps> = ({
  className
}) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const templates = useAppSelector(selectTemplates);
  const currentConfiguration = useAppSelector(selectCurrentConfiguration);

  // API hooks
  const { data: templatesData, refetch: refetchTemplates } = useGetDashboardTemplatesQuery();
  const [createTemplate, { isLoading: isCreating }] = useCreateDashboardTemplateMutation();
  const [updateTemplate, { isLoading: isUpdating }] = useUpdateDashboardTemplateMutation();
  const [deleteTemplate, { isLoading: isDeleting }] = useDeleteDashboardTemplateMutation();
  const [createConfiguration, { isLoading: isCreatingConfig }] = useCreateDashboardConfigurationMutation();

  // Local state
  const [activeTab, setActiveTab] = useState<'browse' | 'my-templates' | 'create'>('browse');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<DashboardTemplate | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'usage'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Form state
  const [templateForm, setTemplateForm] = useState({
    name: '',
    description: '',
    category: 'custom' as 'executive' | 'operational' | 'financial' | 'custom',
    isPublic: false,
    tags: [] as string[],
    newTag: '',
  });

  // Get user's role and available widgets
  const userRole = user?.role || 'VESSEL_CREW';
  const availableWidgets = ROLE_WIDGET_PERMISSIONS[userRole] || [];

  // Load templates on mount
  useEffect(() => {
    if (templatesData) {
      dispatch(setTemplates(templatesData));
    }
  }, [templatesData, dispatch]);

  // Filter and sort templates
  const filteredTemplates = templates
    .filter(template => {
      // Search filter
      if (searchQuery && !template.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !template.description.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Role filter
      if (selectedRole !== 'all' && template.role !== selectedRole && !template.isPublic) {
        return false;
      }
      
      // Category filter
      if (selectedCategory !== 'all' && template.category !== selectedCategory) {
        return false;
      }
      
      // Favorites filter
      if (showFavoritesOnly) {
        // TODO: Implement favorites functionality
        return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created':
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
        case 'usage':
          // TODO: Implement usage tracking
          comparison = 0;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

  // Get user's templates
  const userTemplates = templates.filter(template => template.createdBy === user?.id);

  // Handle create template
  const handleCreateTemplate = useCallback(async () => {
    if (!templateForm.name.trim() || !currentConfiguration) return;

    try {
      const newTemplate: Omit<DashboardTemplate, 'id' | 'createdAt'> = {
        name: templateForm.name,
        description: templateForm.description,
        role: userRole,
        category: templateForm.category,
        layout: currentConfiguration.customLayouts.executive, // Use current executive layout as template
        isPublic: templateForm.isPublic,
        createdBy: user?.id || '',
        tags: templateForm.tags,
      };

      await createTemplate(newTemplate).unwrap();
      
      setShowCreateDialog(false);
      setTemplateForm({
        name: '',
        description: '',
        category: 'custom',
        isPublic: false,
        tags: [],
        newTag: '',
      });
      
      refetchTemplates();
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  }, [templateForm, currentConfiguration, userRole, user?.id, createTemplate, refetchTemplates]);

  // Handle apply template
  const handleApplyTemplate = useCallback(async (template: DashboardTemplate, layoutType: 'executive' | 'operational' | 'financial') => {
    if (!currentConfiguration) {
      // Create new configuration from template
      try {
        await createConfiguration({
          name: `${template.name} Configuration`,
          role: userRole,
          basedOn: template.id,
        }).unwrap();
      } catch (error) {
        console.error('Failed to create configuration from template:', error);
      }
      return;
    }

    dispatch(applyTemplate({
      templateId: template.id,
      layoutType,
    }));
  }, [currentConfiguration, userRole, createConfiguration, dispatch]);

  // Handle delete template
  const handleDeleteTemplate = useCallback(async () => {
    if (!selectedTemplate) return;

    try {
      await deleteTemplate(selectedTemplate.id).unwrap();
      setShowDeleteDialog(false);
      setSelectedTemplate(null);
      refetchTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  }, [selectedTemplate, deleteTemplate, refetchTemplates]);

  // Handle add tag
  const handleAddTag = useCallback(() => {
    if (templateForm.newTag.trim() && !templateForm.tags.includes(templateForm.newTag.trim())) {
      setTemplateForm(prev => ({
        ...prev,
        tags: [...prev.tags, prev.newTag.trim()],
        newTag: '',
      }));
    }
  }, [templateForm.newTag, templateForm.tags]);

  // Handle remove tag
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    setTemplateForm(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  }, []);

  // Template categories
  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'executive', label: 'Executive' },
    { value: 'operational', label: 'Operational' },
    { value: 'financial', label: 'Financial' },
    { value: 'custom', label: 'Custom' },
  ];

  // Role options
  const roleOptions = [
    { value: 'all', label: 'All Roles' },
    { value: 'VESSEL_CREW', label: 'Vessel Crew' },
    { value: 'CHIEF_ENGINEER', label: 'Chief Engineer' },
    { value: 'CAPTAIN', label: 'Captain' },
    { value: 'SUPERINTENDENT', label: 'Superintendent' },
    { value: 'PROCUREMENT_MANAGER', label: 'Procurement Manager' },
    { value: 'FINANCE_TEAM', label: 'Finance Team' },
    { value: 'ADMIN', label: 'Administrator' },
  ];

  return (
    <div className={cn("dashboard-template-system space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard Templates</h2>
          <p className="text-muted-foreground">
            Browse, create, and manage dashboard templates for quick setup
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="browse" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Browse Templates
          </TabsTrigger>
          <TabsTrigger value="my-templates" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            My Templates ({userTemplates.length})
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create New
          </TabsTrigger>
        </TabsList>

        {/* Browse Templates Tab */}
        <TabsContent value="browse" className="space-y-4">
          {/* Search and Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                {/* Search bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search templates..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4">
                  <Select value={selectedRole} onValueChange={(value) => setSelectedRole(value as any)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="created">Created</SelectItem>
                      <SelectItem value="usage">Usage</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  >
                    {sortOrder === 'asc' ? (
                      <SortAsc className="h-4 w-4" />
                    ) : (
                      <SortDesc className="h-4 w-4" />
                    )}
                  </Button>

                  <Button
                    variant={showFavoritesOnly ? "default" : "outline"}
                    size="sm"
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  >
                    <Star className="h-4 w-4 mr-2" />
                    Favorites
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Templates Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTemplates.map((template) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base line-clamp-1">{template.name}</CardTitle>
                      <CardDescription className="text-sm line-clamp-2 mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      {template.isPublic ? (
                        <Globe className="h-4 w-4 text-green-600" title="Public template" />
                      ) : (
                        <Lock className="h-4 w-4 text-muted-foreground" title="Private template" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Toggle favorite
                        }}
                      >
                        <StarOff className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {/* Template info */}
                    <div className="flex items-center justify-between text-sm">
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {template.role.replace(/_/g, ' ')}
                      </Badge>
                    </div>

                    {/* Tags */}
                    {template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                        {template.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    <Separator />

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTemplate(template);
                          setShowPreviewDialog(true);
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyTemplate(template, 'executive');
                        }}
                        disabled={!currentConfiguration}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Empty state */}
            {filteredTemplates.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Palette className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No templates found</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Try adjusting your search criteria or create a new template
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* My Templates Tab */}
        <TabsContent value="my-templates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {userTemplates.map((template) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="text-sm mt-1">
                        {template.description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTemplate(template);
                          setShowEditDialog(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTemplate(template);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {template.category}
                      </Badge>
                      {template.isPublic ? (
                        <Badge variant="default" className="text-xs">
                          <Globe className="h-3 w-3 mr-1" />
                          Public
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          <Lock className="h-3 w-3 mr-1" />
                          Private
                        </Badge>
                      )}
                    </div>

                    <Separator />

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: Share template
                        }}
                      >
                        <Share2 className="h-3 w-3 mr-1" />
                        Share
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleApplyTemplate(template, 'executive');
                        }}
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Empty state */}
            {userTemplates.length === 0 && (
              <Card className="col-span-full">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No templates created</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Create your first template to save and share dashboard layouts
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* Create New Tab */}
        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create New Template</CardTitle>
              <CardDescription>
                Save your current dashboard layout as a template for future use
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!currentConfiguration ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    You need to have an active dashboard configuration to create a template.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="template-name">Template Name</Label>
                      <Input
                        id="template-name"
                        value={templateForm.name}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter template name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="template-category">Category</Label>
                      <Select
                        value={templateForm.category}
                        onValueChange={(value) => setTemplateForm(prev => ({ ...prev, category: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="executive">Executive</SelectItem>
                          <SelectItem value="operational">Operational</SelectItem>
                          <SelectItem value="financial">Financial</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="template-description">Description</Label>
                    <Textarea
                      id="template-description"
                      value={templateForm.description}
                      onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe what this template is for..."
                      rows={3}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {templateForm.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-4 p-0 ml-1 hover:bg-transparent"
                            onClick={() => handleRemoveTag(tag)}
                          >
                            <X className="h-2 w-2" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value={templateForm.newTag}
                        onChange={(e) => setTemplateForm(prev => ({ ...prev, newTag: e.target.value }))}
                        placeholder="Add a tag..."
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      />
                      <Button variant="outline" onClick={handleAddTag}>
                        <Tag className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Make Public</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow other users to use this template
                      </p>
                    </div>
                    <Switch
                      checked={templateForm.isPublic}
                      onCheckedChange={(checked) => setTemplateForm(prev => ({ ...prev, isPublic: checked }))}
                    />
                  </div>

                  <Button
                    onClick={handleCreateTemplate}
                    disabled={!templateForm.name.trim() || isCreating}
                    className="w-full"
                  >
                    {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Template
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Template</DialogTitle>
            <DialogDescription>
              Save your current dashboard layout as a reusable template
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dialog-template-name">Template Name</Label>
              <Input
                id="dialog-template-name"
                value={templateForm.name}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter template name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dialog-template-description">Description</Label>
              <Textarea
                id="dialog-template-description"
                value={templateForm.description}
                onChange={(e) => setTemplateForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe this template..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTemplate} disabled={!templateForm.name.trim() || isCreating}>
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Template Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedTemplate?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTemplate}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Template Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.description}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-96">
            {selectedTemplate && (
              <div className="space-y-4">
                {/* Template info */}
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{selectedTemplate.category}</Badge>
                  <Badge variant="secondary">{selectedTemplate.role.replace(/_/g, ' ')}</Badge>
                  {selectedTemplate.isPublic && (
                    <Badge variant="default">
                      <Globe className="h-3 w-3 mr-1" />
                      Public
                    </Badge>
                  )}
                </div>

                {/* Tags */}
                {selectedTemplate.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {selectedTemplate.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <Separator />

                {/* Template preview */}
                <div className="border rounded-lg p-4 bg-muted/50">
                  <p className="text-sm text-muted-foreground text-center">
                    Template preview would be rendered here
                  </p>
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
            <Button
              onClick={() => {
                if (selectedTemplate) {
                  handleApplyTemplate(selectedTemplate, 'executive');
                  setShowPreviewDialog(false);
                }
              }}
              disabled={!currentConfiguration}
            >
              Apply Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardTemplateSystem;