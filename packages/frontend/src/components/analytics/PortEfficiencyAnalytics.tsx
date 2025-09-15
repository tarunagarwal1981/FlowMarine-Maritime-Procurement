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
  RadialLinearScale,
  ArcElement,
} from 'chart.js';
import { Bar, Line, Radar, Doughnut } from 'react-chartjs-2';
import { 
  PortEfficiencyDashboardData, 
  PortLogisticsData, 
  LogisticsOptimization,
  SeasonalDemandForecast,
  DashboardFilters 
} from '../../types/analytics';

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
  RadialLinearScale,
  ArcElement
);

interface PortEfficiencyAnalyticsProps {
  data: PortEfficiencyDashboardData;
  filters: DashboardFilters;
  onPortSelect: (portId: string) => void;
  onOptimizationSelect: (optimizationId: string) => void;
  loading?: boolean;
  className?: string;
}

export const PortEfficiencyAnalytics: React.FC<PortEfficiencyAnalyticsProps> = ({
  data,
  filters,
  onPortSelect,
  onOptimizationSelect,
  loading = false,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'rankings' | 'optimization' | 'seasonal'>('overview');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'efficiency' | 'volume' | 'onTime'>('efficiency');

  // Memoized chart data
  const portEfficiencyChartData = useMemo(() => {
    if (!data?.portRankings) return null;

    const topPorts = data.portRankings.slice(0, 10);
    return {
      labels: topPorts.map(port => port.portName),
      datasets: [
        {
          label: 'Efficiency Rating',
          data: topPorts.map(port => port.costEfficiency),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderColor: 'rgb(59, 130, 246)',
          borderWidth: 1,
        },
        {
          label: 'On-Time Rate (%)',
          data: topPorts.map(port => port.onTimeDeliveryRate),
          backgroundColor: 'rgba(16, 185, 129, 0.8)',
          borderColor: 'rgb(16, 185, 129)',
          borderWidth: 1,
        },
      ],
    };
  }, [data?.portRankings]);

  const deliveryTimeComparisonData = useMemo(() => {
    if (!data?.portRankings) return null;

    const topPorts = data.portRankings.slice(0, 8);
    return {
      labels: topPorts.map(port => port.portName),
      datasets: [
        {
          label: 'Average Delivery Time (hours)',
          data: topPorts.map(port => port.averageDeliveryTime),
          borderColor: 'rgb(245, 158, 11)',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Customs Clearance Time (hours)',
          data: topPorts.map(port => port.customsClearanceTime),
          borderColor: 'rgb(239, 68, 68)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
      ],
    };
  }, [data?.portRankings]);

  const seasonalForecastData = useMemo(() => {
    if (!data?.seasonalForecasts) return null;

    return {
      labels: data.seasonalForecasts.map(forecast => forecast.monthName),
      datasets: [
        {
          label: 'Demand Multiplier',
          data: data.seasonalForecasts.map(forecast => forecast.demandMultiplier),
          borderColor: 'rgb(139, 92, 246)',
          backgroundColor: 'rgba(139, 92, 246, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
        },
        {
          label: 'Predicted Volume',
          data: data.seasonalForecasts.map(forecast => forecast.predictedVolume),
          borderColor: 'rgb(6, 182, 212)',
          backgroundColor: 'rgba(6, 182, 212, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          yAxisID: 'y1',
        },
      ],
    };
  }, [data?.seasonalForecasts]);

  const regionalDistributionData = useMemo(() => {
    if (!data?.regionalAnalysis) return null;

    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];
    
    return {
      labels: data.regionalAnalysis.map(region => region.region),
      datasets: [
        {
          data: data.regionalAnalysis.map(region => region.totalVolume),
          backgroundColor: colors.slice(0, data.regionalAnalysis.length),
          borderWidth: 2,
          borderColor: '#ffffff',
        },
      ],
    };
  }, [data?.regionalAnalysis]);

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
            return `${context.dataset.label}: ${value.toLocaleString()}`;
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => `${value}`,
        },
      },
    },
    onClick: (event: any, elements: any) => {
      if (elements.length > 0) {
        const elementIndex = elements[0].index;
        const port = data.portRankings[elementIndex];
        if (port) {
          onPortSelect(port.portId);
        }
      }
    },
  };

  const seasonalChartOptions = {
    ...chartOptions,
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        beginAtZero: true,
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        beginAtZero: true,
        grid: {
          drawOnChartArea: false,
        },
      },
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
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${context.label}: ${value.toLocaleString()} (${percentage}%)`;
          },
        },
      },
    },
  };

  const filteredPorts = useMemo(() => {
    if (!data?.portRankings) return [];
    
    let filtered = [...data.portRankings];
    
    if (selectedRegion) {
      filtered = filtered.filter(port => 
        data.regionalAnalysis?.find(region => 
          region.region === selectedRegion
        )
      );
    }
    
    // Sort ports
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'efficiency':
          return b.costEfficiency - a.costEfficiency;
        case 'volume':
          return b.totalDeliveries - a.totalDeliveries;
        case 'onTime':
          return b.onTimeDeliveryRate - a.onTimeDeliveryRate;
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [data?.portRankings, data?.regionalAnalysis, selectedRegion, sortBy]);

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 sm:mb-0">
          Port Efficiency & Logistics Analytics
        </h2>
        
        {/* Tab Navigation */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['overview', 'rankings', 'optimization', 'seasonal'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {data?.overview?.totalPorts || 0}
              </div>
              <div className="text-sm text-blue-800">Total Ports</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {data?.overview?.averageEfficiency?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-sm text-green-800">Avg Efficiency</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {data?.overview?.totalDeliveries?.toLocaleString() || '0'}
              </div>
              <div className="text-sm text-yellow-800">Total Deliveries</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {data?.overview?.overallOnTimeRate?.toFixed(1) || '0.0'}%
              </div>
              <div className="text-sm text-purple-800">On-Time Rate</div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Port Efficiency Chart */}
            <div className="h-80">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Top Performing Ports</h3>
              {portEfficiencyChartData && (
                <Bar data={portEfficiencyChartData} options={chartOptions} />
              )}
            </div>

            {/* Regional Distribution */}
            <div className="h-80">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Volume by Region</h3>
              {regionalDistributionData && (
                <Doughnut data={regionalDistributionData} options={doughnutOptions} />
              )}
            </div>
          </div>

          {/* Delivery Time Comparison */}
          <div className="h-80">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Delivery Time Analysis</h3>
            {deliveryTimeComparisonData && (
              <Line data={deliveryTimeComparisonData} options={chartOptions} />
            )}
          </div>
        </div>
      )}

      {/* Rankings Tab */}
      {activeTab === 'rankings' && (
        <div className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filter by Region
              </label>
              <select
                value={selectedRegion || ''}
                onChange={(e) => setSelectedRegion(e.target.value || null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Regions</option>
                {data?.regionalAnalysis?.map((region) => (
                  <option key={region.region} value={region.region}>
                    {region.region}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sort by
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'efficiency' | 'volume' | 'onTime')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="efficiency">Efficiency Rating</option>
                <option value="volume">Total Volume</option>
                <option value="onTime">On-Time Rate</option>
              </select>
            </div>
          </div>

          {/* Port Rankings Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Port
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Efficiency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    On-Time Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Delivery Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Deliveries
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rating
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPorts.map((port, index) => (
                  <tr
                    key={port.portId}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onPortSelect(port.portId)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{port.portName}</div>
                        <div className="text-sm text-gray-500">{port.country}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {port.costEfficiency.toFixed(1)}%
                        </div>
                        <div className={`ml-2 w-16 h-2 rounded-full ${
                          port.costEfficiency >= 80 ? 'bg-green-200' : 
                          port.costEfficiency >= 60 ? 'bg-yellow-200' : 'bg-red-200'
                        }`}>
                          <div
                            className={`h-2 rounded-full ${
                              port.costEfficiency >= 80 ? 'bg-green-500' : 
                              port.costEfficiency >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${port.costEfficiency}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {port.onTimeDeliveryRate.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {port.averageDeliveryTime.toFixed(1)}h
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {port.totalDeliveries.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-4 h-4 ${
                              i < Math.floor(port.rating) ? 'text-yellow-400' : 'text-gray-300'
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                        <span className="ml-1 text-sm text-gray-500">
                          {port.rating.toFixed(1)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Optimization Tab */}
      {activeTab === 'optimization' && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900">Logistics Optimization Opportunities</h3>
          
          <div className="grid gap-4">
            {data?.logisticsOptimizations?.map((optimization) => (
              <div
                key={optimization.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onOptimizationSelect(optimization.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-medium text-gray-900">{optimization.title}</h4>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      optimization.implementationComplexity === 'low' 
                        ? 'bg-green-100 text-green-800'
                        : optimization.implementationComplexity === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {optimization.implementationComplexity} complexity
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      optimization.riskLevel === 'low' 
                        ? 'bg-green-100 text-green-800'
                        : optimization.riskLevel === 'medium'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {optimization.riskLevel} risk
                    </span>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-4">{optimization.description}</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Current Cost</div>
                    <div className="text-lg font-semibold text-gray-900">
                      ${optimization.currentCost.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Optimized Cost</div>
                    <div className="text-lg font-semibold text-green-600">
                      ${optimization.optimizedCost.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Potential Savings</div>
                    <div className="text-lg font-semibold text-green-600">
                      ${optimization.potentialSavings.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Savings %</div>
                    <div className="text-lg font-semibold text-green-600">
                      {optimization.savingsPercentage.toFixed(1)}%
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Affects {optimization.affectedVessels.length} vessels, {optimization.affectedRoutes.length} routes
                  </div>
                  <div className="text-sm text-gray-500">
                    Est. {optimization.estimatedTimeToImplement} days to implement
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seasonal Tab */}
      {activeTab === 'seasonal' && (
        <div className="space-y-6">
          <h3 className="text-lg font-medium text-gray-900">Seasonal Demand Forecasting</h3>
          
          {/* Seasonal Forecast Chart */}
          <div className="h-80">
            {seasonalForecastData && (
              <Line data={seasonalForecastData} options={seasonalChartOptions} />
            )}
          </div>
          
          {/* Seasonal Insights */}
          <div className="grid gap-4">
            {data?.seasonalForecasts?.map((forecast) => (
              <div key={forecast.month} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-medium text-gray-900">{forecast.monthName}</h4>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      forecast.confidence >= 80 
                        ? 'bg-green-100 text-green-800'
                        : forecast.confidence >= 60
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {forecast.confidence}% confidence
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-500">Demand Multiplier</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {forecast.demandMultiplier.toFixed(2)}x
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Predicted Volume</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {forecast.predictedVolume.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Key Factors</div>
                    <div className="text-sm text-gray-900">
                      {forecast.factors?.length || 0} identified
                    </div>
                  </div>
                </div>
                
                {forecast.recommendations && forecast.recommendations.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Recommendations:</div>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {forecast.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-blue-500 mr-2">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts Section */}
      {data?.alerts && data.alerts.length > 0 && (
        <div className="mt-6 border-t border-gray-200 pt-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Port Alerts</h3>
          <div className="space-y-3">
            {data.alerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === 'critical'
                    ? 'bg-red-50 border-red-400'
                    : alert.severity === 'warning'
                    ? 'bg-yellow-50 border-yellow-400'
                    : 'bg-blue-50 border-blue-400'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{alert.portName}</h4>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                    <p className="text-sm text-gray-500 mt-2">{alert.recommendedAction}</p>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-medium ${
                      alert.severity === 'critical' ? 'text-red-600' :
                      alert.severity === 'warning' ? 'text-yellow-600' : 'text-blue-600'
                    }`}>
                      {alert.severity.toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {alert.estimatedDuration}
                    </div>
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

export default PortEfficiencyAnalytics;