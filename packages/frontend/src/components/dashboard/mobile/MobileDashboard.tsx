import React, { useState, useEffect } from 'react';
import { MobileDashboardLayout } from './MobileDashboardLayout';
import { MobileNavigation } from './MobileNavigation';
import { OfflineViewingManager } from './OfflineViewingManager';
import { ResponsiveChartContainer } from './ResponsiveChartContainer';
import { TouchFriendlyChart } from './TouchFriendlyChart';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Alert, AlertDescription } from '../../ui/alert';
import { 
  WifiOff, 
  Settings, 
  Download, 
  RefreshCw,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useMediaQuery, useIsMobile, useIsLandscape } from '../../../hooks/useMediaQuery';
import { DashboardWidget, DashboardLayout, DashboardData } from '../../../types/dashboard';

interface MobileDashboardProps {
  dashboards: DashboardData[];
  currentDashboard: string;
  onDashboardChange: (dashboardId: string) => void;
  onDataRefresh: () => Promise<void>;
  className?: string;
}

export const MobileDashboard: React.FC<MobileDashboardProps> = ({
  dashboards,
  currentDashboard,
  onDashboardChange,
  onDataRefresh,
  className
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showOfflineManager, setShowOfflineManager] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  
  const isMobile = useIsMobile();
  const isLandscape = useIsLandscape();

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Monitor orientation changes
  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    handleOrientationChange();
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, []);

  // Get current dashboard data
  const currentDashboardData = dashboards.find(d => d.id === currentDashboard);

  // Handle widget interactions
  const handleWidgetInteraction = (widgetId: string, action: string) => {
    switch (action) {
      case 'refresh':
        onDataRefresh();
        break;
      case 'fullscreen':
        setIsFullscreen(true);
        break;
      case 'minimize':
        setIsFullscreen(false);
        break;
      default:
        console.log(`Widget ${widgetId} action: ${action}`);
    }
  };

  // Don't render mobile version on desktop
  if (!isMobile) {
    return null;
  }

  return (
    <div className={cn(
      "mobile-dashboard h-screen flex flex-col bg-gray-50",
      isFullscreen && "fixed inset-0 z-50",
      className
    )}>
      {/* Mobile Navigation */}
      <MobileNavigation
        currentView={currentDashboard}
        onViewChange={onDashboardChange}
        notifications={3} // This would come from your notification system
      />

      {/* Offline Status Banner */}
      {!isOnline && (
        <Alert className="mx-4 mt-4 border-l-4 border-l-orange-500 bg-orange-50">
          <WifiOff size={16} className="text-orange-600" />
          <AlertDescription className="flex items-center justify-between">
            <span>You're offline. Viewing cached data.</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOfflineManager(true)}
              className="text-orange-600 hover:text-orange-700"
            >
              Manage
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {showOfflineManager ? (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Offline Data</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOfflineManager(false)}
              >
                Done
              </Button>
            </div>
            <OfflineViewingManager
              dashboardData={dashboards}
              onDataRefresh={onDataRefresh}
            />
          </div>
        ) : currentDashboardData ? (
          <MobileDashboardLayout
            layout={currentDashboardData.layout}
            widgets={currentDashboardData.widgets}
            onWidgetInteraction={handleWidgetInteraction}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-gray-500 mb-4">No dashboard data available</p>
              <Button onClick={onDataRefresh} disabled={!isOnline}>
                <RefreshCw size={16} className="mr-2" />
                Refresh Data
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Bar */}
      <div className="bg-white border-t p-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOfflineManager(!showOfflineManager)}
              className="flex items-center space-x-1"
            >
              <Download size={14} />
              <span className="text-xs">Offline</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onDataRefresh}
              disabled={!isOnline}
              className="flex items-center space-x-1"
            >
              <RefreshCw size={14} />
              <span className="text-xs">Refresh</span>
            </Button>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center space-x-1"
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              <span className="text-xs">
                {isFullscreen ? 'Exit' : 'Full'}
              </span>
            </Button>

            <div className="text-xs text-gray-500">
              {orientation === 'portrait' ? '📱' : '📱↻'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Example usage component showing how to integrate with existing dashboard system
export const MobileDashboardExample: React.FC = () => {
  const [dashboards] = useState<DashboardData[]>([
    {
      id: 'executive',
      type: 'executive',
      title: 'Executive Dashboard',
      layout: {
        widgets: [],
        layout: []
      },
      widgets: [
        {
          id: 'spend-viz',
          type: 'chart',
          title: 'Fleet Spend Visualization',
          configuration: { chartType: 'line' },
          permissions: ['view_analytics']
        },
        {
          id: 'budget-util',
          type: 'kpi',
          title: 'Budget Utilization',
          configuration: { format: 'percentage' },
          permissions: ['view_budget']
        }
      ]
    },
    {
      id: 'operational',
      type: 'operational',
      title: 'Operational Analytics',
      layout: {
        widgets: [],
        layout: []
      },
      widgets: [
        {
          id: 'cycle-time',
          type: 'chart',
          title: 'Cycle Time Analysis',
          configuration: { chartType: 'bar' },
          permissions: ['view_operations']
        }
      ]
    }
  ]);

  const [currentDashboard, setCurrentDashboard] = useState('executive');

  const handleDataRefresh = async () => {
    // Simulate data refresh
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('Data refreshed');
  };

  return (
    <MobileDashboard
      dashboards={dashboards}
      currentDashboard={currentDashboard}
      onDashboardChange={setCurrentDashboard}
      onDataRefresh={handleDataRefresh}
    />
  );
};