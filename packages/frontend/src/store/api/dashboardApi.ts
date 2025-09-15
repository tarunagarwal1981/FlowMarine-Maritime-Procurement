/**
 * Dashboard API
 * RTK Query API for dashboard configuration management
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { RootState } from '../store';
import {
  DashboardConfiguration,
  DashboardTemplate,
  FilterPreset,
  DashboardExportOptions,
  DashboardShareOptions,
  UserRole
} from '../../types/dashboard';

export const dashboardApi = createApi({
  reducerPath: 'dashboardApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api/dashboard',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['DashboardConfig', 'DashboardTemplate', 'FilterPreset'],
  endpoints: (builder) => ({
    // Dashboard Configurations
    getDashboardConfigurations: builder.query<DashboardConfiguration[], void>({
      query: () => '/configurations',
      providesTags: ['DashboardConfig'],
    }),

    getDashboardConfiguration: builder.query<DashboardConfiguration, string>({
      query: (id) => `/configurations/${id}`,
      providesTags: (result, error, id) => [{ type: 'DashboardConfig', id }],
    }),

    createDashboardConfiguration: builder.mutation<DashboardConfiguration, {
      name: string;
      role: UserRole;
      basedOnTemplate?: string;
    }>({
      query: (data) => ({
        url: '/configurations',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['DashboardConfig'],
    }),

    updateDashboardConfiguration: builder.mutation<DashboardConfiguration, {
      id: string;
      updates: Partial<DashboardConfiguration>;
    }>({
      query: ({ id, updates }) => ({
        url: `/configurations/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'DashboardConfig', id }],
    }),

    deleteDashboardConfiguration: builder.mutation<void, string>({
      query: (id) => ({
        url: `/configurations/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['DashboardConfig'],
    }),

    cloneDashboardConfiguration: builder.mutation<DashboardConfiguration, {
      id: string;
      name: string;
    }>({
      query: ({ id, name }) => ({
        url: `/configurations/${id}/clone`,
        method: 'POST',
        body: { name },
      }),
      invalidatesTags: ['DashboardConfig'],
    }),

    setDefaultConfiguration: builder.mutation<void, string>({
      query: (id) => ({
        url: `/configurations/${id}/set-default`,
        method: 'POST',
      }),
      invalidatesTags: ['DashboardConfig'],
    }),

    // Dashboard Templates
    getDashboardTemplates: builder.query<DashboardTemplate[], {
      role?: UserRole;
      category?: string;
      isPublic?: boolean;
    }>({
      query: (params) => ({
        url: '/templates',
        params,
      }),
      providesTags: ['DashboardTemplate'],
    }),

    getDashboardTemplate: builder.query<DashboardTemplate, string>({
      query: (id) => `/templates/${id}`,
      providesTags: (result, error, id) => [{ type: 'DashboardTemplate', id }],
    }),

    createDashboardTemplate: builder.mutation<DashboardTemplate, {
      name: string;
      description: string;
      role: UserRole;
      category: 'executive' | 'operational' | 'financial' | 'custom';
      configurationId: string;
      layoutType: 'executive' | 'operational' | 'financial';
      isPublic: boolean;
      tags: string[];
    }>({
      query: (data) => ({
        url: '/templates',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['DashboardTemplate'],
    }),

    updateDashboardTemplate: builder.mutation<DashboardTemplate, {
      id: string;
      updates: Partial<DashboardTemplate>;
    }>({
      query: ({ id, updates }) => ({
        url: `/templates/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'DashboardTemplate', id }],
    }),

    deleteDashboardTemplate: builder.mutation<void, string>({
      query: (id) => ({
        url: `/templates/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['DashboardTemplate'],
    }),

    // Filter Presets
    getFilterPresets: builder.query<FilterPreset[], {
      isPublic?: boolean;
      tags?: string[];
    }>({
      query: (params) => ({
        url: '/filter-presets',
        params,
      }),
      providesTags: ['FilterPreset'],
    }),

    getFilterPreset: builder.query<FilterPreset, string>({
      query: (id) => `/filter-presets/${id}`,
      providesTags: (result, error, id) => [{ type: 'FilterPreset', id }],
    }),

    createFilterPreset: builder.mutation<FilterPreset, {
      name: string;
      description?: string;
      filters: any;
      isPublic: boolean;
      tags: string[];
    }>({
      query: (data) => ({
        url: '/filter-presets',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['FilterPreset'],
    }),

    updateFilterPreset: builder.mutation<FilterPreset, {
      id: string;
      updates: Partial<FilterPreset>;
    }>({
      query: ({ id, updates }) => ({
        url: `/filter-presets/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'FilterPreset', id }],
    }),

    deleteFilterPreset: builder.mutation<void, string>({
      query: (id) => ({
        url: `/filter-presets/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['FilterPreset'],
    }),

    // Dashboard Export
    exportDashboard: builder.mutation<Blob, {
      configurationId: string;
      layoutType: 'executive' | 'operational' | 'financial';
      options: DashboardExportOptions;
    }>({
      query: ({ configurationId, layoutType, options }) => ({
        url: `/configurations/${configurationId}/layouts/${layoutType}/export`,
        method: 'POST',
        body: options,
        responseHandler: (response) => response.blob(),
      }),
    }),

    // Dashboard Sharing
    shareDashboard: builder.mutation<{ shareUrl: string; shareId: string }, {
      configurationId: string;
      layoutType: 'executive' | 'operational' | 'financial';
      options: DashboardShareOptions;
    }>({
      query: ({ configurationId, layoutType, options }) => ({
        url: `/configurations/${configurationId}/layouts/${layoutType}/share`,
        method: 'POST',
        body: options,
      }),
    }),

    getSharedDashboard: builder.query<{
      configuration: DashboardConfiguration;
      layoutType: 'executive' | 'operational' | 'financial';
      hasAccess: boolean;
    }, {
      shareId: string;
      password?: string;
    }>({
      query: ({ shareId, password }) => ({
        url: `/shared/${shareId}`,
        method: 'POST',
        body: password ? { password } : {},
      }),
    }),

    // Widget Data Sources
    getAvailableWidgets: builder.query<{
      widgetType: string;
      name: string;
      description: string;
      permissions: string[];
      defaultConfiguration: any;
    }[], UserRole>({
      query: (role) => `/widgets/available?role=${role}`,
    }),

    validateWidgetConfiguration: builder.mutation<{
      isValid: boolean;
      errors: string[];
      warnings: string[];
    }, {
      widgetType: string;
      configuration: any;
    }>({
      query: (data) => ({
        url: '/widgets/validate',
        method: 'POST',
        body: data,
      }),
    }),

    // Dashboard Analytics
    getDashboardUsageAnalytics: builder.query<{
      totalViews: number;
      uniqueUsers: number;
      averageSessionTime: number;
      mostUsedWidgets: Array<{
        widgetType: string;
        usageCount: number;
        averageInteractionTime: number;
      }>;
      performanceMetrics: {
        averageLoadTime: number;
        errorRate: number;
        refreshRate: number;
      };
    }, {
      configurationId?: string;
      dateRange?: {
        from: Date;
        to: Date;
      };
    }>({
      query: (params) => ({
        url: '/analytics/usage',
        params,
      }),
    }),

    // Bulk Operations
    bulkUpdateConfigurations: builder.mutation<DashboardConfiguration[], {
      configurationIds: string[];
      updates: Partial<DashboardConfiguration>;
    }>({
      query: (data) => ({
        url: '/configurations/bulk-update',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['DashboardConfig'],
    }),

    bulkDeleteConfigurations: builder.mutation<void, string[]>({
      query: (configurationIds) => ({
        url: '/configurations/bulk-delete',
        method: 'DELETE',
        body: { configurationIds },
      }),
      invalidatesTags: ['DashboardConfig'],
    }),

    // Import/Export
    importConfiguration: builder.mutation<DashboardConfiguration, {
      file: File;
      overwriteExisting?: boolean;
    }>({
      query: ({ file, overwriteExisting }) => {
        const formData = new FormData();
        formData.append('file', file);
        if (overwriteExisting) {
          formData.append('overwriteExisting', 'true');
        }
        return {
          url: '/configurations/import',
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: ['DashboardConfig'],
    }),

    exportConfiguration: builder.mutation<Blob, {
      configurationId: string;
      includeData?: boolean;
    }>({
      query: ({ configurationId, includeData }) => ({
        url: `/configurations/${configurationId}/export`,
        method: 'POST',
        body: { includeData },
        responseHandler: (response) => response.blob(),
      }),
    }),
  }),
});

export const {
  useGetDashboardConfigurationsQuery,
  useGetDashboardConfigurationQuery,
  useCreateDashboardConfigurationMutation,
  useUpdateDashboardConfigurationMutation,
  useDeleteDashboardConfigurationMutation,
  useCloneDashboardConfigurationMutation,
  useSetDefaultConfigurationMutation,
  useGetDashboardTemplatesQuery,
  useGetDashboardTemplateQuery,
  useCreateDashboardTemplateMutation,
  useUpdateDashboardTemplateMutation,
  useDeleteDashboardTemplateMutation,
  useGetFilterPresetsQuery,
  useGetFilterPresetQuery,
  useCreateFilterPresetMutation,
  useUpdateFilterPresetMutation,
  useDeleteFilterPresetMutation,
  useExportDashboardMutation,
  useShareDashboardMutation,
  useGetSharedDashboardQuery,
  useGetAvailableWidgetsQuery,
  useValidateWidgetConfigurationMutation,
  useGetDashboardUsageAnalyticsQuery,
  useBulkUpdateConfigurationsMutation,
  useBulkDeleteConfigurationsMutation,
  useImportConfigurationMutation,
  useExportConfigurationMutation,
} = dashboardApi;