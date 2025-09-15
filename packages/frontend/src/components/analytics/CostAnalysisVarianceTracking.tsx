import React, { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { 
  CostAnalysisVarianceData,
  BudgetVarianceAnalysis,
  CostPerVesselMileData,
  CategoryCostAnalysis,
  VarianceExplanation,
  CostOptimizationRecommendation
} from '../../types/analytics';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface CostAnalysisVarianceTrackingProps {
  data: CostAnalysisVarianceData;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

const CostAnalysisVarianceTracking: React.FC<CostAnalysisVarianceTrackingProps> = ({
  data,
  loading = false,
  onRefresh,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'budget' | 'vessel' | 'category' | 'recommendations'>('overview');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedVessel, setSelectedVessel] = useState<string | null>(null);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const formatCostPerMile = (cost: number): string => {
    return `$${cost.toFixed(2)}/mile`;
  };

  const getVarianceColor = (variance: number): string => {
    if (variance > 0) return 'text-red-600 bg-red-100';
    if (variance < 0) return 'text-green-600 bg-green-100';
    return 'text-gray-600 bg-gray-100';
  };

  const getVarianceStatus = (status: 'favorable' | 'unfavorable' | 'on_target'): string => {
    switch (status) {
      case 'favorable': return 'text-green-600 bg-green-100';
      case 'unfavorable': return 'text-red-600 bg-red-100';
      case 'on_target': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getTrendColor = (trend: 'increasing' | 'decreasing' | 'stable'): string => {
    switch (trend) {
      case 'increasing': return 'text-red-600';
      case 'decreasing': return 'text-green-600';
      case 'stable': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: 'increasing' | 'decreasing' | 'stable'): string => {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low'): string => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRankingColor = (ranking: 'top_quartile' | 'above_average' | 'below_average' | 'bottom_quartile'): string => {
    switch (ranking) {
      case 'top_quartile': return 'text-green-600 bg-green-100';
      case 'above_average': return 'text-blue-600 bg-blue-100';
      case 'below_average': return 'text-yellow-600 bg-yellow-100';
      case 'bottom_quartile': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Budget variance chart data
  const budgetVarianceData = {
    labels: data.budgetVsActualAnalysis.varianceByPeriod.map(p => p.period),
    datasets: [
      {
        label: 'Budget',
        data: data.budgetVsActualAnalysis.varianceByPeriod.map(p => p.budget),
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        borderWidth: 2
      },
      {
        label: 'Actual',
        data: data.budgetVsActualAnalysis.varianceByPeriod.map(p => p.actual),
        backgroundColor: '#ef4444',
        borderColor: '#dc2626',
        borderWidth: 2
      }
    ]
  };

  // Cost per vessel mile trends
  const costPerMileTrendData = {
    labels: data.costPerVesselMile.trends.map(t => t.period),
    datasets: [
      {
        label: 'Cost per Mile',
        data: data.costPerVesselMile.trends.map(t => t.costPerMile),
        borderColor: '#10b981',
        backgroundColor: '#10b98120',
        tension: 0.1,
        fill: true
      },
      {
        label: 'Efficiency',
        data: data.costPerVesselMile.trends.map(t => t.efficiency),
        borderColor: '#8b5cf6',
        backgroundColor: '#8b5cf620',
        tension: 0.1,
        fill: false,
        yAxisID: 'y1'
      }
    ]
  };

  // Category variance chart
  const categoryVarianceData = {
    labels: data.categoryAnalysis.map(c => c.category),
    datasets: [
      {
        label: 'Budget',
        data: data.categoryAnalysis.map(c => c.budgetedAmount),
        backgroundColor: '#3b82f6',
        borderColor: '#2563eb',
        borderWidth: 2
      },
      {
        label: 'Actual',
        data: data.categoryAnalysis.map(c => c.actualAmount),
        backgroundColor: '#ef4444',
        borderColor: '#dc2626',
        borderWidth: 2
      }
    ]
  };

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
            return `${context.dataset.label}: ${formatCurrency(value)}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCurrency(value)
        }
      }
    }
  };

  const costPerMileOptions = {
    ...chartOptions,
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatCostPerMile(value)
        }
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        beginAtZero: true,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          callback: (value: any) => `${value}%`
        }
      }
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            <div className="h-4 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Cost Analysis & Variance Tracking</h3>
            <p className="text-sm text-gray-600">
              Budget Variance: {formatPercentage(data.budgetVsActualAnalysis.variancePercentage)} | 
              Cost per Mile: {formatCostPerMile(data.costPerVesselMile.overallCostPerMile)}
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 py-2 border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'budget', label: 'Budget Variance' },
            { key: 'vessel', label: 'Vessel Efficiency' },
            { key: 'category', label: 'Category Analysis' },
            { key: 'recommendations', label: 'Recommendations' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-600">Total Budget</div>
                <div className="text-2xl font-bold text-blue-900">
                  {formatCurrency(data.budgetVsActualAnalysis.totalBudget)}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm font-medium text-red-600">Total Actual</div>
                <div className="text-2xl font-bold text-red-900">
                  {formatCurrency(data.budgetVsActualAnalysis.totalActual)}
                </div>
              </div>
              <div className={`rounded-lg p-4 ${
                data.budgetVsActualAnalysis.totalVariance >= 0 ? 'bg-red-50' : 'bg-green-50'
              }`}>
                <div className={`text-sm font-medium ${
                  data.budgetVsActualAnalysis.totalVariance >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  Total Variance
                </div>
                <div className={`text-2xl font-bold ${
                  data.budgetVsActualAnalysis.totalVariance >= 0 ? 'text-red-900' : 'text-green-900'
                }`}>
                  {formatCurrency(data.budgetVsActualAnalysis.totalVariance)}
                </div>
                <div className={`text-sm ${
                  data.budgetVsActualAnalysis.totalVariance >= 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {formatPercentage(data.budgetVsActualAnalysis.variancePercentage)}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm font-medium text-purple-600">Cost per Mile</div>
                <div className="text-2xl font-bold text-purple-900">
                  {formatCostPerMile(data.costPerVesselMile.overallCostPerMile)}
                </div>
              </div>
            </div>

            {/* Variance Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm font-medium text-green-600">Favorable Variance</div>
                <div className="text-2xl font-bold text-green-900">
                  {formatCurrency(data.budgetVsActualAnalysis.favorableVariance)}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm font-medium text-red-600">Unfavorable Variance</div>
                <div className="text-2xl font-bold text-red-900">
                  {formatCurrency(data.budgetVsActualAnalysis.unfavorableVariance)}
                </div>
              </div>
            </div>

            {/* Top Variance Explanations */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-yellow-900 mb-3">Key Variance Explanations</h4>
              <div className="space-y-2">
                {data.varianceExplanation.slice(0, 3).map((explanation, index) => (
                  <div key={index} className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-yellow-900">{explanation.category}</div>
                      <div className="text-xs text-yellow-700">{explanation.explanation}</div>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`text-sm font-semibold ${
                        explanation.variance >= 0 ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(explanation.variance)}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${
                        explanation.impact === 'high' ? 'bg-red-100 text-red-800' :
                        explanation.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {explanation.impact.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Optimization Opportunities */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-blue-900 mb-3">Top Optimization Opportunities</h4>
              <div className="space-y-2">
                {data.costOptimizationRecommendations.slice(0, 3).map((rec, index) => (
                  <div key={rec.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-blue-900">{rec.title}</div>
                      <div className="text-xs text-blue-700">{rec.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-600">
                        {formatCurrency(rec.potentialSavings)}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${getPriorityColor(rec.priority)}`}>
                        {rec.priority.toUpperCase()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'budget' && (
          <div className="space-y-6">
            {/* Budget vs Actual Chart */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Budget vs Actual by Period</h4>
              <div className="h-64">
                <Bar data={budgetVarianceData} options={chartOptions} />
              </div>
            </div>

            {/* Period Variance Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Budget
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actual
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Variance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Variance %
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.budgetVsActualAnalysis.varianceByPeriod.map((period, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(period.period + '-01').toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long' 
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(period.budget)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(period.actual)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          period.variance >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(period.variance)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          period.variancePercentage >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatPercentage(period.variancePercentage)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          getVarianceStatus(period.status)
                        }`}>
                          {period.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'vessel' && (
          <div className="space-y-6">
            {/* Vessel Selection */}
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter by Vessel:</label>
              <select
                value={selectedVessel || ''}
                onChange={(e) => setSelectedVessel(e.target.value || null)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Vessels</option>
                {data.costPerVesselMile.vesselComparison.map(vessel => (
                  <option key={vessel.vesselId} value={vessel.vesselId}>
                    {vessel.vesselName}
                  </option>
                ))}
              </select>
            </div>

            {/* Cost per Mile Trends */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Cost per Mile Trends</h4>
              <div className="h-64">
                <Line data={costPerMileTrendData} options={costPerMileOptions} />
              </div>
            </div>

            {/* Vessel Comparison Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vessel
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Cost per Mile
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Miles
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Cost
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Efficiency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Improvement
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.costPerVesselMile.vesselComparison
                    .filter(vessel => !selectedVessel || vessel.vesselId === selectedVessel)
                    .map((vessel) => (
                    <tr key={vessel.vesselId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {vessel.vesselName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCostPerMile(vessel.costPerMile)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {vessel.totalMiles.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(vessel.totalCost)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className={`h-2 rounded-full ${
                                vessel.efficiency >= 90 ? 'bg-green-600' :
                                vessel.efficiency >= 75 ? 'bg-yellow-600' : 'bg-red-600'
                              }`}
                              style={{ width: `${vessel.efficiency}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600">
                            {vessel.efficiency.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          vessel.rank <= 2 ? 'bg-green-100 text-green-800' :
                          vessel.rank <= 4 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          #{vessel.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          vessel.improvement >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {vessel.improvement >= 0 ? '+' : ''}{formatPercentage(vessel.improvement)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Benchmarks */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Industry Benchmarks</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {data.costPerVesselMile.benchmarks.map((benchmark, index) => (
                  <div key={index} className="bg-white rounded-lg p-4 border">
                    <div className="text-sm font-medium text-gray-600">{benchmark.vesselType}</div>
                    <div className="mt-2 space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Top Quartile</span>
                        <span className="font-medium">{formatCostPerMile(benchmark.topQuartile)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Industry Avg</span>
                        <span className="font-medium">{formatCostPerMile(benchmark.industryAverage)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Our Performance</span>
                        <span className="font-medium">{formatCostPerMile(benchmark.ourPerformance)}</span>
                      </div>
                      <div className="mt-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          getRankingColor(benchmark.ranking)
                        }`}>
                          {benchmark.ranking.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'category' && (
          <div className="space-y-6">
            {/* Category Selection */}
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter by Category:</label>
              <select
                value={selectedCategory || ''}
                onChange={(e) => setSelectedCategory(e.target.value || null)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                {data.categoryAnalysis.map(category => (
                  <option key={category.category} value={category.category}>
                    {category.category}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Variance Chart */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Category Budget vs Actual</h4>
              <div className="h-64">
                <Bar data={categoryVarianceData} options={chartOptions} />
              </div>
            </div>

            {/* Category Analysis Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Budget
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actual
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Variance
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Variance %
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trend
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.categoryAnalysis
                    .filter(category => !selectedCategory || category.category === selectedCategory)
                    .map((category, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {category.category}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(category.budgetedAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(category.actualAmount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          category.variance >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(category.variance)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          category.variancePercentage >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatPercentage(category.variancePercentage)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`flex items-center ${getTrendColor(category.trend)}`}>
                          {getTrendIcon(category.trend)}
                          <span className="ml-1 capitalize">{category.trend}</span>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Detailed Category Analysis */}
            {selectedCategory && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-md font-semibold text-gray-900 mb-4">
                  {selectedCategory} - Detailed Analysis
                </h4>
                {(() => {
                  const categoryData = data.categoryAnalysis.find(c => c.category === selectedCategory);
                  if (!categoryData) return null;
                  
                  return (
                    <div className="space-y-4">
                      {/* Cost Drivers */}
                      <div>
                        <h5 className="text-sm font-semibold text-gray-800 mb-2">Cost Drivers</h5>
                        <div className="space-y-2">
                          {categoryData.drivers.map((driver, index) => (
                            <div key={index} className="flex items-center justify-between bg-white rounded p-3">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">{driver.driver}</div>
                                <div className="text-xs text-gray-600">{driver.description}</div>
                              </div>
                              <div className="text-right">
                                <div className={`text-xs px-2 py-1 rounded ${
                                  driver.impact === 'high' ? 'bg-red-100 text-red-800' :
                                  driver.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-green-100 text-green-800'
                                }`}>
                                  {driver.impact.toUpperCase()}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  Correlation: {(driver.correlation * 100).toFixed(0)}%
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Seasonality */}
                      <div>
                        <h5 className="text-sm font-semibold text-gray-800 mb-2">Seasonal Patterns</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {categoryData.seasonality.slice(0, 12).map((season, index) => (
                            <div key={index} className="bg-white rounded p-2 text-center">
                              <div className="text-xs font-medium text-gray-900">{season.monthName.slice(0, 3)}</div>
                              <div className={`text-xs font-semibold ${
                                season.seasonalIndex > 1.1 ? 'text-red-600' :
                                season.seasonalIndex < 0.9 ? 'text-green-600' : 'text-gray-600'
                              }`}>
                                {(season.seasonalIndex * 100).toFixed(0)}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            {/* Variance Explanations */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4">Variance Explanations</h4>
              <div className="space-y-4">
                {data.varianceExplanation.map((explanation, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="text-lg font-semibold text-gray-900">{explanation.category}</h5>
                        <p className="text-gray-600 mt-1">{explanation.explanation}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                          <div>
                            <div className="text-sm font-medium text-gray-500">Root Cause</div>
                            <div className="text-sm text-gray-900">{explanation.rootCause}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Recommended Action</div>
                            <div className="text-sm text-gray-900">{explanation.recommendedAction}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Timeline</div>
                            <div className="text-sm text-gray-900">{explanation.timeline}</div>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <div className={`text-lg font-semibold ${
                          explanation.variance >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {formatCurrency(explanation.variance)}
                        </div>
                        <div className={`text-xs px-2 py-1 rounded mt-1 ${
                          explanation.impact === 'high' ? 'bg-red-100 text-red-800' :
                          explanation.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {explanation.impact.toUpperCase()} IMPACT
                        </div>
                        <div className={`text-xs px-2 py-1 rounded mt-1 ${
                          explanation.controllable ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {explanation.controllable ? 'CONTROLLABLE' : 'EXTERNAL'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cost Optimization Recommendations */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4">Cost Optimization Recommendations</h4>
              <div className="space-y-4">
                {data.costOptimizationRecommendations.map((recommendation) => (
                  <div key={recommendation.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h5 className="text-lg font-semibold text-gray-900">{recommendation.title}</h5>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            getPriorityColor(recommendation.priority)
                          }`}>
                            {recommendation.priority.toUpperCase()} PRIORITY
                          </span>
                        </div>
                        <p className="text-gray-600 mb-3">{recommendation.description}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <div className="text-sm font-medium text-gray-500">Category</div>
                            <div className="text-sm text-gray-900">{recommendation.category}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Type</div>
                            <div className="text-sm text-gray-900 capitalize">
                              {recommendation.type.replace('_', ' ')}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Implementation Time</div>
                            <div className="text-sm text-gray-900">{recommendation.timeToImplement}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">ROI</div>
                            <div className="text-sm font-semibold text-green-600">
                              {recommendation.roi.toFixed(1)}x
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-lg font-semibold text-green-600">
                          {formatCurrency(recommendation.potentialSavings)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatPercentage(recommendation.savingsPercentage)} savings
                        </div>
                        <div className="mt-2 space-y-1">
                          <div className={`text-xs px-2 py-1 rounded ${
                            recommendation.implementationEffort === 'low' ? 'bg-green-100 text-green-800' :
                            recommendation.implementationEffort === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {recommendation.implementationEffort.toUpperCase()} EFFORT
                          </div>
                          <div className={`text-xs px-2 py-1 rounded ${
                            recommendation.riskLevel === 'low' ? 'bg-green-100 text-green-800' :
                            recommendation.riskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {recommendation.riskLevel.toUpperCase()} RISK
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CostAnalysisVarianceTracking;