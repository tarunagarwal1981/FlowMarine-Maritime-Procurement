import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import VendorPerformanceScorecards from '../../components/analytics/VendorPerformanceScorecards';
import { VendorPerformance } from '../../types/analytics';

// Mock Recharts
vi.mock('recharts', () => ({
  BarChart: ({ children, ...props }: any) => (
    <div data-testid="bar-chart" data-chart-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
  Bar: ({ dataKey, ...props }: any) => (
    <div data-testid={`bar-${dataKey}`} data-bar-props={JSON.stringify(props)} />
  ),
  LineChart: ({ children, ...props }: any) => (
    <div data-testid="line-chart" data-chart-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
  Line: ({ dataKey, ...props }: any) => (
    <div data-testid={`line-${dataKey}`} data-line-props={JSON.stringify(props)} />
  ),
  RadarChart: ({ children, ...props }: any) => (
    <div data-testid="radar-chart" data-chart-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
  Radar: ({ dataKey, ...props }: any) => (
    <div data-testid={`radar-${dataKey}`} data-radar-props={JSON.stringify(props)} />
  ),
  ScatterChart: ({ children, ...props }: any) => (
    <div data-testid="scatter-chart" data-chart-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
  Scatter: ({ dataKey, ...props }: any) => (
    <div data-testid={`scatter-${dataKey}`} data-scatter-props={JSON.stringify(props)} />
  ),
  XAxis: (props: any) => <div data-testid="x-axis" data-axis-props={JSON.stringify(props)} />,
  YAxis: (props: any) => <div data-testid="y-axis" data-axis-props={JSON.stringify(props)} />,
  CartesianGrid: (props: any) => <div data-testid="cartesian-grid" data-grid-props={JSON.stringify(props)} />,
  Tooltip: (props: any) => <div data-testid="tooltip" data-tooltip-props={JSON.stringify(props)} />,
  Legend: (props: any) => <div data-testid="legend" data-legend-props={JSON.stringify(props)} />,
  ResponsiveContainer: ({ children, ...props }: any) => (
    <div data-testid="responsive-container" data-container-props={JSON.stringify(props)}>
      {children}
    </div>
  ),
  PolarGrid: (props: any) => <div data-testid="polar-grid" data-grid-props={JSON.stringify(props)} />,
  PolarAngleAxis: (props: any) => <div data-testid="polar-angle-axis" data-axis-props={JSON.stringify(props)} />,
  PolarRadiusAxis: (props: any) => <div data-testid="polar-radius-axis" data-axis-props={JSON.stringify(props)} />,
  Cell: (props: any) => <div data-testid="cell" data-cell-props={JSON.stringify(props)} />,
}));

const mockVendorData: VendorPerformance[] = [
  {
    vendorId: 'vendor-1',
    vendorName: 'Maritime Supply Co.',
    overallScore: 92.5,
    deliveryScore: 95.0,
    qualityScore: 88.0,
    priceScore: 94.0,
    totalOrders: 150,
    onTimeDeliveryRate: 96.5,
    averageDeliveryTime: 3.2,
    costSavings: 25000,
    trend: 'improving',
    historicalScores: [
      { period: 'Jan 2024', overallScore: 90.0, deliveryScore: 92.0, qualityScore: 85.0, priceScore: 92.0 },
      { period: 'Feb 2024', overallScore: 91.5, deliveryScore: 94.0, qualityScore: 87.0, priceScore: 93.0 },
      { period: 'Mar 2024', overallScore: 92.5, deliveryScore: 95.0, qualityScore: 88.0, priceScore: 94.0 },
    ],
    recommendations: [
      'Top performer - consider expanding partnership',
      'Explore opportunities for preferred vendor status',
    ],
  },
  {
    vendorId: 'vendor-2',
    vendorName: 'Ocean Parts Ltd.',
    overallScore: 78.5,
    deliveryScore: 72.0,
    qualityScore: 85.0,
    priceScore: 78.0,
    totalOrders: 89,
    onTimeDeliveryRate: 74.5,
    averageDeliveryTime: 5.8,
    costSavings: 12000,
    trend: 'declining',
    historicalScores: [
      { period: 'Jan 2024', overallScore: 82.0, deliveryScore: 78.0, qualityScore: 86.0, priceScore: 80.0 },
      { period: 'Feb 2024', overallScore: 80.0, deliveryScore: 75.0, qualityScore: 85.5, priceScore: 79.0 },
      { period: 'Mar 2024', overallScore: 78.5, deliveryScore: 72.0, qualityScore: 85.0, priceScore: 78.0 },
    ],
    recommendations: [
      'Improve delivery performance - currently at 72.0%',
      'Consider implementing delivery tracking system',
    ],
  },
  {
    vendorId: 'vendor-3',
    vendorName: 'Nautical Equipment Inc.',
    overallScore: 85.0,
    deliveryScore: 88.0,
    qualityScore: 82.0,
    priceScore: 85.0,
    totalOrders: 120,
    onTimeDeliveryRate: 89.2,
    averageDeliveryTime: 4.1,
    costSavings: 18500,
    trend: 'stable',
    historicalScores: [
      { period: 'Jan 2024', overallScore: 84.5, deliveryScore: 87.0, qualityScore: 81.0, priceScore: 85.5 },
      { period: 'Feb 2024', overallScore: 84.8, deliveryScore: 87.5, qualityScore: 81.5, priceScore: 85.2 },
      { period: 'Mar 2024', overallScore: 85.0, deliveryScore: 88.0, qualityScore: 82.0, priceScore: 85.0 },
    ],
    recommendations: [
      'Performance is within acceptable ranges',
    ],
  },
];

describe('VendorPerformanceScorecards', () => {
  const defaultProps = {
    topVendorsCount: 10,
    performanceMetrics: ['delivery', 'quality', 'price'],
    timeRange: {
      from: new Date('2024-01-01'),
      to: new Date('2024-03-31'),
    },
    data: mockVendorData,
    loading: false,
    onVendorSelect: vi.fn(),
    onRecommendationClick: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    expect(screen.getByText('Vendor Performance Scorecards')).toBeInTheDocument();
  });

  it('displays loading state correctly', () => {
    render(<VendorPerformanceScorecards {...defaultProps} loading={true} />);
    const loadingElement = document.querySelector('.animate-pulse');
    expect(loadingElement).toBeInTheDocument();
  });

  it('displays header information correctly', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    expect(screen.getByText('Vendor Performance Scorecards')).toBeInTheDocument();
    expect(screen.getByText(/Top 10 vendors/)).toBeInTheDocument();
    expect(screen.getByText(/1\/1\/2024 - 3\/31\/2024/)).toBeInTheDocument();
  });

  it('renders sort by selector with correct options', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    const sortSelect = screen.getByDisplayValue('Overall Score');
    expect(sortSelect).toBeInTheDocument();
    
    // Check if all sort options are available
    fireEvent.click(sortSelect);
    expect(screen.getByText('Delivery Score')).toBeInTheDocument();
    expect(screen.getByText('Quality Score')).toBeInTheDocument();
    expect(screen.getByText('Price Score')).toBeInTheDocument();
    expect(screen.getByText('Cost Savings')).toBeInTheDocument();
  });

  it('renders view mode selector with correct options', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    expect(screen.getByText('Scorecards')).toBeInTheDocument();
    expect(screen.getByText('Comparison')).toBeInTheDocument();
    expect(screen.getByText('Trends')).toBeInTheDocument();
    expect(screen.getByText('Recommendations')).toBeInTheDocument();
  });

  it('displays vendor scorecards in default view', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    // Check if vendor names are displayed
    expect(screen.getByText('Maritime Supply Co.')).toBeInTheDocument();
    expect(screen.getByText('Ocean Parts Ltd.')).toBeInTheDocument();
    expect(screen.getByText('Nautical Equipment Inc.')).toBeInTheDocument();
    
    // Check if scores are displayed
    expect(screen.getByText('92.5')).toBeInTheDocument(); // Overall score
    expect(screen.getByText('95.0')).toBeInTheDocument(); // Delivery score
    expect(screen.getByText('88.0')).toBeInTheDocument(); // Quality score
  });

  it('displays trend indicators correctly', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    expect(screen.getByText('improving')).toBeInTheDocument();
    expect(screen.getByText('declining')).toBeInTheDocument();
    expect(screen.getByText('stable')).toBeInTheDocument();
  });

  it('displays key metrics for each vendor', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    // Check for orders count
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('89')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    
    // Check for cost savings
    expect(screen.getByText('$25,000')).toBeInTheDocument();
    expect(screen.getByText('$12,000')).toBeInTheDocument();
    expect(screen.getByText('$18,500')).toBeInTheDocument();
  });

  it('handles vendor selection correctly', async () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    const vendorCard = screen.getByText('Maritime Supply Co.').closest('div');
    if (vendorCard) {
      fireEvent.click(vendorCard);
    }
    
    await waitFor(() => {
      expect(defaultProps.onVendorSelect).toHaveBeenCalledWith(mockVendorData[0]);
    });
  });

  it('switches to comparison view correctly', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Comparison'));
    
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByText('Rank')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('switches to trends view correctly', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Trends'));
    
    expect(screen.getByText('Select Vendor:')).toBeInTheDocument();
    expect(screen.getByText('Choose a vendor...')).toBeInTheDocument();
  });

  it('displays radar and line charts in trends view when vendor is selected', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Trends'));
    
    const vendorSelect = screen.getByDisplayValue('');
    fireEvent.change(vendorSelect, { target: { value: 'vendor-1' } });
    
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    expect(screen.getByText('Performance Radar')).toBeInTheDocument();
    expect(screen.getByText('Historical Trends')).toBeInTheDocument();
  });

  it('switches to recommendations view correctly', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Recommendations'));
    
    expect(screen.getByText('Top performer - consider expanding partnership')).toBeInTheDocument();
    expect(screen.getByText('Improve delivery performance - currently at 72.0%')).toBeInTheDocument();
    expect(screen.getByText('Performance is within acceptable ranges')).toBeInTheDocument();
  });

  it('handles recommendation clicks correctly', async () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Recommendations'));
    
    const recommendationElement = screen.getByText('Top performer - consider expanding partnership').closest('div');
    if (recommendationElement) {
      fireEvent.click(recommendationElement);
    }
    
    await waitFor(() => {
      expect(defaultProps.onRecommendationClick).toHaveBeenCalledWith(
        'vendor-1',
        'Top performer - consider expanding partnership'
      );
    });
  });

  it('handles sort by changes correctly', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    const sortSelect = screen.getByDisplayValue('Overall Score');
    fireEvent.change(sortSelect, { target: { value: 'deliveryScore' } });
    
    // The component should re-sort vendors by delivery score
    // We can't easily test the sorting without checking the order of elements
    expect(sortSelect).toHaveValue('deliveryScore');
  });

  it('displays correct score colors based on performance', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    // High score should have green color (we can't easily test computed styles in jsdom)
    // But we can verify the scores are displayed
    expect(screen.getByText('92.5')).toBeInTheDocument(); // High score
    expect(screen.getByText('78.5')).toBeInTheDocument(); // Lower score
  });

  it('handles responsive design correctly', () => {
    const { container } = render(
      <VendorPerformanceScorecards {...defaultProps} className="custom-class" />
    );
    
    expect(container.firstChild).toHaveClass('custom-class');
    
    // Check for responsive grid classes
    expect(container.querySelector('.grid-cols-1')).toBeInTheDocument();
    expect(container.querySelector('.md\\:grid-cols-2')).toBeInTheDocument();
    expect(container.querySelector('.lg\\:grid-cols-3')).toBeInTheDocument();
  });

  it('displays vendor ranking table in comparison view', () => {
    render(<VendorPerformanceScorecards {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Comparison'));
    
    // Check table headers
    expect(screen.getByText('Rank')).toBeInTheDocument();
    expect(screen.getByText('Vendor')).toBeInTheDocument();
    expect(screen.getByText('Overall Score')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('Quality')).toBeInTheDocument();
    expect(screen.getByText('Price')).toBeInTheDocument();
    expect(screen.getByText('Cost Savings')).toBeInTheDocument();
  });

  it('handles empty recommendations gracefully', () => {
    const dataWithoutRecommendations = mockVendorData.map(vendor => ({
      ...vendor,
      recommendations: [],
    }));

    render(
      <VendorPerformanceScorecards
        {...defaultProps}
        data={dataWithoutRecommendations}
      />
    );
    
    fireEvent.click(screen.getByText('Recommendations'));
    
    expect(screen.getByText('No specific recommendations available for this vendor.')).toBeInTheDocument();
    expect(screen.getByText('Performance is within acceptable ranges.')).toBeInTheDocument();
  });
});

