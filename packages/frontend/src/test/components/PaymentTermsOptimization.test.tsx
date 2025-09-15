import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PaymentTermsOptimization from '../../components/analytics/PaymentTermsOptimization';
import { PaymentTermsOptimizationData } from '../../types/analytics';

// Mock Chart.js
jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options }: any) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Line Chart
    </div>
  ),
  Bar: ({ data, options }: any) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Bar Chart
    </div>
  ),
  Doughnut: ({ data, options }: any) => (
    <div data-testid="doughnut-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Doughnut Chart
    </div>
  )
}));

const mockData: PaymentTermsOptimizationData = {
  currentTermsAnalysis: {
    averagePaymentTerms: 38,
    weightedAverageTerms: 35,
    termDistribution: [
      { terms: 'NET30', vendorCount: 15, totalValue: 500000, percentage: 45.5 },
      { terms: 'NET45', vendorCount: 8, totalValue: 300000, percentage: 27.3 },
      { terms: 'NET60', vendorCount: 5, totalValue: 200000, percentage: 18.2 }
    ],
    benchmarkComparison: {
      industryAverage: 35,
      variance: 3,
      ranking: 'below_average'
    }
  },
  earlyPaymentDiscounts: {
    captured: 25000,
    missed: 15000,
    potentialSavings: 12000,
    discountOpportunities: [
      {
        vendorId: 'vendor1',
        vendorName: 'Maritime Supplies Co.',
        discountRate: 2.0,
        discountDays: 10,
        standardTerms: 30,
        potentialSavings: 8000,
        riskAssessment: 'low'
      }
    ],
    monthlyTrends: [
      { month: '2024-01', captured: 5000, missed: 3000, captureRate: 62.5 },
      { month: '2024-02', captured: 7000, missed: 2500, captureRate: 73.7 }
    ]
  },
  vendorPaymentPerformance: [
    {
      vendorId: 'vendor1',
      vendorName: 'Maritime Supplies Co.',
      averagePaymentTime: 28,
      onTimePaymentRate: 92,
      earlyPaymentRate: 15,
      latePaymentRate: 8,
      paymentTerms: 'NET30',
      creditRating: 'A+',
      relationshipScore: 88
    },
    {
      vendorId: 'vendor2',
      vendorName: 'Engine Parts Ltd.',
      averagePaymentTime: 42,
      onTimePaymentRate: 78,
      earlyPaymentRate: 8,
      latePaymentRate: 22,
      paymentTerms: 'NET45',
      creditRating: 'A',
      relationshipScore: 72
    }
  ],
  cashFlowOptimization: {
    currentCashCycle: 45,
    optimizedCashCycle: 35,
    potentialImprovement: 10,
    recommendations: [
      {
        id: 'cf1',
        type: 'extend_terms',
        title: 'Negotiate Extended Payment Terms',
        description: 'Extend payment terms with key suppliers',
        impact: 25000,
        implementationEffort: 'medium',
        riskLevel: 'low'
      }
    ],
    monthlyProjections: [
      { month: '2024-01', inflows: 800000, outflows: 750000, netFlow: 50000, cumulativeFlow: 50000 },
      { month: '2024-02', inflows: 850000, outflows: 780000, netFlow: 70000, cumulativeFlow: 120000 }
    ]
  },
  paymentTimingOptimization: [
    {
      vendorId: 'vendor1',
      vendorName: 'Maritime Supplies Co.',
      currentTiming: 'Pay on due date',
      recommendedTiming: 'Pay 5 days early for 2% discount',
      potentialSavings: 8000,
      riskImpact: 'positive',
      implementationComplexity: 'low'
    }
  ]
};

