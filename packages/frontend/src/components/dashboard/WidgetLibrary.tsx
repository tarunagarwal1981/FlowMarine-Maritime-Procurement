/**
 * Widget Library Component
 * Modal for browsing and adding widgets to dashboard
 */

import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { Search, Plus, BarChart3, PieChart, TrendingUp, Gauge, Table, Map, Bell, Activity } from 'lucide-react';
import { WidgetType } from '../../types/dashboard';
import { cn } from '../../utils/cn';

interface WidgetInfo {
  type: WidgetType;
  name: string;
  description: string;
  category: 'charts' | 'analytics' | 'data' | 'alerts' | 'maps';
  icon: React.ComponentType<{ className?: string }>;
  preview?: string;
  tags: string[];
  complexity: 'simple' | 'medium' | 'advanced';
}

const WIDGET_CATALOG: WidgetInfo[] = [
  // Charts
  {
    type: 'fleet_spend_visualization',
    name: 'Fleet Spend Visualization',
    description: 'Interactive charts showing fleet-wide spending patterns with drill-down capabilities',
    category: 'charts',
    icon: BarChart3,
    tags: ['spending', 'fleet', 'analytics'],
    complexity: 'medium',
  },
  {
    type: 'budget_utilization',
    name: 'Budget Utilization',
    description: 'Real-time budget tracking with variance analysis and forecasting',
    category: 'charts',
    icon: PieChart,
    tags: ['budget', 'finance', 'tracking'],
    complexity: 'simple',
  },
  {
    type: 'vendor_performance',
    name: 'Vendor Performance Scorecards',
    description: 'Multi-metric vendor scoring with performance trends and recommendations',
    category: 'analytics',
    icon: TrendingUp,
    tags: ['vendors', 'performance', 'scoring'],
    complexity: 'advanced',
  },
  {
    type: 'cost_savings_roi',
    name: 'Cost Savings & ROI',
    description: 'Track cost savings initiatives and return on investment metrics',
    category: 'analytics',
    icon: TrendingUp,
    tags: ['savings', 'roi', 'finance'],
    complexity: 'medium',
  },
  
  // Analytics
  {
    type: 'cycle_time_analysis',
    name: 'Cycle Time Analysis',
    description: 'Procurement cycle time tracking with bottleneck identification',
    category: 'analytics',
    icon: Activity,
    tags: ['cycle time', 'efficiency', 'bottlenecks'],
    complexity: 'advanced',
  },
  {
    type: 'vessel_analytics',
    name: 'Vessel Analytics',
    description: 'Vessel-specific spending patterns and performance metrics',
    category: 'analytics',
    icon: BarChart3,
    tags: ['vessels', 'spending', 'patterns'],
    complexity: 'medium',
  },
  {
    type: 'port_efficiency',
    name: 'Port Efficiency',
    description: 'Port logistics performance and delivery efficiency metrics',
    category: 'analytics',
    icon: Map,
    tags: ['ports', 'logistics', 'efficiency'],
    complexity: 'medium',
  },
  {
    type: 'inventory_analytics',
    name: 'Inventory Analytics',
    description: 'Inventory turnover, demand forecasting, and optimization recommendations',
    category: 'analytics',
    icon: BarChart3,
    tags: ['inventory', 'demand', 'optimization'],
    complexity: 'advanced',
  },
  
  // Financial
  {
    type: 'multi_currency',
    name: 'Multi-Currency Consolidation',
    description: 'Currency consolidation with exchange rate impact analysis',
    category: 'charts',
    icon: PieChart,
    tags: ['currency', 'exchange', 'finance'],
    complexity: 'medium',
  },
  {
    type: 'payment_terms',
    name: 'Payment Terms Optimization',
    description: 'Payment terms analysis with cash flow optimization recommendations',
    category: 'analytics',
    icon: TrendingUp,
    tags: ['payments', 'terms', 'optimization'],
    complexity: 'advanced',
  },
  {
    type: 'cost_analysis',
    name: 'Cost Analysis & Variance',
    description: 'Budget vs actual variance tracking with cost optimization insights',
    category: 'analytics',
    icon: BarChart3,
    tags: ['costs', 'variance', 'budget'],
    complexity: 'medium',
  },
  
  // Data & Tables
  {
    type: 'data_table',
    name: 'Data Table',
    description: 'Configurable data table with sorting, filtering, and export capabilities',
    category: 'data',
    icon: Table,
    tags: ['data', 'table', 'export'],
    complexity: 'simple',
  },
  {
    type: 'kpi_card',
    name: 'KPI Card',
    description: 'Key performance indicator display with trend indicators',
    category: 'data',
    icon: Gauge,
    tags: ['kpi', 'metrics', 'trends'],
    complexity: 'simple',
  },
  
  // Charts & Visualizations
  {
    type: 'trend_chart',
    name: 'Trend Chart',
    description: 'Time series trend visualization with multiple data series',
    category: 'charts',
    icon: TrendingUp,
    tags: ['trends', 'time series', 'charts'],
    complexity: 'simple',
  },
  {
    type: 'gauge_chart',
    name: 'Gauge Chart',
    description: 'Gauge visualization for performance metrics and thresholds',
    category: 'charts',
    icon: Gauge,
    tags: ['gauge', 'performance', 'thresholds'],
    complexity: 'simple',
  },
  {
    type: 'comparison_chart',
    name: 'Comparison Chart',
    description: 'Side-by-side comparison charts for benchmarking',
    category: 'charts',
    icon: BarChart3,
    tags: ['comparison', 'benchmarking', 'charts'],
    complexity: 'medium',
  },
  {
    type: 'heatmap',
    name: 'Heatmap',
    description: 'Heat map visualization for pattern analysis and correlations',
    category: 'charts',
    icon: BarChart3,
    tags: ['heatmap', 'patterns', 'correlations'],
    complexity: 'advanced',
  },
  
  // Maps & Geographic
  {
    type: 'geographic_map',
    name: 'Geographic Map',
    description: 'Interactive map showing vessel positions, ports, and logistics data',
    category: 'maps',
    icon: Map,
    tags: ['map', 'geographic', 'vessels'],
    complexity: 'advanced',
  },
  
  // Alerts & Notifications
  {
    type: 'alert_panel',
    name: 'Alert Panel',
    description: 'System alerts and notifications with priority indicators',
    category: 'alerts',
    icon: Bell,
    tags: ['alerts', 'notifications', 'monitoring'],
    complexity: 'simple',
  },
  {
    type: 'notification_feed',
    name: 'Notification Feed',
    description: 'Real-time notification feed with filtering and actions',
    category: 'alerts',
    icon: Bell,
    tags: ['notifications', 'feed', 'real-time'],
    complexity: 'medium',
  },
];

