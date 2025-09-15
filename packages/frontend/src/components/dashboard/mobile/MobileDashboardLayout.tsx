import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { ChevronLeft, ChevronRight, Menu, X } from 'lucide-react';
import { DashboardWidget, DashboardLayout } from '../../../types/dashboard';
import { cn } from '../../../lib/utils';

interface MobileDashboardLayoutProps {
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  onWidgetInteraction: (widgetId: string, action: string) => void;
  className?: string;
}

export const MobileDashboardLayout: React.FC<MobileDashboardLayoutProps> = ({
  layout,
  widgets,
  onWidgetInteraction,
  className
}) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  // Detect orientation changes
  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    handleOrientationChange();
    window.addEventListener('resize', handleOrientationChange);
    return () => window.removeEventListener('resize', handleOrientationChange);
  }, []);

  // Group widgets into pages for mobile viewing
  const widgetsPerPage = orientation === 'portrait' ? 2 : 3;
  const pages = [];
  for (let i = 0; i < widgets.length; i += widgetsPerPage) {
    pages.push(widgets.slice(i, i + widgetsPerPage));
  }

  const handleSwipeGesture = (direction: 'left' | 'right') => {
    if (direction === 'left' && currentPage < pages.length - 1) {
      setCurrentPage(currentPage + 1);
    } else if (direction === 'right' && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  return (
    <div className={cn("mobile-dashboard-layout h-full flex flex-col", className)}>
      {/* Mobile Header */}
      <div className="mobile-header flex items-center justify-between p-4 bg-white border-b">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="p-2"
        >
          {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </Button>
        
        <h1 className="text-lg font-semibold">Dashboard</h1>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {currentPage + 1} / {pages.length}
          </span>
        </div>
      </div>

      {/* Mobile Navigation Menu */}
      {isMenuOpen && (
        <div className="mobile-menu bg-white border-b p-4 space-y-2">
          {pages.map((_, index) => (
            <Button
              key={index}
              variant={currentPage === index ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setCurrentPage(index);
                setIsMenuOpen(false);
              }}
              className="w-full justify-start"
            >
              Page {index + 1}
            </Button>
          ))}
        </div>
      )}

      {/* Widget Container */}
      <div className="flex-1 overflow-hidden">
        <div 
          className="h-full transition-transform duration-300 ease-in-out"
          style={{ transform: `translateX(-${currentPage * 100}%)` }}
        >
          <div className="flex h-full">
            {pages.map((pageWidgets, pageIndex) => (
              <div
                key={pageIndex}
                className="w-full flex-shrink-0 p-4 space-y-4"
              >
                {pageWidgets.map((widget) => (
                  <MobileWidgetContainer
                    key={widget.id}
                    widget={widget}
                    onInteraction={onWidgetInteraction}
                    orientation={orientation}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="mobile-nav-controls flex items-center justify-between p-4 bg-white border-t">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleSwipeGesture('right')}
          disabled={currentPage === 0}
          className="flex items-center space-x-2"
        >
          <ChevronLeft size={16} />
          <span>Previous</span>
        </Button>

        {/* Page Indicators */}
        <div className="flex space-x-2">
          {pages.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentPage(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                currentPage === index ? "bg-blue-600" : "bg-gray-300"
              )}
            />
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleSwipeGesture('left')}
          disabled={currentPage === pages.length - 1}
          className="flex items-center space-x-2"
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
};

interface MobileWidgetContainerProps {
  widget: DashboardWidget;
  onInteraction: (widgetId: string, action: string) => void;
  orientation: 'portrait' | 'landscape';
}

const MobileWidgetContainer: React.FC<MobileWidgetContainerProps> = ({
  widget,
  onInteraction,
  orientation
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Handle touch interactions
    const touch = e.touches[0];
    const startY = touch.clientY;
    
    const handleTouchMove = (moveEvent: TouchEvent) => {
      const currentTouch = moveEvent.touches[0];
      const deltaY = currentTouch.clientY - startY;
      
      // Implement pull-to-refresh or swipe gestures
      if (deltaY > 50) {
        onInteraction(widget.id, 'refresh');
      }
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  return (
    <Card 
      className={cn(
        "mobile-widget-container touch-manipulation",
        orientation === 'landscape' ? "h-48" : "h-64",
        isExpanded && "fixed inset-4 z-50 h-auto"
      )}
      onTouchStart={handleTouchStart}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{widget.title}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1"
          >
            {isExpanded ? <X size={16} /> : <ChevronRight size={16} />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={cn(
          "widget-content",
          isExpanded ? "h-auto" : "h-32 overflow-hidden"
        )}>
          {/* Widget content will be rendered here */}
          <div className="text-sm text-gray-600">
            {widget.type} widget content
          </div>
        </div>
      </CardContent>
    </Card>
  );
};