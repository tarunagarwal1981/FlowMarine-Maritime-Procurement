import React from 'react';
import {View, Text, StyleSheet, Dimensions} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface DashboardWidgetProps {
  title: string;
  value: string;
  icon: string;
  color: string;
  trend?: string;
}

const {width} = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  title,
  value,
  icon,
  color,
  trend,
}) => {
  const isPositiveTrend = trend?.startsWith('+');
  const isNegativeTrend = trend?.startsWith('-');

  return (
    <View style={[styles.card, {borderLeftColor: color}]}>
      <View style={styles.header}>
        <Icon name={icon} size={24} color={color} />
        {trend && (
          <View style={styles.trendContainer}>
            <Icon
              name={isPositiveTrend ? 'trending-up' : 'trending-down'}
              size={16}
              color={isPositiveTrend ? '#10b981' : '#ef4444'}
            />
            <Text
              style={[
                styles.trendText,
                {color: isPositiveTrend ? '#10b981' : '#ef4444'},
              ]}>
              {trend}
            </Text>
          </View>
        )}
      </View>
      
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    margin: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 2,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  title: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
});

export default DashboardWidget;