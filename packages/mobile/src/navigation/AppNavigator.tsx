import React, {useEffect, useState} from 'react';
import {useSelector, useDispatch} from 'react-redux';
import {RootState} from '../store/index';
import {loginSuccess, logout} from '../store/slices/authSlice';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import LoadingScreen from '../screens/LoadingScreen';
import ErrorBoundary from '../components/common/ErrorBoundary';
import {checkStoredAuth} from '../services/auth/AuthService';

const AppNavigator: React.FC = () => {
  const dispatch = useDispatch();
  const {isAuthenticated, isLoading} = useSelector((state: RootState) => state.auth);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Check if user has stored authentication
      const storedAuth = await checkStoredAuth();
      
      if (storedAuth && storedAuth.token && storedAuth.user) {
        // Validate token and restore session
        dispatch(loginSuccess({
          user: storedAuth.user,
          token: storedAuth.token,
          refreshToken: storedAuth.refreshToken || '',
          sessionExpiry: storedAuth.sessionExpiry || '',
        }));
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      // Clear any invalid stored auth
      dispatch(logout());
    } finally {
      setIsInitializing(false);
    }
  };

  // Show loading screen during initialization
  if (isInitializing || isLoading) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </ErrorBoundary>
  );
};

export default AppNavigator;