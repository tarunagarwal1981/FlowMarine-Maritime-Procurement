import React, { useState, useEffect } from 'react';
import ItemCatalogSearch from './ItemCatalogSearch';
import ItemSpecificationManager from './ItemSpecificationManager';
import PricingAnalytics from './PricingAnalytics';
import SearchAnalytics from './SearchAnalytics';

interface CatalogItem {
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
  description?: string;
  specifications?: Record<string, any>;
  compatibleVesselTypes: string[];
  compatibleEngineTypes: string[];
  analytics?: any;
}

interface CatalogManagementProps {
  vesselType?: string;
  engineType?: string;
  mode?: 'search' | 'analytics' | 'specifications';
  onItemSelect?: (item: CatalogItem) => void;
}

export const CatalogManagement: React.FC<CatalogManagementProps> = ({
  vesselType,
  engineType,
  mode = 'search',
  onItemSelect
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'analytics' | 'specifications'>(mode);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [searchResults, setSearchResults] = useState<CatalogItem[]>([]);
  const [analyticsData, setAnalyticsData] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Load analytics data when switching to analytics tab
  useEffect(() => {
    if (activeTab === 'analytics' && analyticsData.length === 0) {
      loadAnalyticsData();
    }
  }, [activeTab]);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        includePricingTrends: 'true',
        includeLeadTimeTrends: 'true',
        limit: '100'
      });

      if (vesselType) params.append('vesselType', vesselType);
      if (engineType) params.append('engineType', engineType);

      const response = await fetch(`/api/item-catalog/search/analytics?${params}`);
      const data = await response.json();

      if (data.success) {
        setAnalyticsData(data.data);
      }
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemSelect = (item: CatalogItem) => {
    setSelectedItem(item);
    onItemSelect?.(item);
    
    // If in specifications mode, switch to that tab
    if (activeTab === 'search') {
      setActiveTab('specifications');
    }
  };

  const handleSearchResultsChange = (items: CatalogItem[]) => {
    setSearchResults(items);
  };

  const handleSpecificationsUpdate = (specifications: Record<string, any>) => {
    if (selectedItem) {
      setSelectedItem({
        ...selectedItem,
        specifications
      });
    }
  };

  const handleBulkUpdatePricing = () => {
    // Reload analytics data after bulk update
    loadAnalyticsData();
  };

  const tabs = [
    { id: 'search', name: 'Search & Browse', icon: 'search' },
    { id: 'analytics', name: 'Pricing Analytics', icon: 'chart' },
    { id: 'insights', name: 'Search Analytics', icon: 'analytics' },
    { id: 'specifications', name: 'Specifications', icon: 'document' }
  ];

  const getTabIcon = (iconType: string) => {
    switch (iconType) {
      case 'search':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        );
      case 'chart':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        );
      case 'analytics':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case 'document':
        return (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Item Catalog Management</h1>
        <p className="mt-2 text-gray-600">
          Search, analyze, and manage maritime item catalog with pricing analytics and specifications
        </p>
        
        {(vesselType || engineType) && (
          <div className="mt-4 flex items-center space-x-4 text-sm">
            {vesselType && (
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">
                Vessel Type: {vesselType}
              </span>
            )}
            {engineType && (
              <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full">
                Engine Type: {engineType}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-8">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {getTabIcon(tab.icon)}
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-8">
        {activeTab === 'search' && (
          <div>
            <ItemCatalogSearch
              onItemSelect={handleItemSelect}
              onItemsChange={handleSearchResultsChange}
              vesselType={vesselType}
              engineType={engineType}
              placeholder="Search items by name, IMPA code, ISSA code, or description..."
            />
          </div>
        )}

        {activeTab === 'analytics' && (
          <div>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-2 text-gray-600">Loading analytics data...</span>
              </div>
            ) : (
              <PricingAnalytics
                items={analyticsData}
                onBulkUpdatePricing={handleBulkUpdatePricing}
                showBulkUpdate={true}
              />
            )}
          </div>
        )}

        {activeTab === 'insights' && (
          <div>
            <SearchAnalytics
              vesselType={vesselType}
              engineType={engineType}
            />
          </div>
        )}

        {activeTab === 'specifications' && (
          <div>
            {selectedItem ? (
              <div className="space-y-6">
                {/* Selected Item Header */}
                <div className="bg-white p-6 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-xl font-semibold text-gray-900">{selectedItem.name}</h2>
                      <div className="flex items-center space-x-2 mt-2">
                        {selectedItem.impaCode && (
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-sm">
                            IMPA: {selectedItem.impaCode}
                          </span>
                        )}
                        {selectedItem.issaCode && (
                          <span className="bg-green-50 text-green-700 px-2 py-1 rounded text-sm">
                            ISSA: {selectedItem.issaCode}
                          </span>
                        )}
                        <span className="text-sm text-gray-500">
                          Category: {selectedItem.category.replace('_', ' ')}
                        </span>
                      </div>
                      {selectedItem.description && (
                        <p className="mt-2 text-gray-600">{selectedItem.description}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedItem(null)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Specifications Manager */}
                <ItemSpecificationManager
                  itemId={selectedItem.id}
                  category={selectedItem.category}
                  currentSpecifications={selectedItem.specifications}
                  onSpecificationsUpdate={handleSpecificationsUpdate}
                />
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-500">
                  <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No item selected</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Select an item from the search tab to view and edit its specifications
                  </p>
                  <button
                    onClick={() => setActiveTab('search')}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Go to Search
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Stats Footer */}
      {searchResults.length > 0 && activeTab === 'search' && (
        <div className="mt-8 bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Search Results: {searchResults.length} items</span>
            <div className="flex items-center space-x-4">
              <span>
                With Pricing: {searchResults.filter(item => item.averagePrice).length}
              </span>
              <span>
                With Lead Time: {searchResults.filter(item => item.leadTime).length}
              </span>
              <span>
                Safety Critical: {searchResults.filter(item => item.criticalityLevel === 'SAFETY_CRITICAL').length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogManagement;