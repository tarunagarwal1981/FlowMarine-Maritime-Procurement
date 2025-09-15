import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { DataTable } from '../ui/DataTable';

interface ComplianceAlert {
  id: string;
  type: 'CERTIFICATE_EXPIRY' | 'SAFETY_VIOLATION' | 'ENVIRONMENTAL_BREACH' | 'DOCUMENTATION_MISSING';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  vesselId?: string;
  description: string;
  dueDate?: string;
  resolved: boolean;
  createdAt: string;
}

interface ComplianceDashboardData {
  alerts: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  recentActivity: {
    totalActions: number;
    uniqueUsers: number;
    topActions: Array<{ action: string; count: number }>;
  };
  complianceStatus: {
    overallScore: number;
    status: 'CRITICAL' | 'WARNING' | 'GOOD';
  };
}

interface ComplianceDashboardProps {
  vesselId?: string;
}

export const ComplianceDashboard: React.FC<ComplianceDashboardProps> = ({ vesselId }) => {
  const [dashboardData, setDashboardData] = useState<ComplianceDashboardData | null>(null);
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    fetchAlerts();
  }, [vesselId]);

  const fetchDashboardData = async () => {
    try {
      const params = vesselId ? `?vesselId=${vesselId}` : '';
      const response = await fetch(`/api/compliance/dashboard${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  };

  const fetchAlerts = async () => {
    try {
      const params = vesselId ? `?vesselId=${vesselId}` : '';
      const response = await fetch(`/api/compliance/alerts${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      setAlerts(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-100 text-red-800 border-red-200';
      case 'HIGH': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'LOW': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'CRITICAL': return 'text-red-600';
      case 'WARNING': return 'text-orange-600';
      case 'GOOD': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const generateReport = async (reportType: 'SOLAS' | 'MARPOL' | 'ISM') => {
    if (!vesselId) {
      alert('Please select a vessel to generate reports');
      return;
    }

    try {
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
      const endDate = new Date();

      const response = await fetch(`/api/compliance/vessels/${vesselId}/${reportType.toLowerCase()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate ${reportType} report`);
      }

      const data = await response.json();
      console.log(`${reportType} Report Generated:`, data.data);
      alert(`${reportType} report generated successfully!`);
    } catch (err) {
      alert(`Error generating ${reportType} report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const exportReport = async (format: 'excel' | 'pdf', reportType: 'SOLAS' | 'MARPOL' | 'ISM') => {
    if (!vesselId) {
      alert('Please select a vessel to export reports');
      return;
    }

    try {
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);
      const endDate = new Date();

      const response = await fetch(`/api/compliance/export/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          reportType,
          vesselId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to export ${reportType} report`);
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_Report_${vesselId}_${Date.now()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      alert(`Error exporting ${reportType} report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const alertColumns = [
    {
      key: 'severity',
      header: 'Severity',
      render: (alert: ComplianceAlert) => (
        <Badge className={getSeverityColor(alert.severity)}>
          {alert.severity}
        </Badge>
      )
    },
    {
      key: 'type',
      header: 'Type',
      render: (alert: ComplianceAlert) => alert.type.replace(/_/g, ' ')
    },
    {
      key: 'description',
      header: 'Description',
      render: (alert: ComplianceAlert) => alert.description
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      render: (alert: ComplianceAlert) => 
        alert.dueDate ? new Date(alert.dueDate).toLocaleDateString() : 'N/A'
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (alert: ComplianceAlert) => new Date(alert.createdAt).toLocaleDateString()
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compliance Status Overview */}
      {dashboardData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-6">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getStatusColor(dashboardData.complianceStatus.status)}`}>
                {dashboardData.complianceStatus.overallScore}%
              </div>
              <div className="text-sm text-gray-600 mt-1">Overall Compliance Score</div>
              <Badge className={`mt-2 ${getSeverityColor(dashboardData.complianceStatus.status)}`}>
                {dashboardData.complianceStatus.status}
              </Badge>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {dashboardData.alerts.critical}
              </div>
              <div className="text-sm text-gray-600 mt-1">Critical Alerts</div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-orange-600">
                {dashboardData.alerts.high}
              </div>
              <div className="text-sm text-gray-600 mt-1">High Priority Alerts</div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {dashboardData.alerts.total}
              </div>
              <div className="text-sm text-gray-600 mt-1">Total Alerts</div>
            </div>
          </Card>
        </div>
      )}

      {/* Report Generation */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Compliance Reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium">SOLAS Compliance</h4>
            <p className="text-sm text-gray-600">Safety equipment and construction compliance</p>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                onClick={() => generateReport('SOLAS')}
                disabled={!vesselId}
              >
                Generate
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportReport('excel', 'SOLAS')}
                disabled={!vesselId}
              >
                Excel
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportReport('pdf', 'SOLAS')}
                disabled={!vesselId}
              >
                PDF
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">MARPOL Compliance</h4>
            <p className="text-sm text-gray-600">Environmental and pollution prevention</p>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                onClick={() => generateReport('MARPOL')}
                disabled={!vesselId}
              >
                Generate
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportReport('excel', 'MARPOL')}
                disabled={!vesselId}
              >
                Excel
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportReport('pdf', 'MARPOL')}
                disabled={!vesselId}
              >
                PDF
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">ISM Compliance</h4>
            <p className="text-sm text-gray-600">Safety management system compliance</p>
            <div className="flex space-x-2">
              <Button 
                size="sm" 
                onClick={() => generateReport('ISM')}
                disabled={!vesselId}
              >
                Generate
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportReport('excel', 'ISM')}
                disabled={!vesselId}
              >
                Excel
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => exportReport('pdf', 'ISM')}
                disabled={!vesselId}
              >
                PDF
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Activity */}
      {dashboardData && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Activity (Last 30 Days)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {dashboardData.recentActivity.totalActions}
              </div>
              <div className="text-sm text-gray-600">Total Actions</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {dashboardData.recentActivity.uniqueUsers}
              </div>
              <div className="text-sm text-gray-600">Active Users</div>
            </div>
          </div>
          
          {dashboardData.recentActivity.topActions.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2">Top Actions</h4>
              <div className="space-y-2">
                {dashboardData.recentActivity.topActions.map((action, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <span className="text-sm">{action.action.replace(/_/g, ' ')}</span>
                    <Badge variant="outline">{action.count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Compliance Alerts */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Compliance Alerts</h3>
          <Button size="sm" variant="outline" onClick={fetchAlerts}>
            Refresh
          </Button>
        </div>
        
        {alerts.length > 0 ? (
          <DataTable
            data={alerts}
            columns={alertColumns}
            searchable={true}
            sortable={true}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            No compliance alerts found
          </div>
        )}
      </Card>
    </div>
  );
};