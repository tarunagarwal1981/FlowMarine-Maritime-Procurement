import React, { useState } from 'react';
import MultiCurrencyConsolidation from '../components/analytics/MultiCurrencyConsolidation';
import { useMultiCurrencyData, MultiCurrencyFilters } from '../hooks/useMultiCurrencyData';

const MultiCurrencyConsolidationExample: React.FC = () => {
  const [filters, setFilters] = useState<MultiCurrencyFilters>({
    startDate: new Date(new Date().getFullYear(), 0, 1), // Start of current year
    endDate: new Date(), // Today
    baseCurrency: 'USD',
    vesselIds: [],
    categories: [],
    vendorIds: []
  });

  const { data, loading, error, refetch } = useMultiCurrencyData(filters);

  const handleFilterChange = (newFilters: Partial<MultiCurrencyFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleRefresh = async () => {
    await refetch();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Financial Insights Dashboard</h1>
          <p className="mt-2 text-gray-600">
            Multi-currency consolidation and exchange rate impact analysis for maritime procurement
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Filters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate.toISOString().split('T')[0]}
                onChange={(e) => handleFilterChange({ startDate: new Date(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate.toISOString().split('T')[0]}
                onChange={(e) => handleFilterChange({ endDate: new Date(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Base Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Base Currency
              </label>
              <select
                value={filters.baseCurrency}
                onChange={(e) => handleFilterChange({ baseCurrency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
                <option value="JPY">JPY - Japanese Yen</option>
                <option value="CAD">CAD - Canadian Dollar</option>
                <option value="AUD">AUD - Australian Dollar</option>
              </select>
            </div>

            {/* Vessels Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vessels
              </label>
              <select
                multiple
                value={filters.vesselIds || []}
                onChange={(e) => {
                  const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                  handleFilterChange({ vesselIds: selectedOptions });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                size={3}
              >
                <option value="vessel1">MV Ocean Pioneer</option>
                <option value="vessel2">MV Sea Explorer</option>
                <option value="vessel3">MV Maritime Star</option>
                <option value="vessel4">MV Blue Horizon</option>
                <option value="vessel5">MV Pacific Voyager</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>
          </div>

          {/* Additional Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {/* Categories Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Categories
              </label>
              <select
                multiple
                value={filters.categories || []}
                onChange={(e) => {
                  const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                  handleFilterChange({ categories: selectedOptions });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                size={4}
              >
                <option value="ENGINE">Engine Parts</option>
                <option value="DECK">Deck Equipment</option>
                <option value="SAFETY">Safety Equipment</option>
                <option value="NAVIGATION">Navigation Equipment</option>
                <option value="CATERING">Catering Supplies</option>
                <option value="MAINTENANCE">Maintenance Supplies</option>
              </select>
            </div>

            {/* Vendors Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vendors
              </label>
              <select
                multiple
                value={filters.vendorIds || []}
                onChange={(e) => {
                  const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                  handleFilterChange({ vendorIds: selectedOptions });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                size={4}
              >
                <option value="vendor1">Maritime Supplies Co.</option>
                <option value="vendor2">Engine Parts Ltd.</option>
                <option value="vendor3">Safety Equipment Inc.</option>
                <option value="vendor4">Navigation Systems Corp.</option>
                <option value="vendor5">Global Marine Services</option>
              </select>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error Loading Data</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                  <p className="mt-1">Using demo data for display purposes.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Multi-Currency Consolidation Component */}
        {data && (
          <MultiCurrencyConsolidation
            data={data}
            loading={loading}
            onRefresh={handleRefresh}
            className="mb-6"
          />
        )}

        {/* Usage Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">How to Use Multi-Currency Consolidation</h3>
          <div className="space-y-3 text-sm text-blue-800">
            <div>
              <strong>Overview Tab:</strong> View key metrics including total currencies, exchange rate impact, 
              and hedging opportunities. The currency distribution chart shows spending breakdown by currency.
            </div>
            <div>
              <strong>Currency Breakdown Tab:</strong> Detailed analysis of each currency including original amounts, 
              exchange rates, volatility, and trends. Filter by specific currencies and view historical exchange rate charts.
            </div>
            <div>
              <strong>Exchange Rate Impact Tab:</strong> Analyze the financial impact of exchange rate fluctuations 
              with monthly breakdowns and trend analysis.
            </div>
            <div>
              <strong>Hedging Recommendations Tab:</strong> AI-powered recommendations for currency hedging strategies 
              based on exposure levels, volatility, and risk assessment.
            </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-100 rounded-md">
            <h4 className="font-semibold text-blue-900 mb-2">Key Features:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-blue-800">
              <li>Real-time exchange rate integration</li>
              <li>Historical rate analysis and trends</li>
              <li>Volatility-based risk assessment</li>
              <li>Automated hedging recommendations</li>
              <li>Multi-currency consolidation in base currency</li>
              <li>Interactive filtering and drill-down capabilities</li>
            </ul>
          </div>
        </div>

        {/* Sample Data Info */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Sample Data Information</h4>
          <p className="text-xs text-gray-600">
            This example uses mock data for demonstration purposes. In a production environment, 
            data would be fetched from the FlowMarine backend API with real exchange rates, 
            transaction data, and AI-powered analytics.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MultiCurrencyConsolidationExample;