import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

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

interface ComplianceAlertsProps {
  vesselId?: string;
  maxAlerts?: number;
  showHeader?: boolean;
}

export const ComplianceAlerts: React.FC<ComplianceAlertsProps> = ({ 
  vesselId, 
  maxAlerts = 10,
  showHeader = true 
}) => {
  const [alerts, setAlerts] = useState<ComplianceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
    
    // Set up polling for real-time updates
    const interval = setInterval(fetchAlerts, 30000); // Poll every 30 seconds
    
    return () => clearInterval(interval);
  }, [vesselId]);

  const fetchAlerts = async () => {
    try {
      const params = vesselId ? `?vesselId=${vesselId}` : '';
      const response = await fetch(`/api/compliance/alerts${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch compliance alerts');
      }

      const data = await response.json();
      setAlerts(data.data.slice(0, maxAlerts));
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

  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'CRITICAL': return '🚨';
      case 'HIGH': return '⚠️';
      case 'MEDIUM': return '⚡';
      case 'LOW': return 'ℹ️';
      default: return '📋';
    }
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'CERTIFICATE_EXPIRY': return '📜';
      case 'SAFETY_VIOLATION': return '🛡️';
      case 'ENVIRONMENTAL_BREACH': return '🌊';
      case 'DOCUMENTATION_MISSING': return '📄';
      default: return '📋';
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    
    const diffInWeeks = Math.floor(diffInDays / 7);
    if (diffInWeeks < 4) return `${diffInWeeks}w ago`;
    
    return date.toLocaleDateString();
  };

  const getDaysUntilDue = (dueDateString?: string): number | null => {
    if (!dueDateString) return null;
    
    const dueDate = new Date(dueDateString);
    const now = new Date();
    const diffInDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    return diffInDays;
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800">Error: {error}</div>
          <Button 
            size="sm" 
            variant="outline" 
            className="mt-2"
            onClick={fetchAlerts}
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      {showHeader && (
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Compliance Alerts</h3>
          <div className="flex space-x-2">
            <Button size="sm" variant="outline" onClick={fetchAlerts}>
              Refresh
            </Button>
          </div>
        </div>
      )}

      {alerts.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-4xl mb-2">✅</div>
          <div className="text-gray-500">No compliance alerts</div>
          <div className="text-sm text-gray-400 mt-1">All systems are compliant</div>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const daysUntilDue = getDaysUntilDue(alert.dueDate);
            
            return (
              <div
                key={alert.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="text-2xl">
                      {getSeverityIcon(alert.severity)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          {getTypeIcon(alert.type)} {alert.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-900 mb-2">
                        {alert.description}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>{formatTimeAgo(alert.createdAt)}</span>
                        
                        {alert.dueDate && (
                          <span className={`font-medium ${
                            daysUntilDue !== null && daysUntilDue <= 0 
                              ? 'text-red-600' 
                              : daysUntilDue !== null && daysUntilDue <= 7
                              ? 'text-orange-600'
                              : 'text-gray-600'
                          }`}>
                            {daysUntilDue !== null && daysUntilDue <= 0 
                              ? `Overdue by ${Math.abs(daysUntilDue)} day(s)`
                              : daysUntilDue !== null && daysUntilDue === 1
                              ? 'Due tomorrow'
                              : daysUntilDue !== null
                              ? `Due in ${daysUntilDue} day(s)`
                              : 'No due date'
                            }
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {alert.severity === 'CRITICAL' && (
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          
          {alerts.length === maxAlerts && (
            <div className="text-center pt-4 border-t">
              <Button size="sm" variant="outline">
                View All Alerts
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};