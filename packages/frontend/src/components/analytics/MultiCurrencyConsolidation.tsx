import React, { useState, useEffect } from 'react';
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
  MultiCurrencyConsolidationData, 
  CurrencyBreakdown, 
  ExchangeRateImpact,
  HedgingRecommendation 
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

interface MultiCurrencyConsolidationProps {
  data: MultiCurrencyConsolidationData;
  loading?: boolean;
  onRefresh?: () => void;
  className?: string;
}

const MultiCurrencyConsolidation: React.FC<MultiCurrencyConsolidationProps> = ({
  data,
  loading = false,
  onRefresh,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'breakdown' | 'impact' | 'hedging'>('overview');
  const [selectedCurrency, setSelectedCurrency] = useState<string | null>(null);

  // Currency colors for consistent visualization
  const currencyColors = {
    'USD': '#1f77b4',
    'EUR': '#ff7f0e',
    'GBP': '#2ca02c',
    'JPY': '#d62728',
    'CAD': '#9467bd',
    'AUD': '#8c564b',
    'CHF': '#e377c2',
    'CNY': '#7f7f7f'
  };

  const getColorForCurrency = (currency: string): string => {
    return currencyColors[currency as keyof typeof currencyColors] || '#17becf';
  };

  const formatCurrency = (amount: number, currency: string = data.baseCurrency): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendIcon = (trend: 'strengthening' | 'weakening' | 'stable'): string => {
    switch (trend) {
      case 'strengthening': return '📈';
      case 'weakening': return '📉';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  const getRiskLevelColor = (riskLevel: 'low' | 'medium' | 'high'): string => {
    switch (riskLevel) {
      case 'low': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'high': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Currency breakdown chart data
  const currencyBreakdownChartData = {
    labels: data.currencyBreakdown.map(c => c.currency),
    datasets: [
      {
        data: data.currencyBreakdown.map(c => c.amountInBaseCurrency),
        backgroundColor: data.currencyBreakdown.map(c => getColorForCurrency(c.currency)),
        borderColor: data.currencyBreakdown.map(c => getColorForCurrency(c.currency)),
        borderWidth: 2
      }
    ]
  };

  // Exchange rate trend chart data
  const exchangeRateTrendData = {
    labels: data.historicalRates
      .filter(r => selectedCurrency ? r.currency === selectedCurrency : true)
      .slice(-30) // Last 30 data points
      .map(r => new Date(r.date).toLocaleDateString()),
    datasets: data.currencyBreakdown
      .filter(c => selectedCurrency ? c.currency === selectedCurrency : c.currency !== data.baseCurrency)
      .map(currency => ({
        label: `${currency.currency}/${data.baseCurrency}`,
        data: data.historicalRates
          .filter(r => r.currency === currency.currency)
          .slice(-30)
          .map(r => r.rate),
        borderColor: getColorForCurrency(currency.currency),
        backgroundColor: getColorForCurrency(currency.currency) + '20',
        tension: 0.1,
        fill: false
      }))
  };

  // Exchange rate impact chart data
  const impactChartData = {
    labels: data.exchangeRateImpact.impactByMonth.map(i => i.month),
    datasets: [
      {
        label: 'Exchange Rate Impact',
        data: data.exchangeRateImpact.impactByMonth.map(i => i.gainLoss),
        backgroundColor: data.exchangeRateImpact.impactByMonth.map(i => 
          i.gainLoss >= 0 ? '#10b981' : '#ef4444'
        ),
        borderColor: data.exchangeRateImpact.impactByMonth.map(i => 
          i.gainLoss >= 0 ? '#059669' : '#dc2626'
        ),
        borderWidth: 1
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
            const currency = data.currencyBreakdown[context.dataIndex];
            return `${currency.currency}: ${formatCurrency(currency.amountInBaseCurrency)} (${formatPercentage(currency.percentage)})`;
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
            <h3 className="text-lg font-semibold text-gray-900">Multi-Currency Consolidation</h3>
            <p className="text-sm text-gray-600">
              Total Spend: {formatCurrency(data.totalSpendBaseCurrency)} ({data.baseCurrency})
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
            { key: 'breakdown', label: 'Currency Breakdown' },
            { key: 'impact', label: 'Exchange Rate Impact' },
            { key: 'hedging', label: 'Hedging Recommendations' }
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-600">Total Currencies</div>
                <div className="text-2xl font-bold text-blue-900">
                  {data.currencyBreakdown.length}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm font-medium text-green-600">Exchange Rate Impact</div>
                <div className="text-2xl font-bold text-green-900">
                  {formatCurrency(data.exchangeRateImpact.gainLoss)}
                </div>
                <div className="text-sm text-green-600">
                  {data.exchangeRateImpact.trend === 'favorable' ? '📈' : 
                   data.exchangeRateImpact.trend === 'unfavorable' ? '📉' : '➡️'} 
                  {data.exchangeRateImpact.trend}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm font-medium text-purple-600">Hedging Opportunities</div>
                <div className="text-2xl font-bold text-purple-900">
                  {data.hedgingRecommendations.length}
                </div>
              </div>
            </div>

            {/* Currency Distribution Chart */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Currency Distribution</h4>
              <div className="h-64">
                <Doughnut data={currencyBreakdownChartData} options={doughnutOptions} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'breakdown' && (
          <div className="space-y-6">
            {/* Currency Selection */}
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">Filter by Currency:</label>
              <select
                value={selectedCurrency || ''}
                onChange={(e) => setSelectedCurrency(e.target.value || null)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Currencies</option>
                {data.currencyBreakdown.map(currency => (
                  <option key={currency.currency} value={currency.currency}>
                    {currency.currency}
                  </option>
                ))}
              </select>
            </div>

            {/* Currency Breakdown Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Currency
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Original Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exchange Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {data.baseCurrency} Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Percentage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Trend
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Volatility
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.currencyBreakdown
                    .filter(currency => !selectedCurrency || currency.currency === selectedCurrency)
                    .map((currency) => (
                    <tr key={currency.currency} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div 
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: getColorForCurrency(currency.currency) }}
                          ></div>
                          <span className="text-sm font-medium text-gray-900">
                            {currency.currency}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(currency.amount, currency.currency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {currency.exchangeRate.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(currency.amountInBaseCurrency)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatPercentage(currency.percentage)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className="flex items-center">
                          {getTrendIcon(currency.trend)}
                          <span className="ml-1 capitalize">{currency.trend}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          currency.volatility > 0.15 ? 'bg-red-100 text-red-800' :
                          currency.volatility > 0.10 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {formatPercentage(currency.volatility * 100)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Historical Exchange Rates Chart */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Historical Exchange Rates</h4>
              <div className="h-64">
                <Line data={exchangeRateTrendData} options={chartOptions} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'impact' && (
          <div className="space-y-6">
            {/* Impact Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`rounded-lg p-4 ${
                data.exchangeRateImpact.gainLoss >= 0 ? 'bg-green-50' : 'bg-red-50'
              }`}>
                <div className={`text-sm font-medium ${
                  data.exchangeRateImpact.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  Total Impact
                </div>
                <div className={`text-2xl font-bold ${
                  data.exchangeRateImpact.gainLoss >= 0 ? 'text-green-900' : 'text-red-900'
                }`}>
                  {formatCurrency(data.exchangeRateImpact.gainLoss)}
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm font-medium text-blue-600">Impact Percentage</div>
                <div className="text-2xl font-bold text-blue-900">
                  {formatPercentage(data.exchangeRateImpact.percentage)}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-sm font-medium text-purple-600">Trend</div>
                <div className="text-2xl font-bold text-purple-900 capitalize">
                  {data.exchangeRateImpact.trend}
                </div>
              </div>
            </div>

            {/* Monthly Impact Chart */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-md font-semibold text-gray-900 mb-4">Monthly Exchange Rate Impact</h4>
              <div className="h-64">
                <Bar data={impactChartData} options={chartOptions} />
              </div>
            </div>

            {/* Monthly Impact Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Gain/Loss
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Average Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Volume
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.exchangeRateImpact.impactByMonth.map((impact, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(impact.month + '-01').toLocaleDateString('en-US', { 
                          year: 'numeric', 
                          month: 'long' 
                        })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`font-medium ${
                          impact.gainLoss >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatCurrency(impact.gainLoss)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {impact.exchangeRate.toFixed(4)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(impact.volume)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'hedging' && (
          <div className="space-y-6">
            {data.hedgingRecommendations.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-400 text-lg mb-2">🛡️</div>
                <p className="text-gray-500">No hedging recommendations at this time</p>
                <p className="text-sm text-gray-400 mt-1">
                  Recommendations appear when currency exposure exceeds risk thresholds
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.hedgingRecommendations.map((recommendation) => (
                  <div key={recommendation.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {recommendation.title}
                          </h4>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskLevelColor(recommendation.riskLevel)}`}>
                            {recommendation.riskLevel.toUpperCase()} RISK
                          </span>
                        </div>
                        <p className="text-gray-600 mb-3">{recommendation.description}</p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                          <div>
                            <div className="text-sm font-medium text-gray-500">Currency</div>
                            <div className="text-lg font-semibold text-gray-900">
                              {recommendation.currency}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Recommendation Type</div>
                            <div className="text-lg font-semibold text-gray-900 capitalize">
                              {recommendation.recommendationType.replace('_', ' ')}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Potential Savings</div>
                            <div className="text-lg font-semibold text-green-600">
                              {formatCurrency(recommendation.potentialSavings)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm font-medium text-gray-500">Time Horizon</div>
                            <div className="text-sm text-gray-900">{recommendation.timeHorizon}</div>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-500">Implementation</div>
                            <div className="text-sm text-gray-900">{recommendation.implementation}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MultiCurrencyConsolidation;