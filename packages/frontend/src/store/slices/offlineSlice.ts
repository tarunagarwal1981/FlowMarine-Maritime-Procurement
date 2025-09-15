/**
 * Offline Redux Slice
 * Manages offline state in Redux store
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { OfflineRequisition, OfflineState } from '../../utils/offlineStorage';

interface OfflineSliceState extends OfflineState {
  offlineRequisitions: OfflineRequisition[];
  syncErrors: string[];
}

const initialState: OfflineSliceState = {
  isOnline: navigator.onLine,
  pendingSyncCount: 0,
  syncInProgress: false,
  offlineRequisitions: [],
  syncErrors: []
};

export const offlineSlice = createSlice({
  name: 'offline',
  initialState,
  reducers: {
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
    setSyncInProgress: (state, action: PayloadAction<boolean>) => {
      state.syncInProgress = action.payload;
    },
    setPendingSyncCount: (state, action: PayloadAction<number>) => {
      state.pendingSyncCount = action.payload;
    },
    setLastSyncTime: (state, action: PayloadAction<string>) => {
      state.lastSyncTime = action.payload;
    },
    setOfflineRequisitions: (state, action: PayloadAction<OfflineRequisition[]>) => {
      state.offlineRequisitions = action.payload;
    },
    addOfflineRequisition: (state, action: PayloadAction<OfflineRequisition>) => {
      state.offlineRequisitions.push(action.payload);
      state.pendingSyncCount = state.offlineRequisitions.length;
    },
    removeOfflineRequisition: (state, action: PayloadAction<string>) => {
      state.offlineRequisitions = state.offlineRequisitions.filter(
        req => req.tempId !== action.payload
      );
      state.pendingSyncCount = state.offlineRequisitions.length;
    },
    addSyncError: (state, action: PayloadAction<string>) => {
      state.syncErrors.push(action.payload);
    },
    clearSyncErrors: (state) => {
      state.syncErrors = [];
    }
  }
});

export const {
  setOnlineStatus,
  setSyncInProgress,
  setPendingSyncCount,
  setLastSyncTime,
  setOfflineRequisitions,
  addOfflineRequisition,
  removeOfflineRequisition,
  addSyncError,
  clearSyncErrors
} = offlineSlice.actions;