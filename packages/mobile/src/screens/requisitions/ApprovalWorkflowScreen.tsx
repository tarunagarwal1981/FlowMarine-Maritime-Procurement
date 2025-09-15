import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  TextInput,
  Modal,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {RouteProp, useRoute, useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {RootState} from '../../store';
import {updateRequisition} from '../../store/slices/requisitionSlice';
import {addSyncItem} from '../../store/slices/offlineSlice';
import ErrorBoundary from '../../components/common/ErrorBoundary';

type RequisitionStackParamList = {
  ApprovalWorkflow: {requisitionId: string};
};

type ApprovalWorkflowScreenRouteProp = RouteProp<RequisitionStackParamList, 'ApprovalWorkflow'>;
type ApprovalWorkflowScreenNavigationProp = StackNavigationProp<RequisitionStackParamList>;

interface ApprovalStep {
  id: string;
  step: number;
  approverRole: string;
  approverName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELEGATED';
  approvedAt?: string;
  comments?: string;
  requiredAmount?: number;
  delegatedTo?: string;
}

const ApprovalWorkflowScreen: React.FC = () => {
  const route = useRoute<ApprovalWorkflowScreenRouteProp>();
  const navigation = useNavigation<ApprovalWorkflowScreenNavigationProp>();
  const dispatch = useDispatch();
  const {requisitionId} = route.params;

  const [refreshing, setRefreshing] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showDelegationModal, setShowDelegationModal] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionComments, setRejectionComments] = useState('');
  const [delegationTarget, setDelegationTarget] = useState('');
  const [delegationComments, setDelegationComments] = useState('');

  const requisition = useSelector((state: RootState) => 
    state.requisitions.requisitions.find(r => r.id === requisitionId)
  );

  const user = useSelector((state: RootState) => state.auth.user);
  const isOffline = useSelector((state: RootState) => !state.offline.isOnline);

  // Mock approval workflow data - in real app, this would come from the server
  const [approvalSteps, setApprovalSteps] = useState<ApprovalStep[]>([
    {
      id: 'step1',
      step: 1,
      approverRole: 'Chief Engineer',
      approverName: 'John Smith',
      status: 'APPROVED',
      approvedAt: '2024-01-15T10:30:00Z',
      comments: 'Approved - critical engine parts needed',
      requiredAmount: 500,
    },
    {
      id: 'step2',
      step: 2,
      approverRole: 'Superintendent',
      approverName: 'Sarah Johnson',
      status: 'APPROVED',
      approvedAt: '2024-01-15T14:20:00Z',
      comments: 'Budget approved for maintenance',
      requiredAmount: 5000,
    },
    {
      id: 'step3',
      step: 3,
      approverRole: 'Procurement Manager',
      approverName: 'Mike Wilson',
      status: 'PENDING',
      requiredAmount: 25000,
    },
  ]);

  useEffect(() => {
    if (!requisition) {
      Alert.alert('Error', 'Requisition not found', [
        {text: 'OK', onPress: () => navigation.goBack()},
      ]);
    }
  }, [requisition, navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Fetch latest approval status from server
    setTimeout(() => setRefreshing(false), 1000);
  };

  const canApprove = () => {
    if (!user || !requisition) return false;
    
    const currentStep = approvalSteps.find(step => step.status === 'PENDING');
    if (!currentStep) return false;

    // Check if current user can approve this step
    return user.role === currentStep.approverRole || user.permissions?.includes('APPROVE_REQUISITIONS');
  };

  const canDelegate = () => {
    if (!user || !requisition) return false;
    
    const currentStep = approvalSteps.find(step => step.status === 'PENDING');
    if (!currentStep) return false;

    return user.role === currentStep.approverRole;
  };

  const handleApprove = async () => {
    if (!requisition) return;

    const currentStep = approvalSteps.find(step => step.status === 'PENDING');
    if (!currentStep) return;

    const updatedSteps = approvalSteps.map(step => 
      step.id === currentStep.id 
        ? {
            ...step,
            status: 'APPROVED' as const,
            approvedAt: new Date().toISOString(),
            comments: approvalComments,
          }
        : step
    );

    setApprovalSteps(updatedSteps);

    // Check if all steps are approved
    const allApproved = updatedSteps.every(step => step.status === 'APPROVED');
    
    if (allApproved) {
      const updatedRequisition = {
        ...requisition,
        status: 'APPROVED' as const,
        updatedAt: new Date().toISOString(),
      };

      dispatch(updateRequisition(updatedRequisition));

      if (isOffline) {
        dispatch(addSyncItem({
          type: 'approval',
          action: 'update',
          data: {
            requisitionId,
            action: 'approve',
            comments: approvalComments,
            stepId: currentStep.id,
          },
        }));
      }

      Alert.alert('Success', 'Requisition approved successfully');
    } else {
      Alert.alert('Success', 'Approval recorded. Waiting for next approver.');
    }

    setShowApprovalModal(false);
    setApprovalComments('');
  };

  const handleReject = async () => {
    if (!requisition) return;

    const updatedRequisition = {
      ...requisition,
      status: 'REJECTED' as const,
      updatedAt: new Date().toISOString(),
    };

    dispatch(updateRequisition(updatedRequisition));

    if (isOffline) {
      dispatch(addSyncItem({
        type: 'approval',
        action: 'update',
        data: {
          requisitionId,
          action: 'reject',
          comments: rejectionComments,
        },
      }));
    }

    Alert.alert('Success', 'Requisition rejected');
    setShowRejectionModal(false);
    setRejectionComments('');
  };

  const handleDelegate = async () => {
    if (!delegationTarget.trim()) {
      Alert.alert('Error', 'Please specify who to delegate to');
      return;
    }

    const currentStep = approvalSteps.find(step => step.status === 'PENDING');
    if (!currentStep) return;

    const updatedSteps = approvalSteps.map(step => 
      step.id === currentStep.id 
        ? {
            ...step,
            status: 'DELEGATED' as const,
            delegatedTo: delegationTarget,
            comments: delegationComments,
          }
        : step
    );

    setApprovalSteps(updatedSteps);

    if (isOffline) {
      dispatch(addSyncItem({
        type: 'approval',
        action: 'update',
        data: {
          requisitionId,
          action: 'delegate',
          delegatedTo: delegationTarget,
          comments: delegationComments,
          stepId: currentStep.id,
        },
      }));
    }

    Alert.alert('Success', `Approval delegated to ${delegationTarget}`);
    setShowDelegationModal(false);
    setDelegationTarget('');
    setDelegationComments('');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return '#f59e0b';
      case 'APPROVED': return '#10b981';
      case 'REJECTED': return '#ef4444';
      case 'DELEGATED': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return 'schedule';
      case 'APPROVED': return 'check-circle';
      case 'REJECTED': return 'cancel';
      case 'DELEGATED': return 'forward';
      default: return 'help';
    }
  };

  if (!requisition) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Requisition not found</Text>
      </View>
    );
  }

  const currentStep = approvalSteps.find(step => step.status === 'PENDING');
  const completedSteps = approvalSteps.filter(step => step.status === 'APPROVED').length;
  const totalSteps = approvalSteps.length;
  const progressPercentage = (completedSteps / totalSteps) * 100;

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
            <Text style={styles.requisitionNumber}>
              {requisition.requisitionNumber}
            </Text>
            <Text style={styles.vesselName}>{requisition.vesselName}</Text>
            {isOffline && (
              <View style={styles.offlineIndicator}>
                <Icon name="cloud-off" size={16} color="#ef4444" />
                <Text style={styles.offlineText}>Offline</Text>
              </View>
            )}
          </View>

          {/* Progress Bar */}
          <View style={styles.progressSection}>
            <Text style={styles.progressTitle}>Approval Progress</Text>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, {width: `${progressPercentage}%`}]} />
            </View>
            <Text style={styles.progressText}>
              {completedSteps} of {totalSteps} approvals completed
            </Text>
          </View>

          {/* Current Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Status</Text>
            <View style={styles.currentStatus}>
              <View style={[styles.statusBadge, {backgroundColor: getStatusColor(requisition.status)}]}>
                <Icon name={getStatusIcon(requisition.status)} size={16} color="#ffffff" />
                <Text style={styles.statusText}>{requisition.status.replace('_', ' ')}</Text>
              </View>
              {currentStep && (
                <Text style={styles.currentStepText}>
                  Waiting for: {currentStep.approverName} ({currentStep.approverRole})
                </Text>
              )}
            </View>
          </View>

          {/* Approval Steps */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Approval Workflow</Text>
            {approvalSteps.map((step, index) => (
              <View key={step.id} style={styles.stepCard}>
                <View style={styles.stepHeader}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{step.step}</Text>
                  </View>
                  <View style={styles.stepInfo}>
                    <Text style={styles.stepRole}>{step.approverRole}</Text>
                    <Text style={styles.stepApprover}>{step.approverName}</Text>
                    {step.delegatedTo && (
                      <Text style={styles.delegatedText}>
                        Delegated to: {step.delegatedTo}
                      </Text>
                    )}
                  </View>
                  <View style={[styles.stepStatus, {backgroundColor: getStatusColor(step.status)}]}>
                    <Icon name={getStatusIcon(step.status)} size={16} color="#ffffff" />
                  </View>
                </View>

                {step.requiredAmount && (
                  <Text style={styles.stepAmount}>
                    Required for amounts ≥ ${step.requiredAmount.toLocaleString()}
                  </Text>
                )}

                {step.approvedAt && (
                  <Text style={styles.stepTimestamp}>
                    {step.status === 'APPROVED' ? 'Approved' : 'Updated'}: {new Date(step.approvedAt).toLocaleString()}
                  </Text>
                )}

                {step.comments && (
                  <View style={styles.stepComments}>
                    <Text style={styles.commentsLabel}>Comments:</Text>
                    <Text style={styles.commentsText}>{step.comments}</Text>
                  </View>
                )}

                {index < approvalSteps.length - 1 && (
                  <View style={styles.stepConnector} />
                )}
              </View>
            ))}
          </View>

          {/* Emergency Override Info */}
          {requisition.status === 'PENDING_APPROVAL' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Emergency Procedures</Text>
              <View style={styles.emergencyInfo}>
                <Icon name="warning" size={20} color="#f59e0b" />
                <Text style={styles.emergencyText}>
                  In case of emergency, the Captain can override approvals with mandatory post-approval documentation.
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        {currentStep && (
          <View style={styles.actionButtons}>
            {canApprove() && (
              <>
                <TouchableOpacity
                  style={styles.approveButton}
                  onPress={() => setShowApprovalModal(true)}
                >
                  <Icon name="check" size={20} color="#ffffff" />
                  <Text style={styles.buttonText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectButton}
                  onPress={() => setShowRejectionModal(true)}
                >
                  <Icon name="close" size={20} color="#ffffff" />
                  <Text style={styles.buttonText}>Reject</Text>
                </TouchableOpacity>
              </>
            )}
            {canDelegate() && (
              <TouchableOpacity
                style={styles.delegateButton}
                onPress={() => setShowDelegationModal(true)}
              >
                <Icon name="forward" size={20} color="#ffffff" />
                <Text style={styles.buttonText}>Delegate</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Approval Modal */}
        <Modal visible={showApprovalModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Approve Requisition</Text>
              <Text style={styles.modalSubtitle}>
                Add comments (optional):
              </Text>
              <TextInput
                style={styles.modalTextArea}
                placeholder="Enter approval comments..."
                value={approvalComments}
                onChangeText={setApprovalComments}
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowApprovalModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirm}
                  onPress={handleApprove}
                >
                  <Text style={styles.modalConfirmText}>Approve</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Rejection Modal */}
        <Modal visible={showRejectionModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Reject Requisition</Text>
              <Text style={styles.modalSubtitle}>
                Please provide a reason for rejection:
              </Text>
              <TextInput
                style={styles.modalTextArea}
                placeholder="Enter rejection reason..."
                value={rejectionComments}
                onChangeText={setRejectionComments}
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowRejectionModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirm, {backgroundColor: '#ef4444'}]}
                  onPress={handleReject}
                >
                  <Text style={styles.modalConfirmText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Delegation Modal */}
        <Modal visible={showDelegationModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Delegate Approval</Text>
              <Text style={styles.modalSubtitle}>
                Delegate to:
              </Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter name or email..."
                value={delegationTarget}
                onChangeText={setDelegationTarget}
              />
              <Text style={styles.modalSubtitle}>
                Comments (optional):
              </Text>
              <TextInput
                style={styles.modalTextArea}
                placeholder="Enter delegation comments..."
                value={delegationComments}
                onChangeText={setDelegationComments}
                multiline
                numberOfLines={3}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowDelegationModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirm, {backgroundColor: '#8b5cf6'}]}
                  onPress={handleDelegate}
                >
                  <Text style={styles.modalConfirmText}>Delegate</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
  requisitionNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  vesselName: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  offlineText: {
    fontSize: 12,
    color: '#ef4444',
    marginLeft: 4,
  },
  progressSection: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginTop: 8,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10b981',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
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
  currentStatus: {
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  currentStepText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  stepCard: {
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    position: 'relative',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  stepInfo: {
    flex: 1,
  },
  stepRole: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  stepApprover: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  delegatedText: {
    fontSize: 12,
    color: '#8b5cf6',
    marginTop: 2,
    fontStyle: 'italic',
  },
  stepStatus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepAmount: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  stepTimestamp: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  stepComments: {
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 6,
    marginTop: 4,
  },
  commentsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  commentsText: {
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 16,
  },
  stepConnector: {
    position: 'absolute',
    left: 28,
    bottom: -12,
    width: 2,
    height: 12,
    backgroundColor: '#d1d5db',
  },
  emergencyInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
  },
  emergencyText: {
    fontSize: 12,
    color: '#92400e',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 8,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 8,
  },
  delegateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8b5cf6',
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  modalTextArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#374151',
  },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#10b981',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
  },
});

export default ApprovalWorkflowScreen;