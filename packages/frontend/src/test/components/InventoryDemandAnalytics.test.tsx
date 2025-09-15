import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import InventoryDemandAnalytics from '../../components/analytics/InventoryDemandAnalytics';
import { useInventoryDemandData } from '../../hooks/useInventoryDemandData';
import authSlice from '../../store/slices/authSlice';

// Mock the custom hook
jest.mock('../../hooks/useInventoryDemandData');
const mockUseInventoryDemandData = useInventoryDemandData as jest.MockedFunction<typeof useInventoryDemandData>;

// Mock Recharts components
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  BarChart: ({ children }: any) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Bar: () => <div data-testid="bar" />,
  Line: () => <div data-testid="line" />,
  Area: () => <div data-testid="area" />,
  Pie: () => <div data-testid="pie" />,
  Cell: () => <div data-testid="cell" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
  Tooltip: () => <div data-testid="tooltip" />,
  Legend: () => <div data-testid="legend" />
}));

const mockStore = configureStore({
  reducer: {
    auth: authSlice
  },
  preloadedState: {
    auth: {
      user: { id: '1', email: 'test@example.com', role: 'PROCUREMENT_MANAGER' },
      token: 'mock-token',
      isAuthenticated: true,
      permissions: [],
      vessels: []
    }
  }
});

const mockInventoryTurnoverData = {
  categoryTurnover: [
    {
      category: 'Engine Parts',
      turnoverRate: 4.2,
      targetRate: 6.0,
      variance: -1.8,
      trend: 'declining' as const,
      totalValue: 150000
    },
    {
      category: 'Safety Equipment',
      turnoverRate: 8.1,
      targetRate: 8.0,
      variance: 0.1,
      trend: 'stable' as const,
      totalValue: 75000
    }
  ],
  valueDistribution: [
    { name: 'Engine Parts', value: 150000, percentage: 60, count: 120 },
    { name: 'Safety Equipment', value: 75000, percentage: 30, count: 80 },
    { name: 'Deck Equipment', value: 25000, percentage: 10, count: 40 }
  ],
  slowMovingItems: [
    {
      itemId: '1',
      itemName: 'Spare Propeller',
      category: 'Engine Parts',
      daysInStock: 365,
      value: 25000,
      lastMovement: new Date('2023-01-01'),
      recommendedAction: 'liquidate' as const
    }
  ],
  overallMetrics: {
    totalInventoryValue: 250000,
    averageTurnoverRate: 5.2,
    slowMovingPercentage: 15,
    excessInventoryValue: 50000,
    inventoryAccuracy: 95
  }
};

const mockDemandForecastData = {
  seasonalPatterns: [
    {
      month: 'Jan',
      historicalDemand: 100,
      forecastedDemand: 110,
      confidence: 85,
      seasonalIndex: 1.1
    },
    {
      month: 'Feb',
      historicalDemand: 90,
      forecastedDemand: 95,
      confidence: 88,
      seasonalIndex: 0.95
    }
  ],
  categoryForecast: [
    { period: 'Q1 2024', 'Engine Parts': 120, 'Safety Equipment': 80, 'Deck Equipment': 40 },
    { period: 'Q2 2024', 'Engine Parts': 130, 'Safety Equipment': 85, 'Deck Equipment': 45 }
  ],
  accuracy: 0.87,
  meanAbsoluteError: 12.5,
  trendDirection: 'increasing' as const,
  forecastHorizon: 12
};

const mockOptimizationRecommendations = {
  recommendations: [
    {
      id: '1',
      title: 'Reduce Engine Parts Inventory',
      description: 'Current stock levels exceed optimal by 30%',
      category: 'stock_reduction' as const,
      impact: 'high' as const,
      potentialSavings: 45000,
      implementationEffort: 'medium' as const,
      riskLevel: 'low' as const,
      affectedItems: ['item1', 'item2'],
      timeframe: '3 months'
    }
  ],
  optimalStockLevels: [
    {
      itemName: 'Engine Oil Filter',
      currentStock: 50,
      optimalStock: 35,
      reorderPoint: 20,
      safetyStock: 10,
      economicOrderQuantity: 25,
      variance: 15
    }
  ],
  potentialSavings: 75000,
  implementationPriority: [
    {
      recommendationId: '1',
      priority: 1,
      score: 85,
      quickWins: true,
      dependencies: []
    }
  ]
};

const mockStockAlerts = {
  criticalAlerts: [
    {
      id: '1',
      itemId: 'item1',
      itemName: 'Life Jacket',
      vesselId: 'vessel1',
      vesselName: 'MV Ocean Explorer',
      category: 'Safety Equipment',
      severity: 'critical' as const,
      type: 'low_stock' as const,
      message: 'Stock level below safety threshold',
      currentStock: 5,
      reorderPoint: 20,
      recommendedAction: 'Order immediately',
      estimatedStockoutDate: new Date('2024-02-15'),
      createdAt: new Date('2024-02-01')
    }
  ],
  summary: {
    totalAlerts: 15,
    criticalCount: 3,
    warningCount: 8,
    infoCount: 4,
    newAlertsToday: 2,
    resolvedAlertsToday: 1
  },
  trends: [
    { date: '2024-01-01', criticalAlerts: 2, warningAlerts: 5, totalAlerts: 10 },
    { date: '2024-01-02', criticalAlerts: 3, warningAlerts: 8, totalAlerts: 15 }
  ]
};

