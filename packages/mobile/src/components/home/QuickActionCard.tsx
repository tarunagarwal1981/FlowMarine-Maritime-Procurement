import React from 'react';
import {TouchableOpacity, Text, StyleSheet, Dimensions} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface QuickActionCardProps {
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

const {width} = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // 2 cards per row with margins

const QuickActionCard: React.FC<QuickActionCardProps> = ({
  title,
  icon,
  color,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={[styles.card, {borderLeftColor: color}]}
      onPress={onPress}
      activeOpacity={0.7}>
      <Icon name={icon} size={32} color={color} />
      <Text style={styles.title}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    margin: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 100,
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
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    marginTop: 8,
  },
});

export default QuickActionCard;