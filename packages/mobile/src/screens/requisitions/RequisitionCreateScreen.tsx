import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  Modal,
  FlatList,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {launchImageLibrary, launchCamera, ImagePickerResponse} from 'react-native-image-picker';
import DatePicker from 'react-native-date-picker';
import {RootState} from '../../store';
import {
  Requisition,
  RequisitionItem,
  saveDraftRequisition,
  addOfflineRequisition,
} from '../../store/slices/requisitionSlice';
import {addSyncItem} from '../../store/slices/offlineSlice';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import BarcodeScanner from '../../components/requisitions/BarcodeScanner';
import VoiceToTextInput from '../../components/workflow/VoiceToTextInput';
import SmartFormAutoComplete, {
  getMaritimeItemSuggestions,
  getVesselSuggestions,
  getPortSuggestions,
} from '../../components/workflow/SmartFormAutoComplete';
import QuickActionBar from '../../components/workflow/QuickActionBar';
import ContextualHelp, {getRequisitionHelpTips} from '../../components/workflow/ContextualHelp';
import WorkflowOptimizationService from '../../services/workflow/WorkflowOptimizationService';

type RequisitionStackParamList = {
  RequisitionCreate: undefined;
  RequisitionList: undefined;
  BarcodeScanner: {onScan: (data: string) => void};
};

type RequisitionCreateScreenNavigationProp = StackNavigationProp<RequisitionStackParamList>;

interface FormData {
  vesselId: string;
  deliveryLocation: string;
  deliveryDate: Date;
  justification: string;
  items: RequisitionItem[];
}

interface ItemFormData {
  name: string;
  description: string;
  quantity: string;
  unitPrice: string;
  urgencyLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  photos: string[];
}

