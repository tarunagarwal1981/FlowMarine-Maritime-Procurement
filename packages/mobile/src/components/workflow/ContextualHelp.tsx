import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface HelpTip {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'tip';
  position?: 'top' | 'bottom' | 'left' | 'right';
  showOnce?: boolean;
}

interface ContextualHelpProps {
  tips: HelpTip[];
  context: string;
  visible?: boolean;
  onDismiss?: () => void;
  style?: any;
}

interface TooltipProps {
  tip: HelpTip;
  targetRef?: React.RefObject<View>;
  visible: boolean;
  onClose: () => void;
}

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

const ContextualHelp: React.FC<ContextualHelpProps> = ({
  tips,
  context,
  visible = true,
  onDismiss,
  style,
}) => {
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDismissedTips();
  }, [context]);

  const loadDismissedTips = async () => {
    try {
      // In a real app, load from AsyncStorage
      // For now, simulate some dismissed tips
      const mockDismissed = new Set(['tip_1', 'tip_3']);
      setDismissedTips(mockDismissed);
    } catch (error) {
      console.error('Error loading dismissed tips:', error);
    }
  };

  const saveDismissedTip = async (tipId: string) => {
    try {
      const newDismissed = new Set([...dismissedTips, tipId]);
      setDismissedTips(newDismissed);
      
      // In a real app, save to AsyncStorage
      // await AsyncStorage.setItem(`dismissed_tips_${context}`, JSON.stringify([...newDismissed]));
    } catch (error) {
      console.error('Error saving dismissed tip:', error);
    }
  };

  const availableTips = tips.filter(tip => 
    !tip.showOnce || !dismissedTips.has(tip.id)
  );

  const handleShowHelp = () => {
    if (availableTips.length > 0) {
      setCurrentTipIndex(0);
      setShowModal(true);
    }
  };

  const handleNextTip = () => {
    if (currentTipIndex < availableTips.length - 1) {
      setCurrentTipIndex(currentTipIndex + 1);
    } else {
      handleCloseModal();
    }
  };

  const handlePreviousTip = () => {
    if (currentTipIndex > 0) {
      setCurrentTipIndex(currentTipIndex - 1);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleDismissTip = (tipId: string) => {
    saveDismissedTip(tipId);
    handleNextTip();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'info': return '#3b82f6';
      case 'warning': return '#f59e0b';
      case 'success': return '#10b981';
      case 'tip': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'info': return 'info';
      case 'warning': return 'warning';
      case 'success': return 'check-circle';
      case 'tip': return 'lightbulb';
      default: return 'help';
    }
  };

  if (!visible || availableTips.length === 0) {
    return null;
  }

  const currentTip = availableTips[currentTipIndex];

  return (
    <View style={[styles.container, style]}>
      {/* Help Button */}
      <TouchableOpacity
        style={styles.helpButton}
        onPress={handleShowHelp}
      >
        <Icon name="help" size={24} color="#3b82f6" />
      </TouchableOpacity>

      {/* Help Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.tipIndicator}>
                <Icon
                  name={getTypeIcon(currentTip.type)}
                  size={24}
                  color={getTypeColor(currentTip.type)}
                />
              </View>
              <Text style={styles.modalTitle}>{currentTip.title}</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleCloseModal}
              >
                <Icon name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView style={styles.contentContainer}>
              <Text style={styles.tipContent}>{currentTip.content}</Text>
            </ScrollView>

            {/* Progress Indicator */}
            {availableTips.length > 1 && (
              <View style={styles.progressContainer}>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${((currentTipIndex + 1) / availableTips.length) * 100}%`,
                        backgroundColor: getTypeColor(currentTip.type),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {currentTipIndex + 1} of {availableTips.length}
                </Text>
              </View>
            )}

            {/* Actions */}
            <View style={styles.modalActions}>
              {currentTip.showOnce && (
                <TouchableOpacity
                  style={styles.dismissButton}
                  onPress={() => handleDismissTip(currentTip.id)}
                >
                  <Text style={styles.dismissButtonText}>Don't show again</Text>
                </TouchableOpacity>
              )}

              <View style={styles.navigationButtons}>
                {currentTipIndex > 0 && (
                  <TouchableOpacity
                    style={styles.navButton}
                    onPress={handlePreviousTip}
                  >
                    <Icon name="arrow-back" size={20} color="#6b7280" />
                    <Text style={styles.navButtonText}>Previous</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.navButton,
                    styles.primaryButton,
                    {backgroundColor: getTypeColor(currentTip.type)},
                  ]}
                  onPress={handleNextTip}
                >
                  <Text style={styles.primaryButtonText}>
                    {currentTipIndex < availableTips.length - 1 ? 'Next' : 'Got it'}
                  </Text>
                  {currentTipIndex < availableTips.length - 1 && (
                    <Icon name="arrow-forward" size={20} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Tooltip component for inline help
const Tooltip: React.FC<TooltipProps> = ({tip, visible, onClose}) => {
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.tooltip,
        {
          opacity: fadeAnim,
          backgroundColor: getTypeColor(tip.type),
        },
      ]}
    >
      <View style={styles.tooltipContent}>
        <Icon
          name={getTypeIcon(tip.type)}
          size={16}
          color="#ffffff"
          style={styles.tooltipIcon}
        />
        <Text style={styles.tooltipText}>{tip.content}</Text>
        <TouchableOpacity onPress={onClose} style={styles.tooltipClose}>
          <Icon name="close" size={16} color="#ffffff" />
        </TouchableOpacity>
      </View>
      <View style={[styles.tooltipArrow, {borderTopColor: getTypeColor(tip.type)}]} />
    </Animated.View>
  );
};

// Predefined help tips for different contexts
export const getRequisitionHelpTips = (): HelpTip[] => [
  {
    id: 'req_tip_1',
    title: 'Creating Requisitions',
    content: 'Start by selecting your vessel and delivery location. Use the barcode scanner or catalog search to quickly find items.',
    type: 'tip',
    showOnce: true,
  },
  {
    id: 'req_tip_2',
    title: 'Urgency Levels',
    content: 'Set appropriate urgency levels:\n• ROUTINE: Standard procurement\n• URGENT: Needed within 48 hours\n• EMERGENCY: Critical safety items',
    type: 'info',
  },
  {
    id: 'req_tip_3',
    title: 'Offline Mode',
    content: 'You can create requisitions offline. They will automatically sync when you reconnect to the internet.',
    type: 'success',
  },
  {
    id: 'req_tip_4',
    title: 'Voice Input',
    content: 'Hold the microphone button to use voice input for descriptions and justifications.',
    type: 'tip',
  },
];

export const getApprovalHelpTips = (): HelpTip[] => [
  {
    id: 'app_tip_1',
    title: 'Approval Workflow',
    content: 'Swipe right to approve or left to reject requisitions quickly. You can also use the action buttons below.',
    type: 'tip',
    showOnce: true,
  },
  {
    id: 'app_tip_2',
    title: 'Delegation',
    content: 'If you\'re unavailable, you can delegate approval authority to another qualified person.',
    type: 'info',
  },
  {
    id: 'app_tip_3',
    title: 'Emergency Override',
    content: 'Captains can override approvals in emergencies, but must provide post-approval documentation.',
    type: 'warning',
  },
];

export const getDashboardHelpTips = (): HelpTip[] => [
  {
    id: 'dash_tip_1',
    title: 'Quick Actions',
    content: 'Use the quick action bar at the bottom to access common tasks like creating requisitions or scanning items.',
    type: 'tip',
  },
  {
    id: 'dash_tip_2',
    title: 'Real-time Updates',
    content: 'Your dashboard shows real-time data. Pull down to refresh or enable auto-refresh in settings.',
    type: 'info',
  },
];

const getTypeColor = (type: string) => {
  switch (type) {
    case 'info': return '#3b82f6';
    case 'warning': return '#f59e0b';
    case 'success': return '#10b981';
    case 'tip': return '#8b5cf6';
    default: return '#6b7280';
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'info': return 'info';
    case 'warning': return 'warning';
    case 'success': return 'check-circle';
    case 'tip': return 'lightbulb';
    default: return 'help';
  }
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  helpButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: screenHeight * 0.8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tipIndicator: {
    marginRight: 12,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  contentContainer: {
    padding: 20,
    maxHeight: 300,
  },
  tipContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#f3f4f6',
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  modalActions: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  dismissButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  dismissButtonText: {
    fontSize: 14,
    color: '#6b7280',
    textDecorationLine: 'underline',
  },
  navigationButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  primaryButton: {
    borderColor: 'transparent',
  },
  navButtonText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginRight: 4,
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 8,
    borderRadius: 8,
    padding: 12,
    zIndex: 1000,
  },
  tooltipContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tooltipIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  tooltipText: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
    lineHeight: 18,
  },
  tooltipClose: {
    marginLeft: 8,
    padding: 2,
  },
  tooltipArrow: {
    position: 'absolute',
    top: '100%',
    left: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});

export {Tooltip};
export default ContextualHelp;