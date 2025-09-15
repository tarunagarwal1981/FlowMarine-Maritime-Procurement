import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import FleetSpendVisualization from '../../components/analytics/FleetSpendVisualization';
import { SpendData } from '../../types/analytics';

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
  TimeScale: {},
}));

const mockVessels = [
  { id: 'vessel1', name: 'MV Atlantic' },
  { id: 'vessel2', name: 'MV Pacific' },
  { id: 'vessel3', name: 'MV Arctic' },
];

const mockCategories = [
  'Engine Parts',
  'Deck Equipment',
  'Safety Gear',
  'Navigation',
  'Catering',
];

const mockSpendData: SpendData[] = [
  {
    period: 'Jan 2024',
    totalSpend: 125000,
    currency: 'USD',
    breakdown: [
      { category: 'Engine Parts', amount: 50000, percentage: 40, trend: 'up' },
      { category: 'Deck Equipment', amount: 30000, percentage: 24, trend: 'stable' },
      { category: 'Safety Gear', amount: 25000, percentage: 20, trend: 'down' },
      { category: 'Navigation', amount: 15000, percentage: 12, trend: 'up' },
      { category: 'Catering', amount: 5000, percentage: 4, trend: 'stable' },
    ],
    vesselBreakdown: [
      { vesselId: 'vessel1', vesselName: 'MV Atlantic', amount: 50000, percentage: 40 },
      { vesselId: 'vessel2', vesselName: 'MV Pacific', amount: 45000, percentage: 36 },
      { vesselId: 'vessel3', vesselName: 'MV Arctic', amount: 30000, percentage: 24 },
    ],
    yearOverYear: {
      currentPeriod: 125000,
      previousPeriod: 110000,
      change: 15000,
      changePercentage: 13.6,
    },
  },
];

