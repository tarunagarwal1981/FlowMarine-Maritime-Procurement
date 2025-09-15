/**
 * Requisition Form Component
 * Main form for creating and editing requisitions with vessel location capture and validation
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useCreateRequisitionMutation, useUpdateRequisitionMutation, Requisition } from '../../store/api/requisitionApi';
import { useGetVesselsQuery } from '../../store/api/vesselApi';
import { useGetItemCatalogQuery } from '../../store/api/itemCatalogApi';

interface RequisitionFormProps {
  requisition?: Requisition;
  vesselId?: string;
  onSubmit?: (requisition: Requisition) => void;
  onCancel?: () => void;
  mode?: 'create' | 'edit';
}

interface FormData {
  vesselId: string;
  urgencyLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  deliveryLocation: string;
  deliveryDate: string;
  justification: string;
  currency: string;
  items: RequisitionItemData[];
}

interface RequisitionItemData {
  id?: string;
  itemCatalogId: string;
  quantity: number;
  unitPrice: number;
  urgencyLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  justification: string;
  specifications?: Record<string, any>;
}

interface ItemFormData {
  itemCatalogId: string;
  quantity: number;
  unitPrice: number;
  urgencyLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  justification: string;
}

export const RequisitionForm: React.FC<RequisitionFormProps> = ({
  requisition,
  vesselId: initialVesselId,
  onSubmit,
  onCancel,
  mode = 'create'
}) => {
  const [createRequisition, { isLoading: isCreating }] = useCreateRequisitionMutation();
  const [updateRequisition, { isLoading: isUpdating }] = useUpdateRequisitionMutation();
  const { data: vessels = [] } = useGetVesselsQuery();
  const { data: catalogItems = [] } = useGetItemCatalogQuery({});

  const [formData, setFormData] = useState<FormData>({
    vesselId: initialVesselId || requisition?.vesselId || '',
    urgencyLevel: requisition?.urgencyLevel || 'ROUTINE',
    deliveryLocation: requisition?.deliveryLocation || '',
    deliveryDate: requisition?.deliveryDate ? requisition.deliveryDate.split('T')[0] : '',
    justification: requisition?.justification || '',
    currency: requisition?.currency || 'USD',
    items: requisition?.items.map(item => ({
      id: item.id,
      itemCatalogId: item.itemCatalogId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      urgencyLevel: item.urgencyLevel,
      justification: item.justification || '',
      specifications: item.specifications
    })) || []
  });

  const [currentItem, setCurrentItem] = useState<ItemFormData>({
    itemCatalogId: '',
    quantity: 1,
    unitPrice: 0,
    urgencyLevel: 'ROUTINE',
    justification: ''
  });

  const [filteredItems, setFilteredItems] = useState(catalogItems);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);

  // Get current vessel for location capture
  const currentVessel = vessels.find(v => v.id === formData.vesselId);

  // Filter items based on search term and vessel compatibility
  useEffect(() => {
    let filtered = catalogItems;

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
    if (formData.vesselId && currentVessel) {
      filtered = filtered.filter(item =>
        item.compatibleVesselTypes.includes(currentVessel.vesselType) ||
        item.compatibleEngineTypes.includes(currentVessel.engineType)
      );
    }

    setFilteredItems(filtered);
  }, [itemSearchTerm, catalogItems, formData.vesselId, currentVessel]);

  // Auto-populate delivery location from vessel position
  useEffect(() => {
    if (currentVessel && !formData.deliveryLocation) {
      let location = '';
      
      if (currentVessel.currentDestination) {
        location = currentVessel.currentDestination;
      } else if (currentVessel.currentLatitude && currentVessel.currentLongitude) {
        location = `${currentVessel.currentLatitude.toFixed(4)}, ${currentVessel.currentLongitude.toFixed(4)}`;
      }
      
      if (location) {
        setFormData(prev => ({ ...prev, deliveryLocation: location }));
      }
    }
  }, [currentVessel, formData.deliveryLocation]);

  // Calculate total amount
  const totalAmount = formData.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  // Handle form field changes
  const handleFormChange = useCallback((field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setValidationErrors([]);
    setValidationWarnings([]);
  }, []);

  // Handle item form changes
  const handleItemChange = useCallback((field: keyof ItemFormData, value: any) => {
    setCurrentItem(prev => ({ ...prev, [field]: value }));
  }, []);

  // Add item to requisition
  const addItem = useCallback(() => {
    if (!currentItem.itemCatalogId || currentItem.quantity <= 0) {
      return;
    }

    const selectedCatalogItem = catalogItems.find(item => item.id === currentItem.itemCatalogId);
    if (!selectedCatalogItem) {
      return;
    }

    const newItem: RequisitionItemData = {
      itemCatalogId: currentItem.itemCatalogId,
      quantity: currentItem.quantity,
      unitPrice: currentItem.unitPrice || selectedCatalogItem.averagePrice || 0,
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
  }, [currentItem, catalogItems]);

  // Remove item from requisition
  const removeItem = useCallback((index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  }, []);

  // Validate form
  const validateForm = useCallback(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!formData.vesselId) {
      errors.push('Please select a vessel');
    }

    if (formData.items.length === 0) {
      errors.push('Please add at least one item');
    }

    if (totalAmount <= 0) {
      errors.push('Total amount must be greater than zero');
    }

    // Emergency requisitions need justification
    if (formData.urgencyLevel === 'EMERGENCY' && !formData.justification) {
      errors.push('Emergency requisitions require justification');
    }

    // Check delivery date
    if (formData.deliveryDate && new Date(formData.deliveryDate) < new Date()) {
      errors.push('Delivery date cannot be in the past');
    }

    // Validate items
    formData.items.forEach((item, index) => {
      if (item.quantity <= 0) {
        errors.push(`Item ${index + 1}: Quantity must be greater than zero`);
      }
      if (item.unitPrice < 0) {
        errors.push(`Item ${index + 1}: Unit price cannot be negative`);
      }

      // Check criticality vs urgency alignment
      const catalogItem = catalogItems.find(ci => ci.id === item.itemCatalogId);
      if (catalogItem?.criticalityLevel === 'SAFETY_CRITICAL' && item.urgencyLevel === 'ROUTINE') {
        warnings.push(`Item ${index + 1}: Safety critical item marked as routine urgency`);
      }
    });

    setValidationErrors(errors);
    setValidationWarnings(warnings);

    return errors.length === 0;
  }, [formData, totalAmount, catalogItems]);

  // Submit form
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitError(null);

    try {
      const submitData = {
        vesselId: formData.vesselId,
        urgencyLevel: formData.urgencyLevel,
        totalAmount,
        currency: formData.currency,
        deliveryLocation: formData.deliveryLocation,
        deliveryDate: formData.deliveryDate,
        justification: formData.justification,
        items: formData.items.map(item => ({
          itemCatalogId: item.itemCatalogId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          urgencyLevel: item.urgencyLevel,
          justification: item.justification,
          specifications: item.specifications
        }))
      };

      let result;
      if (mode === 'edit' && requisition) {
        result = await updateRequisition({ id: requisition.id, updates: submitData }).unwrap();
      } else {
        result = await createRequisition(submitData).unwrap();
      }

      onSubmit?.(result);
    } catch (error: any) {
      setSubmitError(error.data?.message || error.message || 'Failed to save requisition');
    }
  }, [formData, totalAmount, validateForm, mode, requisition, createRequisition, updateRequisition, onSubmit]);

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

  const selectedCatalogItem = catalogItems.find(item => item.id === currentItem.itemCatalogId);
  const isSubmitting = isCreating || isUpdating;

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">
            {mode === 'edit' ? 'Edit Requisition' : 'Create Requisition'}
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

        {/* Vessel Information Display */}
        {currentVessel && (
          <div className="bg-blue-50 p-4 rounded-md">
            <h3 className="font-medium text-blue-900 mb-2">Vessel Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Name:</span> {currentVessel.name}
              </div>
              <div>
                <span className="font-medium">IMO:</span> {currentVessel.imoNumber}
              </div>
              <div>
                <span className="font-medium">Type:</span> {currentVessel.vesselType}
              </div>
              <div>
                <span className="font-medium">Engine:</span> {currentVessel.engineType}
              </div>
              {currentVessel.currentDestination && (
                <div>
                  <span className="font-medium">Destination:</span> {currentVessel.currentDestination}
                </div>
              )}
              {currentVessel.currentETA && (
                <div>
                  <span className="font-medium">ETA:</span> {new Date(currentVessel.currentETA).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )}

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
              disabled={mode === 'edit'}
            >
              <option value="">Select Vessel</option>
              {vessels.map(vessel => (
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
            Justification {formData.urgencyLevel === 'EMERGENCY' && '*'}
          </label>
          <textarea
            value={formData.justification}
            onChange={(e) => handleFormChange('justification', e.target.value)}
            rows={3}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Explain why this requisition is needed..."
            required={formData.urgencyLevel === 'EMERGENCY'}
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
                          No items found
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
                const catalogItem = catalogItems.find(ci => ci.id === item.itemCatalogId);
                return (
                  <div key={index} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-md">
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">
                        {catalogItem?.name || 'Unknown Item'}
                      </div>
                      <div className="text-sm text-gray-600">
                        Qty: {item.quantity} × ${item.unitPrice.toFixed(2)} = ${(item.quantity * item.unitPrice).toFixed(2)}
                      </div>
                      {item.urgencyLevel !== 'ROUTINE' && (
                        <div className="text-sm font-medium text-orange-600">
                          {item.urgencyLevel}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
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

        {/* Validation Messages */}
        {validationWarnings.length > 0 && (
          <div className="p-3 bg-yellow-100 border border-yellow-400 rounded-md">
            <h4 className="font-medium text-yellow-800 mb-1">Warnings:</h4>
            <ul className="text-sm text-yellow-700 list-disc list-inside">
              {validationWarnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {validationErrors.length > 0 && (
          <div className="p-3 bg-red-100 border border-red-400 rounded-md">
            <h4 className="font-medium text-red-800 mb-1">Errors:</h4>
            <ul className="text-sm text-red-700 list-disc list-inside">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit Error */}
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
            {mode === 'edit' ? 'Update Requisition' : 'Create Requisition'}
          </button>
        </div>
      </form>
    </div>
  );
};