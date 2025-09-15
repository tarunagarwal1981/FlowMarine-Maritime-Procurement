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
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { BudgetData, BudgetAlert, BudgetHierarchy } from '../types/analytics';

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
  ArcElement
);

interface BudgetUtilizationDashboardProps {
  budgetPeriod: string;
  vessels: Array<{ id: string; name: string }>;
  realTimeUpdates: boolean;
  data: BudgetData;
  loading?: boolean;
  onAlertClick: (alert: BudgetAlert) => void;
  onHierarchyDrillDown: (level: BudgetHierarchy) => void;
  className?: string;
}

export const BudgetUtilizationDashboard: React.FC<BudgetUtilizationDashboardProps> = ({
  budgetPeriod,
  vessels,
  realTimeUpdates,
  data,
  loading = false,
  onAlertClick,
  onHierarchyDrillDown,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'overview' | 'hierarchy' | 'forecast'>('overview');
  const [selectedHierarchyLevel, setSelectedHierarchyLevel] = useState<string | null>(null);

  // Real-time update indicator
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isUpdating, setIsUpdating] = useState(false);

  // Simulate real-time updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    const interval = setInterval(() => {
      setIsUpdating(true);
      setTimeout(() => {
        setLastUpdate(new Date());
        setIsUpdating(false);
      }, 500);
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [realTimeUpdates]);

  // Budget utilization chart data
  const utilizationChartData = useMemo(() => {
    if (!data) return null;

    const utilizationPercentage = data.utilizationPercentage;
    const remainingPercentage = 100 - utilizationPercentage;

    return {
      labels: ['Utilized', 'Remaining'],
      datasets: [
        {
          data: [utilizationPercentage, remainingPercentage],
          backgroundColor: [
            utilizationPercentage > 90 ? '#EF4444' : utilizationPercentage > 75 ? '#F59E0B' : '#10B981',
            '#E5E7EB',
          ],
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    };
  }, [data]);

  // Budget variance trend data
  const varianceTrendData = useMemo(() => {
    if (!data) return null;

    // Mock historical variance data
    const periods = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const period = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      periods.push(period);
    }

    const varianceData = periods.map((_, index) => {
      const baseVariance = data.variance.percentage;
      return baseVariance + (Math.random() - 0.5) * 20; // Add some variation
    });

    return {
      labels: periods,
      datasets: [
        {
          label: 'Budget Variance (%)',
          data: varianceData,
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Target Variance',
          data: periods.map(() => 0),
          borderColor: 'rgb(34, 197, 94)',
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderDash: [5, 5],
        },
      ],
    };
  }, [data]);

  // Budget hierarchy chart data
  const hierarchyChartData = useMemo(() => {
    if (!data || !data.hierarchy) return null;

    const labels = data.hierarchy.map(h => h.name);
    const utilized = data.hierarchy.map(h => h.utilized);
    const remaining = data.hierarchy.map(h => h.remaining);

    return {
      labels,
      datasets: [
        {
          label: 'Utilized',
          data: utilized,
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
        },
        {
          label: 'Remaining',
          data: remaining,
          backgroundColor: 'rgba(156, 163, 175, 0.8)',
          borderColor: 'rgb(156, 163, 175)',
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
      if (elements.length > 0 && data.hierarchy) {
        const elementIndex = elements[0].index;
        const hierarchyItem = data.hierarchy[elementIndex];
        if (hierarchyItem) {
          setSelectedHierarchyLevel(hierarchyItem.id);
          onHierarchyDrillDown(hierarchyItem);
        }
      }
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const value = context.parsed;
            return `${context.label}: ${value.toFixed(1)}%`;
          },
        },
      },
    },
    cutout: '60%',
  };

  const getVarianceStatusColor = (status: string) => {
    switch (status) {
      case 'over':
        return 'text-red-600 bg-red-50';
      case 'under':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-blue-600 bg-blue-50';
    }
  };

  const getAlertTypeColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Budget Utilization Dashboard
          </h2>
          <p className="text-sm text-gray-600">
            Period: {budgetPeriod}
            {realTimeUpdates && (
              <span className="ml-4 flex items-center">
                <div className={`w-2 h-2 rounded-full mr-2 ${isUpdating ? 'bg-yellow-400' : 'bg-green-400'}`} />
                Last updated: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>

        {/* View Mode Selector */}
        <div className="flex bg-gray-100 rounded-lg p-1 mt-4 sm:mt-0">
          {(['overview', 'hierarchy', 'forecast'] as const).map((mode) => (
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

      {/* Key Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            ${data.totalBudget.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Total Budget</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            ${data.utilized.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Utilized</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            ${data.remaining.toLocaleString()}
          </div>
          <div className="text-sm text-gray-500">Remaining</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-900">
            {data.utilizationPercentage.toFixed(1)}%
          </div>
          <div className="text-sm text-gray-500">Utilization</div>
        </div>
      </div>

      {/* Budget Variance Alert */}
      <div className={`mb-6 p-4 rounded-lg ${getVarianceStatusColor(data.variance.status)}`}>
        <div className="flex items-center justify-between">
          <div>
            <span className="font-medium">Budget Variance: </span>
            <span className="font-semibold">
              {data.variance.status === 'over' ? '+' : ''}
              {data.variance.percentage.toFixed(1)}%
            </span>
            <span className="ml-2 text-sm">
              (${Math.abs(data.variance.amount).toLocaleString()})
            </span>
          </div>
          <div className="text-sm">
            Status: <span className="font-medium capitalize">{data.variance.status.replace('_', ' ')}</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      {viewMode === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Budget Utilization Doughnut */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Budget Utilization</h3>
            <div className="h-64 relative">
              {utilizationChartData && (
                <Doughnut data={utilizationChartData} options={doughnutOptions} />
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {data.utilizationPercentage.toFixed(1)}%
                  </div>
                  <div className="text-sm text-gray-500">Utilized</div>
                </div>
              </div>
            </div>
          </div>

          {/* Projected Spend */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Spend Forecast</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Current Spend</span>
                <span className="font-semibold">${data.utilized.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Projected Spend</span>
                <span className="font-semibold">${data.projectedSpend.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Projected Variance</span>
                <span className={`font-semibold ${
                  data.projectedSpend > data.totalBudget ? 'text-red-600' : 'text-green-600'
                }`}>
                  {data.projectedSpend > data.totalBudget ? '+' : ''}
                  ${Math.abs(data.projectedSpend - data.totalBudget).toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t border-gray-200">
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      (data.projectedSpend / data.totalBudget) * 100 > 100
                        ? 'bg-red-500'
                        : (data.projectedSpend / data.totalBudget) * 100 > 90
                        ? 'bg-yellow-500'
                        : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min((data.projectedSpend / data.totalBudget) * 100, 100)}%`,
                    }}
                  />
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Projected: {((data.projectedSpend / data.totalBudget) * 100).toFixed(1)}% of budget
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewMode === 'hierarchy' && hierarchyChartData && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Budget Hierarchy</h3>
          <div className="h-96">
            <Bar data={hierarchyChartData} options={chartOptions} />
          </div>
        </div>
      )}

      {viewMode === 'forecast' && varianceTrendData && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Variance Trend Analysis</h3>
          <div className="h-96">
            <Line data={varianceTrendData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Budget Alerts */}
      {data.alerts && data.alerts.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Budget Alerts</h3>
          <div className="space-y-3">
            {data.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${getAlertTypeColor(alert.type)}`}
                onClick={() => onAlertClick(alert)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{alert.message}</div>
                    <div className="text-sm mt-1">
                      Threshold: {alert.threshold}% | Current: {alert.currentValue}%
                      {alert.vesselId && (
                        <span className="ml-2">
                          Vessel: {vessels.find(v => v.id === alert.vesselId)?.name || alert.vesselId}
                        </span>
                      )}
                      {alert.category && (
                        <span className="ml-2">Category: {alert.category}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 ml-4">
                    {new Date(alert.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Budget Hierarchy Details */}
      {viewMode === 'hierarchy' && data.hierarchy && (
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Hierarchy Details</h3>
          <div className="space-y-3">
            {data.hierarchy.map((item) => (
              <div
                key={item.id}
                className={`p-4 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors ${
                  selectedHierarchyLevel === item.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => {
                  setSelectedHierarchyLevel(item.id);
                  onHierarchyDrillDown(item);
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{item.name}</div>
                    <div className="text-sm text-gray-500 capitalize">{item.level}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      ${item.utilized.toLocaleString()} / ${item.budget.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {item.utilizationPercentage.toFixed(1)}% utilized
                    </div>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        item.utilizationPercentage > 90
                          ? 'bg-red-500'
                          : item.utilizationPercentage > 75
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(item.utilizationPercentage, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BudgetUtilizationDashboard;