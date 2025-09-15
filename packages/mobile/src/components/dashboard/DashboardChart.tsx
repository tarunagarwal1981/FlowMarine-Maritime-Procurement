import React from 'react';
import {View, Text, StyleSheet, Dimensions, TouchableOpacity} from 'react-native';
import {LineChart, BarChart, PieChart} from 'react-native-chart-kit';

interface DashboardChartProps {
  type: 'line' | 'bar' | 'pie' | 'comparison';
  data: any[];
  color?: string;
  colors?: string[];
  onDataPointPress?: (data: any) => void;
}

const {width: screenWidth} = Dimensions.get('window');
const chartWidth = screenWidth - 32;

const DashboardChart: React.FC<DashboardChartProps> = ({
  type,
  data,
  color = '#1e40af',
  colors = ['#1e40af', '#059669', '#dc2626', '#7c3aed'],
  onDataPointPress,
}) => {
  const chartConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(30, 64, 175, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(100, 116, 139, ${opacity})`,
    style: {
      borderRadius: 8,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: color,
    },
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke: '#e2e8f0',
      strokeWidth: 1,
    },
    fillShadowGradient: color,
    fillShadowGradientOpacity: 0.1,
  };

  const renderLineChart = () => {
    const chartData = {
      labels: data.map(item => item.label),
      datasets: [
        {
          data: data.map(item => item.value),
          color: (opacity = 1) => `rgba(30, 64, 175, ${opacity})`,
          strokeWidth: 3,
        },
      ],
    };

    return (
      <LineChart
        data={chartData}
        width={chartWidth}
        height={220}
        chartConfig={chartConfig}
        bezier
        style={styles.chart}
        onDataPointClick={onDataPointPress}
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLines={false}
        withHorizontalLines={true}
        withDots={true}
        withShadow={false}
      />
    );
  };

  const renderBarChart = () => {
    const chartData = {
      labels: data.map(item => item.label.length > 8 ? item.label.substring(0, 8) + '...' : item.label),
      datasets: [
        {
          data: data.map(item => item.value),
        },
      ],
    };

    return (
      <BarChart
        data={chartData}
        width={chartWidth}
        height={220}
        chartConfig={chartConfig}
        style={styles.chart}
        showValuesOnTopOfBars={true}
        fromZero={true}
        withInnerLines={false}
        withCustomBarColorFromData={false}
      />
    );
  };

  const renderPieChart = () => {
    const pieData = data.map((item, index) => ({
      name: item.label,
      population: item.value,
      color: item.color || colors[index % colors.length],
      legendFontColor: '#64748b',
      legendFontSize: 12,
    }));

    return (
      <View style={styles.pieContainer}>
        <PieChart
          data={pieData}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          center={[10, 0]}
          absolute={false}
        />
      </View>
    );
  };

  const renderComparisonChart = () => {
    const budgetData = data.map(item => item.budget);
    const actualData = data.map(item => item.actual);
    
    const chartData = {
      labels: data.map(item => item.label),
      datasets: [
        {
          data: budgetData,
          color: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
          strokeWidth: 2,
        },
        {
          data: actualData,
          color: (opacity = 1) => `rgba(30, 64, 175, ${opacity})`,
          strokeWidth: 3,
        },
      ],
      legend: ['Budget', 'Actual'],
    };

    return (
      <LineChart
        data={chartData}
        width={chartWidth}
        height={220}
        chartConfig={chartConfig}
        style={styles.chart}
        withInnerLines={false}
        withOuterLines={false}
        withVerticalLines={false}
        withHorizontalLines={true}
        withDots={true}
        withShadow={false}
      />
    );
  };

  return (
    <View style={styles.container}>
      {type === 'line' && renderLineChart()}
      {type === 'bar' && renderBarChart()}
      {type === 'pie' && renderPieChart()}
      {type === 'comparison' && renderComparisonChart()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: 'hidden',
  },
  chart: {
    borderRadius: 8,
  },
  pieContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
});

export default DashboardChart;