const RequisitionCreateScreen: React.FC = () => {
  const navigation = useNavigation<RequisitionCreateScreenNavigationProp>();
  const dispatch = useDispatch();
  const workflowService = WorkflowOptimizationService.getInstance();

  const user = useSelector((state: RootState) => state.auth.user);
  const vessels = useSelector((state: RootState) => state.auth.vessels);
  const isOffline = useSelector((state: RootState) => !state.offline.isOnline);
  const itemCatalog = useSelector((state: RootState) => state.offline.dataCache.itemCatalog);

  const [formData, setFormData] = useState<FormData>({
    vesselId: vessels[0]?.id || '',
    deliveryLocation: '',
    deliveryDate: new Date(),
    justification: '',
    items: [],
  });

  const [currentItem, setCurrentItem] = useState<ItemFormData>({
    name: '',
    description: '',
    quantity: '1',
    unitPrice: '0',
    urgencyLevel: 'ROUTINE',
    photos: [],
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showVesselPicker, setShowVesselPicker] = useState(false);
  const [showCatalogSearch, setShowCatalogSearch] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [catalogSearchQuery, setCatalogSearchQuery] = useState('');
  const [filteredCatalogItems, setFilteredCatalogItems] = useState<any[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(true);

  useEffect(() => {
    if (catalogSearchQuery.length > 2) {
      const filtered = itemCatalog.filter((item: any) =>
        item.name.toLowerCase().includes(catalogSearchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(catalogSearchQuery.toLowerCase()) ||
        item.impaCode?.includes(catalogSearchQuery) ||
        item.issaCode?.includes(catalogSearchQuery)
      );
      setFilteredCatalogItems(filtered);
    } else {
      setFilteredCatalogItems([]);
    }
  }, [catalogSearchQuery, itemCatalog]);

  const handleSave = async (isDraft: boolean = false) => {
    if (!formData.vesselId) {
      Alert.alert('Error', 'Please select a vessel');
      return;
    }

    if (formData.items.length === 0) {
      Alert.alert('Error', 'Please add at least one item');
      return;
    }

    // Track workflow usage
    workflowService.trackAction(isDraft ? 'save_draft' : 'submit_requisition', 'requisition_create');
    workflowService.trackCompletionPattern('deliveryLocation', formData.deliveryLocation, 'requisition_create');
    workflowService.trackCompletionPattern('justification', formData.justification, 'requisition_create');

    const totalAmount = formData.items.reduce((sum, item) => sum + item.totalPrice, 0);

    const requisition: Requisition = {
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      requisitionNumber: `REQ-${Date.now()}`,
      vesselId: formData.vesselId,
      vesselName: vessels.find(v => v.id === formData.vesselId)?.name || '',
      status: isDraft ? 'DRAFT' : 'PENDING_APPROVAL',
      totalAmount,
      currency: 'USD',
      deliveryLocation: formData.deliveryLocation,
      deliveryDate: formData.deliveryDate.toISOString(),
      justification: formData.justification,
      items: formData.items,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isDraft) {
      dispatch(saveDraftRequisition(requisition));
      Alert.alert('Success', 'Requisition saved as draft');
    } else {
      if (isOffline) {
        dispatch(addOfflineRequisition(requisition));
        dispatch(addSyncItem({
          type: 'requisition',
          action: 'create',
          data: requisition,
        }));
        Alert.alert('Offline Mode', 'Requisition saved offline and will be synced when connection is restored');
      } else {
        // TODO: Submit to server
        Alert.alert('Success', 'Requisition submitted for approval');
      }
    }

    navigation.goBack();
  };

  const handleAddItem = () => {
    if (!currentItem.name || !currentItem.quantity || !currentItem.unitPrice) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const quantity = parseFloat(currentItem.quantity);
    const unitPrice = parseFloat(currentItem.unitPrice);
    const totalPrice = quantity * unitPrice;

    // Track item usage for learning
    workflowService.trackItemUsage(currentItem.name, 'requisition_create');
    workflowService.trackAction('add_item', 'requisition_create');

    const newItem: RequisitionItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      itemId: `catalog_${Date.now()}`,
      name: currentItem.name,
      description: currentItem.description,
      quantity,
      unitPrice,
      totalPrice,
      urgencyLevel: currentItem.urgencyLevel,
    };

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem],
    }));

    setCurrentItem({
      name: '',
      description: '',
      quantity: '1',
      unitPrice: '0',
      urgencyLevel: 'ROUTINE',
      photos: [],
    });

    setShowItemModal(false);
  };

  const handleRemoveItem = (itemId: string) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId),
    }));
  };

  const handleTakePhoto = () => {
    Alert.alert(
      'Add Photo',
      'Choose an option',
      [
        {text: 'Camera', onPress: () => openCamera()},
        {text: 'Gallery', onPress: () => openGallery()},
        {text: 'Cancel', style: 'cancel'},
      ]
    );
  };

  const openCamera = () => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
      },
      handleImageResponse
    );
  };

  const openGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
      },
      handleImageResponse
    );
  };

  const handleImageResponse = (response: ImagePickerResponse) => {
    if (response.assets && response.assets[0]) {
      const imageUri = response.assets[0].uri;
      if (imageUri) {
        setCurrentItem(prev => ({
          ...prev,
          photos: [...prev.photos, imageUri],
        }));
      }
    }
  };

  const handleBarcodeScanned = (data: string) => {
    // Search for item in catalog by barcode/IMPA/ISSA code
    const catalogItem = itemCatalog.find((item: any) =>
      item.impaCode === data || item.issaCode === data || item.barcode === data
    );

    if (catalogItem) {
      setCurrentItem(prev => ({
        ...prev,
        name: catalogItem.name,
        description: catalogItem.description,
        unitPrice: catalogItem.averagePrice?.toString() || '0',
      }));
      Alert.alert('Item Found', `Added ${catalogItem.name} from catalog`);
    } else {
      Alert.alert('Item Not Found', 'No matching item found in catalog. You can still add it manually.');
    }

    setShowBarcodeScanner(false);
  };

  const handleSelectCatalogItem = (catalogItem: any) => {
    setCurrentItem(prev => ({
      ...prev,
      name: catalogItem.name,
      description: catalogItem.description,
      unitPrice: catalogItem.averagePrice?.toString() || '0',
    }));
    setShowCatalogSearch(false);
    setCatalogSearchQuery('');
  };

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        <ScrollView style={styles.scrollView}>
          {/* Offline Indicator */}
          {isOffline && (
            <View style={styles.offlineIndicator}>
              <Icon name="cloud-off" size={16} color="#ef4444" />
              <Text style={styles.offlineText}>
                Working offline - changes will sync when connected
              </Text>
            </View>
          )}

          {/* Vessel Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Vessel</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setShowVesselPicker(true)}
            >
              <Text style={styles.pickerText}>
                {vessels.find(v => v.id === formData.vesselId)?.name || 'Select Vessel'}
              </Text>
              <Icon name="arrow-drop-down" size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Delivery Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Information</Text>
            <SmartFormAutoComplete
              value={formData.deliveryLocation}
              onChangeText={(text) => {
                setFormData(prev => ({...prev, deliveryLocation: text}));
                workflowService.trackInputMethod('typing', 'delivery_location');
              }}
              placeholder="Delivery Location"
              data={getPortSuggestions()}
              contextKey="delivery_location"
              style={styles.input}
            />
            <TouchableOpacity
              style={styles.dateInput}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateText}>
                Delivery Date: {formData.deliveryDate.toLocaleDateString()}
              </Text>
              <Icon name="calendar-today" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>

          {/* Items */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Items</Text>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowItemModal(true)}
              >
                <Icon name="add" size={20} color="#ffffff" />
                <Text style={styles.addButtonText}>Add Item</Text>
              </TouchableOpacity>
            </View>

            {formData.items.map((item, index) => (
              <View key={item.id} style={styles.itemCard}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <TouchableOpacity onPress={() => handleRemoveItem(item.id)}>
                    <Icon name="delete" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemDescription}>{item.description}</Text>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  <Text style={styles.itemPrice}>
                    ${item.totalPrice.toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.urgencyBadge, {backgroundColor: getUrgencyColor(item.urgencyLevel)}]}>
                  <Text style={styles.urgencyText}>{item.urgencyLevel}</Text>
                </View>
              </View>
            ))}

            {formData.items.length === 0 && (
              <Text style={styles.emptyText}>No items added yet</Text>
            )}
          </View>

          {/* Justification */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Justification</Text>
            <VoiceToTextInput
              value={formData.justification}
              onChangeText={(text) => {
                setFormData(prev => ({...prev, justification: text}));
                workflowService.trackInputMethod('voice', 'justification');
              }}
              placeholder="Explain why these items are needed... (Hold mic to speak)"
              multiline
              numberOfLines={4}
              style={styles.textArea}
            />
          </View>

          {/* Total */}
          <View style={styles.section}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalAmount}>
                ${formData.items.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString()}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.draftButton}
            onPress={() => handleSave(true)}
          >
            <Text style={styles.draftButtonText}>Save Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.submitButton}
            onPress={() => handleSave(false)}
          >
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>

        {/* Date Picker Modal */}
        <DatePicker
          modal
          open={showDatePicker}
          date={formData.deliveryDate}
          mode="date"
          minimumDate={new Date()}
          onConfirm={(date) => {
            setShowDatePicker(false);
            setFormData(prev => ({...prev, deliveryDate: date}));
          }}
          onCancel={() => setShowDatePicker(false)}
        />

        {/* Vessel Picker Modal */}
        <Modal visible={showVesselPicker} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Vessel</Text>
              {vessels.map((vessel) => (
                <TouchableOpacity
                  key={vessel.id}
                  style={styles.modalOption}
                  onPress={() => {
                    setFormData(prev => ({...prev, vesselId: vessel.id}));
                    setShowVesselPicker(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{vessel.name}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowVesselPicker(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Item Modal */}
        <Modal visible={showItemModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.itemModalContent}>
              <Text style={styles.modalTitle}>Add Item</Text>
              
              {/* Item Search Options */}
              <View style={styles.searchOptions}>
                <TouchableOpacity
                  style={styles.searchOption}
                  onPress={() => setShowCatalogSearch(true)}
                >
                  <Icon name="search" size={20} color="#3b82f6" />
                  <Text style={styles.searchOptionText}>Search Catalog</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.searchOption}
                  onPress={() => setShowBarcodeScanner(true)}
                >
                  <Icon name="qr-code-scanner" size={20} color="#3b82f6" />
                  <Text style={styles.searchOptionText}>Scan Barcode</Text>
                </TouchableOpacity>
              </View>

              <SmartFormAutoComplete
                value={currentItem.name}
                onChangeText={(text) => {
                  setCurrentItem(prev => ({...prev, name: text}));
                  workflowService.trackInputMethod('typing', 'item_name');
                }}
                placeholder="Item Name *"
                data={getMaritimeItemSuggestions()}
                contextKey="item_name"
                style={styles.input}
                onSelectItem={(item) => {
                  setCurrentItem(prev => ({
                    ...prev,
                    name: item.value,
                    description: item.metadata?.description || '',
                    unitPrice: item.metadata?.averagePrice?.toString() || '0',
                  }));
                  workflowService.trackInputMethod('selection', 'item_name');
                }}
              />
              <VoiceToTextInput
                value={currentItem.description}
                onChangeText={(text) => {
                  setCurrentItem(prev => ({...prev, description: text}));
                  workflowService.trackInputMethod('voice', 'item_description');
                }}
                placeholder="Description (Hold mic to speak)"
                style={styles.input}
              />
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Quantity *"
                  value={currentItem.quantity}
                  onChangeText={(text) => setCurrentItem(prev => ({...prev, quantity: text}))}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[styles.input, styles.halfInput]}
                  placeholder="Unit Price *"
                  value={currentItem.unitPrice}
                  onChangeText={(text) => setCurrentItem(prev => ({...prev, unitPrice: text}))}
                  keyboardType="numeric"
                />
              </View>

              {/* Urgency Level */}
              <Text style={styles.inputLabel}>Urgency Level</Text>
              <View style={styles.urgencyOptions}>
                {(['ROUTINE', 'URGENT', 'EMERGENCY'] as const).map((level) => (
                  <TouchableOpacity
                    key={level}
                    style={[
                      styles.urgencyOption,
                      currentItem.urgencyLevel === level && styles.urgencyOptionSelected,
                    ]}
                    onPress={() => setCurrentItem(prev => ({...prev, urgencyLevel: level}))}
                  >
                    <Text
                      style={[
                        styles.urgencyOptionText,
                        currentItem.urgencyLevel === level && styles.urgencyOptionTextSelected,
                      ]}
                    >
                      {level}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Photos */}
              <View style={styles.photoSection}>
                <Text style={styles.inputLabel}>Photos</Text>
                <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
                  <Icon name="camera-alt" size={20} color="#3b82f6" />
                  <Text style={styles.photoButtonText}>Add Photo</Text>
                </TouchableOpacity>
                <View style={styles.photoGrid}>
                  {currentItem.photos.map((photo, index) => (
                    <Image key={index} source={{uri: photo}} style={styles.photoThumbnail} />
                  ))}
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowItemModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirm}
                  onPress={handleAddItem}
                >
                  <Text style={styles.modalConfirmText}>Add Item</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Catalog Search Modal */}
        <Modal visible={showCatalogSearch} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Search Catalog</Text>
              <TextInput
                style={styles.input}
                placeholder="Search by name, IMPA code, ISSA code..."
                value={catalogSearchQuery}
                onChangeText={setCatalogSearchQuery}
              />
              <FlatList
                data={filteredCatalogItems}
                keyExtractor={(item) => item.id}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.catalogItem}
                    onPress={() => handleSelectCatalogItem(item)}
                  >
                    <Text style={styles.catalogItemName}>{item.name}</Text>
                    <Text style={styles.catalogItemCode}>
                      {item.impaCode && `IMPA: ${item.impaCode}`}
                      {item.issaCode && ` | ISSA: ${item.issaCode}`}
                    </Text>
                    <Text style={styles.catalogItemPrice}>
                      ${item.averagePrice?.toLocaleString() || 'N/A'}
                    </Text>
                  </TouchableOpacity>
                )}
                style={styles.catalogList}
              />
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowCatalogSearch(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Barcode Scanner Modal */}
        {showBarcodeScanner && (
          <BarcodeScanner
            onScan={handleBarcodeScanned}
            onClose={() => setShowBarcodeScanner(false)}
          />
        )}

        {/* Quick Actions for Create Screen */}
        <QuickActionBar
          actions={[
            {
              id: 'add_item',
              icon: 'add-circle',
              label: 'Add Item',
              color: '#3b82f6',
              onPress: () => setShowItemModal(true),
            },
            {
              id: 'scan_item',
              icon: 'qr-code-scanner',
              label: 'Scan',
              color: '#10b981',
              onPress: () => setShowBarcodeScanner(true),
            },
            {
              id: 'search_catalog',
              icon: 'search',
              label: 'Catalog',
              color: '#8b5cf6',
              onPress: () => setShowCatalogSearch(true),
            },
            {
              id: 'save_draft',
              icon: 'drafts',
              label: 'Save Draft',
              color: '#6b7280',
              onPress: () => handleSave(true),
            },
          ]}
          visible={showQuickActions}
          position="bottom"
        />

        {/* Contextual Help */}
        <View style={styles.helpContainer}>
          <ContextualHelp
            tips={getRequisitionHelpTips()}
            context="requisition_create"
            visible={showHelp}
            onDismiss={() => setShowHelp(false)}
          />
        </View>
      </View>
    </ErrorBoundary>
  );
};

