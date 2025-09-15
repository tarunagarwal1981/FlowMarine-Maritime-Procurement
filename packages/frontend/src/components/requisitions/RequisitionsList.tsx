import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  Eye, 
  Edit, 
  Trash2, 
  Download,
  Calendar,
  Ship,
  Building,
  User,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText
} from 'lucide-react';
import { Button, Card, Badge } from '../ui';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { setSearchTerm, updateFilters, clearFilters } from '../../store/slices/requisitionSlice';
import { Requisition } from '../../types/requisition';
import { mockVessels, mockDepartments } from '../../data/mockRequisitions';

interface RequisitionsListProps {
  onCreateNew?: () => void;
  onViewRequisition?: (requisition: Requisition) => void;
  onEditRequisition?: (requisition: Requisition) => void;
}

const statusConfig = {
  draft: { 
    color: 'bg-gray-100 text-gray-800', 
    icon: FileText, 
    label: 'Draft' 
  },
  submitted: { 
    color: 'bg-blue-100 text-blue-800', 
    icon: Clock, 
    label: 'Submitted' 
  },
  approved: { 
    color: 'bg-green-100 text-green-800', 
    icon: CheckCircle, 
    label: 'Approved' 
  },
  rejected: { 
    color: 'bg-red-100 text-red-800', 
    icon: XCircle, 
    label: 'Rejected' 
  },
  in_procurement: { 
    color: 'bg-yellow-100 text-yellow-800', 
    icon: Clock, 
    label: 'In Procurement' 
  },
  completed: { 
    color: 'bg-green-100 text-green-800', 
    icon: CheckCircle, 
    label: 'Completed' 
  },
};

const priorityConfig = {
  low: { color: 'bg-green-100 text-green-800', emoji: '🟢' },
  medium: { color: 'bg-yellow-100 text-yellow-800', emoji: '🟡' },
  high: { color: 'bg-orange-100 text-orange-800', emoji: '🟠' },
  urgent: { color: 'bg-red-100 text-red-800', emoji: '🔴' },
};

