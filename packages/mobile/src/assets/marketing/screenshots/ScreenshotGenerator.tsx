import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface ScreenshotProps {
  feature: {
    title: string;
    description: string;
    screen: string;
  };
  deviceType: 'phone' | 'tablet';
  platform: 'ios' | 'android';
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const ScreenshotGenerator: React.FC<ScreenshotProps> = ({
  feature,
  deviceType,
  platform,
}) => {
  const renderMockScreen = () => {
    switch (feature.screen) {
      case 'requisition-list':
        return <RequisitionListMock />;
      case 'analytics-dashboard':
        return <AnalyticsDashboardMock />;
      case 'vendor-comparison':
        return <VendorComparisonMock />;
      case 'mobile-interface':
        return <MobileInterfaceMock />;
      case 'offline-mode':
        return <OfflineModeMock />;
      default:
        return <DefaultMock />;
    }
  };

  return (
    <View style={styles.container}>
      {/* Device frame */}
      <View style={[
        styles.deviceFrame,
        deviceType === 'tablet' ? styles.tabletFrame : styles.phoneFrame,
        platform === 'ios' ? styles.iosFrame : styles.androidFrame,
      ]}>
        {/* Status bar */}
        <View style={styles.statusBar}>
          <Text style={styles.statusTime}>9:41</Text>
          <View style={styles.statusIcons}>
            <View style={styles.signalIcon} />
            <View style={styles.wifiIcon} />
            <View style={styles.batteryIcon} />
          </View>
        </View>

        {/* App content */}
        <View style={styles.appContent}>
          {renderMockScreen()}
        </View>
      </View>

      {/* Marketing overlay */}
      <View style={styles.marketingOverlay}>
        <LinearGradient
          colors={['rgba(30, 64, 175, 0.9)', 'rgba(14, 165, 233, 0.9)']}
          style={styles.overlayGradient}
        >
          <Text style={styles.featureTitle}>{feature.title}</Text>
          <Text style={styles.featureDescription}>{feature.description}</Text>
        </LinearGradient>
      </View>
    </View>
  );
};

const RequisitionListMock: React.FC = () => (
  <ScrollView style={styles.mockScreen}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Requisitions</Text>
      <View style={styles.addButton}>
        <Text style={styles.addButtonText}>+</Text>
      </View>
    </View>
    
    {[1, 2, 3, 4].map((item) => (
      <View key={item} style={styles.requisitionItem}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemTitle}>REQ-2024-{String(item).padStart(3, '0')}</Text>
          <View style={[styles.statusBadge, { backgroundColor: item % 2 ? '#10b981' : '#f59e0b' }]}>
            <Text style={styles.statusText}>{item % 2 ? 'Approved' : 'Pending'}</Text>
          </View>
        </View>
        <Text style={styles.itemVessel}>MV Ocean Explorer</Text>
        <Text style={styles.itemAmount}>${(Math.random() * 10000 + 1000).toFixed(2)}</Text>
      </View>
    ))}
  </ScrollView>
);

const AnalyticsDashboardMock: React.FC = () => (
  <ScrollView style={styles.mockScreen}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Analytics</Text>
    </View>
    
    <View style={styles.kpiContainer}>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiValue}>$2.4M</Text>
        <Text style={styles.kpiLabel}>Total Spend</Text>
      </View>
      <View style={styles.kpiCard}>
        <Text style={styles.kpiValue}>156</Text>
        <Text style={styles.kpiLabel}>Active Orders</Text>
      </View>
    </View>

    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Fleet Spending Trends</Text>
      <View style={styles.mockChart}>
        {[40, 65, 45, 80, 55, 70, 60].map((height, index) => (
          <View
            key={index}
            style={[
              styles.chartBar,
              { height: `${height}%` }
            ]}
          />
        ))}
      </View>
    </View>
  </ScrollView>
);

const VendorComparisonMock: React.FC = () => (
  <ScrollView style={styles.mockScreen}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Vendor Quotes</Text>
    </View>
    
    {['Maritime Supply Co.', 'Ocean Parts Ltd.', 'Ship Services Inc.'].map((vendor, index) => (
      <View key={vendor} style={styles.vendorCard}>
        <View style={styles.vendorHeader}>
          <Text style={styles.vendorName}>{vendor}</Text>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text key={star} style={[
                styles.star,
                { color: star <= (5 - index) ? '#fbbf24' : '#d1d5db' }
              ]}>★</Text>
            ))}
          </View>
        </View>
        <Text style={styles.vendorPrice}>${(8500 + index * 1200).toFixed(2)}</Text>
        <Text style={styles.vendorDelivery}>Delivery: {3 + index} days</Text>
      </View>
    ))}
  </ScrollView>
);