const getUrgencyColor = (urgency: string) => {
  switch (urgency) {
    case 'ROUTINE': return '#10b981';
    case 'URGENT': return '#f59e0b';
    case 'EMERGENCY': return '#ef4444';
    default: return '#6b7280';
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    marginBottom: 8,
  },
  offlineText: {
    fontSize: 14,
    color: '#ef4444',
    marginLeft: 8,
  },
  section: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  pickerText: {
    fontSize: 16,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  halfInput: {
    flex: 1,
    marginRight: 6,
  },
  row: {
    flexDirection: 'row',
  },
  dateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  dateText: {
    fontSize: 16,
    color: '#374151',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    height: 100,
    textAlignVertical: 'top',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
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
  },
  itemDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  itemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  itemQuantity: {
    fontSize: 12,
    color: '#475569',
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  urgencyBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#059669',
  },
  actionButtons: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    gap: 12,
  },
  draftButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
  },
  draftButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
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
  itemModalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '95%',
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalOption: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalOptionText: {
    fontSize: 16,
    color: '#374151',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 12,
  },
  modalCancel: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignItems: 'center',
    flex: 1,
  },
  modalCancelText: {
    fontSize: 16,
    color: '#374151',
  },
  modalConfirm: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    flex: 1,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  searchOptions: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  searchOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 6,
  },
  searchOptionText: {
    fontSize: 14,
    color: '#3b82f6',
    marginLeft: 4,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  urgencyOptions: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  urgencyOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    alignItems: 'center',
  },
  urgencyOptionSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  urgencyOptionText: {
    fontSize: 12,
    color: '#374151',
  },
  urgencyOptionTextSelected: {
    color: '#ffffff',
  },
  photoSection: {
    marginBottom: 16,
  },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 6,
    marginBottom: 8,
  },
  photoButtonText: {
    fontSize: 14,
    color: '#3b82f6',
    marginLeft: 4,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 6,
  },
  catalogList: {
    maxHeight: 300,
    marginBottom: 16,
  },
  catalogItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  catalogItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  catalogItemCode: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  catalogItemPrice: {
    fontSize: 12,
    color: '#059669',
    marginTop: 2,
  },
  helpContainer: {
    position: 'absolute',
    top: 20,
    right: 20,
    zIndex: 1000,
  },
});

export default RequisitionCreateScreen;