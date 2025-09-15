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
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800">Analytics</h1>
          <p className="text-slate-600 mt-2">
            Procurement insights and performance metrics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
          >
            <option value="1month">Last Month</option>
            <option value="3months">Last 3 Months</option>
            <option value="6months">Last 6 Months</option>
            <option value="1year">Last Year</option>
          </select>
          <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 flex items-center space-x-2">
            <Filter className="h-4 w-4" />
            <span>Filters</span>
          </Button>
          <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
          <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 p-2.5">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiMetrics.map((metric, index) => {
          const IconComponent = metric.icon;
          return (
            <Card key={index} className="p-6 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">{metric.title}</p>
                  <p className="text-2xl font-semibold text-slate-800 mt-2">{metric.value}</p>
                  <div className="flex items-center mt-3">
                    {getTrendIcon(metric.trend)}
                    <span className={`text-sm font-medium ml-1 ${
                      metric.trend === 'up' ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                      {metric.change}
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm">
                  <IconComponent className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending by Category */}
        <Card className="p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Spending by Category</h2>
            <div className="p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
              <PieChart className="h-5 w-5 text-blue-600" />
            </div>
          </div>
          <div className="space-y-4">
            {spendingData.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-lg hover:bg-slate-50 transition-colors duration-200">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-3">
                    <div 
                      className="w-3 h-3 rounded-full shadow-sm"
                      style={{ backgroundColor: `hsl(${index * 60}, 70%, 50%)` }}
                    />
                    <span className="font-medium text-slate-800">{item.category}</span>
                  </div>
                  {getTrendIcon(item.trend)}
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">${item.amount.toLocaleString()}</p>
                  <p className="text-sm text-slate-500">{item.percentage}%</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Monthly Trends */}
        <Card className="p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-800">Monthly Trends</h2>
            <div className="p-2 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg">
              <BarChart3 className="h-5 w-5 text-emerald-600" />
            </div>
          </div>
          <div className="space-y-3">
            {monthlyTrends.map((month, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-50/50 rounded-lg hover:bg-slate-50 transition-colors duration-200">
                <div>
                  <p className="font-semibold text-slate-800">{month.month} 2024</p>
                  <p className="text-sm text-slate-600">{month.requisitions} requisitions</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-slate-800">${month.spending.toLocaleString()}</p>
                  <p className="text-sm text-emerald-600 font-medium">+${month.savings.toLocaleString()} saved</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Vessel Performance */}
      <Card className="p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-800">Vessel Spending Analysis</h2>
          <select
            value={selectedVessel}
            onChange={(e) => setSelectedVessel(e.target.value)}
            className="px-4 py-2.5 bg-white/80 backdrop-blur-sm border border-slate-200/60 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200"
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
              <tr className="border-b border-slate-200">
                <th className="text-left py-4 px-3 font-semibold text-slate-600 text-sm">Vessel</th>
                <th className="text-left py-4 px-3 font-semibold text-slate-600 text-sm">Total Spending</th>
                <th className="text-left py-4 px-3 font-semibold text-slate-600 text-sm">Requisitions</th>
                <th className="text-left py-4 px-3 font-semibold text-slate-600 text-sm">Efficiency Score</th>
                <th className="text-left py-4 px-3 font-semibold text-slate-600 text-sm">Avg per Requisition</th>
              </tr>
            </thead>
            <tbody>
              {vesselSpending.map((vessel, index) => (
                <tr key={index} className={`${index % 2 === 0 ? 'bg-slate-50/30' : 'bg-white/50'} hover:bg-slate-50 transition-colors duration-200`}>
                  <td className="py-4 px-3">
                    <div className="flex items-center space-x-3">
                      <div className="p-1.5 bg-blue-100 rounded-lg">
                        <Ship className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="font-semibold text-slate-800">{vessel.vessel}</span>
                    </div>
                  </td>
                  <td className="py-4 px-3 font-semibold text-slate-800">
                    ${vessel.spending.toLocaleString()}
                  </td>
                  <td className="py-4 px-3 text-slate-700 font-medium">{vessel.requisitions}</td>
                  <td className="py-4 px-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-20 bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${vessel.efficiency}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-slate-800 min-w-[3rem]">{vessel.efficiency}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-3 font-semibold text-slate-800">
                    ${Math.round(vessel.spending / vessel.requisitions).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Vendor Performance */}
      <Card className="p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-800">Vendor Performance</h2>
          <Badge className="bg-emerald-100 text-emerald-800 font-medium">Top Performers</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-4 px-3 font-semibold text-slate-600 text-sm">Vendor</th>
                <th className="text-left py-4 px-3 font-semibold text-slate-600 text-sm">Orders</th>
                <th className="text-left py-4 px-3 font-semibold text-slate-600 text-sm">On-Time Delivery</th>
                <th className="text-left py-4 px-3 font-semibold text-slate-600 text-sm">Quality Score</th>
                <th className="text-left py-4 px-3 font-semibold text-slate-600 text-sm">Cost Rating</th>
              </tr>
            </thead>
            <tbody>
              {vendorPerformance.map((vendor, index) => (
                <tr key={index} className={`${index % 2 === 0 ? 'bg-slate-50/30' : 'bg-white/50'} hover:bg-slate-50 transition-colors duration-200`}>
                  <td className="py-4 px-3 font-semibold text-slate-800">{vendor.vendor}</td>
                  <td className="py-4 px-3 text-slate-700 font-medium">{vendor.orders}</td>
                  <td className="py-4 px-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-16 bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${vendor.onTime}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-slate-800 min-w-[3rem]">{vendor.onTime}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-16 bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300" 
                          style={{ width: `${vendor.quality}%` }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-slate-800 min-w-[3rem]">{vendor.quality}%</span>
                    </div>
                  </td>
                  <td className="py-4 px-3">
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