describe('FleetSpendVisualization', () => {
  const defaultProps = {
    timeRange: 'monthly' as const,
    vessels: mockVessels,
    categories: mockCategories,
    onTimeRangeChange: vi.fn(),
    onDrillDown: vi.fn(),
    data: mockSpendData,
    loading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<FleetSpendVisualization {...defaultProps} />);
    expect(screen.getByText('Fleet-Wide Spend Analysis')).toBeInTheDocument();
  });

  it('displays loading state correctly', () => {
    render(<FleetSpendVisualization {...defaultProps} loading={true} />);
    expect(screen.getByText('Fleet-Wide Spend Analysis')).toBeInTheDocument();
    // Check for loading animation class
    const loadingElement = document.querySelector('.animate-pulse');
    expect(loadingElement).toBeInTheDocument();
  });

  it('renders time range selector with correct options', () => {
    render(<FleetSpendVisualization {...defaultProps} />);
    
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Quarterly')).toBeInTheDocument();
    expect(screen.getByText('Yearly')).toBeInTheDocument();
  });

  it('renders view mode selector with correct options', () => {
    render(<FleetSpendVisualization {...defaultProps} />);
    
    expect(screen.getByText('Trend')).toBeInTheDocument();
    expect(screen.getByText('Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Comparison')).toBeInTheDocument();
  });

  it('displays year-over-year comparison when available', () => {
    render(<FleetSpendVisualization {...defaultProps} />);
    
    expect(screen.getByText('Year-over-Year Change')).toBeInTheDocument();
    expect(screen.getByText('+13.6%')).toBeInTheDocument();
    expect(screen.getByText('($15,000)')).toBeInTheDocument();
  });

  it('calls onTimeRangeChange when time range is changed', () => {
    render(<FleetSpendVisualization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Quarterly'));
    expect(defaultProps.onTimeRangeChange).toHaveBeenCalledWith('quarterly');
  });

  it('switches between view modes correctly', () => {
    render(<FleetSpendVisualization {...defaultProps} />);
    
    // Default should show trend (line chart)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    
    // Switch to breakdown view
    fireEvent.click(screen.getByText('Breakdown'));
    expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
    
    // Switch to comparison view
    fireEvent.click(screen.getByText('Comparison'));
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });

  it('displays category breakdown details in breakdown view', () => {
    render(<FleetSpendVisualization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Breakdown'));
    
    expect(screen.getByText('Category Details')).toBeInTheDocument();
    expect(screen.getByText('Engine Parts')).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
    expect(screen.getByText('40.0%')).toBeInTheDocument();
  });

  it('displays summary statistics correctly', () => {
    render(<FleetSpendVisualization {...defaultProps} />);
    
    expect(screen.getByText('$125,000')).toBeInTheDocument();
    expect(screen.getByText('Total Spend')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Categories count
    expect(screen.getByText('Categories')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // Vessels count
    expect(screen.getByText('Vessels')).toBeInTheDocument();
  });

  it('handles drill-down navigation correctly', async () => {
    render(<FleetSpendVisualization {...defaultProps} />);
    
    // Switch to breakdown view and click on a category
    fireEvent.click(screen.getByText('Breakdown'));
    
    const enginePartsCategory = screen.getByText('Engine Parts').closest('div');
    if (enginePartsCategory) {
      fireEvent.click(enginePartsCategory);
    }
    
    await waitFor(() => {
      expect(defaultProps.onDrillDown).toHaveBeenCalledWith('category', 'Engine Parts');
    });
  });

  it('handles responsive design classes correctly', () => {
    const { container } = render(
      <FleetSpendVisualization {...defaultProps} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('handles empty data gracefully', () => {
    render(<FleetSpendVisualization {...defaultProps} data={[]} />);
    
    expect(screen.getByText('Fleet-Wide Spend Analysis')).toBeInTheDocument();
    // Should not crash and should handle empty state
  });

  it('formats currency values correctly', () => {
    render(<FleetSpendVisualization {...defaultProps} />);
    
    // Check that large numbers are formatted with commas
    expect(screen.getByText('$125,000')).toBeInTheDocument();
    expect(screen.getByText('$50,000')).toBeInTheDocument();
  });

  it('applies correct styling for positive and negative year-over-year changes', () => {
    const dataWithNegativeChange = [{
      ...mockSpendData[0],
      yearOverYear: {
        currentPeriod: 125000,
        previousPeriod: 140000,
        change: -15000,
        changePercentage: -10.7,
      },
    }];

    render(<FleetSpendVisualization {...defaultProps} data={dataWithNegativeChange} />);
    
    const changeElement = screen.getByText('-10.7%');
    expect(changeElement).toHaveClass('text-red-600');
  });

  it('maintains accessibility standards', () => {
    render(<FleetSpendVisualization {...defaultProps} />);
    
    // Check for proper button roles and labels
    const timeRangeButtons = screen.getAllByRole('button');
    expect(timeRangeButtons.length).toBeGreaterThan(0);
    
    // Check for proper heading structure
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });
});

// Integration test for the component with real interactions
describe('FleetSpendVisualization Integration', () => {
  it('handles complete user workflow', async () => {
    const onTimeRangeChange = vi.fn();
    const onDrillDown = vi.fn();

    render(
      <FleetSpendVisualization
        timeRange="monthly"
        vessels={mockVessels}
        categories={mockCategories}
        onTimeRangeChange={onTimeRangeChange}
        onDrillDown={onDrillDown}
        data={mockSpendData}
        loading={false}
      />
    );

    // 1. Change time range
    fireEvent.click(screen.getByText('Quarterly'));
    expect(onTimeRangeChange).toHaveBeenCalledWith('quarterly');

    // 2. Switch to breakdown view
    fireEvent.click(screen.getByText('Breakdown'));
    expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();

    // 3. Click on a category for drill-down
    const categoryElement = screen.getByText('Engine Parts').closest('div');
    if (categoryElement) {
      fireEvent.click(categoryElement);
    }

    await waitFor(() => {
      expect(onDrillDown).toHaveBeenCalledWith('category', 'Engine Parts');
    });

    // 4. Switch to comparison view
    fireEvent.click(screen.getByText('Comparison'));
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
  });
});