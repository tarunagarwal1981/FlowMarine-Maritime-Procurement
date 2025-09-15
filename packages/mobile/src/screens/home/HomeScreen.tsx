import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {StackNavigationProp} from '@react-navigation/stack';
import {DrawerActions} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {RootState} from '../../store/index';
import {setDashboardData, refreshDashboard} from '../../store/slices/dashboardSlice';
import {HomeStackParamList} from '../../navigation/stacks/HomeStackNavigator';
import QuickActionCard from '../../components/home/QuickActionCard';
import DashboardWidget from '../../components/dashboard/DashboardWidget';
import RecentActivityList from '../../components/home/RecentActivityList';
import AlertsPanel from '../../components/home/AlertsPanel';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBoundary from '../../components/common/ErrorBoundary';

type HomeScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const {width} = Dimensions.get('window');

const HomeScreen: React.FC<Props> = ({navigation}) => {
  const [refreshing, setRefreshing] = useState(false);
  const dispatch = useDispatch();
  
  const {user} = useSelector((state: RootState) => state.auth);
  const {dashboardData, isLoading, selectedVessel} = useSelector(
    (state: RootState) => state.dashboard
  );
  const {unreadCount} = useSelector((state: RootState) => state.notifications);
  const {isOnline, pendingSync} = useSelector((state: RootState) => state.offline);

  useEffect(() => {
    loadDashboardData();
  }, [selectedVessel]);

  const loadDashboardData = async () => {
    dispatch(refreshDashboard());
    try {
      // Implementation would call dashboard API
      // For now, simulate loading dashboard data
      setTimeout(() => {
        dispatch(setDashboardData({
          totalSpend: 125000,
          budgetUtilization: 68,
          pendingRequisitions: 12,
          activeVendors: 45,
          recentActivity: [
            {
              id: '1',
              type: 'requisition',
              description: 'New requisition created for Engine Parts',
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: '2',
              type: 'approval',
              description: 'Requisition REQ-2024-001 approved',
              timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: '3',
              type: 'delivery',
              description: 'Parts delivered to MV Ocean Star',
              timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
            },
          ],
          alerts: [
            {
              id: '1',
              type: 'warning',
              message: 'Budget utilization approaching 70% threshold',
              timestamp: new Date().toISOString(),
            },
            {
              id: '2',
              type: 'info',
              message: '3 requisitions pending approval',
              timestamp: new Date().toISOString(),
            },
          ],
        }));
      }, 1000);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const quickActions = [
    {
      id: 'create-requisition',
      title: 'Create Requisition',
      icon: 'add-circle',
      color: '#1e40af',
      onPress: () => navigation.navigate('RequisitionStack', {
        screen: 'CreateRequisition',
      }),
    },
    {
      id: 'view-analytics',
      title: 'View Analytics',
      icon: 'analytics',
      color: '#059669',
      onPress: () => navigation.navigate('Dashboard'),
    },
    {
      id: 'scan-barcode',
      title: 'Scan Item',
      icon: 'qr-code-scanner',
      color: '#dc2626',
      onPress: () => {
        // Implementation would open barcode scanner
        console.log('Open barcode scanner');
      },
    },
    {
      id: 'emergency',
      title: 'Emergency',
      icon: 'emergency',
      color: '#ea580c',
      onPress: () => {
        // Implementation would open emergency procedures
        console.log('Open emergency procedures');
      },
    },
  ];

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={openDrawer} style={styles.menuButton}>
            <Icon name="menu" size={24} color="#ffffff" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.firstName}</Text>
          </View>

          <View style={styles.headerActions}>
            {!isOnline && (
              <View style={styles.offlineIndicator}>
                <Icon name="cloud-off" size={16} color="#ef4444" />
              </View>
            )}
            {pendingSync.length > 0 && (
              <View style={styles.syncIndicator}>
                <Icon name="sync" size={16} color="#f59e0b" />
                <Text style={styles.syncCount}>{pendingSync.length}</Text>
              </View>
            )}
            <TouchableOpacity
              onPress={() => navigation.navigate('NotificationStack')}
              style={styles.notificationButton}>
              <Icon name="notifications" size={24} color="#ffffff" />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          
          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action) => (
                <QuickActionCard
                  key={action.id}
                  title={action.title}
                  icon={action.icon}
                  color={action.color}
                  onPress={action.onPress}
                />
              ))}
            </View>
          </View>

          {/* Dashboard Overview */}
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <LoadingSpinner size="large" />
              <Text style={styles.loadingText}>Loading dashboard...</Text>
            </View>
          ) : dashboardData ? (
            <>
              {/* Key Metrics */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Key Metrics</Text>
                <View style={styles.metricsGrid}>
                  <DashboardWidget
                    title="Total Spend"
                    value={`$${dashboardData.totalSpend.toLocaleString()}`}
                    icon="attach-money"
                    color="#1e40af"
                    trend="+12%"
                  />
                  <DashboardWidget
                    title="Budget Used"
                    value={`${dashboardData.budgetUtilization}%`}
                    icon="pie-chart"
                    color="#059669"
                    trend="+5%"
                  />
                  <DashboardWidget
                    title="Pending Requisitions"
                    value={dashboardData.pendingRequisitions.toString()}
                    icon="assignment"
                    color="#dc2626"
                    trend="-2"
                  />
                  <DashboardWidget
                    title="Active Vendors"
                    value={dashboardData.activeVendors.toString()}
                    icon="business"
                    color="#7c3aed"
                    trend="+3"
                  />
                </View>
              </View>

              {/* Alerts */}
              {dashboardData.alerts.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Alerts</Text>
                  <AlertsPanel alerts={dashboardData.alerts} />
                </View>
              )}

              {/* Recent Activity */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent Activity</Text>
                  <TouchableOpacity>
                    <Text style={styles.viewAllText}>View All</Text>
                  </TouchableOpacity>
                </View>
                <RecentActivityList activities={dashboardData.recentActivity} />
              </View>
            </>
          ) : null}

          {/* Vessel Information */}
          {user?.vessels && user.vessels.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Vessels</Text>
              {user.vessels.map((vessel) => (
                <TouchableOpacity
                  key={vessel.id}
                  style={styles.vesselCard}
                  onPress={() =>
                    navigation.navigate('VesselDetails', {
                      vesselId: vessel.id,
                      vesselName: vessel.name,
                    })
                  }>
                  <Icon name="directions-boat" size={24} color="#1e40af" />
                  <View style={styles.vesselInfo}>
                    <Text style={styles.vesselName}>{vessel.name}</Text>
                    <Text style={styles.vesselImo}>IMO: {vessel.imoNumber}</Text>
                  </View>
                  <Icon name="chevron-right" size={24} color="#64748b" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
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
    backgroundColor: '#1e40af',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  menuButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  welcomeText: {
    color: '#bfdbfe',
    fontSize: 14,
  },
  userName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineIndicator: {
    marginRight: 12,
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  syncCount: {
    color: '#f59e0b',
    fontSize: 12,
    marginLeft: 4,
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  viewAllText: {
    color: '#1e40af',
    fontSize: 14,
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  vesselCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 16,
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
  vesselInfo: {
    flex: 1,
    marginLeft: 12,
  },
  vesselName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  vesselImo: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
});

export default HomeScreen;