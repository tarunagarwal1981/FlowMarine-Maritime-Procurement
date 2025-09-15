/**
 * KPI Card Widget Component
 * Displays key performance indicators with trend information
 */

import React from 'react';
import { Card, CardContent } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { DashboardWidget, DashboardFilters, WidgetConfiguration } from '../../../types/dashboard';
import { cn } from '../../../utils/cn';

interface KPICardProps {
  widget: DashboardWidget;
  configuration: WidgetConfiguration;
  filters?: DashboardFilters;
  isCustomizing?: boolean;
}

interface KPIData {
  value: number;
  label: string;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    percentage: number;
    period: string;
  };
  target?: number;
  unit?: string;
  status?: 'good' | 'warning' | 'critical';
}

export const KPICard: React.FC<KPICardProps> = ({
  widget,
  configuration,
  filters,
  isCustomizing = false,
}) => {
  // Mock data - in real implementation, this would come from API
  const mockData: KPIData = {
    value: 125000,
    label: 'Total Spend',
    trend: {
      direction: 'up',
      percentage: 12.5,
      period: 'vs last month',
    },
    target: 120000,
    unit: 'USD',
    status: 'warning',
  };

  const formatValue = (value: number) => {
    const { displayFormat, precision = 0 } = configuration;
    
    switch (displayFormat) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(value);
      
      case 'percentage':
        return `${value.toFixed(precision)}%`;
      
      case 'number':
      default:
        return new Intl.NumberFormat('en-US', {
          minimumFractionDigits: precision,
          maximumFractionDigits: precision,
        }).format(value);
    }
  };

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUp className="h-4 w-4" />;
      case 'down':
        return <TrendingDown className="h-4 w-4" />;
      default:
        return <Minus className="h-4 w-4" />;
    }
  };

  const getTrendColor = (direction: string, status?: string) => {
    if (status === 'critical') return 'text-red-600';
    if (status === 'warning') return 'text-yellow-600';
    
    switch (direction) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'good':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'critical':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isCustomizing) {
    return (
      <div className="flex items-center justify-center h-full min-h-[120px] border-2 border-dashed border-muted-foreground/25 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-muted-foreground mb-1">
            {formatValue(mockData.value)}
          </div>
          <div className="text-sm text-muted-foreground">
            {mockData.label}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Status badge */}
          {mockData.status && (
            <div className="flex justify-end">
              <Badge className={cn("text-xs", getStatusColor(mockData.status))}>
                {mockData.status.toUpperCase()}
              </Badge>
            </div>
          )}

          {/* Main value */}
          <div className="text-center">
            <div className="text-2xl font-bold">
              {formatValue(mockData.value)}
            </div>
            <div className="text-sm text-muted-foreground">
              {mockData.label}
            </div>
          </div>

          {/* Trend information */}
          {mockData.trend && configuration.showTrends && (
            <div className="flex items-center justify-center gap-1">
              <div className={cn("flex items-center gap-1", getTrendColor(mockData.trend.direction, mockData.status))}>
                {getTrendIcon(mockData.trend.direction)}
                <span className="text-sm font-medium">
                  {mockData.trend.percentage}%
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {mockData.trend.period}
              </span>
            </div>
          )}

          {/* Target comparison */}
          {mockData.target && configuration.showComparison && (
            <div className="text-center">
              <div className="text-xs text-muted-foreground">
                Target: {formatValue(mockData.target)}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                <div
                  className={cn(
                    "h-2 rounded-full transition-all",
                    mockData.value >= mockData.target ? "bg-green-500" : "bg-yellow-500"
                  )}
                  style={{
                    width: `${Math.min((mockData.value / mockData.target) * 100, 100)}%`,
                  }}
                />
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {((mockData.value / mockData.target) * 100).toFixed(1)}% of target
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default KPICard;