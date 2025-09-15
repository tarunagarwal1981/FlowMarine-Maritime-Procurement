import React, { useState, useEffect } from 'react';

interface PricingTrends {
  recentPrices: number[];
  averageRecentPrice: number;
  priceVariation: number;
  dataPoints: number;
}

interface LeadTimeTrends {
  estimatedLeadTime: number;
  averageDelay: number;
  reliability: number | null;
}

interface ItemAnalytics {
  pricingTrends?: PricingTrends;
  leadTimeTrends?: LeadTimeTrends;
}

interface ItemWithAnalytics {
  id: string;
  name: string;
  impaCode?: string;
  issaCode?: string;
  category: string;
  criticalityLevel: string;
  averagePrice?: number;
  averagePriceCurrency?: string;
  leadTime?: number;
  unitOfMeasure: string;
  analytics?: ItemAnalytics;
}

interface PricingAnalyticsProps {
  items: ItemWithAnalytics[];
  onBulkUpdatePricing?: () => void;
  showBulkUpdate?: boolean;
}

export const PricingAnalytics: React.FC<PricingAnalyticsProps> = ({
  items,
  onBulkUpdatePricing,
  showBulkUpdate = false
}) => {
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'leadTime' | 'reliability'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterBy, setFilterBy] = useState<'all' | 'high_variation' | 'unreliable' | 'no_data'>('all');
  const [updatingPricing, setUpdatingPricing] = useState(false);

  const formatPrice = (price?: number, currency?: string) => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(price);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getPriceVariationColor = (variation: number, averagePrice: number) => {
    const variationPercent = (variation / averagePrice) * 100;
    if (variationPercent > 30) return 'text-red-600 bg-red-50';
    if (variationPercent > 15) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getReliabilityColor = (reliability: number | null) => {
    if (reliability === null) return 'text-gray-600 bg-gray-50';
    if (reliability >= 90) return 'text-green-600 bg-green-50';
    if (reliability >= 70) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const filteredAndSortedItems = React.useMemo(() => {
    let filtered = items;

    // Apply filters
    switch (filterBy) {
      case 'high_variation':
        filtered = items.filter(item => {
          const variation = item.analytics?.pricingTrends?.priceVariation;
          const avgPrice = item.analytics?.pricingTrends?.averageRecentPrice || item.averagePrice;
          return variation && avgPrice && (variation / avgPrice) * 100 > 20;
        });
        break;
      case 'unreliable':
        filtered = items.filter(item => {
          const reliability = item.analytics?.leadTimeTrends?.reliability;
          return reliability !== null && reliability < 80;
        });
        break;
      case 'no_data':
        filtered = items.filter(item => 
          !item.averagePrice || !item.leadTime || !item.analytics?.pricingTrends
        );
        break;
    }

    // Apply sorting
    return filtered.sort((a, b) => {
      let aValue: any, bValue: any;

      switch (sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'price':
          aValue = a.analytics?.pricingTrends?.averageRecentPrice || a.averagePrice || 0;
          bValue = b.analytics?.pricingTrends?.averageRecentPrice || b.averagePrice || 0;
          break;
        case 'leadTime':
          aValue = a.leadTime || 0;
          bValue = b.leadTime || 0;
          break;
        case 'reliability':
          aValue = a.analytics?.leadTimeTrends?.reliability || 0;
          bValue = b.analytics?.leadTimeTrends?.reliability || 0;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [items, sortBy, sortOrder, filterBy]);

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleBulkUpdatePricing = async () => {
    setUpdatingPricing(true);
    try {
      const response = await fetch('/api/item-catalog/pricing/bulk-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          itemIds: items.map(item => item.id)
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        onBulkUpdatePricing?.();
        // Show success message
        console.log(`Updated pricing for ${data.data.length} items`);
      } else {
        throw new Error(data.error || 'Failed to update pricing');
      }
    } catch (error) {
      console.error('Error updating pricing:', error);
      // Show error message
    } finally {
      setUpdatingPricing(false);
    }
  };

  const getSummaryStats = () => {
    const totalItems = items.length;
    const itemsWithPricing = items.filter(item => item.averagePrice).length;
    const itemsWithLeadTime = items.filter(item => item.leadTime).length;
    const itemsWithAnalytics = items.filter(item => item.analytics?.pricingTrends).length;
    
    const avgPrice = items
      .filter(item => item.averagePrice)
      .reduce((sum, item) => sum + (item.averagePrice || 0), 0) / itemsWithPricing;
    
    const avgLeadTime = items
      .filter(item => item.leadTime)
      .reduce((sum, item) => sum + (item.leadTime || 0), 0) / itemsWithLeadTime;

    return {
      totalItems,
      itemsWithPricing,
      itemsWithLeadTime,
      itemsWithAnalytics,
      avgPrice: isNaN(avgPrice) ? 0 : avgPrice,
      avgLeadTime: isNaN(avgLeadTime) ? 0 : avgLeadTime
    };
  };

  const stats = getSummaryStats();

  return (
    <div className="space-y-6">
      {/* Summary Statistics */}
      <div className="bg-white p-6 rounded-lg border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Pricing & Lead Time Analytics</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.totalItems}</div>
            <div className="text-sm text-gray-500">Total Items</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.itemsWithPricing}</div>
            <div className="text-sm text-gray-500">With Pricing</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{stats.itemsWithLeadTime}</div>
            <div className="text-sm text-gray-500">With Lead Time</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">{stats.itemsWithAnalytics}</div>
            <div className="text-sm text-gray-500">With Analytics</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-lg font-semibold text-gray-900">
              {formatPrice(stats.avgPrice, 'USD')}
            </div>
            <div className="text-sm text-gray-500">Average Price</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded">
            <div className="text-lg font-semibold text-gray-900">
              {stats.avgLeadTime.toFixed(1)} days
            </div>
            <div className="text-sm text-gray-500">Average Lead Time</div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="flex flex-wrap items-center space-x-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by</label>
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value as any)}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Items</option>
              <option value="high_variation">High Price Variation</option>
              <option value="unreliable">Unreliable Lead Times</option>
              <option value="no_data">Missing Data</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as any);
                setSortOrder(order as any);
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="price-asc">Price (Low-High)</option>
              <option value="price-desc">Price (High-Low)</option>
              <option value="leadTime-asc">Lead Time (Short-Long)</option>
              <option value="leadTime-desc">Lead Time (Long-Short)</option>
              <option value="reliability-desc">Reliability (High-Low)</option>
              <option value="reliability-asc">Reliability (Low-High)</option>
            </select>
          </div>
        </div>

        {showBulkUpdate && (
          <button
            onClick={handleBulkUpdatePricing}
            disabled={updatingPricing}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {updatingPricing ? 'Updating...' : 'Update Pricing from Quotes'}
          </button>
        )}
      </div>

      {/* Items List */}
      <div className="space-y-4">
        {filteredAndSortedItems.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
              <p className="mt-1 text-sm text-gray-500">
                Try adjusting your filters
              </p>
            </div>
          </div>
        ) : (
          filteredAndSortedItems.map((item) => (
            <div key={item.id} className="bg-white p-6 rounded-lg border border-gray-200">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="font-medium text-gray-900">{item.name}</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    {item.impaCode && (
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        IMPA: {item.impaCode}
                      </span>
                    )}
                    {item.issaCode && (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
                        ISSA: {item.issaCode}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">
                      {item.category.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatPrice(item.averagePrice, item.averagePriceCurrency)}
                  </div>
                  {item.leadTime && (
                    <div className="text-sm text-gray-500">
                      {item.leadTime} days lead time
                    </div>
                  )}
                </div>
              </div>

              {/* Analytics Data */}
              {item.analytics && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Pricing Trends */}
                  {item.analytics.pricingTrends && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-3">Pricing Trends</h5>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Recent Average:</span>
                          <span className="text-sm font-medium">
                            {formatPrice(item.analytics.pricingTrends.averageRecentPrice, item.averagePriceCurrency)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Price Variation:</span>
                          <span className={`text-sm font-medium px-2 py-1 rounded ${
                            getPriceVariationColor(
                              item.analytics.pricingTrends.priceVariation,
                              item.analytics.pricingTrends.averageRecentPrice
                            )
                          }`}>
                            {formatPrice(item.analytics.pricingTrends.priceVariation, item.averagePriceCurrency)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Data Points:</span>
                          <span className="text-sm font-medium">
                            {item.analytics.pricingTrends.dataPoints} quotes
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lead Time Trends */}
                  {item.analytics.leadTimeTrends && (
                    <div>
                      <h5 className="font-medium text-gray-900 mb-3">Lead Time Analysis</h5>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Estimated Lead Time:</span>
                          <span className="text-sm font-medium">
                            {item.analytics.leadTimeTrends.estimatedLeadTime} days
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Average Delay:</span>
                          <span className="text-sm font-medium">
                            {item.analytics.leadTimeTrends.averageDelay.toFixed(1)} days
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-600">Reliability:</span>
                          <span className={`text-sm font-medium px-2 py-1 rounded ${
                            getReliabilityColor(item.analytics.leadTimeTrends.reliability)
                          }`}>
                            {item.analytics.leadTimeTrends.reliability !== null
                              ? formatPercentage(item.analytics.leadTimeTrends.reliability)
                              : 'N/A'
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No Analytics Data */}
              {!item.analytics && (
                <div className="text-center py-4 text-gray-500">
                  <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm">No analytics data available</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PricingAnalytics;