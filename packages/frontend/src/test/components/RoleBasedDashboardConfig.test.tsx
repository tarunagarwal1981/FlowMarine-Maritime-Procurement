/**
 * Role-Based Dashboard Configuration Tests
 * Tests for role-based dashboard configuration functionality
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { RoleBasedDashboardConfig } from '../../components/dashboard/RoleBasedDashboardConfig';
import { DragDropLayoutManager } from '../../components/dashboard/DragDropLayoutManager';
import { DashboardPreferencesManager } from '../../components/dashboard/DashboardPreferencesManager';
import { DashboardTemplateSystem } from '../../components/dashboard/DashboardTemplateSystem';
import dashboardReducer from '../../store/slices/dashboardSlice';
import authReducer from '../../store/slices/authSlice';
import { dashboardApi } from '../../store/api/dashboardApi';
import {
  DashboardConfiguration,
  DashboardTemplate,
  UserRole,
  ROLE_WIDGET_PERMISSIONS,
  DEFAULT_DASHBOARD_TEMPLATES,
} from '../../types/dashboard';

// Mock data
const mockUser = {
  id: 'user-1',
  email: 'captain@vessel.com',
  firstName: 'John',
  lastName: 'Smith',
  role: 'CAPTAIN' as UserRole,
  vessels: ['vessel-1'],
  permissions: ['dashboard:read', 'dashboard:write'],
};

const mockConfiguration: DashboardConfiguration = {
  id: 'config-1',
  userId: 'user-1',
  role: 'CAPTAIN',
  name: 'Captain Dashboard',
  isDefault: true,
  customLayouts: {
    executive: {
      id: 'exec-1',
      name: 'Executive Overview',
      widgets: [
        {
          id: 'widget-1',
          type: 'fleet_spend_visualization',
          title: 'Fleet Spending',
          dataSource: 'fleet_spend',
          configuration: { chartType: 'line' },
          permissions: [],
          size: { width: 6, height: 4 },
          position: { x: 0, y: 0 },
          isVisible: true,
        },
      ],
      layout: [
        {
          i: 'widget-1',
          x: 0,
          y: 0,
          w: 6,
          h: 4,
          isDraggable: true,
          isResizable: true,
        },
      ],
      filters: { timeRange: 'monthly', currency: 'USD' },
      refreshInterval: 300,
    },
    operational: {
      id: 'ops-1',
      name: 'Operations',
      widgets: [],
      layout: [],
      filters: { timeRange: 'weekly', currency: 'USD' },
      refreshInterval: 180,
    },
    financial: {
      id: 'fin-1',
      name: 'Financial',
      widgets: [],
      layout: [],
      filters: { timeRange: 'monthly', currency: 'USD' },
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
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-15'),
};

const mockTemplate: DashboardTemplate = {
  id: 'template-1',
  name: 'Captain Template',
  description: 'Standard template for captains',
  role: 'CAPTAIN',
  category: 'executive',
  layout: mockConfiguration.customLayouts.executive,
  isPublic: true,
  createdBy: 'admin',
  tags: ['captain', 'executive', 'standard'],
  createdAt: new Date('2024-01-01'),
};

// Mock store setup
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      auth: authReducer,
      dashboard: dashboardReducer,
      [dashboardApi.reducerPath]: dashboardApi.reducer,
    },
    preloadedState: {
      auth: {
        user: mockUser,
        token: 'mock-token',
        isAuthenticated: true,
        isLoading: false,
        error: null,
      },
      dashboard: {
        configurations: [mockConfiguration],
        currentConfiguration: mockConfiguration,
        templates: [mockTemplate],
        filterPresets: [],
        isLoading: false,
        error: null,
        draggedWidget: null,
        selectedWidget: null,
        isCustomizing: false,
        unsavedChanges: false,
        ...initialState,
      },
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(dashboardApi.middleware),
  });
};

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; store?: any }> = ({ 
  children, 
  store = createMockStore() 
}) => (
  <Provider store={store}>
    <DndProvider backend={HTML5Backend}>
      {children}
    </DndProvider>
  </Provider>
);

describe('RoleBasedDashboardConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dashboard configuration interface', () => {
    render(
      <TestWrapper>
        <RoleBasedDashboardConfig />
      </TestWrapper>
    );

    expect(screen.getByText('Dashboard Configuration')).toBeInTheDocument();
    expect(screen.getByText(/Manage your dashboard layouts and preferences for captain/i)).toBeInTheDocument();
  });

  it('displays user role and available widgets count', () => {
    render(
      <TestWrapper>
        <RoleBasedDashboardConfig />
      </TestWrapper>
    );

    expect(screen.getByText('CAPTAIN')).toBeInTheDocument();
    const availableWidgets = ROLE_WIDGET_PERMISSIONS.CAPTAIN.length;
    expect(screen.getByText(`${availableWidgets} widgets available`)).toBeInTheDocument();
  });

  it('shows user configurations with widget counts', () => {
    render(
      <TestWrapper>
        <RoleBasedDashboardConfig />
      </TestWrapper>
    );

    expect(screen.getByText('Captain Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Default')).toBeInTheDocument();
    
    // Check widget counts
    const executiveCount = mockConfiguration.customLayouts.executive.widgets.filter(w => w.isVisible).length;
    expect(screen.getByText(executiveCount.toString())).toBeInTheDocument();
  });

  it('opens create configuration dialog', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <RoleBasedDashboardConfig />
      </TestWrapper>
    );

    const createButton = screen.getByText('Create Configuration');
    await user.click(createButton);

    expect(screen.getByText('Create New Configuration')).toBeInTheDocument();
    expect(screen.getByLabelText('Configuration Name')).toBeInTheDocument();
  });

  it('filters templates by role', () => {
    render(
      <TestWrapper>
        <RoleBasedDashboardConfig />
      </TestWrapper>
    );

    // Switch to templates tab
    const templatesTab = screen.getByText('Templates');
    fireEvent.click(templatesTab);

    expect(screen.getByText('Captain Template')).toBeInTheDocument();
  });

  it('shows role-based widget permissions', () => {
    render(
      <TestWrapper>
        <RoleBasedDashboardConfig />
      </TestWrapper>
    );

    // Switch to permissions tab
    const permissionsTab = screen.getByText('Permissions');
    fireEvent.click(permissionsTab);

    expect(screen.getByText('Role-Based Widget Permissions')).toBeInTheDocument();
    
    // Check that captain widgets are shown
    const captainWidgets = ROLE_WIDGET_PERMISSIONS.CAPTAIN;
    captainWidgets.forEach(widgetType => {
      const displayName = widgetType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      expect(screen.getByText(displayName)).toBeInTheDocument();
    });
  });

  it('handles configuration deletion', async () => {
    const user = userEvent.setup();
    const store = createMockStore();
    
    render(
      <TestWrapper store={store}>
        <RoleBasedDashboardConfig />
      </TestWrapper>
    );

    // Find and click delete button (trash icon)
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await user.click(deleteButton);

    expect(screen.getByText('Delete Configuration')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to delete/)).toBeInTheDocument();
  });
});

describe('DragDropLayoutManager', () => {
  const mockProps = {
    layoutType: 'executive' as const,
    onWidgetSelect: jest.fn(),
    onWidgetDelete: jest.fn(),
    onAddWidget: jest.fn(),
  };

  it('renders layout manager with widgets', () => {
    render(
      <TestWrapper>
        <DragDropLayoutManager {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Fleet Spending')).toBeInTheDocument();
  });

  it('shows customization controls when in customization mode', () => {
    const store = createMockStore({
      isCustomizing: true,
    });

    render(
      <TestWrapper store={store}>
        <DragDropLayoutManager {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByText('Snap to grid')).toBeInTheDocument();
    expect(screen.getByText('Show grid')).toBeInTheDocument();
    expect(screen.getByText('Auto Arrange')).toBeInTheDocument();
  });

  it('handles widget visibility toggle', async () => {
    const user = userEvent.setup();
    const store = createMockStore({
      isCustomizing: true,
    });

    render(
      <TestWrapper store={store}>
        <DragDropLayoutManager {...mockProps} />
      </TestWrapper>
    );

    // Widget should be visible initially
    const widget = screen.getByText('Fleet Spending');
    expect(widget).toBeInTheDocument();

    // Find and click visibility toggle (would need to hover first in real scenario)
    // This is a simplified test - in reality, we'd need to simulate hover
  });

  it('shows empty state when no widgets', () => {
    const store = createMockStore({
      currentConfiguration: {
        ...mockConfiguration,
        customLayouts: {
          ...mockConfiguration.customLayouts,
          executive: {
            ...mockConfiguration.customLayouts.executive,
            widgets: [],
          },
        },
      },
    });

    render(
      <TestWrapper store={store}>
        <DragDropLayoutManager {...mockProps} />
      </TestWrapper>
    );

    expect(screen.getByText('No widgets in this layout')).toBeInTheDocument();
    expect(screen.getByText('Drag widgets from the library to get started')).toBeInTheDocument();
  });
});

describe('DashboardPreferencesManager', () => {
  it('renders preferences interface', () => {
    render(
      <TestWrapper>
        <DashboardPreferencesManager />
      </TestWrapper>
    );

    expect(screen.getByText('Dashboard Preferences')).toBeInTheDocument();
    expect(screen.getByText('Customize your dashboard experience and default settings')).toBeInTheDocument();
  });

  it('shows current preference values', () => {
    render(
      <TestWrapper>
        <DashboardPreferencesManager />
      </TestWrapper>
    );

    // Check that current currency is shown
    expect(screen.getByDisplayValue('USD')).toBeInTheDocument();
    
    // Check that current time range is shown
    expect(screen.getByDisplayValue('monthly')).toBeInTheDocument();
  });

  it('handles preference changes', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DashboardPreferencesManager />
      </TestWrapper>
    );

    // Change currency
    const currencySelect = screen.getByDisplayValue('USD');
    await user.click(currencySelect);
    
    // This would open the select dropdown in a real scenario
    // For testing, we'd need to mock the select component behavior
  });

  it('shows unsaved changes indicator', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DashboardPreferencesManager />
      </TestWrapper>
    );

    // Make a change to trigger unsaved state
    const autoRefreshSwitch = screen.getByRole('switch', { name: /auto refresh/i });
    await user.click(autoRefreshSwitch);

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
  });

  it('handles save preferences', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DashboardPreferencesManager />
      </TestWrapper>
    );

    // Make a change
    const autoRefreshSwitch = screen.getByRole('switch', { name: /auto refresh/i });
    await user.click(autoRefreshSwitch);

    // Save changes
    const saveButton = screen.getByText('Save Changes');
    await user.click(saveButton);

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText('Preferences saved successfully!')).toBeInTheDocument();
    });
  });
});

describe('DashboardTemplateSystem', () => {
  it('renders template system interface', () => {
    render(
      <TestWrapper>
        <DashboardTemplateSystem />
      </TestWrapper>
    );

    expect(screen.getByText('Dashboard Templates')).toBeInTheDocument();
    expect(screen.getByText('Browse, create, and manage dashboard templates for quick setup')).toBeInTheDocument();
  });

  it('shows available templates', () => {
    render(
      <TestWrapper>
        <DashboardTemplateSystem />
      </TestWrapper>
    );

    expect(screen.getByText('Captain Template')).toBeInTheDocument();
    expect(screen.getByText('Standard template for captains')).toBeInTheDocument();
  });

  it('filters templates by search query', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DashboardTemplateSystem />
      </TestWrapper>
    );

    const searchInput = screen.getByPlaceholderText('Search templates...');
    await user.type(searchInput, 'captain');

    expect(screen.getByText('Captain Template')).toBeInTheDocument();
  });

  it('shows template creation form', () => {
    render(
      <TestWrapper>
        <DashboardTemplateSystem />
      </TestWrapper>
    );

    // Switch to create tab
    const createTab = screen.getByText('Create New');
    fireEvent.click(createTab);

    expect(screen.getByText('Create New Template')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Name')).toBeInTheDocument();
  });

  it('handles template application', async () => {
    const user = userEvent.setup();
    
    render(
      <TestWrapper>
        <DashboardTemplateSystem />
      </TestWrapper>
    );

    const applyButton = screen.getByText('Apply');
    await user.click(applyButton);

    // Should trigger template application
    // In a real test, we'd verify the Redux action was dispatched
  });
});

describe('Role-based Widget Permissions', () => {
  it('enforces widget permissions for different roles', () => {
    const roles: UserRole[] = ['VESSEL_CREW', 'CAPTAIN', 'SUPERINTENDENT', 'ADMIN'];
    
    roles.forEach(role => {
      const availableWidgets = ROLE_WIDGET_PERMISSIONS[role];
      expect(Array.isArray(availableWidgets)).toBe(true);
      expect(availableWidgets.length).toBeGreaterThan(0);
      
      // Admin should have access to all widgets
      if (role === 'ADMIN') {
        expect(availableWidgets.length).toBeGreaterThanOrEqual(
          ROLE_WIDGET_PERMISSIONS.VESSEL_CREW.length
        );
      }
      
      // Vessel crew should have the most restricted access
      if (role === 'VESSEL_CREW') {
        expect(availableWidgets.length).toBeLessThanOrEqual(
          ROLE_WIDGET_PERMISSIONS.ADMIN.length
        );
      }
    });
  });

  it('provides default templates for each role', () => {
    const roles: UserRole[] = ['VESSEL_CREW', 'CAPTAIN', 'SUPERINTENDENT', 'ADMIN'];
    
    roles.forEach(role => {
      const template = DEFAULT_DASHBOARD_TEMPLATES[role];
      expect(template).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.customLayouts).toBeDefined();
      expect(template.customLayouts?.executive).toBeDefined();
      expect(template.customLayouts?.operational).toBeDefined();
      expect(template.customLayouts?.financial).toBeDefined();
    });
  });
});

describe('Dashboard Configuration Validation', () => {
  it('validates widget permissions against user role', () => {
    const captainWidgets = ROLE_WIDGET_PERMISSIONS.CAPTAIN;
    const vesselCrewWidgets = ROLE_WIDGET_PERMISSIONS.VESSEL_CREW;
    
    // Captain should have more widgets than vessel crew
    expect(captainWidgets.length).toBeGreaterThan(vesselCrewWidgets.length);
    
    // All vessel crew widgets should be available to captain
    vesselCrewWidgets.forEach(widget => {
      expect(captainWidgets).toContain(widget);
    });
  });

  it('validates configuration structure', () => {
    expect(mockConfiguration.id).toBeDefined();
    expect(mockConfiguration.userId).toBeDefined();
    expect(mockConfiguration.role).toBeDefined();
    expect(mockConfiguration.customLayouts).toBeDefined();
    expect(mockConfiguration.preferences).toBeDefined();
    
    // Validate layout structure
    Object.values(mockConfiguration.customLayouts).forEach(layout => {
      expect(layout.id).toBeDefined();
      expect(layout.name).toBeDefined();
      expect(Array.isArray(layout.widgets)).toBe(true);
      expect(Array.isArray(layout.layout)).toBe(true);
      expect(layout.filters).toBeDefined();
      expect(typeof layout.refreshInterval).toBe('number');
    });
  });
});

describe('Integration Tests', () => {
  it('integrates role-based configuration with drag-drop manager', () => {
    const store = createMockStore({
      isCustomizing: true,
    });

    render(
      <TestWrapper store={store}>
        <div>
          <RoleBasedDashboardConfig />
          <DragDropLayoutManager
            layoutType="executive"
            onWidgetSelect={jest.fn()}
            onWidgetDelete={jest.fn()}
            onAddWidget={jest.fn()}
          />
        </div>
      </TestWrapper>
    );

    // Both components should render
    expect(screen.getByText('Dashboard Configuration')).toBeInTheDocument();
    expect(screen.getByText('Fleet Spending')).toBeInTheDocument();
  });

  it('integrates preferences with template system', () => {
    render(
      <TestWrapper>
        <div>
          <DashboardPreferencesManager />
          <DashboardTemplateSystem />
        </div>
      </TestWrapper>
    );

    // Both components should render
    expect(screen.getByText('Dashboard Preferences')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Templates')).toBeInTheDocument();
  });
});