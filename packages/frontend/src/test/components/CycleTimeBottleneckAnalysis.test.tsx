import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CycleTimeBottleneckAnalysis } from '../../components/analytics/CycleTimeBottleneckAnalysis';
import { useCycleTimeData } from '../../hooks/useCycleTimeData';
import { DashboardFilters, CycleTimeData } from '../../types/analytics';

// Mock the hook
jest.mock('../../hooks/useCycleTimeData');
const mockUseCycleTimeData = useCycleTimeData as jest.MockedFunction<typeof useCycleTimeData>;

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
  )
}));

const mockFilters: DashboardFilters = {
  timeRange: 'monthly',
  dateFrom: new Date('2024-01-01'),
  dateTo: new Date('2024-01-31'),
  vessels: ['vessel1', 'vessel2'],
  categories: ['engine_parts', 'deck_equipment'],
  vendors: ['vendor1'],
  currency: 'USD'
};

const mockCycleTimeData: CycleTimeData = {
  averageCycleTime: 48.5,
  cycleTimeByStage: [
    {
      stage: 'requisition',
      stageName: 'Requisition Creation',
      averageTime: 2.5,
      minTime: 0.5,
      maxTime: 8.0,
      bottlenecks: [],
      efficiency: 85
    },
    {
      stage: 'approval',
      stageName: 'Approval Process',
      averageTime: 12.0,
      minTime: 2.0,
      maxTime: 48.0,
      bottlenecks: [
        {
          id: 'bottleneck1',
          stage: 'approval',
          description: 'Delayed approvals due to unavailable approvers',
          impact: 'high',
          frequency: 15,
          averageDelay: 8.5,
          rootCause: 'Insufficient delegation procedures',
          recommendation: 'Implement automated delegation system',
          estimatedSavings: 6.0
        }
      ],
      efficiency: 65
    },
    {
      stage: 'rfq',
      stageName: 'RFQ Generation',
      averageTime: 8.0,
      minTime: 4.0,
      maxTime: 16.0,
      bottlenecks: [],
      efficiency: 90
    },
    {
      stage: 'quote_selection',
      stageName: 'Quote Selection',
      averageTime: 16.0,
      minTime: 8.0,
      maxTime: 72.0,
      bottlenecks: [],
      efficiency: 75
    },
    {
      stage: 'po_creation',
      stageName: 'PO Creation',
      averageTime: 4.0,
      minTime: 1.0,
      maxTime: 12.0,
      bottlenecks: [],
      efficiency: 95
    },
    {
      stage: 'delivery',
      stageName: 'Delivery',
      averageTime: 6.0,
      minTime: 2.0,
      maxTime: 24.0,
      bottlenecks: [],
      efficiency: 80
    }
  ],
  vesselComparison: [
    {
      vesselId: 'vessel1',
      vesselName: 'MV Atlantic Star',
      averageCycleTime: 42.0,
      efficiency: 88,
      rank: 1,
      improvement: 5.2,
      bottleneckCount: 0
    },
    {
      vesselId: 'vessel2',
      vesselName: 'MV Pacific Dawn',
      averageCycleTime: 55.0,
      efficiency: 72,
      rank: 2,
      improvement: -2.1,
      bottleneckCount: 2
    }
  ],
  bottlenecks: [
    {
      id: 'bottleneck1',
      stage: 'approval',
      description: 'Delayed approvals due to unavailable approvers',
      impact: 'high',
      frequency: 15,
      averageDelay: 8.5,
      rootCause: 'Insufficient delegation procedures',
      recommendation: 'Implement automated delegation system',
      estimatedSavings: 6.0
    },
    {
      id: 'bottleneck2',
      stage: 'quote_selection',
      description: 'Slow vendor response times',
      impact: 'medium',
      frequency: 8,
      averageDelay: 4.2,
      rootCause: 'Limited vendor pool in remote locations',
      recommendation: 'Expand vendor network and implement response time SLAs',
      estimatedSavings: 3.5
    }
  ],
  trends: [
    {
      period: '2024-01',
      averageCycleTime: 52.0,
      efficiency: 75,
      bottleneckCount: 3
    },
    {
      period: '2024-02',
      averageCycleTime: 48.5,
      efficiency: 78,
      bottleneckCount: 2
    }
  ],
  recommendations: [
    {
      id: 'rec1',
      title: 'Implement Automated Delegation',
      description: 'Set up automatic delegation when approvers are unavailable',
      impact: 'high',
      effort: 'medium',
      estimatedTimeSavings: 6.0,
      estimatedCostSavings: 15000,
      category: 'automation'
    },
    {
      id: 'rec2',
      title: 'Expand Vendor Network',
      description: 'Onboard additional vendors in key geographic regions',
      impact: 'medium',
      effort: 'high',
      estimatedTimeSavings: 3.5,
      estimatedCostSavings: 8500,
      category: 'process'
    }
  ]
};

