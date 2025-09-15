/**
 * Item Catalog API using RTK Query
 * Handles API calls for item catalog management
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { env } from '../../config/env';

export interface ItemCatalog {
  id: string;
  impaCode?: string;
  issaCode?: string;
  name: string;
  description?: string;
  category: string;
  criticalityLevel: 'SAFETY_CRITICAL' | 'OPERATIONAL_CRITICAL' | 'ROUTINE';
  specifications?: Record<string, any>;
  compatibleVesselTypes: string[];
  compatibleEngineTypes: string[];
  unitOfMeasure: string;
  averagePrice?: number;
  leadTime?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItemCatalogFilters {
  search?: string;
  category?: string;
  criticalityLevel?: string;
  vesselType?: string;
  engineType?: string;
  page?: number;
  limit?: number;
}

export const itemCatalogApi = createApi({
  reducerPath: 'itemCatalogApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${env.VITE_API_BASE_URL}/api`,
    prepareHeaders: (headers) => {
      const token = localStorage.getItem('token');
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  tagTypes: ['ItemCatalog'],
  endpoints: (builder) => ({
    getItemCatalog: builder.query<ItemCatalog[], ItemCatalogFilters>({
      query: (filters = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            params.append(key, value.toString());
          }
        });
        return `/catalog?${params.toString()}`;
      },
      providesTags: ['ItemCatalog'],
    }),
    getItemById: builder.query<ItemCatalog, string>({
      query: (id) => `/catalog/${id}`,
      providesTags: (result, error, id) => [{ type: 'ItemCatalog', id }],
    }),
    searchItems: builder.query<ItemCatalog[], { query: string; vesselId?: string }>({
      query: ({ query, vesselId }) => {
        const params = new URLSearchParams({ search: query });
        if (vesselId) params.append('vesselId', vesselId);
        return `/catalog/search?${params.toString()}`;
      },
      providesTags: ['ItemCatalog'],
    }),
  }),
});

export const {
  useGetItemCatalogQuery,
  useGetItemByIdQuery,
  useSearchItemsQuery,
} = itemCatalogApi;