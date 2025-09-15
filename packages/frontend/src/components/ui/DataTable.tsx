/**
 * DataTable Component
 * Mobile-first data table with sorting and filtering
 */

import React, { useState, useMemo } from 'react';
import { cn } from '../../utils/cn';

export interface Column<T> {
  key: keyof T | string;
  title: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  mobileHidden?: boolean; // Hide on mobile screens
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  onRowClick?: (row: T, index: number) => void;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (pageSize: number) => void;
  };
  searchable?: boolean;
  searchPlaceholder?: string;
  mobileCardView?: boolean; // Show as cards on mobile instead of table
}

type SortDirection = 'asc' | 'desc' | null;

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  emptyMessage = 'No data available',
  className,
  onRowClick,
  pagination,
  searchable = false,
  searchPlaceholder = 'Search...',
  mobileCardView = true,
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = data;

    // Apply search filter
    if (searchTerm) {
      filtered = data.filter((row) =>
        columns.some((column) => {
          const value = row[column.key as keyof T];
          return String(value).toLowerCase().includes(searchTerm.toLowerCase());
        })
      );
    }

    // Apply sorting
    if (sortColumn && sortDirection) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];
        
        if (aValue === bValue) return 0;
        
        const comparison = aValue < bValue ? -1 : 1;
        return sortDirection === 'asc' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [data, columns, searchTerm, sortColumn, sortDirection]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(
        sortDirection === 'asc' ? 'desc' : sortDirection === 'desc' ? null : 'asc'
      );
      if (sortDirection === 'desc') {
        setSortColumn(null);
      }
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return (
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    
    if (sortDirection === 'asc') {
      return (
        <svg className="w-4 h-4 text-maritime-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    
    return (
      <svg className="w-4 h-4 text-maritime-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  const LoadingRow = () => (
    <tr>
      <td colSpan={columns.length} className="px-4 py-8 text-center">
        <div className="flex items-center justify-center">
          <div className="loading-spinner mr-2"></div>
          <span className="text-gray-500">Loading...</span>
        </div>
      </td>
    </tr>
  );

  const EmptyRow = () => (
    <tr>
      <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-500">
        {emptyMessage}
      </td>
    </tr>
  );

  // Mobile card view
  const MobileCardView = () => (
    <div className="space-y-4 sm:hidden">
      {processedData.map((row, index) => (
        <div
          key={index}
          className={cn(
            'card-maritime p-4 space-y-3',
            onRowClick && 'cursor-pointer hover:shadow-md transition-shadow'
          )}
          onClick={() => onRowClick?.(row, index)}
        >
          {columns
            .filter(column => !column.mobileHidden)
            .map((column) => {
              const value = row[column.key as keyof T];
              const displayValue = column.render ? column.render(value, row, index) : value;
              
              return (
                <div key={String(column.key)} className="flex justify-between items-start">
                  <span className="text-sm font-medium text-gray-600 flex-shrink-0 mr-3">
                    {column.title}:
                  </span>
                  <span className="text-sm text-gray-900 text-right">
                    {displayValue}
                  </span>
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );

  return (
    <div className={cn('w-full', className)}>
      {/* Search */}
      {searchable && (
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input pl-10"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Card View */}
      {mobileCardView && (
        <div className="sm:hidden">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="loading-spinner mr-2"></div>
              <span className="text-gray-500">Loading...</span>
            </div>
          ) : processedData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {emptyMessage}
            </div>
          ) : (
            <MobileCardView />
          )}
        </div>
      )}

      {/* Desktop Table View */}
      <div className={cn('overflow-x-auto', mobileCardView && 'hidden sm:block')}>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                    column.sortable && 'cursor-pointer hover:bg-gray-100 select-none',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right',
                    column.width && `w-${column.width}`
                  )}
                  onClick={() => column.sortable && handleSort(String(column.key))}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.title}</span>
                    {column.sortable && <SortIcon column={String(column.key)} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <LoadingRow />
            ) : processedData.length === 0 ? (
              <EmptyRow />
            ) : (
              processedData.map((row, index) => (
                <tr
                  key={index}
                  className={cn(
                    'hover:bg-gray-50 transition-colors',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row, index)}
                >
                  {columns.map((column) => {
                    const value = row[column.key as keyof T];
                    const displayValue = column.render ? column.render(value, row, index) : value;
                    
                    return (
                      <td
                        key={String(column.key)}
                        className={cn(
                          'px-4 py-4 whitespace-nowrap text-sm text-gray-900',
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right'
                        )}
                      >
                        {displayValue}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between mt-4 px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="btn-secondary text-sm"
            >
              Previous
            </button>
            <button
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              disabled={pagination.page * pagination.pageSize >= pagination.total}
              className="btn-secondary text-sm ml-3"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">
                  {(pagination.page - 1) * pagination.pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)}
                </span>{' '}
                of{' '}
                <span className="font-medium">{pagination.total}</span> results
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="btn-secondary text-sm"
              >
                Previous
              </button>
              <button
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page * pagination.pageSize >= pagination.total}
                className="btn-secondary text-sm"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}