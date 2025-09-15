import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface SyncItem {
  id: string;
  type: 'requisition' | 'approval' | 'photo' | 'document';
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: string;
  retryCount: number;
  lastError?: string;
}

interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  pendingSync: SyncItem[];
  lastSyncTime: string | null;
  syncErrors: string[];
  offlineMode: boolean;
  dataCache: {
    vessels: any[];
    itemCatalog: any[];
    vendors: any[];
    lastUpdated: string | null;
  };
}

const initialState: OfflineState = {
  isOnline: true,
  isSyncing: false,
  pendingSync: [],
  lastSyncTime: null,
  syncErrors: [],
  offlineMode: false,
  dataCache: {
    vessels: [],
    itemCatalog: [],
    vendors: [],
    lastUpdated: null,
  },
};

const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
      if (action.payload && state.pendingSync.length > 0) {
        // Trigger sync when coming back online
        state.isSyncing = true;
      }
    },
    setSyncing: (state, action: PayloadAction<boolean>) => {
      state.isSyncing = action.payload;
    },
    addSyncItem: (state, action: PayloadAction<Omit<SyncItem, 'id' | 'timestamp' | 'retryCount'>>) => {
      const syncItem: SyncItem = {
        ...action.payload,
        id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        retryCount: 0,
      };
      state.pendingSync.push(syncItem);
    },
    removeSyncItem: (state, action: PayloadAction<string>) => {
      state.pendingSync = state.pendingSync.filter(item => item.id !== action.payload);
    },
    updateSyncItem: (state, action: PayloadAction<{id: string; updates: Partial<SyncItem>}>) => {
      const index = state.pendingSync.findIndex(item => item.id === action.payload.id);
      if (index !== -1) {
        state.pendingSync[index] = {...state.pendingSync[index], ...action.payload.updates};
      }
    },
    incrementRetryCount: (state, action: PayloadAction<string>) => {
      const item = state.pendingSync.find(item => item.id === action.payload);
      if (item) {
        item.retryCount += 1;
      }
    },
    setSyncError: (state, action: PayloadAction<{id: string; error: string}>) => {
      const item = state.pendingSync.find(item => item.id === action.payload.id);
      if (item) {
        item.lastError = action.payload.error;
      }
      if (!state.syncErrors.includes(action.payload.error)) {
        state.syncErrors.push(action.payload.error);
      }
    },
    clearSyncErrors: (state) => {
      state.syncErrors = [];
    },
    setLastSyncTime: (state, action: PayloadAction<string>) => {
      state.lastSyncTime = action.payload;
    },
    setOfflineMode: (state, action: PayloadAction<boolean>) => {
      state.offlineMode = action.payload;
    },
    updateDataCache: (state, action: PayloadAction<{
      type: 'vessels' | 'itemCatalog' | 'vendors';
      data: any[];
    }>) => {
      state.dataCache[action.payload.type] = action.payload.data;
      state.dataCache.lastUpdated = new Date().toISOString();
    },
    clearDataCache: (state) => {
      state.dataCache = initialState.dataCache;
    },
    clearPendingSync: (state) => {
      state.pendingSync = [];
    },
  },
});

export const {
  setOnlineStatus,
  setSyncing,
  addSyncItem,
  removeSyncItem,
  updateSyncItem,
  incrementRetryCount,
  setSyncError,
  clearSyncErrors,
  setLastSyncTime,
  setOfflineMode,
  updateDataCache,
  clearDataCache,
  clearPendingSync,
} = offlineSlice.actions;

export default offlineSlice.reducer;