import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { debounce } from 'lodash';

interface ItemCatalogItem {
  id: string;
  name: string;
  impaCode?: string;
  issaCode?: string;
  category: string;
  criticalityLevel: 'SAFETY_CRITICAL' | 'OPERATIONAL_CRITICAL' | 'ROUTINE';
  averagePrice?: number;
  averagePriceCurrency?: string;
  leadTime?: number;
  unitOfMeasure: string;
  description?: string;
  specifications?: Record<string, any>;
  compatibleVesselTypes: string[];
  compatibleEngineTypes: string[];
}

interface AutocompleteSuggestion {
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
  matchedField: string;
  matchedValue: string;
  relevanceScore: number;
}

interface SearchFilters {
  search?: string;
  category?: string;
  criticalityLevel?: string;
  vesselType?: string;
  engineType?: string;
  minPrice?: number;
  maxPrice?: number;
  maxLeadTime?: number;
}

interface ItemCatalogSearchProps {
  onItemSelect?: (item: ItemCatalogItem) => void;
  onItemsChange?: (items: ItemCatalogItem[]) => void;
  vesselType?: string;
  engineType?: string;
  multiSelect?: boolean;
  selectedItems?: ItemCatalogItem[];
  placeholder?: string;
  showPricingAnalytics?: boolean;
}

const MARITIME_CATEGORIES = [
  'ENGINE_PARTS',
  'DECK_EQUIPMENT', 
  'SAFETY_GEAR',
  'NAVIGATION',
  'ELECTRICAL',
  'CATERING',
  'MAINTENANCE'
];

const CRITICALITY_LEVELS = [
  'SAFETY_CRITICAL',
  'OPERATIONAL_CRITICAL',
  'ROUTINE'
];

