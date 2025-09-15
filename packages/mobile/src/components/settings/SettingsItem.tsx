import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface SettingsItemProps {
  title: string;
  subtitle?: string;
  value?: string | number | boolean;
  type: 'navigation' | 'switch' | 'value' | 'action';
  onPress?: () => void;
  onValueChange?: (value: boolean) => void;
  icon?: string;
  iconColor?: string;
  disabled?: boolean;
  style?: ViewStyle;
  destructive?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  title,
  subtitle,
  value,
  type,
  onPress,
  onValueChange,
  icon,
  iconColor = '#64748b',
  disabled = false,
  style,
  destructive = false,
}) => {
  const renderRightContent = () => {
    switch (type) {
      case 'switch':
        return (
          <Switch
            value={value as boolean}
            onValueChange={onValueChange}
            disabled={disabled}
            trackColor={{false: '#e2e8f0', true: '#3b82f6'}}
            thumbColor={value ? '#ffffff' : '#f1f5f9'}
          />
        );
      case 'value':
        return (
          <View style={styles.valueContainer}>
            <Text style={[styles.valueText, disabled && styles.disabledText]}>
              {value}
            </Text>
            <Icon name="chevron-right" size={20} color="#94a3b8" />
          </View>
        );
      case 'navigation':
        return <Icon name="chevron-right" size={20} color="#94a3b8" />;
      case 'action':
        return null;
      default:
        return null;
    }
  };

  const handlePress = () => {
    if (!disabled && onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        disabled && styles.disabledContainer,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || type === 'switch'}
      activeOpacity={0.7}>
      <View style={styles.leftContent}>
        {icon && (
          <View style={styles.iconContainer}>
            <Icon
              name={icon}
              size={24}
              color={destructive ? '#ef4444' : iconColor}
            />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              destructive && styles.destructiveText,
              disabled && styles.disabledText,
            ]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[styles.subtitle, disabled && styles.disabledText]}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.rightContent}>{renderRightContent()}</View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f5f9',
  },
  disabledContainer: {
    opacity: 0.5,
  },
  leftContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    marginRight: 12,
    width: 32,
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
    lineHeight: 18,
  },
  destructiveText: {
    color: '#ef4444',
  },
  disabledText: {
    color: '#94a3b8',
  },
  rightContent: {
    marginLeft: 12,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  valueText: {
    fontSize: 16,
    color: '#64748b',
    marginRight: 8,
  },
});

export default SettingsItem;