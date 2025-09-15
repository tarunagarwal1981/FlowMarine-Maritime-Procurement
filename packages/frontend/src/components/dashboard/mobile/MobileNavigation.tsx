import React, { useState, useEffect } from 'react';
import { Button } from '../../ui/button';
import { Card, CardContent } from '../../ui/card';
import { 
  Menu, 
  X, 
  Home, 
  BarChart3, 
  TrendingUp, 
  DollarSign, 
  Settings,
  User,
  Bell,
  Search,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useMediaQuery } from '../../../hooks/useMediaQuery';

interface MobileNavigationProps {
  currentView: string;
  onViewChange: (view: string) => void;
  notifications?: number;
  className?: string;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({
  currentView,
  onViewChange,
  notifications = 0,
  className
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isMobile = useMediaQuery('(max-width: 768px)');

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'financial', label: 'Financial', icon: DollarSign },
    { id: 'operational', label: 'Operations', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const quickActions = [
    { id: 'search', label: 'Search', icon: Search },
    { id: 'filter', label: 'Filter', icon: Filter },
    { id: 'export', label: 'Export', icon: Download },
    { id: 'refresh', label: 'Refresh', icon: RefreshCw },
  ];

  // Close menu when view changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [currentView]);

  // Handle swipe gestures for menu
  const handleSwipeGesture = (startX: number, endX: number) => {
    const threshold = 50;
    const deltaX = endX - startX;

    if (deltaX > threshold && startX < 50) {
      // Swipe right from left edge - open menu
      setIsMenuOpen(true);
    } else if (deltaX < -threshold && isMenuOpen) {
      // Swipe left when menu is open - close menu
      setIsMenuOpen(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const startX = e.touches[0].clientX;
    
    const handleTouchEnd = (endEvent: TouchEvent) => {
      const endX = endEvent.changedTouches[0].clientX;
      handleSwipeGesture(startX, endX);
      
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchend', handleTouchEnd);
  };

  if (!isMobile) {
    return null; // Don't render on desktop
  }

  return (
    <>
      {/* Top Navigation Bar */}
      <div 
        className={cn(
          "mobile-nav-bar fixed top-0 left-0 right-0 z-40 bg-white border-b shadow-sm",
          className
        )}
        onTouchStart={handleTouchStart}
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2"
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>

          {/* Current View Title */}
          <h1 className="text-lg font-semibold capitalize">
            {currentView}
          </h1>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="p-2"
            >
              <Search size={18} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="p-2 relative"
            >
              <Bell size={18} />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {notifications > 9 ? '9+' : notifications}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Search Bar */}
        {isSearchOpen && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search dashboards, widgets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>

      {/* Side Menu Overlay */}
      {isMenuOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black bg-opacity-50"
          onClick={() => setIsMenuOpen(false)}
        >
          <div 
            className="fixed left-0 top-0 bottom-0 w-80 bg-white shadow-xl transform transition-transform duration-300 ease-in-out"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Menu Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <User size={16} className="text-white" />
                </div>
                <div>
                  <p className="font-medium">FlowMarine</p>
                  <p className="text-sm text-gray-500">Dashboard</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMenuOpen(false)}
                className="p-2"
              >
                <X size={20} />
              </Button>
            </div>

            {/* Navigation Items */}
            <div className="py-4">
              <div className="px-4 mb-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Navigation
                </h3>
              </div>
              
              {navigationItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => onViewChange(item.id)}
                    className={cn(
                      "w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors",
                      currentView === item.id && "bg-blue-50 border-r-2 border-blue-600 text-blue-600"
                    )}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Quick Actions */}
            <div className="border-t py-4">
              <div className="px-4 mb-4">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
                  Quick Actions
                </h3>
              </div>
              
              <div className="grid grid-cols-2 gap-2 px-4">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={action.id}
                      variant="outline"
                      size="sm"
                      className="flex items-center space-x-2 justify-start"
                    >
                      <Icon size={16} />
                      <span>{action.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation (Alternative) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t shadow-lg">
        <div className="flex items-center justify-around py-2">
          {navigationItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={cn(
                  "flex flex-col items-center space-y-1 py-2 px-3 rounded-lg transition-colors",
                  currentView === item.id 
                    ? "text-blue-600 bg-blue-50" 
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                <Icon size={20} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Spacer for fixed navigation */}
      <div className="h-16" /> {/* Top spacer */}
      <div className="h-20" /> {/* Bottom spacer */}
    </>
  );
};