/**
 * Dashboard Customizer Component
 * Main interface for customizing dashboard layouts and widgets
 */

import React, { useState, useCallback, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { isMobile } from 'react-device-detect';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectCurrentConfiguration,
  selectIsCustomizing,
  selectSelectedWidget,
  selectUnsavedChanges,
  setCustomizationMode,
  updateLayout,
  addWidget,
  removeWidget,
  updateWidget,
  setSelectedWidget,
  markSaved,
} from '../../store/slices/dashboardSlice';
import { selectUser } from '../../store/slices/authSlice';
import { useUpdateDashboardConfigurationMutation } from '../../store/api/dashboardApi';
import { DashboardWidget, GridLayout, UserRole, ROLE_WIDGET_PERMISSIONS } from '../../types/dashboard';
import { WidgetLibrary } from './WidgetLibrary';
import { WidgetConfigPanel } from './WidgetConfigPanel';
import { DashboardToolbar } from './DashboardToolbar';
import { WidgetRenderer } from './WidgetRenderer';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Alert, AlertDescription } from '../ui/alert';
import { Loader2, Save, X, Eye, Settings, Plus } from 'lucide-react';
import { cn } from '../../utils/cn';

// Responsive grid layout
const ResponsiveGridLayout = WidthProvider(Responsive);

interface DashboardCustomizerProps {
  className?: string;
}

