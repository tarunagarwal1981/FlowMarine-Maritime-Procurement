import React, {useState, useMemo, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const {width: screenWidth} = Dimensions.get('window');

export interface TableColumn {
  key: string;
  title: string;
  width?: number;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => React.ReactNode;
}

export interface TableRow {
  id: string;
  [key: string]: any;
}

interface MobileDataTableProps {
  columns: TableColumn[];
  data: TableRow[];
  loading?: boolean;
  onRefresh?: () => void;
  onRowPress?: (row: TableRow) => void;
  sortable?: boolean;
  paginated?: boolean;
  pageSize?: number;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  stickyHeader?: boolean;
}

const MobileDataTable: React.FC<MobileDataTableProps> = ({
  columns,
  data,
  loading = false,
  onRefresh,
  onRowPress,
  sortable = true,
  paginated = false,
  pageSize = 20,
  searchable = false,
  searchPlaceholder = 'Search...',
  emptyMessage = 'No data available',
  stickyHeader = true,
}) => {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate column widths
  const columnWidths = useMemo(() => {
    const totalCustomWidth = columns.reduce((sum, col) => sum + (col.width || 0), 0);
    const remainingWidth = Math.max(screenWidth - 32, totalCustomWidth);
    const autoColumns = columns.filter(col => !col.width);
    const autoWidth = autoColumns.length > 0 ? 
      Math.max(120, (remainingWidth - totalCustomWidth) / autoColumns.length) : 0;

    return columns.map(col => col.width || autoWidth);
  }, [columns]);

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = data.filter(row =>
        columns.some(col => {
          const value = row[col.key];
          return value && value.toString().toLowerCase().includes(query);
        })
      );
    }

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        
        if (aVal === bVal) return 0;
        
        let comparison = 0;
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        } else {
          comparison = String(aVal).localeCompare(String(bVal));
        }
        
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, searchQuery, sortColumn, sortDirection, columns]);

  // Paginate data
  const paginatedData = useMemo(() => {
    if (!paginated) return processedData;
    
    const startIndex = (currentPage - 1) * pageSize;
    return processedData.slice(startIndex, startIndex + pageSize);
  }, [processedData, currentPage, pageSize, paginated]);

  const totalPages = Math.ceil(processedData.length / pageSize);

  const handleSort = useCallback((columnKey: string) => {
    if (!sortable) return;
    
    const column = columns.find(col => col.key === columnKey);
    if (!column?.sortable) return;

    if (sortColumn === columnKey) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  }, [sortColumn, sortDirection, columns, sortable]);

  const renderHeader = () => (
    <View style={styles.headerRow}>
      {columns.map((column, index) => (
        <TouchableOpacity
          key={column.key}
          style={[
            styles.headerCell,
            { width: columnWidths[index] },
            column.align === 'center' && styles.centerAlign,
            column.align === 'right' && styles.rightAlign,
          ]}
          onPress={() => handleSort(column.key)}
          disabled={!sortable || !column.sortable}
        >
          <Text style={styles.headerText} numberOfLines={1}>
            {column.title}
          </Text>
          {sortable && column.sortable && (
            <View style={styles.sortIcon}>
              {sortColumn === column.key ? (
                <Icon
                  name={sortDirection === 'asc' ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
                  size={16}
                  color="#1e40af"
                />
              ) : (
                <Icon name="unfold-more" size={16} color="#94a3b8" />
              )}
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderRow = ({item: row, index}: {item: TableRow; index: number}) => (
    <TouchableOpacity
      style={[
        styles.dataRow,
        index % 2 === 0 && styles.evenRow,
        onRowPress && styles.pressableRow,
      ]}
      onPress={() => onRowPress?.(row)}
      disabled={!onRowPress}
    >
      {columns.map((column, colIndex) => {
        const value = row[column.key];
        const displayValue = column.render ? column.render(value, row) : value;
        
        return (
          <View
            key={column.key}
            style={[
              styles.dataCell,
              { width: columnWidths[colIndex] },
              column.align === 'center' && styles.centerAlign,
              column.align === 'right' && styles.rightAlign,
            ]}
          >
            {typeof displayValue === 'string' || typeof displayValue === 'number' ? (
              <Text style={styles.cellText} numberOfLines={2}>
                {displayValue}
              </Text>
            ) : (
              displayValue
            )}
          </View>
        );
      })}
    </TouchableOpacity>
  );

  const renderPagination = () => {
    if (!paginated || totalPages <= 1) return null;

    return (
      <View style={styles.pagination}>
        <TouchableOpacity
          style={[styles.pageButton, currentPage === 1 && styles.disabledButton]}
          onPress={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
        >
          <Icon name="chevron-left" size={20} color={currentPage === 1 ? '#94a3b8' : '#1e40af'} />
        </TouchableOpacity>
        
        <Text style={styles.pageInfo}>
          Page {currentPage} of {totalPages}
        </Text>
        
        <TouchableOpacity
          style={[styles.pageButton, currentPage === totalPages && styles.disabledButton]}
          onPress={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
        >
          <Icon name="chevron-right" size={20} color={currentPage === totalPages ? '#94a3b8' : '#1e40af'} />
        </TouchableOpacity>
      </View>
    );
  };

  if (paginatedData.length === 0 && !loading) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="inbox" size={48} color="#94a3b8" />
        <Text style={styles.emptyText}>{emptyMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tableContainer}
      >
        <View style={styles.table}>
          {stickyHeader && renderHeader()}
          
          <FlatList
            data={paginatedData}
            renderItem={renderRow}
            keyExtractor={(item) => item.id}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={loading}
                  onRefresh={onRefresh}
                  colors={['#1e40af']}
                />
              ) : undefined
            }
            ListHeaderComponent={!stickyHeader ? renderHeader : undefined}
            showsVerticalScrollIndicator={false}
            style={styles.flatList}
          />
        </View>
      </ScrollView>
      
      {renderPagination()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  tableContainer: {
    flex: 1,
  },
  table: {
    minWidth: screenWidth - 32,
  },
  flatList: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 2,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    minHeight: 44,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  sortIcon: {
    marginLeft: 4,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 56,
  },
  evenRow: {
    backgroundColor: '#f8fafc',
  },
  pressableRow: {
    backgroundColor: '#ffffff',
  },
  dataCell: {
    paddingHorizontal: 8,
    justifyContent: 'center',
  },
  cellText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  centerAlign: {
    alignItems: 'center',
  },
  rightAlign: {
    alignItems: 'flex-end',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  pageButton: {
    padding: 8,
    borderRadius: 8,
  },
  disabledButton: {
    opacity: 0.5,
  },
  pageInfo: {
    fontSize: 14,
    color: '#374151',
    marginHorizontal: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default MobileDataTable;