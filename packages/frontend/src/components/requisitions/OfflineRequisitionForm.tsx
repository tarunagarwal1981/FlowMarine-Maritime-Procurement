/**
 * Offline-Capable Requisition Form Component
 * Allows creating requisitions even when offline, with automatic sync when online
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useOfflineSync, useOfflineCache } from '../../hooks/useOfflineSync';
import { offlineStorage, OfflineRequisition, OfflineRequisitionItem } from '../../utils/offlineStorage';

interface OfflineRequisitionFormProps {
  vesselId?: string;
  onSubmit?: (requisition: OfflineRequisition) => void;
  onCancel?: () => void;
}

interface FormData {
  vesselId: string;
  urgencyLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  deliveryLocation: string;
  deliveryDate: string;
  justification: string;
  currency: string;
  items: OfflineRequisitionItem[];
}

interface ItemFormData {
  itemCatalogId: string;
  quantity: number;
  unitPrice: number;
  urgencyLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  justification: string;
}

export const OfflineRequisitionForm: React.FC<OfflineRequisitionFormProps> = ({
  vesselId: initialVesselId,
  onSubmit,
  onCancel
}) => {
  const { 
    isOnline, 
    isOffline, 
    saveOfflineRequisition, 
    pendingSyncCount 
  } = useOfflineSync();
  
  const { getCachedItems, getCachedVessels } = useOfflineCache();

  const [formData, setFormData] = useState<FormData>({
    vesselId: initialVesselId || '',
    urgencyLevel: 'ROUTINE',
    deliveryLocation: '',
    deliveryDate: '',
    justification: '',
    currency: 'USD',
    items: []
  });

  const [currentItem, setCurrentItem] = useState<ItemFormData>({
    itemCatalogId: '',
    quantity: 1,
    unitPrice: 0,
    urgencyLevel: 'ROUTINE',
    justification: ''
  });

  const [cachedItems, setCachedItems] = useState(getCachedItems());
  const [cachedVessels, setCachedVessels] = useState(getCachedVessels());
  const [filteredItems, setFilteredItems] = useState(cachedItems);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Update cached data when component mounts
  useEffect(() => {
    setCachedItems(getCachedItems());
    setCachedVessels(getCachedVessels());
  }, [getCachedItems, getCachedVessels]);

  // Filter items based on search term and vessel compatibility
  useEffect(() => {
    let filtered = cachedItems;

    // Filter by search term
    if (itemSearchTerm) {
      const searchLower = itemSearchTerm.toLowerCase();
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower) ||
        item.impaCode?.toLowerCase().includes(searchLower) ||
        item.issaCode?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by vessel compatibility
    if (formData.vesselId) {
      const vessel = cachedVessels.find(v => v.id === formData.vesselId);
      if (vessel) {
        filtered = filtered.filter(item =>
          item.compatibleVesselTypes.includes(vessel.vesselType) ||
          item.compatibleEngineTypes.includes(vessel.engineType)
        );
      }
    }

    setFilteredItems(filtered);
  }, [itemSearchTerm, cachedItems, cachedVessels, formData.vesselId]);

  // Calculate total amount
  const totalAmount = formData.items.reduce((sum, item) => sum + item.totalPrice, 0);

  // Handle form field changes
  const handleFormChange = useCallback((field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Handle item form changes
  const handleItemChange = useCallback((field: keyof ItemFormData, value: any) => {
    setCurrentItem(prev => {
      const updated = { ...prev, [field]: value };
      
      // Auto-calculate total price when quantity or unit price changes
      if (field === 'quantity' || field === 'unitPrice') {
        // Total price calculation is handled when adding the item
      }
      
      return updated;
    });
  }, []);

  // Add item to requisition
  const addItem = useCallback(() => {
    if (!currentItem.itemCatalogId || currentItem.quantity <= 0) {
      return;
    }

    const selectedCatalogItem = cachedItems.find(item => item.id === currentItem.itemCatalogId);
    if (!selectedCatalogItem) {
      return;
    }

    const newItem: OfflineRequisitionItem = {
      id: '', // Will be set when synced
      tempId: offlineStorage.generateTempId(),
      itemCatalogId: currentItem.itemCatalogId,
      quantity: currentItem.quantity,
      unitPrice: currentItem.unitPrice || selectedCatalogItem.averagePrice || 0,
      totalPrice: currentItem.quantity * (currentItem.unitPrice || selectedCatalogItem.averagePrice || 0),
      urgencyLevel: currentItem.urgencyLevel,
      justification: currentItem.justification,
      specifications: selectedCatalogItem.specifications
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));

    // Reset item form
    setCurrentItem({
      itemCatalogId: '',
      quantity: 1,
      unitPrice: 0,
      urgencyLevel: 'ROUTINE',
      justification: ''
    });
    setShowItemSearch(false);
    setItemSearchTerm('');
  }, [currentItem, cachedItems]);

  // Remove item from requisition
  const removeItem = useCallback((tempId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.tempId !== tempId)
    }));
  }, []);

  // Submit requisition
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      setSubmitError('Please add at least one item to the requisition');
      return;
    }

    if (!formData.vesselId) {
      setSubmitError('Please select a vessel');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const requisition: OfflineRequisition = {
        id: '', // Will be set when synced to server
        tempId: offlineStorage.generateTempId(),
        vesselId: formData.vesselId,
        requestedById: '', // Will be set from current user context
        urgencyLevel: formData.urgencyLevel,
        status: 'PENDING_SYNC',
        totalAmount,
        currency: formData.currency,
        deliveryLocation: formData.deliveryLocation,
        deliveryDate: formData.deliveryDate,
        justification: formData.justification,
        items: formData.items,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isOfflineCreated: true
      };

      // Save to offline storage
      saveOfflineRequisition(requisition);

      // Call onSubmit callback if provided
      onSubmit?.(requisition);

      // Reset form
      setFormData({
        vesselId: initialVesselId || '',
        urgencyLevel: 'ROUTINE',
        deliveryLocation: '',
        deliveryDate: '',
        justification: '',
        currency: 'USD',
        items: []
      });

    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save requisition');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, totalAmount, saveOfflineRequisition, onSubmit, initialVesselId]);

  // Select item from search
  const selectItem = useCallback((item: any) => {
    setCurrentItem(prev => ({
      ...prev,
      itemCatalogId: item.id,
      unitPrice: item.averagePrice || 0
    }));
    setShowItemSearch(false);
    setItemSearchTerm('');
  }, []);

  const selectedCatalogItem = cachedItems.find(item => item.id === currentItem.itemCatalogId);

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Offline Status Banner */}
      {isOffline && (
        <div className="mb-4 p-3 bg-yellow-100 border border-yellow-400 rounded-md">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
            <span className="text-yellow-800 text-sm font-medium">
              Working Offline - Requisition will sync when connection is restored
              {pendingSyncCount > 0 && ` (${pendingSyncCount} items pending sync)`}
            </span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {isOffline ? 'Create Offline Requisition' : 'Create Requisition'}
          </h2>
          <div className="flex space-x-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vessel *
            </label>
            <select
              value={formData.vesselId}
              onChange={(e) => handleFormChange('vesselId', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="">Select Vessel</option>
              {cachedVessels.map(vessel => (
                <option key={vessel.id} value={vessel.id}>
                  {vessel.name} ({vessel.imoNumber})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Urgency Level *
            </label>
            <select
              value={formData.urgencyLevel}
              onChange={(e) => handleFormChange('urgencyLevel', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="ROUTINE">Routine</option>
              <option value="URGENT">Urgent</option>
              <option value="EMERGENCY">Emergency</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delivery Location
            </label>
            <input
              type="text"
              value={formData.deliveryLocation}
              onChange={(e) => handleFormChange('deliveryLocation', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Port or delivery address"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Required Delivery Date
            </label>
            <input
              type="date"
              value={formData.deliveryDate}
              onChange={(e) => handleFormChange('deliveryDate', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency
            </label>
            <select
              value={formData.currency}
              onChange={(e) => handleFormChange('currency', e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
              <option value="SGD">SGD</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Justification
          </label>
          <textarea
            value={formData.justification}
            onChange={(e) => handleFormChange('justification', e.target.value)}
            rows={3}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Explain why this requisition is needed..."
          />
        </div>

        {/* Items Section */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Items</h3>
          
          {/* Add Item Form */}
          <div className="bg-gray-50 p-4 rounded-md mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <div className="lg:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={selectedCatalogItem ? selectedCatalogItem.name : itemSearchTerm}
                    onChange={(e) => {
                      setItemSearchTerm(e.target.value);
                      setShowItemSearch(true);
                      if (!e.target.value) {
                        setCurrentItem(prev => ({ ...prev, itemCatalogId: '' }));
                      }
                    }}
                    onFocus={() => setShowItemSearch(true)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Search for items..."
                  />
                  
                  {showItemSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {filteredItems.length > 0 ? (
                        filteredItems.map(item => (
                          <div
                            key={item.id}
                            onClick={() => selectItem(item)}
                            className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900">{item.name}</div>
                            <div className="text-sm text-gray-600">
                              {item.impaCode && `IMPA: ${item.impaCode}`}
                              {item.issaCode && ` | ISSA: ${item.issaCode}`}
                            </div>
                            <div className="text-sm text-gray-500">
                              {item.category} | {item.criticalityLevel}
                              {item.averagePrice && ` | $${item.averagePrice}`}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-3 text-gray-500 text-center">
                          {isOffline ? 'No cached items found' : 'No items found'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={currentItem.quantity}
                  onChange={(e) => handleItemChange('quantity', parseInt(e.target.value) || 1)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit Price
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentItem.unitPrice}
                  onChange={(e) => handleItemChange('unitPrice', parseFloat(e.target.value) || 0)}
                  className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder={selectedCatalogItem?.averagePrice?.toString() || '0.00'}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={addItem}
                disabled={!currentItem.itemCatalogId || currentItem.quantity <= 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Add Item
              </button>
            </div>
          </div>

          {/* Items List */}
          {formData.items.length > 0 && (
            <div className="space-y-2">
              {formData.items.map((item, index) => {
                const catalogItem = cachedItems.find(ci => ci.id === item.itemCatalogId);
                return (
                  <div key={item.tempId} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {catalogItem?.name || 'Unknown Item'}
                      </div>
                      <div className="text-sm text-gray-600">
                        Qty: {item.quantity} × ${item.unitPrice.toFixed(2)} = ${item.totalPrice.toFixed(2)}
                      </div>
                      {item.urgencyLevel !== 'ROUTINE' && (
                        <div className="text-sm font-medium text-orange-600">
                          {item.urgencyLevel}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.tempId)}
                      className="ml-4 text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
              
              <div className="text-right font-semibold text-lg text-gray-900">
                Total: {formData.currency} {totalAmount.toFixed(2)}
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {submitError && (
          <div className="p-3 bg-red-100 border border-red-400 rounded-md">
            <span className="text-red-800 text-sm">{submitError}</span>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="submit"
            disabled={isSubmitting || formData.items.length === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
          >
            {isSubmitting && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            )}
            {isOffline ? 'Save Offline' : 'Create Requisition'}
          </button>
        </div>
      </form>
    </div>
  );
};