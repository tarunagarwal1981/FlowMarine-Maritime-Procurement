import React, { useState } from 'react';
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Package,
  Ship,
  Calendar,
  Filter,
  Download,
  RefreshCw
} from 'lucide-react';
import { Card, Badge, Button } from '../components/ui';

export const AnalyticsPage: React.FC = () => {
  const [timeRange, setTimeRange] = useState('3months');
  const [selectedVessel, setSelectedVessel] = useState('all');

  const spendingData = [
    { category: 'Engine Parts', amount: 125000, percentage: 35, trend: 'up' },
    { category: 'Safety Equipment', amount: 85000, percentage: 24, trend: 'up' },
    { category: 'Navigation Systems', amount: 65000, percentage: 18, trend: 'down' },
    { category: 'Deck Equipment', amount: 45000, percentage: 13, trend: 'up' },
    { category: 'Galley Supplies', amount: 35000, percentage: 10, trend: 'stable' }
  ];

  const vesselSpending = [
    { vessel: 'MV Ocean Explorer', spending: 145000, requisitions: 24, efficiency: 92 },
    { vessel: 'MV Atlantic Star', spending: 125000, requisitions: 18, efficiency: 88 },
    { vessel: 'MV Pacific Wind', spending: 98000, requisitions: 15, efficiency: 95 },
    { vessel: 'MV Nordic Star', spending: 87000, requisitions: 12, efficiency: 90 }
  ];

  const monthlyTrends = [
    { month: 'Oct', spending: 95000, requisitions: 18, savings: 8500 },
    { month: 'Nov', spending: 110000, requisitions: 22, savings: 12000 },
    { month: 'Dec', spending: 125000, requisitions: 25, savings: 15000 },
    { month: 'Jan', spending: 135000, requisitions: 28, savings: 18500 }
  ];

  const vendorPerformance = [
    { vendor: 'Maritime Supply Co.', orders: 45, onTime: 94, quality: 96, cost: 'Low' },
    { vendor: 'Ocean Parts Ltd.', orders: 38, onTime: 89, quality: 92, cost: 'Medium' },
    { vendor: 'Nautical Equipment Inc.', orders: 32, onTime: 97, quality: 98, cost: 'High' },
    { vendor: 'Ship Systems Pro', orders: 28, onTime: 91, quality: 94, cost: 'Medium' }
  ];

  const kpiMetrics = [
    {
      title: 'Total Spend (YTD)',
      value: '$1.2M',
      change: '+15.2%',
      trend: 'up',
      icon: DollarSign
    },
    {
      title: 'Cost Savings',
      value: '$185K',
      change: '+22.8%',
      trend: 'up',
      icon: TrendingUp
    },
    {
      title: 'Active Suppliers',
      value: '47',
      change: '+3',
      trend: 'up',
      icon: Package
    },
    {
      title: 'Avg. Delivery Time',
      value: '12.5 days',
      change: '-1.2 days',
      trend: 'down',
      icon: Calendar
    }
  ];

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'down': return <TrendingDown className="h-4 w-4 text-red-600" />;
      default: return <div className="h-4 w-4 bg-gray-400 rounded-full" />;
    }
  };

  const getCostColor = (cost: string) => {
    switch (cost) {
      case 'Low': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-600 mt-1">
            Procurement insights and performance metrics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1month">Last Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="1year">Last Year</option>
          </select>
          <Button variant="outline" className="flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiMetrics.map((metric, index) => {
          const IconComponent = metric.icon;
          return (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{metric.value}</p>
                  <div className="flex items-center mt-2">
                    {getTrendIcon(metric.trend)}
                    <span className={`text-sm font-medium ml-1 ${
                      metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {metric.change}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <IconComponent className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Spending by Category</h2>
            <PieChart className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {spendingData.map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                    />
                    <span className="font-medium text-gray-900">{item.category}</span>
                  </div>
                  {getTrendIcon(item.trend)}
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">${item.amount.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">{item.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Monthly Trends */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Monthly Trends</h2>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="space-y-4">
            {monthlyTrends.map((month, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{month.month} 2024</p>
                  <p className="text-sm text-gray-600">{month.requisitions} requisitions</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">${month.spending.toLocaleString()}</p>
                  <p className="text-sm text-green-600">+${month.savings.toLocaleString()} saved</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Vessel Performance */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Vessel Spending Analysis</h2>
          <select
            value={selectedVessel}
            onChange={(e) => setSelectedVessel(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Vessels</option>
            <option value="mv-ocean-explorer">MV Ocean Explorer</option>
            <option value="mv-atlantic-star">MV Atlantic Star</option>
            <option value="mv-pacific-wind">MV Pacific Wind</option>
            <option value="mv-nordic-star">MV Nordic Star</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-500">Vessel</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Total Spending</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Requisitions</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Efficiency Score</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Avg per Requisition</th>
              </tr>
            </thead>
            <tbody>
              {vesselSpending.map((vessel, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-3 px-2">
                    <div className="flex items-center space-x-2">
                      <Ship className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{vessel.vessel}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 font-medium text-gray-900">
                    ${vessel.spending.toLocaleString()}
                  </td>
                  <td className="py-3 px-2 text-gray-900">{vessel.requisitions}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${vessel.efficiency}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium text-gray-900">{vessel.efficiency}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-gray-900">
                    ${Math.round(vessel.spending / vessel.requisitions).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Vendor Performance */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Vendor Performance</h2>
          <Badge variant="outline">Top Performers</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-500">Vendor</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Orders</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">On-Time Delivery</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Quality Score</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Cost Rating</th>
              </tr>
            </thead>
            <tbody>
              {vendorPerformance.map((vendor, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-3 px-2 font-medium text-gray-900">{vendor.vendor}</td>
                  <td className="py-3 px-2 text-gray-900">{vendor.orders}</td>
                  <td className="py-3 px-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-12 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${vendor.onTime}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-900">{vendor.onTime}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-12 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${vendor.quality}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-900">{vendor.quality}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <Badge className={getCostColor(vendor.cost)}>
                      {vendor.cost}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};