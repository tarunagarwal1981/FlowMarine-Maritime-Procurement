/**
 * Heatmap Widget Component
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { DashboardWidget, DashboardFilters, WidgetConfiguration } from '../../../types/dashboard';

interface HeatmapProps {
  widget: DashboardWidget;
  configuration: WidgetConfiguration;
  filters?: DashboardFilters;
  isCustomizing?: boolean;
}

export const Heatmap: React.FC<HeatmapProps> = ({
  widget,
  isCustomizing = false,
}) => {
  if (isCustomizing) {
    return (
      <div className="flex items-center justify-center h-full min-h-[200px] border-2 border-dashed border-muted-foreground/25 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-semibold text-muted-foreground mb-2">
            Heatmap Widget
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{widget.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-center h-48">
          <p className="text-muted-foreground">Heatmap - Implementation pending</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default Heatmap;