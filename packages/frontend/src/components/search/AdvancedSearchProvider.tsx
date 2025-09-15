import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { debounce } from 'lodash';

export interface SearchFilter {
  id: string;
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan' | 'between' | 'in' | 'notIn';
  value: any;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
}

export interface SearchSort {
  field: string;
  direction: 'asc' | 'desc';
  label: string;
}

export interface SearchState {
  query: string;
  filters: SearchFilter[];
  sort: SearchSort[];
  page: number;
  pageSize: number;
  totalResults: number;
  isLoading: boolean;
  results: any[];
  suggestions: string[];
  recentSearches: string[];
  savedSearches: SavedSearch[];
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  filters: SearchFilter[];
  sort: SearchSort[];
  module: string;
  createdAt: Date;
  isDefault?: boolean;
}

interface AdvancedSearchContextType {
  searchState: SearchState;
  updateQuery: (query: string) => void;
  addFilter: (filter: SearchFilter) => void;
  removeFilter: (filterId: string) => void;
  updateFilter: (filterId: string, updates: Partial<SearchFilter>) => void;
  clearFilters: () => void;
  addSort: (sort: SearchSort) => void;
  removeSort: (field: string) => void;
  clearSort: () => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  performSearch: () => Promise<void>;
  saveSearch: (name: string) => Promise<void>;
  loadSearch: (searchId: string) => void;
  deleteSearch: (searchId: string) => void;
  clearSearch: () => void;
  exportResults: (format: 'csv' | 'excel' | 'pdf') => Promise<void>;
}

const defaultSearchState: SearchState = {
  query: '',
  filters: [],
  sort: [],
  page: 1,
  pageSize: 25,
  totalResults: 0,
  isLoading: false,
  results: [],
  suggestions: [],
  recentSearches: [],
  savedSearches: []
};

const AdvancedSearchContext = createContext<AdvancedSearchContextType | undefined>(undefined);

export const useAdvancedSearch = () => {
  const context = useContext(AdvancedSearchContext);
  if (!context) {
    throw new Error('useAdvancedSearch must be used within AdvancedSearchProvider');
  }
  return context;
};

interface AdvancedSearchProviderProps {
  children: React.ReactNode;
  module: string;
  searchEndpoint: string;
  onSearchResults?: (results: any[]) => void;
}