export const ItemCatalogSearch: React.FC<ItemCatalogSearchProps> = ({
  onItemSelect,
  onItemsChange,
  vesselType,
  engineType,
  multiSelect = false,
  selectedItems = [],
  placeholder = "Search items by name, IMPA code, or ISSA code...",
  showPricingAnalytics = false
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [items, setItems] = useState<ItemCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Debounced autocomplete function
  const debouncedGetSuggestions = useCallback(
    debounce(async (query: string) => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        const params = new URLSearchParams({
          query,
          field: 'all',
          limit: '10'
        });

        if (filters.category) params.append('category', filters.category);
        if (filters.criticalityLevel) params.append('criticalityLevel', filters.criticalityLevel);
        if (vesselType) params.append('vesselType', vesselType);
        if (engineType) params.append('engineType', engineType);

        const response = await fetch(`/api/item-catalog/autocomplete/advanced?${params}`);
        const data = await response.json();

        if (data.success) {
          setSuggestions(data.data);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
      }
    }, 300),
    [filters, vesselType, engineType]
  );

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchFilters: SearchFilters) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        
        Object.entries(searchFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            params.append(key, value.toString());
          }
        });

        if (vesselType) params.append('vesselType', vesselType);
        if (engineType) params.append('engineType', engineType);

        const endpoint = showPricingAnalytics 
          ? '/api/item-catalog/search/analytics'
          : '/api/item-catalog/search';

        if (showPricingAnalytics) {
          params.append('includePricingTrends', 'true');
          params.append('includeLeadTimeTrends', 'true');
        }

        const response = await fetch(`${endpoint}?${params}`);
        const data = await response.json();

        if (data.success) {
          setItems(data.data);
          onItemsChange?.(data.data);
        }
      } catch (error) {
        console.error('Error searching items:', error);
      } finally {
        setLoading(false);
      }
    }, 500),
    [vesselType, engineType, showPricingAnalytics, onItemsChange]
  );

  // Effect for autocomplete
  useEffect(() => {
    if (searchQuery) {
      debouncedGetSuggestions(searchQuery);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery, debouncedGetSuggestions]);

  // Effect for search
  useEffect(() => {
    const searchFilters = { ...filters };
    if (searchQuery && !showSuggestions) {
      searchFilters.search = searchQuery;
    }
    debouncedSearch(searchFilters);
  }, [filters, searchQuery, showSuggestions, debouncedSearch]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setSelectedSuggestionIndex(-1);
    
    // Clear suggestions if query is too short
    if (value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion: AutocompleteSuggestion) => {
    setSearchQuery(suggestion.matchedValue);
    setShowSuggestions(false);
    
    // Create item object from suggestion data
    const itemFromSuggestion: ItemCatalogItem = {
      id: suggestion.id,
      name: suggestion.name,
      impaCode: suggestion.impaCode,
      issaCode: suggestion.issaCode,
      category: suggestion.category,
      criticalityLevel: suggestion.criticalityLevel as any,
      averagePrice: suggestion.averagePrice,
      averagePriceCurrency: suggestion.averagePriceCurrency,
      leadTime: suggestion.leadTime,
      unitOfMeasure: suggestion.unitOfMeasure,
      compatibleVesselTypes: [],
      compatibleEngineTypes: []
    };
    
    if (onItemSelect) {
      onItemSelect(itemFromSuggestion);
    }
    
    // Trigger search to get full results
    const searchFilters = { ...filters, search: suggestion.matchedValue };
    debouncedSearch(searchFilters);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          handleSuggestionClick(suggestions[selectedSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  const handleFilterChange = (key: keyof SearchFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === '' ? undefined : value
    }));
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

  const formatPrice = (price?: number, currency?: string) => {
    if (!price) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(price);
  };

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200">$1</mark>');
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder={placeholder}
            className="w-full px-4 py-3 pl-10 pr-12 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
            </svg>
          </button>
        </div>

        {/* Autocomplete Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.id}
                onClick={() => handleSuggestionClick(suggestion)}
                className={`px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-b-0 ${
                  index === selectedSuggestionIndex ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-sm text-gray-900">
                      <span dangerouslySetInnerHTML={{
                        __html: highlightMatch(suggestion.name, searchQuery)
                      }} />
                    </div>
                    <div className="flex items-center space-x-2 mt-1">
                      {suggestion.impaCode && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                          IMPA: {suggestion.impaCode}
                        </span>
                      )}
                      {suggestion.issaCode && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                          ISSA: {suggestion.issaCode}
                        </span>
                      )}
                      <span className={`text-xs px-2 py-1 rounded ${getCriticalityColor(suggestion.criticalityLevel)}`}>
                        {suggestion.criticalityLevel.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    {suggestion.averagePrice && (
                      <div className="text-sm font-medium text-gray-900">
                        {formatPrice(suggestion.averagePrice, suggestion.averagePriceCurrency)}
                      </div>
                    )}
                    {suggestion.leadTime && (
                      <div className="text-xs text-gray-500">
                        {suggestion.leadTime} days
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={filters.category || ''}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {MARITIME_CATEGORIES.map(category => (
                  <option key={category} value={category}>
                    {category.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Criticality</label>
              <select
                value={filters.criticalityLevel || ''}
                onChange={(e) => handleFilterChange('criticalityLevel', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Levels</option>
                {CRITICALITY_LEVELS.map(level => (
                  <option key={level} value={level}>
                    {level.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Price</label>
              <input
                type="number"
                value={filters.maxPrice || ''}
                onChange={(e) => handleFilterChange('maxPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Enter max price"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Lead Time (days)</label>
              <input
                type="number"
                value={filters.maxLeadTime || ''}
                onChange={(e) => handleFilterChange('maxLeadTime', e.target.value ? parseInt(e.target.value) : undefined)}
                placeholder="Enter max days"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="mt-4 flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Searching items...</span>
        </div>
      )}

      {/* Search Results */}
      {!loading && items.length > 0 && (
        <div className="mt-4">
          <div className="text-sm text-gray-600 mb-3">
            Found {items.length} items
          </div>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => onItemSelect?.(item)}
                className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md cursor-pointer transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-medium text-gray-900">{item.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded ${getCriticalityColor(item.criticalityLevel)}`}>
                        {item.criticalityLevel.replace('_', ' ')}
                      </span>
                    </div>
                    
                    {item.description && (
                      <p className="text-sm text-gray-600 mb-2">{item.description}</p>
                    )}

                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      {item.impaCode && (
                        <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          IMPA: {item.impaCode}
                        </span>
                      )}
                      {item.issaCode && (
                        <span className="bg-green-50 text-green-700 px-2 py-1 rounded">
                          ISSA: {item.issaCode}
                        </span>
                      )}
                      <span>Category: {item.category.replace('_', ' ')}</span>
                      <span>Unit: {item.unitOfMeasure}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    {item.averagePrice && (
                      <div className="text-lg font-semibold text-gray-900">
                        {formatPrice(item.averagePrice, item.averagePriceCurrency)}
                      </div>
                    )}
                    {item.leadTime && (
                      <div className="text-sm text-gray-500">
                        Lead time: {item.leadTime} days
                      </div>
                    )}
                  </div>
                </div>

                {/* Vessel Compatibility */}
                {(vesselType || engineType) && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center space-x-4 text-xs">
                      {vesselType && (
                        <span className={`px-2 py-1 rounded ${
                          item.compatibleVesselTypes.length === 0 || item.compatibleVesselTypes.includes(vesselType)
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          Vessel: {item.compatibleVesselTypes.length === 0 || item.compatibleVesselTypes.includes(vesselType) ? 'Compatible' : 'Not Compatible'}
                        </span>
                      )}
                      {engineType && (
                        <span className={`px-2 py-1 rounded ${
                          item.compatibleEngineTypes.length === 0 || item.compatibleEngineTypes.includes(engineType)
                            ? 'bg-green-50 text-green-700'
                            : 'bg-red-50 text-red-700'
                        }`}>
                          Engine: {item.compatibleEngineTypes.length === 0 || item.compatibleEngineTypes.includes(engineType) ? 'Compatible' : 'Not Compatible'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && searchQuery && items.length === 0 && (
        <div className="mt-4 text-center py-8">
          <div className="text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No items found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search terms or filters
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemCatalogSearch;