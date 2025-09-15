import React, { useState, useEffect } from 'react';

interface SearchAnalyticsData {
  overview: {
    totalItems: number;
    dataCompleteness: {
      pricing: number;
      leadTime: number;
      specifications: number;
      impaCode: number;
      issaCode: number;
    };
  };
  categoryBreakdown: Array<{
    category: string;
    count: number;
    averagePrice?: number;
    averageLeadTime?: number;
  }>;
  criticalityBreakdown: Array<{
    level: string;
    count: number;
    averagePrice?: number;
    averageLeadTime?: number;
  }>;
  pricingStats: {
    totalWithPricing: number;
    averagePrice?: number;
    minPrice?: number;
    maxPrice?: number;
  };
  leadTimeStats: {
    totalWithLeadTime: number;
    averageLeadTime?: number;
    minLeadTime?: number;
    maxLeadTime?: number;
  };
  topCategories: Array<{
    category: string;
    count: number;
  }>;
  recentlyUpdated: Array<{
    id: string;
    name: string;
    category: string;
    averagePrice?: number;
    updatedAt: string;
  }>;
}

interface SearchAnalyticsProps {
  vesselType?: string;
  engineType?: string;
  category?: string;
  criticalityLevel?: string;
}

export const SearchAnalytics: React.FC<SearchAnalyticsProps> = ({
  vesselType,
  engineType,
  category,
  criticalityLevel
}) => {
  const [analytics, setAnalytics] = useState<SearchAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [vesselType, engineType, category, criticalityLevel]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      if (vesselType) params.append('vesselType', vesselType);
      if (engineType) params.append('engineType', engineType);
      if (category) params.append('category', category);
      if (criticalityLevel) params.append('criticalityLevel', criticalityLevel);

      const response = await fetch(`/api/item-catalog/analytics?${params}`);
      const data = await response.json();

      if (data.success) {
        setAnalytics(data.data);
      } else {
        throw new Error(data.error || 'Failed to load analytics');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getCriticalityColor = (level: string) => {
    switch (level) {
      case 'SAFETY_CRITICAL':
        return 'text-red-600 bg-red-50';
      case 'OPERATIONAL_CRITICAL':
        return 'text-orange-600 bg-orange-50';
      case 'ROUTINE':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getCategoryDisplayName = (category: string) => {
    return category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-600">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Error loading analytics</h3>
          <p className="mt-1 text-sm text-gray-500">{error}</p>
          <button
            onClick={loadAnalytics}
            className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{analytics.overview.totalItems}</div>
          <div className="text-sm text-gray-500">Total Items</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">
            {formatPercentage(analytics.overview.dataCompleteness.pricing)}
          </div>
          <div className="text-sm text-gray-500">With Pricing</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-orange-600">
            {formatPercentage(analytics.overview.dataCompleteness.leadTime)}
          </div>
          <div className="text-sm text-gray-500">With Lead Time</div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">
            {formatPercentage(analytics.overview.dataCompleteness.specifications)}
          </div>
          <div className="text-sm text-gray-500">With Specifications</div>
        </div>
      </div>

      {/* Data Completeness */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Data Completeness</h3>
        <div className="space-y-3">
          {Object.entries(analytics.overview.dataCompleteness).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 capitalize">
                {key.replace(/([A-Z])/g, ' $1')}
              </span>
              <div className="flex items-center space-x-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${value}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600 w-12 text-right">
                  {formatPercentage(value)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Breakdown */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Category Breakdown</h3>
          <div className="space-y-3">
            {analytics.categoryBreakdown.map((item) => (
              <div key={item.category} className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">
                    {getCategoryDisplayName(item.category)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Avg: {formatPrice(item.averagePrice)} • {item.averageLeadTime?.toFixed(1) || 'N/A'} days
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{item.count}</div>
                  <div className="text-sm text-gray-500">items</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Criticality Breakdown */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Criticality Breakdown</h3>
          <div className="space-y-3">
            {analytics.criticalityBreakdown.map((item) => (
              <div key={item.level} className="flex items-center justify-between">
                <div>
                  <div className={`inline-flex px-2 py-1 rounded text-sm font-medium ${getCriticalityColor(item.level)}`}>
                    {item.level.replace('_', ' ')}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    Avg: {formatPrice(item.averagePrice)} • {item.averageLeadTime?.toFixed(1) || 'N/A'} days
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">{item.count}</div>
                  <div className="text-sm text-gray-500">items</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pricing and Lead Time Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing Statistics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Items with pricing:</span>
              <span className="font-medium">{analytics.pricingStats.totalWithPricing}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Average price:</span>
              <span className="font-medium">{formatPrice(analytics.pricingStats.averagePrice)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Price range:</span>
              <span className="font-medium">
                {formatPrice(analytics.pricingStats.minPrice)} - {formatPrice(analytics.pricingStats.maxPrice)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Lead Time Statistics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Items with lead time:</span>
              <span className="font-medium">{analytics.leadTimeStats.totalWithLeadTime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Average lead time:</span>
              <span className="font-medium">
                {analytics.leadTimeStats.averageLeadTime?.toFixed(1) || 'N/A'} days
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Lead time range:</span>
              <span className="font-medium">
                {analytics.leadTimeStats.minLeadTime || 'N/A'} - {analytics.leadTimeStats.maxLeadTime || 'N/A'} days
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Updated Items */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recently Updated Items</h3>
        <div className="space-y-3">
          {analytics.recentlyUpdated.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
              <div>
                <div className="font-medium text-gray-900">{item.name}</div>
                <div className="text-sm text-gray-500">
                  {getCategoryDisplayName(item.category)} • {formatPrice(item.averagePrice)}
                </div>
              </div>
              <div className="text-sm text-gray-500">
                {new Date(item.updatedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SearchAnalytics;