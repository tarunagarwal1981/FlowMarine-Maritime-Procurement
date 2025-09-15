/**
 * Data Table Widget Component
 * Configurable data table with sorting, filtering, and export
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Badge } from '../../ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import { Search, Download, Filter, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { DashboardWidget, DashboardFilters, WidgetConfiguration } from '../../../types/dashboard';
import { cn } from '../../../utils/cn';

interface DataTableProps {
  widget: DashboardWidget;
  configuration: WidgetConfiguration;
  filters?: DashboardFilters;
  isCustomizing?: boolean;
}

interface TableColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'status';
  sortable?: boolean;
  filterable?: boolean;
}

interface TableRow {
  id: string;
  [key: string]: any;
}

export const DataTable: React.FC<DataTableProps> = ({
  widget,
  configuration,
  filters,
  isCustomizing = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Mock data - in real implementation, this would come from API
  const mockColumns: TableColumn[] = [
    { key: 'vessel', label: 'Vessel', type: 'text', sortable: true, filterable: true },
    { key: 'category', label: 'Category', type: 'text', sortable: true, filterable: true },
    { key: 'amount', label: 'Amount', type: 'currency', sortable: true },
    { key: 'date', label: 'Date', type: 'date', sortable: true },
    { key: 'status', label: 'Status', type: 'status', sortable: true, filterable: true },
  ];

  const mockData: TableRow[] = [
    {
      id: '1',
      vessel: 'MV Atlantic',
      category: 'Engine Parts',
      amount: 15000,
      date: '2024-01-15',
      status: 'approved',
    },
    {
      id: '2',
      vessel: 'MV Pacific',
      category: 'Safety Equipment',
      amount: 8500,
      date: '2024-01-14',
      status: 'pending',
    },
    {
      id: '3',
      vessel: 'MV Atlantic',
      category: 'Deck Equipment',
      amount: 12000,
      date: '2024-01-13',
      status: 'rejected',
    },
    {
      id: '4',
      vessel: 'MV Indian',
      category: 'Navigation',
      amount: 25000,
      date: '2024-01-12',
      status: 'approved',
    },
    {
      id: '5',
      vessel: 'MV Pacific',
      category: 'Engine Parts',
      amount: 18500,
      date: '2024-01-11',
      status: 'approved',
    },
  ];

  // Filter and sort data
  const processedData = useMemo(() => {
    let filtered = mockData;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
        )
      );
    }

    // Apply sorting
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortColumn];
        const bValue = b[sortColumn];
        
        let comparison = 0;
        if (aValue < bValue) comparison = -1;
        if (aValue > bValue) comparison = 1;
        
        return sortDirection === 'desc' ? -comparison : comparison;
      });
    }

    // Apply data limit
    if (configuration.dataLimit) {
      filtered = filtered.slice(0, configuration.dataLimit);
    }

    return filtered;
  }, [mockData, searchQuery, sortColumn, sortDirection, configuration.dataLimit]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  const formatCellValue = (value: any, type: string) => {
    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value);
      
      case 'date':
        return new Date(value).toLocaleDateString();
      
      case 'status':
        return (
          <Badge
            className={cn(
              value === 'approved' && 'bg-green-100 text-green-800',
              value === 'pending' && 'bg-yellow-100 text-yellow-800',
              value === 'rejected' && 'bg-red-100 text-red-800'
            )}
          >
            {value}
          </Badge>
        );
      
      default:
        return value;
    }
  };

  const getSortIcon = (columnKey: string) => {
    if (sortColumn !== columnKey) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4" /> : 
      <ArrowDown className="h-4 w-4" />;
  };

  if (isCustomizing) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] border-2 border-dashed border-muted-foreground/25 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-semibold text-muted-foreground mb-2">
            Data Table Widget
          </div>
          <div className="text-sm text-muted-foreground">
            Configurable table with {mockData.length} rows
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{widget.title}</CardTitle>
          
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-48"
              />
            </div>

            {/* Export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="h-4 w-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem>Export as Excel</DropdownMenuItem>
                <DropdownMenuItem>Export as PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-auto max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                {mockColumns.map((column) => (
                  <TableHead
                    key={column.key}
                    className={cn(
                      column.sortable && "cursor-pointer hover:bg-muted/50",
                      "select-none"
                    )}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    <div className="flex items-center gap-2">
                      {column.label}
                      {column.sortable && getSortIcon(column.key)}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedData.map((row) => (
                <TableRow key={row.id}>
                  {mockColumns.map((column) => (
                    <TableCell key={column.key}>
                      {formatCellValue(row[column.key], column.type)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {processedData.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No data found</p>
          </div>
        )}

        {/* Footer with row count */}
        <div className="border-t p-3 text-sm text-muted-foreground">
          Showing {processedData.length} of {mockData.length} rows
        </div>
      </CardContent>
    </Card>
  );
};

export default DataTable;