export const DashboardCustomizer: React.FC<DashboardCustomizerProps> = ({
  className
}) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const currentConfiguration = useAppSelector(selectCurrentConfiguration);
  const isCustomizing = useAppSelector(selectIsCustomizing);
  const selectedWidget = useAppSelector(selectSelectedWidget);
  const unsavedChanges = useAppSelector(selectUnsavedChanges);
  
  const [updateConfiguration, { isLoading: isSaving }] = useUpdateDashboardConfigurationMutation();
  
  const [activeTab, setActiveTab] = useState<'executive' | 'operational' | 'financial'>('executive');
  const [showWidgetLibrary, setShowWidgetLibrary] = useState(false);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  
  // Get available widgets for user role
  const availableWidgets = user?.role ? ROLE_WIDGET_PERMISSIONS[user.role] : [];
  
  // Current layout data
  const currentLayout = currentConfiguration?.customLayouts[activeTab];
  const widgets = currentLayout?.widgets || [];
  const gridLayout = currentLayout?.layout || [];

  // Handle layout changes from react-grid-layout
  const handleLayoutChange = useCallback((layout: Layout[]) => {
    if (!isCustomizing) return;
    
    const gridLayout: GridLayout[] = layout.map(item => ({
      i: item.i,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      minW: item.minW,
      minH: item.minH,
      maxW: item.maxW,
      maxH: item.maxH,
      static: item.static,
      isDraggable: item.isDraggable,
      isResizable: item.isResizable,
    }));
    
    dispatch(updateLayout({
      layoutType: activeTab,
      layout: gridLayout,
    }));
  }, [dispatch, activeTab, isCustomizing]);

  // Handle widget selection
  const handleWidgetSelect = useCallback((widget: DashboardWidget) => {
    dispatch(setSelectedWidget(widget));
    setShowConfigPanel(true);
  }, [dispatch]);

  // Handle widget deletion
  const handleWidgetDelete = useCallback((widgetId: string) => {
    dispatch(removeWidget({
      layoutType: activeTab,
      widgetId,
    }));
    if (selectedWidget?.id === widgetId) {
      dispatch(setSelectedWidget(null));
      setShowConfigPanel(false);
    }
  }, [dispatch, activeTab, selectedWidget]);

  // Handle adding widget from library
  const handleAddWidget = useCallback((widgetType: string, position?: { x: number; y: number }) => {
    const newWidget: DashboardWidget = {
      id: `widget-${Date.now()}`,
      type: widgetType as any,
      title: `New ${widgetType.replace(/_/g, ' ')}`,
      dataSource: widgetType,
      configuration: {
        chartType: 'line',
        colors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b'],
        showLegend: true,
        animations: true,
        responsive: true,
      },
      permissions: [],
      size: { width: 4, height: 3 },
      position: position || { x: 0, y: 0 },
      isVisible: true,
    };

    const gridItem: GridLayout = {
      i: newWidget.id,
      x: position?.x || 0,
      y: position?.y || 0,
      w: 4,
      h: 3,
      minW: 2,
      minH: 2,
      isDraggable: true,
      isResizable: true,
    };

    dispatch(addWidget({
      layoutType: activeTab,
      widget: newWidget,
      gridItem,
    }));

    setShowWidgetLibrary(false);
  }, [dispatch, activeTab]);

  // Handle saving configuration
  const handleSave = useCallback(async () => {
    if (!currentConfiguration) return;
    
    try {
      await updateConfiguration({
        id: currentConfiguration.id,
        updates: currentConfiguration,
      }).unwrap();
      
      dispatch(markSaved());
    } catch (error) {
      console.error('Failed to save dashboard configuration:', error);
    }
  }, [currentConfiguration, updateConfiguration, dispatch]);

  // Handle customization mode toggle
  const handleToggleCustomization = useCallback(() => {
    dispatch(setCustomizationMode(!isCustomizing));
    if (isCustomizing) {
      dispatch(setSelectedWidget(null));
      setShowConfigPanel(false);
      setShowWidgetLibrary(false);
    }
  }, [dispatch, isCustomizing]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case 's':
            event.preventDefault();
            if (unsavedChanges) {
              handleSave();
            }
            break;
          case 'e':
            event.preventDefault();
            handleToggleCustomization();
            break;
          case 'Escape':
            if (isCustomizing) {
              dispatch(setSelectedWidget(null));
              setShowConfigPanel(false);
              setShowWidgetLibrary(false);
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [unsavedChanges, isCustomizing, handleSave, handleToggleCustomization, dispatch]);

  if (!currentConfiguration) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading dashboard configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={isMobile ? TouchBackend : HTML5Backend}>
      <div className={cn("dashboard-customizer", className)}>
        {/* Toolbar */}
        <DashboardToolbar
          isCustomizing={isCustomizing}
          unsavedChanges={unsavedChanges}
          onToggleCustomization={handleToggleCustomization}
          onSave={handleSave}
          onShowWidgetLibrary={() => setShowWidgetLibrary(true)}
          isSaving={isSaving}
        />

        {/* Unsaved changes alert */}
        {unsavedChanges && (
          <Alert className="mb-4">
            <AlertDescription>
              You have unsaved changes. Press Ctrl+S to save or click the save button.
            </AlertDescription>
          </Alert>
        )}

        {/* Layout tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="executive">Executive</TabsTrigger>
            <TabsTrigger value="operational">Operational</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="relative">
              {/* Grid Layout */}
              <ResponsiveGridLayout
                className="layout"
                layouts={{ lg: gridLayout }}
                breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                rowHeight={60}
                onLayoutChange={handleLayoutChange}
                isDraggable={isCustomizing}
                isResizable={isCustomizing}
                compactType="vertical"
                preventCollision={false}
                margin={[16, 16]}
                containerPadding={[0, 0]}
              >
                {widgets.filter(w => w.isVisible).map((widget) => (
                  <div
                    key={widget.id}
                    className={cn(
                      "dashboard-widget",
                      isCustomizing && "customizing",
                      selectedWidget?.id === widget.id && "selected"
                    )}
                  >
                    <Card className="h-full relative group">
                      {/* Widget controls (only in customization mode) */}
                      {isCustomizing && (
                        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleWidgetSelect(widget)}
                              className="h-6 w-6 p-0"
                            >
                              <Settings className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleWidgetDelete(widget.id)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Widget content */}
                      <div 
                        className="h-full cursor-pointer"
                        onClick={() => !isCustomizing && handleWidgetSelect(widget)}
                      >
                        <WidgetRenderer
                          widget={widget}
                          isCustomizing={isCustomizing}
                          filters={currentLayout?.filters}
                        />
                      </div>
                    </Card>
                  </div>
                ))}
              </ResponsiveGridLayout>

              {/* Empty state */}
              {widgets.length === 0 && (
                <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <div className="text-center">
                    <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="text-lg font-semibold mb-2">No widgets added</h3>
                    <p className="text-muted-foreground mb-4">
                      Add widgets to customize your dashboard
                    </p>
                    <Button onClick={() => setShowWidgetLibrary(true)}>
                      Add Widget
                    </Button>
                  </div>
                </div>
              )}

              {/* Add widget button (floating) */}
              {isCustomizing && widgets.length > 0 && (
                <Button
                  className="fixed bottom-6 right-6 rounded-full h-12 w-12 p-0 shadow-lg"
                  onClick={() => setShowWidgetLibrary(true)}
                >
                  <Plus className="h-6 w-6" />
                </Button>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Widget Library Modal */}
        {showWidgetLibrary && (
          <WidgetLibrary
            availableWidgets={availableWidgets}
            onAddWidget={handleAddWidget}
            onClose={() => setShowWidgetLibrary(false)}
          />
        )}

        {/* Widget Configuration Panel */}
        {showConfigPanel && selectedWidget && (
          <WidgetConfigPanel
            widget={selectedWidget}
            layoutType={activeTab}
            onClose={() => {
              setShowConfigPanel(false);
              dispatch(setSelectedWidget(null));
            }}
          />
        )}
      </div>
    </DndProvider>
  );
};

export default DashboardCustomizer;