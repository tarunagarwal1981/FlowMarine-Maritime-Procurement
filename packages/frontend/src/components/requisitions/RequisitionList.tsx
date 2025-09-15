/**
 * Requisition List Component
 * Displays requisitions with filtering, sorting, and pagination
 */

import React, { useState, useMemo } from 'react';
import { useGetRequisitionsQuery, Requisition } from '../../store/api/requisitionApi';
import { useGetVesselsQuery } from '../../store/api/vesselApi';

interface RequisitionListProps {
  onEdit?: (requisition: Requisition) => void;
  onView?: (requisition: Requisition) => void;
  vesselId?: string;
}

interface Filters {
  vesselId: string;
  status: string;
  urgencyLevel: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

export const RequisitionList: React.FC<RequisitionListProps> = ({
  onEdit,
  onView,
  vesselId: filterVesselId
}) => {
  const { data: vessels = [] } = useGetVesselsQuery();
  
  const [filters, setFilters] = useState<Filters>({
    vesselId: filterVesselId || '',
    status: '',
    urgencyLevel: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });

  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<'createdAt' | 'totalAmount' | 'urgencyLevel'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Build query parameters
  const queryParams = useMemo(() => {
    const params: any = { page, limit: 20 };
    
    if (filters.vesselId) params.vesselId = filters.vesselId;
    if (filters.status) params.status = filters.status;
    if (filters.urgencyLevel) params.urgencyLevel = filters.urgencyLevel;
    if (filters.dateFrom) params.dateFrom = filters.dateFrom;
    if (filters.dateTo) params.dateTo = filters.dateTo;
    
    return params;
  }, [filters, page]);

  const { data: requisitionsData, isLoading, error } = useGetRequisitionsQuery(queryParams);

  // Filter and sort requisitions locally for search
  const filteredRequisitions = useMemo(() => {
    if (!requisitionsData?.data) return [];
    
    let filtered = [...requisitionsData.data];
    
    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(req =>
        req.requisitionNumber.toLowerCase().includes(searchLower) ||
        req.justification?.toLowerCase().includes(searchLower) ||
        req.vessel?.name.toLowerCase().includes(searchLower)
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'totalAmount':
          aValue = a.totalAmount;
          bValue = b.totalAmount;
          break;
        case 'urgencyLevel':
          const urgencyOrder = { 'EMERGENCY': 3, 'URGENT': 2, 'ROUTINE': 1 };
          aValue = urgencyOrder[a.urgencyLevel as keyof typeof urgencyOrder];
          bValue = urgencyOrder[b.urgencyLevel as keyof typeof urgencyOrder];
          break;
        default:
          aValue = a.createdAt;
          bValue = b.createdAt;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
    
    return filtered;
  }, [requisitionsData?.data, filters.search, sortBy, sortOrder]);

  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1); // Reset to first page when filtering
  };

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-800';
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'CANCELLED': return 'bg-gray-100 text-gray-600';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'EMERGENCY': return 'text-red-600 bg-red-100';
      case 'URGENT': return 'text-orange-600 bg-orange-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Error loading requisitions. Please try again.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search requisitions..."
            />
          </div>

          {!filterVesselId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vessel
              </label>
              <select
                value={filters.vesselId}
                onChange={(e) => handleFilterChange('vesselId', e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Vessels</option>
                {vessels.map(vessel => (
                  <option key={vessel.id} value={vessel.id}>
                    {vessel.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING_APPROVAL">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Urgency
            </label>
            <select
              value={filters.urgencyLevel}
              onChange={(e) => handleFilterChange('urgencyLevel', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Urgencies</option>
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Showing {filteredRequisitions.length} requisitions
          {requisitionsData?.pagination && (
            <span> (Page {requisitionsData.pagination.page} of {requisitionsData.pagination.pages})</span>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">Sort by:</span>
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field as typeof sortBy);
              setSortOrder(order as 'asc' | 'desc');
            }}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="createdAt-desc">Newest First</option>
            <option value="createdAt-asc">Oldest First</option>
            <option value="totalAmount-desc">Highest Amount</option>
            <option value="totalAmount-asc">Lowest Amount</option>
            <option value="urgencyLevel-desc">Most Urgent</option>
            <option value="urgencyLevel-asc">Least Urgent</option>
          </select>
        </div>
      </div>

      {/* Requisitions List */}
      {filteredRequisitions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Requisitions Found</h3>
          <p className="text-gray-600">
            {Object.values(filters).some(f => f) 
              ? 'Try adjusting your filters to see more results.'
              : 'Create your first requisition to get started.'
            }
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('createdAt')}
                  >
                    Requisition
                    {sortBy === 'createdAt' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vessel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('urgencyLevel')}
                  >
                    Urgency
                    {sortBy === 'urgencyLevel' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('totalAmount')}
                  >
                    Amount
                    {sortBy === 'totalAmount' && (
                      <span className="ml-1">{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRequisitions.map((requisition) => (
                  <tr key={requisition.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {requisition.requisitionNumber}
                        </div>
                        {requisition.justification && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {requisition.justification}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {requisition.vessel?.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {requisition.vessel?.imoNumber}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(requisition.status)}`}>
                        {requisition.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getUrgencyColor(requisition.urgencyLevel)}`}>
                        {requisition.urgencyLevel}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {requisition.currency} {requisition.totalAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {requisition.items.length} items
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(requisition.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        {onView && (
                          <button
                            onClick={() => onView(requisition)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </button>
                        )}
                        {onEdit && requisition.status === 'DRAFT' && (
                          <button
                            onClick={() => onEdit(requisition)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {requisitionsData?.pagination && requisitionsData.pagination.pages > 1 && (
        <div className="flex justify-center">
          <nav className="flex space-x-2">
            <button
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            {Array.from({ length: requisitionsData.pagination.pages }, (_, i) => i + 1).map(pageNum => (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`px-3 py-2 text-sm font-medium rounded-md ${
                  page === pageNum
                    ? 'text-blue-600 bg-blue-50 border border-blue-300'
                    : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {pageNum}
              </button>
            ))}
            
            <button
              onClick={() => setPage(page + 1)}
              disabled={page === requisitionsData.pagination.pages}
              className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};