import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  Cell,
} from 'recharts';
import { VendorPerformance, HistoricalScore } from '../types/analytics';

interface VendorPerformanceScorecardsProps {
  topVendorsCount: number;
  performanceMetrics: string[];
  timeRange: { from: Date; to: Date };
  data: VendorPerformance[];
  loading?: boolean;
  onVendorSelect: (vendor: VendorPerformance) => void;
  onRecommendationClick: (vendorId: string, recommendation: string) => void;
  className?: string;
}

export const VendorPerformanceScorecards: React.FC<VendorPerformanceScorecardsProps> = ({
  topVendorsCount,
  performanceMetrics,
  timeRange,
  data,
  loading = false,
  onVendorSelect,
  onRecommendationClick,
  className = '',
}) => {
  const [viewMode, setViewMode] = useState<'scorecards' | 'comparison' | 'trends' | 'recommendations'>('scorecards');
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'overallScore' | 'deliveryScore' | 'qualityScore' | 'priceScore' | 'costSavings'>('overallScore');

  // Sort and filter vendors
  const sortedVendors = useMemo(() => {
    return [...data]
      .sort((a, b) => b[sortBy] - a[sortBy])
      .slice(0, topVendorsCount);
  }, [data, sortBy, topVendorsCount]);

  // Prepare data for comparison chart
  const comparisonData = useMemo(() => {
    return sortedVendors.map(vendor => ({
      name: vendor.vendorName.length > 15 ? vendor.vendorName.substring(0, 15) + '...' : vendor.vendorName,
      fullName: vendor.vendorName,
      vendorId: vendor.vendorId,
      overall: vendor.overallScore,
      delivery: vendor.deliveryScore,
      quality: vendor.qualityScore,
      price: vendor.priceScore,
      orders: vendor.totalOrders,
      savings: vendor.costSavings,
    }));
  }, [sortedVendors]);

  // Prepare radar chart data for selected vendor
  const radarData = useMemo(() => {
    if (!selectedVendor) return [];
    
    const vendor = data.find(v => v.vendorId === selectedVendor);
    if (!vendor) return [];

    return [
      {
        metric: 'Overall',
        score: vendor.overallScore,
        fullMark: 100,
      },
      {
        metric: 'Delivery',
        score: vendor.deliveryScore,
        fullMark: 100,
      },
      {
        metric: 'Quality',
        score: vendor.qualityScore,
        fullMark: 100,
      },
      {
        metric: 'Price',
        score: vendor.priceScore,
        fullMark: 100,
      },
    ];
  }, [selectedVendor, data]);

  // Prepare trend data for selected vendor
  const trendData = useMemo(() => {
    if (!selectedVendor) return [];
    
    const vendor = data.find(v => v.vendorId === selectedVendor);
    if (!vendor || !vendor.historicalScores) return [];

    return vendor.historicalScores.map(score => ({
      period: score.period,
      overall: score.overallScore,
      delivery: score.deliveryScore,
      quality: score.qualityScore,
      price: score.priceScore,
    }));
  }, [selectedVendor, data]);

  // Color schemes
  const getScoreColor = (score: number) => {
    if (score >= 90) return '#10B981'; // Green
    if (score >= 75) return '#F59E0B'; // Yellow
    if (score >= 60) return '#F97316'; // Orange
    return '#EF4444'; // Red
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving':
        return '#10B981';
      case 'declining':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return '↗️';
      case 'declining':
        return '↘️';
      default:
        return '➡️';
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
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
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Vendor Performance Scorecards
          </h2>
          <p className="text-sm text-gray-600">
            Top {topVendorsCount} vendors | {timeRange.from.toLocaleDateString()} - {timeRange.to.toLocaleDateString()}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4 sm:mt-0">
          {/* Sort By Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="overallScore">Overall Score</option>
            <option value="deliveryScore">Delivery Score</option>
            <option value="qualityScore">Quality Score</option>
            <option value="priceScore">Price Score</option>
            <option value="costSavings">Cost Savings</option>
          </select>

          {/* View Mode Selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['scorecards', 'comparison', 'trends', 'recommendations'] as const).map((mode) => (
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

      {/* Scorecards View */}
      {viewMode === 'scorecards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedVendors.map((vendor) => (
            <div
              key={vendor.vendorId}
              className={`bg-gray-50 rounded-lg p-6 cursor-pointer hover:shadow-md transition-shadow ${
                selectedVendor === vendor.vendorId ? 'ring-2 ring-blue-500' : ''
              }`}
              onClick={() => {
                setSelectedVendor(vendor.vendorId);
                onVendorSelect(vendor);
              }}
            >
              {/* Vendor Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 truncate">
                  {vendor.vendorName}
                </h3>
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 mr-2">{getTrendIcon(vendor.trend)}</span>
                  <span
                    className="text-sm font-medium"
                    style={{ color: getTrendColor(vendor.trend) }}
                  >
                    {vendor.trend}
                  </span>
                </div>
              </div>

              {/* Overall Score */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Overall Score</span>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: getScoreColor(vendor.overallScore) }}
                  >
                    {vendor.overallScore.toFixed(1)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${vendor.overallScore}%`,
                      backgroundColor: getScoreColor(vendor.overallScore),
                    }}
                  />
                </div>
              </div>

              {/* Individual Scores */}
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Delivery</span>
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">{vendor.deliveryScore.toFixed(1)}</span>
                    <div className="w-16 bg-gray-200 rounded-full h-1">
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: `${vendor.deliveryScore}%`,
                          backgroundColor: getScoreColor(vendor.deliveryScore),
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Quality</span>
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">{vendor.qualityScore.toFixed(1)}</span>
                    <div className="w-16 bg-gray-200 rounded-full h-1">
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: `${vendor.qualityScore}%`,
                          backgroundColor: getScoreColor(vendor.qualityScore),
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Price</span>
                  <div className="flex items-center">
                    <span className="text-sm font-medium mr-2">{vendor.priceScore.toFixed(1)}</span>
                    <div className="w-16 bg-gray-200 rounded-full h-1">
                      <div
                        className="h-1 rounded-full"
                        style={{
                          width: `${vendor.priceScore}%`,
                          backgroundColor: getScoreColor(vendor.priceScore),
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">{vendor.totalOrders}</div>
                  <div className="text-xs text-gray-500">Orders</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-green-600">
                    ${vendor.costSavings.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">Savings</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {vendor.onTimeDeliveryRate.toFixed(1)}%
                  </div>
                  <div className="text-xs text-gray-500">On-Time</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {vendor.averageDeliveryTime.toFixed(1)}d
                  </div>
                  <div className="text-xs text-gray-500">Avg Delivery</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comparison View */}
      {viewMode === 'comparison' && (
        <div className="space-y-6">
          <div className="h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip 
                  formatter={(value, name) => [value, name]}
                  labelFormatter={(label) => {
                    const vendor = comparisonData.find(v => v.name === label);
                    return vendor ? vendor.fullName : label;
                  }}
                />
                <Legend />
                <Bar dataKey="overall" fill="#3B82F6" name="Overall Score" />
                <Bar dataKey="delivery" fill="#10B981" name="Delivery Score" />
                <Bar dataKey="quality" fill="#F59E0B" name="Quality Score" />
                <Bar dataKey="price" fill="#8B5CF6" name="Price Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Vendor Ranking Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vendor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Overall Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Delivery
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quality
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost Savings
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedVendors.map((vendor, index) => (
                  <tr
                    key={vendor.vendorId}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedVendor(vendor.vendorId);
                      onVendorSelect(vendor);
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {vendor.vendorName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <span style={{ color: getScoreColor(vendor.overallScore) }}>
                        {vendor.overallScore.toFixed(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {vendor.deliveryScore.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {vendor.qualityScore.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {vendor.priceScore.toFixed(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-600">
                      ${vendor.costSavings.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Trends View */}
      {viewMode === 'trends' && (
        <div className="space-y-6">
          {/* Vendor Selector for Trends */}
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Select Vendor:</label>
            <select
              value={selectedVendor || ''}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a vendor...</option>
              {sortedVendors.map((vendor) => (
                <option key={vendor.vendorId} value={vendor.vendorId}>
                  {vendor.vendorName}
                </option>
              ))}
            </select>
          </div>

          {selectedVendor && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar Chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Radar</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} />
                      <Radar
                        name="Score"
                        dataKey="score"
                        stroke="#3B82F6"
                        fill="#3B82F6"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Trend Line Chart */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Historical Trends</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="overall" stroke="#3B82F6" name="Overall" strokeWidth={2} />
                      <Line type="monotone" dataKey="delivery" stroke="#10B981" name="Delivery" strokeWidth={2} />
                      <Line type="monotone" dataKey="quality" stroke="#F59E0B" name="Quality" strokeWidth={2} />
                      <Line type="monotone" dataKey="price" stroke="#8B5CF6" name="Price" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recommendations View */}
      {viewMode === 'recommendations' && (
        <div className="space-y-6">
          {sortedVendors.map((vendor) => (
            <div key={vendor.vendorId} className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{vendor.vendorName}</h3>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-500">Overall Score:</span>
                  <span
                    className="text-lg font-bold"
                    style={{ color: getScoreColor(vendor.overallScore) }}
                  >
                    {vendor.overallScore.toFixed(1)}
                  </span>
                </div>
              </div>

              {vendor.recommendations && vendor.recommendations.length > 0 ? (
                <div className="space-y-3">
                  {vendor.recommendations.map((recommendation, index) => (
                    <div
                      key={index}
                      className="flex items-start space-x-3 p-3 bg-white rounded-lg cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={() => onRecommendationClick(vendor.vendorId, recommendation)}
                    >
                      <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">{recommendation}</p>
                      </div>
                      <div className="flex-shrink-0">
                        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                          View Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No specific recommendations available for this vendor.</p>
                  <p className="text-sm text-gray-400 mt-1">Performance is within acceptable ranges.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorPerformanceScorecards;