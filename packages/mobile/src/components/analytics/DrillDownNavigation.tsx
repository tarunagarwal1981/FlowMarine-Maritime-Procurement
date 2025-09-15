import React, {useState, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

export interface DrillDownLevel {
  id: string;
  title: string;
  subtitle?: string;
  data: any;
  children?: DrillDownLevel[];
  renderContent?: (data: any, onDrillDown: (level: DrillDownLevel) => void) => React.ReactNode;
}

export interface BreadcrumbItem {
  id: string;
  title: string;
  level: number;
}

interface DrillDownNavigationProps {
  rootLevel: DrillDownLevel;
  onLevelChange?: (level: DrillDownLevel, breadcrumbs: BreadcrumbItem[]) => void;
  maxDepth?: number;
  showBreadcrumbs?: boolean;
  animationDuration?: number;
}

const DrillDownNavigation: React.FC<DrillDownNavigationProps> = ({
  rootLevel,
  onLevelChange,
  maxDepth = 5,
  showBreadcrumbs = true,
  animationDuration = 300,
}) => {
  const [currentLevel, setCurrentLevel] = useState<DrillDownLevel>(rootLevel);
  const [navigationStack, setNavigationStack] = useState<DrillDownLevel[]>([rootLevel]);
  const [slideAnim] = useState(new Animated.Value(0));
  const [showLevelSelector, setShowLevelSelector] = useState(false);

  // Generate breadcrumbs from navigation stack
  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    return navigationStack.map((level, index) => ({
      id: level.id,
      title: level.title,
      level: index,
    }));
  }, [navigationStack]);

  const canDrillDown = useMemo(() => {
    return currentLevel.children && 
           currentLevel.children.length > 0 && 
           navigationStack.length < maxDepth;
  }, [currentLevel, navigationStack.length, maxDepth]);

  const canGoBack = useMemo(() => {
    return navigationStack.length > 1;
  }, [navigationStack.length]);

  const handleDrillDown = useCallback((nextLevel: DrillDownLevel) => {
    if (!canDrillDown) return;

    // Animate slide transition
    Animated.timing(slideAnim, {
      toValue: -screenWidth,
      duration: animationDuration,
      useNativeDriver: true,
    }).start(() => {
      setCurrentLevel(nextLevel);
      setNavigationStack(prev => [...prev, nextLevel]);
      
      // Reset animation and slide in from right
      slideAnim.setValue(screenWidth);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: animationDuration,
        useNativeDriver: true,
      }).start();
      
      onLevelChange?.(nextLevel, [...breadcrumbs, {
        id: nextLevel.id,
        title: nextLevel.title,
        level: navigationStack.length,
      }]);
    });
  }, [canDrillDown, slideAnim, animationDuration, onLevelChange, breadcrumbs, navigationStack.length]);

  const handleGoBack = useCallback(() => {
    if (!canGoBack) return;

    // Animate slide transition
    Animated.timing(slideAnim, {
      toValue: screenWidth,
      duration: animationDuration,
      useNativeDriver: true,
    }).start(() => {
      const newStack = navigationStack.slice(0, -1);
      const previousLevel = newStack[newStack.length - 1];
      
      setCurrentLevel(previousLevel);
      setNavigationStack(newStack);
      
      // Reset animation and slide in from left
      slideAnim.setValue(-screenWidth);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: animationDuration,
        useNativeDriver: true,
      }).start();
      
      const newBreadcrumbs = newStack.map((level, index) => ({
        id: level.id,
        title: level.title,
        level: index,
      }));
      
      onLevelChange?.(previousLevel, newBreadcrumbs);
    });
  }, [canGoBack, slideAnim, animationDuration, navigationStack, onLevelChange]);

  const handleBreadcrumbPress = useCallback((targetLevel: number) => {
    if (targetLevel >= navigationStack.length) return;

    const targetStack = navigationStack.slice(0, targetLevel + 1);
    const targetLevelData = targetStack[targetStack.length - 1];

    // Animate transition
    const direction = targetLevel < navigationStack.length - 1 ? screenWidth : -screenWidth;
    
    Animated.timing(slideAnim, {
      toValue: direction,
      duration: animationDuration,
      useNativeDriver: true,
    }).start(() => {
      setCurrentLevel(targetLevelData);
      setNavigationStack(targetStack);
      
      // Reset animation
      slideAnim.setValue(-direction);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: animationDuration,
        useNativeDriver: true,
      }).start();
      
      const newBreadcrumbs = targetStack.map((level, index) => ({
        id: level.id,
        title: level.title,
        level: index,
      }));
      
      onLevelChange?.(targetLevelData, newBreadcrumbs);
    });
  }, [navigationStack, slideAnim, animationDuration, onLevelChange]);

  const renderBreadcrumbs = () => {
    if (!showBreadcrumbs || breadcrumbs.length <= 1) return null;

    return (
      <View style={styles.breadcrumbContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.breadcrumbContent}
        >
          {breadcrumbs.map((crumb, index) => (
            <View key={crumb.id} style={styles.breadcrumbItem}>
              <TouchableOpacity
                onPress={() => handleBreadcrumbPress(crumb.level)}
                style={[
                  styles.breadcrumbButton,
                  index === breadcrumbs.length - 1 && styles.currentBreadcrumb,
                ]}
                disabled={index === breadcrumbs.length - 1}
              >
                <Text
                  style={[
                    styles.breadcrumbText,
                    index === breadcrumbs.length - 1 && styles.currentBreadcrumbText,
                  ]}
                  numberOfLines={1}
                >
                  {crumb.title}
                </Text>
              </TouchableOpacity>
              
              {index < breadcrumbs.length - 1 && (
                <Icon name="chevron-right" size={16} color="#94a3b8" style={styles.breadcrumbSeparator} />
              )}
            </View>
          ))}
        </ScrollView>
        
        {breadcrumbs.length > 2 && (
          <TouchableOpacity
            onPress={() => setShowLevelSelector(true)}
            style={styles.levelSelectorButton}
          >
            <Icon name="more-horiz" size={20} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderNavigationHeader = () => (
    <View style={styles.navigationHeader}>
      <TouchableOpacity
        onPress={handleGoBack}
        style={[styles.backButton, !canGoBack && styles.disabledButton]}
        disabled={!canGoBack}
      >
        <Icon
          name="arrow-back"
          size={24}
          color={canGoBack ? '#1e40af' : '#94a3b8'}
        />
      </TouchableOpacity>
      
      <View style={styles.levelInfo}>
        <Text style={styles.levelTitle} numberOfLines={1}>
          {currentLevel.title}
        </Text>
        {currentLevel.subtitle && (
          <Text style={styles.levelSubtitle} numberOfLines={1}>
            {currentLevel.subtitle}
          </Text>
        )}
      </View>
      
      <View style={styles.levelIndicator}>
        <Text style={styles.levelDepth}>
          {navigationStack.length}/{maxDepth}
        </Text>
      </View>
    </View>
  );

  const renderChildren = () => {
    if (!currentLevel.children || currentLevel.children.length === 0) {
      return (
        <View style={styles.noChildrenContainer}>
          <Icon name="info-outline" size={48} color="#94a3b8" />
          <Text style={styles.noChildrenText}>No further details available</Text>
        </View>
      );
    }

    return (
      <ScrollView style={styles.childrenContainer}>
        {currentLevel.children.map((child, index) => (
          <TouchableOpacity
            key={child.id}
            style={[
              styles.childItem,
              !canDrillDown && styles.disabledChildItem,
            ]}
            onPress={() => handleDrillDown(child)}
            disabled={!canDrillDown}
          >
            <View style={styles.childContent}>
              <Text style={styles.childTitle}>{child.title}</Text>
              {child.subtitle && (
                <Text style={styles.childSubtitle}>{child.subtitle}</Text>
              )}
            </View>
            
            {canDrillDown && child.children && child.children.length > 0 && (
              <View style={styles.childIndicator}>
                <Icon name="chevron-right" size={20} color="#64748b" />
                <Text style={styles.childCount}>
                  {child.children.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  const renderLevelSelector = () => (
    <Modal
      visible={showLevelSelector}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLevelSelector(false)}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowLevelSelector(false)}
        />
        <View style={styles.levelSelectorModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Navigate to Level</Text>
            <TouchableOpacity
              onPress={() => setShowLevelSelector(false)}
              style={styles.modalCloseButton}
            >
              <Icon name="close" size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.levelList}>
            {navigationStack.map((level, index) => (
              <TouchableOpacity
                key={level.id}
                style={[
                  styles.levelItem,
                  index === navigationStack.length - 1 && styles.currentLevelItem,
                ]}
                onPress={() => {
                  handleBreadcrumbPress(index);
                  setShowLevelSelector(false);
                }}
              >
                <View style={styles.levelItemContent}>
                  <Text
                    style={[
                      styles.levelItemTitle,
                      index === navigationStack.length - 1 && styles.currentLevelItemTitle,
                    ]}
                  >
                    {level.title}
                  </Text>
                  <Text style={styles.levelItemDepth}>Level {index + 1}</Text>
                </View>
                
                {index === navigationStack.length - 1 && (
                  <Icon name="check" size={20} color="#1e40af" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      {renderBreadcrumbs()}
      {renderNavigationHeader()}
      
      <Animated.View
        style={[
          styles.contentContainer,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        {currentLevel.renderContent ? (
          currentLevel.renderContent(currentLevel.data, handleDrillDown)
        ) : (
          renderChildren()
        )}
      </Animated.View>
      
      {renderLevelSelector()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  breadcrumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  breadcrumbContent: {
    alignItems: 'center',
  },
  breadcrumbItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  breadcrumbButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  currentBreadcrumb: {
    backgroundColor: '#e0f2fe',
  },
  breadcrumbText: {
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '500',
    maxWidth: 120,
  },
  currentBreadcrumbText: {
    color: '#0369a1',
    fontWeight: '600',
  },
  breadcrumbSeparator: {
    marginHorizontal: 4,
  },
  levelSelectorButton: {
    padding: 8,
    marginLeft: 8,
  },
  navigationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  disabledButton: {
    opacity: 0.5,
  },
  levelInfo: {
    flex: 1,
  },
  levelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  levelSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  levelIndicator: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  levelDepth: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  childrenContainer: {
    flex: 1,
    padding: 16,
  },
  childItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  disabledChildItem: {
    opacity: 0.6,
  },
  childContent: {
    flex: 1,
  },
  childTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  childSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  childIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  childCount: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  noChildrenContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  noChildrenText: {
    fontSize: 16,
    color: '#94a3b8',
    marginTop: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  levelSelectorModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: screenWidth * 0.8,
    maxHeight: screenHeight * 0.6,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  modalCloseButton: {
    padding: 4,
  },
  levelList: {
    maxHeight: screenHeight * 0.4,
  },
  levelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  currentLevelItem: {
    backgroundColor: '#e0f2fe',
  },
  levelItemContent: {
    flex: 1,
  },
  levelItemTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  currentLevelItemTitle: {
    color: '#0369a1',
    fontWeight: '600',
  },
  levelItemDepth: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});

export default DrillDownNavigation;