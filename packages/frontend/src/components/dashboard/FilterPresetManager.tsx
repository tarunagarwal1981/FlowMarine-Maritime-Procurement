/**
 * Filter Preset Manager Component
 * Manages saved filter presets with sharing and quick access
 */

import React, { useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectFilterPresets,
  addFilterPreset,
  updateFilterPreset,
  deleteFilterPreset,
  selectCurrentConfiguration,
} from '../../store/slices/dashboardSlice';
import {
  useCreateFilterPresetMutation,
  useUpdateFilterPresetMutation,
  useDeleteFilterPresetMutation,
} from '../../store/api/dashboardApi';
import { DashboardFilters, FilterPreset } from '../../types/dashboard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Bookmark,
  Plus,
  Edit,
  Trash2,
  Share,
  Copy,
  MoreHorizontal,
  Star,
  Users,
  Lock,
  Calendar,
  Tag,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '../../utils/cn';

interface FilterPresetManagerProps {
  currentFilters: DashboardFilters;
  layoutType: 'executive' | 'operational' | 'financial';
  onApplyPreset: (preset: FilterPreset) => void;
  className?: string;
}

export const FilterPresetManager: React.FC<FilterPresetManagerProps> = ({
  currentFilters,
  layoutType,
  onApplyPreset,
  className,
}) => {
  const dispatch = useAppDispatch();
  const filterPresets = useAppSelector(selectFilterPresets);
  const currentConfiguration = useAppSelector(selectCurrentConfiguration);

  const [createPreset] = useCreateFilterPresetMutation();
  const [updatePreset] = useUpdateFilterPresetMutation();
  const [deletePreset] = useDeleteFilterPresetMutation();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<FilterPreset | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
    tags: [] as string[],
  });

  const [tagInput, setTagInput] = useState('');

  // Reset form
  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      isPublic: false,
      tags: [],
    });
    setTagInput('');
    setSelectedPreset(null);
  }, []);

  // Handle create preset
  const handleCreatePreset = useCallback(async () => {
    if (!formData.name.trim()) return;

    try {
      const newPreset = await createPreset({
        name: formData.name,
        description: formData.description,
        filters: currentFilters,
        isPublic: formData.isPublic,
        tags: formData.tags,
      }).unwrap();

      dispatch(addFilterPreset(newPreset));
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create filter preset:', error);
    }
  }, [formData, currentFilters, createPreset, dispatch, resetForm]);

  // Handle edit preset
  const handleEditPreset = useCallback(async () => {
    if (!selectedPreset || !formData.name.trim()) return;

    try {
      const updatedPreset = await updatePreset({
        id: selectedPreset.id,
        updates: {
          name: formData.name,
          description: formData.description,
          isPublic: formData.isPublic,
          tags: formData.tags,
        },
      }).unwrap();

      dispatch(updateFilterPreset({
        presetId: selectedPreset.id,
        updates: updatedPreset,
      }));

      setShowEditDialog(false);
      resetForm();
    } catch (error) {
      console.error('Failed to update filter preset:', error);
    }
  }, [selectedPreset, formData, updatePreset, dispatch, resetForm]);

  // Handle delete preset
  const handleDeletePreset = useCallback(async () => {
    if (!selectedPreset) return;

    try {
      await deletePreset(selectedPreset.id).unwrap();
      dispatch(deleteFilterPreset(selectedPreset.id));
      setShowDeleteDialog(false);
      resetForm();
    } catch (error) {
      console.error('Failed to delete filter preset:', error);
    }
  }, [selectedPreset, deletePreset, dispatch, resetForm]);

  // Handle edit click
  const handleEditClick = useCallback((preset: FilterPreset) => {
    setSelectedPreset(preset);
    setFormData({
      name: preset.name,
      description: preset.description || '',
      isPublic: preset.isPublic,
      tags: preset.tags,
    });
    setShowEditDialog(true);
  }, []);

  // Handle delete click
  const handleDeleteClick = useCallback((preset: FilterPreset) => {
    setSelectedPreset(preset);
    setShowDeleteDialog(true);
  }, []);

  // Handle tag input
  const handleTagKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim();
      if (tag && !formData.tags.includes(tag)) {
        setFormData(prev => ({
          ...prev,
          tags: [...prev.tags, tag],
        }));
        setTagInput('');
      }
    }
  }, [tagInput, formData.tags]);

  // Remove tag
  const removeTag = useCallback((tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove),
    }));
  }, []);

  // Get filter summary
  const getFilterSummary = (filters: DashboardFilters) => {
    const parts = [];
    if (filters.vessels?.length) parts.push(`${filters.vessels.length} vessels`);
    if (filters.categories?.length) parts.push(`${filters.categories.length} categories`);
    if (filters.vendors?.length) parts.push(`${filters.vendors.length} vendors`);
    if (filters.timeRange) parts.push(filters.timeRange);
    return parts.join(', ') || 'No filters';
  };

  return (
    <div className={cn("filter-preset-manager", className)}>
      {/* Create preset button */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Save Filters
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Filter Preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Name</Label>
              <Input
                id="preset-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter preset name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preset-description">Description (optional)</Label>
              <Textarea
                id="preset-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe this filter preset"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preset-tags">Tags</Label>
              <div className="space-y-2">
                <Input
                  id="preset-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add tags (press Enter or comma to add)"
                />
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="gap-1 cursor-pointer"
                        onClick={() => removeTag(tag)}
                      >
                        {tag}
                        <Trash2 className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="preset-public">Make public</Label>
              <Switch
                id="preset-public"
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublic: checked }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Current Filters</Label>
              <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                {getFilterSummary(currentFilters)}
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePreset} disabled={!formData.name.trim()}>
                Save Preset
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preset list */}
      <div className="space-y-2 mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Saved Presets</h3>
          <Badge variant="outline" className="text-xs">
            {filterPresets.length}
          </Badge>
        </div>

        <ScrollArea className="h-64">
          <div className="space-y-2">
            {filterPresets.map((preset) => (
              <Card key={preset.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium truncate">{preset.name}</h4>
                      {preset.isPublic ? (
                        <Users className="h-3 w-3 text-muted-foreground" />
                      ) : (
                        <Lock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    
                    {preset.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {preset.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(preset.createdAt), 'MMM dd, yyyy')}
                      <span>•</span>
                      <span>{preset.usageCount} uses</span>
                    </div>

                    {preset.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {preset.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            <Tag className="h-2 w-2 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onApplyPreset(preset)}
                      className="h-8 px-2"
                    >
                      Apply
                    </Button>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditClick(preset)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Share className="h-4 w-4 mr-2" />
                          Share
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(preset)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </Card>
            ))}

            {filterPresets.length === 0 && (
              <div className="text-center py-8">
                <Bookmark className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No saved presets</p>
                <p className="text-xs text-muted-foreground">
                  Save your current filters to create a preset
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Edit dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Filter Preset</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-preset-name">Name</Label>
              <Input
                id="edit-preset-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter preset name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-preset-description">Description (optional)</Label>
              <Textarea
                id="edit-preset-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe this filter preset"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-preset-tags">Tags</Label>
              <div className="space-y-2">
                <Input
                  id="edit-preset-tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Add tags (press Enter or comma to add)"
                />
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {formData.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="gap-1 cursor-pointer"
                        onClick={() => removeTag(tag)}
                      >
                        {tag}
                        <Trash2 className="h-3 w-3" />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="edit-preset-public">Make public</Label>
              <Switch
                id="edit-preset-public"
                checked={formData.isPublic}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPublic: checked }))}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleEditPreset} disabled={!formData.name.trim()}>
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Filter Preset</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedPreset?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePreset} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FilterPresetManager;