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
  PaymentTermsOptimizationData,
  PaymentTermsAnalysis,
  EarlyPaymentDiscountData,
  VendorPaymentPerformance,
  CashFlowOptimization,
  PaymentTimingOptimization
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

interface PaymentTermsOptimizationProps {
  data: PaymentTermsOptimizationData;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

const PaymentTermsOptimization: React.FC<PaymentTermsOptimizationProps> = ({
  data,
  loading = false,
  onRefresh,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'terms' | 'discounts' | 'performance' | 'cashflow'>('overview');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);

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

  const formatDays = (days: number): string => {
    return `${days} days`;
  };

  const getRankingColor = (ranking: 'above_average' | 'average' | 'below_average'): string => {
    switch (ranking) {
      case 'above_average': return 'text-green-600 bg-green-100';
      case 'average': return 'text-yellow-600 bg-yellow-100';
      case 'below_average': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getEffortColor = (effort: 'low' | 'medium' | 'high'): string => {
    switch (effort) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskColor = (risk: 'low' | 'medium' | 'high'): string => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Payment terms distribution chart
  const termsDistributionData = {
    labels: data.currentTermsAnalysis.termDistribution.map(t => t.terms),
    datasets: [
      {
        data: data.currentTermsAnalysis.termDistribution.map(t => t.totalValue),
        backgroundColor: [
          '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'
        ],
        borderColor: [
          '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', '#0891b2'
        ],
        borderWidth: 2
      }
    ]
  };

  // Early payment discount trends chart
  const discountTrendsData = {
    labels: data.earlyPaymentDiscounts.monthlyTrends.map(t => t.month),
    datasets: [
      {
        label: 'Captured Discounts',
        data: data.earlyPaymentDiscounts.monthlyTrends.map(t => t.captured),
        backgroundColor: '#10b981',
        borderColor: '#059669',
        borderWidth: 2
      },
      {
        label: 'Missed Discounts',
        data: data.earlyPaymentDiscounts.monthlyTrends.map(t => t.missed),
        backgroundColor: '#ef4444',
        borderColor: '#dc2626',
        borderWidth: 2
      }
    ]
  };

  // Cash flow projection chart
  const cashFlowData = {
    labels: data.cashFlowOptimization.monthlyProjections.map(p => p.month),
    datasets: [
      {
        label: 'Net Cash Flow',
        data: data.cashFlowOptimization.monthlyProjections.map(p => p.netFlow),
        borderColor: '#3b82f6',
        backgroundColor: '#3b82f620',
        tension: 0.1,
        fill: true
      },
      {
        label: 'Cumulative Flow',
        data: data.cashFlowOptimization.monthlyProjections.map(p => p.cumulativeFlow),
        borderColor: '#10b981',
        backgroundColor: '#10b98120',
        tension: 0.1,
        fill: false
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
            const term = data.currentTermsAnalysis.termDistribution[context.dataIndex];
            return `${term.terms}: ${formatCurrency(term.totalValue)} (${formatPercentage(term.percentage)})`;
          }
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
            <h3 className="text-lg font-semibold text-gray-900">Payment Terms Optimization</h3>
            <p className="text-sm text-gray-600">
              Average Terms: {formatDays(data.currentTermsAnalysis.averagePaymentTerms)} | 
              Potential Savings: {formatCurrency(data.earlyPaymentDiscounts.potentialSavings)}
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
            { key: 'terms', label: 'Payment Terms' },
            { key: 'discounts', label: 'Early Discounts' },
            { key: 'performance', label: 'Vendor Performance' },
            { key: 'cashflow', label: 'Cash Flow' }
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
                <div className="text-sm font-medium text-blue-600">Average Payment Terms</div>
                <div className="text-2xl font-bold text-blue-900">
                  {formatDays(data.currentTermsAnalysis.averagePaymentTerms)}
                </div>
                <div className="text-sm text-blue-600">
                  Weighted: {formatDays(data.currentTermsAnalysis.weightedAverageTerms)}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm font-medium text-green-600">Discount Savings</div>
                <div className="text-2xl font-bold text-green-900">
                  {formatCurrency(data.earlyPaymentDiscounts.captured)}
                </div>
                <div className="text-sm text-green-600">
                  Captured this period
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm font-medium text-red-600">Missed Opportunities</div>
                <div className="text-2xl font-bold text-red-900">
                  {formatCurrency(data.earlyPaymentDiscounts.missed)}
                </div>
                <div className="text-sm text-red-600">
                  Potential: {formatCurrency(data.earlyPaymentDiscounts.potentialSavings)}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm font-medium text-purple-600">Cash Cycle</div>
                <div className="text-2xl font-bold text-purple-900">
                  {formatDays(data.cashFlowOptimization.currentCashCycle)}
                </div>
                <div className="text-sm text-purple-600">
                  Target: {formatDays(data.cashFlowOptimization.optimizedCashCycle)}
                </div>
              </div>
            </div>

            {/* Benchmark Comparison */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-3">Industry Benchmark</h4>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600">Your Average Terms</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatDays(data.currentTermsAnalysis.averagePaymentTerms)}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm text-gray-600">Industry Average</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {formatDays(data.currentTermsAnalysis.benchmarkComparison.industryAverage)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600">Variance</div>
                  <div className={`text-lg font-semibold ${
                    data.currentTermsAnalysis.benchmarkComparison.variance > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {data.currentTermsAnalysis.benchmarkComparison.variance > 0 ? '+' : ''}
                    {formatDays(data.currentTermsAnalysis.benchmarkComparison.variance)}
                  </div>
                </div>
                <div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    getRankingColor(data.currentTermsAnalysis.benchmarkComparison.ranking)
                  }`}>
                    {data.currentTermsAnalysis.benchmarkComparison.ranking.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Recommendations */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-yellow-900 mb-3">Top Recommendations</h4>
              <div className="space-y-2">
                {data.cashFlowOptimization.recommendations.slice(0, 3).map((rec, index) => (
                  <div key={rec.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-yellow-900">{rec.title}</div>
                      <div className="text-xs text-yellow-700">{rec.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-yellow-900">
                        {formatCurrency(rec.impact)}
                      </div>
                      <div className={`text-xs px-2 py-1 rounded ${getEffortColor(rec.implementationEffort)}`}>
                        {rec.implementationEffort.toUpperCase()} EFFORT
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'terms' && (
          <div className="space-y-6">
            {/* Payment Terms Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-md font-semibold text-gray-900 mb-4">Payment Terms Distribution</h4>
                <div className="h-64">
                  <Doughnut data={termsDistributionData} options={doughnutOptions} />
                </div>
              </div>
              
              <div className="space-y-4">
                <h4 className="text-md font-semibold text-gray-900">Terms Analysis</h4>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-white rounded border">
                    <span className="text-sm font-medium text-gray-700">Average Terms</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatDays(data.currentTermsAnalysis.averagePaymentTerms)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded border">
                    <span className="text-sm font-medium text-gray-700">Weighted Average</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatDays(data.currentTermsAnalysis.weightedAverageTerms)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded border">
                    <span className="text-sm font-medium text-gray-700">Industry Benchmark</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatDays(data.currentTermsAnalysis.benchmarkComparison.industryAverage)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded border">
                    <span className="text-sm font-medium text-gray-700">Performance Ranking</span>
                    <span className={`text-sm font-semibold px-2 py-1 rounded ${
                      getRankingColor(data.currentTermsAnalysis.benchmarkComparison.ranking)
                    }`}>
                      {data.currentTermsAnalysis.benchmarkComparison.ranking.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Terms Distribution Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Terms
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor Count
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.currentTermsAnalysis.termDistribution.map((term, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {term.terms}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {term.vendorCount}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(term.totalValue)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPercentage(term.percentage)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'discounts' && (
          <div className="space-y-6">
            {/* Discount Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm font-medium text-green-600">Captured Discounts</div>
                <div className="text-2xl font-bold text-green-900">
                  {formatCurrency(data.earlyPaymentDiscounts.captured)}
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm font-medium text-red-600">Missed Discounts</div>
                <div className="text-2xl font-bold text-red-900">
                  {formatCurrency(data.earlyPaymentDiscounts.missed)}
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-600">Potential Savings</div>
                <div className="text-2xl font-bold text-blue-900">
                  {formatCurrency(data.earlyPaymentDiscounts.potentialSavings)}
                </div>
              </div>
            </div>

            {/* Monthly Trends Chart */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Monthly Discount Trends</h4>
              <div className="h-64">
                <Bar data={discountTrendsData} options={chartOptions} />
              </div>
            </div>

            {/* Discount Opportunities */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4">Discount Opportunities</h4>
              <div className="space-y-4">
                {data.earlyPaymentDiscounts.discountOpportunities.map((opportunity, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="text-lg font-semibold text-gray-900">{opportunity.vendorName}</h5>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                          <div>
                            <div className="text-sm font-medium text-gray-500">Discount Rate</div>
                            <div className="text-lg font-semibold text-gray-900">
                              {formatPercentage(opportunity.discountRate)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Discount Days</div>
                            <div className="text-lg font-semibold text-gray-900">
                              {formatDays(opportunity.discountDays)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Standard Terms</div>
                            <div className="text-lg font-semibold text-gray-900">
                              {formatDays(opportunity.standardTerms)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Potential Savings</div>
                            <div className="text-lg font-semibold text-green-600">
                              {formatCurrency(opportunity.potentialSavings)}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="ml-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          getRiskColor(opportunity.riskAssessment)
                        }`}>
                          {opportunity.riskAssessment.toUpperCase()} RISK
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-6">
            {/* Vendor Selection */}
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter by Vendor:</label>
              <select
                value={selectedVendor || ''}
                onChange={(e) => setSelectedVendor(e.target.value || null)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Vendors</option>
                {data.vendorPaymentPerformance.map(vendor => (
                  <option key={vendor.vendorId} value={vendor.vendorId}>
                    {vendor.vendorName}
                  </option>
                ))}
              </select>
            </div>

            {/* Vendor Performance Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vendor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Avg Payment Time
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      On-Time Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Early Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Late Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Terms
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credit Rating
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Relationship Score
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.vendorPaymentPerformance
                    .filter(vendor => !selectedVendor || vendor.vendorId === selectedVendor)
                    .map((vendor) => (
                    <tr key={vendor.vendorId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {vendor.vendorName}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDays(vendor.averagePaymentTime)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          vendor.onTimePaymentRate >= 90 ? 'bg-green-100 text-green-800' :
                          vendor.onTimePaymentRate >= 75 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {formatPercentage(vendor.onTimePaymentRate)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPercentage(vendor.earlyPaymentRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPercentage(vendor.latePaymentRate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {vendor.paymentTerms}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                          {vendor.creditRating}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${vendor.relationshipScore}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-600">
                            {vendor.relationshipScore.toFixed(0)}
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

        {activeTab === 'cashflow' && (
          <div className="space-y-6">
            {/* Cash Flow Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-600">Current Cash Cycle</div>
                <div className="text-2xl font-bold text-blue-900">
                  {formatDays(data.cashFlowOptimization.currentCashCycle)}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm font-medium text-green-600">Optimized Cash Cycle</div>
                <div className="text-2xl font-bold text-green-900">
                  {formatDays(data.cashFlowOptimization.optimizedCashCycle)}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm font-medium text-purple-600">Potential Improvement</div>
                <div className="text-2xl font-bold text-purple-900">
                  {formatDays(data.cashFlowOptimization.potentialImprovement)}
                </div>
              </div>
            </div>

            {/* Cash Flow Projection Chart */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Cash Flow Projections</h4>
              <div className="h-64">
                <Line data={cashFlowData} options={chartOptions} />
              </div>
            </div>

            {/* Cash Flow Recommendations */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4">Cash Flow Optimization Recommendations</h4>
              <div className="space-y-4">
                {data.cashFlowOptimization.recommendations.map((recommendation) => (
                  <div key={recommendation.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="text-lg font-semibold text-gray-900">{recommendation.title}</h5>
                        <p className="text-gray-600 mt-1">{recommendation.description}</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                          <div>
                            <div className="text-sm font-medium text-gray-500">Impact</div>
                            <div className="text-lg font-semibold text-green-600">
                              {formatCurrency(recommendation.impact)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Implementation Effort</div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              getEffortColor(recommendation.implementationEffort)
                            }`}>
                              {recommendation.implementationEffort.toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Risk Level</div>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              getRiskColor(recommendation.riskLevel)
                            }`}>
                              {recommendation.riskLevel.toUpperCase()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Timing Optimization */}
            <div>
              <h4 className="text-md font-semibold text-gray-900 mb-4">Payment Timing Optimization</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Vendor
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Timing
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Recommended Timing
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Potential Savings
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Risk Impact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Complexity
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {data.paymentTimingOptimization.map((optimization, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {optimization.vendorName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {optimization.currentTiming}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {optimization.recommendedTiming}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">
                          {formatCurrency(optimization.potentialSavings)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            optimization.riskImpact === 'positive' ? 'bg-green-100 text-green-800' :
                            optimization.riskImpact === 'neutral' ? 'bg-gray-100 text-gray-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {optimization.riskImpact.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            getEffortColor(optimization.implementationComplexity)
                          }`}>
                            {optimization.implementationComplexity.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentTermsOptimization;