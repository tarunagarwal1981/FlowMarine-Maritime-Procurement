import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
  badge?: number;
}

interface QuickActionBarProps {
  actions: QuickAction[];
  visible?: boolean;
  position?: 'top' | 'bottom';
  style?: any;
}

const {width: screenWidth} = Dimensions.get('window');

const QuickActionBar: React.FC<QuickActionBarProps> = ({
  actions,
  visible = true,
  position = 'bottom',
  style,
}) => {
  const [slideAnim] = useState(new Animated.Value(visible ? 0 : 100));

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 100,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  const renderAction = (action: QuickAction) => (
    <TouchableOpacity
      key={action.id}
      style={[styles.actionButton, {backgroundColor: action.color}]}
      onPress={action.onPress}
      activeOpacity={0.7}
    >
      <View style={styles.actionContent}>
        <Icon name={action.icon} size={24} color="#ffffff" />
        {action.badge && action.badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {action.badge > 99 ? '99+' : action.badge.toString()}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.actionLabel} numberOfLines={1}>
        {action.label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.topPosition : styles.bottomPosition,
        {
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 100],
                outputRange: [0, position === 'top' ? -100 : 100],
              }),
            },
          ],
        },
        style,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {actions.map(renderAction)}
      </ScrollView>
    </Animated.View>
  );
};

// Predefined quick actions for common maritime procurement tasks
export const getCommonQuickActions = (callbacks: {
  onCreateRequisition: () => void;
  onScanBarcode: () => void;
  onViewPendingApprovals: () => void;
  onEmergencyRequest: () => void;
  onViewDrafts: () => void;
  onSearchCatalog: () => void;
}): QuickAction[] => [
  {
    id: 'create_requisition',
    icon: 'add-circle',
    label: 'New Request',
    color: '#3b82f6',
    onPress: callbacks.onCreateRequisition,
  },
  {
    id: 'scan_barcode',
    icon: 'qr-code-scanner',
    label: 'Scan Item',
    color: '#10b981',
    onPress: callbacks.onScanBarcode,
  },
  {
    id: 'pending_approvals',
    icon: 'pending-actions',
    label: 'Approvals',
    color: '#f59e0b',
    onPress: callbacks.onViewPendingApprovals,
    badge: 3, // This would be dynamic in real app
  },
  {
    id: 'emergency_request',
    icon: 'emergency',
    label: 'Emergency',
    color: '#ef4444',
    onPress: callbacks.onEmergencyRequest,
  },
  {
    id: 'view_drafts',
    icon: 'drafts',
    label: 'Drafts',
    color: '#6b7280',
    onPress: callbacks.onViewDrafts,
    badge: 2, // This would be dynamic in real app
  },
  {
    id: 'search_catalog',
    icon: 'search',
    label: 'Catalog',
    color: '#8b5cf6',
    onPress: callbacks.onSearchCatalog,
  },
];

// Context-specific quick actions for different screens
export const getRequisitionQuickActions = (callbacks: {
  onApprove: () => void;
  onReject: () => void;
  onDelegate: () => void;
  onAddComment: () => void;
  onViewHistory: () => void;
}): QuickAction[] => [
  {
    id: 'approve',
    icon: 'check-circle',
    label: 'Approve',
    color: '#10b981',
    onPress: callbacks.onApprove,
  },
  {
    id: 'reject',
    icon: 'cancel',
    label: 'Reject',
    color: '#ef4444',
    onPress: callbacks.onReject,
  },
  {
    id: 'delegate',
    icon: 'forward',
    label: 'Delegate',
    color: '#8b5cf6',
    onPress: callbacks.onDelegate,
  },
  {
    id: 'add_comment',
    icon: 'comment',
    label: 'Comment',
    color: '#3b82f6',
    onPress: callbacks.onAddComment,
  },
  {
    id: 'view_history',
    icon: 'history',
    label: 'History',
    color: '#6b7280',
    onPress: callbacks.onViewHistory,
  },
];

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  topPosition: {
    top: 0,
    borderTopWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  bottomPosition: {
    bottom: 0,
  },
  scrollView: {
    maxHeight: 80,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 70,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  actionContent: {
    position: 'relative',
    marginBottom: 4,
  },
  actionLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
});

export default QuickActionBar;