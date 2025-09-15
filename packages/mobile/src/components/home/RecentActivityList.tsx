import React from 'react';
import {View, Text, StyleSheet, FlatList} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

interface RecentActivityListProps {
  activities: Activity[];
}

const RecentActivityList: React.FC<RecentActivityListProps> = ({activities}) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'requisition':
        return 'assignment';
      case 'approval':
        return 'check-circle';
      case 'delivery':
        return 'local-shipping';
      default:
        return 'info';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'requisition':
        return '#1e40af';
      case 'approval':
        return '#10b981';
      case 'delivery':
        return '#f59e0b';
      default:
        return '#64748b';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`;
    }
  };

  const renderActivity = ({item}: {item: Activity}) => (
    <View style={styles.activityItem}>
      <View style={[styles.iconContainer, {backgroundColor: getActivityColor(item.type) + '20'}]}>
        <Icon name={getActivityIcon(item.type)} size={20} color={getActivityColor(item.type)} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityDescription}>{item.description}</Text>
        <Text style={styles.activityTime}>{formatTimestamp(item.timestamp)}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={activities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
      />
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
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
});

export default RecentActivityList;