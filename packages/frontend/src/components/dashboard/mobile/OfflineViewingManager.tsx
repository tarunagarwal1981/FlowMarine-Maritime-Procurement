import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Alert, AlertDescription } from '../../ui/alert';
import { 
  WifiOff, 
  Wifi, 
  Download, 
  RefreshCw, 
  Clock, 
  AlertCircle,
  CheckCircle,
  Trash2
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { DashboardData } from '../../../types/dashboard';

interface OfflineViewingManagerProps {
  dashboardData: DashboardData[];
  onDataRefresh: () => Promise<void>;
  className?: string;
}

interface OfflineData {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  size: number;
}

export const OfflineViewingManager: React.FC<OfflineViewingManagerProps> = ({
  dashboardData,
  onDataRefresh,
  className
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<OfflineData[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [storageUsage, setStorageUsage] = useState(0);
  const [maxStorage] = useState(50 * 1024 * 1024); // 50MB limit

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load offline data from localStorage on mount
  useEffect(() => {
    loadOfflineData();
    calculateStorageUsage();
  }, []);

  const loadOfflineData = () => {
    try {
      const stored = localStorage.getItem('flowmarine_offline_dashboard_data');
      if (stored) {
        const data = JSON.parse(stored);
        setOfflineData(data);
        
        const syncTime = localStorage.getItem('flowmarine_last_sync');
        if (syncTime) {
          setLastSync(new Date(syncTime));
        }
      }
    } catch (error) {
      console.error('Failed to load offline data:', error);
    }
  };

  const saveOfflineData = (data: OfflineData[]) => {
    try {
      localStorage.setItem('flowmarine_offline_dashboard_data', JSON.stringify(data));
      localStorage.setItem('flowmarine_last_sync', new Date().toISOString());
      setOfflineData(data);
      setLastSync(new Date());
      calculateStorageUsage();
    } catch (error) {
      console.error('Failed to save offline data:', error);
      // Handle storage quota exceeded
      if (error.name === 'QuotaExceededError') {
        cleanupOldData();
      }
    }
  };

  const calculateStorageUsage = () => {
    try {
      const stored = localStorage.getItem('flowmarine_offline_dashboard_data');
      if (stored) {
        const sizeInBytes = new Blob([stored]).size;
        setStorageUsage(sizeInBytes);
      }
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
    }
  };

  const downloadForOffline = async () => {
    if (!isOnline) {
      return;
    }

    setIsDownloading(true);
    try {
      // Download current dashboard data for offline use
      const offlineDataToStore: OfflineData[] = dashboardData.map(dashboard => ({
        id: dashboard.id,
        type: dashboard.type,
        data: dashboard,
        timestamp: new Date(),
        size: JSON.stringify(dashboard).length
      }));

      // Check storage limits
      const totalSize = offlineDataToStore.reduce((sum, item) => sum + item.size, 0);
      if (totalSize > maxStorage) {
        throw new Error('Data too large for offline storage');
      }

      saveOfflineData(offlineDataToStore);
    } catch (error) {
      console.error('Failed to download data for offline use:', error);
    } finally {
      setIsDownloading(false);
    }
  };

  const syncOfflineData = async () => {
    if (!isOnline) {
      return;
    }

    try {
      await onDataRefresh();
      await downloadForOffline();
    } catch (error) {
      console.error('Failed to sync offline data:', error);
    }
  };

  const cleanupOldData = () => {
    // Remove data older than 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const filteredData = offlineData.filter(
      item => new Date(item.timestamp) > sevenDaysAgo
    );

    saveOfflineData(filteredData);
  };

  const clearOfflineData = () => {
    localStorage.removeItem('flowmarine_offline_dashboard_data');
    localStorage.removeItem('flowmarine_last_sync');
    setOfflineData([]);
    setLastSync(null);
    setStorageUsage(0);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStoragePercentage = () => {
    return (storageUsage / maxStorage) * 100;
  };

  return (
    <div className={cn("offline-viewing-manager space-y-4", className)}>
      {/* Connection Status */}
      <Alert className={cn(
        "border-l-4",
        isOnline 
          ? "border-l-green-500 bg-green-50" 
          : "border-l-red-500 bg-red-50"
      )}>
        <div className="flex items-center space-x-2">
          {isOnline ? (
            <Wifi className="text-green-600" size={16} />
          ) : (
            <WifiOff className="text-red-600" size={16} />
          )}
          <AlertDescription className="font-medium">
            {isOnline ? 'Connected' : 'Offline Mode'}
          </AlertDescription>
        </div>
      </Alert>

      {/* Offline Data Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center space-x-2">
            <Download size={16} />
            <span>Offline Data</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Storage Usage */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Storage Used</span>
              <span>{formatBytes(storageUsage)} / {formatBytes(maxStorage)}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  getStoragePercentage() > 80 ? "bg-red-500" : 
                  getStoragePercentage() > 60 ? "bg-yellow-500" : "bg-green-500"
                )}
                style={{ width: `${Math.min(getStoragePercentage(), 100)}%` }}
              />
            </div>
          </div>

          {/* Last Sync Info */}
          {lastSync && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Clock size={14} />
              <span>Last synced: {lastSync.toLocaleString()}</span>
            </div>
          )}

          {/* Offline Data Items */}
          {offlineData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Available Offline:</h4>
              {offlineData.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    <CheckCircle size={14} className="text-green-600" />
                    <span className="text-sm capitalize">{item.type} Dashboard</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatBytes(item.size)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <Button
              onClick={downloadForOffline}
              disabled={!isOnline || isDownloading}
              size="sm"
              className="flex-1"
            >
              {isDownloading ? (
                <>
                  <RefreshCw size={14} className="mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download size={14} className="mr-2" />
                  Download for Offline
                </>
              )}
            </Button>

            {offlineData.length > 0 && (
              <Button
                onClick={clearOfflineData}
                variant="outline"
                size="sm"
              >
                <Trash2 size={14} className="mr-2" />
                Clear
              </Button>
            )}
          </div>

          {/* Offline Usage Tips */}
          {!isOnline && (
            <Alert>
              <AlertCircle size={16} />
              <AlertDescription className="text-sm">
                You're viewing cached data. Some features may be limited in offline mode.
                Connect to the internet to sync latest data.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Offline Dashboard Viewer */}
      {!isOnline && offlineData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Offline Dashboards</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {offlineData.map((item) => (
                <Button
                  key={item.id}
                  variant="outline"
                  className="justify-start"
                  onClick={() => {
                    // Navigate to offline dashboard view
                    // This would integrate with your routing system
                  }}
                >
                  <div className="flex items-center space-x-2">
                    <CheckCircle size={14} className="text-green-600" />
                    <span className="capitalize">{item.type} Dashboard</span>
                  </div>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};