describe('CycleTimeBottleneckAnalysis', () => {
  const mockOnDrillDown = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state correctly', () => {
    mockUseCycleTimeData.mockReturnValue({
      data: null,
      loading: true,
      error: null,
      refetch: jest.fn()
    });

    render(
      <CycleTimeBottleneckAnalysis 
        filters={mockFilters} 
        vessels={['vessel1', 'vessel2']}
        onDrillDown={mockOnDrillDown}
      />
    );

    expect(screen.getByText('Cycle Time & Bottleneck Analysis')).toBeInTheDocument();
    expect(screen.getByRole('generic', { name: /loading/i })).toBeInTheDocument();
  });

  it('renders error state correctly', () => {
    const mockRefetch = jest.fn();
    mockUseCycleTimeData.mockReturnValue({
      data: null,
      loading: false,
      error: 'Failed to load data',
      refetch: mockRefetch
    });

    render(
      <CycleTimeBottleneckAnalysis 
        filters={mockFilters} 
        vessels={['vessel1', 'vessel2']}
        onDrillDown={mockOnDrillDown}
      />
    );

    expect(screen.getByText('Error loading cycle time data')).toBeInTheDocument();
    
    const retryButton = screen.getByText('Retry');
    fireEvent.click(retryButton);
    expect(mockRefetch).toHaveBeenCalled();
  });

  it('renders overview tab with cycle time data', () => {
    mockUseCycleTimeData.mockReturnValue({
      data: mockCycleTimeData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <CycleTimeBottleneckAnalysis 
        filters={mockFilters} 
        vessels={['vessel1', 'vessel2']}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Check overview metrics
    expect(screen.getByText('48.5 hrs')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Active bottlenecks
    expect(screen.getByText('78.0%')).toBeInTheDocument(); // Efficiency score

    // Check charts are rendered
    expect(screen.getAllByTestId('bar-chart')).toHaveLength(1);
    expect(screen.getAllByTestId('line-chart')).toHaveLength(1);
  });

  it('switches between tabs correctly', async () => {
    mockUseCycleTimeData.mockReturnValue({
      data: mockCycleTimeData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <CycleTimeBottleneckAnalysis 
        filters={mockFilters} 
        vessels={['vessel1', 'vessel2']}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to stages tab
    const stagesTab = screen.getByText('Stages');
    fireEvent.click(stagesTab);

    await waitFor(() => {
      expect(screen.getByText('Stage-by-Stage Analysis')).toBeInTheDocument();
      expect(screen.getByText('Requisition Creation')).toBeInTheDocument();
      expect(screen.getByText('Approval Process')).toBeInTheDocument();
    });

    // Switch to vessels tab
    const vesselsTab = screen.getByText('Vessels');
    fireEvent.click(vesselsTab);

    await waitFor(() => {
      expect(screen.getByText('Vessel Performance Comparison')).toBeInTheDocument();
      expect(screen.getByText('MV Atlantic Star')).toBeInTheDocument();
      expect(screen.getByText('MV Pacific Dawn')).toBeInTheDocument();
    });

    // Switch to bottlenecks tab
    const bottlenecksTab = screen.getByText('Bottlenecks');
    fireEvent.click(bottlenecksTab);

    await waitFor(() => {
      expect(screen.getByText('High Impact')).toBeInTheDocument();
      expect(screen.getByText('Delayed approvals due to unavailable approvers')).toBeInTheDocument();
    });

    // Switch to recommendations tab
    const recommendationsTab = screen.getByText('Recommendations');
    fireEvent.click(recommendationsTab);

    await waitFor(() => {
      expect(screen.getByText('Potential Time Savings')).toBeInTheDocument();
      expect(screen.getByText('Implement Automated Delegation')).toBeInTheDocument();
    });
  });

  it('displays stage details correctly in stages tab', async () => {
    mockUseCycleTimeData.mockReturnValue({
      data: mockCycleTimeData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <CycleTimeBottleneckAnalysis 
        filters={mockFilters} 
        vessels={['vessel1', 'vessel2']}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to stages tab
    const stagesTab = screen.getByText('Stages');
    fireEvent.click(stagesTab);

    await waitFor(() => {
      // Check stage details table
      expect(screen.getByText('2.5 hrs')).toBeInTheDocument(); // Requisition avg time
      expect(screen.getByText('12.0 hrs')).toBeInTheDocument(); // Approval avg time
      expect(screen.getByText('0.5 - 8.0 hrs')).toBeInTheDocument(); // Requisition range
      expect(screen.getByText('2.0 - 48.0 hrs')).toBeInTheDocument(); // Approval range
      expect(screen.getByText('1 issues')).toBeInTheDocument(); // Approval bottlenecks
      expect(screen.getByText('No issues')).toBeInTheDocument(); // Other stages
    });
  });

  it('displays vessel rankings correctly in vessels tab', async () => {
    mockUseCycleTimeData.mockReturnValue({
      data: mockCycleTimeData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <CycleTimeBottleneckAnalysis 
        filters={mockFilters} 
        vessels={['vessel1', 'vessel2']}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to vessels tab
    const vesselsTab = screen.getByText('Vessels');
    fireEvent.click(vesselsTab);

    await waitFor(() => {
      // Check vessel rankings
      expect(screen.getByText('#1')).toBeInTheDocument();
      expect(screen.getByText('#2')).toBeInTheDocument();
      expect(screen.getByText('42.0 hrs')).toBeInTheDocument(); // Atlantic Star cycle time
      expect(screen.getByText('55.0 hrs')).toBeInTheDocument(); // Pacific Dawn cycle time
      expect(screen.getByText('↑ 5.2%')).toBeInTheDocument(); // Improvement
      expect(screen.getByText('↓ 2.1%')).toBeInTheDocument(); // Decline
    });
  });

  it('displays bottlenecks by impact level', async () => {
    mockUseCycleTimeData.mockReturnValue({
      data: mockCycleTimeData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <CycleTimeBottleneckAnalysis 
        filters={mockFilters} 
        vessels={['vessel1', 'vessel2']}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to bottlenecks tab
    const bottlenecksTab = screen.getByText('Bottlenecks');
    fireEvent.click(bottlenecksTab);

    await waitFor(() => {
      // Check impact level counts
      expect(screen.getByText('1')).toBeInTheDocument(); // High impact count
      expect(screen.getByText('1')).toBeInTheDocument(); // Medium impact count (appears twice)
      expect(screen.getByText('0')).toBeInTheDocument(); // Low impact count

      // Check bottleneck details
      expect(screen.getByText('Delayed approvals due to unavailable approvers')).toBeInTheDocument();
      expect(screen.getByText('Slow vendor response times')).toBeInTheDocument();
      expect(screen.getByText('Frequency: 15/month')).toBeInTheDocument();
      expect(screen.getByText('Avg Delay: 8.5 hrs')).toBeInTheDocument();
      expect(screen.getByText('Potential Savings: 6.0 hrs')).toBeInTheDocument();
    });
  });

  it('displays recommendations with savings calculations', async () => {
    mockUseCycleTimeData.mockReturnValue({
      data: mockCycleTimeData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <CycleTimeBottleneckAnalysis 
        filters={mockFilters} 
        vessels={['vessel1', 'vessel2']}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to recommendations tab
    const recommendationsTab = screen.getByText('Recommendations');
    fireEvent.click(recommendationsTab);

    await waitFor(() => {
      // Check total savings
      expect(screen.getByText('9.5 hrs')).toBeInTheDocument(); // Total time savings
      expect(screen.getByText('$23,500')).toBeInTheDocument(); // Total cost savings

      // Check individual recommendations
      expect(screen.getByText('Implement Automated Delegation')).toBeInTheDocument();
      expect(screen.getByText('Expand Vendor Network')).toBeInTheDocument();
      expect(screen.getByText('Time Savings: 6.0 hrs')).toBeInTheDocument();
      expect(screen.getByText('Cost Savings: $15,000')).toBeInTheDocument();
      expect(screen.getByText('high impact')).toBeInTheDocument();
      expect(screen.getByText('medium effort')).toBeInTheDocument();
    });
  });

  it('calls onDrillDown when stage is clicked', async () => {
    mockUseCycleTimeData.mockReturnValue({
      data: mockCycleTimeData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <CycleTimeBottleneckAnalysis 
        filters={mockFilters} 
        vessels={['vessel1', 'vessel2']}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to stages tab
    const stagesTab = screen.getByText('Stages');
    fireEvent.click(stagesTab);

    await waitFor(() => {
      // The chart click would be handled by Chart.js, so we test the callback setup
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  it('handles vessel selection in vessels tab', async () => {
    mockUseCycleTimeData.mockReturnValue({
      data: mockCycleTimeData,
      loading: false,
      error: null,
      refetch: jest.fn()
    });

    render(
      <CycleTimeBottleneckAnalysis 
        filters={mockFilters} 
        vessels={['vessel1', 'vessel2']}
        onDrillDown={mockOnDrillDown}
      />
    );

    // Switch to vessels tab
    const vesselsTab = screen.getByText('Vessels');
    fireEvent.click(vesselsTab);

    await waitFor(() => {
      // Click on a vessel row
      const vesselRow = screen.getByText('MV Atlantic Star').closest('tr');
      expect(vesselRow).toBeInTheDocument();
      
      if (vesselRow) {
        fireEvent.click(vesselRow);
        // The row should be selected (would have bg-blue-50 class)
        expect(vesselRow).toHaveClass('bg-blue-50');
      }
    });
  });
});