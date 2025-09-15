/**
 * Drill Down Navigation Component
 * Provides multi-level drill-down capabilities with breadcrumb navigation
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Home,
  Ship,
  Package,
  Building,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { cn } from '../../utils/cn';

export interface DrillDownLevel {
  level: 'fleet' | 'vessel' | 'category' | 'vendor' | 'transaction';
  id?: string;
  name?: string;
  value?: number;
  metadata?: Record<string, any>;
}

interface DrillDownItem {
  id: string;
  name: string;
  value: number;
  percentage?: number;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: number;
  metadata?: Record<string, any>;
  hasChildren?: boolean;
}

interface DrillDownNavigationProps {
  currentPath: DrillDownLevel[];
  onNavigate: (path: DrillDownLevel[]) => void;
  onLevelSelect: (level: DrillDownLevel, item: DrillDownItem) => void;
  className?: string;
}

// Mock data for drill-down levels
const MOCK_DATA: Record<string, DrillDownItem[]> = {
  fleet: [
    {
      id: 'vessel-1',
      name: 'MV Atlantic',
      value: 125000,
      percentage: 35,
      trend: 'up',
      trendValue: 12.5,
      hasChildren: true,
      metadata: { vesselType: 'Container', flag: 'Panama' },
    },
    {
      id: 'vessel-2',
      name: 'MV Pacific',
      value: 98000,
      percentage: 28,
      trend: 'down',
      trendValue: -5.2,
      hasChildren: true,
      metadata: { vesselType: 'Bulk Carrier', flag: 'Liberia' },
    },
    {
      id: 'vessel-3',
      name: 'MV Indian',
      value: 87000,
      percentage: 25,
      trend: 'stable',
      trendValue: 1.8,
      hasChildren: true,
      metadata: { vesselType: 'Tanker', flag: 'Marshall Islands' },
    },
    {
      id: 'vessel-4',
      name: 'MV Arctic',
      value: 42000,
      percentage: 12,
      trend: 'up',
      trendValue: 8.3,
      hasChildren: true,
      metadata: { vesselType: 'General Cargo', flag: 'Singapore' },
    },
  ],
  'vessel-1': [
    {
      id: 'category-1',
      name: 'Engine Parts',
      value: 45000,
      percentage: 36,
      trend: 'up',
      trendValue: 15.2,
      hasChildren: true,
    },
    {
      id: 'category-2',
      name: 'Deck Equipment',
      value: 32000,
      percentage: 26,
      trend: 'stable',
      trendValue: 2.1,
      hasChildren: true,
    },
    {
      id: 'category-3',
      name: 'Safety Gear',
      value: 28000,
      percentage: 22,
      trend: 'down',
      trendValue: -3.5,
      hasChildren: true,
    },
    {
      id: 'category-4',
      name: 'Navigation',
      value: 20000,
      percentage: 16,
      trend: 'up',
      trendValue: 7.8,
      hasChildren: true,
    },
  ],
  'category-1': [
    {
      id: 'vendor-1',
      name: 'Maritime Supply Co.',
      value: 18000,
      percentage: 40,
      trend: 'up',
      trendValue: 22.1,
      hasChildren: true,
    },
    {
      id: 'vendor-2',
      name: 'Ocean Parts Ltd.',
      value: 15000,
      percentage: 33,
      trend: 'stable',
      trendValue: 1.5,
      hasChildren: true,
    },
    {
      id: 'vendor-3',
      name: 'Ship Services Inc.',
      value: 12000,
      percentage: 27,
      trend: 'down',
      trendValue: -8.2,
      hasChildren: true,
    },
  ],
  'vendor-1': [
    {
      id: 'transaction-1',
      name: 'Engine Overhaul Kit',
      value: 8500,
      percentage: 47,
      hasChildren: false,
      metadata: { date: '2024-01-15', status: 'Completed' },
    },
    {
      id: 'transaction-2',
      name: 'Fuel Injection System',
      value: 5200,
      percentage: 29,
      hasChildren: false,
      metadata: { date: '2024-01-12', status: 'Pending' },
    },
    {
      id: 'transaction-3',
      name: 'Turbocharger Parts',
      value: 4300,
      percentage: 24,
      hasChildren: false,
      metadata: { date: '2024-01-08', status: 'Approved' },
    },
  ],
};

export const DrillDownNavigation: React.FC<DrillDownNavigationProps> = ({
  currentPath,
  onNavigate,
  onLevelSelect,
  className,
}) => {
  const [currentData, setCurrentData] = useState<DrillDownItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Get current level data
  useEffect(() => {
    setIsLoading(true);
    
    // Simulate API call delay
    const timer = setTimeout(() => {
      const currentLevel = currentPath[currentPath.length - 1];
      let dataKey = 'fleet';
      
      if (currentLevel?.level === 'vessel' && currentLevel.id) {
        dataKey = currentLevel.id;
      } else if (currentLevel?.level === 'category' && currentLevel.id) {
        dataKey = currentLevel.id;
      } else if (currentLevel?.level === 'vendor' && currentLevel.id) {
        dataKey = currentLevel.id;
      }
      
      setCurrentData(MOCK_DATA[dataKey] || []);
      setIsLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [currentPath]);

  // Handle navigation to a specific level
  const handleNavigateToLevel = useCallback((levelIndex: number) => {
    const newPath = currentPath.slice(0, levelIndex + 1);
    onNavigate(newPath);
  }, [currentPath, onNavigate]);

  // Handle item selection
  const handleItemSelect = useCallback((item: DrillDownItem) => {
    if (!item.hasChildren) return;

    const currentLevel = currentPath[currentPath.length - 1];
    let nextLevel: DrillDownLevel['level'];

    switch (currentLevel?.level || 'fleet') {
      case 'fleet':
        nextLevel = 'vessel';
        break;
      case 'vessel':
        nextLevel = 'category';
        break;
      case 'category':
        nextLevel = 'vendor';
        break;
      case 'vendor':
        nextLevel = 'transaction';
        break;
      default:
        return;
    }

    const newLevel: DrillDownLevel = {
      level: nextLevel,
      id: item.id,
      name: item.name,
      value: item.value,
      metadata: item.metadata,
    };

    onLevelSelect(newLevel, item);
  }, [currentPath, onLevelSelect]);

  // Handle back navigation
  const handleGoBack = useCallback(() => {
    if (currentPath.length > 1) {
      const newPath = currentPath.slice(0, -1);
      onNavigate(newPath);
    }
  }, [currentPath, onNavigate]);

  // Handle home navigation
  const handleGoHome = useCallback(() => {
    onNavigate([{ level: 'fleet' }]);
  }, [onNavigate]);

  // Get level icon
  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'fleet':
        return <Home className="h-4 w-4" />;
      case 'vessel':
        return <Ship className="h-4 w-4" />;
      case 'category':
        return <Package className="h-4 w-4" />;
      case 'vendor':
        return <Building className="h-4 w-4" />;
      case 'transaction':
        return <Receipt className="h-4 w-4" />;
      default:
        return <Home className="h-4 w-4" />;
    }
  };

  // Get trend icon
  const getTrendIcon = (trend?: string) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-600" />;
      case 'down':
        return <TrendingUp className="h-3 w-3 text-red-600 rotate-180" />;
      default:
        return null;
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const currentLevel = currentPath[currentPath.length - 1];
  const canGoBack = currentPath.length > 1;

  return (
    <Card className={cn("drill-down-navigation", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {getLevelIcon(currentLevel?.level || 'fleet')}
            Drill Down Navigation
          </CardTitle>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoHome}
              disabled={currentPath.length <= 1}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Home
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoBack}
              disabled={!canGoBack}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        </div>

        {/* Breadcrumb navigation */}
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink
                onClick={() => handleNavigateToLevel(0)}
                className="cursor-pointer flex items-center gap-1"
              >
                <Home className="h-3 w-3" />
                Fleet
              </BreadcrumbLink>
            </BreadcrumbItem>
            
            {currentPath.slice(1).map((level, index) => (
              <React.Fragment key={`${level.level}-${level.id}`}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {index === currentPath.length - 2 ? (
                    <BreadcrumbPage className="flex items-center gap-1">
                      {getLevelIcon(level.level)}
                      {level.name || level.level}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      onClick={() => handleNavigateToLevel(index + 1)}
                      className="cursor-pointer flex items-center gap-1"
                    >
                      {getLevelIcon(level.level)}
                      {level.name || level.level}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-sm text-muted-foreground">Loading data...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {currentData.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border transition-colors",
                  item.hasChildren && "cursor-pointer hover:bg-muted/50"
                )}
                onClick={() => item.hasChildren && handleItemSelect(item)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.name}</span>
                    {item.hasChildren && (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  
                  {item.metadata && (
                    <div className="flex gap-1">
                      {Object.entries(item.metadata).map(([key, value]) => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}: {value}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Trend indicator */}
                  {item.trend && item.trendValue && (
                    <div className="flex items-center gap-1">
                      {getTrendIcon(item.trend)}
                      <span className={cn(
                        "text-xs font-medium",
                        item.trend === 'up' && "text-green-600",
                        item.trend === 'down' && "text-red-600",
                        item.trend === 'stable' && "text-gray-600"
                      )}>
                        {item.trendValue > 0 ? '+' : ''}{item.trendValue}%
                      </span>
                    </div>
                  )}

                  {/* Percentage */}
                  {item.percentage && (
                    <Badge variant="secondary" className="text-xs">
                      {item.percentage}%
                    </Badge>
                  )}

                  {/* Value */}
                  <span className="text-sm font-semibold">
                    {formatCurrency(item.value)}
                  </span>
                </div>
              </div>
            ))}

            {currentData.length === 0 && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No data available at this level</p>
              </div>
            )}
          </div>
        )}

        {/* Level summary */}
        {currentData.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {currentData.length} items at {currentLevel?.level || 'fleet'} level
              </span>
              <span className="font-semibold">
                Total: {formatCurrency(currentData.reduce((sum, item) => sum + item.value, 0))}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default DrillDownNavigation;