describe('PaymentTermsOptimization', () => {
  const defaultProps = {
    data: mockData,
    loading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    expect(screen.getByText('Payment Terms Optimization')).toBeInTheDocument();
  });

  it('displays loading state correctly', () => {
    render(<PaymentTermsOptimization {...defaultProps} loading={true} />);
    expect(screen.getByText('Payment Terms Optimization')).toBeInTheDocument();
    // Should show loading skeleton
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('displays key metrics in header', () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    expect(screen.getByText(/Average Terms: 38 days/)).toBeInTheDocument();
    expect(screen.getByText(/Potential Savings: \$12,000/)).toBeInTheDocument();
  });

  it('renders all tab navigation options', () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Payment Terms')).toBeInTheDocument();
    expect(screen.getByText('Early Discounts')).toBeInTheDocument();
    expect(screen.getByText('Vendor Performance')).toBeInTheDocument();
    expect(screen.getByText('Cash Flow')).toBeInTheDocument();
  });

  it('displays overview tab content by default', () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    // Check key metrics
    expect(screen.getByText('Average Payment Terms')).toBeInTheDocument();
    expect(screen.getByText('38 days')).toBeInTheDocument();
    expect(screen.getByText('Discount Savings')).toBeInTheDocument();
    expect(screen.getByText('$25,000')).toBeInTheDocument();
    expect(screen.getByText('Missed Opportunities')).toBeInTheDocument();
    expect(screen.getByText('$15,000')).toBeInTheDocument();
    expect(screen.getByText('Cash Cycle')).toBeInTheDocument();
    expect(screen.getByText('45 days')).toBeInTheDocument();
    
    // Check benchmark comparison
    expect(screen.getByText('Industry Benchmark')).toBeInTheDocument();
    expect(screen.getByText('BELOW AVERAGE')).toBeInTheDocument();
    
    // Check recommendations
    expect(screen.getByText('Top Recommendations')).toBeInTheDocument();
    expect(screen.getByText('Negotiate Extended Payment Terms')).toBeInTheDocument();
  });

  it('switches to payment terms tab when clicked', async () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Payment Terms'));
    
    await waitFor(() => {
      expect(screen.getByText('Payment Terms Distribution')).toBeInTheDocument();
      expect(screen.getByText('Terms Analysis')).toBeInTheDocument();
      expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
    });
  });

  it('displays payment terms distribution table', async () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Payment Terms'));
    
    await waitFor(() => {
      // Check table headers
      expect(screen.getByText('Payment Terms')).toBeInTheDocument();
      expect(screen.getByText('Vendor Count')).toBeInTheDocument();
      expect(screen.getByText('Total Value')).toBeInTheDocument();
      expect(screen.getByText('Percentage')).toBeInTheDocument();
      
      // Check data
      expect(screen.getByText('NET30')).toBeInTheDocument();
      expect(screen.getByText('NET45')).toBeInTheDocument();
      expect(screen.getByText('NET60')).toBeInTheDocument();
      expect(screen.getByText('15')).toBeInTheDocument(); // Vendor count for NET30
      expect(screen.getByText('$500,000')).toBeInTheDocument(); // Total value for NET30
      expect(screen.getByText('45.5%')).toBeInTheDocument(); // Percentage for NET30
    });
  });

  it('displays early discounts tab correctly', async () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Early Discounts'));
    
    await waitFor(() => {
      expect(screen.getByText('Captured Discounts')).toBeInTheDocument();
      expect(screen.getByText('Missed Discounts')).toBeInTheDocument();
      expect(screen.getByText('Potential Savings')).toBeInTheDocument();
      expect(screen.getByText('Monthly Discount Trends')).toBeInTheDocument();
      expect(screen.getByText('Discount Opportunities')).toBeInTheDocument();
      
      // Check chart presence
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      
      // Check discount opportunity details
      expect(screen.getByText('Maritime Supplies Co.')).toBeInTheDocument();
      expect(screen.getByText('2.0%')).toBeInTheDocument(); // Discount rate
      expect(screen.getByText('10 days')).toBeInTheDocument(); // Discount days
      expect(screen.getByText('LOW RISK')).toBeInTheDocument();
    });
  });

  it('displays vendor performance tab with filtering', async () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Vendor Performance'));
    
    await waitFor(() => {
      expect(screen.getByText('Filter by Vendor:')).toBeInTheDocument();
      
      // Check table headers
      expect(screen.getByText('Vendor')).toBeInTheDocument();
      expect(screen.getByText('Avg Payment Time')).toBeInTheDocument();
      expect(screen.getByText('On-Time Rate')).toBeInTheDocument();
      expect(screen.getByText('Early Rate')).toBeInTheDocument();
      expect(screen.getByText('Late Rate')).toBeInTheDocument();
      expect(screen.getByText('Credit Rating')).toBeInTheDocument();
      expect(screen.getByText('Relationship Score')).toBeInTheDocument();
      
      // Check vendor data
      expect(screen.getByText('Maritime Supplies Co.')).toBeInTheDocument();
      expect(screen.getByText('Engine Parts Ltd.')).toBeInTheDocument();
      expect(screen.getByText('28 days')).toBeInTheDocument(); // Average payment time
      expect(screen.getByText('92.0%')).toBeInTheDocument(); // On-time rate
    });
  });

  it('filters vendors when selection changes', async () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Vendor Performance'));
    
    await waitFor(() => {
      const select = screen.getByDisplayValue('All Vendors');
      fireEvent.change(select, { target: { value: 'vendor1' } });
    });
    
    await waitFor(() => {
      // Should only show Maritime Supplies Co.
      expect(screen.getByText('Maritime Supplies Co.')).toBeInTheDocument();
      // Engine Parts Ltd. should not be visible in filtered view
      expect(screen.queryByText('Engine Parts Ltd.')).not.toBeInTheDocument();
    });
  });

  it('displays cash flow tab correctly', async () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Cash Flow'));
    
    await waitFor(() => {
      expect(screen.getByText('Current Cash Cycle')).toBeInTheDocument();
      expect(screen.getByText('Optimized Cash Cycle')).toBeInTheDocument();
      expect(screen.getByText('Potential Improvement')).toBeInTheDocument();
      expect(screen.getByText('Cash Flow Projections')).toBeInTheDocument();
      expect(screen.getByText('Cash Flow Optimization Recommendations')).toBeInTheDocument();
      expect(screen.getByText('Payment Timing Optimization')).toBeInTheDocument();
      
      // Check metrics
      expect(screen.getByText('45 days')).toBeInTheDocument(); // Current cycle
      expect(screen.getByText('35 days')).toBeInTheDocument(); // Optimized cycle
      expect(screen.getByText('10 days')).toBeInTheDocument(); // Improvement
      
      // Check chart presence
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  it('displays payment timing optimization table', async () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Cash Flow'));
    
    await waitFor(() => {
      // Check payment timing table headers
      expect(screen.getByText('Current Timing')).toBeInTheDocument();
      expect(screen.getByText('Recommended Timing')).toBeInTheDocument();
      expect(screen.getByText('Risk Impact')).toBeInTheDocument();
      expect(screen.getByText('Complexity')).toBeInTheDocument();
      
      // Check data
      expect(screen.getByText('Pay on due date')).toBeInTheDocument();
      expect(screen.getByText('Pay 5 days early for 2% discount')).toBeInTheDocument();
      expect(screen.getByText('$8,000')).toBeInTheDocument();
      expect(screen.getByText('POSITIVE')).toBeInTheDocument();
      expect(screen.getByText('LOW')).toBeInTheDocument();
    });
  });

  it('calls onRefresh when refresh button is clicked', () => {
    const mockRefresh = jest.fn();
    render(<PaymentTermsOptimization {...defaultProps} onRefresh={mockRefresh} />);
    
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);
    
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('applies correct color coding for performance metrics', async () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Vendor Performance'));
    
    await waitFor(() => {
      // High on-time rate (92%) should be green
      const highOnTimeRate = screen.getByText('92.0%');
      expect(highOnTimeRate.closest('span')).toHaveClass('bg-green-100', 'text-green-800');
      
      // Lower on-time rate (78%) should be yellow
      const lowOnTimeRate = screen.getByText('78.0%');
      expect(lowOnTimeRate.closest('span')).toHaveClass('bg-yellow-100', 'text-yellow-800');
    });
  });

  it('displays risk level badges with correct colors', async () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Early Discounts'));
    
    await waitFor(() => {
      const lowRiskBadge = screen.getByText('LOW RISK');
      expect(lowRiskBadge).toHaveClass('text-green-600', 'bg-green-100');
    });
  });

  it('formats currency amounts correctly', () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    // Check formatted amounts in overview
    expect(screen.getByText(/\$25,000/)).toBeInTheDocument();
    expect(screen.getByText(/\$15,000/)).toBeInTheDocument();
    expect(screen.getByText(/\$12,000/)).toBeInTheDocument();
  });

  it('displays benchmark comparison with correct styling', () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    // Check benchmark comparison
    expect(screen.getByText('Industry Benchmark')).toBeInTheDocument();
    expect(screen.getByText('+3 days')).toBeInTheDocument(); // Positive variance
    
    const belowAverageBadge = screen.getByText('BELOW AVERAGE');
    expect(belowAverageBadge).toHaveClass('text-red-600', 'bg-red-100');
  });

  it('displays relationship scores with progress bars', async () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Vendor Performance'));
    
    await waitFor(() => {
      // Check for progress bar elements
      const progressBars = document.querySelectorAll('.bg-blue-600');
      expect(progressBars.length).toBeGreaterThan(0);
      
      // Check relationship scores
      expect(screen.getByText('88')).toBeInTheDocument();
      expect(screen.getByText('72')).toBeInTheDocument();
    });
  });

  it('displays effort and risk level badges correctly', async () => {
    render(<PaymentTermsOptimization {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Cash Flow'));
    
    await waitFor(() => {
      const mediumEffortBadge = screen.getByText('MEDIUM');
      expect(mediumEffortBadge).toHaveClass('text-yellow-600', 'bg-yellow-100');
      
      const lowRiskBadge = screen.getByText('LOW');
      expect(lowRiskBadge).toHaveClass('text-green-600', 'bg-green-100');
    });
  });
});