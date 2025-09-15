/**
 * Dashboard Toolbar Component
 * Toolbar with customization controls and actions
 */

import React from 'react';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Save,
  Eye,
  Settings,
  Plus,
  Download,
  Share,
  Copy,
  MoreHorizontal,
  Loader2,
  Undo,
  Redo,
} from 'lucide-react';

interface DashboardToolbarProps {
  isCustomizing: boolean;
  unsavedChanges: boolean;
  onToggleCustomization: () => void;
  onSave: () => void;
  onShowWidgetLibrary: () => void;
  isSaving?: boolean;
  onExport?: () => void;
  onShare?: () => void;
  onClone?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export const DashboardToolbar: React.FC<DashboardToolbarProps> = ({
  isCustomizing,
  unsavedChanges,
  onToggleCustomization,
  onSave,
  onShowWidgetLibrary,
  isSaving = false,
  onExport,
  onShare,
  onClone,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}) => {
  return (
    <div className="dashboard-toolbar flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-4">
        {/* Mode toggle */}
        <div className="flex items-center gap-2">
          <Button
            variant={isCustomizing ? "default" : "outline"}
            size="sm"
            onClick={onToggleCustomization}
            className="gap-2"
          >
            {isCustomizing ? (
              <>
                <Eye className="h-4 w-4" />
                Preview
              </>
            ) : (
              <>
                <Settings className="h-4 w-4" />
                Customize
              </>
            )}
          </Button>
          
          {unsavedChanges && (
            <Badge variant="secondary" className="text-xs">
              Unsaved
            </Badge>
          )}
        </div>

        <Separator orientation="vertical" className="h-6" />

        {/* Customization controls */}
        {isCustomizing && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onShowWidgetLibrary}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Widget
            </Button>

            {/* Undo/Redo */}
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={onUndo}
                disabled={!canUndo}
                className="h-8 w-8 p-0"
                title="Undo (Ctrl+Z)"
              >
                <Undo className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onRedo}
                disabled={!canRedo}
                className="h-8 w-8 p-0"
                title="Redo (Ctrl+Y)"
              >
                <Redo className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Save button */}
        <Button
          variant="default"
          size="sm"
          onClick={onSave}
          disabled={!unsavedChanges || isSaving}
          className="gap-2"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Save
        </Button>

        {/* More actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onExport} className="gap-2">
              <Download className="h-4 w-4" />
              Export Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShare} className="gap-2">
              <Share className="h-4 w-4" />
              Share Dashboard
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onClone} className="gap-2">
              <Copy className="h-4 w-4" />
              Clone Dashboard
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-muted-foreground">
              <Settings className="h-4 w-4" />
              Dashboard Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default DashboardToolbar;