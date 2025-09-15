import React, { useState, useEffect } from 'react';
import { MobileDashboard } from '../components/dashboard/mobile/MobileDashboard';
import { TouchFriendlyChart } from '../components/dashboard/mobile/TouchFriendlyChart';
import { ResponsiveChartContainer } from '../components/dashboard/mobile/ResponsiveChartContainer';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { DashboardData } from '../types/dashboard';
import '../styles/mobile-dashboard.css';

// Sample data for charts
const fleetSpendData = [
  { name: 'Jan', value: 45000, budget: 50000 },
  { name: 'Feb', value: 52000, budget: 50000 },
  { name: 'Mar', value: 48000, budget: 50000 },
  { name: 'Apr', value: 61000, budget: 55000 },
  { name: 'May', value: 55000, budget: 55000 },
  { name: 'Jun', value: 67000, budget: 60000 },
];

const vendorPerformanceData = [
  { name: 'Vendor A', delivery: 95, quality: 88, price: 92 },
  { name: 'Vendor B', delivery: 87, quality: 94, price: 85 },
  { name: 'Vendor C', delivery: 92, quality: 90, price: 88 },
  { name: 'Vendor D', delivery: 89, quality: 85, price: 94 },
];

const categorySpendData = [
  { name: 'Engine Parts', value: 35, amount: 125000 },
  { name: 'Safety Equipment', value: 25, amount: 89000 },
  { name: 'Navigation', value: 20, amount: 71000 },
  { name: 'Catering', value: 12, amount: 43000 },
  { name: 'Maintenance', value: 8, amount: 28000 },
];

