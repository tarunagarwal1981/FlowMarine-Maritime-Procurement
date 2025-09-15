import React, {useState, useCallback, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

export interface FilterOption {
  key: string;
  label: string;
  type: 'select' | 'multiselect' | 'range' | 'date' | 'toggle';
  options?: Array<{value: string; label: string}>;
  min?: number;
  max?: number;
  value?: any;
}

export interface SearchFilterState {
  searchQuery: string;
  filters: Record<string, any>;
}

interface MobileSearchFilterProps {
  searchPlaceholder?: string;
  filterOptions?: FilterOption[];
  onSearchChange: (query: string) => void;
  onFiltersChange: (filters: Record<string, any>) => void;
  initialState?: SearchFilterState;
  showFilterCount?: boolean;
  clearable?: boolean;
}

const MobileSearchFilter: React.FC<MobileSearchFilterProps> = ({
  searchPlaceholder = 'Search...',
  filterOptions = [],
  onSearchChange,
  onFiltersChange,
  initialState,
  showFilterCount = true,
  clearable = true,
}) => {
  const [searchQuery, setSearchQuery] = useState(initialState?.searchQuery || '');
  const [filters, setFilters] = useState<Record<string, any>>(initialState?.filters || {});
  const [showFilters, setShowFilters] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  
  const searchInputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(screenHeight)).current;

  // Count active filters
  const activeFilterCount = Object.keys(filters).filter(key => {
    const value = filters[key];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => v !== null && v !== undefined && v !== '');
    }
    return value !== null && value !== undefined && value !== '';
  }).length;

  useEffect(() => {
    onSearchChange(searchQuery);
  }, [searchQuery, onSearchChange]);

  useEffect(() => {
    onFiltersChange(filters);
  }, [filters, onFiltersChange]);

  const handleSearchChange = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  const handleFilterChange = useCallback((key: string, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    searchInputRef.current?.blur();
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
  }, []);

  const openFilters = useCallback(() => {
    setShowFilters(true);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [slideAnim]);

  const closeFilters = useCallback(() => {
    Animated.spring(slideAnim, {
      toValue: screenHeight,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start(() => {
      setShowFilters(false);
    });
  }, [slideAnim]);

  const renderFilterOption = (option: FilterOption) => {
    const value = filters[option.key];

    switch (option.type) {
      case 'select':
        return (
          <View key={option.key} style={styles.filterOption}>
            <Text style={styles.filterLabel}>{option.label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.selectOptions}>
                {option.options?.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.selectOption,
                      value === opt.value && styles.selectedOption,
                    ]}
                    onPress={() => handleFilterChange(option.key, opt.value)}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        value === opt.value && styles.selectedOptionText,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        );

      case 'multiselect':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <View key={option.key} style={styles.filterOption}>
            <Text style={styles.filterLabel}>{option.label}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.selectOptions}>
                {option.options?.map((opt) => {
                  const isSelected = selectedValues.includes(opt.value);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.selectOption,
                        isSelected && styles.selectedOption,
                      ]}
                      onPress={() => {
                        const newValues = isSelected
                          ? selectedValues.filter(v => v !== opt.value)
                          : [...selectedValues, opt.value];
                        handleFilterChange(option.key, newValues);
                      }}
                    >
                      <Text
                        style={[
                          styles.selectOptionText,
                          isSelected && styles.selectedOptionText,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {isSelected && (
                        <Icon name="check" size={16} color="#ffffff" style={styles.checkIcon} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        );

      case 'range':
        const rangeValue = value || { min: option.min, max: option.max };
        return (
          <View key={option.key} style={styles.filterOption}>
            <Text style={styles.filterLabel}>{option.label}</Text>
            <View style={styles.rangeInputs}>
              <TextInput
                style={styles.rangeInput}
                placeholder="Min"
                value={rangeValue.min?.toString() || ''}
                onChangeText={(text) => {
                  const numValue = parseFloat(text) || option.min;
                  handleFilterChange(option.key, { ...rangeValue, min: numValue });
                }}
                keyboardType="numeric"
              />
              <Text style={styles.rangeSeparator}>to</Text>
              <TextInput
                style={styles.rangeInput}
                placeholder="Max"
                value={rangeValue.max?.toString() || ''}
                onChangeText={(text) => {
                  const numValue = parseFloat(text) || option.max;
                  handleFilterChange(option.key, { ...rangeValue, max: numValue });
                }}
                keyboardType="numeric"
              />
            </View>
          </View>
        );

      case 'toggle':
        return (
          <View key={option.key} style={styles.filterOption}>
            <TouchableOpacity
              style={styles.toggleOption}
              onPress={() => handleFilterChange(option.key, !value)}
            >
              <Text style={styles.filterLabel}>{option.label}</Text>
              <View style={[styles.toggle, value && styles.toggleActive]}>
                <View style={[styles.toggleThumb, value && styles.toggleThumbActive]} />
              </View>
            </TouchableOpacity>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={[styles.searchContainer, searchFocused && styles.searchFocused]}>
        <Icon name="search" size={20} color="#64748b" style={styles.searchIcon} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          placeholder={searchPlaceholder}
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={handleSearchChange}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        
        {searchQuery.length > 0 && clearable && (
          <TouchableOpacity onPress={clearSearch} style={styles.clearButton}>
            <Icon name="close" size={20} color="#64748b" />
          </TouchableOpacity>
        )}
        
        {filterOptions.length > 0 && (
          <TouchableOpacity onPress={openFilters} style={styles.filterButton}>
            <Icon name="filter-list" size={20} color="#1e40af" />
            {showFilterCount && activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.activeFiltersContainer}
        >
          <View style={styles.activeFilters}>
            {Object.entries(filters).map(([key, value]) => {
              if (!value || (Array.isArray(value) && value.length === 0)) return null;
              
              const option = filterOptions.find(opt => opt.key === key);
              if (!option) return null;

              let displayValue = '';
              if (option.type === 'multiselect' && Array.isArray(value)) {
                displayValue = `${value.length} selected`;
              } else if (option.type === 'range' && typeof value === 'object') {
                displayValue = `${value.min || 0} - ${value.max || 0}`;
              } else if (option.type === 'select') {
                const selectedOption = option.options?.find(opt => opt.value === value);
                displayValue = selectedOption?.label || value;
              } else {
                displayValue = value.toString();
              }

              return (
                <View key={key} style={styles.activeFilter}>
                  <Text style={styles.activeFilterText}>
                    {option.label}: {displayValue}
                  </Text>
                  <TouchableOpacity
                    onPress={() => handleFilterChange(key, null)}
                    style={styles.removeFilterButton}
                  >
                    <Icon name="close" size={14} color="#64748b" />
                  </TouchableOpacity>
                </View>
              );
            })}
            
            {clearable && (
              <TouchableOpacity onPress={clearAllFilters} style={styles.clearAllButton}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilters}
        transparent
        animationType="none"
        onRequestClose={closeFilters}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeFilters}
          />
          <Animated.View
            style={[
              styles.filterModal,
              { transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              <TouchableOpacity onPress={closeFilters} style={styles.closeButton}>
                <Icon name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.filterContent}>
              {filterOptions.map(renderFilterOption)}
            </ScrollView>
            
            <View style={styles.filterActions}>
              <TouchableOpacity
                onPress={clearAllFilters}
                style={styles.clearFiltersButton}
              >
                <Text style={styles.clearFiltersText}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={closeFilters}
                style={styles.applyFiltersButton}
              >
                <Text style={styles.applyFiltersText}>Apply Filters</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    margin: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchFocused: {
    borderColor: '#1e40af',
    backgroundColor: '#ffffff',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1e293b',
    paddingVertical: 8,
  },
  clearButton: {
    padding: 4,
    marginLeft: 8,
  },
  filterButton: {
    padding: 4,
    marginLeft: 8,
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 'bold',
  },
  activeFiltersContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2fe',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
  },
  activeFilterText: {
    fontSize: 12,
    color: '#0369a1',
    fontWeight: '500',
  },
  removeFilterButton: {
    marginLeft: 6,
    padding: 2,
  },
  clearAllButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  clearAllText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBackdrop: {
    flex: 1,
  },
  filterModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: screenHeight * 0.8,
    minHeight: screenHeight * 0.5,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  closeButton: {
    padding: 4,
  },
  filterContent: {
    flex: 1,
    padding: 20,
  },
  filterOption: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  selectOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedOption: {
    backgroundColor: '#1e40af',
    borderColor: '#1e40af',
  },
  selectOptionText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  selectedOptionText: {
    color: '#ffffff',
  },
  checkIcon: {
    marginLeft: 4,
  },
  rangeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rangeInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rangeSeparator: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#1e40af',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  filterActions: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  clearFiltersButton: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  clearFiltersText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '600',
  },
  applyFiltersButton: {
    flex: 1,
    backgroundColor: '#1e40af',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  applyFiltersText: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
  },
});

export default MobileSearchFilter;