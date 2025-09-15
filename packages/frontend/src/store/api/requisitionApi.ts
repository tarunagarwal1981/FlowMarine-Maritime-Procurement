/**
 * Requisition API using RTK Query
 * Handles API calls for requisitions with offline support
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { env } from '../../config/env';

export interface Requisition {
  id: string;
  requisitionNumber: string;
  vesselId: string;
  requestedById: string;
  urgencyLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  status: string;
  totalAmount: number;
  currency: string;
  deliveryLocation?: string;
  deliveryDate?: string;
  justification?: string;
  items: RequisitionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface RequisitionItem {
  id: string;
  itemCatalogId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  urgencyLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  justification?: string;
  specifications?: Record<string, any>;
}

export interface CreateRequisitionRequest {
  vesselId: string;
  urgencyLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  totalAmount: number;
  currency: string;
  deliveryLocation?: string;
  deliveryDate?: string;
  justification?: string;
  items: Omit<RequisitionItem, 'id'>[];
}

export const requisitionApi = createApi({
  reducerPath: 'requisitionApi',
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
  tagTypes: ['Requisition'],
  endpoints: (builder) => ({
    getRequisitions: builder.query<Requisition[], void>({
      query: () => '/requisitions',
      providesTags: ['Requisition'],
    }),
    getRequisition: builder.query<Requisition, string>({
      query: (id) => `/requisitions/${id}`,
      providesTags: (result, error, id) => [{ type: 'Requisition', id }],
    }),
    createRequisition: builder.mutation<Requisition, CreateRequisitionRequest>({
      query: (requisition) => ({
        url: '/requisitions',
        method: 'POST',
        body: requisition,
      }),
      invalidatesTags: ['Requisition'],
    }),
    updateRequisition: builder.mutation<Requisition, { id: string; updates: Partial<CreateRequisitionRequest> }>({
      query: ({ id, updates }) => ({
        url: `/requisitions/${id}`,
        method: 'PUT',
        body: updates,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Requisition', id }],
    }),
    deleteRequisition: builder.mutation<void, string>({
      query: (id) => ({
        url: `/requisitions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, id) => [{ type: 'Requisition', id }],
    }),
  }),
});

export const {
  useGetRequisitionsQuery,
  useGetRequisitionQuery,
  useCreateRequisitionMutation,
  useUpdateRequisitionMutation,
  useDeleteRequisitionMutation,
} = requisitionApi;