const MobileInterfaceMock: React.FC = () => (
  <View style={styles.mockScreen}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>FlowMarine</Text>
    </View>
    
    <View style={styles.quickActions}>
      <View style={styles.actionButton}>
        <Text style={styles.actionIcon}>📋</Text>
        <Text style={styles.actionText}>New Requisition</Text>
      </View>
      <View style={styles.actionButton}>
        <Text style={styles.actionIcon}>📊</Text>
        <Text style={styles.actionText}>Analytics</Text>
      </View>
      <View style={styles.actionButton}>
        <Text style={styles.actionIcon}>🚢</Text>
        <Text style={styles.actionText}>Vessels</Text>
      </View>
      <View style={styles.actionButton}>
        <Text style={styles.actionIcon}>👥</Text>
        <Text style={styles.actionText}>Vendors</Text>
      </View>
    </View>

    <View style={styles.recentActivity}>
      <Text style={styles.sectionTitle}>Recent Activity</Text>
      {[1, 2, 3].map((item) => (
        <View key={item} style={styles.activityItem}>
          <View style={styles.activityIcon} />
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>Requisition REQ-{item} approved</Text>
            <Text style={styles.activityTime}>{item} hours ago</Text>
          </View>
        </View>
      ))}
    </View>
  </View>
);

const OfflineModeMock: React.FC = () => (
  <View style={styles.mockScreen}>
    <View style={styles.offlineHeader}>
      <View style={styles.offlineBanner}>
        <Text style={styles.offlineIcon}>📡</Text>
        <Text style={styles.offlineText}>Working Offline</Text>
        <Text style={styles.syncIcon}>🔄</Text>
      </View>
    </View>
    
    <View style={styles.offlineContent}>
      <Text style={styles.offlineTitle}>Continue Working at Sea</Text>
      <Text style={styles.offlineDescription}>
        Create requisitions, review orders, and manage your fleet even without internet connection.
        All changes will sync automatically when you're back online.
      </Text>
      
      <View style={styles.offlineFeatures}>
        <View style={styles.offlineFeature}>
          <Text style={styles.featureIcon}>✓</Text>
          <Text style={styles.featureText}>Create requisitions offline</Text>
        </View>
        <View style={styles.offlineFeature}>
          <Text style={styles.featureIcon}>✓</Text>
          <Text style={styles.featureText}>Access cached data</Text>
        </View>
        <View style={styles.offlineFeature}>
          <Text style={styles.featureIcon}>✓</Text>
          <Text style={styles.featureText}>Auto-sync when online</Text>
        </View>
      </View>
    </View>
  </View>
);

const DefaultMock: React.FC = () => (
  <View style={styles.mockScreen}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>FlowMarine</Text>
    </View>
    <View style={styles.defaultContent}>
      <Text style={styles.defaultText}>Maritime Procurement Platform</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceFrame: {
    backgroundColor: '#000',
    borderRadius: 25,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  phoneFrame: {
    width: 300,
    height: 600,
  },
  tabletFrame: {
    width: 400,
    height: 600,
  },
  iosFrame: {
    borderRadius: 25,
  },
  androidFrame: {
    borderRadius: 15,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#1e40af',
  },
  statusTime: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalIcon: {
    width: 16,
    height: 10,
    backgroundColor: '#fff',
    borderRadius: 2,
    marginRight: 4,
  },
  wifiIcon: {
    width: 14,
    height: 10,
    backgroundColor: '#fff',
    borderRadius: 2,
    marginRight: 4,
  },
  batteryIcon: {
    width: 20,
    height: 10,
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  appContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 21,
    borderBottomRightRadius: 21,
    overflow: 'hidden',
  },
  mockScreen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  addButton: {
    width: 32,
    height: 32,
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  requisitionItem: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  itemVessel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 4,
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
  },
  kpiContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 4,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 4,
  },
  kpiLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  chartContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  mockChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 120,
    justifyContent: 'space-between',
  },
  chartBar: {
    width: 20,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
    marginHorizontal: 2,
  },
  vendorCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  vendorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  ratingContainer: {
    flexDirection: 'row',
  },
  star: {
    fontSize: 14,
    marginHorizontal: 1,
  },
  vendorPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 4,
  },
  vendorDelivery: {
    fontSize: 14,
    color: '#64748b',
  },
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  actionButton: {
    width: '48%',
    backgroundColor: '#fff',
    padding: 16,
    margin: '1%',
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    textAlign: 'center',
  },
  recentActivity: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 12,
    marginVertical: 4,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  activityIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#64748b',
  },
  offlineHeader: {
    backgroundColor: '#fff',
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 8,
  },
  offlineIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  offlineText: {
    color: '#fff',
    fontWeight: '600',
    marginRight: 8,
  },
  syncIcon: {
    fontSize: 16,
  },
  offlineContent: {
    padding: 24,
    alignItems: 'center',
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 16,
  },
  offlineDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  offlineFeatures: {
    alignSelf: 'stretch',
  },
  offlineFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  featureIcon: {
    fontSize: 18,
    color: '#10b981',
    marginRight: 12,
    width: 24,
  },
  featureText: {
    fontSize: 16,
    color: '#1e293b',
  },
  defaultContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  defaultText: {
    fontSize: 18,
    color: '#64748b',
    textAlign: 'center',
  },
  marketingOverlay: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  overlayGradient: {
    padding: 20,
    alignItems: 'center',
  },
  featureTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  featureDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 20,
  },
});