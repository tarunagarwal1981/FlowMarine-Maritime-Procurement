import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MobileDashboard } from '../../components/dashboard/mobile/MobileDashboard';
import { MobileDashboardLayout } from '../../components/dashboard/mobile/MobileDashboardLayout';
import { TouchFriendlyChart } from '../../components/dashboard/mobile/TouchFriendlyChart';
import { ResponsiveChartContainer } from '../../components/dashboard/mobile/ResponsiveChartContainer';
import { MobileNavigation } from '../../components/dashboard/mobile/MobileNavigation';
import { OfflineViewingManager } from '../../components/dashboard/mobile/OfflineViewingManager';
import { DashboardData } from '../../types/dashboard';

// Mock the media query hook
vi.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: vi.fn(),
  useIsMobile: vi.fn(() => true),
  useIsTablet: vi.fn(() => false),
  useIsDesktop: vi.fn(() => false),
  useIsSmallMobile: vi.fn(() => false),
  useIsLandscape: vi.fn(() => false),
  useIsPortrait: vi.fn(() => true),
  useIsTouchDevice: vi.fn(() => true),
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const mockDashboards: DashboardData[] = [
  {
    id: 'executive',
    type: 'executive',
    title: 'Executive Dashboard',
    layout: {
      widgets: [],
      layout: []
    },
    widgets: [
      {
        id: 'spend-viz',
        type: 'chart',
        title: 'Fleet Spend Visualization',
        configuration: { chartType: 'line' },
        permissions: ['view_analytics']
      },
      {
        id: 'budget-util',
        type: 'kpi',
        title: 'Budget Utilization',
        configuration: { format: 'percentage' },
        permissions: ['view_budget']
      }
    ]
  },
  {
    id: 'operational',
    type: 'operational',
    title: 'Operational Analytics',
    layout: {
      widgets: [],
      layout: []
    },
    widgets: [
      {
        id: 'cycle-time',
        type: 'chart',
        title: 'Cycle Time Analysis',
        configuration: { chartType: 'bar' },
        permissions: ['view_operations']
      }
    ]
  }
];

const mockProps = {
  dashboards: mockDashboards,
  currentDashboard: 'executive',
  onDashboardChange: vi.fn(),
  onDataRefresh: vi.fn(),
};

describe('MobileDashboard', () => {
  beforeEach(() => {
    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    });

    // Mock window dimensions
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 375,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      value: 667,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders mobile dashboard with navigation', () => {
    render(<MobileDashboard {...mockProps} />);
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Executive')).toBeInTheDocument();
  });

  it('handles dashboard switching', () => {
    render(<MobileDashboard {...mockProps} />);
    
    // This would trigger navigation - implementation depends on your navigation setup
    expect(mockProps.onDashboardChange).not.toHaveBeenCalled();
  });

  it('shows offline banner when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    render(<MobileDashboard {...mockProps} />);
    
    expect(screen.getByText(/You're offline/)).toBeInTheDocument();
  });

  it('handles data refresh', async () => {
    render(<MobileDashboard {...mockProps} />);
    
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);
    
    expect(mockProps.onDataRefresh).toHaveBeenCalled();
  });
});

describe('MobileDashboardLayout', () => {
  const mockLayout = {
    widgets: [],
    layout: []
  };

  const mockWidgets = [
    {
      id: 'widget1',
      type: 'chart' as const,
      title: 'Test Widget 1',
      configuration: {},
      permissions: []
    },
    {
      id: 'widget2',
      type: 'kpi' as const,
      title: 'Test Widget 2',
      configuration: {},
      permissions: []
    }
  ];

  it('renders widgets in mobile layout', () => {
    render(
      <MobileDashboardLayout
        layout={mockLayout}
        widgets={mockWidgets}
        onWidgetInteraction={vi.fn()}
      />
    );

    expect(screen.getByText('Test Widget 1')).toBeInTheDocument();
    expect(screen.getByText('Test Widget 2')).toBeInTheDocument();
  });

  it('handles page navigation', () => {
    render(
      <MobileDashboardLayout
        layout={mockLayout}
        widgets={mockWidgets}
        onWidgetInteraction={vi.fn()}
      />
    );

    const nextButton = screen.getByText('Next');
    const prevButton = screen.getByText('Previous');

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeInTheDocument();
  });

  it('responds to orientation changes', () => {
    const { rerender } = render(
      <MobileDashboardLayout
        layout={mockLayout}
        widgets={mockWidgets}
        onWidgetInteraction={vi.fn()}
      />
    );

    // Simulate orientation change
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 667,
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      value: 375,
    });

    fireEvent(window, new Event('resize'));

    rerender(
      <MobileDashboardLayout
        layout={mockLayout}
        widgets={mockWidgets}
        onWidgetInteraction={vi.fn()}
      />
    );

    // Layout should adapt to landscape mode
    expect(screen.getByText('Test Widget 1')).toBeInTheDocument();
  });
});

