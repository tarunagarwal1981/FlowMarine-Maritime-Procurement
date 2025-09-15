import React, {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import OfflineService, {OfflineAction, SyncResult, ConflictResolution} from './OfflineService';

interface OfflineContextType {
  isOnline: boolean;
  isSyncing: boolean;
  syncStats: {
    pending: number;
    synced: number;
    failed: number;
    conflicts: number;
    lastSync: number | null;
  };
  addOfflineAction: (action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount' | 'status'>) => Promise<string>;
  syncNow: () => Promise<SyncResult>;
  resolveConflict: (resolution: ConflictResolution) => Promise<boolean>;
  getConflicts: () => Promise<OfflineAction[]>;
  clearSyncedActions: (olderThanDays?: number) => Promise<void>;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

interface OfflineProviderProps {
  children: ReactNode;
}

export const OfflineProvider: React.FC<OfflineProviderProps> = ({children}) => {
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStats, setSyncStats] = useState({
    pending: 0,
    synced: 0,
    failed: 0,
    conflicts: 0,
    lastSync: null as number | null,
  });

  useEffect(() => {
    initializeOfflineService();
    
    // Update stats periodically
    const statsInterval = setInterval(updateSyncStats, 10000); // Every 10 seconds
    
    return () => {
      clearInterval(statsInterval);
      OfflineService.cleanup();
    };
  }, []);

  const initializeOfflineService = async () => {
    try {
      await OfflineService.initialize();
      setIsOnline(OfflineService.isNetworkAvailable());
      await updateSyncStats();
    } catch (error) {
      console.error('Error initializing offline service:', error);
    }
  };

  const updateSyncStats = async () => {
    try {
      const stats = await OfflineService.getSyncStats();
      setSyncStats(stats);
      setIsOnline(OfflineService.isNetworkAvailable());
    } catch (error) {
      console.error('Error updating sync stats:', error);
    }
  };

  const addOfflineAction = async (
    action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount' | 'status'>
  ): Promise<string> => {
    try {
      const actionId = await OfflineService.addOfflineAction(action);
      await updateSyncStats();
      return actionId;
    } catch (error) {
      console.error('Error adding offline action:', error);
      throw error;
    }
  };

  const syncNow = async (): Promise<SyncResult> => {
    try {
      setIsSyncing(true);
      const result = await OfflineService.forceSync();
      await updateSyncStats();
      return result;
    } catch (error) {
      console.error('Error syncing:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const resolveConflict = async (resolution: ConflictResolution): Promise<boolean> => {
    try {
      const success = await OfflineService.resolveConflict(resolution);
      if (success) {
        await updateSyncStats();
      }
      return success;
    } catch (error) {
      console.error('Error resolving conflict:', error);
      return false;
    }
  };

  const getConflicts = async (): Promise<OfflineAction[]> => {
    try {
      const actions = await OfflineService.getPendingActions();
      return actions.filter(action => action.status === 'conflict');
    } catch (error) {
      console.error('Error getting conflicts:', error);
      return [];
    }
  };

  const clearSyncedActions = async (olderThanDays: number = 7): Promise<void> => {
    try {
      await OfflineService.clearSyncedActions(olderThanDays);
      await updateSyncStats();
    } catch (error) {
      console.error('Error clearing synced actions:', error);
    }
  };

  const value: OfflineContextType = {
    isOnline,
    isSyncing,
    syncStats,
    addOfflineAction,
    syncNow,
    resolveConflict,
    getConflicts,
    clearSyncedActions,
  };

  return (
    <OfflineContext.Provider value={value}>
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = (): OfflineContextType => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};