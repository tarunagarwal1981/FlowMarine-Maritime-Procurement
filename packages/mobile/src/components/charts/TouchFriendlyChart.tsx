import React, {useState, useRef, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  PanGestureHandler,
  PinchGestureHandler,
  State,
} from 'react-native';
import {
  PanGestureHandlerGestureEvent,
  PinchGestureHandlerGestureEvent,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import Svg, {
  Line,
  Circle,
  Path,
  Text as SvgText,
  G,
  Rect,
} from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialIcons';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

export interface ChartDataPoint {
  x: number | string;
  y: number;
  label?: string;
  color?: string;
}

export interface TouchFriendlyChartProps {
  data: ChartDataPoint[];
  type: 'line' | 'bar' | 'area';
  width?: number;
  height?: number;
  color?: string;
  showGrid?: boolean;
  showTooltip?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  onDataPointPress?: (point: ChartDataPoint, index: number) => void;
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  formatXValue?: (value: any) => string;
  formatYValue?: (value: number) => string;
}

const TouchFriendlyChart: React.FC<TouchFriendlyChartProps> = ({
  data,
  type = 'line',
  width = screenWidth - 32,
  height = 200,
  color = '#1e40af',
  showGrid = true,
  showTooltip = true,
  enableZoom = true,
  enablePan = true,
  onDataPointPress,
  title,
  xAxisLabel,
  yAxisLabel,
  formatXValue = (value) => String(value),
  formatYValue = (value) => value.toFixed(1),
}) => {
  const [selectedPoint, setSelectedPoint] = useState<{point: ChartDataPoint; index: number} | null>(null);
  const [showTooltipModal, setShowTooltipModal] = useState(false);
  
  // Gesture handling
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Chart dimensions and padding
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Calculate data bounds
  const {minX, maxX, minY, maxY} = useMemo(() => {
    if (data.length === 0) return {minX: 0, maxX: 1, minY: 0, maxY: 1};
    
    const xValues = data.map((d, i) => typeof d.x === 'number' ? d.x : i);
    const yValues = data.map(d => d.y);
    
    return {
      minX: Math.min(...xValues),
      maxX: Math.max(...xValues),
      minY: Math.min(...yValues),
      maxY: Math.max(...yValues),
    };
  }, [data]);

  // Scale functions
  const xScale = useCallback((value: number) => {
    return (value - minX) / (maxX - minX) * chartWidth;
  }, [minX, maxX, chartWidth]);

  const yScale = useCallback((value: number) => {
    return chartHeight - (value - minY) / (maxY - minY) * chartHeight;
  }, [minY, maxY, chartHeight]);

  // Generate path for line/area charts
  const generatePath = useCallback(() => {
    if (data.length === 0) return '';
    
    const points = data.map((d, i) => {
      const x = typeof d.x === 'number' ? d.x : i;
      return {
        x: xScale(x),
        y: yScale(d.y),
      };
    });

    let path = `M ${points[0].x} ${points[0].y}`;
    
    if (type === 'line' || type === 'area') {
      for (let i = 1; i < points.length; i++) {
        path += ` L ${points[i].x} ${points[i].y}`;
      }
    }
    
    if (type === 'area') {
      path += ` L ${points[points.length - 1].x} ${chartHeight}`;
      path += ` L ${points[0].x} ${chartHeight}`;
      path += ' Z';
    }
    
    return path;
  }, [data, type, xScale, yScale, chartHeight]);

  // Pinch gesture handler
  const pinchHandler = useAnimatedGestureHandler<PinchGestureHandlerGestureEvent>({
    onStart: (_, context) => {
      context.startScale = scale.value;
    },
    onActive: (event, context) => {
      if (!enableZoom) return;
      
      scale.value = Math.max(0.5, Math.min(3, context.startScale * event.scale));
      focalX.value = event.focalX;
      focalY.value = event.focalY;
    },
    onEnd: () => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    },
  });

  // Pan gesture handler
  const panHandler = useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
    onStart: (_, context) => {
      context.startX = translateX.value;
      context.startY = translateY.value;
    },
    onActive: (event, context) => {
      if (!enablePan) return;
      
      translateX.value = context.startX + event.translationX;
      translateY.value = context.startY + event.translationY;
    },
    onEnd: () => {
      // Constrain pan within bounds
      const maxTranslateX = (scale.value - 1) * chartWidth / 2;
      const maxTranslateY = (scale.value - 1) * chartHeight / 2;
      
      translateX.value = withSpring(
        Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX.value))
      );
      translateY.value = withSpring(
        Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY.value))
      );
    },
  });

  // Animated style for chart container
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Handle data point press
  const handleDataPointPress = useCallback((point: ChartDataPoint, index: number) => {
    setSelectedPoint({point, index});
    if (showTooltip) {
      setShowTooltipModal(true);
    }
    onDataPointPress?.(point, index);
  }, [showTooltip, onDataPointPress]);

  // Reset zoom and pan
  const resetZoom = useCallback(() => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  }, []);

  // Render grid lines
  const renderGrid = () => {
    if (!showGrid) return null;

    const gridLines = [];
    const xSteps = 5;
    const ySteps = 5;

    // Vertical grid lines
    for (let i = 0; i <= xSteps; i++) {
      const x = (chartWidth / xSteps) * i;
      gridLines.push(
        <Line
          key={`v-${i}`}
          x1={x}
          y1={0}
          x2={x}
          y2={chartHeight}
          stroke="#e2e8f0"
          strokeWidth={1}
        />
      );
    }

    // Horizontal grid lines
    for (let i = 0; i <= ySteps; i++) {
      const y = (chartHeight / ySteps) * i;
      gridLines.push(
        <Line
          key={`h-${i}`}
          x1={0}
          y1={y}
          x2={chartWidth}
          y2={y}
          stroke="#e2e8f0"
          strokeWidth={1}
        />
      );
    }

    return <G>{gridLines}</G>;
  };

  // Render data points
  const renderDataPoints = () => {
    return data.map((point, index) => {
      const x = typeof point.x === 'number' ? point.x : index;
      const scaledX = xScale(x);
      const scaledY = yScale(point.y);
      const pointColor = point.color || color;

      if (type === 'bar') {
        const barWidth = chartWidth / data.length * 0.6;
        const barHeight = chartHeight - scaledY;
        
        return (
          <G key={index}>
            <Rect
              x={scaledX - barWidth / 2}
              y={scaledY}
              width={barWidth}
              height={barHeight}
              fill={pointColor}
              onPress={() => handleDataPointPress(point, index)}
            />
          </G>
        );
      } else {
        return (
          <Circle
            key={index}
            cx={scaledX}
            cy={scaledY}
            r={6}
            fill={pointColor}
            stroke="#ffffff"
            strokeWidth={2}
            onPress={() => handleDataPointPress(point, index)}
          />
        );
      }
    });
  };

  // Render chart path (for line/area charts)
  const renderPath = () => {
    if (type === 'bar') return null;

    const path = generatePath();
    
    return (
      <Path
        d={path}
        stroke={type === 'area' ? 'none' : color}
        strokeWidth={type === 'area' ? 0 : 2}
        fill={type === 'area' ? `${color}40` : 'none'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  };

  // Render axes labels
  const renderAxes = () => {
    const axes = [];
    
    // X-axis labels
    const xSteps = Math.min(5, data.length);
    for (let i = 0; i <= xSteps; i++) {
      const dataIndex = Math.floor((data.length - 1) * i / xSteps);
      const point = data[dataIndex];
      if (!point) continue;
      
      const x = typeof point.x === 'number' ? point.x : dataIndex;
      const scaledX = xScale(x);
      const value = formatXValue(point.x);
      
      axes.push(
        <SvgText
          key={`x-${i}`}
          x={scaledX}
          y={chartHeight + 20}
          fontSize={12}
          fill="#64748b"
          textAnchor="middle"
        >
          {value}
        </SvgText>
      );
    }

    // Y-axis labels
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
      const value = minY + (maxY - minY) * i / ySteps;
      const scaledY = yScale(value);
      const formattedValue = formatYValue(value);
      
      axes.push(
        <SvgText
          key={`y-${i}`}
          x={-10}
          y={scaledY + 4}
          fontSize={12}
          fill="#64748b"
          textAnchor="end"
        >
          {formattedValue}
        </SvgText>
      );
    }

    return <G>{axes}</G>;
  };

  return (
    <View style={styles.container}>
      {title && (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {(enableZoom || enablePan) && (
            <TouchableOpacity onPress={resetZoom} style={styles.resetButton}>
              <Icon name="zoom-out-map" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>
      )}
      
      <PinchGestureHandler onGestureEvent={pinchHandler} enabled={enableZoom}>
        <Animated.View>
          <PanGestureHandler onGestureEvent={panHandler} enabled={enablePan}>
            <Animated.View style={[styles.chartContainer, animatedStyle]}>
              <Svg width={width} height={height}>
                <G x={padding} y={padding}>
                  {renderGrid()}
                  {renderPath()}
                  {renderDataPoints()}
                  {renderAxes()}
                </G>
              </Svg>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </PinchGestureHandler>

      {xAxisLabel && (
        <Text style={styles.xAxisLabel}>{xAxisLabel}</Text>
      )}
      
      {yAxisLabel && (
        <Text style={styles.yAxisLabel}>{yAxisLabel}</Text>
      )}

      {/* Tooltip Modal */}
      <Modal
        visible={showTooltipModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTooltipModal(false)}
      >
        <TouchableOpacity
          style={styles.tooltipOverlay}
          activeOpacity={1}
          onPress={() => setShowTooltipModal(false)}
        >
          <View style={styles.tooltip}>
            {selectedPoint && (
              <>
                <Text style={styles.tooltipTitle}>
                  {selectedPoint.point.label || `Point ${selectedPoint.index + 1}`}
                </Text>
                <Text style={styles.tooltipValue}>
                  X: {formatXValue(selectedPoint.point.x)}
                </Text>
                <Text style={styles.tooltipValue}>
                  Y: {formatYValue(selectedPoint.point.y)}
                </Text>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    margin: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  resetButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  chartContainer: {
    alignItems: 'center',
  },
  xAxisLabel: {
    textAlign: 'center',
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  yAxisLabel: {
    position: 'absolute',
    left: 8,
    top: '50%',
    fontSize: 12,
    color: '#64748b',
    transform: [{ rotate: '-90deg' }],
  },
  tooltipOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltip: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    margin: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  tooltipTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  tooltipValue: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
});

export default TouchFriendlyChart;