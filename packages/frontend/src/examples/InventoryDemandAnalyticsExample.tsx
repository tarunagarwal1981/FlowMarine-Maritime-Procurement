import React, { useState } from 'react';
import InventoryDemandAnalytics from '../components/analytics/InventoryDemandAnalytics';

/**
 * Example usage of the InventoryDemandAnalytics component
 * 
 * This component provides comprehensive inventory and demand analytics including:
 * - Inventory turnover analysis with category breakdown
 * - Demand forecasting with seasonal patterns
 * - Inventory optimization recommendations
 * - Stock level alerts and monitoring
 * - Predictive maintenance procurement planning
 */

const InventoryDemandAnalyticsExample: React.FC = () => {
  const [selectedVessels, setSelectedVessels] = useState<string[]>(['vessel1', 'vessel2']);
  const [timeRange, setTimeRange] = useState({
    start: new Date('2024-01-01'),
    end: new Date('2024-12-31')
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    'Engine Parts',
    'Safety Equipment',
    'Deck Equipment',
    'Navigation Equipment'
  ]);

  const handleVesselChange = (vesselIds: string[]) => {
    setSelectedVessels(vesselIds);
  };

  const handleTimeRangeChange = (start: Date, end: Date) => {
    setTimeRange({ start, end });
  };

  const handleCategoryChange = (categories: string[]) => {
    setSelectedCategories(categories);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Inventory & Demand Analytics Dashboard
          </h1>
          <p className="text-lg text-gray-600 mb-6">
            Comprehensive analytics for inventory management, demand forecasting, and optimization recommendations.
          </p>

          {/* Filter Controls */}
          <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Analytics Filters</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Vessel Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Vessels
                </label>
                <div className="space-y-2">
                  {['vessel1', 'vessel2', 'vessel3'].map((vesselId) => (
                    <label key={vesselId} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedVessels.includes(vesselId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleVesselChange([...selectedVessels, vesselId]);
                          } else {
                            handleVesselChange(selectedVessels.filter(id => id !== vesselId));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {vesselId === 'vessel1' ? 'MV Ocean Explorer' :
                         vesselId === 'vessel2' ? 'MV Sea Pioneer' :
                         'MV Maritime Star'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Time Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time Range
                </label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={timeRange.start.toISOString().split('T')[0]}
                    onChange={(e) => handleTimeRangeChange(new Date(e.target.value), timeRange.end)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                  <input
                    type="date"
                    value={timeRange.end.toISOString().split('T')[0]}
                    onChange={(e) => handleTimeRangeChange(timeRange.start, new Date(e.target.value))}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categories
                </label>
                <div className="space-y-2">
                  {['Engine Parts', 'Safety Equipment', 'Deck Equipment', 'Navigation Equipment'].map((category) => (
                    <label key={category} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedCategories.includes(category)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            handleCategoryChange([...selectedCategories, category]);
                          } else {
                            handleCategoryChange(selectedCategories.filter(cat => cat !== category));
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">{category}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Analytics Component */}
        <InventoryDemandAnalytics
          vesselIds={selectedVessels}
          timeRange={timeRange}
          categories={selectedCategories}
          className="mb-8"
        />

        {/* Usage Information */}
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Component Features
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-2">Inventory Turnover Analysis</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Category-wise turnover rate tracking</li>
                <li>• Inventory value distribution visualization</li>
                <li>• Slow-moving items identification</li>
                <li>• Performance against target rates</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Demand Forecasting</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Seasonal demand pattern analysis</li>
                <li>• Category-wise forecast visualization</li>
                <li>• Forecast accuracy metrics</li>
                <li>• Trend direction indicators</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Optimization Recommendations</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Inventory reduction opportunities</li>
                <li>• Optimal stock level calculations</li>
                <li>• Potential savings identification</li>
                <li>• Implementation priority scoring</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-2">Stock Alerts & Maintenance</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Critical stock level alerts</li>
                <li>• Predictive maintenance planning</li>
                <li>• Parts requirement forecasting</li>
                <li>• Risk assessment and prioritization</li>
              </ul>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Integration Notes</h4>
            <p className="text-sm text-blue-800">
              This component integrates with the inventory management system, demand forecasting algorithms, 
              and predictive maintenance modules. It provides real-time analytics and actionable insights 
              for optimizing inventory levels and reducing carrying costs while ensuring operational readiness.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryDemandAnalyticsExample;