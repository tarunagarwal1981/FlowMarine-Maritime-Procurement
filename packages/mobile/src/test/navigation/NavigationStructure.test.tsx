import React from 'react';
import {render} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {NavigationContainer} from '@react-navigation/native';
import {configureStore} from '@reduxjs/toolkit';

// Import navigation components
import AppNavigator from '../../navigation/AppNavigator';
import AuthNavigator from '../../navigation/AuthNavigator';
import MainNavigator from '../../navigation/MainNavigator';
import TabNavigator from '../../navigation/TabNavigator';

// Import slices
import authSlice from '../../store/slices/authSlice';
import navigationSlice from '../../store/slices/navigationSlice';
import requisitionSlice from '../../store/slices/requisitionSlice';
import vendorSlice from '../../store/slices/vendorSlice';
import notificationSlice from '../../store/slices/notificationSlice';
import offlineSlice from '../../store/slices/offlineSlice';
import dashboardSlice from '../../store/slices/dashboardSlice';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
  mergeItem: jest.fn(() => Promise.resolve()),
}));

// Mock react-native-keychain
jest.mock('react-native-keychain', () => ({
  setInternetCredentials: jest.fn(() => Promise.resolve()),
  getInternetCredentials: jest.fn(() => Promise.resolve(false)),
  resetInternetCredentials: jest.fn(() => Promise.resolve()),
}));

// Mock biometric services
jest.mock('react-native-biometrics', () => ({
  isSensorAvailable: jest.fn(() => Promise.resolve({available: true, biometryType: 'TouchID'})),
  createKeys: jest.fn(() => Promise.resolve()),
  biometricKeysExist: jest.fn(() => Promise.resolve({keysExist: false})),
}));

// Create test store
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice,
      navigation: navigationSlice,
      requisitions: requisitionSlice,
      vendors: vendorSlice,
      notifications: notificationSlice,
      offline: offlineSlice,
      dashboard: dashboardSlice,
    },
    preloadedState: initialState,
  });
};

const renderWithNavigation = (component: React.ReactElement, initialState = {}) => {
  const store = createTestStore(initialState);
  return render(
    <Provider store={store}>
      <NavigationContainer>
        {component}
      </NavigationContainer>
    </Provider>
  );
};

describe('Navigation Structure', () => {
  describe('AppNavigator', () => {
    it('should render loading screen initially', () => {
      const {getByText} = renderWithNavigation(<AppNavigator />);
      expect(getByText('Loading...')).toBeTruthy();
    });

    it('should render AuthNavigator when not authenticated', async () => {
      const initialState = {
        auth: {
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          biometricEnabled: false,
          lastLoginTime: null,
          sessionExpiry: null,
        },
      };

      const {findByText} = renderWithNavigation(<AppNavigator />, initialState);
      
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should show login screen
      expect(await findByText('Sign In')).toBeTruthy();
    });

    it('should render MainNavigator when authenticated', async () => {
      const initialState = {
        auth: {
          user: {
            id: '1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'CREW',
            vessels: [],
            permissions: [],
          },
          token: 'test-token',
          refreshToken: 'test-refresh-token',
          isAuthenticated: true,
          isLoading: false,
          biometricEnabled: false,
          lastLoginTime: new Date().toISOString(),
          sessionExpiry: new Date(Date.now() + 3600000).toISOString(),
        },
      };

      const {findByText} = renderWithNavigation(<AppNavigator />, initialState);
      
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should show main app content
      expect(await findByText('FlowMarine')).toBeTruthy();
    });
  });

  describe('AuthNavigator', () => {
    it('should render login screen by default', () => {
      const {getByText} = renderWithNavigation(<AuthNavigator />);
      expect(getByText('Sign In')).toBeTruthy();
    });
  });

  describe('MainNavigator', () => {
    it('should render drawer navigation', () => {
      const initialState = {
        auth: {
          user: {
            id: '1',
            email: 'test@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'CREW',
            vessels: [],
            permissions: [],
          },
          token: 'test-token',
          isAuthenticated: true,
          isLoading: false,
        },
        notifications: {
          items: [],
          unreadCount: 0,
        },
      };

      const {getByText} = renderWithNavigation(<MainNavigator />, initialState);
      expect(getByText('FlowMarine')).toBeTruthy();
    });
  });

  describe('TabNavigator', () => {
    it('should render all tab screens', () => {
      const initialState = {
        notifications: {
          items: [],
          unreadCount: 0,
        },
      };

      const {getByText} = renderWithNavigation(<TabNavigator />, initialState);
      
      // Check if tab navigation is rendered
      expect(getByText('Home')).toBeTruthy();
      expect(getByText('Requisitions')).toBeTruthy();
      expect(getByText('Vendors')).toBeTruthy();
      expect(getByText('Analytics')).toBeTruthy();
      expect(getByText('Notifications')).toBeTruthy();
    });

    it('should show notification badge when there are unread notifications', () => {
      const initialState = {
        notifications: {
          items: [
            {id: '1', title: 'Test', message: 'Test message', read: false},
          ],
          unreadCount: 1,
        },
      };

      const {getByText} = renderWithNavigation(<TabNavigator />, initialState);
      expect(getByText('1')).toBeTruthy(); // Badge count
    });
  });
});

describe('Navigation Type Safety', () => {
  it('should have proper TypeScript types for all navigators', () => {
    // This test ensures that all navigation types are properly exported
    // and can be imported without TypeScript errors
    
    // Import all navigation types
    const authTypes = require('../../navigation/AuthNavigator');
    const mainTypes = require('../../navigation/MainNavigator');
    const tabTypes = require('../../navigation/TabNavigator');
    const homeTypes = require('../../navigation/stacks/HomeStackNavigator');
    const requisitionTypes = require('../../navigation/stacks/RequisitionStackNavigator');
    const vendorTypes = require('../../navigation/stacks/VendorStackNavigator');
    const analyticsTypes = require('../../navigation/stacks/AnalyticsStackNavigator');
    const notificationTypes = require('../../navigation/stacks/NotificationStackNavigator');
    
    // Verify that type exports exist
    expect(authTypes.default).toBeDefined();
    expect(mainTypes.default).toBeDefined();
    expect(tabTypes.default).toBeDefined();
    expect(homeTypes.default).toBeDefined();
    expect(requisitionTypes.default).toBeDefined();
    expect(vendorTypes.default).toBeDefined();
    expect(analyticsTypes.default).toBeDefined();
    expect(notificationTypes.default).toBeDefined();
  });
});

describe('Error Boundary Integration', () => {
  it('should handle navigation errors gracefully', () => {
    // Mock console.error to prevent error output in tests
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    const ThrowError = () => {
      throw new Error('Test navigation error');
    };
    
    const {getByText} = renderWithNavigation(<ThrowError />);
    
    // Should show error boundary
    expect(getByText('Oops! Something went wrong')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
    
    consoleSpy.mockRestore();
  });
});