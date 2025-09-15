/**
 * Drag and Drop Layout Manager
 * Advanced drag-and-drop functionality for dashboard widget layout customization
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DndProvider, useDrag, useDrop, DragPreviewImage } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { TouchBackend } from 'react-dnd-touch-backend';
import { isMobile } from 'react-device-detect';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import {
  selectCurrentConfiguration,
  selectIsCustomizing,
  selectDraggedWidget,
  updateLayout,
  addWidget,
  removeWidget,
  setDraggedWidget,
  updateWidget,
} from '../../store/slices/dashboardSlice';
import { selectUser } from '../../store/slices/authSlice';
import {
  DashboardWidget,
  GridLayout,
  WidgetType,
  ROLE_WIDGET_PERMISSIONS,
} from '../../types/dashboard';
import { WidgetRenderer } from './WidgetRenderer';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  GripVertical,
  Move,
  Copy,
  Trash2,
  Settings,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Maximize2,
  Minimize2,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../../utils/cn';

// Responsive grid layout
const ResponsiveGridLayout = WidthProvider(Responsive);

// Drag item types
const ItemTypes = {
  WIDGET: 'widget',
  WIDGET_FROM_LIBRARY: 'widget_from_library',
};

interface DragItem {
  type: string;
  id: string;
  widgetType?: WidgetType;
  widget?: DashboardWidget;
  index?: number;
}

interface DropResult {
  name: string;
  position?: { x: number; y: number };
}

// Draggable Widget Component
interface DraggableWidgetProps {
  widget: DashboardWidget;
  layoutType: 'executive' | 'operational' | 'financial';
  isCustomizing: boolean;
  onSelect: (widget: DashboardWidget) => void;
  onDelete: (widgetId: string) => void;
  onToggleVisibility: (widgetId: string) => void;
  onToggleLock: (widgetId: string) => void;
  onDuplicate: (widget: DashboardWidget) => void;
  filters?: any;
}

const DraggableWidget: React.FC<DraggableWidgetProps> = ({
  widget,
  layoutType,
  isCustomizing,
  onSelect,
  onDelete,
  onToggleVisibility,
  onToggleLock,
  onDuplicate,
  filters,
}) => {
  const dispatch = useAppDispatch();
  const draggedWidget = useAppSelector(selectDraggedWidget);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragPreview, setIsDragPreview] = useState(false);

  const [{ isDragging }, drag, preview] = useDrag({
    type: ItemTypes.WIDGET,
    item: (): DragItem => {
      dispatch(setDraggedWidget(widget));
      return {
        type: ItemTypes.WIDGET,
        id: widget.id,
        widget,
      };
    },
    end: () => {
      dispatch(setDraggedWidget(null));
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: [ItemTypes.WIDGET, ItemTypes.WIDGET_FROM_LIBRARY],
    drop: (item: DragItem, monitor): DropResult => {
      if (!monitor.didDrop()) {
        return { name: 'widget-container' };
      }
      return { name: 'widget-container' };
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // Get grid item for this widget
  const currentConfiguration = useAppSelector(selectCurrentConfiguration);
  const gridItem = currentConfiguration?.customLayouts[layoutType]?.layout.find(
    item => item.i === widget.id
  );

  const isLocked = gridItem?.static || false;
  const opacity = isDragging ? 0.5 : 1;

  return (
    <div
      ref={(node) => {
        if (isCustomizing) {
          drag(drop(node));
        }
      }}
      style={{ opacity }}
      className={cn(
        "dashboard-widget relative group transition-all duration-200",
        isCustomizing && "cursor-move",
        isDragging && "z-50",
        isOver && "ring-2 ring-primary/50",
        !widget.isVisible && "opacity-50"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <DragPreviewImage connect={preview} src="/widget-preview.png" />
      
      <Card className={cn(
        "h-full relative overflow-hidden",
        isCustomizing && isHovered && "shadow-lg",
        !widget.isVisible && "border-dashed"
      )}>
        {/* Widget Controls Overlay */}
        {isCustomizing && (isHovered || isDragging) && (
          <div className="absolute inset-0 bg-black/5 z-10 flex items-start justify-between p-2">
            {/* Drag handle */}
            <div className="flex items-center gap-1">
              <div className="bg-white/90 rounded p-1 shadow-sm cursor-move">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              <Badge variant="secondary" className="text-xs">
                {widget.type.replace(/_/g, ' ')}
              </Badge>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="secondary"
                className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisibility(widget.id);
                }}
                title={widget.isVisible ? "Hide widget" : "Show widget"}
              >
                {widget.isVisible ? (
                  <Eye className="h-3 w-3" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
              </Button>

              <Button
                size="sm"
                variant="secondary"
                className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleLock(widget.id);
                }}
                title={isLocked ? "Unlock widget" : "Lock widget"}
              >
                {isLocked ? (
                  <Lock className="h-3 w-3" />
                ) : (
                  <Unlock className="h-3 w-3" />
                )}
              </Button>

              <Button
                size="sm"
                variant="secondary"
                className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(widget);
                }}
                title="Duplicate widget"
              >
                <Copy className="h-3 w-3" />
              </Button>

              <Button
                size="sm"
                variant="secondary"
                className="h-6 w-6 p-0 bg-white/90 hover:bg-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(widget);
                }}
                title="Configure widget"
              >
                <Settings className="h-3 w-3" />
              </Button>

              <Button
                size="sm"
                variant="destructive"
                className="h-6 w-6 p-0 bg-white/90 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(widget.id);
                }}
                title="Delete widget"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Widget Content */}
        <div 
          className={cn(
            "h-full",
            isCustomizing && "pointer-events-none"
          )}
        >
          <WidgetRenderer
            widget={widget}
            isCustomizing={isCustomizing}
            filters={filters}
          />
        </div>

        {/* Resize handles (only in customization mode) */}
        {isCustomizing && !isLocked && (
          <>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-primary/20 cursor-se-resize" />
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/10 cursor-s-resize" />
            <div className="absolute top-0 bottom-0 right-0 w-1 bg-primary/10 cursor-e-resize" />
          </>
        )}
      </Card>
    </div>
  );
};