const mockPredictiveMaintenanceNeeds = {
  upcomingNeeds: [
    {
      id: '1',
      vesselId: 'vessel1',
      vesselName: 'MV Ocean Explorer',
      equipmentId: 'engine1',
      equipmentName: 'Main Engine',
      predictedDate: new Date('2024-03-15'),
      confidence: 85,
      urgency: 'high' as const,
      estimatedCost: 25000,
      requiredParts: [
        {
          itemId: 'part1',
          itemName: 'Engine Gasket',
          quantity: 2,
          unitCost: 500,
          totalCost: 1000,
          leadTime: 14,
          availability: 'order_required' as const,
          alternativeParts: ['part2']
        }
      ],
      maintenanceType: 'preventive' as const,
      riskIfDelayed: 'high' as const
    }
  ],
  summary: {
    totalUpcomingMaintenance: 5,
    next30Days: 2,
    next90Days: 3,
    totalEstimatedCost: 125000,
    highRiskItems: 2,
    partsToOrder: 15
  },
  costProjections: [
    {
      month: 'Mar 2024',
      projectedCost: 45000,
      confidence: 80,
      breakdown: { preventive: 25000, corrective: 15000, overhaul: 5000 }
    }
  ],
  riskAssessment: [
    {
      vesselId: 'vessel1',
      vesselName: 'MV Ocean Explorer',
      riskScore: 75,
      criticalEquipment: ['Main Engine', 'Generator'],
      overdueMaintenanceCount: 2,
      estimatedDowntimeRisk: 48,
      financialRisk: 100000,
      recommendations: ['Schedule immediate maintenance', 'Order critical parts']
    }
  ]
};

const defaultProps = {
  vesselIds: ['vessel1'],
  timeRange: {
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31')
  },
  categories: ['Engine Parts', 'Safety Equipment']
};

