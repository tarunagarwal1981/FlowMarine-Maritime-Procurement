import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VesselSpecificAnalytics } from '../../components/analytics/VesselSpecificAnalytics';
import { useVesselAnalyticsData } from '../../hooks/useVesselAnalyticsData';
import { DashboardFilters, VesselSpendingPattern } from '../../types/analytics';

// Mock the hook
jest.mock('../../hooks/useVesselAnalyticsData');
const mockUseVesselAnalyticsData = useVesselAnalyticsData as jest.MockedFunction<typeof useVesselAnalyticsData>;

// Mock Chart.js
jest.mock('react-chartjs-2', () => ({
  Bar: ({ data, options }: any) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Bar Chart
    </div>
  ),
  Line: ({ data, options }: any) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Line Chart
    </div>
  ),
  Doughnut: ({ data, options }: any) => (
    <div data-testid="doughnut-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Doughnut Chart
    </div>
  ),
  Scatter: ({ data, options }: any) => (
    <div data-testid="scatter-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Scatter Chart
    </div>
  )
}));

const mockFilters: DashboardFilters = {
  timeRange: 'monthly',
  dateFrom: new Date('2024-01-01'),
  dateTo: new Date('2024-01-31'),
  vessels: ['vessel1'],
  categories: ['engine_parts', 'deck_equipment'],
  vendors: ['vendor1'],
  currency: 'USD'
};

const mockVesselData: VesselSpendingPattern = {
  vesselId: 'vessel1',
  vesselName: 'MV Atlantic Star',
  vesselType: 'Container Ship',
  totalSpend: 125000,
  spendPerCategory: [
    {
      category: 'engine_parts',
      amount: 45000,
      percentage: 36,
      trend: 'up',
      benchmark: 40000
    },
    {
      category: 'deck_equipment',
      amount: 30000,
      percentage: 24,
      trend: 'stable',
      benchmark: 32000
    },
    {
      category: 'safety_gear',
      amount: 25000,
      percentage: 20,
      trend: 'down',
      benchmark: 28000
    },
    {
      category: 'navigation',
      amount: 15000,
      percentage: 12,
      trend: 'up',
      benchmark: 12000
    },
    {
      category: 'catering',
      amount: 10000,
      percentage: 8,
      trend: 'stable',
      benchmark: 11000
    }
  ],
  spendTrend: [
    { period: '2024-01', amount: 120000 },
    { period: '2024-02', amount: 125000 },
    { period: '2024-03', amount: 130000 }
  ],
  efficiency: {
    spendPerNauticalMile: 12.5,
    spendPerDay: 850,
    maintenanceEfficiency: 85,
    procurementEfficiency: 78,
    overallRating: 82,
    fleetRank: 3
  },
  routeCorrelation: [
    {
      route: 'Singapore - Rotterdam',
      frequency: 12,
      averageSpend: 45000,
      spendPerMile: 4.2,
      correlation: 0.75
    },
    {
      route: 'Los Angeles - Shanghai',
      frequency: 8,
      averageSpend: 38000,
      spendPerMile: 3.8,
      correlation: 0.65
    },
    {
      route: 'Hamburg - New York',
      frequency: 6,
      averageSpend: 42000,
      spendPerMile: 4.5,
      correlation: 0.82
    }
  ],
  recommendations: [
    {
      id: 'rec1',
      type: 'cost_reduction',
      title: 'Optimize Engine Parts Procurement',
      description: 'Consider bulk purchasing for frequently used engine parts',
      priority: 'high',
      estimatedSavings: 8500,
      implementationEffort: 'medium'
    },
    {
      id: 'rec2',
      type: 'efficiency',
      title: 'Improve Route Planning',
      description: 'Optimize procurement timing based on route schedules',
      priority: 'medium',
      estimatedSavings: 5200,
      implementationEffort: 'low'
    },
    {
      id: 'rec3',
      type: 'maintenance',
      title: 'Predictive Maintenance Implementation',
      description: 'Implement predictive maintenance to reduce emergency repairs',
      priority: 'high',
      estimatedSavings: 12000,
      implementationEffort: 'high'
    }
  ]
};

const mockMultipleVesselsData: VesselSpendingPattern[] = [
  mockVesselData,
  {
    ...mockVesselData,
    vesselId: 'vessel2',
    vesselName: 'MV Pacific Dawn',
    vesselType: 'Bulk Carrier',
    totalSpend: 98000,
    efficiency: {
      ...mockVesselData.efficiency,
      overallRating: 75,
      fleetRank: 7
    }
  }
];

