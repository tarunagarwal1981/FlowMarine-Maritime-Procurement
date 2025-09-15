import React, { useState, useEffect, useRef } from 'react';
import { ResponsiveContainer } from 'recharts';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { TouchFriendlyChart } from './TouchFriendlyChart';
import { cn } from '../../../lib/utils';

interface ResponsiveChartContainerProps {
  data: any[];
  type: 'line' | 'bar' | 'pie';
  title: string;
  xKey?: string;
  yKey?: string;
  colors?: string[];
  className?: string;
  children?: React.ReactNode;
}

export const ResponsiveChartContainer: React.FC<ResponsiveChartContainerProps> = ({
  data,
  type,
  title,
  xKey = 'name',
  yKey = 'value',
  colors,
  className,
  children
}) => {
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Media queries for different screen sizes
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
  const isSmallMobile = useMediaQuery('(max-width: 480px)');
  const isLandscape = useMediaQuery('(orientation: landscape)');

  // Update dimensions and orientation
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
    };
  }, []);

  // Calculate responsive chart height
  const getChartHeight = () => {
    if (isSmallMobile) {
      return orientation === 'portrait' ? 200 : 150;
    }
    if (isMobile) {
      return orientation === 'portrait' ? 250 : 180;
    }
    if (isTablet) {
      return orientation === 'portrait' ? 300 : 220;
    }
    return 350;
  };

  // Get responsive margin settings
  const getChartMargins = () => {
    if (isSmallMobile) {
      return { top: 10, right: 10, left: 10, bottom: 10 };
    }
    if (isMobile) {
      return { top: 15, right: 15, left: 15, bottom: 15 };
    }
    return { top: 20, right: 30, left: 20, bottom: 20 };
  };

  // Get responsive font sizes
  const getFontSizes = () => {
    if (isSmallMobile) {
      return { tick: 10, legend: 10, tooltip: 11 };
    }
    if (isMobile) {
      return { tick: 11, legend: 11, tooltip: 12 };
    }
    return { tick: 12, legend: 12, tooltip: 13 };
  };

  // Determine if we should use touch-friendly version
  const shouldUseTouchFriendly = isMobile || isTablet;

  if (shouldUseTouchFriendly) {
    return (
      <div
        ref={containerRef}
        className={cn(
          "responsive-chart-container w-full",
          className
        )}
      >
        <TouchFriendlyChart
          data={data}
          type={type}
          title={title}
          xKey={xKey}
          yKey={yKey}
          colors={colors}
        />
      </div>
    );
  }

  // Desktop version with standard responsive container
  return (
    <div
      ref={containerRef}
      className={cn(
        "responsive-chart-container w-full",
        className
      )}
      style={{ height: getChartHeight() }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
};

// Hook for responsive chart configuration
export const useResponsiveChartConfig = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isTablet = useMediaQuery('(min-width: 769px) and (max-width: 1024px)');
  const isSmallMobile = useMediaQuery('(max-width: 480px)');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  useEffect(() => {
    const updateOrientation = () => {
      setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
    };

    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  return {
    isMobile,
    isTablet,
    isSmallMobile,
    orientation,
    chartHeight: (() => {
      if (isSmallMobile) {
        return orientation === 'portrait' ? 200 : 150;
      }
      if (isMobile) {
        return orientation === 'portrait' ? 250 : 180;
      }
      if (isTablet) {
        return orientation === 'portrait' ? 300 : 220;
      }
      return 350;
    })(),
    margins: (() => {
      if (isSmallMobile) {
        return { top: 10, right: 10, left: 10, bottom: 10 };
      }
      if (isMobile) {
        return { top: 15, right: 15, left: 15, bottom: 15 };
      }
      return { top: 20, right: 30, left: 20, bottom: 20 };
    })(),
    fontSize: (() => {
      if (isSmallMobile) {
        return { tick: 10, legend: 10, tooltip: 11 };
      }
      if (isMobile) {
        return { tick: 11, legend: 11, tooltip: 12 };
      }
      return { tick: 12, legend: 12, tooltip: 13 };
    })(),
    shouldUseTouchFriendly: isMobile || isTablet
  };
};