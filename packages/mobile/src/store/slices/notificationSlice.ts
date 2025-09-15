import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'emergency';
  priority: 'low' | 'medium' | 'high' | 'critical';
  isRead: boolean;
  actionRequired: boolean;
  actionUrl?: string;
  relatedEntity?: {
    type: 'requisition' | 'order' | 'invoice' | 'vessel';
    id: string;
  };
  createdAt: string;
  expiresAt?: string;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  pushEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  filters: {
    type: string[];
    priority: string[];
    read: boolean | null;
  };
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  pushEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  isLoading: false,
  error: null,
  filters: {
    type: [],
    priority: [],
    read: null,
  },
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setNotifications: (state, action: PayloadAction<Notification[]>) => {
      state.notifications = action.payload;
      state.unreadCount = action.payload.filter(n => !n.isRead).length;
    },
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
      if (!action.payload.isRead) {
        state.unreadCount += 1;
      }
    },
    markAsRead: (state, action: PayloadAction<string>) => {
      const notification = state.notifications.find(n => n.id === action.payload);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        state.unreadCount -= 1;
      }
    },
    markAllAsRead: (state) => {
      state.notifications.forEach(notification => {
        notification.isRead = true;
      });
      state.unreadCount = 0;
    },
    deleteNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index !== -1) {
        const notification = state.notifications[index];
        if (!notification.isRead) {
          state.unreadCount -= 1;
        }
        state.notifications.splice(index, 1);
      }
    },
    clearAllNotifications: (state) => {
      state.notifications = [];
      state.unreadCount = 0;
    },
    setPushEnabled: (state, action: PayloadAction<boolean>) => {
      state.pushEnabled = action.payload;
    },
    setSoundEnabled: (state, action: PayloadAction<boolean>) => {
      state.soundEnabled = action.payload;
    },
    setVibrationEnabled: (state, action: PayloadAction<boolean>) => {
      state.vibrationEnabled = action.payload;
    },
    setFilters: (state, action: PayloadAction<Partial<NotificationState['filters']>>) => {
      state.filters = {...state.filters, ...action.payload};
    },
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
  },
});

export const {
  setLoading,
  setError,
  setNotifications,
  addNotification,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications,
  setPushEnabled,
  setSoundEnabled,
  setVibrationEnabled,
  setFilters,
  clearFilters,
} = notificationSlice.actions;

export default notificationSlice.reducer;