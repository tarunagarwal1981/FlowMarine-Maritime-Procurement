import React, { useState, useEffect } from 'react';
import { PortEfficiencyAnalytics } from '../components/analytics/PortEfficiencyAnalytics';
import { usePortEfficiencyData } from '../hooks/usePortEfficiencyData';
import { DashboardFilters } from '../types/analytics';

/**
 * Example usage of Port Efficiency Analytics component
 * This demonstrates how to integrate the component with real data
 */
export const PortEfficiencyAnalyticsExample: React.FC = () => {
  const [filters, setFilters] = useState<DashboardFilters>({
    timeRange: 'monthly',
    dateFrom: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
    dateTo: new Date(),
    vessels: [],
    categories: [],
    vendors: [],
    currency: 'USD',
  });

  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [selectedOptimizationId, setSelectedOptimizationId] = useState<string | null>(null);

  // Use the custom hook to fetch port efficiency data
  const {
    data,
    loading,
    error,
    refetch,
    updateFilters,
    exportData,
  } = usePortEfficiencyData({
    filters,
    refreshInterval: 30000, // Refresh every 30 seconds
    enabled: true,
  });

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<DashboardFilters>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    updateFilters(newFilters);
  };

  // Handle port selection
  const handlePortSelect = (portId: string) => {
    setSelectedPortId(portId);
    console.log('Selected port:', portId);
    
    // You could navigate to a detailed port view or show a modal
    // Example: navigate(`/ports/${portId}/details`);
  };

  // Handle optimization selection
  const handleOptimizationSelect = (optimizationId: string) => {
    setSelectedOptimizationId(optimizationId);
    console.log('Selected optimization:', optimizationId);
    
    // You could show optimization details or start implementation workflow
    // Example: showOptimizationModal(optimizationId);
  };

  // Handle data export
  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      await exportData(format);
      console.log(`Port efficiency data exported as ${format}`);
    } catch (error) {
      console.error('Export failed:', error);
      // Show error notification to user
    }
  };

  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      await refetch();
      console.log('Port efficiency data refreshed');
    } catch (error) {
      console.error('Refresh failed:', error);
    }
  };

  // Error handling
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Error Loading Port Efficiency Data
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={handleRefresh}
                className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-md text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Port Efficiency Analytics
            </h1>
            <p className="text-gray-600 mt-1">
              Monitor port performance, logistics efficiency, and optimization opportunities
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Time Range Filter */}
            <select
              value={filters.timeRange}
              onChange={(e) => handleFilterChange({ 
                timeRange: e.target.value as 'monthly' | 'quarterly' | 'yearly' 
              })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>

            {/* Currency Filter */}
            <select
              value={filters.currency}
              onChange={(e) => handleFilterChange({ currency: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="SGD">SGD</option>
            </select>

            {/* Export Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleExport('pdf')}
                disabled={loading || !data}
                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Export PDF
              </button>
              <button
                onClick={() => handleExport('excel')}
                disabled={loading || !data}
                className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Export Excel
              </button>
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Port Efficiency Analytics Component */}
      {data && (
        <PortEfficiencyAnalytics
          data={data}
          filters={filters}
          onPortSelect={handlePortSelect}
          onOptimizationSelect={handleOptimizationSelect}
          loading={loading}
          className="shadow-lg"
        />
      )}

      {/* Selected Items Display */}
      {(selectedPortId || selectedOptimizationId) && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-blue-900 mb-2">Selected Items</h3>
          {selectedPortId && (
            <p className="text-blue-800">
              <strong>Selected Port:</strong> {selectedPortId}
              <button
                onClick={() => setSelectedPortId(null)}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                Clear
              </button>
            </p>
          )}
          {selectedOptimizationId && (
            <p className="text-blue-800">
              <strong>Selected Optimization:</strong> {selectedOptimizationId}
              <button
                onClick={() => setSelectedOptimizationId(null)}
                className="ml-2 text-blue-600 hover:text-blue-800"
              >
                Clear
              </button>
            </p>
          )}
        </div>
      )}

      {/* Data Summary */}
      {data && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Data Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Ports:</span>
              <span className="ml-2 font-medium">{data.overview.totalPorts}</span>
            </div>
            <div>
              <span className="text-gray-600">Total Deliveries:</span>
              <span className="ml-2 font-medium">{data.overview.totalDeliveries.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-600">Avg Efficiency:</span>
              <span className="ml-2 font-medium">{data.overview.averageEfficiency.toFixed(1)}%</span>
            </div>
            <div>
              <span className="text-gray-600">On-Time Rate:</span>
              <span className="ml-2 font-medium">{data.overview.overallOnTimeRate.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PortEfficiencyAnalyticsExample;