describe('VesselSpecificAnalytics', () => {
  const mockOnVesselSelect = jest.fn();
  const mockOnDrillDown = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    expect(screen.getByText('Vessel-Specific Analytics')).toBeInTheDocument();
    expect(screen.getByRole('generic', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const mockRefetch = jest.fn();
    mockUseVesselAnalyticsData.mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to load data',
      refetch: mockRefetch
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    expect(screen.getByText('Error loading vessel analytics data')).toBeInTheDocument();
    
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders overview tab with vessel data', () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: mockVesselData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Check overview metrics
    expect(screen.getByText('$125,000')).toBeInTheDocument(); // Total spend
    expect(screen.getByText('#3')).toBeInTheDocument(); // Fleet rank
    expect(screen.getByText('82.0/100')).toBeInTheDocument(); // Overall rating
    expect(screen.getByText('Container Ship')).toBeInTheDocument(); // Vessel type
    expect(screen.getByText('MV Atlantic Star')).toBeInTheDocument(); // Vessel name

    // Check charts are rendered
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(1);
    expect(screen.getAllByTestId('line-chart')).toHaveLength(1);

    // Check KPI values
    expect(screen.getByText('$12.50')).toBeInTheDocument(); // Spend per nautical mile
    expect(screen.getByText('$850.00')).toBeInTheDocument(); // Spend per day
    expect(screen.getByText('85.0%')).toBeInTheDocument(); // Maintenance efficiency
    expect(screen.getByText('78.0%')).toBeInTheDocument(); // Procurement efficiency
  });

  it('switches between tabs correctly', async () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: mockVesselData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to spending patterns tab
    const spendingTab = screen.getByText('Spending Patterns');
    fireEvent.click(spendingTab);

    await waitFor(() => {
      expect(screen.getByText('Spending by Category')).toBeInTheDocument();
      expect(screen.getByText('Category Comparison')).toBeInTheDocument();
      expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
    });

    // Switch to efficiency tab
    const efficiencyTab = screen.getByText('Efficiency');
    fireEvent.click(efficiencyTab);

    await waitFor(() => {
      expect(screen.getByText('Efficiency Breakdown')).toBeInTheDocument();
      expect(screen.getByText('Fleet Ranking')).toBeInTheDocument();
      expect(screen.getByText('Fleet Position')).toBeInTheDocument();
    });

    // Switch to route analysis tab
    const routesTab = screen.getByText('Route Analysis');
    fireEvent.click(routesTab);

    await waitFor(() => {
      expect(screen.getByText('Route Spend Correlation')).toBeInTheDocument();
      expect(screen.getByText('Route Details')).toBeInTheDocument();
      expect(screen.getByTestId('scatter-chart')).toBeInTheDocument();
    });

    // Switch to recommendations tab
    const recommendationsTab = screen.getByText('Recommendations');
    fireEvent.click(recommendationsTab);

    await waitFor(() => {
      expect(screen.getByText('Total Potential Savings')).toBeInTheDocument();
      expect(screen.getByText('High Priority Items')).toBeInTheDocument();
      expect(screen.getByText('Optimize Engine Parts Procurement')).toBeInTheDocument();
    });
  });

  it('displays spending patterns correctly in spending tab', async () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: mockVesselData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to spending patterns tab
    const spendingTab = screen.getByText('Spending Patterns');
    fireEvent.click(spendingTab);

    await waitFor(() => {
      // Check category details table
      expect(screen.getByText('ENGINE_PARTS')).toBeInTheDocument();
      expect(screen.getByText('DECK_EQUIPMENT')).toBeInTheDocument();
      expect(screen.getByText('SAFETY_GEAR')).toBeInTheDocument();
      expect(screen.getByText('$45,000')).toBeInTheDocument(); // Engine parts amount
      expect(screen.getByText('36.0%')).toBeInTheDocument(); // Engine parts percentage
      expect(screen.getByText('↗ Increasing')).toBeInTheDocument(); // Trend indicators
      expect(screen.getByText('↘ Decreasing')).toBeInTheDocument();
      expect(screen.getByText('→ Stable')).toBeInTheDocument();
    });
  });

  it('displays efficiency metrics correctly in efficiency tab', async () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: mockVesselData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to efficiency tab
    const efficiencyTab = screen.getByText('Efficiency');
    fireEvent.click(efficiencyTab);

    await waitFor(() => {
      // Check efficiency metrics
      expect(screen.getByText('Spend per Nautical Mile')).toBeInTheDocument();
      expect(screen.getByText('Spend per Day')).toBeInTheDocument();
      expect(screen.getByText('Maintenance Efficiency')).toBeInTheDocument();
      expect(screen.getByText('Procurement Efficiency')).toBeInTheDocument();
      expect(screen.getByText('Overall Rating')).toBeInTheDocument();
      
      // Check fleet ranking
      expect(screen.getByText('Top performer')).toBeInTheDocument(); // Rank 3 is top performer
    });
  });

  it('displays route analysis correctly in routes tab', async () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: mockVesselData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to route analysis tab
    const routesTab = screen.getByText('Route Analysis');
    fireEvent.click(routesTab);

    await waitFor(() => {
      // Check route details
      expect(screen.getByText('Singapore - Rotterdam')).toBeInTheDocument();
      expect(screen.getByText('Los Angeles - Shanghai')).toBeInTheDocument();
      expect(screen.getByText('Hamburg - New York')).toBeInTheDocument();
      expect(screen.getByText('12 trips')).toBeInTheDocument(); // Frequency
      expect(screen.getByText('$45,000')).toBeInTheDocument(); // Average spend
      expect(screen.getByText('$4.20')).toBeInTheDocument(); // Spend per mile
      expect(screen.getByText('0.75')).toBeInTheDocument(); // Correlation
    });
  });

  it('displays recommendations correctly in recommendations tab', async () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: mockVesselData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to recommendations tab
    const recommendationsTab = screen.getByText('Recommendations');
    fireEvent.click(recommendationsTab);

    await waitFor(() => {
      // Check total savings
      expect(screen.getByText('$25,700')).toBeInTheDocument(); // Total potential savings
      expect(screen.getByText('2')).toBeInTheDocument(); // High priority items

      // Check individual recommendations
      expect(screen.getByText('Optimize Engine Parts Procurement')).toBeInTheDocument();
      expect(screen.getByText('Improve Route Planning')).toBeInTheDocument();
      expect(screen.getByText('Predictive Maintenance Implementation')).toBeInTheDocument();
      expect(screen.getByText('$8,500')).toBeInTheDocument(); // Individual savings
      expect(screen.getByText('high priority')).toBeInTheDocument();
      expect(screen.getByText('medium effort')).toBeInTheDocument();
    });
  });

  it('handles vessel selection with multiple vessels', async () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: mockMultipleVesselsData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Check vessel selector is present
    const vesselSelect = screen.getByRole('combobox');
    expect(vesselSelect).toBeInTheDocument();
    expect(screen.getByText('MV Atlantic Star')).toBeInTheDocument();
    expect(screen.getByText('MV Pacific Dawn')).toBeInTheDocument();

    // Change vessel selection
    fireEvent.change(vesselSelect, { target: { value: 'vessel2' } });
    expect(mockOnVesselSelect).toHaveBeenCalledWith('vessel2');
  });

  it('displays fleet comparison correctly in comparison tab', async () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: mockMultipleVesselsData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to comparison tab
    const comparisonTab = screen.getByText('Fleet Comparison');
    fireEvent.click(comparisonTab);

    await waitFor(() => {
      expect(screen.getByText('Fleet Comparison')).toBeInTheDocument();
      expect(screen.getByText('Vessel Rankings')).toBeInTheDocument();
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      
      // Check vessel rankings table
      expect(screen.getByText('MV Atlantic Star')).toBeInTheDocument();
      expect(screen.getByText('MV Pacific Dawn')).toBeInTheDocument();
      expect(screen.getByText('Container Ship')).toBeInTheDocument();
      expect(screen.getByText('Bulk Carrier')).toBeInTheDocument();
    });
  });

  it('calls onDrillDown when category is clicked', async () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: mockVesselData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to spending patterns tab
    const spendingTab = screen.getByText('Spending Patterns');
    fireEvent.click(spendingTab);

    await waitFor(() => {
      // Click on a category row
      const categoryRow = screen.getByText('ENGINE_PARTS').closest('tr');
      expect(categoryRow).toBeInTheDocument();
      
      if (categoryRow) {
        fireEvent.click(categoryRow);
        expect(mockOnDrillDown).toHaveBeenCalledWith('engine_parts', 'vessel1');
      }
    });
  });

  it('handles no vessel data gracefully', () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: null,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    expect(screen.getByText('No vessel data available')).toBeInTheDocument();
  });

  it('handles comparison tab with insufficient data', async () => {
    mockUseVesselAnalyticsData.mockReturnValue({
      data: mockVesselData, // Single vessel data
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <VesselSpecificAnalytics 
        filters={mockFilters} 
        selectedVessel="vessel1"
        onVesselSelect={mockOnVesselSelect}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to comparison tab
    const comparisonTab = screen.getByText('Fleet Comparison');
    fireEvent.click(comparisonTab);

    await waitFor(() => {
      expect(screen.getByText('Comparison requires multiple vessels in the dataset')).toBeInTheDocument();
    });
  });
});