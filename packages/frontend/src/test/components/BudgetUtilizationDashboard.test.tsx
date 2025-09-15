import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import BudgetUtilizationDashboard from '../../components/analytics/BudgetUtilizationDashboard';
import { BudgetData, BudgetAlert, BudgetHierarchy } from '../../types/analytics';

// Mock Chart.js
vi.mock('react-chartjs-2', () => ({
  Bar: ({ data, options, ...props }: any) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)} {...props}>
      Bar Chart
    </div>
  ),
  Line: ({ data, options, ...props }: any) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} {...props}>
      Line Chart
    </div>
  ),
  Doughnut: ({ data, options, ...props }: any) => (
    <div data-testid="doughnut-chart" data-chart-data={JSON.stringify(data)} {...props}>
      Doughnut Chart
    </div>
  ),
}));

vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn(),
  },
  CategoryScale: {},
  LinearScale: {},
  BarElement: {},
  LineElement: {},
  PointElement: {},
  Title: {},
  Tooltip: {},
  Legend: {},
  ArcElement: {},
}));

const mockVessels = [
  { id: 'vessel1', name: 'MV Atlantic' },
  { id: 'vessel2', name: 'MV Pacific' },
  { id: 'vessel3', name: 'MV Arctic' },
];

const mockBudgetData: BudgetData = {
  totalBudget: 500000,
  utilized: 375000,
  remaining: 125000,
  utilizationPercentage: 75,
  variance: {
    amount: 25000,
    percentage: 5,
    status: 'on-track',
  },
  projectedSpend: 450000,
  alerts: [
    {
      id: 'alert-1',
      type: 'warning',
      message: 'Budget utilization approaching 75% threshold',
      threshold: 75,
      currentValue: 75,
      createdAt: new Date('2024-01-15'),
    },
    {
      id: 'alert-2',
      type: 'critical',
      message: 'MV Atlantic budget utilization exceeds 90%',
      threshold: 90,
      currentValue: 92,
      vesselId: 'vessel1',
      createdAt: new Date('2024-01-14'),
    },
  ],
  hierarchy: [
    {
      level: 'fleet',
      id: 'fleet-1',
      name: 'Atlantic Fleet',
      budget: 300000,
      utilized: 225000,
      remaining: 75000,
      utilizationPercentage: 75,
    },
    {
      level: 'vessel',
      id: 'vessel1',
      name: 'MV Atlantic',
      budget: 150000,
      utilized: 138000,
      remaining: 12000,
      utilizationPercentage: 92,
    },
  ],
};

