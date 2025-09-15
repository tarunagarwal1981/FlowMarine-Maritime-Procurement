import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PortEfficiencyAnalytics } from '../../components/analytics/PortEfficiencyAnalytics';
import { PortEfficiencyDashboardData, DashboardFilters } from '../../types/analytics';

// Mock Chart.js
vi.mock('react-chartjs-2', () => ({
  Bar: vi.fn(({ data, options, ...props }) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)} {...props} />
  )),
  Line: vi.fn(({ data, options, ...props }) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} {...props} />
  )),
  Radar: vi.fn(({ data, options, ...props }) => (
    <div data-testid="radar-chart" data-chart-data={JSON.stringify(data)} {...props} />
  )),
  Doughnut: vi.fn(({ data, options, ...props }) => (
    <div data-testid="doughnut-chart" data-chart-data={JSON.stringify(data)} {...props} />
  )),
}));

// Mock Chart.js registration
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn(),
  },
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
  BarElement: vi.fn(),
  LineElement: vi.fn(),
  PointElement: vi.fn(),
  Title: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
  RadialLinearScale: vi.fn(),
  ArcElement: vi.fn(),
}));

describe('PortEfficiencyAnalytics', () => {
  const mockFilters: DashboardFilters = {
    timeRange: 'monthly',
    dateFrom: new Date('2024-01-01'),
    dateTo: new Date('2024-12-31'),
    vessels: ['vessel-1', 'vessel-2'],
    categories: ['ENGINE', 'DECK'],
    vendors: ['vendor-1', 'vendor-2'],
    currency: 'USD',
  };

  const mockData: PortEfficiencyDashboardData = {
    overview: {
      totalPorts: 25,
      averageEfficiency: 82.5,
      topPerformingPort: 'Singapore',
      mostImprovedPort: 'Rotterdam',
      totalDeliveries: 1250,
      overallOnTimeRate: 87.3,
    },
    portRankings: [
      {
        portId: 'SGSIN',
        portName: 'Singapore',
        country: 'Singapore',
        region: 'Asia Pacific',
        totalDeliveries: 150,
        onTimeDeliveryRate: 95.2,
        averageDeliveryTime: 18.5,
        costEfficiency: 92.1,
        customsClearanceTime: 4.2,
        rating: 4.8,
        trends: [
          {
            period: 'Jan',
            deliveries: 25,
            onTimeRate: 94.0,
            averageTime: 19.2,
            cost: 12500,
          },
        ],
        seasonalPatterns: [
          {
            month: 1,
            monthName: 'January',
            demandMultiplier: 1.2,
            averageDeliveryTime: 20.1,
            costMultiplier: 1.1,
          },
        ],
        recommendations: [
          {
            id: 'rec-1',
            type: 'logistics',
            title: 'Optimize delivery timing',
            description: 'Schedule deliveries during off-peak hours',
            impact: 'medium',
            estimatedSavings: 5000,
          },
        ],
        logistics: {
          averageDockingTime: 3.2,
          cargoHandlingEfficiency: 88,
          portCongestionLevel: 'low',
          availableBerths: 12,
          averageWaitTime: 1.5,
          fuelAvailability: true,
          sparePartsAvailability: true,
          customsComplexity: 'simple',
        },
        comparison: {
          rank: 1,
          totalPorts: 25,
          benchmarkMetrics: {
            deliveryTime: 24,
            costEfficiency: 75,
            onTimeRate: 85,
          },
          competitorAnalysis: {
            betterPorts: 0,
            worsePorts: 24,
            similarPorts: 2,
          },
        },
      },
      {
        portId: 'NLRTM',
        portName: 'Rotterdam',
        country: 'Netherlands',
        region: 'Europe',
        totalDeliveries: 120,
        onTimeDeliveryRate: 89.5,
        averageDeliveryTime: 22.1,
        costEfficiency: 85.3,
        customsClearanceTime: 6.8,
        rating: 4.5,
        trends: [
          {
            period: 'Jan',
            deliveries: 20,
            onTimeRate: 88.0,
            averageTime: 23.5,
            cost: 15000,
          },
        ],
        seasonalPatterns: [
          {
            month: 1,
            monthName: 'January',
            demandMultiplier: 1.1,
            averageDeliveryTime: 24.2,
            costMultiplier: 1.2,
          },
        ],
        recommendations: [
          {
            id: 'rec-2',
            type: 'cost',
            title: 'Negotiate better rates',
            description: 'Leverage volume for better pricing',
            impact: 'high',
            estimatedSavings: 12000,
          },
        ],
        logistics: {
          averageDockingTime: 4.1,
          cargoHandlingEfficiency: 82,
          portCongestionLevel: 'medium',
          availableBerths: 8,
          averageWaitTime: 2.8,
          fuelAvailability: true,
          sparePartsAvailability: false,
          customsComplexity: 'moderate',
        },
        comparison: {
          rank: 2,
          totalPorts: 25,
          benchmarkMetrics: {
            deliveryTime: 24,
            costEfficiency: 75,
            onTimeRate: 85,
          },
          competitorAnalysis: {
            betterPorts: 1,
            worsePorts: 23,
            similarPorts: 3,
          },
        },
      },
    ],
    logisticsOptimizations: [
      {
        id: 'opt-1',
        type: 'route',
        title: 'Optimize Singapore-Rotterdam Route',
        description: 'Consolidate shipments through Singapore hub to reduce costs by 15%',
        currentCost: 125000,
        optimizedCost: 106250,
        potentialSavings: 18750,
        savingsPercentage: 15,
        implementationComplexity: 'medium',
        riskLevel: 'low',
        estimatedTimeToImplement: 30,
        affectedVessels: ['vessel-1', 'vessel-2'],
        affectedRoutes: ['SG-RTM'],
      },
    ],
    seasonalForecasts: [
      {
        month: 1,
        monthName: 'January',
        demandMultiplier: 1.2,
        predictedVolume: 450,
        confidence: 85,
        factors: [
          {
            factor: 'Weather Patterns',
            impact: 'high',
            description: 'Winter weather affects shipping routes',
            historicalCorrelation: 0.8,
          },
        ],
        recommendations: ['Plan for increased maintenance demand', 'Stock up on critical spare parts'],
      },
    ],
    regionalAnalysis: [
      {
        region: 'Asia Pacific',
        portCount: 12,
        averageEfficiency: 88.2,
        totalVolume: 6500,
        costIndex: 0.9,
        strengths: ['High efficiency', 'Advanced technology'],
        challenges: ['Congestion', 'Weather disruptions'],
        opportunities: ['Digital transformation', 'Green shipping'],
      },
    ],
    alerts: [
      {
        id: 'alert-1',
        portId: 'SGSIN',
        portName: 'Singapore',
        type: 'congestion',
        severity: 'warning',
        message: 'Port congestion expected due to increased traffic',
        impact: 'Delivery delays of 2-4 hours expected',
        recommendedAction: 'Consider alternative delivery times',
        estimatedDuration: '3-5 days',
        createdAt: new Date('2024-01-15'),
      },
    ],
  };

  const mockOnPortSelect = vi.fn();
  const mockOnOptimizationSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders port efficiency analytics component', () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    expect(screen.getByText('Port Efficiency & Logistics Analytics')).toBeInTheDocument();
  });

  it('displays overview metrics correctly', () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    expect(screen.getByText('25')).toBeInTheDocument(); // Total Ports
    expect(screen.getByText('82.5%')).toBeInTheDocument(); // Avg Efficiency
    expect(screen.getByText('1,250')).toBeInTheDocument(); // Total Deliveries
    expect(screen.getByText('87.3%')).toBeInTheDocument(); // On-Time Rate
  });

  it('switches between tabs correctly', async () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    // Initially on overview tab
    expect(screen.getByText('Top Performing Ports')).toBeInTheDocument();

    // Switch to rankings tab
    fireEvent.click(screen.getByText('Rankings'));
    await waitFor(() => {
      expect(screen.getByText('Filter by Region')).toBeInTheDocument();
    });

    // Switch to optimization tab
    fireEvent.click(screen.getByText('Optimization'));
    await waitFor(() => {
      expect(screen.getByText('Logistics Optimization Opportunities')).toBeInTheDocument();
    });

    // Switch to seasonal tab
    fireEvent.click(screen.getByText('Seasonal'));
    await waitFor(() => {
      expect(screen.getByText('Seasonal Demand Forecasting')).toBeInTheDocument();
    });
  });

  it('displays port rankings table correctly', async () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    // Switch to rankings tab
    fireEvent.click(screen.getByText('Rankings'));

    await waitFor(() => {
      expect(screen.getByText('Singapore')).toBeInTheDocument();
      expect(screen.getByText('Rotterdam')).toBeInTheDocument();
      expect(screen.getByText('95.2%')).toBeInTheDocument(); // Singapore on-time rate
      expect(screen.getByText('89.5%')).toBeInTheDocument(); // Rotterdam on-time rate
    });
  });

  it('handles port selection correctly', async () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    // Switch to rankings tab
    fireEvent.click(screen.getByText('Rankings'));

    await waitFor(() => {
      const singaporeRow = screen.getByText('Singapore').closest('tr');
      expect(singaporeRow).toBeInTheDocument();
      
      if (singaporeRow) {
        fireEvent.click(singaporeRow);
        expect(mockOnPortSelect).toHaveBeenCalledWith('SGSIN');
      }
    });
  });

  it('displays logistics optimization opportunities', async () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    // Switch to optimization tab
    fireEvent.click(screen.getByText('Optimization'));

    await waitFor(() => {
      expect(screen.getByText('Optimize Singapore-Rotterdam Route')).toBeInTheDocument();
      expect(screen.getByText('$125,000')).toBeInTheDocument(); // Current cost
      expect(screen.getByText('$106,250')).toBeInTheDocument(); // Optimized cost
      expect(screen.getByText('$18,750')).toBeInTheDocument(); // Potential savings
      expect(screen.getByText('15.0%')).toBeInTheDocument(); // Savings percentage
    });
  });

  it('handles optimization selection correctly', async () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    // Switch to optimization tab
    fireEvent.click(screen.getByText('Optimization'));

    await waitFor(() => {
      const optimizationCard = screen.getByText('Optimize Singapore-Rotterdam Route').closest('div');
      expect(optimizationCard).toBeInTheDocument();
      
      if (optimizationCard) {
        fireEvent.click(optimizationCard);
        expect(mockOnOptimizationSelect).toHaveBeenCalledWith('opt-1');
      }
    });
  });

  it('displays seasonal forecasts correctly', async () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    // Switch to seasonal tab
    fireEvent.click(screen.getByText('Seasonal'));

    await waitFor(() => {
      expect(screen.getByText('January')).toBeInTheDocument();
      expect(screen.getByText('1.20x')).toBeInTheDocument(); // Demand multiplier
      expect(screen.getByText('450')).toBeInTheDocument(); // Predicted volume
      expect(screen.getByText('85% confidence')).toBeInTheDocument();
    });
  });

  it('filters ports by region correctly', async () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    // Switch to rankings tab
    fireEvent.click(screen.getByText('Rankings'));

    await waitFor(() => {
      const regionSelect = screen.getByDisplayValue('All Regions');
      fireEvent.change(regionSelect, { target: { value: 'Asia Pacific' } });
      
      // Should still show Singapore but not Rotterdam
      expect(screen.getByText('Singapore')).toBeInTheDocument();
    });
  });

  it('sorts ports correctly', async () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    // Switch to rankings tab
    fireEvent.click(screen.getByText('Rankings'));

    await waitFor(() => {
      const sortSelect = screen.getByDisplayValue('Efficiency Rating');
      fireEvent.change(sortSelect, { target: { value: 'volume' } });
      
      // Ports should be sorted by volume (Singapore has more deliveries)
      const rows = screen.getAllByRole('row');
      expect(rows.length).toBeGreaterThan(1);
    });
  });

  it('displays port alerts correctly', () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    expect(screen.getByText('Port Alerts')).toBeInTheDocument();
    expect(screen.getByText('Singapore')).toBeInTheDocument();
    expect(screen.getByText('Port congestion expected due to increased traffic')).toBeInTheDocument();
    expect(screen.getByText('WARNING')).toBeInTheDocument();
  });

  it('shows loading state correctly', () => {
    const { container } = render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
        loading={true}
      />
    );

    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders charts correctly', () => {
    render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    // Check that charts are rendered
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
    expect(screen.getByTestId('doughnut-chart')).toBeInTheDocument();
    expect(screen.getByTestId('line-chart')).toBeInTheDocument();
  });

  it('handles empty data gracefully', () => {
    const emptyData: PortEfficiencyDashboardData = {
      overview: {
        totalPorts: 0,
        averageEfficiency: 0,
        topPerformingPort: 'N/A',
        mostImprovedPort: 'N/A',
        totalDeliveries: 0,
        overallOnTimeRate: 0,
      },
      portRankings: [],
      logisticsOptimizations: [],
      seasonalForecasts: [],
      regionalAnalysis: [],
      alerts: [],
    };

    render(
      <PortEfficiencyAnalytics
        data={emptyData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
      />
    );

    expect(screen.getByText('0')).toBeInTheDocument(); // Total ports
    expect(screen.getByText('0.0%')).toBeInTheDocument(); // Average efficiency
  });

  it('applies custom className correctly', () => {
    const { container } = render(
      <PortEfficiencyAnalytics
        data={mockData}
        filters={mockFilters}
        onPortSelect={mockOnPortSelect}
        onOptimizationSelect={mockOnOptimizationSelect}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});