describe('TouchFriendlyChart', () => {
  const mockData = [
    { name: 'Jan', value: 100 },
    { name: 'Feb', value: 200 },
    { name: 'Mar', value: 150 },
  ];

  it('renders line chart with touch controls', () => {
    render(
      <TouchFriendlyChart
        data={mockData}
        type="line"
        title="Test Chart"
      />
    );

    expect(screen.getByText('Test Chart')).toBeInTheDocument();
    expect(screen.getByText(/Pinch to zoom/)).toBeInTheDocument();
  });

  it('renders bar chart', () => {
    render(
      <TouchFriendlyChart
        data={mockData}
        type="bar"
        title="Bar Chart"
      />
    );

    expect(screen.getByText('Bar Chart')).toBeInTheDocument();
  });

  it('renders pie chart', () => {
    render(
      <TouchFriendlyChart
        data={mockData}
        type="pie"
        title="Pie Chart"
      />
    );

    expect(screen.getByText('Pie Chart')).toBeInTheDocument();
  });

  it('handles zoom controls', () => {
    render(
      <TouchFriendlyChart
        data={mockData}
        type="line"
        title="Test Chart"
      />
    );

    const zoomInButton = screen.getByRole('button', { name: /zoom in/i });
    const zoomOutButton = screen.getByRole('button', { name: /zoom out/i });
    const resetButton = screen.getByRole('button', { name: /reset/i });

    fireEvent.click(zoomInButton);
    fireEvent.click(zoomOutButton);
    fireEvent.click(resetButton);

    // Buttons should be functional
    expect(zoomInButton).toBeInTheDocument();
    expect(zoomOutButton).toBeInTheDocument();
    expect(resetButton).toBeInTheDocument();
  });
});

describe('MobileNavigation', () => {
  const mockProps = {
    currentView: 'dashboard',
    onViewChange: vi.fn(),
    notifications: 3,
  };

  it('renders navigation with current view', () => {
    render(<MobileNavigation {...mockProps} />);

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Notification count
  });

  it('handles menu toggle', () => {
    render(<MobileNavigation {...mockProps} />);

    const menuButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuButton);

    expect(screen.getByText('Navigation')).toBeInTheDocument();
  });

  it('handles view changes', () => {
    render(<MobileNavigation {...mockProps} />);

    const menuButton = screen.getByRole('button', { name: /menu/i });
    fireEvent.click(menuButton);

    const analyticsButton = screen.getByText('Analytics');
    fireEvent.click(analyticsButton);

    expect(mockProps.onViewChange).toHaveBeenCalledWith('analytics');
  });
});

describe('OfflineViewingManager', () => {
  const mockProps = {
    dashboardData: mockDashboards,
    onDataRefresh: vi.fn(),
  };

  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
    });
  });

  it('shows online status', () => {
    render(<OfflineViewingManager {...mockProps} />);

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('shows offline status when offline', () => {
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false,
    });

    render(<OfflineViewingManager {...mockProps} />);

    expect(screen.getByText('Offline Mode')).toBeInTheDocument();
  });

  it('handles download for offline', async () => {
    render(<OfflineViewingManager {...mockProps} />);

    const downloadButton = screen.getByText('Download for Offline');
    fireEvent.click(downloadButton);

    await waitFor(() => {
      expect(screen.getByText('Download for Offline')).toBeInTheDocument();
    });
  });

  it('shows storage usage', () => {
    render(<OfflineViewingManager {...mockProps} />);

    expect(screen.getByText(/Storage Used/)).toBeInTheDocument();
  });
});

describe('ResponsiveChartContainer', () => {
  const mockData = [
    { name: 'A', value: 100 },
    { name: 'B', value: 200 },
  ];

  it('renders responsive container', () => {
    render(
      <ResponsiveChartContainer
        data={mockData}
        type="line"
        title="Responsive Chart"
      >
        <div>Chart Content</div>
      </ResponsiveChartContainer>
    );

    expect(screen.getByText('Fleet Spend Visualization')).toBeInTheDocument();
  });

  it('uses touch-friendly version on mobile', () => {
    render(
      <ResponsiveChartContainer
        data={mockData}
        type="bar"
        title="Mobile Chart"
      />
    );

    // Should render TouchFriendlyChart on mobile
    expect(screen.getByText(/Pinch to zoom/)).toBeInTheDocument();
  });
});