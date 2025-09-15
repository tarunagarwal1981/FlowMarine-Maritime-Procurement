import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {RootState} from '../../store';
import {setSyncing} from '../../store/slices/offlineSlice';

interface SyncIndicatorProps {
  style?: any;
}

const SyncIndicator: React.FC<SyncIndicatorProps> = ({style}) => {
  const dispatch = useDispatch();
  
  const isOnline = useSelector((state: RootState) => state.offline.isOnline);
  const isSyncing = useSelector((state: RootState) => state.offline.isSyncing);
  const pendingSync = useSelector((state: RootState) => state.offline.pendingSync);
  const lastSyncTime = useSelector((state: RootState) => state.offline.lastSyncTime);
  const syncErrors = useSelector((state: RootState) => state.offline.syncErrors);

  const handleManualSync = () => {
    if (isOnline && !isSyncing && pendingSync.length > 0) {
      dispatch(setSyncing(true));
      // TODO: Trigger manual sync
      setTimeout(() => dispatch(setSyncing(false)), 2000);
    }
  };

  if (!isOnline) {
    return (
      <View style={[styles.container, styles.offline, style]}>
        <Icon name="cloud-off" size={16} color="#ef4444" />
        <Text style={styles.offlineText}>
          Offline - {pendingSync.length} items pending
        </Text>
      </View>
    );
  }

  if (isSyncing) {
    return (
      <View style={[styles.container, styles.syncing, style]}>
        <Icon name="sync" size={16} color="#3b82f6" />
        <Text style={styles.syncingText}>Syncing...</Text>
      </View>
    );
  }

  if (syncErrors.length > 0) {
    return (
      <TouchableOpacity 
        style={[styles.container, styles.error, style]}
        onPress={handleManualSync}
      >
        <Icon name="error" size={16} color="#ef4444" />
        <Text style={styles.errorText}>
          Sync failed - Tap to retry
        </Text>
      </TouchableOpacity>
    );
  }

  if (pendingSync.length > 0) {
    return (
      <TouchableOpacity 
        style={[styles.container, styles.pending, style]}
        onPress={handleManualSync}
      >
        <Icon name="cloud-upload" size={16} color="#f59e0b" />
        <Text style={styles.pendingText}>
          {pendingSync.length} items to sync
        </Text>
      </TouchableOpacity>
    );
  }

  if (lastSyncTime) {
    const syncTime = new Date(lastSyncTime);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - syncTime.getTime()) / (1000 * 60));
    
    return (
      <View style={[styles.container, styles.synced, style]}>
        <Icon name="cloud-done" size={16} color="#10b981" />
        <Text style={styles.syncedText}>
          Synced {diffMinutes < 1 ? 'now' : `${diffMinutes}m ago`}
        </Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  offline: {
    backgroundColor: '#fef2f2',
  },
  offlineText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  syncing: {
    backgroundColor: '#eff6ff',
  },
  syncingText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  error: {
    backgroundColor: '#fef2f2',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  pending: {
    backgroundColor: '#fef3c7',
  },
  pendingText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  synced: {
    backgroundColor: '#f0fdf4',
  },
  syncedText: {
    fontSize: 12,
    color: '#10b981',
    fontWeight: '500',
  },
});

export default SyncIndicator;