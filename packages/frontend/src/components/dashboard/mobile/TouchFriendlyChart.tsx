import React, { useState, useRef, useEffect } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';
import { cn } from '../../../lib/utils';

interface TouchFriendlyChartProps {
  data: any[];
  type: 'line' | 'bar' | 'pie';
  title: string;
  xKey?: string;
  yKey?: string;
  colors?: string[];
  className?: string;
}

export const TouchFriendlyChart: React.FC<TouchFriendlyChartProps> = ({
  data,
  type,
  title,
  xKey = 'name',
  yKey = 'value',
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
  className
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  // Handle touch gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 1) {
      // Single touch - start panning
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      });
    } else if (e.touches.length === 2) {
      // Two touches - start pinch zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      setLastTouchDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 1 && touchStart) {
      // Single touch - pan
      const deltaX = e.touches[0].clientX - touchStart.x;
      const deltaY = e.touches[0].clientY - touchStart.y;
      
      setPanOffset(prev => ({
        x: prev.x + deltaX * 0.5,
        y: prev.y + deltaY * 0.5
      }));
      
      setTouchStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      });
    } else if (e.touches.length === 2 && lastTouchDistance) {
      // Two touches - pinch zoom
      const distance = getTouchDistance(e.touches[0], e.touches[1]);
      const scale = distance / lastTouchDistance;
      
      setZoomLevel(prev => Math.max(0.5, Math.min(3, prev * scale)));
      setLastTouchDistance(distance);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setTouchStart(null);
    setLastTouchDistance(null);
  };

  const getTouchDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const resetView = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const zoomIn = () => {
    setZoomLevel(prev => Math.min(3, prev * 1.2));
  };

  const zoomOut = () => {
    setZoomLevel(prev => Math.max(0.5, prev / 1.2));
  };

  // Custom tooltip for mobile
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg min-w-[120px]">
          <p className="font-medium text-sm">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 20, right: 30, left: 20, bottom: 20 }
    };

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey={xKey} 
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line 
              type="monotone" 
              dataKey={yKey} 
              stroke={colors[0]} 
              strokeWidth={3}
              dot={{ r: 6, strokeWidth: 2 }}
              activeDot={{ r: 8, strokeWidth: 2 }}
            />
          </LineChart>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey={xKey} 
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar 
              dataKey={yKey} 
              fill={colors[0]}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={80}
              dataKey={yKey}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        );

      default:
        return null;
    }
  };

  return (
    <Card className={cn(
      "touch-friendly-chart select-none",
      isFullscreen && "fixed inset-0 z-50 rounded-none",
      className
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium">{title}</CardTitle>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomOut}
              className="p-2"
              disabled={zoomLevel <= 0.5}
            >
              <ZoomOut size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={zoomIn}
              className="p-2"
              disabled={zoomLevel >= 3}
            >
              <ZoomIn size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={resetView}
              className="p-2"
            >
              <RotateCcw size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2"
            >
              <Maximize2 size={16} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div
          ref={chartRef}
          className="chart-container overflow-hidden touch-manipulation"
          style={{
            height: isFullscreen ? 'calc(100vh - 120px)' : '300px',
            transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
            transformOrigin: 'center center'
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <ResponsiveContainer width="100%" height="100%">
            {renderChart()}
          </ResponsiveContainer>
        </div>
        
        {/* Touch Instructions */}
        <div className="mt-2 text-xs text-gray-500 text-center">
          Pinch to zoom • Drag to pan • Tap controls for precision
        </div>
      </CardContent>
    </Card>
  );
};