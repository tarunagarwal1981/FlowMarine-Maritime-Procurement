/**
 * Authentication API
 * RTK Query API for authentication operations
 */

import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../store';
import { env } from '../../config/env';

export interface LoginRequest {
  email: string;
  password: string;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    language: string;
  };
}

export interface LoginResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    isActive: boolean;
    vessels: Array<{
      id: string;
      name: string;
      imoNumber: string;
      vesselType: string;
      flag: string;
      currentPosition?: {
        latitude: number;
        longitude: number;
        lastUpdate: string;
      };
    }>;
    permissions: Array<{
      id: string;
      name: string;
      resource: string;
      action: string;
    }>;
    lastLogin?: string;
  };
  token: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  token: string;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  vesselIds?: string[];
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
}

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: fetchBaseQuery({
    baseUrl: `${env.VITE_API_BASE_URL}/auth`,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      headers.set('content-type', 'application/json');
      return headers;
    },
  }),
  tagTypes: ['User', 'Session'],
  endpoints: (builder) => ({
    // Login
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: '/login',
        method: 'POST',
        body: {
          ...credentials,
          deviceInfo: {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            ...credentials.deviceInfo,
          },
        },
      }),
      invalidatesTags: ['User', 'Session'],
    }),

    // Logout
    logout: builder.mutation<void, void>({
      query: () => ({
        url: '/logout',
        method: 'POST',
      }),
      invalidatesTags: ['User', 'Session'],
    }),

    // Refresh token
    refreshToken: builder.mutation<RefreshTokenResponse, RefreshTokenRequest>({
      query: (data) => ({
        url: '/refresh',
        method: 'POST',
        body: data,
      }),
    }),

    // Register (admin only)
    register: builder.mutation<{ message: string }, RegisterRequest>({
      query: (userData) => ({
        url: '/register',
        method: 'POST',
        body: userData,
      }),
    }),

    // Forgot password
    forgotPassword: builder.mutation<{ message: string }, ForgotPasswordRequest>({
      query: (data) => ({
        url: '/forgot-password',
        method: 'POST',
        body: data,
      }),
    }),

    // Reset password
    resetPassword: builder.mutation<{ message: string }, ResetPasswordRequest>({
      query: (data) => ({
        url: '/reset-password',
        method: 'POST',
        body: data,
      }),
    }),

    // Change password
    changePassword: builder.mutation<{ message: string }, ChangePasswordRequest>({
      query: (data) => ({
        url: '/change-password',
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Session'],
    }),

    // Get current user profile
    getProfile: builder.query<LoginResponse['user'], void>({
      query: () => '/profile',
      providesTags: ['User'],
    }),

    // Update profile
    updateProfile: builder.mutation<LoginResponse['user'], UpdateProfileRequest>({
      query: (data) => ({
        url: '/profile',
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['User'],
    }),

    // Verify email
    verifyEmail: builder.mutation<{ message: string }, { token: string }>({
      query: (data) => ({
        url: '/verify-email',
        method: 'POST',
        body: data,
      }),
    }),

    // Resend verification email
    resendVerification: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: '/resend-verification',
        method: 'POST',
      }),
    }),

    // Get active sessions
    getSessions: builder.query<Array<{
      id: string;
      deviceInfo: string;
      ipAddress: string;
      lastActivity: string;
      isCurrent: boolean;
    }>, void>({
      query: () => '/sessions',
      providesTags: ['Session'],
    }),

    // Revoke session
    revokeSession: builder.mutation<{ message: string }, { sessionId: string }>({
      query: (data) => ({
        url: `/sessions/${data.sessionId}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Session'],
    }),

    // Revoke all other sessions
    revokeAllOtherSessions: builder.mutation<{ message: string }, void>({
      query: () => ({
        url: '/sessions/revoke-others',
        method: 'POST',
      }),
      invalidatesTags: ['Session'],
    }),

    // Check token validity
    validateToken: builder.query<{ valid: boolean; expiresAt: string }, void>({
      query: () => '/validate-token',
    }),

    // Get user permissions
    getPermissions: builder.query<Array<{
      id: string;
      name: string;
      resource: string;
      action: string;
      description?: string;
    }>, void>({
      query: () => '/permissions',
      providesTags: ['User'],
    }),
  }),
});

export const {
  useLoginMutation,
  useLogoutMutation,
  useRefreshTokenMutation,
  useRegisterMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useChangePasswordMutation,
  useGetProfileQuery,
  useUpdateProfileMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useRevokeAllOtherSessionsMutation,
  useValidateTokenQuery,
  useGetPermissionsQuery,
} = authApi;