// Drop Zone Component
interface DropZoneProps {
  layoutType: 'executive' | 'operational' | 'financial';
  onDrop: (item: DragItem, position: { x: number; y: number }) => void;
  children: React.ReactNode;
}

const DropZone: React.FC<DropZoneProps> = ({ layoutType, onDrop, children }) => {
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: [ItemTypes.WIDGET, ItemTypes.WIDGET_FROM_LIBRARY],
    drop: (item: DragItem, monitor) => {
      if (monitor.didDrop()) return;

      const clientOffset = monitor.getClientOffset();
      if (clientOffset) {
        const dropZoneRect = (monitor.getDropResult() as any)?.getBoundingClientRect?.();
        if (dropZoneRect) {
          const position = {
            x: Math.floor((clientOffset.x - dropZoneRect.left) / 100), // Approximate grid position
            y: Math.floor((clientOffset.y - dropZoneRect.top) / 60),
          };
          onDrop(item, position);
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver({ shallow: true }),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div
      ref={drop}
      className={cn(
        "min-h-[400px] transition-all duration-200",
        isOver && canDrop && "bg-primary/5 border-2 border-dashed border-primary/30",
        canDrop && "border border-dashed border-muted-foreground/20"
      )}
    >
      {children}
    </div>
  );
};

// Main Drag Drop Layout Manager Component
interface DragDropLayoutManagerProps {
  layoutType: 'executive' | 'operational' | 'financial';
  onWidgetSelect: (widget: DashboardWidget) => void;
  onWidgetDelete: (widgetId: string) => void;
  onAddWidget: (widgetType: WidgetType, position?: { x: number; y: number }) => void;
  className?: string;
}

export const DragDropLayoutManager: React.FC<DragDropLayoutManagerProps> = ({
  layoutType,
  onWidgetSelect,
  onWidgetDelete,
  onAddWidget,
  className,
}) => {
  const dispatch = useAppDispatch();
  const user = useAppSelector(selectUser);
  const currentConfiguration = useAppSelector(selectCurrentConfiguration);
  const isCustomizing = useAppSelector(selectIsCustomizing);

  const [snapToGrid, setSnapToGrid] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [gridSize, setGridSize] = useState(20);

  // Get current layout data
  const currentLayout = currentConfiguration?.customLayouts[layoutType];
  const widgets = currentLayout?.widgets || [];
  const gridLayout = currentLayout?.layout || [];
  const visibleWidgets = widgets.filter(w => w.isVisible);

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
      layoutType,
      layout: gridLayout,
    }));
  }, [dispatch, layoutType, isCustomizing]);

  // Handle widget drop from library
  const handleWidgetDrop = useCallback((item: DragItem, position: { x: number; y: number }) => {
    if (item.type === ItemTypes.WIDGET_FROM_LIBRARY && item.widgetType) {
      onAddWidget(item.widgetType, position);
    }
  }, [onAddWidget]);

  // Handle widget visibility toggle
  const handleToggleVisibility = useCallback((widgetId: string) => {
    dispatch(updateWidget({
      layoutType,
      widgetId,
      updates: {
        isVisible: !widgets.find(w => w.id === widgetId)?.isVisible,
      },
    }));
  }, [dispatch, layoutType, widgets]);

  // Handle widget lock toggle
  const handleToggleLock = useCallback((widgetId: string) => {
    const currentGridItem = gridLayout.find(item => item.i === widgetId);
    if (currentGridItem) {
      const updatedLayout = gridLayout.map(item =>
        item.i === widgetId
          ? {
              ...item,
              static: !item.static,
              isDraggable: item.static,
              isResizable: item.static,
            }
          : item
      );

      dispatch(updateLayout({
        layoutType,
        layout: updatedLayout,
      }));
    }
  }, [dispatch, layoutType, gridLayout]);

  // Handle widget duplication
  const handleDuplicate = useCallback((widget: DashboardWidget) => {
    const newWidget: DashboardWidget = {
      ...widget,
      id: `widget-${Date.now()}`,
      title: `${widget.title} (Copy)`,
      position: {
        x: widget.position.x + 1,
        y: widget.position.y + 1,
      },
    };

    const gridItem: GridLayout = {
      i: newWidget.id,
      x: widget.position.x + 1,
      y: widget.position.y + 1,
      w: 4,
      h: 3,
      minW: 2,
      minH: 2,
      isDraggable: true,
      isResizable: true,
    };

    dispatch(addWidget({
      layoutType,
      widget: newWidget,
      gridItem,
    }));
  }, [dispatch, layoutType]);

  // Grid background style
  const gridBackgroundStyle = showGrid ? {
    backgroundImage: `
      linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)
    `,
    backgroundSize: `${gridSize}px ${gridSize}px`,
  } : {};

  return (
    <DndProvider backend={isMobile ? TouchBackend : HTML5Backend}>
      <div className={cn("drag-drop-layout-manager", className)}>
        {/* Layout Controls */}
        {isCustomizing && (
          <div className="flex items-center justify-between mb-4 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="snap-to-grid"
                  checked={snapToGrid}
                  onChange={(e) => setSnapToGrid(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="snap-to-grid" className="text-sm">
                  Snap to grid
                </label>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show-grid"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="show-grid" className="text-sm">
                  Show grid
                </label>
              </div>

              <Separator orientation="vertical" className="h-4" />

              <div className="flex items-center gap-2">
                <span className="text-sm">Grid size:</span>
                <input
                  type="range"
                  min="10"
                  max="40"
                  value={gridSize}
                  onChange={(e) => setGridSize(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm w-8">{gridSize}px</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {visibleWidgets.length} widgets
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Reset layout to auto-arrange
                  const autoLayout = gridLayout.map((item, index) => ({
                    ...item,
                    x: (index % 3) * 4,
                    y: Math.floor(index / 3) * 3,
                  }));
                  
                  dispatch(updateLayout({
                    layoutType,
                    layout: autoLayout,
                  }));
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Auto Arrange
              </Button>
            </div>
          </div>
        )}

        {/* Layout Grid */}
        <DropZone
          layoutType={layoutType}
          onDrop={handleWidgetDrop}
        >
          <div
            className="relative min-h-[600px] p-4 rounded-lg border"
            style={gridBackgroundStyle}
          >
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
              useCSSTransforms={true}
              transformScale={1}
            >
              {visibleWidgets.map((widget) => (
                <div key={widget.id}>
                  <DraggableWidget
                    widget={widget}
                    layoutType={layoutType}
                    isCustomizing={isCustomizing}
                    onSelect={onWidgetSelect}
                    onDelete={onWidgetDelete}
                    onToggleVisibility={handleToggleVisibility}
                    onToggleLock={handleToggleLock}
                    onDuplicate={handleDuplicate}
                    filters={currentLayout?.filters}
                  />
                </div>
              ))}
            </ResponsiveGridLayout>

            {/* Empty state */}
            {visibleWidgets.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Move className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No widgets in this layout</h3>
                  <p className="text-muted-foreground">
                    Drag widgets from the library to get started
                  </p>
                </div>
              </div>
            )}
          </div>
        </DropZone>
      </div>
    </DndProvider>
  );
};

export default DragDropLayoutManager;