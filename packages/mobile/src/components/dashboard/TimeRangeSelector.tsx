import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';

interface TimeRangeSelectorProps {
  selectedRange: '7d' | '30d' | '90d' | '1y';
  onRangeChange: (range: '7d' | '30d' | '90d' | '1y') => void;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selectedRange,
  onRangeChange,
}) => {
  const ranges = [
    {key: '7d', label: '7 Days'},
    {key: '30d', label: '30 Days'},
    {key: '90d', label: '90 Days'},
    {key: '1y', label: '1 Year'},
  ] as const;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Time Range:</Text>
      <View style={styles.buttonContainer}>
        {ranges.map((range) => (
          <TouchableOpacity
            key={range.key}
            style={[
              styles.button,
              selectedRange === range.key && styles.selectedButton,
            ]}
            onPress={() => onRangeChange(range.key)}>
            <Text
              style={[
                styles.buttonText,
                selectedRange === range.key && styles.selectedButtonText,
              ]}>
              {range.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    marginBottom: 4,
  },
  selectedButton: {
    backgroundColor: '#1e40af',
  },
  buttonText: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  selectedButtonText: {
    color: '#ffffff',
  },
});

export default TimeRangeSelector;