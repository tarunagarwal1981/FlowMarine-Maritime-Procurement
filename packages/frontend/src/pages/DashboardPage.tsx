import React from 'react';
import { 
  Ship, 
  Package, 
  DollarSign, 
  Clock, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Users,
  FileText,
  BarChart3,
  PieChart
} from 'lucide-react';
import { Card, Badge } from '../components/ui';

export const DashboardPage: React.FC = () => {
  const kpiData = [
    {
      title: 'Total Fleet Value',
      value: '$2.4M',
      change: '+12.5%',
      trend: 'up',
      icon: Ship,
      color: 'blue'
    },
    {
      title: 'Active Requisitions',
      value: '24',
      change: '+3',
      trend: 'up',
      icon: FileText,
      color: 'green'
    },
    {
      title: 'Monthly Spend',
      value: '$185K',
      change: '-8.2%',
      trend: 'down',
      icon: DollarSign,
      color: 'purple'
    },
    {
      title: 'Pending Approvals',
      value: '8',
      change: '-2',
      trend: 'down',
      icon: Clock,
      color: 'orange'
    }
  ];

  const recentRequisitions = [
    {
      id: 'REQ-2024-001',
      title: 'Engine Room Maintenance Supplies',
      vessel: 'MV Ocean Explorer',
      status: 'approved',
      value: '$15,750',
      date: '2024-01-15'
    },
    {
      id: 'REQ-2024-002',
      title: 'Safety Equipment Upgrade',
      vessel: 'MV Atlantic Star',
      status: 'pending',
      value: '$8,950',
      date: '2024-01-18'
    },
    {
      id: 'REQ-2024-003',
      title: 'Navigation System Update',
      vessel: 'MV Pacific Wind',
      status: 'in_procurement',
      value: '$25,000',
      date: '2024-01-20'
    },
    {
      id: 'REQ-2024-004',
      title: 'Galley Provisions',
      vessel: 'MV Nordic Star',
      status: 'completed',
      value: '$4,200',
      date: '2024-01-22'
    }
  ];

  const fleetStatus = [
    {
      vessel: 'MV Ocean Explorer',
      status: 'operational',
      location: 'Port of Hamburg',
      nextMaintenance: '2024-02-15',
      activeRequisitions: 3
    },
    {
      vessel: 'MV Atlantic Star',
      status: 'maintenance',
      location: 'Port of Rotterdam',
      nextMaintenance: '2024-01-30',
      activeRequisitions: 5
    },
    {
      vessel: 'MV Pacific Wind',
      status: 'operational',
      location: 'Port of Singapore',
      nextMaintenance: '2024-03-10',
      activeRequisitions: 2
    },
    {
      vessel: 'MV Nordic Star',
      status: 'operational',
      location: 'Port of Los Angeles',
      nextMaintenance: '2024-02-28',
      activeRequisitions: 1
    }
  ];

  const alerts = [
    {
      type: 'urgent',
      message: 'Critical engine parts needed for MV Atlantic Star',
      time: '2 hours ago'
    },
    {
      type: 'warning',
      message: 'Budget threshold exceeded for Q1 procurement',
      time: '4 hours ago'
    },
    {
      type: 'info',
      message: 'New vendor certification completed',
      time: '1 day ago'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_procurement': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'operational': return 'bg-green-100 text-green-800';
      case 'maintenance': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'urgent': return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'info': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      default: return <CheckCircle className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Maritime procurement overview and fleet management
          </p>
        </div>
        <div className="text-sm text-gray-500">
          Last updated: {new Date().toLocaleString()}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpiData.map((kpi, index) => {
          const IconComponent = kpi.icon;
          return (
            <Card key={index} className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{kpi.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{kpi.value}</p>
                  <div className="flex items-center mt-2">
                    {kpi.trend === 'up' ? (
                      <TrendingUp className="h-4 w-4 text-green-600 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600 mr-1" />
                    )}
                    <span className={`text-sm font-medium ${
                      kpi.trend === 'up' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {kpi.change}
                    </span>
                  </div>
                </div>
                <div className={`p-3 rounded-lg bg-${kpi.color}-100`}>
                  <IconComponent className={`h-6 w-6 text-${kpi.color}-600`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Requisitions */}
        <div className="lg:col-span-2">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Requisitions</h2>
              <Badge variant="outline">24 Active</Badge>
            </div>
            <div className="space-y-4">
              {recentRequisitions.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{req.title}</p>
                        <p className="text-sm text-gray-600">{req.id} • {req.vessel}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="font-medium text-gray-900">{req.value}</p>
                      <p className="text-sm text-gray-500">{req.date}</p>
                    </div>
                    <Badge className={getStatusColor(req.status)}>
                      {req.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Alerts */}
        <div>
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Alerts & Notifications</h2>
            <div className="space-y-4">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{alert.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{alert.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Fleet Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Fleet Status</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <span className="text-sm text-gray-600">Operational</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
              <span className="text-sm text-gray-600">Maintenance</span>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-500">Vessel</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Status</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Location</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Next Maintenance</th>
                <th className="text-left py-3 px-2 font-medium text-gray-500">Active Requisitions</th>
              </tr>
            </thead>
            <tbody>
              {fleetStatus.map((vessel, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-3 px-2">
                    <div className="flex items-center space-x-2">
                      <Ship className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{vessel.vessel}</span>
                    </div>
                  </td>
                  <td className="py-3 px-2">
                    <Badge className={getStatusColor(vessel.status)}>
                      {vessel.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-2 text-gray-900">{vessel.location}</td>
                  <td className="py-3 px-2 text-gray-900">{vessel.nextMaintenance}</td>
                  <td className="py-3 px-2">
                    <Badge variant="outline">{vessel.activeRequisitions}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Vendor Performance</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">94.2%</p>
              <p className="text-sm text-green-600 mt-1">+2.1% from last month</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Cost Savings</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">$45K</p>
              <p className="text-sm text-green-600 mt-1">This quarter</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Inventory Turnover</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">6.8x</p>
              <p className="text-sm text-blue-600 mt-1">Annual rate</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <PieChart className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};