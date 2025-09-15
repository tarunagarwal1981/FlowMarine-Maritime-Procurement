import React, { useState } from 'react';
import { useAdvancedSearch, SearchFilter, SearchSort } from './AdvancedSearchProvider';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { 
  Search, 
  Filter, 
  SortAsc, 
  SortDesc, 
  X, 
  Plus, 
  Save, 
  Download, 
  History,
  Bookmark,
  Settings
} from 'lucide-react';

interface AdvancedSearchInterfaceProps {
  availableFields: {
    field: string;
    label: string;
    type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean';
    options?: { value: string; label: string; }[];
  }[];
  placeholder?: string;
  showSaveSearch?: boolean;
  showExport?: boolean;
}

export const AdvancedSearchInterface: React.FC<AdvancedSearchInterfaceProps> = ({
  availableFields,
  placeholder = "Search...",
  showSaveSearch = true,
  showExport = true
}) => {
  const {
    searchState,
    updateQuery,
    addFilter,
    removeFilter,
    updateFilter,
    clearFilters,
    addSort,
    removeSort,
    clearSort,
    saveSearch,
    loadSearch,
    deleteSearch,
    clearSearch,
    exportResults
  } = useAdvancedSearch();

  const [showFilterDialog, setShowFilterDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [newFilter, setNewFilter] = useState<Partial<SearchFilter>>({
    field: '',
    operator: 'contains',
    value: '',
    type: 'text'
  });

  const handleAddFilter = () => {
    if (newFilter.field && newFilter.value !== undefined && newFilter.value !== '') {
      const field = availableFields.find(f => f.field === newFilter.field);
      if (field) {
        addFilter({
          id: `${newFilter.field}-${Date.now()}`,
          field: newFilter.field!,
          operator: newFilter.operator!,
          value: newFilter.value,
          label: field.label,
          type: field.type
        });
        setNewFilter({
          field: '',
          operator: 'contains',
          value: '',
          type: 'text'
        });
        setShowFilterDialog(false);
      }
    }
  };

  const handleSaveSearch = async () => {
    if (saveSearchName.trim()) {
      await saveSearch(saveSearchName.trim());
      setSaveSearchName('');
      setShowSaveDialog(false);
    }
  };

  const getOperatorOptions = (type: string) => {
    switch (type) {
      case 'text':
        return [
          { value: 'contains', label: 'Contains' },
          { value: 'equals', label: 'Equals' },
          { value: 'startsWith', label: 'Starts with' },
          { value: 'endsWith', label: 'Ends with' }
        ];
      case 'number':
      case 'date':
        return [
          { value: 'equals', label: 'Equals' },
          { value: 'greaterThan', label: 'Greater than' },
          { value: 'lessThan', label: 'Less than' },
          { value: 'between', label: 'Between' }
        ];
      case 'select':
      case 'multiselect':
        return [
          { value: 'in', label: 'Is one of' },
          { value: 'notIn', label: 'Is not one of' }
        ];
      case 'boolean':
        return [
          { value: 'equals', label: 'Is' }
        ];
      default:
        return [{ value: 'contains', label: 'Contains' }];
    }
  };

  const renderFilterValue = () => {
    const selectedField = availableFields.find(f => f.field === newFilter.field);
    if (!selectedField) return null;

    switch (selectedField.type) {
      case 'select':
        return (
          <Select
            value={newFilter.value}
            onValueChange={(value) => setNewFilter(prev => ({ ...prev, value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              {selectedField.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'boolean':
        return (
          <Select
            value={newFilter.value?.toString()}
            onValueChange={(value) => setNewFilter(prev => ({ ...prev, value: value === 'true' }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select value" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Yes</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        );
      case 'date':
        return (
          <Input
            type="date"
            value={newFilter.value}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={newFilter.value}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
            placeholder="Enter number"
          />
        );
      default:
        return (
          <Input
            value={newFilter.value}
            onChange={(e) => setNewFilter(prev => ({ ...prev, value: e.target.value }))}
            placeholder="Enter value"
          />
        );
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Advanced Search
          </CardTitle>
          <div className="flex items-center gap-2">
            {showSaveSearch && (
              <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Save Search
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Save Search</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="search-name">Search Name</Label>
                      <Input
                        id="search-name"
                        value={saveSearchName}
                        onChange={(e) => setSaveSearchName(e.target.value)}
                        placeholder="Enter search name"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveSearch}>
                        Save
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            
            {showExport && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48">
                  <div className="space-y-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => exportResults('csv')}
                    >
                      Export as CSV
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => exportResults('excel')}
                    >
                      Export as Excel
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start"
                      onClick={() => exportResults('pdf')}
                    >
                      Export as PDF
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchState.query}
            onChange={(e) => updateQuery(e.target.value)}
            placeholder={placeholder}
            className="pl-10"
          />
        </div>

        {/* Filters and Sort Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Add Filter
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Filter</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Field</Label>
                  <Select
                    value={newFilter.field}
                    onValueChange={(value) => {
                      const field = availableFields.find(f => f.field === value);
                      setNewFilter(prev => ({ 
                        ...prev, 
                        field: value, 
                        type: field?.type || 'text',
                        value: ''
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableFields.map(field => (
                        <SelectItem key={field.field} value={field.field}>
                          {field.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newFilter.field && (
                  <>
                    <div>
                      <Label>Operator</Label>
                      <Select
                        value={newFilter.operator}
                        onValueChange={(value) => setNewFilter(prev => ({ ...prev, operator: value as any }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {getOperatorOptions(newFilter.type || 'text').map(op => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Value</Label>
                      {renderFilterValue()}
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowFilterDialog(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddFilter}>
                    Add Filter
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {searchState.filters.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}

          {searchState.sort.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearSort}>
              Clear Sort
            </Button>
          )}

          <Button variant="outline" size="sm" onClick={clearSearch}>
            Clear All
          </Button>
        </div>

        {/* Active Filters */}
        {searchState.filters.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Active Filters:</Label>
            <div className="flex flex-wrap gap-2">
              {searchState.filters.map(filter => (
                <Badge key={filter.id} variant="secondary" className="flex items-center gap-1">
                  {filter.label} {filter.operator} {filter.value?.toString()}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => removeFilter(filter.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Active Sort */}
        {searchState.sort.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Sort Order:</Label>
            <div className="flex flex-wrap gap-2">
              {searchState.sort.map(sort => (
                <Badge key={sort.field} variant="outline" className="flex items-center gap-1">
                  {sort.direction === 'asc' ? (
                    <SortAsc className="h-3 w-3" />
                  ) : (
                    <SortDesc className="h-3 w-3" />
                  )}
                  {sort.label}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-transparent"
                    onClick={() => removeSort(sort.field)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Saved Searches */}
        {searchState.savedSearches.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Saved Searches:</Label>
            <div className="flex flex-wrap gap-2">
              {searchState.savedSearches.map(savedSearch => (
                <div key={savedSearch.id} className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadSearch(savedSearch.id)}
                    className="flex items-center gap-1"
                  >
                    <Bookmark className="h-3 w-3" />
                    {savedSearch.name}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => deleteSearch(savedSearch.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Searches */}
        {searchState.recentSearches.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Recent Searches:</Label>
            <div className="flex flex-wrap gap-2">
              {searchState.recentSearches.map((query, index) => (
                <Button
                  key={index}
                  variant="ghost"
                  size="sm"
                  onClick={() => updateQuery(query)}
                  className="flex items-center gap-1"
                >
                  <History className="h-3 w-3" />
                  {query}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Search Results Summary */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {searchState.isLoading ? (
              'Searching...'
            ) : (
              `${searchState.totalResults} results found`
            )}
          </span>
          {searchState.totalResults > 0 && (
            <span>
              Page {searchState.page} of {Math.ceil(searchState.totalResults / searchState.pageSize)}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
};