/**
 * Advanced Filters Component
 * Comprehensive filtering system with date ranges, multi-select, presets, and advanced combinations
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { 
  selectCurrentConfiguration,
  updateFilters,
  applyFilterPreset,
  selectFilterPresets,
  saveFilterState,
  restoreFilterState,
  selectFilterHistory,
  selectQuickAccessPresets,
  addToQuickAccess,
  removeFromQuickAccess,
  updateFilterCombination
} from '../../store/slices/dashboardSlice';
import { selectVessels } from '../../store/slices/authSlice';
import { DashboardFilters, FilterState, FilterCombination } from '../../types/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Checkbox } from '../ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  Filter,
  Calendar as CalendarIcon,
  X,
  Save,
  RotateCcw,
  ChevronDown,
  Search,
  Bookmark,
  History,
  Star,
  Plus,
  Minus,
  Settings,
  Share,
  Copy,
  Clock,
  Zap,
  Layers,
  MoreHorizontal,
} from 'lucide-react';
import { format, subDays, subMonths, subYears, startOfDay, endOfDay } from 'date-fns';
import { cn } from '../../utils/cn';

interface AdvancedFiltersProps {
  layoutType: 'executive' | 'operational' | 'financial';
  onFiltersChange?: (filters: DashboardFilters) => void;
  className?: string;
}

// Mock data for filter options
const CATEGORIES = [
  'Engine Parts',
  'Deck Equipment',
  'Safety Gear',
  'Navigation',
  'Catering',
  'Maintenance',
  'Electronics',
  'Fuel & Lubricants',
];

const VENDORS = [
  'Maritime Supply Co.',
  'Ocean Parts Ltd.',
  'Ship Services Inc.',
  'Marine Equipment Corp.',
  'Nautical Solutions',
  'Port Supply Chain',
];

const URGENCY_LEVELS = [
  { value: 'ROUTINE', label: 'Routine' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'EMERGENCY', label: 'Emergency' },
];

const STATUS_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'COMPLETED', label: 'Completed' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD'];

const QUICK_DATE_RANGES = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'Last 7 days', value: 'last_7_days' },
  { label: 'Last 30 days', value: 'last_30_days' },
  { label: 'Last 3 months', value: 'last_3_months' },
  { label: 'Last 6 months', value: 'last_6_months' },
  { label: 'Last year', value: 'last_year' },
  { label: 'Year to date', value: 'ytd' },
];

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  layoutType,
  onFiltersChange,
  className,
}) => {
  const dispatch = useAppDispatch();
  const currentConfiguration = useAppSelector(selectCurrentConfiguration);
  const vessels = useAppSelector(selectVessels);
  const filterPresets = useAppSelector(selectFilterPresets);

  const currentFilters = currentConfiguration?.customLayouts[layoutType]?.filters || {
    timeRange: 'monthly',
    vessels: [],
    categories: [],
    vendors: [],
    currency: 'USD',
    urgencyLevel: [],
    status: [],
  };

  const [localFilters, setLocalFilters] = useState<DashboardFilters>(currentFilters);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Update local filters when current filters change
  useEffect(() => {
    setLocalFilters(currentFilters);
  }, [currentFilters]);

  // Handle filter changes
  const handleFilterChange = useCallback((field: keyof DashboardFilters, value: any) => {
    const newFilters = { ...localFilters, [field]: value };
    setLocalFilters(newFilters);
    
    // Apply filters immediately
    dispatch(updateFilters({
      layoutType,
      filters: { [field]: value },
    }));
    
    onFiltersChange?.(newFilters);
  }, [localFilters, layoutType, dispatch, onFiltersChange]);

  // Handle multi-select changes
  const handleMultiSelectChange = useCallback((field: keyof DashboardFilters, value: string, checked: boolean) => {
    const currentValues = (localFilters[field] as string[]) || [];
    const newValues = checked
      ? [...currentValues, value]
      : currentValues.filter(v => v !== value);
    
    handleFilterChange(field, newValues);
  }, [localFilters, handleFilterChange]);

  // Handle quick date range selection
  const handleQuickDateRange = useCallback((range: string) => {
    const today = new Date();
    let from: Date;
    let to: Date = endOfDay(today);

    switch (range) {
      case 'today':
        from = startOfDay(today);
        break;
      case 'yesterday':
        from = startOfDay(subDays(today, 1));
        to = endOfDay(subDays(today, 1));
        break;
      case 'last_7_days':
        from = startOfDay(subDays(today, 7));
        break;
      case 'last_30_days':
        from = startOfDay(subDays(today, 30));
        break;
      case 'last_3_months':
        from = startOfDay(subMonths(today, 3));
        break;
      case 'last_6_months':
        from = startOfDay(subMonths(today, 6));
        break;
      case 'last_year':
        from = startOfDay(subYears(today, 1));
        break;
      case 'ytd':
        from = new Date(today.getFullYear(), 0, 1);
        break;
      default:
        return;
    }

    setDateRange({ from, to });
    handleFilterChange('dateFrom', from);
    handleFilterChange('dateTo', to);
    handleFilterChange('timeRange', 'custom');
  }, [handleFilterChange]);

  // Handle custom date range
  const handleCustomDateRange = useCallback((range: { from?: Date; to?: Date }) => {
    setDateRange(range);
    if (range.from) {
      handleFilterChange('dateFrom', range.from);
    }
    if (range.to) {
      handleFilterChange('dateTo', range.to);
    }
    if (range.from || range.to) {
      handleFilterChange('timeRange', 'custom');
    }
  }, [handleFilterChange]);

  // Reset filters
  const handleResetFilters = useCallback(() => {
    const defaultFilters: DashboardFilters = {
      timeRange: 'monthly',
      vessels: [],
      categories: [],
      vendors: [],
      currency: 'USD',
      urgencyLevel: [],
      status: [],
    };
    
    setLocalFilters(defaultFilters);
    setDateRange({});
    
    dispatch(updateFilters({
      layoutType,
      filters: defaultFilters,
    }));
    
    onFiltersChange?.(defaultFilters);
  }, [layoutType, dispatch, onFiltersChange]);

  // Apply filter preset
  const handleApplyPreset = useCallback((presetId: string) => {
    dispatch(applyFilterPreset({
      presetId,
      layoutType,
    }));
  }, [dispatch, layoutType]);

  // Get active filter count
  const getActiveFilterCount = () => {
    let count = 0;
    if (localFilters.vessels?.length) count++;
    if (localFilters.categories?.length) count++;
    if (localFilters.vendors?.length) count++;
    if (localFilters.urgencyLevel?.length) count++;
    if (localFilters.status?.length) count++;
    if (localFilters.timeRange === 'custom') count++;
    return count;
  };

  const activeFilterCount = getActiveFilterCount();

  return (
    <Card className={cn("advanced-filters", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Filter presets */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Bookmark className="h-4 w-4" />
                  Presets
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {filterPresets.map((preset) => (
                  <DropdownMenuItem
                    key={preset.id}
                    onClick={() => handleApplyPreset(preset.id)}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{preset.name}</span>
                      {preset.description && (
                        <span className="text-xs text-muted-foreground">
                          {preset.description}
                        </span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
                {filterPresets.length === 0 && (
                  <DropdownMenuItem disabled>
                    No presets available
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <Save className="h-4 w-4 mr-2" />
                  Save Current Filters
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Reset filters */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              disabled={activeFilterCount === 0}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Time Range */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Time Range</Label>
          <div className="flex gap-2">
            <Select
              value={localFilters.timeRange}
              onValueChange={(value) => handleFilterChange('timeRange', value)}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {/* Quick date ranges */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Quick
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {QUICK_DATE_RANGES.map((range) => (
                  <DropdownMenuItem
                    key={range.value}
                    onClick={() => handleQuickDateRange(range.value)}
                  >
                    {range.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Custom date range picker */}
          {localFilters.timeRange === 'custom' && (
            <div className="flex gap-2">
              <Popover open={showDatePicker} onOpenChange={setShowDatePicker}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} -{" "}
                          {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick a date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange.from}
                    selected={dateRange}
                    onSelect={handleCustomDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>

        <Separator />

        {/* Vessels */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Vessels</Label>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vessels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <ScrollArea className="h-32 border rounded-md p-2">
              <div className="space-y-2">
                {vessels
                  .filter(vessel => 
                    vessel.name.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((vessel) => (
                    <div key={vessel.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`vessel-${vessel.id}`}
                        checked={localFilters.vessels?.includes(vessel.id) || false}
                        onCheckedChange={(checked) =>
                          handleMultiSelectChange('vessels', vessel.id, checked as boolean)
                        }
                      />
                      <Label
                        htmlFor={`vessel-${vessel.id}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {vessel.name}
                      </Label>
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>
        </div>

        <Separator />

        {/* Categories */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Categories</Label>
          <ScrollArea className="h-32 border rounded-md p-2">
            <div className="space-y-2">
              {CATEGORIES.map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={`category-${category}`}
                    checked={localFilters.categories?.includes(category) || false}
                    onCheckedChange={(checked) =>
                      handleMultiSelectChange('categories', category, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={`category-${category}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Vendors */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Vendors</Label>
          <ScrollArea className="h-32 border rounded-md p-2">
            <div className="space-y-2">
              {VENDORS.map((vendor) => (
                <div key={vendor} className="flex items-center space-x-2">
                  <Checkbox
                    id={`vendor-${vendor}`}
                    checked={localFilters.vendors?.includes(vendor) || false}
                    onCheckedChange={(checked) =>
                      handleMultiSelectChange('vendors', vendor, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={`vendor-${vendor}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {vendor}
                  </Label>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <Separator />

        {/* Currency */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Currency</Label>
          <Select
            value={localFilters.currency || 'USD'}
            onValueChange={(value) => handleFilterChange('currency', value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Urgency Level */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Urgency Level</Label>
          <div className="space-y-2">
            {URGENCY_LEVELS.map((level) => (
              <div key={level.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`urgency-${level.value}`}
                  checked={localFilters.urgencyLevel?.includes(level.value) || false}
                  onCheckedChange={(checked) =>
                    handleMultiSelectChange('urgencyLevel', level.value, checked as boolean)
                  }
                />
                <Label
                  htmlFor={`urgency-${level.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {level.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Status */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Status</Label>
          <div className="space-y-2">
            {STATUS_OPTIONS.map((status) => (
              <div key={status.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${status.value}`}
                  checked={localFilters.status?.includes(status.value) || false}
                  onCheckedChange={(checked) =>
                    handleMultiSelectChange('status', status.value, checked as boolean)
                  }
                />
                <Label
                  htmlFor={`status-${status.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {status.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default AdvancedFilters;