export const AdvancedSearchProvider: React.FC<AdvancedSearchProviderProps> = ({
  children,
  module,
  searchEndpoint,
  onSearchResults
}) => {
  const [searchState, setSearchState] = useState<SearchState>(() => {
    const saved = localStorage.getItem(`search-state-${module}`);
    return saved ? { ...defaultSearchState, ...JSON.parse(saved) } : defaultSearchState;
  });

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchParams: Partial<SearchState>) => {
      setSearchState(prev => ({ ...prev, isLoading: true }));
      
      try {
        const response = await fetch(searchEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({
            query: searchParams.query,
            filters: searchParams.filters,
            sort: searchParams.sort,
            page: searchParams.page,
            pageSize: searchParams.pageSize
          })
        });

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        
        setSearchState(prev => ({
          ...prev,
          results: data.results,
          totalResults: data.total,
          suggestions: data.suggestions || [],
          isLoading: false
        }));

        if (onSearchResults) {
          onSearchResults(data.results);
        }

        // Add to recent searches if query is not empty
        if (searchParams.query && searchParams.query.trim()) {
          setSearchState(prev => ({
            ...prev,
            recentSearches: [
              searchParams.query!,
              ...prev.recentSearches.filter(q => q !== searchParams.query).slice(0, 9)
            ]
          }));
        }
      } catch (error) {
        console.error('Search error:', error);
        setSearchState(prev => ({ ...prev, isLoading: false }));
      }
    }, 300),
    [searchEndpoint, onSearchResults]
  );

  // Save search state to localStorage
  useEffect(() => {
    localStorage.setItem(`search-state-${module}`, JSON.stringify(searchState));
  }, [searchState, module]);

  // Load saved searches on mount
  useEffect(() => {
    const loadSavedSearches = async () => {
      try {
        const response = await fetch(`/api/search/saved?module=${module}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const savedSearches = await response.json();
          setSearchState(prev => ({ ...prev, savedSearches }));
        }
      } catch (error) {
        console.error('Failed to load saved searches:', error);
      }
    };

    loadSavedSearches();
  }, [module]);

  const updateQuery = (query: string) => {
    setSearchState(prev => ({ ...prev, query, page: 1 }));
  };

  const addFilter = (filter: SearchFilter) => {
    setSearchState(prev => ({
      ...prev,
      filters: [...prev.filters, filter],
      page: 1
    }));
  };

  const removeFilter = (filterId: string) => {
    setSearchState(prev => ({
      ...prev,
      filters: prev.filters.filter(f => f.id !== filterId),
      page: 1
    }));
  };

  const updateFilter = (filterId: string, updates: Partial<SearchFilter>) => {
    setSearchState(prev => ({
      ...prev,
      filters: prev.filters.map(f => 
        f.id === filterId ? { ...f, ...updates } : f
      ),
      page: 1
    }));
  };

  const clearFilters = () => {
    setSearchState(prev => ({ ...prev, filters: [], page: 1 }));
  };

  const addSort = (sort: SearchSort) => {
    setSearchState(prev => ({
      ...prev,
      sort: [sort, ...prev.sort.filter(s => s.field !== sort.field)]
    }));
  };

  const removeSort = (field: string) => {
    setSearchState(prev => ({
      ...prev,
      sort: prev.sort.filter(s => s.field !== field)
    }));
  };

  const clearSort = () => {
    setSearchState(prev => ({ ...prev, sort: [] }));
  };

  const setPage = (page: number) => {
    setSearchState(prev => ({ ...prev, page }));
  };

  const setPageSize = (pageSize: number) => {
    setSearchState(prev => ({ ...prev, pageSize, page: 1 }));
  };

  const performSearch = async () => {
    await debouncedSearch(searchState);
  };

  const saveSearch = async (name: string) => {
    try {
      const response = await fetch('/api/search/saved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          name,
          query: searchState.query,
          filters: searchState.filters,
          sort: searchState.sort,
          module
        })
      });

      if (response.ok) {
        const savedSearch = await response.json();
        setSearchState(prev => ({
          ...prev,
          savedSearches: [...prev.savedSearches, savedSearch]
        }));
      }
    } catch (error) {
      console.error('Failed to save search:', error);
    }
  };

  const loadSearch = (searchId: string) => {
    const savedSearch = searchState.savedSearches.find(s => s.id === searchId);
    if (savedSearch) {
      setSearchState(prev => ({
        ...prev,
        query: savedSearch.query,
        filters: savedSearch.filters,
        sort: savedSearch.sort,
        page: 1
      }));
    }
  };

  const deleteSearch = async (searchId: string) => {
    try {
      const response = await fetch(`/api/search/saved/${searchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setSearchState(prev => ({
          ...prev,
          savedSearches: prev.savedSearches.filter(s => s.id !== searchId)
        }));
      }
    } catch (error) {
      console.error('Failed to delete search:', error);
    }
  };

  const clearSearch = () => {
    setSearchState(prev => ({
      ...prev,
      query: '',
      filters: [],
      sort: [],
      page: 1,
      results: [],
      totalResults: 0
    }));
  };

  const exportResults = async (format: 'csv' | 'excel' | 'pdf') => {
    try {
      const response = await fetch(`${searchEndpoint}/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          query: searchState.query,
          filters: searchState.filters,
          sort: searchState.sort,
          format
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `search-results.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Failed to export results:', error);
    }
  };

  // Trigger search when search parameters change
  useEffect(() => {
    if (searchState.query || searchState.filters.length > 0) {
      debouncedSearch(searchState);
    }
  }, [searchState.query, searchState.filters, searchState.sort, searchState.page, searchState.pageSize, debouncedSearch]);

  return (
    <AdvancedSearchContext.Provider
      value={{
        searchState,
        updateQuery,
        addFilter,
        removeFilter,
        updateFilter,
        clearFilters,
        addSort,
        removeSort,
        clearSort,
        setPage,
        setPageSize,
        performSearch,
        saveSearch,
        loadSearch,
        deleteSearch,
        clearSearch,
        exportResults
      }}
    >
      {children}
    </AdvancedSearchContext.Provider>
  );
};