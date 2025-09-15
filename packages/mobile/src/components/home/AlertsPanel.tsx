import React from 'react';
import {View, Text, StyleSheet, FlatList} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Alert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
}

const AlertsPanel: React.FC<AlertsPanelProps> = ({alerts}) => {
  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      case 'info':
        return 'info';
      default:
        return 'info';
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'warning':
        return '#f59e0b';
      case 'error':
        return '#ef4444';
      case 'info':
        return '#3b82f6';
      default:
        return '#64748b';
    }
  };

  const getAlertBackgroundColor = (type: string) => {
    switch (type) {
      case 'warning':
        return '#fef3c7';
      case 'error':
        return '#fee2e2';
      case 'info':
        return '#dbeafe';
      default:
        return '#f8fafc';
    }
  };

  const renderAlert = ({item}: {item: Alert}) => (
    <View style={[styles.alertItem, {backgroundColor: getAlertBackgroundColor(item.type)}]}>
      <Icon name={getAlertIcon(item.type)} size={20} color={getAlertColor(item.type)} />
      <Text style={[styles.alertMessage, {color: getAlertColor(item.type)}]}>
        {item.message}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        renderItem={renderAlert}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  alertMessage: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 12,
  },
});

export default AlertsPanel;