interface WidgetLibraryProps {
  availableWidgets: WidgetType[];
  onAddWidget: (widgetType: string, position?: { x: number; y: number }) => void;
  onClose: () => void;
}

export const WidgetLibrary: React.FC<WidgetLibraryProps> = ({
  availableWidgets,
  onAddWidget,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Filter widgets based on availability, search, and category
  const filteredWidgets = useMemo(() => {
    return WIDGET_CATALOG.filter(widget => {
      // Check if widget is available for user role
      if (!availableWidgets.includes(widget.type)) {
        return false;
      }

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          widget.name.toLowerCase().includes(query) ||
          widget.description.toLowerCase().includes(query) ||
          widget.tags.some(tag => tag.toLowerCase().includes(query));
        
        if (!matchesSearch) return false;
      }

      // Category filter
      if (selectedCategory !== 'all' && widget.category !== selectedCategory) {
        return false;
      }

      return true;
    });
  }, [availableWidgets, searchQuery, selectedCategory]);

  // Group widgets by category
  const widgetsByCategory = useMemo(() => {
    const categories: Record<string, WidgetInfo[]> = {};
    filteredWidgets.forEach(widget => {
      if (!categories[widget.category]) {
        categories[widget.category] = [];
      }
      categories[widget.category].push(widget);
    });
    return categories;
  }, [filteredWidgets]);

  const handleAddWidget = (widgetType: string) => {
    onAddWidget(widgetType);
  };

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'simple': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'charts': return BarChart3;
      case 'analytics': return TrendingUp;
      case 'data': return Table;
      case 'alerts': return Bell;
      case 'maps': return Map;
      default: return BarChart3;
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Widget Library</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col h-full">
          {/* Search and filters */}
          <div className="flex gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search widgets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Category tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="charts">Charts</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
              <TabsTrigger value="alerts">Alerts</TabsTrigger>
              <TabsTrigger value="maps">Maps</TabsTrigger>
            </TabsList>

            <TabsContent value={selectedCategory} className="flex-1 mt-4">
              <ScrollArea className="h-[400px]">
                {selectedCategory === 'all' ? (
                  // Show all categories
                  <div className="space-y-6">
                    {Object.entries(widgetsByCategory).map(([category, widgets]) => {
                      const CategoryIcon = getCategoryIcon(category);
                      return (
                        <div key={category}>
                          <div className="flex items-center gap-2 mb-3">
                            <CategoryIcon className="h-5 w-5" />
                            <h3 className="text-lg font-semibold capitalize">{category}</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {widgets.map((widget) => (
                              <WidgetCard
                                key={widget.type}
                                widget={widget}
                                onAdd={() => handleAddWidget(widget.type)}
                                getComplexityColor={getComplexityColor}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // Show specific category
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredWidgets.map((widget) => (
                      <WidgetCard
                        key={widget.type}
                        widget={widget}
                        onAdd={() => handleAddWidget(widget.type)}
                        getComplexityColor={getComplexityColor}
                      />
                    ))}
                  </div>
                )}

                {filteredWidgets.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No widgets found matching your criteria.</p>
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface WidgetCardProps {
  widget: WidgetInfo;
  onAdd: () => void;
  getComplexityColor: (complexity: string) => string;
}

const WidgetCard: React.FC<WidgetCardProps> = ({ widget, onAdd, getComplexityColor }) => {
  const Icon = widget.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <CardTitle className="text-sm">{widget.name}</CardTitle>
          </div>
          <Badge className={cn("text-xs", getComplexityColor(widget.complexity))}>
            {widget.complexity}
          </Badge>
        </div>
        <CardDescription className="text-xs line-clamp-2">
          {widget.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {widget.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {widget.tags.length > 2 && (
              <Badge variant="outline" className="text-xs">
                +{widget.tags.length - 2}
              </Badge>
            )}
          </div>
          <Button size="sm" onClick={onAdd} className="gap-1">
            <Plus className="h-3 w-3" />
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default WidgetLibrary;