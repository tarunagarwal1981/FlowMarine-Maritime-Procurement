/**
 * Notification API
 * RTK Query API for notification operations
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../store';
import { env } from '../../config/env';
import type { Notification } from '../slices/notificationSlice';

export interface GetNotificationsRequest {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  category?: string;
  priority?: string;
  vesselId?: string;
}

export interface GetNotificationsResponse {
  notifications: Notification[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface MarkAsReadRequest {
  notificationIds: string[];
}

export interface NotificationPreferences {
  enablePush: boolean;
  enableSound: boolean;
  enableDesktop: boolean;
  emergencyOnly: boolean;
  categories: {
    approval: boolean;
    delivery: boolean;
    payment: boolean;
    system: boolean;
    emergency: boolean;
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string; // HH:mm format
    timezone: string;
  };
}

export const notificationApi = createApi({
  reducerPath: 'notificationApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${env.VITE_API_BASE_URL}/notifications`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      headers.set('content-type', 'application/json');
      return headers;
    },
  }),
  tagTypes: ['Notification', 'NotificationPreferences'],
  endpoints: (builder) => ({
    // Get notifications with pagination and filtering
    getNotifications: builder.query<GetNotificationsResponse, GetNotificationsRequest>({
      query: (params) => ({
        url: '',
        params: {
          page: params.page || 1,
          limit: params.limit || 20,
          ...(params.unreadOnly && { unreadOnly: true }),
          ...(params.category && { category: params.category }),
          ...(params.priority && { priority: params.priority }),
          ...(params.vesselId && { vesselId: params.vesselId }),
        },
      }),
      providesTags: ['Notification'],
      // Merge new pages with existing data for infinite scroll
      serializeQueryArgs: ({ queryArgs }) => {
        const { page, ...otherArgs } = queryArgs;
        return otherArgs;
      },
      merge: (currentCache, newItems, { arg }) => {
        if (arg.page === 1) {
          return newItems;
        }
        return {
          ...newItems,
          notifications: [...currentCache.notifications, ...newItems.notifications],
        };
      },
      forceRefetch({ currentArg, previousArg }) {
        return currentArg?.page !== previousArg?.page;
      },
    }),

    // Get unread count
    getUnreadCount: builder.query<{ count: number }, void>({
      query: () => '/unread-count',
      providesTags: ['Notification'],
    }),

    // Mark notifications as read
    markAsRead: builder.mutation<{ success: boolean }, MarkAsReadRequest>({
      query: (data) => ({
        url: '/mark-read',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Notification'],
      // Optimistic update
      async onQueryStarted({ notificationIds }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          notificationApi.util.updateQueryData('getNotifications', {}, (draft) => {
            draft.notifications.forEach((notification) => {
              if (notificationIds.includes(notification.id)) {
                notification.read = true;
              }
            });
          })
        );
        
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    // Mark all as read
    markAllAsRead: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/mark-all-read',
        method: 'POST',
      }),
      invalidatesTags: ['Notification'],
    }),

    // Delete notification
    deleteNotification: builder.mutation<{ success: boolean }, { id: string }>({
      query: ({ id }) => ({
        url: `/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Notification'],
      // Optimistic update
      async onQueryStarted({ id }, { dispatch, queryFulfilled }) {
        const patchResult = dispatch(
          notificationApi.util.updateQueryData('getNotifications', {}, (draft) => {
            draft.notifications = draft.notifications.filter(n => n.id !== id);
            draft.total -= 1;
          })
        );
        
        try {
          await queryFulfilled;
        } catch {
          patchResult.undo();
        }
      },
    }),

    // Delete multiple notifications
    deleteMultipleNotifications: builder.mutation<{ success: boolean }, { ids: string[] }>({
      query: (data) => ({
        url: '/bulk-delete',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Notification'],
    }),

    // Clear all notifications
    clearAllNotifications: builder.mutation<{ success: boolean }, void>({
      query: () => ({
        url: '/clear-all',
        method: 'DELETE',
      }),
      invalidatesTags: ['Notification'],
    }),

    // Get notification preferences
    getPreferences: builder.query<NotificationPreferences, void>({
      query: () => '/preferences',
      providesTags: ['NotificationPreferences'],
    }),

    // Update notification preferences
    updatePreferences: builder.mutation<NotificationPreferences, Partial<NotificationPreferences>>({
      query: (preferences) => ({
        url: '/preferences',
        method: 'PUT',
        body: preferences,
      }),
      invalidatesTags: ['NotificationPreferences'],
    }),

    // Test notification (for testing push notifications)
    testNotification: builder.mutation<{ success: boolean }, { type: string; message: string }>({
      query: (data) => ({
        url: '/test',
        method: 'POST',
        body: data,
      }),
    }),

    // Subscribe to push notifications
    subscribeToPush: builder.mutation<{ success: boolean }, { 
      endpoint: string;
      keys: {
        p256dh: string;
        auth: string;
      };
    }>({
      query: (subscription) => ({
        url: '/push-subscribe',
        method: 'POST',
        body: subscription,
      }),
    }),

    // Unsubscribe from push notifications
    unsubscribeFromPush: builder.mutation<{ success: boolean }, { endpoint: string }>({
      query: (data) => ({
        url: '/push-unsubscribe',
        method: 'POST',
        body: data,
      }),
    }),

    // Get notification statistics
    getNotificationStats: builder.query<{
      total: number;
      unread: number;
      byCategory: Record<string, number>;
      byPriority: Record<string, number>;
      recentActivity: Array<{
        date: string;
        count: number;
      }>;
    }, { days?: number }>({
      query: (params) => ({
        url: '/stats',
        params: {
          days: params.days || 30,
        },
      }),
    }),
  }),
});

export const {
  useGetNotificationsQuery,
  useGetUnreadCountQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useDeleteNotificationMutation,
  useDeleteMultipleNotificationsMutation,
  useClearAllNotificationsMutation,
  useGetPreferencesQuery,
  useUpdatePreferencesMutation,
  useTestNotificationMutation,
  useSubscribeToPushMutation,
  useUnsubscribeFromPushMutation,
  useGetNotificationStatsQuery,
} = notificationApi;