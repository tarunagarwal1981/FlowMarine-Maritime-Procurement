import { createSlice } from '@reduxjs/toolkit';

interface AuthState {
  isAuthenticated: boolean;
  user: any;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action) => {
      state.isAuthenticated = true;
      state.user = action.payload;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
    }
  }
});

export const { login, logout } = authSlice.actions;
export const selectIsAuthenticated = (state: any) => state.auth.isAuthenticated;
export const selectUser = (state: any) => state.auth.user;
export const selectHasPermission = (state: any) => (permission: string) => true; // Simplified for now
export default authSlice.reducer;