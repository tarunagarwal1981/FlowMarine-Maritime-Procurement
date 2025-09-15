/**
 * Offline Status Indicator Component
 * Shows current online/offline status and sync information
 */

import React, { useState } from 'react';
import { useOfflineSync } from '../../hooks/useOfflineSync';

export const OfflineStatusIndicator: React.FC = () => {
  const {
    isOnline,
    isOffline,
    syncInProgress,
    pendingSyncCount,
    lastSyncTime,
    forceSync,
    storageStats
  } = useOfflineSync();

  const [showDetails, setShowDetails] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleForceSync = async () => {
    if (!isOnline) return;
    
    setSyncError(null);
    try {
      const result = await forceSync();
      if (!result.success && result.errors.length > 0) {
        setSyncError(result.errors[0].error);
      }
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Sync failed');
    }
  };

  const formatLastSyncTime = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString();
  };

  const formatStorageSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="relative">
      {/* Main Status Indicator */}
      <div 
        className={`flex items-center space-x-2 px-3 py-2 rounded-md cursor-pointer transition-colors ${
          isOnline 
            ? 'bg-green-100 hover:bg-green-200 text-green-800' 
            : 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
        }`}
        onClick={() => setShowDetails(!showDetails)}
      >
        {/* Status Dot */}
        <div 
          className={`w-2 h-2 rounded-full ${
            isOnline ? 'bg-green-500' : 'bg-yellow-500'
          } ${syncInProgress ? 'animate-pulse' : ''}`}
        />
        
        {/* Status Text */}
        <span className="text-sm font-medium">
          {isOnline ? 'Online' : 'Offline'}
        </span>
        
        {/* Pending Sync Count */}
        {pendingSyncCount > 0 && (
          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
            {pendingSyncCount}
          </span>
        )}
        
        {/* Sync Progress Indicator */}
        {syncInProgress && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div>
        )}
        
        {/* Dropdown Arrow */}
        <svg 
          className={`w-4 h-4 transition-transform ${showDetails ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Detailed Status Panel */}
      {showDetails && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Connection Status</h3>
            
            {/* Connection Status */}
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status:</span>
                <span className={`text-sm font-medium ${
                  isOnline ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {isOnline ? 'Connected' : 'Offline'}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Last Sync:</span>
                <span className="text-sm text-gray-900">
                  {formatLastSyncTime(lastSyncTime)}
                </span>
              </div>
              
              {pendingSyncCount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Pending Sync:</span>
                  <span className="text-sm font-medium text-blue-600">
                    {pendingSyncCount} items
                  </span>
                </div>
              )}
            </div>

            {/* Sync Actions */}
            {isOnline && (
              <div className="mb-4">
                <button
                  onClick={handleForceSync}
                  disabled={syncInProgress}
                  className="w-full px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {syncInProgress ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Syncing...
                    </>
                  ) : (
                    'Force Sync'
                  )}
                </button>
                
                {syncError && (
                  <div className="mt-2 p-2 bg-red-100 border border-red-300 rounded-md">
                    <span className="text-red-800 text-xs">{syncError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Offline Mode Info */}
            {isOffline && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="text-sm text-yellow-800">
                  <div className="font-medium mb-1">Working Offline</div>
                  <div>You can continue creating requisitions. They will sync automatically when connection is restored.</div>
                </div>
              </div>
            )}

            {/* Storage Statistics */}
            <div className="border-t pt-3">
              <h4 className="font-medium text-gray-900 mb-2">Offline Storage</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Requisitions:</span>
                  <span className="text-gray-900">{storageStats.offlineRequisitions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cached Items:</span>
                  <span className="text-gray-900">{storageStats.cachedItems}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Cached Vessels:</span>
                  <span className="text-gray-900">{storageStats.cachedVessels}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Storage Used:</span>
                  <span className="text-gray-900">{formatStorageSize(storageStats.totalSize)}</span>
                </div>
              </div>
            </div>

            {/* Tips */}
            <div className="border-t pt-3 mt-3">
              <div className="text-xs text-gray-500">
                <div className="font-medium mb-1">Tips:</div>
                <ul className="space-y-1">
                  <li>• Requisitions created offline will sync automatically</li>
                  <li>• Essential data is cached for 24 hours</li>
                  <li>• Force sync to update cached data when online</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};