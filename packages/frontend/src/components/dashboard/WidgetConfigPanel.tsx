/**
 * Widget Configuration Panel Component
 * Side panel for configuring widget properties and settings
 */

import React, { useState, useEffect } from 'react';
import { useAppDispatch } from '../../store/hooks';
import { updateWidget } from '../../store/slices/dashboardSlice';
import { DashboardWidget, WidgetConfiguration } from '../../types/dashboard';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { ColorPicker } from '../ui/color-picker';
import { Slider } from '../ui/slider';
import { 
  Settings, 
  Palette, 
  Filter, 
  Eye, 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Gauge,
  Table,
  Save,
  RotateCcw
} from 'lucide-react';
import { cn } from '../../utils/cn';

interface WidgetConfigPanelProps {
  widget: DashboardWidget;
  layoutType: 'executive' | 'operational' | 'financial';
  onClose: () => void;
}

export const WidgetConfigPanel: React.FC<WidgetConfigPanelProps> = ({
  widget,
  layoutType,
  onClose,
}) => {
  const dispatch = useAppDispatch();
  const [localWidget, setLocalWidget] = useState<DashboardWidget>(widget);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local state when widget prop changes
  useEffect(() => {
    setLocalWidget(widget);
    setHasChanges(false);
  }, [widget]);

  // Handle field changes
  const handleFieldChange = (field: keyof DashboardWidget, value: any) => {
    setLocalWidget(prev => ({
      ...prev,
      [field]: value,
    }));
    setHasChanges(true);
  };

  // Handle configuration changes
  const handleConfigChange = (field: keyof WidgetConfiguration, value: any) => {
    setLocalWidget(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        [field]: value,
      },
    }));
    setHasChanges(true);
  };

  // Handle threshold changes
  const handleThresholdChange = (index: number, field: string, value: any) => {
    const thresholds = [...(localWidget.configuration.thresholds || [])];
    thresholds[index] = { ...thresholds[index], [field]: value };
    handleConfigChange('thresholds', thresholds);
  };

  // Add new threshold
  const addThreshold = () => {
    const newThreshold = {
      id: `threshold-${Date.now()}`,
      name: 'New Threshold',
      value: 0,
      operator: 'gt' as const,
      color: '#ef4444',
      action: 'alert' as const,
    };
    const thresholds = [...(localWidget.configuration.thresholds || []), newThreshold];
    handleConfigChange('thresholds', thresholds);
  };

  // Remove threshold
  const removeThreshold = (index: number) => {
    const thresholds = [...(localWidget.configuration.thresholds || [])];
    thresholds.splice(index, 1);
    handleConfigChange('thresholds', thresholds);
  };

  // Save changes
  const handleSave = () => {
    dispatch(updateWidget({
      layoutType,
      widgetId: widget.id,
      updates: localWidget,
    }));
    setHasChanges(false);
  };

  // Reset changes
  const handleReset = () => {
    setLocalWidget(widget);
    setHasChanges(false);
  };

  // Get chart type options based on widget type
  const getChartTypeOptions = () => {
    switch (localWidget.type) {
      case 'fleet_spend_visualization':
      case 'budget_utilization':
        return ['bar', 'line', 'doughnut', 'pie'];
      case 'trend_chart':
        return ['line', 'area'];
      case 'comparison_chart':
        return ['bar', 'line'];
      case 'gauge_chart':
        return ['gauge'];
      default:
        return ['line', 'bar', 'doughnut', 'pie', 'area'];
    }
  };

  const chartTypeOptions = getChartTypeOptions();

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Widget Configuration
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-6">
            {/* Basic Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Basic Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="widget-title">Title</Label>
                  <Input
                    id="widget-title"
                    value={localWidget.title}
                    onChange={(e) => handleFieldChange('title', e.target.value)}
                    placeholder="Widget title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="widget-description">Description</Label>
                  <Textarea
                    id="widget-description"
                    value={localWidget.description || ''}
                    onChange={(e) => handleFieldChange('description', e.target.value)}
                    placeholder="Widget description (optional)"
                    rows={2}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="widget-visible">Visible</Label>
                  <Switch
                    id="widget-visible"
                    checked={localWidget.isVisible}
                    onCheckedChange={(checked) => handleFieldChange('isVisible', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="refresh-interval">Refresh Interval (seconds)</Label>
                  <Input
                    id="refresh-interval"
                    type="number"
                    min="30"
                    max="3600"
                    value={localWidget.refreshInterval || 300}
                    onChange={(e) => handleFieldChange('refreshInterval', parseInt(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Chart Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Chart Configuration
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="appearance" className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="appearance">Appearance</TabsTrigger>
                    <TabsTrigger value="data">Data</TabsTrigger>
                    <TabsTrigger value="behavior">Behavior</TabsTrigger>
                  </TabsList>

                  <TabsContent value="appearance" className="space-y-4 mt-4">
                    {/* Chart Type */}
                    <div className="space-y-2">
                      <Label>Chart Type</Label>
                      <Select
                        value={localWidget.configuration.chartType || 'line'}
                        onValueChange={(value) => handleConfigChange('chartType', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {chartTypeOptions.map((type) => (
                            <SelectItem key={type} value={type}>
                              <div className="flex items-center gap-2">
                                {type === 'line' && <TrendingUp className="h-4 w-4" />}
                                {type === 'bar' && <BarChart3 className="h-4 w-4" />}
                                {type === 'pie' && <PieChart className="h-4 w-4" />}
                                {type === 'doughnut' && <PieChart className="h-4 w-4" />}
                                {type === 'gauge' && <Gauge className="h-4 w-4" />}
                                {type === 'area' && <TrendingUp className="h-4 w-4" />}
                                <span className="capitalize">{type}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Colors */}
                    <div className="space-y-2">
                      <Label>Color Palette</Label>
                      <div className="flex flex-wrap gap-2">
                        {(localWidget.configuration.colors || ['#3b82f6']).map((color, index) => (
                          <ColorPicker
                            key={index}
                            color={color}
                            onChange={(newColor) => {
                              const colors = [...(localWidget.configuration.colors || [])];
                              colors[index] = newColor;
                              handleConfigChange('colors', colors);
                            }}
                          />
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const colors = [...(localWidget.configuration.colors || []), '#3b82f6'];
                            handleConfigChange('colors', colors);
                          }}
                          className="h-8 w-8 p-0"
                        >
                          +
                        </Button>
                      </div>
                    </div>

                    {/* Display Options */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Show Legend</Label>
                        <Switch
                          checked={localWidget.configuration.showLegend ?? true}
                          onCheckedChange={(checked) => handleConfigChange('showLegend', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Show Grid</Label>
                        <Switch
                          checked={localWidget.configuration.showGrid ?? true}
                          onCheckedChange={(checked) => handleConfigChange('showGrid', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Animations</Label>
                        <Switch
                          checked={localWidget.configuration.animations ?? true}
                          onCheckedChange={(checked) => handleConfigChange('animations', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Responsive</Label>
                        <Switch
                          checked={localWidget.configuration.responsive ?? true}
                          onCheckedChange={(checked) => handleConfigChange('responsive', checked)}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="data" className="space-y-4 mt-4">
                    {/* Data Limit */}
                    <div className="space-y-2">
                      <Label>Data Limit</Label>
                      <Input
                        type="number"
                        min="10"
                        max="1000"
                        value={localWidget.configuration.dataLimit || 100}
                        onChange={(e) => handleConfigChange('dataLimit', parseInt(e.target.value))}
                      />
                    </div>

                    {/* Aggregation */}
                    <div className="space-y-2">
                      <Label>Aggregation</Label>
                      <Select
                        value={localWidget.configuration.aggregation || 'sum'}
                        onValueChange={(value) => handleConfigChange('aggregation', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sum">Sum</SelectItem>
                          <SelectItem value="avg">Average</SelectItem>
                          <SelectItem value="count">Count</SelectItem>
                          <SelectItem value="min">Minimum</SelectItem>
                          <SelectItem value="max">Maximum</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Display Format */}
                    <div className="space-y-2">
                      <Label>Display Format</Label>
                      <Select
                        value={localWidget.configuration.displayFormat || 'number'}
                        onValueChange={(value) => handleConfigChange('displayFormat', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="currency">Currency</SelectItem>
                          <SelectItem value="percentage">Percentage</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Precision */}
                    <div className="space-y-2">
                      <Label>Decimal Precision</Label>
                      <Slider
                        value={[localWidget.configuration.precision || 2]}
                        onValueChange={([value]) => handleConfigChange('precision', value)}
                        max={6}
                        min={0}
                        step={1}
                        className="w-full"
                      />
                      <div className="text-xs text-muted-foreground text-center">
                        {localWidget.configuration.precision || 2} decimal places
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="behavior" className="space-y-4 mt-4">
                    {/* Comparison Options */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Show Trends</Label>
                        <Switch
                          checked={localWidget.configuration.showTrends ?? false}
                          onCheckedChange={(checked) => handleConfigChange('showTrends', checked)}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label>Show Comparison</Label>
                        <Switch
                          checked={localWidget.configuration.showComparison ?? false}
                          onCheckedChange={(checked) => handleConfigChange('showComparison', checked)}
                        />
                      </div>
                    </div>

                    {/* Comparison Period */}
                    {localWidget.configuration.showComparison && (
                      <div className="space-y-2">
                        <Label>Comparison Period</Label>
                        <Select
                          value={localWidget.configuration.comparisonPeriod || 'previous_period'}
                          onValueChange={(value) => handleConfigChange('comparisonPeriod', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="previous_period">Previous Period</SelectItem>
                            <SelectItem value="previous_year">Previous Year</SelectItem>
                            <SelectItem value="budget">Budget</SelectItem>
                            <SelectItem value="target">Target</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Thresholds */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Thresholds & Alerts
                </CardTitle>
                <CardDescription>
                  Set up thresholds to highlight important values
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {(localWidget.configuration.thresholds || []).map((threshold, index) => (
                  <Card key={threshold.id} className="p-3">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Input
                          value={threshold.name}
                          onChange={(e) => handleThresholdChange(index, 'name', e.target.value)}
                          placeholder="Threshold name"
                          className="flex-1 mr-2"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeThreshold(index)}
                          className="text-destructive"
                        >
                          Remove
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Select
                          value={threshold.operator}
                          onValueChange={(value) => handleThresholdChange(index, 'operator', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gt">Greater than</SelectItem>
                            <SelectItem value="gte">Greater than or equal</SelectItem>
                            <SelectItem value="lt">Less than</SelectItem>
                            <SelectItem value="lte">Less than or equal</SelectItem>
                            <SelectItem value="eq">Equal to</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          type="number"
                          value={threshold.value}
                          onChange={(e) => handleThresholdChange(index, 'value', parseFloat(e.target.value))}
                          placeholder="Value"
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <ColorPicker
                          color={threshold.color}
                          onChange={(color) => handleThresholdChange(index, 'color', color)}
                        />
                        <Select
                          value={threshold.action}
                          onValueChange={(value) => handleThresholdChange(index, 'action', value)}
                        >
                          <SelectTrigger className="flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="alert">Show Alert</SelectItem>
                            <SelectItem value="highlight">Highlight</SelectItem>
                            <SelectItem value="hide">Hide</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                ))}

                <Button
                  variant="outline"
                  onClick={addThreshold}
                  className="w-full"
                >
                  Add Threshold
                </Button>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges}
            className="gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              Save Changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default WidgetConfigPanel;