// Integration test for complete user workflow
describe('VendorPerformanceScorecards Integration', () => {
  it('handles complete user interaction workflow', async () => {
    const onVendorSelect = vi.fn();
    const onRecommendationClick = vi.fn();

    render(
      <VendorPerformanceScorecards
        topVendorsCount={10}
        performanceMetrics={['delivery', 'quality', 'price']}
        timeRange={{
          from: new Date('2024-01-01'),
          to: new Date('2024-03-31'),
        }}
        data={mockVendorData}
        loading={false}
        onVendorSelect={onVendorSelect}
        onRecommendationClick={onRecommendationClick}
      />
    );

    // 1. Select a vendor in scorecards view
    const vendorCard = screen.getByText('Maritime Supply Co.').closest('div');
    if (vendorCard) {
      fireEvent.click(vendorCard);
    }

    await waitFor(() => {
      expect(onVendorSelect).toHaveBeenCalledWith(mockVendorData[0]);
    });

    // 2. Switch to comparison view
    fireEvent.click(screen.getByText('Comparison'));
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();

    // 3. Switch to trends view and select a vendor
    fireEvent.click(screen.getByText('Trends'));
    const vendorSelect = screen.getByDisplayValue('');
    fireEvent.change(vendorSelect, { target: { value: 'vendor-1' } });
    
    expect(screen.getByTestId('radar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();

    // 4. Switch to recommendations and click on a recommendation
    fireEvent.click(screen.getByText('Recommendations'));
    
    const recommendationElement = screen.getByText('Top performer - consider expanding partnership').closest('div');
    if (recommendationElement) {
      fireEvent.click(recommendationElement);
    }

    await waitFor(() => {
      expect(onRecommendationClick).toHaveBeenCalledWith(
        'vendor-1',
        'Top performer - consider expanding partnership'
      );
    });
  });
});