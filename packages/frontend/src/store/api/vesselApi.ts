/**
 * Vessel API using RTK Query
 * Handles API calls for vessel management
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { env } from '../../config/env';

export interface Vessel {
  id: string;
  name: string;
  imoNumber: string;
  vesselType: string;
  flag: string;
  engineType: string;
  cargoCapacity: number;
  fuelConsumption: number;
  crewComplement: number;
  currentLatitude?: number;
  currentLongitude?: number;
  positionUpdatedAt?: string;
  currentDeparture?: string;
  currentDestination?: string;
  currentETA?: string;
  currentRoute?: string;
  createdAt: string;
  updatedAt: string;
}

export const vesselApi = createApi({
  reducerPath: 'vesselApi',
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
  tagTypes: ['Vessel'],
  endpoints: (builder) => ({
    getVessels: builder.query<Vessel[], void>({
      query: () => '/vessels',
      providesTags: ['Vessel'],
    }),
    getVessel: builder.query<Vessel, string>({
      query: (id) => `/vessels/${id}`,
      providesTags: (result, error, id) => [{ type: 'Vessel', id }],
    }),
  }),
});

export const {
  useGetVesselsQuery,
  useGetVesselQuery,
} = vesselApi;