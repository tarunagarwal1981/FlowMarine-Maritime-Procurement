import React from 'react';
import {View, Text, StyleSheet, Dimensions} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: string;
  color: string;
}

const {width} = Dimensions.get('window');
const cardWidth = (width - 48) / 2;

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType,
  icon,
  color,
}) => {
  return (
    <View style={[styles.card, {borderLeftColor: color}]}>
      <View style={styles.header}>
        <Icon name={icon} size={24} color={color} />
        <View style={styles.changeContainer}>
          <Icon
            name={changeType === 'positive' ? 'trending-up' : 'trending-down'}
            size={16}
            color={changeType === 'positive' ? '#10b981' : '#ef4444'}
          />
          <Text
            style={[
              styles.changeText,
              {color: changeType === 'positive' ? '#10b981' : '#ef4444'},
            ]}>
            {change}
          </Text>
        </View>
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
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
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

export default MetricCard;