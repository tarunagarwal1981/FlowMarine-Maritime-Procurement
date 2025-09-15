import React, { useState, useEffect, useMemo } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import 'chartjs-adapter-date-fns';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  TimeScale
);

interface SpendData {
  period: string;
  totalSpend: number;
  currency: string;
  breakdown: {
    category: string;
    amount: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  vesselBreakdown: {
    vesselId: string;
    vesselName: string;
    amount: number;
    percentage: number;
  }[];
  yearOverYear?: {
    currentPeriod: number;
    previousPeriod: number;
    change: number;
    changePercentage: number;
  };
}

interface FleetSpendVisualizationProps {
  timeRange: 'monthly' | 'quarterly' | 'yearly';
  vessels: Array<{ id: string; name: string }>;
  categories: string[];
  onTimeRangeChange: (range: 'monthly' | 'quarterly' | 'yearly') => void;
  onDrillDown: (level: 'fleet' | 'vessel' | 'category', id?: string) => void;
  data: SpendData[];
  loading?: boolean;
  className?: string;
}

export const FleetSpendVisualization: React.FC<FleetSpendVisualizationProps> = ({
  timeRange,
  vessels,
  categories,
  onTimeRangeChange,
  onDrillDown,
  data,
  loading = false,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'trend' | 'breakdown' | 'comparison'>('trend');
  const [selectedVessel, setSelectedVessel] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Memoized chart data for performance
  const trendChartData = useMemo(() => {
    if (!data || data.length === 0) return null;

    return {
      labels: data.map(d => d.period),
      datasets: [
        {
          label: 'Total Spend',
          data: data.map(d => d.totalSpend),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [data]);

  const categoryBreakdownData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const latestData = data[data.length - 1];
    const colors = [
      '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
      '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
    ];

    return {
      labels: latestData.breakdown.map(b => b.category),
      datasets: [
        {
          data: latestData.breakdown.map(b => b.amount),
          backgroundColor: colors.slice(0, latestData.breakdown.length),
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    };
  }, [data]);

  const vesselComparisonData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const latestData = data[data.length - 1];
    return {
      labels: latestData.vesselBreakdown.map(v => v.vesselName),
      datasets: [
        {
          label: 'Spend Amount',
          data: latestData.vesselBreakdown.map(v => v.amount),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
        },
      ],
    };
  }, [data]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed.y || context.parsed;
            return `${context.dataset.label}: $${value.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => `$${value.toLocaleString()}`,
        },
      },
    },
    onClick: (event: any, elements: any) => {
      if (elements.length > 0) {
        const elementIndex = elements[0].index;
        if (viewMode === 'breakdown') {
          const category = data[data.length - 1]?.breakdown[elementIndex]?.category;
          if (category) {
            setSelectedCategory(category);
            onDrillDown('category', category);
          }
        } else if (viewMode === 'comparison') {
          const vessel = data[data.length - 1]?.vesselBreakdown[elementIndex];
          if (vessel) {
            setSelectedVessel(vessel.vesselId);
            onDrillDown('vessel', vessel.vesselId);
          }
        }
      }
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed;
            const percentage = ((value / context.dataset.data.reduce((a: number, b: number) => a + b, 0)) * 100).toFixed(1);
            return `${context.label}: $${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
    onClick: (event: any, elements: any) => {
      if (elements.length > 0) {
        const elementIndex = elements[0].index;
        const category = data[data.length - 1]?.breakdown[elementIndex]?.category;
        if (category) {
          setSelectedCategory(category);
          onDrillDown('category', category);
        }
      }
    },
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">
          Fleet-Wide Spend Analysis
        </h2>
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Time Range Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['monthly', 'quarterly', 'yearly'] as const).map((range) => (
              <button
                key={range}
                onClick={() => onTimeRangeChange(range)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>

          {/* View Mode Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['trend', 'breakdown', 'comparison'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Year-over-Year Comparison */}
      {data && data.length > 0 && data[data.length - 1].yearOverYear && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-900">Year-over-Year Change</span>
            <div className="flex items-center">
              <span className={`text-lg font-semibold ${
                data[data.length - 1].yearOverYear!.changePercentage >= 0 
                  ? 'text-green-600' 
                  : 'text-red-600'
              }`}>
                {data[data.length - 1].yearOverYear!.changePercentage >= 0 ? '+' : ''}
                {data[data.length - 1].yearOverYear!.changePercentage.toFixed(1)}%
              </span>
              <span className="ml-2 text-sm text-gray-600">
                (${Math.abs(data[data.length - 1].yearOverYear!.change).toLocaleString()})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Chart Container */}
      <div className="h-96 mb-6">
        {viewMode === 'trend' && trendChartData && (
          <Line data={trendChartData} options={chartOptions} />
        )}
        
        {viewMode === 'breakdown' && categoryBreakdownData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            <div className="h-full">
              <Doughnut data={categoryBreakdownData} options={doughnutOptions} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Category Details</h3>
              {data[data.length - 1]?.breakdown.map((category, index) => (
                <div
                  key={category.category}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => {
                    setSelectedCategory(category.category);
                    onDrillDown('category', category.category);
                  }}
                >
                  <div className="flex items-center">
                    <div
                      className="w-4 h-4 rounded-full mr-3"
                      style={{
                        backgroundColor: categoryBreakdownData.datasets[0].backgroundColor[index],
                      }}
                    />
                    <span className="font-medium text-gray-900">{category.category}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      ${category.amount.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {category.percentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {viewMode === 'comparison' && vesselComparisonData && (
          <Bar data={vesselComparisonData} options={chartOptions} />
        )}
      </div>

      {/* Drill-down Breadcrumb */}
      {(selectedVessel || selectedCategory) && (
        <div className="flex items-center text-sm text-gray-600 mb-4">
          <button
            onClick={() => {
              setSelectedVessel(null);
              setSelectedCategory(null);
              onDrillDown('fleet');
            }}
            className="text-blue-600 hover:text-blue-800"
          >
            Fleet
          </button>
          {selectedVessel && (
            <>
              <span className="mx-2">/</span>
              <span className="font-medium">
                {vessels.find(v => v.id === selectedVessel)?.name || selectedVessel}
              </span>
            </>
          )}
          {selectedCategory && (
            <>
              <span className="mx-2">/</span>
              <span className="font-medium">{selectedCategory}</span>
            </>
          )}
        </div>
      )}

      {/* Summary Stats */}
      {data && data.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              ${data[data.length - 1].totalSpend.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Total Spend</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data[data.length - 1].breakdown.length}
            </div>
            <div className="text-sm text-gray-500">Categories</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data[data.length - 1].vesselBreakdown.length}
            </div>
            <div className="text-sm text-gray-500">Vessels</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {data.length}
            </div>
            <div className="text-sm text-gray-500">Periods</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FleetSpendVisualization;