describe('BudgetUtilizationDashboard', () => {
  const defaultProps = {
    budgetPeriod: 'Q1 2024',
    vessels: mockVessels,
    realTimeUpdates: true,
    data: mockBudgetData,
    loading: false,
    onAlertClick: vi.fn(),
    onHierarchyDrillDown: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    expect(screen.getByText('Budget Utilization Dashboard')).toBeInTheDocument();
  });

  it('displays loading state correctly', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} loading={true} />);
    const loadingElement = document.querySelector('.animate-pulse');
    expect(loadingElement).toBeInTheDocument();
  });

  it('displays budget period and real-time status', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    
    expect(screen.getByText('Period: Q1 2024')).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });

  it('displays key budget metrics correctly', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    
    expect(screen.getByText('$500,000')).toBeInTheDocument(); // Total Budget
    expect(screen.getByText('$375,000')).toBeInTheDocument(); // Utilized
    expect(screen.getByText('$125,000')).toBeInTheDocument(); // Remaining
    expect(screen.getByText('75.0%')).toBeInTheDocument(); // Utilization
  });

  it('displays budget variance with correct styling', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    
    expect(screen.getByText('Budget Variance:')).toBeInTheDocument();
    expect(screen.getByText('5.0%')).toBeInTheDocument();
    expect(screen.getByText('($25,000)')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByText('on track')).toBeInTheDocument();
  });

  it('renders view mode selector with correct options', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Hierarchy')).toBeInTheDocument();
    expect(screen.getByText('Forecast')).toBeInTheDocument();
  });

  it('switches between view modes correctly', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    
    // Default should show overview (doughnut chart)
    expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
    
    // Switch to hierarchy view
    fireEvent.click(screen.getByText('Hierarchy'));
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByText('Budget Hierarchy')).toBeInTheDocument();
    
    // Switch to forecast view
    fireEvent.click(screen.getByText('Forecast'));
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByText('Variance Trend Analysis')).toBeInTheDocument();
  });

  it('displays budget alerts correctly', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    
    expect(screen.getByText('Budget Alerts')).toBeInTheDocument();
    expect(screen.getByText('Budget utilization approaching 75% threshold')).toBeInTheDocument();
    expect(screen.getByText('MV Atlantic budget utilization exceeds 90%')).toBeInTheDocument();
    
    // Check alert details
    expect(screen.getByText('Threshold: 75% | Current: 75%')).toBeInTheDocument();
    expect(screen.getByText('Threshold: 90% | Current: 92%')).toBeInTheDocument();
    expect(screen.getByText('Vessel: MV Atlantic')).toBeInTheDocument();
  });

  it('handles alert clicks correctly', async () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    
    const alertElement = screen.getByText('Budget utilization approaching 75% threshold').closest('div');
    if (alertElement) {
      fireEvent.click(alertElement);
    }
    
    await waitFor(() => {
      expect(defaultProps.onAlertClick).toHaveBeenCalledWith(mockBudgetData.alerts[0]);
    });
  });

  it('displays hierarchy details in hierarchy view', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Hierarchy'));
    
    expect(screen.getByText('Hierarchy Details')).toBeInTheDocument();
    expect(screen.getByText('Atlantic Fleet')).toBeInTheDocument();
    expect(screen.getByText('MV Atlantic')).toBeInTheDocument();
    expect(screen.getByText('$225,000 / $300,000')).toBeInTheDocument();
    expect(screen.getByText('75.0% utilized')).toBeInTheDocument();
  });

  it('handles hierarchy drill-down correctly', async () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Hierarchy'));
    
    const hierarchyItem = screen.getByText('Atlantic Fleet').closest('div');
    if (hierarchyItem) {
      fireEvent.click(hierarchyItem);
    }
    
    await waitFor(() => {
      expect(defaultProps.onHierarchyDrillDown).toHaveBeenCalledWith(mockBudgetData.hierarchy[0]);
    });
  });

  it('displays projected spend information correctly', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    
    expect(screen.getByText('Spend Forecast')).toBeInTheDocument();
    expect(screen.getByText('Current Spend')).toBeInTheDocument();
    expect(screen.getByText('Projected Spend')).toBeInTheDocument();
    expect(screen.getByText('$450,000')).toBeInTheDocument(); // Projected spend
  });

  it('shows correct utilization progress bar colors', () => {
    // Test with high utilization (should be red)
    const highUtilizationData = {
      ...mockBudgetData,
      utilizationPercentage: 95,
    };

    render(<BudgetUtilizationDashboard {...defaultProps} data={highUtilizationData} />);
    
    // Check that high utilization shows red color in progress bars
    const progressBars = document.querySelectorAll('.bg-red-500');
    expect(progressBars.length).toBeGreaterThan(0);
  });

  it('handles real-time updates indicator', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} realTimeUpdates={true} />);
    
    // Should show real-time indicator
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
    
    // Test without real-time updates
    render(<BudgetUtilizationDashboard {...defaultProps} realTimeUpdates={false} />);
    
    // Should not show real-time indicator when disabled
    const updatedComponent = screen.queryByText(/Last updated:/);
    expect(updatedComponent).not.toBeInTheDocument();
  });

  it('applies correct variance status colors', () => {
    // Test over budget scenario
    const overBudgetData = {
      ...mockBudgetData,
      variance: {
        amount: 50000,
        percentage: 15,
        status: 'over' as const,
      },
    };

    render(<BudgetUtilizationDashboard {...defaultProps} data={overBudgetData} />);
    
    const varianceSection = screen.getByText('Budget Variance:').closest('div');
    expect(varianceSection).toHaveClass('text-red-600', 'bg-red-50');
  });

  it('handles responsive design correctly', () => {
    const { container } = render(
      <BudgetUtilizationDashboard {...defaultProps} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
    
    // Check for responsive grid classes
    expect(container.querySelector('.grid-cols-2')).toBeInTheDocument();
    expect(container.querySelector('.sm\\:grid-cols-4')).toBeInTheDocument();
  });

  it('formats currency values correctly', () => {
    render(<BudgetUtilizationDashboard {...defaultProps} />);
    
    // Check that large numbers are formatted with commas
    expect(screen.getByText('$500,000')).toBeInTheDocument();
    expect(screen.getByText('$375,000')).toBeInTheDocument();
    expect(screen.getByText('$125,000')).toBeInTheDocument();
  });
});

// Integration test for complete user workflow
describe('BudgetUtilizationDashboard Integration', () => {
  it('handles complete user interaction workflow', async () => {
    const onAlertClick = vi.fn();
    const onHierarchyDrillDown = vi.fn();

    render(
      <BudgetUtilizationDashboard
        budgetPeriod="Q1 2024"
        vessels={mockVessels}
        realTimeUpdates={true}
        data={mockBudgetData}
        loading={false}
        onAlertClick={onAlertClick}
        onHierarchyDrillDown={onHierarchyDrillDown}
      />
    );

    // 1. Switch to hierarchy view
    fireEvent.click(screen.getByText('Hierarchy'));
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();

    // 2. Click on hierarchy item
    const hierarchyItem = screen.getByText('Atlantic Fleet').closest('div');
    if (hierarchyItem) {
      fireEvent.click(hierarchyItem);
    }

    await waitFor(() => {
      expect(onHierarchyDrillDown).toHaveBeenCalled();
    });

    // 3. Switch to forecast view
    fireEvent.click(screen.getByText('Forecast'));
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();

    // 4. Click on an alert
    const alertElement = screen.getByText('Budget utilization approaching 75% threshold').closest('div');
    if (alertElement) {
      fireEvent.click(alertElement);
    }

    await waitFor(() => {
      expect(onAlertClick).toHaveBeenCalled();
    });
  });
});