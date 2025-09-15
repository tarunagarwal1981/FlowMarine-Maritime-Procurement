/**
 * Offline Requisitions List Component
 * Displays requisitions that are stored offline and pending sync
 */

import React, { useState } from 'react';
import { useOfflineSync, useOfflineCache } from '../../hooks/useOfflineSync';
import { OfflineRequisition } from '../../utils/offlineStorage';

export const OfflineRequisitionsList: React.FC = () => {
  const { 
    offlineRequisitions, 
    removeOfflineRequisition, 
    isOnline,
    syncInProgress 
  } = useOfflineSync();
  
  const { getCachedVessels, getCachedItems } = useOfflineCache();
  
  const [expandedRequisition, setExpandedRequisition] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const cachedVessels = getCachedVessels();
  const cachedItems = getCachedItems();

  const getVesselName = (vesselId: string) => {
    const vessel = cachedVessels.find(v => v.id === vesselId);
    return vessel ? `${vessel.name} (${vessel.imoNumber})` : 'Unknown Vessel';
  };

  const getItemName = (itemCatalogId: string) => {
    const item = cachedItems.find(i => i.id === itemCatalogId);
    return item ? item.name : 'Unknown Item';
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

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'EMERGENCY': return 'text-red-600 bg-red-100';
      case 'URGENT': return 'text-orange-600 bg-orange-100';
      default: return 'text-green-600 bg-green-100';
    }
  };

  const handleDeleteRequisition = (tempId: string) => {
    removeOfflineRequisition(tempId);
    setShowDeleteConfirm(null);
  };

  const toggleExpanded = (tempId: string) => {
    setExpandedRequisition(expandedRequisition === tempId ? null : tempId);
  };

  if (offlineRequisitions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center text-gray-500">
          <div className="w-16 h-16 mx-auto mb-4 text-gray-300">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Offline Requisitions</h3>
          <p className="text-gray-600">
            Requisitions created while offline will appear here until they sync.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          Offline Requisitions ({offlineRequisitions.length})
        </h2>
        
        {syncInProgress && (
          <div className="flex items-center text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-sm">Syncing...</span>
          </div>
        )}
      </div>

      {/* Status Banner */}
      <div className={`p-3 rounded-md ${
        isOnline 
          ? 'bg-green-100 border border-green-200' 
          : 'bg-yellow-100 border border-yellow-200'
      }`}>
        <div className="flex items-center">
          <div className={`w-2 h-2 rounded-full mr-2 ${
            isOnline ? 'bg-green-500' : 'bg-yellow-500'
          }`}></div>
          <span className={`text-sm font-medium ${
            isOnline ? 'text-green-800' : 'text-yellow-800'
          }`}>
            {isOnline 
              ? 'Online - Requisitions will sync automatically'
              : 'Offline - Requisitions will sync when connection is restored'
            }
          </span>
        </div>
      </div>

      {/* Requisitions List */}
      <div className="space-y-3">
        {offlineRequisitions.map((requisition) => (
          <div key={requisition.tempId} className="bg-white border border-gray-200 rounded-lg shadow-sm">
            {/* Requisition Header */}
            <div 
              className="p-4 cursor-pointer hover:bg-gray-50"
              onClick={() => toggleExpanded(requisition.tempId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="font-medium text-gray-900">
                      {getVesselName(requisition.vesselId)}
                    </h3>
                    
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getUrgencyColor(requisition.urgencyLevel)}`}>
                      {requisition.urgencyLevel}
                    </span>
                    
                    <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      {requisition.status}
                    </span>
                  </div>
                  
                  <div className="mt-1 text-sm text-gray-600">
                    {requisition.items.length} items • {requisition.currency} {requisition.totalAmount.toFixed(2)}
                  </div>
                  
                  <div className="mt-1 text-xs text-gray-500">
                    Created: {formatDate(requisition.createdAt)}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDeleteConfirm(requisition.tempId);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 rounded"
                    title="Delete offline requisition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                  
                  {/* Expand Arrow */}
                  <svg 
                    className={`w-5 h-5 text-gray-400 transition-transform ${
                      expandedRequisition === requisition.tempId ? 'rotate-180' : ''
                    }`}
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Expanded Details */}
            {expandedRequisition === requisition.tempId && (
              <div className="border-t border-gray-200 p-4 bg-gray-50">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {requisition.deliveryLocation && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Delivery Location:</span>
                      <div className="text-sm text-gray-900">{requisition.deliveryLocation}</div>
                    </div>
                  )}
                  
                  {requisition.deliveryDate && (
                    <div>
                      <span className="text-sm font-medium text-gray-700">Required Date:</span>
                      <div className="text-sm text-gray-900">
                        {new Date(requisition.deliveryDate).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Justification */}
                {requisition.justification && (
                  <div className="mb-4">
                    <span className="text-sm font-medium text-gray-700">Justification:</span>
                    <div className="text-sm text-gray-900 mt-1">{requisition.justification}</div>
                  </div>
                )}

                {/* Items */}
                <div>
                  <span className="text-sm font-medium text-gray-700 mb-2 block">Items:</span>
                  <div className="space-y-2">
                    {requisition.items.map((item, index) => (
                      <div key={item.tempId} className="bg-white p-3 rounded border border-gray-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">
                              {getItemName(item.itemCatalogId)}
                            </div>
                            <div className="text-sm text-gray-600">
                              Quantity: {item.quantity} × {requisition.currency} {item.unitPrice.toFixed(2)} = {requisition.currency} {item.totalPrice.toFixed(2)}
                            </div>
                            {item.urgencyLevel !== 'ROUTINE' && (
                              <div className={`inline-block mt-1 px-2 py-1 text-xs font-medium rounded-full ${getUrgencyColor(item.urgencyLevel)}`}>
                                {item.urgencyLevel}
                              </div>
                            )}
                            {item.justification && (
                              <div className="text-sm text-gray-600 mt-1">
                                <span className="font-medium">Note:</span> {item.justification}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Delete Offline Requisition?
            </h3>
            <p className="text-gray-600 mb-6">
              This will permanently delete the offline requisition. This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteRequisition(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};