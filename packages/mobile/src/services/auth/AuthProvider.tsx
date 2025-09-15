import React, {createContext, useContext, useEffect, ReactNode} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {RootState} from '@store/index';
import {loginSuccess, logout, updateToken} from '@store/slices/authSlice';

interface AuthContextType {
  isAuthenticated: boolean;
  user: any;
  login: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({children}) => {
  const dispatch = useDispatch();
  const {isAuthenticated, user, token, refreshToken: storedRefreshToken} = useSelector(
    (state: RootState) => state.auth
  );

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('user_data');
      const storedRefresh = await AsyncStorage.getItem('refresh_token');

      if (storedToken && storedUser && storedRefresh) {
        const userData = JSON.parse(storedUser);
        dispatch(loginSuccess({
          user: userData,
          token: storedToken,
          refreshToken: storedRefresh,
          sessionExpiry: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        }));
      }
    } catch (error) {
      console.error('Error checking auth state:', error);
    }
  };

  const login = async (credentials: any) => {
    try {
      // Implementation would call authentication API
      // For now, simulate login
      const response = {
        user: credentials.user,
        token: credentials.token,
        refreshToken: credentials.refreshToken,
        sessionExpiry: credentials.sessionExpiry,
      };

      // Store credentials
      await AsyncStorage.setItem('auth_token', response.token);
      await AsyncStorage.setItem('user_data', JSON.stringify(response.user));
      await AsyncStorage.setItem('refresh_token', response.refreshToken);

      dispatch(loginSuccess(response));
    } catch (error) {
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      // Clear stored credentials
      await AsyncStorage.multiRemove(['auth_token', 'user_data', 'refresh_token']);
      dispatch(logout());
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  const refreshTokenHandler = async () => {
    try {
      if (!storedRefreshToken) {
        throw new Error('No refresh token available');
      }

      // Implementation would call refresh token API
      // For now, simulate token refresh
      const newToken = 'new-jwt-token';
      const newExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();

      await AsyncStorage.setItem('auth_token', newToken);
      dispatch(updateToken({token: newToken, sessionExpiry: newExpiry}));
    } catch (error) {
      console.error('Error refreshing token:', error);
      await handleLogout();
    }
  };

  const contextValue: AuthContextType = {
    isAuthenticated,
    user,
    login,
    logout: handleLogout,
    refreshToken: refreshTokenHandler,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};