import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {RootState} from '../../store';
import {
  Requisition,
  setRequisitions,
  setFilters,
  clearFilters,
  setLoading,
  updateRequisition,
} from '../../store/slices/requisitionSlice';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import SwipeGestureHandler from '../../components/workflow/SwipeGestureHandler';
import QuickActionBar, {getCommonQuickActions} from '../../components/workflow/QuickActionBar';
import ContextualHelp, {getRequisitionHelpTips} from '../../components/workflow/ContextualHelp';
import WorkflowOptimizationService from '../../services/workflow/WorkflowOptimizationService';

type RequisitionStackParamList = {
  RequisitionList: undefined;
  RequisitionDetail: {requisitionId: string};
  RequisitionCreate: undefined;
};

type RequisitionListScreenNavigationProp = StackNavigationProp<RequisitionStackParamList>;

const RequisitionListScreen: React.FC = () => {
  const navigation = useNavigation<RequisitionListScreenNavigationProp>();
  const dispatch = useDispatch();
  const workflowService = WorkflowOptimizationService.getInstance();

  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedVessels, setSelectedVessels] = useState<string[]>([]);
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [showHelp, setShowHelp] = useState(false);

  const requisitions = useSelector((state: RootState) => state.requisitions.requisitions);
  const draftRequisitions = useSelector((state: RootState) => state.requisitions.draftRequisitions);
  const offlineRequisitions = useSelector((state: RootState) => state.requisitions.offlineRequisitions);
  const filters = useSelector((state: RootState) => state.requisitions.filters);
  const isLoading = useSelector((state: RootState) => state.requisitions.isLoading);
  const isOffline = useSelector((state: RootState) => !state.offline.isOnline);
  const pendingSync = useSelector((state: RootState) => state.offline.pendingSync);
  const vessels = useSelector((state: RootState) => state.auth.vessels);
  const user = useSelector((state: RootState) => state.auth.user);

  // Combine all requisitions
  const allRequisitions = [
    ...requisitions,
    ...draftRequisitions,
    ...offlineRequisitions,
  ];

  // Filter requisitions based on search and filters
  const filteredRequisitions = allRequisitions.filter((req) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        req.requisitionNumber.toLowerCase().includes(query) ||
        req.vesselName.toLowerCase().includes(query) ||
        req.deliveryLocation.toLowerCase().includes(query) ||
        req.items.some(item => 
          item.name.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
        );
      if (!matchesSearch) return false;
    }

    // Status filter
    if (selectedStatuses.length > 0 && !selectedStatuses.includes(req.status)) {
      return false;
    }

    // Vessel filter
    if (selectedVessels.length > 0 && !selectedVessels.includes(req.vesselId)) {
      return false;
    }

    return true;
  });

  // Sort by creation date (newest first)
  const sortedRequisitions = filteredRequisitions.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  useEffect(() => {
    loadRequisitions();
  }, []);

  const loadRequisitions = async () => {
    dispatch(setLoading(true));
    try {
      // TODO: Fetch requisitions from API
      // For now, using mock data
      const mockRequisitions: Requisition[] = [
        {
          id: 'req1',
          requisitionNumber: 'REQ-2024-001',
          vesselId: 'vessel1',
          vesselName: 'MV Ocean Explorer',
          status: 'PENDING_APPROVAL',
          totalAmount: 15000,
          currency: 'USD',
          deliveryLocation: 'Port of Singapore',
          deliveryDate: '2024-02-15T00:00:00Z',
          justification: 'Critical engine maintenance parts needed',
          items: [
            {
              id: 'item1',
              itemId: 'cat1',
              name: 'Engine Oil Filter',
              description: 'High-performance oil filter for main engine',
              quantity: 5,
              unitPrice: 150,
              totalPrice: 750,
              urgencyLevel: 'URGENT',
            },
            {
              id: 'item2',
              itemId: 'cat2',
              name: 'Fuel Injector',
              description: 'Replacement fuel injector assembly',
              quantity: 2,
              unitPrice: 7125,
              totalPrice: 14250,
              urgencyLevel: 'URGENT',
            },
          ],
          createdAt: '2024-01-15T10:30:00Z',
          updatedAt: '2024-01-15T10:30:00Z',
        },
        {
          id: 'req2',
          requisitionNumber: 'REQ-2024-002',
          vesselId: 'vessel1',
          vesselName: 'MV Ocean Explorer',
          status: 'APPROVED',
          totalAmount: 2500,
          currency: 'USD',
          deliveryLocation: 'Port of Rotterdam',
          deliveryDate: '2024-02-20T00:00:00Z',
          justification: 'Safety equipment replacement',
          items: [
            {
              id: 'item3',
              itemId: 'cat3',
              name: 'Life Jackets',
              description: 'SOLAS approved life jackets',
              quantity: 10,
              unitPrice: 250,
              totalPrice: 2500,
              urgencyLevel: 'ROUTINE',
            },
          ],
          createdAt: '2024-01-14T14:20:00Z',
          updatedAt: '2024-01-16T09:15:00Z',
        },
      ];

      dispatch(setRequisitions(mockRequisitions));
    } catch (error) {
      console.error('Error loading requisitions:', error);
    } finally {
      dispatch(setLoading(false));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadRequisitions();
    setRefreshing(false);
  };

  const handleRequisitionPress = (requisition: Requisition) => {
    navigation.navigate('RequisitionDetail', {requisitionId: requisition.id});
  };

  const handleCreateRequisition = () => {
    workflowService.trackAction('create_requisition', 'requisition_list');
    navigation.navigate('RequisitionCreate');
  };

  const handleQuickApprove = (requisition: Requisition) => {
    workflowService.trackAction('quick_approve', 'requisition_list');
    
    Alert.alert(
      'Quick Approve',
      `Approve requisition ${requisition.requisitionNumber}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Approve',
          onPress: () => {
            const updatedRequisition = {
              ...requisition,
              status: 'APPROVED' as const,
              updatedAt: new Date().toISOString(),
            };
            dispatch(updateRequisition(updatedRequisition));
            Alert.alert('Success', 'Requisition approved');
          },
        },
      ]
    );
  };

  const handleQuickReject = (requisition: Requisition) => {
    workflowService.trackAction('quick_reject', 'requisition_list');
    
    Alert.alert(
      'Quick Reject',
      `Reject requisition ${requisition.requisitionNumber}?`,
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reject',
          style: 'destructive',
          onPress: () => {
            const updatedRequisition = {
              ...requisition,
              status: 'REJECTED' as const,
              updatedAt: new Date().toISOString(),
            };
            dispatch(updateRequisition(updatedRequisition));
            Alert.alert('Success', 'Requisition rejected');
          },
        },
      ]
    );
  };

  const handleScanBarcode = () => {
    workflowService.trackAction('scan_barcode', 'requisition_list');
    Alert.alert('Barcode Scanner', 'Opening barcode scanner...');
  };

  const handleViewPendingApprovals = () => {
    workflowService.trackAction('view_pending_approvals', 'requisition_list');
    // Filter to show only pending approvals
    setSelectedStatuses(['PENDING_APPROVAL']);
    applyFilters();
  };

  const handleEmergencyRequest = () => {
    workflowService.trackAction('emergency_request', 'requisition_list');
    Alert.alert(
      'Emergency Request',
      'Create an emergency requisition with expedited approval?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Create Emergency Request',
          onPress: () => navigation.navigate('RequisitionCreate'),
        },
      ]
    );
  };

  const handleViewDrafts = () => {
    workflowService.trackAction('view_drafts', 'requisition_list');
    setSelectedStatuses(['DRAFT']);
    applyFilters();
  };

  const handleSearchCatalog = () => {
    workflowService.trackAction('search_catalog', 'requisition_list');
    Alert.alert('Catalog Search', 'Opening item catalog...');
  };

  const applyFilters = () => {
    dispatch(setFilters({
      status: selectedStatuses,
      vessel: selectedVessels,
    }));
    setShowFilters(false);
  };

  const clearAllFilters = () => {
    setSelectedStatuses([]);
    setSelectedVessels([]);
    dispatch(clearFilters());
    setShowFilters(false);
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

  const renderRequisitionItem = ({item}: {item: Requisition}) => {
    const isPendingSync = pendingSync.some(sync => 
      sync.type === 'requisition' && sync.data.id === item.id
    );
    const highestUrgency = item.items.reduce((highest, current) => {
      const urgencyLevels = ['ROUTINE', 'URGENT', 'EMERGENCY'];
      return urgencyLevels.indexOf(current.urgencyLevel) > urgencyLevels.indexOf(highest)
        ? current.urgencyLevel
        : highest;
    }, 'ROUTINE');

    const canApprove = item.status === 'PENDING_APPROVAL' && user?.permissions?.includes('APPROVE_REQUISITIONS');

    return (
      <SwipeGestureHandler
        onSwipeRight={canApprove ? () => handleQuickApprove(item) : undefined}
        onSwipeLeft={canApprove ? () => handleQuickReject(item) : undefined}
        rightAction={canApprove ? {
          icon: 'check',
          color: '#10b981',
          label: 'Approve',
        } : undefined}
        leftAction={canApprove ? {
          icon: 'close',
          color: '#ef4444',
          label: 'Reject',
        } : undefined}
        enabled={canApprove}
      >
        <TouchableOpacity
          style={styles.requisitionCard}
          onPress={() => handleRequisitionPress(item)}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.requisitionNumber}>{item.requisitionNumber}</Text>
            <View style={styles.cardHeaderRight}>
              {isPendingSync && (
                <Icon name="sync" size={16} color="#f59e0b" style={styles.syncIcon} />
              )}
              <View style={[styles.statusBadge, {backgroundColor: getStatusColor(item.status)}]}>
                <Text style={styles.statusText}>{item.status.replace('_', ' ')}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.vesselName}>{item.vesselName}</Text>
          
          <View style={styles.cardDetails}>
            <View style={styles.detailRow}>
              <Icon name="location-on" size={16} color="#6b7280" />
              <Text style={styles.detailText}>{item.deliveryLocation}</Text>
            </View>
            <View style={styles.detailRow}>
              <Icon name="schedule" size={16} color="#6b7280" />
              <Text style={styles.detailText}>
                {new Date(item.deliveryDate).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View style={styles.cardFooter}>
            <View style={styles.footerLeft}>
              <Text style={styles.totalAmount}>
                {item.currency} {item.totalAmount.toLocaleString()}
              </Text>
              <Text style={styles.itemCount}>
                {item.items.length} item{item.items.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={[styles.urgencyBadge, {backgroundColor: getUrgencyColor(highestUrgency)}]}>
              <Text style={styles.urgencyText}>{highestUrgency}</Text>
            </View>
          </View>

          {canApprove && (
            <View style={styles.swipeHint}>
              <Text style={styles.swipeHintText}>← Swipe to approve/reject →</Text>
            </View>
          )}
        </TouchableOpacity>
      </SwipeGestureHandler>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="description" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No Requisitions Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchQuery || selectedStatuses.length > 0 || selectedVessels.length > 0
          ? 'Try adjusting your search or filters'
          : 'Create your first requisition to get started'
        }
      </Text>
      {!searchQuery && selectedStatuses.length === 0 && selectedVessels.length === 0 && (
        <TouchableOpacity style={styles.createButton} onPress={handleCreateRequisition}>
          <Icon name="add" size={20} color="#ffffff" />
          <Text style={styles.createButtonText}>Create Requisition</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text style={styles.title}>Requisitions</Text>
            <TouchableOpacity style={styles.createFab} onPress={handleCreateRequisition}>
              <Icon name="add" size={24} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {/* Offline Indicator */}
          {isOffline && (
            <View style={styles.offlineIndicator}>
              <Icon name="cloud-off" size={16} color="#ef4444" />
              <Text style={styles.offlineText}>
                Working offline - {pendingSync.length} items pending sync
              </Text>
            </View>
          )}

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Icon name="search" size={20} color="#6b7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search requisitions..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => setShowFilters(true)}
            >
              <Icon name="filter-list" size={20} color="#6b7280" />
              {(selectedStatuses.length > 0 || selectedVessels.length > 0) && (
                <View style={styles.filterIndicator} />
              )}
            </TouchableOpacity>
          </View>

          {/* Active Filters */}
          {(selectedStatuses.length > 0 || selectedVessels.length > 0) && (
            <View style={styles.activeFilters}>
              {selectedStatuses.map(status => (
                <View key={status} style={styles.filterChip}>
                  <Text style={styles.filterChipText}>{status.replace('_', ' ')}</Text>
                  <TouchableOpacity
                    onPress={() => setSelectedStatuses(prev => prev.filter(s => s !== status))}
                  >
                    <Icon name="close" size={16} color="#6b7280" />
                  </TouchableOpacity>
                </View>
              ))}
              {selectedVessels.map(vesselId => {
                const vessel = vessels.find(v => v.id === vesselId);
                return (
                  <View key={vesselId} style={styles.filterChip}>
                    <Text style={styles.filterChipText}>{vessel?.name || vesselId}</Text>
                    <TouchableOpacity
                      onPress={() => setSelectedVessels(prev => prev.filter(v => v !== vesselId))}
                    >
                      <Icon name="close" size={16} color="#6b7280" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Requisitions List */}
        <FlatList
          data={sortedRequisitions}
          renderItem={renderRequisitionItem}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />

        {/* Filter Modal */}
        <Modal visible={showFilters} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.filterModal}>
              <Text style={styles.modalTitle}>Filter Requisitions</Text>

              {/* Status Filter */}
              <Text style={styles.filterSectionTitle}>Status</Text>
              <View style={styles.filterOptions}>
                {['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'ORDERED'].map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.filterOption,
                      selectedStatuses.includes(status) && styles.filterOptionSelected,
                    ]}
                    onPress={() => {
                      if (selectedStatuses.includes(status)) {
                        setSelectedStatuses(prev => prev.filter(s => s !== status));
                      } else {
                        setSelectedStatuses(prev => [...prev, status]);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedStatuses.includes(status) && styles.filterOptionTextSelected,
                      ]}
                    >
                      {status.replace('_', ' ')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Vessel Filter */}
              <Text style={styles.filterSectionTitle}>Vessel</Text>
              <View style={styles.filterOptions}>
                {vessels.map(vessel => (
                  <TouchableOpacity
                    key={vessel.id}
                    style={[
                      styles.filterOption,
                      selectedVessels.includes(vessel.id) && styles.filterOptionSelected,
                    ]}
                    onPress={() => {
                      if (selectedVessels.includes(vessel.id)) {
                        setSelectedVessels(prev => prev.filter(v => v !== vessel.id));
                      } else {
                        setSelectedVessels(prev => [...prev, vessel.id]);
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selectedVessels.includes(vessel.id) && styles.filterOptionTextSelected,
                      ]}
                    >
                      {vessel.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Modal Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.clearButton} onPress={clearAllFilters}>
                  <Text style={styles.clearButtonText}>Clear All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.applyButton} onPress={applyFilters}>
                  <Text style={styles.applyButtonText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Quick Action Bar */}
        <QuickActionBar
          actions={getCommonQuickActions({
            onCreateRequisition: handleCreateRequisition,
            onScanBarcode: handleScanBarcode,
            onViewPendingApprovals: handleViewPendingApprovals,
            onEmergencyRequest: handleEmergencyRequest,
            onViewDrafts: handleViewDrafts,
            onSearchCatalog: handleSearchCatalog,
          })}
          visible={showQuickActions}
          position="bottom"
        />

        {/* Contextual Help */}
        <View style={styles.helpContainer}>
          <ContextualHelp
            tips={getRequisitionHelpTips()}
            context="requisition_list"
            visible={showHelp}
            onDismiss={() => setShowHelp(false)}
          />
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
  header: {
    backgroundColor: '#ffffff',
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  createFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  offlineText: {
    fontSize: 12,
    color: '#ef4444',
    marginLeft: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    marginLeft: 8,
  },
  filterButton: {
    padding: 4,
    position: 'relative',
  },
  filterIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  filterChipText: {
    fontSize: 12,
    color: '#3730a3',
  },
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  requisitionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requisitionNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  syncIcon: {
    opacity: 0.7,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  vesselName: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  cardDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLeft: {
    flex: 1,
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  itemCount: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  urgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginTop: 16,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  filterOptionSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  filterOptionTextSelected: {
    color: '#ffffff',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    color: '#374151',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  swipeHint: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginTop: 8,
    alignSelf: 'center',
  },
  swipeHintText: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
  },
  helpContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1000,
  },
});

export default RequisitionListScreen;