import React, { useState } from 'react';
import {
  FileText,
  Download,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  TrendingUp,
  Clock,
  Eye,
  Share,
  Settings,
  Plus,
  RefreshCw
} from 'lucide-react';
import { Card, Badge, Button } from '../components/ui';

export const ReportsPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dateRange, setDateRange] = useState('last30days');

  const reportCategories = [
    { id: 'all', name: 'All Reports', count: 24 },
    { id: 'procurement', name: 'Procurement', count: 8 },
    { id: 'financial', name: 'Financial', count: 6 },
    { id: 'vendor', name: 'Vendor Performance', count: 4 },
    { id: 'inventory', name: 'Inventory', count: 3 },
    { id: 'compliance', name: 'Compliance', count: 3 }
  ];

  const reports = [
    {
      id: 'RPT-001',
      name: 'Monthly Procurement Summary',
      category: 'procurement',
      description: 'Comprehensive overview of monthly procurement activities',
      type: 'Scheduled',
      frequency: 'Monthly',
      lastGenerated: '2024-01-28',
      nextScheduled: '2024-02-28',
      status: 'active',
      format: 'PDF',
      size: '2.4 MB',
      recipients: ['procurement@company.com', 'finance@company.com'],
      parameters: {
        dateRange: 'Last Month',
        vessels: 'All Vessels',
        departments: 'All Departments'
      }
    },
    {
      id: 'RPT-002',
      name: 'Vendor Performance Scorecard',
      category: 'vendor',
      description: 'Detailed analysis of vendor performance metrics',
      type: 'On-Demand',
      frequency: 'Quarterly',
      lastGenerated: '2024-01-25',
      nextScheduled: '2024-04-25',
      status: 'active',
      format: 'Excel',
      size: '1.8 MB',
      recipients: ['procurement@company.com'],
      parameters: {
        dateRange: 'Last Quarter',
        vendors: 'Top 20 Vendors',
        metrics: 'All KPIs'
      }
    },
    {
      id: 'RPT-003',
      name: 'Cost Analysis Report',
      category: 'financial',
      description: 'Detailed breakdown of procurement costs by category',
      type: 'Scheduled',
      frequency: 'Weekly',
      lastGenerated: '2024-01-26',
      nextScheduled: '2024-02-02',
      status: 'active',
      format: 'PDF',
      size: '3.1 MB',
      recipients: ['finance@company.com', 'cfo@company.com'],
      parameters: {
        dateRange: 'Last Week',
        categories: 'All Categories',
        vessels: 'All Vessels'
      }
    },
    {
      id: 'RPT-004',
      name: 'Inventory Turnover Analysis',
      category: 'inventory',
      description: 'Analysis of inventory turnover rates and stock levels',
      type: 'On-Demand',
      frequency: 'Monthly',
      lastGenerated: '2024-01-20',
      nextScheduled: null,
      status: 'draft',
      format: 'Excel',
      size: '1.2 MB',
      recipients: ['inventory@company.com'],
      parameters: {
        dateRange: 'Last 6 Months',
        categories: 'Critical Items',
        threshold: 'Low Stock Alert'
      }
    },
    {
      id: 'RPT-005',
      name: 'Compliance Audit Report',
      category: 'compliance',
      description: 'Regulatory compliance status and audit findings',
      type: 'Scheduled',
      frequency: 'Quarterly',
      lastGenerated: '2024-01-15',
      nextScheduled: '2024-04-15',
      status: 'active',
      format: 'PDF',
      size: '4.2 MB',
      recipients: ['compliance@company.com', 'legal@company.com'],
      parameters: {
        dateRange: 'Last Quarter',
        regulations: 'All Standards',
        vessels: 'All Vessels'
      }
    },
    {
      id: 'RPT-006',
      name: 'Budget Utilization Dashboard',
      category: 'financial',
      description: 'Real-time budget utilization across departments',
      type: 'Real-time',
      frequency: 'Daily',
      lastGenerated: '2024-01-29',
      nextScheduled: '2024-01-30',
      status: 'active',
      format: 'Dashboard',
      size: 'N/A',
      recipients: ['finance@company.com'],
      parameters: {
        dateRange: 'Current Month',
        departments: 'All Departments',
        budgetType: 'Operational'
      }
    }
  ];

  const recentReports = [
    {
      name: 'Q4 2023 Procurement Summary',
      generatedDate: '2024-01-05',
      size: '3.2 MB',
      format: 'PDF',
      downloads: 24
    },
    {
      name: 'Vendor Performance - December',
      generatedDate: '2024-01-03',
      size: '1.9 MB',
      format: 'Excel',
      downloads: 18
    },
    {
      name: 'Cost Analysis - Week 52',
      generatedDate: '2024-01-02',
      size: '2.1 MB',
      format: 'PDF',
      downloads: 12
    }
  ];

  const filteredReports = reports.filter(report =>
    selectedCategory === 'all' || report.category === selectedCategory
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'Scheduled': return 'bg-blue-100 text-blue-800';
      case 'On-Demand': return 'bg-purple-100 text-purple-800';
      case 'Real-time': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-800">Reports</h1>
          <p className="text-slate-600 mt-2">
            Generate and manage procurement reports and analytics
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <span>Settings</span>
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200 flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>New Report</span>
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Reports</p>
              <p className="text-2xl font-bold text-gray-900">24</p>
              <p className="text-sm text-green-600 mt-1">+3 this month</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Scheduled Reports</p>
              <p className="text-2xl font-bold text-gray-900">12</p>
              <p className="text-sm text-blue-600 mt-1">8 active</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Clock className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Downloads (30d)</p>
              <p className="text-2xl font-bold text-gray-900">156</p>
              <p className="text-sm text-green-600 mt-1">+22% vs last month</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Download className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Data Volume</p>
              <p className="text-2xl font-bold text-gray-900">45.2 GB</p>
              <p className="text-sm text-gray-600 mt-1">Total storage</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card className="p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60">
            <h3 className="font-semibold text-lg mb-6 text-slate-800">Categories</h3>
            <div className="space-y-2">
              {reportCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-all duration-200 ${selectedCategory === category.id
                    ? 'bg-blue-100 text-blue-900 shadow-sm'
                    : 'hover:bg-slate-50 text-slate-700'
                    }`}
                >
                  <span className="font-medium">{category.name}</span>
                  <Badge className={`${selectedCategory === category.id ? 'bg-blue-200 text-blue-800' : 'bg-slate-100 text-slate-600'} font-medium`}>
                    {category.count}
                  </Badge>
                </button>
              ))}
            </div>
          </Card>

          {/* Recent Downloads */}
          <Card className="p-6 mt-6 bg-white/60 backdrop-blur-sm border border-slate-200/60">
            <h3 className="font-semibold text-lg mb-6 text-slate-800">Recent Downloads</h3>
            <div className="space-y-3">
              {recentReports.map((report, index) => (
                <div key={index} className="p-4 bg-slate-50/50 rounded-lg hover:bg-slate-50 transition-colors duration-200">
                  <p className="font-semibold text-sm text-slate-800">{report.name}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-slate-600 font-medium">
                    <span>{formatDate(report.generatedDate)}</span>
                    <span>{report.size}</span>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <Badge className="bg-blue-100 text-blue-800 font-medium">{report.format}</Badge>
                    <span className="text-xs text-slate-500 font-medium">{report.downloads} downloads</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {/* Filters */}
          <Card className="p-5 mb-6 bg-white/60 backdrop-blur-sm border border-slate-200/60">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex items-center space-x-3">
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="px-4 py-2.5 bg-white/80 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all duration-200 text-sm font-medium text-slate-700"
                >
                  <option value="last7days">Last 7 Days</option>
                  <option value="last30days">Last 30 Days</option>
                  <option value="last3months">Last 3 Months</option>
                  <option value="last6months">Last 6 Months</option>
                  <option value="lastyear">Last Year</option>
                </select>
                <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 flex items-center space-x-2">
                  <Filter className="h-4 w-4" />
                  <span>More Filters</span>
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 p-2.5">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>

          {/* Reports List */}
          <div className="space-y-4">
            {filteredReports.map((report) => (
              <Card key={report.id} className="p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <h3 className="font-semibold text-lg text-slate-800">{report.name}</h3>
                      <Badge className={getTypeColor(report.type)}>
                        {report.type}
                      </Badge>
                      <Badge className={getStatusColor(report.status)}>
                        {report.status}
                      </Badge>
                    </div>
                    <p className="text-slate-600 mb-4 font-medium">{report.description}</p>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div className="bg-slate-50/50 p-3 rounded-lg">
                        <span className="text-slate-500 font-medium">Frequency:</span>
                        <span className="ml-1 font-semibold text-slate-800">{report.frequency}</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-lg">
                        <span className="text-slate-500 font-medium">Format:</span>
                        <span className="ml-1 font-semibold text-slate-800">{report.format}</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-lg">
                        <span className="text-slate-500 font-medium">Size:</span>
                        <span className="ml-1 font-semibold text-slate-800">{report.size}</span>
                      </div>
                      <div className="bg-slate-50/50 p-3 rounded-lg">
                        <span className="text-slate-500 font-medium">Recipients:</span>
                        <span className="ml-1 font-semibold text-slate-800">{report.recipients.length}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-5 p-4 bg-slate-50/50 rounded-lg border border-slate-100">
                  <h4 className="font-semibold text-sm text-slate-800 mb-3">Parameters</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    {Object.entries(report.parameters).map(([key, value]) => (
                      <div key={key} className="bg-white/60 p-2 rounded">
                        <span className="text-slate-500 capitalize font-medium">{key.replace(/([A-Z])/g, ' $1')}:</span>
                        <span className="ml-1 font-semibold text-slate-800">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-5 border-t border-slate-200">
                  <div className="flex items-center space-x-4 text-sm text-slate-600 font-medium">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>Last: {formatDate(report.lastGenerated)}</span>
                    </div>
                    {report.nextScheduled && (
                      <>
                        <span>•</span>
                        <span>Next: {formatDate(report.nextScheduled)}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button className="bg-white/80 border border-slate-200 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 p-2">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button className="bg-white/80 border border-slate-200 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 p-2">
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button className="bg-white/80 border border-slate-200 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 p-2">
                      <Share className="h-4 w-4" />
                    </Button>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 transition-all duration-200 px-4 py-2">
                      Generate Now
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <Card className="p-6 bg-white/60 backdrop-blur-sm border border-slate-200/60">
        <h3 className="font-semibold text-lg mb-6 text-slate-800">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 flex items-center justify-center space-x-2 p-4">
            <BarChart3 className="h-5 w-5" />
            <span>Generate Spend Analysis</span>
          </Button>
          <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 flex items-center justify-center space-x-2 p-4">
            <PieChart className="h-5 w-5" />
            <span>Vendor Performance Report</span>
          </Button>
          <Button className="bg-white/80 backdrop-blur-sm border border-slate-200/60 text-slate-700 hover:bg-white hover:shadow-md hover:shadow-slate-200/50 transition-all duration-200 flex items-center justify-center space-x-2 p-4">
            <TrendingUp className="h-5 w-5" />
            <span>Cost Savings Summary</span>
          </Button>
        </div>
      </Card>
    </div>
  );
};