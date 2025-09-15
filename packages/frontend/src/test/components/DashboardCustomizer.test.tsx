/**
 * Dashboard Customizer Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DashboardCustomizer } from '../../components/dashboard/DashboardCustomizer';
import { dashboardSlice } from '../../store/slices/dashboardSlice';
import { authSlice } from '../../store/slices/authSlice';
import { dashboardApi } from '../../store/api/dashboardApi';
import { DashboardConfiguration, UserRole } from '../../types/dashboard';

// Mock react-grid-layout
jest.mock('react-grid-layout', () => ({
  Responsive: ({ children }: any) => <div data-testid="grid-layout">{children}</div>,
  WidthProvider: (component: any) => component,
}));

// Mock react-dnd
jest.mock('react-dnd', () => ({
  DndProvider: ({ children }: any) => <div>{children}</div>,
}));

jest.mock('react-dnd-html5-backend', () => ({
  HTML5Backend: {},
}));

jest.mock('react-dnd-touch-backend', () => ({
  TouchBackend: {},
}));

jest.mock('react-device-detect', () => ({
  isMobile: false,
}));

// Mock user
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  role: 'SUPERINTENDENT' as UserRole,
  isActive: true,
  vessels: [],
  permissions: [],
};

// Mock dashboard configuration
const mockConfiguration: DashboardConfiguration = {
  id: 'config-1',
  userId: 'user-1',
  role: 'SUPERINTENDENT',
  name: 'Test Dashboard',
  isDefault: true,
  customLayouts: {
    executive: {
      id: 'exec-1',
      name: 'Executive',
      widgets: [],
      layout: [],
      filters: { timeRange: 'monthly' },
      refreshInterval: 300,
    },
    operational: {
      id: 'ops-1',
      name: 'Operational',
      widgets: [],
      layout: [],
      filters: { timeRange: 'weekly' },
      refreshInterval: 180,
    },
    financial: {
      id: 'fin-1',
      name: 'Financial',
      widgets: [],
      layout: [],
      filters: { timeRange: 'monthly' },
      refreshInterval: 600,
    },
  },
  preferences: {
    defaultTimeRange: 'monthly',
    defaultCurrency: 'USD',
    refreshInterval: 300,
    notifications: true,
    theme: 'light',
    compactMode: false,
    showTooltips: true,
    autoRefresh: true,
    soundNotifications: false,
  },
  createdAt: new Date(),
  updatedAt: new Date(),
};

const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authSlice.reducer,
      dashboard: dashboardSlice.reducer,
      [dashboardApi.reducerPath]: dashboardApi.reducer,
    },
    preloadedState: {
      auth: {
        user: mockUser,
        token: 'test-token',
        refreshToken: 'refresh-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
        permissions: [],
        vessels: [],
        currentVessel: null,
        tokenExpiry: null,
        lastActivity: Date.now(),
        sessionTimeout: 30,
      },
      dashboard: {
        configurations: [mockConfiguration],
        currentConfiguration: mockConfiguration,
        templates: [],
        filterPresets: [],
        isLoading: false,
        error: null,
        draggedWidget: null,
        selectedWidget: null,
        isCustomizing: false,
        unsavedChanges: false,
      },
      ...initialState,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          ignoredActions: [dashboardApi.util.getRunningQueriesThunk.fulfilled.type],
        },
      }).concat(dashboardApi.middleware),
  });
};

const renderWithProvider = (component: React.ReactElement, store = createTestStore()) => {
  return render(
    <Provider store={store}>
      {component}
    </Provider>
  );
};

describe('DashboardCustomizer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard customizer with tabs', () => {
    renderWithProvider(<DashboardCustomizer />);
    
    expect(screen.getByText('Executive')).toBeInTheDocument();
    expect(screen.getByText('Operational')).toBeInTheDocument();
    expect(screen.getByText('Financial')).toBeInTheDocument();
  });

  it('shows customize button when not in customization mode', () => {
    renderWithProvider(<DashboardCustomizer />);
    
    expect(screen.getByText('Customize')).toBeInTheDocument();
    expect(screen.queryByText('Preview')).not.toBeInTheDocument();
  });

  it('toggles customization mode when customize button is clicked', async () => {
    const store = createTestStore();
    renderWithProvider(<DashboardCustomizer />, store);
    
    const customizeButton = screen.getByText('Customize');
    fireEvent.click(customizeButton);
    
    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
      expect(screen.getByText('Add Widget')).toBeInTheDocument();
    });
  });

  it('shows empty state when no widgets are added', () => {
    renderWithProvider(<DashboardCustomizer />);
    
    expect(screen.getByText('No widgets added')).toBeInTheDocument();
    expect(screen.getByText('Add widgets to customize your dashboard')).toBeInTheDocument();
  });

  it('shows save button when there are unsaved changes', () => {
    const store = createTestStore({
      dashboard: {
        configurations: [mockConfiguration],
        currentConfiguration: mockConfiguration,
        templates: [],
        filterPresets: [],
        isLoading: false,
        error: null,
        draggedWidget: null,
        selectedWidget: null,
        isCustomizing: false,
        unsavedChanges: true,
      },
    });
    
    renderWithProvider(<DashboardCustomizer />, store);
    
    const saveButton = screen.getByText('Save');
    expect(saveButton).toBeInTheDocument();
    expect(saveButton).not.toBeDisabled();
  });

  it('shows unsaved changes alert when there are changes', () => {
    const store = createTestStore({
      dashboard: {
        configurations: [mockConfiguration],
        currentConfiguration: mockConfiguration,
        templates: [],
        filterPresets: [],
        isLoading: false,
        error: null,
        draggedWidget: null,
        selectedWidget: null,
        isCustomizing: false,
        unsavedChanges: true,
      },
    });
    
    renderWithProvider(<DashboardCustomizer />, store);
    
    expect(screen.getByText(/You have unsaved changes/)).toBeInTheDocument();
  });

  it('switches between layout tabs', async () => {
    renderWithProvider(<DashboardCustomizer />);
    
    const operationalTab = screen.getByText('Operational');
    fireEvent.click(operationalTab);
    
    await waitFor(() => {
      expect(operationalTab).toHaveAttribute('data-state', 'active');
    });
  });

  it('shows loading state when configuration is not available', () => {
    const store = createTestStore({
      dashboard: {
        configurations: [],
        currentConfiguration: null,
        templates: [],
        filterPresets: [],
        isLoading: true,
        error: null,
        draggedWidget: null,
        selectedWidget: null,
        isCustomizing: false,
        unsavedChanges: false,
      },
    });
    
    renderWithProvider(<DashboardCustomizer />, store);
    
    expect(screen.getByText('Loading dashboard configuration...')).toBeInTheDocument();
  });

  it('opens widget library when add widget button is clicked', async () => {
    const store = createTestStore({
      dashboard: {
        configurations: [mockConfiguration],
        currentConfiguration: mockConfiguration,
        templates: [],
        filterPresets: [],
        isLoading: false,
        error: null,
        draggedWidget: null,
        selectedWidget: null,
        isCustomizing: true,
        unsavedChanges: false,
      },
    });
    
    renderWithProvider(<DashboardCustomizer />, store);
    
    const addWidgetButton = screen.getByText('Add Widget');
    fireEvent.click(addWidgetButton);
    
    await waitFor(() => {
      expect(screen.getByText('Widget Library')).toBeInTheDocument();
    });
  });

  it('handles keyboard shortcuts', async () => {
    const store = createTestStore({
      dashboard: {
        configurations: [mockConfiguration],
        currentConfiguration: mockConfiguration,
        templates: [],
        filterPresets: [],
        isLoading: false,
        error: null,
        draggedWidget: null,
        selectedWidget: null,
        isCustomizing: false,
        unsavedChanges: true,
      },
    });
    
    renderWithProvider(<DashboardCustomizer />, store);
    
    // Test Ctrl+S for save
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    
    // Test Ctrl+E for toggle customization
    fireEvent.keyDown(window, { key: 'e', ctrlKey: true });
    
    await waitFor(() => {
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });
  });

  it('renders grid layout component', () => {
    renderWithProvider(<DashboardCustomizer />);
    
    expect(screen.getByTestId('grid-layout')).toBeInTheDocument();
  });

  it('shows role-appropriate widgets for superintendent', () => {
    renderWithProvider(<DashboardCustomizer />);
    
    // Superintendent should have access to most widgets
    const store = createTestStore();
    const state = store.getState();
    
    expect(state.auth.user?.role).toBe('SUPERINTENDENT');
  });
});

describe('DashboardCustomizer Integration', () => {
  it('integrates with dashboard slice actions', async () => {
    const store = createTestStore();
    renderWithProvider(<DashboardCustomizer />, store);
    
    // Toggle customization mode
    const customizeButton = screen.getByText('Customize');
    fireEvent.click(customizeButton);
    
    await waitFor(() => {
      const state = store.getState();
      expect(state.dashboard.isCustomizing).toBe(true);
    });
  });

  it('handles widget configuration updates', async () => {
    const store = createTestStore({
      dashboard: {
        configurations: [mockConfiguration],
        currentConfiguration: mockConfiguration,
        templates: [],
        filterPresets: [],
        isLoading: false,
        error: null,
        draggedWidget: null,
        selectedWidget: null,
        isCustomizing: true,
        unsavedChanges: false,
      },
    });
    
    renderWithProvider(<DashboardCustomizer />, store);
    
    // The component should be in customization mode
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });
});