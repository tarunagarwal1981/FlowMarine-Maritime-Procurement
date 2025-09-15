import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MultiCurrencyConsolidation from '../../components/analytics/MultiCurrencyConsolidation';
import { MultiCurrencyConsolidationData } from '../../types/analytics';

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

const mockData: MultiCurrencyConsolidationData = {
  totalSpendBaseCurrency: 1000000,
  baseCurrency: 'USD',
  currencyBreakdown: [
    {
      currency: 'USD',
      amount: 500000,
      amountInBaseCurrency: 500000,
      exchangeRate: 1.0,
      percentage: 50.0,
      trend: 'stable',
      volatility: 0.05
    },
    {
      currency: 'EUR',
      amount: 300000,
      amountInBaseCurrency: 324000,
      exchangeRate: 1.08,
      percentage: 32.4,
      trend: 'strengthening',
      volatility: 0.12
    },
    {
      currency: 'GBP',
      amount: 150000,
      amountInBaseCurrency: 189000,
      exchangeRate: 1.26,
      percentage: 18.9,
      trend: 'weakening',
      volatility: 0.18
    }
  ],
  exchangeRateImpact: {
    gainLoss: 15000,
    percentage: 1.5,
    trend: 'favorable',
    impactByMonth: [
      {
        month: '2024-01',
        gainLoss: 5000,
        exchangeRate: 1.08,
        volume: 100000
      },
      {
        month: '2024-02',
        gainLoss: 10000,
        exchangeRate: 1.09,
        volume: 120000
      }
    ]
  },
  historicalRates: [
    {
      currency: 'EUR',
      date: new Date('2024-01-15'),
      rate: 1.08,
      change: 0.01,
      changePercentage: 0.93
    },
    {
      currency: 'GBP',
      date: new Date('2024-01-15'),
      rate: 1.26,
      change: -0.02,
      changePercentage: -1.56
    }
  ],
  hedgingRecommendations: [
    {
      id: 'hedge-gbp-1',
      currency: 'GBP',
      recommendationType: 'option',
      title: 'Hedge GBP Exposure',
      description: 'Consider hedging GBP exposure due to high volatility',
      riskLevel: 'high',
      potentialSavings: 17000,
      timeHorizon: '3-6 months',
      implementation: 'Work with treasury team to establish option contracts'
    }
  ]
};