export const MobileDashboardExample: React.FC = () => {
  const [currentDashboard, setCurrentDashboard] = useState('executive');
  const [isLoading, setIsLoading] = useState(false);

  // Sample dashboard configurations
  const dashboards: DashboardData[] = [
    {
      id: 'executive',
      type: 'executive',
      title: 'Executive Dashboard',
      layout: {
        widgets: [],
        layout: []
      },
      widgets: [
        {
          id: 'fleet-spend',
          type: 'chart',
          title: 'Fleet Spend vs Budget',
          configuration: { 
            chartType: 'line',
            data: fleetSpendData,
            xKey: 'name',
            yKey: 'value'
          },
          permissions: ['view_analytics']
        },
        {
          id: 'category-breakdown',
          type: 'chart',
          title: 'Spend by Category',
          configuration: { 
            chartType: 'pie',
            data: categorySpendData,
            xKey: 'name',
            yKey: 'value'
          },
          permissions: ['view_analytics']
        },
        {
          id: 'budget-utilization',
          type: 'kpi',
          title: 'Budget Utilization',
          configuration: { 
            value: 87,
            target: 85,
            format: 'percentage',
            trend: 'up'
          },
          permissions: ['view_budget']
        },
        {
          id: 'cost-savings',
          type: 'kpi',
          title: 'Cost Savings YTD',
          configuration: { 
            value: 245000,
            target: 200000,
            format: 'currency',
            trend: 'up'
          },
          permissions: ['view_analytics']
        }
      ]
    },
    {
      id: 'operational',
      type: 'operational',
      title: 'Operational Analytics',
      layout: {
        widgets: [],
        layout: []
      },
      widgets: [
        {
          id: 'vendor-performance',
          type: 'chart',
          title: 'Vendor Performance',
          configuration: { 
            chartType: 'bar',
            data: vendorPerformanceData,
            xKey: 'name',
            yKey: 'delivery'
          },
          permissions: ['view_operations']
        },
        {
          id: 'cycle-time',
          type: 'chart',
          title: 'Average Cycle Time',
          configuration: { 
            chartType: 'line',
            data: [
              { name: 'Week 1', value: 12 },
              { name: 'Week 2', value: 10 },
              { name: 'Week 3', value: 8 },
              { name: 'Week 4', value: 9 },
            ],
            xKey: 'name',
            yKey: 'value'
          },
          permissions: ['view_operations']
        },
        {
          id: 'delivery-performance',
          type: 'kpi',
          title: 'On-Time Delivery',
          configuration: { 
            value: 94,
            target: 95,
            format: 'percentage',
            trend: 'down'
          },
          permissions: ['view_operations']
        }
      ]
    },
    {
      id: 'financial',
      type: 'financial',
      title: 'Financial Insights',
      layout: {
        widgets: [],
        layout: []
      },
      widgets: [
        {
          id: 'currency-breakdown',
          type: 'chart',
          title: 'Multi-Currency Spend',
          configuration: { 
            chartType: 'pie',
            data: [
              { name: 'USD', value: 60, amount: 2100000 },
              { name: 'EUR', value: 25, amount: 875000 },
              { name: 'GBP', value: 10, amount: 350000 },
              { name: 'SGD', value: 5, amount: 175000 },
            ],
            xKey: 'name',
            yKey: 'value'
          },
          permissions: ['view_financial']
        },
        {
          id: 'payment-terms',
          type: 'chart',
          title: 'Payment Terms Optimization',
          configuration: { 
            chartType: 'bar',
            data: [
              { name: 'Net 30', current: 45, optimized: 35 },
              { name: 'Net 60', current: 30, optimized: 25 },
              { name: 'Net 90', current: 20, optimized: 15 },
              { name: 'Immediate', current: 5, optimized: 25 },
            ],
            xKey: 'name',
            yKey: 'current'
          },
          permissions: ['view_financial']
        }
      ]
    }
  ];

  const handleDataRefresh = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      console.log('Dashboard data refreshed');
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDashboardChange = (dashboardId: string) => {
    setCurrentDashboard(dashboardId);
    console.log('Switched to dashboard:', dashboardId);
  };

  return (
    <div className="mobile-dashboard-example">
      {/* Mobile Dashboard */}
      <MobileDashboard
        dashboards={dashboards}
        currentDashboard={currentDashboard}
        onDashboardChange={handleDashboardChange}
        onDataRefresh={handleDataRefresh}
      />

      {/* Demo Controls (only visible on desktop) */}
      <div className="hidden lg:block fixed top-4 right-4 z-50">
        <Card className="w-80">
          <CardHeader>
            <CardTitle className="text-sm">Mobile Dashboard Demo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Current Dashboard:</label>
              <select
                value={currentDashboard}
                onChange={(e) => setCurrentDashboard(e.target.value)}
                className="w-full mt-1 p-2 border rounded"
              >
                {dashboards.map(dashboard => (
                  <option key={dashboard.id} value={dashboard.id}>
                    {dashboard.title}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={handleDataRefresh}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Refreshing...' : 'Refresh Data'}
            </Button>

            <div className="text-xs text-gray-500">
              <p>• Resize browser to mobile width to see mobile layout</p>
              <p>• Use touch gestures on mobile devices</p>
              <p>• Test offline mode by disabling network</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Individual Chart Examples */}
      <div className="hidden lg:block p-8 space-y-8 bg-gray-50 min-h-screen">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Mobile Dashboard Components</h1>
          
          <div className="grid gap-8">
            {/* Touch-Friendly Chart Examples */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">Touch-Friendly Charts</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <TouchFriendlyChart
                  data={fleetSpendData}
                  type="line"
                  title="Fleet Spend Trend"
                  xKey="name"
                  yKey="value"
                />
                
                <TouchFriendlyChart
                  data={vendorPerformanceData}
                  type="bar"
                  title="Vendor Performance"
                  xKey="name"
                  yKey="delivery"
                />
                
                <TouchFriendlyChart
                  data={categorySpendData}
                  type="pie"
                  title="Category Breakdown"
                  xKey="name"
                  yKey="value"
                />
              </div>
            </section>

            {/* Responsive Chart Container Examples */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">Responsive Chart Containers</h2>
              <div className="space-y-6">
                <ResponsiveChartContainer
                  data={fleetSpendData}
                  type="line"
                  title="Responsive Line Chart"
                  xKey="name"
                  yKey="value"
                />
                
                <ResponsiveChartContainer
                  data={categorySpendData}
                  type="bar"
                  title="Responsive Bar Chart"
                  xKey="name"
                  yKey="value"
                />
              </div>
            </section>

            {/* Usage Instructions */}
            <section>
              <h2 className="text-2xl font-semibold mb-4">Usage Instructions</h2>
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold">Mobile Features:</h3>
                      <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                        <li>Touch-friendly navigation with swipe gestures</li>
                        <li>Responsive charts that adapt to screen size and orientation</li>
                        <li>Offline viewing capabilities with data caching</li>
                        <li>Pull-to-refresh functionality</li>
                        <li>Pinch-to-zoom and pan gestures for charts</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold">Accessibility:</h3>
                      <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                        <li>Minimum 44px touch targets</li>
                        <li>High contrast mode support</li>
                        <li>Reduced motion preferences respected</li>
                        <li>Screen reader compatible</li>
                        <li>Keyboard navigation support</li>
                      </ul>
                    </div>
                    
                    <div>
                      <h3 className="font-semibold">Performance:</h3>
                      <ul className="list-disc list-inside text-sm space-y-1 mt-2">
                        <li>Lazy loading of chart components</li>
                        <li>Efficient data caching for offline use</li>
                        <li>Optimized for mobile network conditions</li>
                        <li>Progressive Web App capabilities</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};