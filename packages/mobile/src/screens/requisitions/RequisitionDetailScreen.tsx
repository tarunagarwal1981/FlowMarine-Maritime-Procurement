import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {RouteProp, useRoute, useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {RootState} from '../../store';
import {Requisition} from '../../store/slices/requisitionSlice';
import ErrorBoundary from '../../components/common/ErrorBoundary';

type RequisitionStackParamList = {
  RequisitionDetail: {requisitionId: string};
  RequisitionEdit: {requisitionId: string};
  ApprovalWorkflow: {requisitionId: string};
};

type RequisitionDetailScreenRouteProp = RouteProp<RequisitionStackParamList, 'RequisitionDetail'>;
type RequisitionDetailScreenNavigationProp = StackNavigationProp<RequisitionStackParamList>;

const RequisitionDetailScreen: React.FC = () => {
  const route = useRoute<RequisitionDetailScreenRouteProp>();
  const navigation = useNavigation<RequisitionDetailScreenNavigationProp>();
  const dispatch = useDispatch();
  const {requisitionId} = route.params;

  const [refreshing, setRefreshing] = useState(false);

  const requisition = useSelector((state: RootState) => 
    state.requisitions.requisitions.find(r => r.id === requisitionId) ||
    state.requisitions.draftRequisitions.find(r => r.id === requisitionId) ||
    state.requisitions.offlineRequisitions.find(r => r.id === requisitionId)
  );

  const isOffline = useSelector((state: RootState) => !state.offline.isOnline);
  const isLoading = useSelector((state: RootState) => state.requisitions.isLoading);

  useEffect(() => {
    if (!requisition) {
      Alert.alert('Error', 'Requisition not found', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    }
  }, [requisition, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Implement refresh logic
    setTimeout(() => setRefreshing(false), 1000);
  };

  const handleEdit = () => {
    navigation.navigate('RequisitionEdit', {requisitionId});
  };

  const handleApprovalWorkflow = () => {
    navigation.navigate('ApprovalWorkflow', {requisitionId});
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT': return '#6b7280';
      case 'PENDING_APPROVAL': return '#f59e0b';
      case 'APPROVED': return '#10b981';
      case 'REJECTED': return '#ef4444';
      case 'ORDERED': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'ROUTINE': return '#10b981';
      case 'URGENT': return '#f59e0b';
      case 'EMERGENCY': return '#ef4444';
      default: return '#6b7280';
    }
  };

  if (!requisition) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Requisition not found</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.requisitionNumber}>
                {requisition.requisitionNumber}
              </Text>
              {isOffline && (
                <View style={styles.offlineIndicator}>
                  <Icon name="cloud-off" size={16} color="#ef4444" />
                  <Text style={styles.offlineText}>Offline</Text>
                </View>
              )}
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, {backgroundColor: getStatusColor(requisition.status)}]}>
                <Text style={styles.statusText}>{requisition.status.replace('_', ' ')}</Text>
              </View>
              <View style={[styles.urgencyBadge, {backgroundColor: getUrgencyColor(requisition.items[0]?.urgencyLevel || 'ROUTINE')}]}>
                <Text style={styles.urgencyText}>{requisition.items[0]?.urgencyLevel || 'ROUTINE'}</Text>
              </View>
            </View>
          </View>

          {/* Vessel Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vessel Information</Text>
            <View style={styles.infoRow}>
              <Icon name="directions-boat" size={20} color="#6b7280" />
              <Text style={styles.infoText}>{requisition.vesselName}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="location-on" size={20} color="#6b7280" />
              <Text style={styles.infoText}>{requisition.deliveryLocation}</Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="schedule" size={20} color="#6b7280" />
              <Text style={styles.infoText}>
                Delivery: {new Date(requisition.deliveryDate).toLocaleDateString()}
              </Text>
            </View>
          </View>

          {/* Financial Summary */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Financial Summary</Text>
            <View style={styles.financialSummary}>
              <Text style={styles.totalAmount}>
                {requisition.currency} {requisition.totalAmount.toLocaleString()}
              </Text>
              <Text style={styles.itemCount}>
                {requisition.items.length} item{requisition.items.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Items</Text>
            {requisition.items.map((item, index) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.itemPrice}>
                    {requisition.currency} {item.totalPrice.toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.itemDescription}>{item.description}</Text>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  <Text style={styles.itemUnitPrice}>
                    Unit: {requisition.currency} {item.unitPrice.toLocaleString()}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Justification */}
          {requisition.justification && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Justification</Text>
              <Text style={styles.justificationText}>{requisition.justification}</Text>
            </View>
          )}

          {/* Timestamps */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            <View style={styles.infoRow}>
              <Icon name="add-circle" size={20} color="#6b7280" />
              <Text style={styles.infoText}>
                Created: {new Date(requisition.createdAt).toLocaleString()}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Icon name="update" size={20} color="#6b7280" />
              <Text style={styles.infoText}>
                Updated: {new Date(requisition.updatedAt).toLocaleString()}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {requisition.status === 'DRAFT' && (
            <TouchableOpacity style={styles.editButton} onPress={handleEdit}>
              <Icon name="edit" size={20} color="#ffffff" />
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
          )}
          {(requisition.status === 'PENDING_APPROVAL' || requisition.status === 'APPROVED') && (
            <TouchableOpacity style={styles.approvalButton} onPress={handleApprovalWorkflow}>
              <Icon name="approval" size={20} color="#ffffff" />
              <Text style={styles.buttonText}>View Approvals</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requisitionNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offlineText: {
    fontSize: 12,
    color: '#ef4444',
    marginLeft: 4,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  urgencyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  urgencyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  section: {
    backgroundColor: '#ffffff',
    marginTop: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#475569',
    marginLeft: 8,
    flex: 1,
  },
  financialSummary: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
  },
  itemCount: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  itemCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    marginRight: 8,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  itemDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemQuantity: {
    fontSize: 12,
    color: '#475569',
  },
  itemUnitPrice: {
    fontSize: 12,
    color: '#475569',
  },
  justificationText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
  },
  approvalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
});

export default RequisitionDetailScreen;