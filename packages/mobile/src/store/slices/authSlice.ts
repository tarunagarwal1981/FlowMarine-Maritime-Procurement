import {createSlice, PayloadAction} from '@reduxjs/toolkit';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  vessels: Array<{
    id: string;
    name: string;
    imoNumber: string;
  }>;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  biometricEnabled: boolean;
  lastLoginTime: string | null;
  sessionExpiry: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  biometricEnabled: false,
  lastLoginTime: null,
  sessionExpiry: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart: (state) => {
      state.isLoading = true;
    },
    loginSuccess: (state, action: PayloadAction<{
      user: User;
      token: string;
      refreshToken: string;
      sessionExpiry: string;
    }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.sessionExpiry = action.payload.sessionExpiry;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.lastLoginTime = new Date().toISOString();
    },
    loginFailure: (state) => {
      state.isLoading = false;
      state.isAuthenticated = false;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.lastLoginTime = null;
      state.sessionExpiry = null;
    },
    updateToken: (state, action: PayloadAction<{token: string; sessionExpiry: string}>) => {
      state.token = action.payload.token;
      state.sessionExpiry = action.payload.sessionExpiry;
    },
    setBiometricEnabled: (state, action: PayloadAction<boolean>) => {
      state.biometricEnabled = action.payload;
    },
    updateUserProfile: (state, action: PayloadAction<Partial<User>>) => {
      if (state.user) {
        state.user = {...state.user, ...action.payload};
      }
    },
  },
});

export const {
  loginStart,
  loginSuccess,
  loginFailure,
  logout,
  updateToken,
  setBiometricEnabled,
  updateUserProfile,
} = authSlice.actions;

export default authSlice.reducer;