describe('MultiCurrencyConsolidation', () => {
  const defaultProps = {
    data: mockData,
    loading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    expect(screen.getByText('Multi-Currency Consolidation')).toBeInTheDocument();
  });

  it('displays loading state correctly', () => {
    render(<MultiCurrencyConsolidation {...defaultProps} loading={true} />);
    expect(screen.getByText('Multi-Currency Consolidation')).toBeInTheDocument();
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('displays total spend in base currency', () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    expect(screen.getByText(/Total Spend: \$1,000,000 \(USD\)/)).toBeInTheDocument();
  });

  it('renders all tab navigation options', () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Currency Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Exchange Rate Impact')).toBeInTheDocument();
    expect(screen.getByText('Hedging Recommendations')).toBeInTheDocument();
  });

  it('displays overview tab content by default', () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    // Check key metrics
    expect(screen.getByText('Total Currencies')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument(); // 3 currencies
    expect(screen.getByText('Exchange Rate Impact')).toBeInTheDocument();
    expect(screen.getByText('$15,000')).toBeInTheDocument(); // Impact amount
    expect(screen.getByText('Hedging Opportunities')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 recommendation
    
    // Check chart presence
    expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
  });

  it('switches to currency breakdown tab when clicked', async () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Currency Breakdown'));
    
    await waitFor(() => {
      expect(screen.getByText('Filter by Currency:')).toBeInTheDocument();
      expect(screen.getByText('Original Amount')).toBeInTheDocument();
      expect(screen.getByText('Exchange Rate')).toBeInTheDocument();
      expect(screen.getByText('Historical Exchange Rates')).toBeInTheDocument();
    });
  });

  it('displays currency breakdown table correctly', async () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Currency Breakdown'));
    
    await waitFor(() => {
      // Check table headers
      expect(screen.getByText('Currency')).toBeInTheDocument();
      expect(screen.getByText('Original Amount')).toBeInTheDocument();
      expect(screen.getByText('Exchange Rate')).toBeInTheDocument();
      expect(screen.getByText('USD Amount')).toBeInTheDocument();
      expect(screen.getByText('Percentage')).toBeInTheDocument();
      expect(screen.getByText('Trend')).toBeInTheDocument();
      expect(screen.getByText('Volatility')).toBeInTheDocument();
      
      // Check currency data
      expect(screen.getByText('USD')).toBeInTheDocument();
      expect(screen.getByText('EUR')).toBeInTheDocument();
      expect(screen.getByText('GBP')).toBeInTheDocument();
      
      // Check exchange rates
      expect(screen.getByText('1.0800')).toBeInTheDocument(); // EUR rate
      expect(screen.getByText('1.2600')).toBeInTheDocument(); // GBP rate
      
      // Check percentages
      expect(screen.getByText('50.0%')).toBeInTheDocument(); // USD percentage
      expect(screen.getByText('32.4%')).toBeInTheDocument(); // EUR percentage
      expect(screen.getByText('18.9%')).toBeInTheDocument(); // GBP percentage
    });
  });

  it('filters currencies when selection changes', async () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Currency Breakdown'));
    
    await waitFor(() => {
      const select = screen.getByDisplayValue('All Currencies');
      fireEvent.change(select, { target: { value: 'EUR' } });
    });
    
    await waitFor(() => {
      // Should only show EUR row
      expect(screen.getByText('EUR')).toBeInTheDocument();
      // USD and GBP should not be visible in filtered view
      const usdRows = screen.queryAllByText('USD');
      const gbpRows = screen.queryAllByText('GBP');
      // Only header references should remain
      expect(usdRows.length).toBeLessThanOrEqual(1);
      expect(gbpRows.length).toBeLessThanOrEqual(1);
    });
  });

  it('displays exchange rate impact tab correctly', async () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Exchange Rate Impact'));
    
    await waitFor(() => {
      expect(screen.getByText('Total Impact')).toBeInTheDocument();
      expect(screen.getByText('Impact Percentage')).toBeInTheDocument();
      expect(screen.getByText('Trend')).toBeInTheDocument();
      expect(screen.getByText('Monthly Exchange Rate Impact')).toBeInTheDocument();
      
      // Check impact values
      expect(screen.getByText('$15,000')).toBeInTheDocument();
      expect(screen.getByText('1.5%')).toBeInTheDocument();
      expect(screen.getByText('Favorable')).toBeInTheDocument();
      
      // Check chart presence
      expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    });
  });

  it('displays monthly impact table', async () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Exchange Rate Impact'));
    
    await waitFor(() => {
      expect(screen.getByText('Month')).toBeInTheDocument();
      expect(screen.getByText('Gain/Loss')).toBeInTheDocument();
      expect(screen.getByText('Average Rate')).toBeInTheDocument();
      expect(screen.getByText('Volume')).toBeInTheDocument();
      
      // Check monthly data
      expect(screen.getByText('January 2024')).toBeInTheDocument();
      expect(screen.getByText('February 2024')).toBeInTheDocument();
      expect(screen.getByText('$5,000')).toBeInTheDocument();
      expect(screen.getByText('$10,000')).toBeInTheDocument();
    });
  });

  it('displays hedging recommendations tab correctly', async () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Hedging Recommendations'));
    
    await waitFor(() => {
      expect(screen.getByText('Hedge GBP Exposure')).toBeInTheDocument();
      expect(screen.getByText('Consider hedging GBP exposure due to high volatility')).toBeInTheDocument();
      expect(screen.getByText('HIGH RISK')).toBeInTheDocument();
      expect(screen.getByText('GBP')).toBeInTheDocument();
      expect(screen.getByText('Option')).toBeInTheDocument();
      expect(screen.getByText('$17,000')).toBeInTheDocument();
      expect(screen.getByText('3-6 months')).toBeInTheDocument();
    });
  });

  it('displays empty state when no hedging recommendations', async () => {
    const dataWithoutRecommendations = {
      ...mockData,
      hedgingRecommendations: []
    };
    
    render(<MultiCurrencyConsolidation data={dataWithoutRecommendations} loading={false} />);
    
    fireEvent.click(screen.getByText('Hedging Recommendations'));
    
    await waitFor(() => {
      expect(screen.getByText('No hedging recommendations at this time')).toBeInTheDocument();
      expect(screen.getByText('Recommendations appear when currency exposure exceeds risk thresholds')).toBeInTheDocument();
    });
  });

  it('calls onRefresh when refresh button is clicked', () => {
    const mockRefresh = jest.fn();
    render(<MultiCurrencyConsolidation {...defaultProps} onRefresh={mockRefresh} />);
    
    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);
    
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('applies correct risk level styling', async () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Hedging Recommendations'));
    
    await waitFor(() => {
      const highRiskBadge = screen.getByText('HIGH RISK');
      expect(highRiskBadge).toHaveClass('text-red-600', 'bg-red-100');
    });
  });

  it('displays trend icons correctly', async () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Currency Breakdown'));
    
    await waitFor(() => {
      // Check for trend indicators (emojis or text)
      expect(screen.getByText('Stable')).toBeInTheDocument();
      expect(screen.getByText('Strengthening')).toBeInTheDocument();
      expect(screen.getByText('Weakening')).toBeInTheDocument();
    });
  });

  it('formats currency amounts correctly', () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    // Check formatted amounts in overview
    expect(screen.getByText(/\$1,000,000/)).toBeInTheDocument();
    expect(screen.getByText(/\$15,000/)).toBeInTheDocument();
  });

  it('displays volatility with appropriate color coding', async () => {
    render(<MultiCurrencyConsolidation {...defaultProps} />);
    
    fireEvent.click(screen.getByText('Currency Breakdown'));
    
    await waitFor(() => {
      // High volatility (GBP: 18%) should be red
      const highVolatility = screen.getByText('18.0%');
      expect(highVolatility.closest('span')).toHaveClass('bg-red-100', 'text-red-800');
      
      // Medium volatility (EUR: 12%) should be yellow
      const mediumVolatility = screen.getByText('12.0%');
      expect(mediumVolatility.closest('span')).toHaveClass('bg-yellow-100', 'text-yellow-800');
      
      // Low volatility (USD: 5%) should be green
      const lowVolatility = screen.getByText('5.0%');
      expect(lowVolatility.closest('span')).toHaveClass('bg-green-100', 'text-green-800');
    });
  });
});