describe('InventoryDemandAnalytics', () => {
  beforeEach(() => {
    mockUseInventoryDemandData.mockReturnValue({
      inventoryTurnover: mockInventoryTurnoverData,
      demandForecast: mockDemandForecastData,
      optimizationRecommendations: mockOptimizationRecommendations,
      stockAlerts: mockStockAlerts,
      predictiveMaintenanceNeeds: mockPredictiveMaintenanceNeeds,
      loading: false,
      error: null,
      refetch: jest.fn()
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const renderComponent = (props = {}) => {
    return render(
      <Provider store={mockStore}>
        <InventoryDemandAnalytics {...defaultProps} {...props} />
      </Provider>
    );
  };

  describe('Component Rendering', () => {
    it('renders the component with header and tabs', () => {
      renderComponent();
      
      expect(screen.getByText('Inventory & Demand Analytics')).toBeInTheDocument();
      expect(screen.getByText('Inventory Turnover')).toBeInTheDocument();
      expect(screen.getByText('Demand Forecast')).toBeInTheDocument();
      expect(screen.getByText('Optimization')).toBeInTheDocument();
      expect(screen.getByText('Stock Alerts')).toBeInTheDocument();
    });

    it('renders vessel selector', () => {
      renderComponent();
      
      expect(screen.getByDisplayValue('All Vessels')).toBeInTheDocument();
    });

    it('displays loading state', () => {
      mockUseInventoryDemandData.mockReturnValue({
        inventoryTurnover: null,
        demandForecast: null,
        optimizationRecommendations: null,
        stockAlerts: null,
        predictiveMaintenanceNeeds: null,
        loading: true,
        error: null,
        refetch: jest.fn()
      });

      renderComponent();
      
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('displays error state', () => {
      mockUseInventoryDemandData.mockReturnValue({
        inventoryTurnover: null,
        demandForecast: null,
        optimizationRecommendations: null,
        stockAlerts: null,
        predictiveMaintenanceNeeds: null,
        loading: false,
        error: 'Failed to load data',
        refetch: jest.fn()
      });

      renderComponent();
      
      expect(screen.getByText(/Error loading inventory and demand analytics/)).toBeInTheDocument();
    });
  });

  describe('Inventory Turnover Tab', () => {
    it('displays inventory turnover analysis by default', () => {
      renderComponent();
      
      expect(screen.getByText('Inventory Turnover Rates')).toBeInTheDocument();
      expect(screen.getByText('Inventory Value by Category')).toBeInTheDocument();
      expect(screen.getByText('Slow-Moving Items')).toBeInTheDocument();
    });

    it('shows turnover rate chart', () => {
      renderComponent();
      
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });

    it('displays slow-moving items', () => {
      renderComponent();
      
      expect(screen.getByText('Spare Propeller')).toBeInTheDocument();
      expect(screen.getByText('365 days')).toBeInTheDocument();
    });

    it('shows inventory value distribution pie chart', () => {
      renderComponent();
      
      expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
    });
  });

  describe('Demand Forecast Tab', () => {
    it('switches to demand forecast tab', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Demand Forecast'));
      
      await waitFor(() => {
        expect(screen.getByText('Seasonal Demand Forecast')).toBeInTheDocument();
        expect(screen.getByText('Demand Forecast by Category')).toBeInTheDocument();
      });
    });

    it('displays forecast accuracy metrics', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Demand Forecast'));
      
      await waitFor(() => {
        expect(screen.getByText('Forecast Accuracy')).toBeInTheDocument();
        expect(screen.getByText('87.0%')).toBeInTheDocument();
        expect(screen.getByText('Mean Absolute Error')).toBeInTheDocument();
        expect(screen.getByText('12.5')).toBeInTheDocument();
      });
    });

    it('shows seasonal patterns chart', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Demand Forecast'));
      
      await waitFor(() => {
        expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      });
    });

    it('displays category forecast line chart', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Demand Forecast'));
      
      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Optimization Tab', () => {
    it('switches to optimization tab', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Optimization'));
      
      await waitFor(() => {
        expect(screen.getByText('Inventory Optimization Recommendations')).toBeInTheDocument();
        expect(screen.getByText('Optimal Stock Level Analysis')).toBeInTheDocument();
      });
    });

    it('displays optimization recommendations', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Optimization'));
      
      await waitFor(() => {
        expect(screen.getByText('Reduce Engine Parts Inventory')).toBeInTheDocument();
        expect(screen.getByText('Current stock levels exceed optimal by 30%')).toBeInTheDocument();
        expect(screen.getByText('$45,000')).toBeInTheDocument();
      });
    });

    it('shows optimal stock levels chart', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Optimization'));
      
      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Stock Alerts Tab', () => {
    it('switches to stock alerts tab', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Stock Alerts'));
      
      await waitFor(() => {
        expect(screen.getByText('Stock Level Alerts')).toBeInTheDocument();
        expect(screen.getByText('Predictive Maintenance Procurement')).toBeInTheDocument();
      });
    });

    it('displays critical alerts', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Stock Alerts'));
      
      await waitFor(() => {
        expect(screen.getByText('Life Jacket')).toBeInTheDocument();
        expect(screen.getByText('MV Ocean Explorer - Safety Equipment')).toBeInTheDocument();
        expect(screen.getByText('CRITICAL')).toBeInTheDocument();
      });
    });

    it('shows predictive maintenance needs', async () => {
      renderComponent();
      
      fireEvent.click(screen.getByText('Stock Alerts'));
      
      await waitFor(() => {
        expect(screen.getByText('Main Engine')).toBeInTheDocument();
        expect(screen.getByText('1 parts needed')).toBeInTheDocument();
        expect(screen.getByText('high priority')).toBeInTheDocument();
      });
    });
  });

  describe('Tab Navigation', () => {
    it('highlights active tab', () => {
      renderComponent();
      
      const turnoverTab = screen.getByText('Inventory Turnover');
      expect(turnoverTab).toHaveClass('border-blue-500', 'text-blue-600');
    });

    it('changes active tab on click', async () => {
      renderComponent();
      
      const forecastTab = screen.getByText('Demand Forecast');
      fireEvent.click(forecastTab);
      
      await waitFor(() => {
        expect(forecastTab).toHaveClass('border-blue-500', 'text-blue-600');
      });
    });
  });

  describe('Data Integration', () => {
    it('calls hook with correct filters', () => {
      const customProps = {
        vesselIds: ['vessel1', 'vessel2'],
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-06-30')
        },
        categories: ['Engine Parts']
      };

      renderComponent(customProps);

      expect(mockUseInventoryDemandData).toHaveBeenCalledWith({
        vesselIds: ['vessel1', 'vessel2'],
        timeRange: {
          start: new Date('2024-01-01'),
          end: new Date('2024-06-30')
        },
        categories: ['Engine Parts'],
        selectedVessel: undefined
      });
    });

    it('updates filters when vessel selection changes', async () => {
      renderComponent();
      
      const vesselSelect = screen.getByDisplayValue('All Vessels');
      fireEvent.change(vesselSelect, { target: { value: 'vessel1' } });
      
      await waitFor(() => {
        expect(mockUseInventoryDemandData).toHaveBeenCalledWith(
          expect.objectContaining({
            selectedVessel: 'vessel1'
          })
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for tabs', () => {
      renderComponent();
      
      const tabs = screen.getAllByRole('button');
      tabs.forEach(tab => {
        expect(tab).toBeVisible();
      });
    });

    it('supports keyboard navigation', () => {
      renderComponent();
      
      const forecastTab = screen.getByText('Demand Forecast');
      forecastTab.focus();
      expect(forecastTab).toHaveFocus();
    });
  });
});