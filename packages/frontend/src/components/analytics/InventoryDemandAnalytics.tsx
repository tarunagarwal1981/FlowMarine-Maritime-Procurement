import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart
} from 'recharts';
import { useInventoryDemandData } from '../../hooks/useInventoryDemandData';
import { InventoryDemandFilters, InventoryTurnoverData, DemandForecastData, StockAlert } from '../../types/analytics';

interface InventoryDemandAnalyticsProps {
  vesselIds?: string[];
  timeRange: {
    start: Date;
    end: Date;
  };
  categories?: string[];
  className?: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export const InventoryDemandAnalytics: React.FC<InventoryDemandAnalyticsProps> = ({
  vesselIds,
  timeRange,
  categories,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'turnover' | 'forecast' | 'optimization' | 'alerts'>('turnover');
  const [selectedVessel, setSelectedVessel] = useState<string>('all');

  const filters: InventoryDemandFilters = {
    vesselIds,
    timeRange,
    categories,
    selectedVessel: selectedVessel === 'all' ? undefined : selectedVessel
  };

  const {
    inventoryTurnover,
    demandForecast,
    optimizationRecommendations,
    stockAlerts,
    predictiveMaintenanceNeeds,
    loading,
    error
  } = useInventoryDemandData(filters);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const renderInventoryTurnoverAnalysis = () => (
    <div className="space-y-6">
      {/* Turnover Rate Overview */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Turnover Rates</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={inventoryTurnover?.categoryTurnover || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="category" 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip 
                formatter={(value: number) => [value.toFixed(2), 'Turnover Rate']}
              />
              <Legend />
              <Bar dataKey="turnoverRate" fill="#0088FE" name="Turnover Rate" />
              <Bar dataKey="targetRate" fill="#00C49F" name="Target Rate" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Inventory Value Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Value by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={inventoryTurnover?.valueDistribution || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {inventoryTurnover?.valueDistribution?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Slow-Moving Items</h3>
          <div className="space-y-3">
            {inventoryTurnover?.slowMovingItems?.slice(0, 5).map((item, index) => (
              <div key={index} className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{item.itemName}</p>
                  <p className="text-sm text-gray-600">{item.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-red-600">
                    {item.daysInStock} days
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatCurrency(item.value)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderDemandForecast = () => (
    <div className="space-y-6">
      {/* Seasonal Demand Patterns */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Seasonal Demand Forecast</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={demandForecast?.seasonalPatterns || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Area
                type="monotone"
                dataKey="historicalDemand"
                stackId="1"
                stroke="#8884d8"
                fill="#8884d8"
                name="Historical Demand"
              />
              <Area
                type="monotone"
                dataKey="forecastedDemand"
                stackId="2"
                stroke="#82ca9d"
                fill="#82ca9d"
                name="Forecasted Demand"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category-wise Forecast */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Demand Forecast by Category</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={demandForecast?.categoryForecast || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip />
              <Legend />
              {demandForecast?.categoryForecast?.[0] && Object.keys(demandForecast.categoryForecast[0])
                .filter(key => key !== 'period')
                .map((category, index) => (
                  <Line
                    key={category}
                    type="monotone"
                    dataKey={category}
                    stroke={COLORS[index % COLORS.length]}
                    strokeWidth={2}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Forecast Accuracy Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Forecast Accuracy</h4>
          <p className="text-2xl font-bold text-green-600">
            {formatPercentage(demandForecast?.accuracy || 0)}
          </p>
          <p className="text-sm text-gray-600 mt-1">Last 6 months</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Mean Absolute Error</h4>
          <p className="text-2xl font-bold text-blue-600">
            {demandForecast?.meanAbsoluteError?.toFixed(1) || 0}
          </p>
          <p className="text-sm text-gray-600 mt-1">Units</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h4 className="text-sm font-medium text-gray-500 mb-2">Trend Direction</h4>
          <p className="text-2xl font-bold text-purple-600">
            {demandForecast?.trendDirection || 'Stable'}
          </p>
          <p className="text-sm text-gray-600 mt-1">Next quarter</p>
        </div>
      </div>
    </div>
  );

  const renderOptimizationRecommendations = () => (
    <div className="space-y-6">
      {/* Optimization Opportunities */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Optimization Recommendations</h3>
        <div className="space-y-4">
          {optimizationRecommendations?.recommendations?.map((rec, index) => (
            <div key={index} className="border-l-4 border-blue-500 pl-4 py-3 bg-blue-50 rounded-r-lg">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{rec.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                  <div className="flex items-center mt-2 space-x-4">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {rec.category}
                    </span>
                    <span className="text-xs text-gray-500">
                      Impact: {rec.impact}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">
                    {formatCurrency(rec.potentialSavings)}
                  </p>
                  <p className="text-xs text-gray-500">Potential Savings</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optimal Stock Levels */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimal Stock Level Analysis</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={optimizationRecommendations?.optimalStockLevels || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="itemName" angle={-45} textAnchor="end" height={80} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="currentStock" fill="#FF8042" name="Current Stock" />
              <Bar dataKey="optimalStock" fill="#00C49F" name="Optimal Stock" />
              <Bar dataKey="reorderPoint" fill="#FFBB28" name="Reorder Point" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  const renderStockAlerts = () => (
    <div className="space-y-6">
      {/* Critical Alerts */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Level Alerts</h3>
        <div className="space-y-3">
          {stockAlerts?.criticalAlerts?.map((alert, index) => (
            <div key={index} className={`p-4 rounded-lg border-l-4 ${
              alert.severity === 'critical' ? 'border-red-500 bg-red-50' :
              alert.severity === 'warning' ? 'border-yellow-500 bg-yellow-50' :
              'border-blue-500 bg-blue-50'
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-medium text-gray-900">{alert.itemName}</h4>
                  <p className="text-sm text-gray-600">{alert.vesselName} - {alert.category}</p>
                  <p className="text-sm mt-1">{alert.message}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                    alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {alert.severity.toUpperCase()}
                  </span>
                  <p className="text-xs text-gray-500 mt-1">
                    Current: {alert.currentStock}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Predictive Maintenance Needs */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Predictive Maintenance Procurement</h3>
        <div className="space-y-4">
          {predictiveMaintenanceNeeds?.upcomingNeeds?.map((need, index) => (
            <div key={index} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
              <div>
                <h4 className="font-medium text-gray-900">{need.equipmentName}</h4>
                <p className="text-sm text-gray-600">{need.vesselName}</p>
                <p className="text-sm text-gray-500">
                  Predicted maintenance: {new Date(need.predictedDate).toLocaleDateString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-blue-600">
                  {need.requiredParts.length} parts needed
                </p>
                <p className="text-xs text-gray-500">
                  Est. cost: {formatCurrency(need.estimatedCost)}
                </p>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                  need.urgency === 'high' ? 'bg-red-100 text-red-800' :
                  need.urgency === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {need.urgency} priority
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <p className="text-red-800">Error loading inventory and demand analytics: {error}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Inventory & Demand Analytics</h2>
          <div className="flex items-center space-x-4">
            <select
              value={selectedVessel}
              onChange={(e) => setSelectedVessel(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All Vessels</option>
              {/* Add vessel options here */}
            </select>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'turnover', label: 'Inventory Turnover' },
              { key: 'forecast', label: 'Demand Forecast' },
              { key: 'optimization', label: 'Optimization' },
              { key: 'alerts', label: 'Stock Alerts' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
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
      </div>

      {/* Tab Content */}
      {activeTab === 'turnover' && renderInventoryTurnoverAnalysis()}
      {activeTab === 'forecast' && renderDemandForecast()}
      {activeTab === 'optimization' && renderOptimizationRecommendations()}
      {activeTab === 'alerts' && renderStockAlerts()}
    </div>
  );
};

export default InventoryDemandAnalytics;