export const RequisitionsList: React.FC<RequisitionsListProps> = ({
  onCreateNew,
  onViewRequisition,
  onEditRequisition,
}) => {
  const dispatch = useAppDispatch();
  const { requisitions, searchTerm, filters } = useAppSelector((state) => state.requisition);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'value' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const filteredAndSortedRequisitions = useMemo(() => {
    let filtered = requisitions.filter((req) => {
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = 
          req.title.toLowerCase().includes(searchLower) ||
          req.requisitionNumber.toLowerCase().includes(searchLower) ||
          req.vesselName.toLowerCase().includes(searchLower) ||
          req.departmentName.toLowerCase().includes(searchLower) ||
          req.requestedByName.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status && filters.status.length > 0) {
        if (!filters.status.includes(req.status)) return false;
      }

      // Priority filter
      if (filters.priority && filters.priority.length > 0) {
        if (!filters.priority.includes(req.priority)) return false;
      }

      // Vessel filter
      if (filters.vesselId && req.vesselId !== filters.vesselId) {
        return false;
      }

      // Department filter
      if (filters.departmentId && req.departmentId !== filters.departmentId) {
        return false;
      }

      // Date range filter
      if (filters.dateRange) {
        const reqDate = new Date(req.requestedDate);
        if (filters.dateRange.start && reqDate < new Date(filters.dateRange.start)) {
          return false;
        }
        if (filters.dateRange.end && reqDate > new Date(filters.dateRange.end)) {
          return false;
        }
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.requestedDate).getTime() - new Date(b.requestedDate).getTime();
          break;
        case 'priority':
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'value':
          comparison = a.totalEstimatedValue - b.totalEstimatedValue;
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [requisitions, searchTerm, filters, sortBy, sortOrder]);

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusIcon = (status: Requisition['status']) => {
    const StatusIcon = statusConfig[status].icon;
    return <StatusIcon className="h-4 w-4" />;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800">Requisitions</h1>
          <p className="text-slate-600 mt-2">
            Manage procurement requests for your fleet
          </p>
        </div>
        <Button onClick={onCreateNew} className="flex items-center space-x-2 shadow-lg shadow-blue-200/50">
          <Plus className="h-4 w-4" />
          <span>New Requisition</span>
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search requisitions..."
                value={searchTerm}
                onChange={(e) => dispatch(setSearchTerm(e.target.value))}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl bg-white/80 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-300 transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
            </Button>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [newSortBy, newSortOrder] = e.target.value.split('-');
                setSortBy(newSortBy as typeof sortBy);
                setSortOrder(newSortOrder as typeof sortOrder);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="priority-desc">High Priority First</option>
              <option value="value-desc">Highest Value First</option>
              <option value="value-asc">Lowest Value First</option>
              <option value="status-asc">Status A-Z</option>
            </select>

            <Button variant="outline" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  multiple
                  value={filters.status || []}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    dispatch(updateFilters({ status: values }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  size={3}
                >
                  {Object.entries(statusConfig).map(([status, config]) => (
                    <option key={status} value={status}>
                      {config.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Priority
                </label>
                <select
                  multiple
                  value={filters.priority || []}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, option => option.value);
                    dispatch(updateFilters({ priority: values }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  size={3}
                >
                  {Object.keys(priorityConfig).map((priority) => (
                    <option key={priority} value={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vessel
                </label>
                <select
                  value={filters.vesselId || ''}
                  onChange={(e) => dispatch(updateFilters({ vesselId: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Vessels</option>
                  {mockVessels.map((vessel) => (
                    <option key={vessel.id} value={vessel.id}>
                      {vessel.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department
                </label>
                <select
                  value={filters.departmentId || ''}
                  onChange={(e) => dispatch(updateFilters({ departmentId: e.target.value || undefined }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Departments</option>
                  {mockDepartments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                variant="outline"
                onClick={() => dispatch(clearFilters())}
                size="sm"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {filteredAndSortedRequisitions.length} of {requisitions.length} requisitions
        </span>
        <span>
          Total Value: ${filteredAndSortedRequisitions.reduce((sum, req) => sum + req.totalEstimatedValue, 0).toLocaleString()}
        </span>
      </div>

      {/* Requisitions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAndSortedRequisitions.map((requisition) => (
          <Card key={requisition.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 mb-1">
                  {requisition.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {requisition.requisitionNumber}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className={priorityConfig[requisition.priority].color}>
                  {priorityConfig[requisition.priority].emoji} {requisition.priority}
                </Badge>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center text-sm text-gray-600">
                <Ship className="h-4 w-4 mr-2" />
                <span>{requisition.vesselName}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Building className="h-4 w-4 mr-2" />
                <span>{requisition.departmentName}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <User className="h-4 w-4 mr-2" />
                <span>{requisition.requestedByName}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Required: {formatDate(requisition.requiredDate)}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <DollarSign className="h-4 w-4 mr-2" />
                <span>${requisition.totalEstimatedValue.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mb-4">
              <Badge className={statusConfig[requisition.status].color}>
                {getStatusIcon(requisition.status)}
                <span className="ml-1">{statusConfig[requisition.status].label}</span>
              </Badge>
              <span className="text-sm text-gray-500">
                {requisition.items.length} item{requisition.items.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <span className="text-xs text-gray-500">
                Created {formatDate(requisition.createdAt)}
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewRequisition?.(requisition)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                {(requisition.status === 'draft' || requisition.status === 'rejected') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEditRequisition?.(requisition)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {filteredAndSortedRequisitions.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            No requisitions found
          </h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || Object.values(filters).some(f => f && (Array.isArray(f) ? f.length > 0 : true))
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first requisition'
            }
          </p>
          {!searchTerm && !Object.values(filters).some(f => f && (Array.isArray(f) ? f.length > 0 : true)) && (
            <Button onClick={onCreateNew} className="flex items-center space-x-2 mx-auto">
              <Plus className="h-4 w-4" />
              <span>Create First Requisition</span>
            </Button>
          )}
        </Card>
      )}
    </div>
  );
};