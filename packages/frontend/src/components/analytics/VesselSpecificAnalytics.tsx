import React, { useState, useEffect } from 'react';
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
  Filler
} from 'chart.js';
import { Bar, Line, Doughnut, Scatter } from 'react-chartjs-2';
import {
  VesselSpendingPattern,
  CategorySpend,
  VesselEfficiencyMetrics,
  RouteSpendCorrelation,
  VesselRecommendation,
  DashboardFilters
} from '../../types/analytics';
import { useVesselAnalyticsData } from '../../hooks/useVesselAnalyticsData';

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
  Filler
);

interface VesselSpecificAnalyticsProps {
  filters: DashboardFilters;
  selectedVessel?: string;
  onVesselSelect?: (vesselId: string) => void;
  onDrillDown?: (category: string, vesselId: string) => void;
}

export const VesselSpecificAnalytics: React.FC<VesselSpecificAnalyticsProps> = ({
  filters,
  selectedVessel,
  onVesselSelect,
  onDrillDown
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'spending' | 'efficiency' | 'routes' | 'comparison' | 'recommendations'>('overview');
  const [comparisonVessels, setComparisonVessels] = useState<string[]>([]);
  
  const { data: vesselData, loading, error, refetch } = useVesselAnalyticsData(filters, selectedVessel);

  useEffect(() => {
    refetch();
  }, [filters, selectedVessel, refetch]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !vesselData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-red-600">
          <p>Error loading vessel analytics data</p>
          <button 
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentVessel = Array.isArray(vesselData) 
    ? vesselData.find(v => v.vesselId === selectedVessel) || vesselData[0]
    : vesselData;

  if (!currentVessel) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-gray-600">
          <p>No vessel data available</p>
        </div>
      </div>
    );
  }

  const renderOverviewTab = () => {
    const efficiencyData = {
      labels: ['Spend/Mile', 'Spend/Day', 'Maintenance', 'Procurement', 'Overall'],
      datasets: [
        {
          label: 'Current Vessel',
          data: [
            currentVessel.efficiency.spendPerNauticalMile,
            currentVessel.efficiency.spendPerDay,
            currentVessel.efficiency.maintenanceEfficiency,
            currentVessel.efficiency.procurementEfficiency,
            currentVessel.efficiency.overallRating
          ],
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }
      ]
    };

    const spendTrendData = {
      labels: currentVessel.spendTrend.map(t => t.period),
      datasets: [
        {
          label: 'Total Spend',
          data: currentVessel.spendTrend.map(t => t.amount),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800">Total Spend</h3>
            <p className="text-2xl font-bold text-blue-600">
              ${currentVessel.totalSpend.toLocaleString()}
            </p>
            <p className="text-sm text-blue-600">Current period</p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800">Fleet Rank</h3>
            <p className="text-2xl font-bold text-green-600">#{currentVessel.efficiency.fleetRank}</p>
            <p className="text-sm text-green-600">Out of fleet</p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-800">Overall Rating</h3>
            <p className="text-2xl font-bold text-purple-600">
              {currentVessel.efficiency.overallRating.toFixed(1)}/100
            </p>
            <p className="text-sm text-purple-600">Efficiency score</p>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-orange-800">Vessel Type</h3>
            <p className="text-2xl font-bold text-orange-600">{currentVessel.vesselType}</p>
            <p className="text-sm text-orange-600">{currentVessel.vesselName}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Efficiency Metrics</h3>
            <div style={{ height: '300px' }}>
              <Bar data={efficiencyData} options={chartOptions} />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Spending Trend</h3>
            <div style={{ height: '300px' }}>
              <Line data={spendTrendData} options={chartOptions} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Key Performance Indicators</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Spend per Nautical Mile</p>
              <p className="text-xl font-bold text-gray-900">
                ${currentVessel.efficiency.spendPerNauticalMile.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Spend per Day</p>
              <p className="text-xl font-bold text-gray-900">
                ${currentVessel.efficiency.spendPerDay.toFixed(2)}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Maintenance Efficiency</p>
              <p className="text-xl font-bold text-gray-900">
                {currentVessel.efficiency.maintenanceEfficiency.toFixed(1)}%
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Procurement Efficiency</p>
              <p className="text-xl font-bold text-gray-900">
                {currentVessel.efficiency.procurementEfficiency.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSpendingTab = () => {
    const categoryData = {
      labels: currentVessel.spendPerCategory.map(c => c.category.replace('_', ' ').toUpperCase()),
      datasets: [
        {
          data: currentVessel.spendPerCategory.map(c => c.amount),
          backgroundColor: [
            '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', 
            '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
          ],
          borderWidth: 2,
          borderColor: '#ffffff'
        }
      ]
    };

    const categoryComparisonData = {
      labels: currentVessel.spendPerCategory.map(c => c.category.replace('_', ' ').toUpperCase()),
      datasets: [
        {
          label: 'Current Vessel',
          data: currentVessel.spendPerCategory.map(c => c.amount),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        },
        {
          label: 'Fleet Average',
          data: currentVessel.spendPerCategory.map(c => c.benchmark),
          backgroundColor: 'rgba(107, 114, 128, 0.6)',
          borderColor: 'rgba(107, 114, 128, 1)',
          borderWidth: 1
        }
      ]
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
              const category = currentVessel.spendPerCategory[context.dataIndex];
              return `${context.label}: $${category.amount.toLocaleString()} (${category.percentage.toFixed(1)}%)`;
            }
          }
        }
      },
      onClick: (event: any, elements: any) => {
        if (elements.length > 0) {
          const categoryIndex = elements[0].index;
          const category = currentVessel.spendPerCategory[categoryIndex];
          onDrillDown?.(category.category, currentVessel.vesselId);
        }
      }
    };

    const barOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Spending vs Fleet Average'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Amount ($)'
          }
        }
      }
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Spending by Category</h3>
            <div style={{ height: '300px' }}>
              <Doughnut data={categoryData} options={doughnutOptions} />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Category Comparison</h3>
            <div style={{ height: '300px' }}>
              <Bar data={categoryComparisonData} options={barOptions} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Category Details</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Percentage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    vs Fleet Avg
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentVessel.spendPerCategory.map((category, index) => (
                  <tr 
                    key={category.category} 
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onDrillDown?.(category.category, currentVessel.vesselId)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {category.category.replace('_', ' ').toUpperCase()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${category.amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {category.percentage.toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center ${
                        category.amount > category.benchmark ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {category.amount > category.benchmark ? '↑' : '↓'} 
                        {Math.abs(((category.amount - category.benchmark) / category.benchmark) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        category.trend === 'up' ? 'bg-red-100 text-red-800' :
                        category.trend === 'down' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {category.trend === 'up' ? '↗ Increasing' :
                         category.trend === 'down' ? '↘ Decreasing' : '→ Stable'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderEfficiencyTab = () => {
    const efficiencyMetrics = [
      { name: 'Spend per Nautical Mile', value: currentVessel.efficiency.spendPerNauticalMile, unit: '$', format: 'currency' },
      { name: 'Spend per Day', value: currentVessel.efficiency.spendPerDay, unit: '$', format: 'currency' },
      { name: 'Maintenance Efficiency', value: currentVessel.efficiency.maintenanceEfficiency, unit: '%', format: 'percentage' },
      { name: 'Procurement Efficiency', value: currentVessel.efficiency.procurementEfficiency, unit: '%', format: 'percentage' },
      { name: 'Overall Rating', value: currentVessel.efficiency.overallRating, unit: '/100', format: 'score' }
    ];

    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Efficiency Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {efficiencyMetrics.map((metric, index) => (
              <div key={metric.name} className="text-center p-6 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-600 mb-2">{metric.name}</h4>
                <p className="text-3xl font-bold text-gray-900 mb-2">
                  {metric.format === 'currency' ? `$${metric.value.toFixed(2)}` :
                   metric.format === 'percentage' ? `${metric.value.toFixed(1)}%` :
                   `${metric.value.toFixed(1)}${metric.unit}`}
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full ${
                      metric.value >= 80 ? 'bg-green-600' :
                      metric.value >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ 
                      width: metric.format === 'percentage' || metric.format === 'score' 
                        ? `${Math.min(metric.value, 100)}%` 
                        : '50%' 
                    }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Fleet Ranking</h3>
          <div className="text-center p-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-blue-100 rounded-full mb-4">
              <span className="text-3xl font-bold text-blue-600">#{currentVessel.efficiency.fleetRank}</span>
            </div>
            <p className="text-lg font-medium text-gray-900">Fleet Position</p>
            <p className="text-sm text-gray-600">
              {currentVessel.efficiency.fleetRank <= 3 ? 'Top performer' :
               currentVessel.efficiency.fleetRank <= 10 ? 'Above average' :
               'Needs improvement'}
            </p>
          </div>
        </div>
      </div>
    );
  };

  const renderRoutesTab = () => {
    const routeData = {
      datasets: [
        {
          label: 'Route Spend Correlation',
          data: currentVessel.routeCorrelation.map(route => ({
            x: route.spendPerMile,
            y: route.averageSpend,
            r: Math.sqrt(route.frequency) * 5 // Bubble size based on frequency
          })),
          backgroundColor: 'rgba(59, 130, 246, 0.6)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }
      ]
    };

    const scatterOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Route Spend Analysis (Bubble size = Frequency)'
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const route = currentVessel.routeCorrelation[context.dataIndex];
              return [
                `Route: ${route.route}`,
                `Avg Spend: $${route.averageSpend.toLocaleString()}`,
                `Spend/Mile: $${route.spendPerMile.toFixed(2)}`,
                `Frequency: ${route.frequency} trips`,
                `Correlation: ${route.correlation.toFixed(2)}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Spend per Mile ($)'
          }
        },
        y: {
          title: {
            display: true,
            text: 'Average Spend ($)'
          }
        }
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Route Spend Correlation</h3>
          <div style={{ height: '400px' }}>
            <Scatter data={routeData} options={scatterOptions} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Route Details</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Frequency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Spend
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Spend/Mile
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Correlation
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentVessel.routeCorrelation
                  .sort((a, b) => b.frequency - a.frequency)
                  .map((route, index) => (
                  <tr key={route.route} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {route.route}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {route.frequency} trips
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${route.averageSpend.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${route.spendPerMile.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        Math.abs(route.correlation) > 0.7 ? 'bg-red-100 text-red-800' :
                        Math.abs(route.correlation) > 0.4 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {route.correlation.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderComparisonTab = () => {
    if (!Array.isArray(vesselData) || vesselData.length < 2) {
      return (
        <div className="bg-white p-4 rounded-lg border">
          <div className="text-center text-gray-600">
            <p>Comparison requires multiple vessels in the dataset</p>
          </div>
        </div>
      );
    }

    const comparisonData = {
      labels: ['Total Spend', 'Efficiency Rating', 'Spend/Mile', 'Spend/Day'],
      datasets: vesselData.slice(0, 5).map((vessel, index) => ({
        label: vessel.vesselName,
        data: [
          vessel.totalSpend / 1000, // Convert to thousands for better visualization
          vessel.efficiency.overallRating,
          vessel.efficiency.spendPerNauticalMile,
          vessel.efficiency.spendPerDay / 100 // Convert to hundreds for better visualization
        ],
        backgroundColor: [
          'rgba(59, 130, 246, 0.6)',
          'rgba(16, 185, 129, 0.6)',
          'rgba(245, 158, 11, 0.6)',
          'rgba(239, 68, 68, 0.6)',
          'rgba(139, 92, 246, 0.6)'
        ][index],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(239, 68, 68, 1)',
          'rgba(139, 92, 246, 1)'
        ][index],
        borderWidth: 1
      }))
    };

    const comparisonOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Fleet Vessel Comparison'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Fleet Comparison</h3>
          <div style={{ height: '400px' }}>
            <Bar data={comparisonData} options={comparisonOptions} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Vessel Rankings</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vessel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Spend
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Efficiency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Fleet Rank
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {vesselData
                  .sort((a, b) => a.efficiency.fleetRank - b.efficiency.fleetRank)
                  .map((vessel) => (
                  <tr 
                    key={vessel.vesselId} 
                    className={`hover:bg-gray-50 cursor-pointer ${
                      vessel.vesselId === currentVessel.vesselId ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => onVesselSelect?.(vessel.vesselId)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{vessel.efficiency.fleetRank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {vessel.vesselName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {vessel.vesselType}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      ${vessel.totalSpend.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className={`h-2 rounded-full ${
                              vessel.efficiency.overallRating >= 80 ? 'bg-green-600' :
                              vessel.efficiency.overallRating >= 60 ? 'bg-yellow-600' : 'bg-red-600'
                            }`}
                            style={{ width: `${vessel.efficiency.overallRating}%` }}
                          ></div>
                        </div>
                        {vessel.efficiency.overallRating.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        vessel.efficiency.fleetRank <= 3 ? 'bg-green-100 text-green-800' :
                        vessel.efficiency.fleetRank <= 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {vessel.efficiency.fleetRank <= 3 ? 'Top' :
                         vessel.efficiency.fleetRank <= 10 ? 'Average' : 'Below Avg'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderRecommendationsTab = () => {
    const recommendationsByType = currentVessel.recommendations.reduce((acc, rec) => {
      if (!acc[rec.type]) {
        acc[rec.type] = [];
      }
      acc[rec.type].push(rec);
      return acc;
    }, {} as Record<string, VesselRecommendation[]>);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800">Total Potential Savings</h3>
            <p className="text-2xl font-bold text-green-600">
              ${currentVessel.recommendations.reduce((sum, r) => sum + r.estimatedSavings, 0).toLocaleString()}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800">High Priority Items</h3>
            <p className="text-2xl font-bold text-blue-600">
              {currentVessel.recommendations.filter(r => r.priority === 'high').length}
            </p>
          </div>
        </div>

        {Object.entries(recommendationsByType).map(([type, recommendations]) => (
          <div key={type} className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 capitalize">
              {type.replace('_', ' ')} Recommendations
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {recommendations.map((recommendation) => (
                <div 
                  key={recommendation.id} 
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-900">{recommendation.title}</h4>
                    <div className="flex space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        recommendation.priority === 'high' ? 'bg-red-100 text-red-800' :
                        recommendation.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {recommendation.priority} priority
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        recommendation.implementationEffort === 'high' ? 'bg-red-100 text-red-800' :
                        recommendation.implementationEffort === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {recommendation.implementationEffort} effort
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{recommendation.description}</p>
                  <div className="flex justify-between items-center text-sm">
                    <div className="text-green-600">
                      <span className="font-medium">Potential Savings:</span> ${recommendation.estimatedSavings.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Vessel-Specific Analytics</h2>
              <p className="text-sm text-gray-600 mt-1">
                Detailed analysis for {currentVessel.vesselName} ({currentVessel.vesselType})
              </p>
            </div>
            {Array.isArray(vesselData) && vesselData.length > 1 && (
              <select
                value={selectedVessel || currentVessel.vesselId}
                onChange={(e) => onVesselSelect?.(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {vesselData.map((vessel) => (
                  <option key={vessel.vesselId} value={vessel.vesselId}>
                    {vessel.vesselName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {[
            { id: 'overview', name: 'Overview' },
            { id: 'spending', name: 'Spending Patterns' },
            { id: 'efficiency', name: 'Efficiency' },
            { id: 'routes', name: 'Route Analysis' },
            { id: 'comparison', name: 'Fleet Comparison' },
            { id: 'recommendations', name: 'Recommendations' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'spending' && renderSpendingTab()}
        {activeTab === 'efficiency' && renderEfficiencyTab()}
        {activeTab === 'routes' && renderRoutesTab()}
        {activeTab === 'comparison' && renderComparisonTab()}
        {activeTab === 'recommendations' && renderRecommendationsTab()}
      </div>
    </div>
  );
};

export default VesselSpecificAnalytics;