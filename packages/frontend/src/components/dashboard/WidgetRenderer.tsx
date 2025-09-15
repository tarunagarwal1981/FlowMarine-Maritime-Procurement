/**
 * Widget Renderer Component
 * Renders different widget types based on configuration
 */

import React, { Suspense, lazy } from 'react';
import { DashboardWidget, DashboardFilters } from '../../types/dashboard';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/cn';

// Lazy load widget components
const FleetSpendVisualization = lazy(() => import('../analytics/FleetSpendVisualization'));
const BudgetUtilizationDashboard = lazy(() => import('../analytics/BudgetUtilizationDashboard'));
const VendorPerformanceScorecards = lazy(() => import('../analytics/VendorPerformanceScorecards'));
const CostSavingsROITracking = lazy(() => import('../analytics/CostSavingsROITracking'));
const CycleTimeBottleneckAnalysis = lazy(() => import('../analytics/CycleTimeBottleneckAnalysis'));
const VesselSpecificAnalytics = lazy(() => import('../analytics/VesselSpecificAnalytics'));
const PortEfficiencyAnalytics = lazy(() => import('../analytics/PortEfficiencyAnalytics'));
const InventoryDemandAnalytics = lazy(() => import('../analytics/InventoryDemandAnalytics'));
const MultiCurrencyConsolidation = lazy(() => import('../analytics/MultiCurrencyConsolidation'));
const PaymentTermsOptimization = lazy(() => import('../analytics/PaymentTermsOptimization'));
const CostAnalysisVarianceTracking = lazy(() => import('../analytics/CostAnalysisVarianceTracking'));

// Simple widget components
const KPICard = lazy(() => import('./widgets/KPICard'));
const DataTable = lazy(() => import('./widgets/DataTable'));
const TrendChart = lazy(() => import('./widgets/TrendChart'));
const GaugeChart = lazy(() => import('./widgets/GaugeChart'));
const ComparisonChart = lazy(() => import('./widgets/ComparisonChart'));
const Heatmap = lazy(() => import('./widgets/Heatmap'));
const GeographicMap = lazy(() => import('./widgets/GeographicMap'));
const AlertPanel = lazy(() => import('./widgets/AlertPanel'));
const NotificationFeed = lazy(() => import('./widgets/NotificationFeed'));

interface WidgetRendererProps {
  widget: DashboardWidget;
  isCustomizing?: boolean;
  filters?: DashboardFilters;
  className?: string;
}

export const WidgetRenderer: React.FC<WidgetRendererProps> = ({
  widget,
  isCustomizing = false,
  filters,
  className,
}) => {
  // Loading component
  const LoadingComponent = () => (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Loading widget...</p>
      </div>
    </div>
  );

  // Error boundary component
  const ErrorComponent = ({ error }: { error?: Error }) => (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="text-center">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
        <p className="text-sm font-medium mb-1">Widget Error</p>
        <p className="text-xs text-muted-foreground">
          {error?.message || 'Failed to load widget'}
        </p>
      </div>
    </div>
  );

  // Get widget component based on type
  const getWidgetComponent = () => {
    const commonProps = {
      configuration: widget.configuration,
      filters,
      isCustomizing,
    };

    switch (widget.type) {
      case 'fleet_spend_visualization':
        return <FleetSpendVisualization {...commonProps} />;
      
      case 'budget_utilization':
        return <BudgetUtilizationDashboard {...commonProps} />;
      
      case 'vendor_performance':
        return <VendorPerformanceScorecards {...commonProps} />;
      
      case 'cost_savings_roi':
        return <CostSavingsROITracking {...commonProps} />;
      
      case 'cycle_time_analysis':
        return <CycleTimeBottleneckAnalysis {...commonProps} />;
      
      case 'vessel_analytics':
        return <VesselSpecificAnalytics {...commonProps} />;
      
      case 'port_efficiency':
        return <PortEfficiencyAnalytics {...commonProps} />;
      
      case 'inventory_analytics':
        return <InventoryDemandAnalytics {...commonProps} />;
      
      case 'multi_currency':
        return <MultiCurrencyConsolidation {...commonProps} />;
      
      case 'payment_terms':
        return <PaymentTermsOptimization {...commonProps} />;
      
      case 'cost_analysis':
        return <CostAnalysisVarianceTracking {...commonProps} />;
      
      case 'kpi_card':
        return <KPICard {...commonProps} widget={widget} />;
      
      case 'data_table':
        return <DataTable {...commonProps} widget={widget} />;
      
      case 'trend_chart':
        return <TrendChart {...commonProps} widget={widget} />;
      
      case 'gauge_chart':
        return <GaugeChart {...commonProps} widget={widget} />;
      
      case 'comparison_chart':
        return <ComparisonChart {...commonProps} widget={widget} />;
      
      case 'heatmap':
        return <Heatmap {...commonProps} widget={widget} />;
      
      case 'geographic_map':
        return <GeographicMap {...commonProps} widget={widget} />;
      
      case 'alert_panel':
        return <AlertPanel {...commonProps} widget={widget} />;
      
      case 'notification_feed':
        return <NotificationFeed {...commonProps} widget={widget} />;
      
      default:
        return (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium mb-1">Unknown Widget Type</p>
              <p className="text-xs text-muted-foreground">
                Widget type "{widget.type}" is not supported
              </p>
            </div>
          </div>
        );
    }
  };

  // Check if widget should be hidden based on thresholds
  const shouldHideWidget = () => {
    // This would be implemented based on actual data and threshold logic
    return false;
  };

  if (shouldHideWidget()) {
    return null;
  }

  return (
    <div className={cn("widget-renderer h-full", className)}>
      {/* Widget header */}
      <div className="widget-header p-3 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">{widget.title}</h3>
            {widget.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {widget.description}
              </p>
            )}
          </div>
          
          {/* Widget status indicators */}
          <div className="flex items-center gap-1">
            {isCustomizing && (
              <Badge variant="outline" className="text-xs">
                Customizing
              </Badge>
            )}
            
            {widget.refreshInterval && (
              <Badge variant="secondary" className="text-xs">
                {widget.refreshInterval}s
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Widget content */}
      <div className="widget-content flex-1 p-3">
        <Suspense fallback={<LoadingComponent />}>
          <ErrorBoundary fallback={ErrorComponent}>
            {getWidgetComponent()}
          </ErrorBoundary>
        </Suspense>
      </div>
    </div>
  );
};

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ComponentType<{ error?: Error }> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Widget error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback;
      return <FallbackComponent error={this.state.error} />;
    }

    return this.props.children;
  }
}

export default WidgetRenderer;