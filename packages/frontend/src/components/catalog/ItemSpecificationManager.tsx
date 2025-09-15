import React, { useState, useEffect } from 'react';

interface SpecificationTemplate {
  [key: string]: any;
}

interface ItemSpecification {
  [key: string]: any;
}

interface ItemSpecificationManagerProps {
  itemId: string;
  category: string;
  currentSpecifications?: ItemSpecification;
  onSpecificationsUpdate?: (specifications: ItemSpecification) => void;
  readOnly?: boolean;
}

const SPECIFICATION_FIELD_TYPES = {
  text: 'text',
  number: 'number',
  select: 'select',
  multiselect: 'multiselect',
  date: 'date',
  boolean: 'boolean',
  object: 'object',
  array: 'array'
};

export const ItemSpecificationManager: React.FC<ItemSpecificationManagerProps> = ({
  itemId,
  category,
  currentSpecifications = {},
  onSpecificationsUpdate,
  readOnly = false
}) => {
  const [specifications, setSpecifications] = useState<ItemSpecification>(currentSpecifications);
  const [template, setTemplate] = useState<SpecificationTemplate>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['basic']));

  // Load specification template for the category
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const response = await fetch(`/api/item-catalog/specifications/templates?category=${category}`);
        const data = await response.json();
        
        if (data.success) {
          setTemplate(data.data);
          // Expand all sections by default
          setExpandedSections(new Set(Object.keys(data.data)));
        }
      } catch (error) {
        console.error('Error loading specification template:', error);
      }
    };

    if (category) {
      loadTemplate();
    }
  }, [category]);

  const handleSpecificationChange = (path: string, value: any) => {
    const newSpecifications = { ...specifications };
    
    // Handle nested paths (e.g., "dimensions.length")
    const pathParts = path.split('.');
    let current = newSpecifications;
    
    for (let i = 0; i < pathParts.length - 1; i++) {
      const part = pathParts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[pathParts[pathParts.length - 1]] = value;
    
    setSpecifications(newSpecifications);
    onSpecificationsUpdate?.(newSpecifications);
  };

  const getNestedValue = (obj: any, path: string) => {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  };

  const saveSpecifications = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/item-catalog/${itemId}/specifications`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ specifications }),
      });

      const data = await response.json();
      
      if (data.success) {
        // Show success message
        console.log('Specifications saved successfully');
      } else {
        throw new Error(data.error || 'Failed to save specifications');
      }
    } catch (error) {
      console.error('Error saving specifications:', error);
      // Show error message
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (sectionKey: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionKey)) {
      newExpanded.delete(sectionKey);
    } else {
      newExpanded.add(sectionKey);
    }
    setExpandedSections(newExpanded);
  };

  const renderField = (fieldKey: string, fieldConfig: any, parentPath = '') => {
    const fullPath = parentPath ? `${parentPath}.${fieldKey}` : fieldKey;
    const currentValue = getNestedValue(specifications, fullPath);
    
    if (typeof fieldConfig === 'object' && fieldConfig !== null && !Array.isArray(fieldConfig)) {
      // Check if this is a field configuration or nested object
      if (fieldConfig.hasOwnProperty('value') || fieldConfig.hasOwnProperty('unit') || fieldConfig.hasOwnProperty('required')) {
        // This is a field configuration
        return renderInputField(fieldKey, fieldConfig, fullPath, currentValue);
      } else {
        // This is a nested object
        return (
          <div key={fullPath} className="space-y-3">
            <h4 className="font-medium text-gray-900 capitalize">
              {fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
            </h4>
            <div className="pl-4 space-y-3">
              {Object.entries(fieldConfig).map(([nestedKey, nestedConfig]) =>
                renderField(nestedKey, nestedConfig, fullPath)
              )}
            </div>
          </div>
        );
      }
    }
    
    return renderInputField(fieldKey, fieldConfig, fullPath, currentValue);
  };

  const renderInputField = (fieldKey: string, fieldConfig: any, fullPath: string, currentValue: any) => {
    const label = fieldKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    
    // Handle different field types
    if (typeof fieldConfig === 'string') {
      // Simple string field
      return (
        <div key={fullPath} className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <input
            type="text"
            value={currentValue || ''}
            onChange={(e) => handleSpecificationChange(fullPath, e.target.value)}
            disabled={readOnly}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
          />
        </div>
      );
    }

    if (typeof fieldConfig === 'object' && fieldConfig.hasOwnProperty('value')) {
      // Object with value and unit
      return (
        <div key={fullPath} className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={getNestedValue(specifications, `${fullPath}.value`) || ''}
              onChange={(e) => handleSpecificationChange(`${fullPath}.value`, e.target.value)}
              disabled={readOnly}
              placeholder="Value"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
            />
            {fieldConfig.unit && (
              <input
                type="text"
                value={getNestedValue(specifications, `${fullPath}.unit`) || fieldConfig.unit}
                onChange={(e) => handleSpecificationChange(`${fullPath}.unit`, e.target.value)}
                disabled={readOnly}
                placeholder="Unit"
                className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              />
            )}
          </div>
        </div>
      );
    }

    if (Array.isArray(fieldConfig)) {
      // Array field (multiselect or list)
      return (
        <div key={fullPath} className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <div className="space-y-2">
            {(currentValue || []).map((item: any, index: number) => (
              <div key={index} className="flex space-x-2">
                <input
                  type="text"
                  value={item}
                  onChange={(e) => {
                    const newArray = [...(currentValue || [])];
                    newArray[index] = e.target.value;
                    handleSpecificationChange(fullPath, newArray);
                  }}
                  disabled={readOnly}
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                />
                {!readOnly && (
                  <button
                    onClick={() => {
                      const newArray = [...(currentValue || [])];
                      newArray.splice(index, 1);
                      handleSpecificationChange(fullPath, newArray);
                    }}
                    className="px-2 py-2 text-red-600 hover:text-red-800"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
            {!readOnly && (
              <button
                onClick={() => {
                  const newArray = [...(currentValue || []), ''];
                  handleSpecificationChange(fullPath, newArray);
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Add {label}
              </button>
            )}
          </div>
        </div>
      );
    }

    // Default text field
    return (
      <div key={fullPath} className="space-y-1">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <input
          type="text"
          value={currentValue || ''}
          onChange={(e) => handleSpecificationChange(fullPath, e.target.value)}
          disabled={readOnly}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
        />
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading specifications...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Item Specifications</h3>
        {!readOnly && (
          <button
            onClick={saveSpecifications}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Specifications'}
          </button>
        )}
      </div>

      {Object.keys(template).length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.47-.881-6.08-2.33" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No specification template</h3>
            <p className="mt-1 text-sm text-gray-500">
              No specification template available for category: {category}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(template).map(([sectionKey, sectionConfig]) => (
            <div key={sectionKey} className="border border-gray-200 rounded-lg">
              <button
                onClick={() => toggleSection(sectionKey)}
                className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 rounded-t-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900 capitalize">
                    {sectionKey.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </h4>
                  <svg
                    className={`h-5 w-5 text-gray-500 transform transition-transform ${
                      expandedSections.has(sectionKey) ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {expandedSections.has(sectionKey) && (
                <div className="px-4 py-4 space-y-4">
                  {typeof sectionConfig === 'object' && sectionConfig !== null ? (
                    Object.entries(sectionConfig).map(([fieldKey, fieldConfig]) =>
                      renderField(fieldKey, fieldConfig, sectionKey)
                    )
                  ) : (
                    renderField(sectionKey, sectionConfig)
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Custom Specifications */}
      <div className="border border-gray-200 rounded-lg">
        <button
          onClick={() => toggleSection('custom')}
          className="w-full px-4 py-3 text-left bg-gray-50 hover:bg-gray-100 rounded-t-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">Custom Specifications</h4>
            <svg
              className={`h-5 w-5 text-gray-500 transform transition-transform ${
                expandedSections.has('custom') ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        
        {expandedSections.has('custom') && (
          <div className="px-4 py-4">
            <div className="space-y-3">
              {Object.entries(specifications)
                .filter(([key]) => !Object.keys(template).includes(key))
                .map(([key, value]) => (
                  <div key={key} className="flex space-x-2">
                    <input
                      type="text"
                      value={key}
                      onChange={(e) => {
                        const newSpecs = { ...specifications };
                        delete newSpecs[key];
                        newSpecs[e.target.value] = value;
                        setSpecifications(newSpecs);
                      }}
                      disabled={readOnly}
                      placeholder="Property name"
                      className="w-1/3 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                    />
                    <input
                      type="text"
                      value={typeof value === 'object' ? JSON.stringify(value) : value}
                      onChange={(e) => {
                        let newValue;
                        try {
                          newValue = JSON.parse(e.target.value);
                        } catch {
                          newValue = e.target.value;
                        }
                        handleSpecificationChange(key, newValue);
                      }}
                      disabled={readOnly}
                      placeholder="Value"
                      className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
                    />
                    {!readOnly && (
                      <button
                        onClick={() => {
                          const newSpecs = { ...specifications };
                          delete newSpecs[key];
                          setSpecifications(newSpecs);
                        }}
                        className="px-2 py-2 text-red-600 hover:text-red-800"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              
              {!readOnly && (
                <button
                  onClick={() => {
                    const newKey = `custom_${Date.now()}`;
                    handleSpecificationChange(newKey, '');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Custom Specification
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemSpecificationManager;