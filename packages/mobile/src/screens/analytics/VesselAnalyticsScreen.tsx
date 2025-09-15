import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {StackNavigationProp, RouteProp} from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {RootState} from '../../store/index';
import {HomeStackParamList} from '../../navigation/stacks/HomeStackNavigator';
import {
  setAnalyticsLoading,
  setAnalyticsError,
  setVesselAnalytics,
  setSelectedTimeRange,
  setSelectedVessel,
  setWebSocketConnected,
  incrementRetryCount,
  resetRetryCount,
  updateVesselAnalyticsRealTime,
  VesselAnalyticsData,
} from '../../store/slices/dashboardSlice';
import DashboardChart from '../../components/dashboard/DashboardChart';
import MetricCard from '../../components/dashboard/MetricCard';
import VesselSelector from '../../components/dashboard/VesselSelector';
import TimeRangeSelector from '../../components/dashboard/TimeRangeSelector';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import EnvironmentalMonitor from '../../components/analytics/EnvironmentalMonitor';
import MotionInteractions from '../../components/motion/MotionInteractions';
import {analyticsApiService} from '../../services/api/analyticsApiService';
import {dashboardWebSocketService} from '../../services/websocket/websocketService';
import {cacheService} from '../../services/cache/cacheService';

type VesselAnalyticsScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'VesselAnalytics'>;
type VesselAnalyticsScreenRouteProp = RouteProp<HomeStackParamList, 'VesselAnalytics'>;

interface Props {
  navigation: VesselAnalyticsScreenNavigationProp;
  route: VesselAnalyticsScreenRouteProp;
}

const {width: screenWidth} = Dimensions.get('window');

const VesselAnalyticsScreen: React.FC<Props> = ({navigation, route}) => {
  const dispatch = useDispatch();
  const {
    vesselAnalytics,
    selectedTimeRange,
    selectedVessel,
    analyticsLoading,
    analyticsError,
    isWebSocketConnected,
    retryCount,
  } = useSelector((state: RootState) => state.dashboard);
  const {user} = useSelector((state: RootState) => state.auth);
  const vessels = user?.vessels || [];

  // Initialize vessel from route params or first available vessel
  useEffect(() => {
    const routeVesselId = route.params?.vesselId;
    if (routeVesselId && routeVesselId !== selectedVessel) {
      dispatch(setSelectedVessel(routeVesselId));
    } else if (vessels.length > 0 && !selectedVessel) {
      dispatch(setSelectedVessel(vessels[0].id));
    }
  }, [vessels, selectedVessel, route.params?.vesselId, dispatch]);

  // Load analytics data when vessel or time range changes
  useEffect(() => {
    if (selectedVessel) {
      loadVesselAnalytics();
    }
  }, [selectedVessel, selectedTimeRange]);

  // Setup WebSocket connection
  useEffect(() => {
    setupWebSocketConnection();
    return () => {
      cleanupWebSocketConnection();
    };
  }, [selectedVessel]);

  const setupWebSocketConnection = useCallback(() => {
    if (!selectedVessel) return;

    // Setup WebSocket event handlers
    dashboardWebSocketService.subscribe('connected', () => {
      dispatch(setWebSocketConnected(true));
      dispatch(resetRetryCount());
      dashboardWebSocketService.subscribeToVesselAnalytics(selectedVessel);
    });

    dashboardWebSocketService.subscribe('disconnected', () => {
      dispatch(setWebSocketConnected(false));
    });

    dashboardWebSocketService.subscribe('error', (message) => {
      console.error('WebSocket error:', message.data);
      dispatch(setWebSocketConnected(false));
    });

    dashboardWebSocketService.subscribe('VESSEL_ANALYTICS_UPDATE', (message) => {
      if (message.data.vesselId === selectedVessel) {
        dispatch(updateVesselAnalyticsRealTime(message.data.analytics));
      }
    });

    dashboardWebSocketService.subscribe('SPEND_UPDATE', (message) => {
      if (message.data.vesselId === selectedVessel) {
        dispatch(updateVesselAnalyticsRealTime({
          spendingMetrics: message.data.spendingMetrics,
        }));
      }
    });

    dashboardWebSocketService.subscribe('BUDGET_ALERT', (message) => {
      if (message.data.vesselId === selectedVessel) {
        const currentAlerts = vesselAnalytics?.alerts || [];
        dispatch(updateVesselAnalyticsRealTime({
          alerts: [...currentAlerts, message.data.alert],
        }));
      }
    });

    // Connect to WebSocket
    dashboardWebSocketService.connect();
  }, [selectedVessel, dispatch, vesselAnalytics?.alerts]);

  const cleanupWebSocketConnection = useCallback(() => {
    if (selectedVessel) {
      dashboardWebSocketService.unsubscribeFromVesselAnalytics(selectedVessel);
    }
    dashboardWebSocketService.disconnect();
  }, [selectedVessel]);

  const loadVesselAnalytics = async (forceRefresh = false) => {
    if (!selectedVessel) return;

    dispatch(setAnalyticsLoading(true));
    dispatch(setAnalyticsError(null));

    try {
      // Try to get cached data first (unless force refresh)
      const cacheKey = `vessel-analytics:${selectedVessel}:${selectedTimeRange}`;
      
      if (!forceRefresh) {
        const cachedData = await cacheService.get<VesselAnalyticsData>(cacheKey, {
          ttl: 5 * 60 * 1000, // 5 minutes cache
        });
        
        if (cachedData) {
          dispatch(setVesselAnalytics(cachedData));
          dispatch(setAnalyticsLoading(false));
          dispatch(resetRetryCount());
          return;
        }
      }

      // Fetch fresh data from API
      const response = await analyticsApiService.getVesselAnalytics(
        selectedVessel,
        selectedTimeRange
      );

      if (response.success && response.data) {
        dispatch(setVesselAnalytics(response.data));
        dispatch(resetRetryCount());
        
        // Cache the data
        await cacheService.set(cacheKey, response.data, {
          ttl: 5 * 60 * 1000, // 5 minutes
        });
      } else {
        throw new Error(response.error || 'Failed to load analytics data');
      }
    } catch (error) {
      console.error('Error loading vessel analytics:', error);
      dispatch(setAnalyticsError(error instanceof Error ? error.message : 'Unknown error'));
      dispatch(incrementRetryCount());
      
      // Show user-friendly error message
      if (retryCount < 3) {
        setTimeout(() => loadVesselAnalytics(), Math.pow(2, retryCount) * 1000);
      }
    } finally {
      dispatch(setAnalyticsLoading(false));
    }
  };

  const handleRefresh = useCallback(async () => {
    await loadVesselAnalytics(true);
  }, [selectedVessel, selectedTimeRange]);

  const handleTimeRangeChange = useCallback((range: '7d' | '30d' | '90d' | '1y') => {
    dispatch(setSelectedTimeRange(range));
  }, [dispatch]);

  const handleVesselChange = useCallback((vesselId: string | null) => {
    dispatch(setSelectedVessel(vesselId));
  }, [dispatch]);

  const handleRetry = useCallback(() => {
    dispatch(resetRetryCount());
    loadVesselAnalytics(true);
  }, []);

  const formatCurrency = (amount: number, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return 'trending-up';
      case 'down':
        return 'trending-down';
      default:
        return 'trending-flat';
    }
  };

  const getTrendColor = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return '#ef4444';
      case 'down':
        return '#22c55e';
      default:
        return '#64748b';
    }
  };

  if (analyticsLoading && !vesselAnalytics) {
    return (
      <View style={styles.container}>
        <LoadingSpinner message="Loading vessel analytics..." />
      </View>
    );
  }

  if (analyticsError && !vesselAnalytics) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to Load Analytics</Text>
          <Text style={styles.errorMessage}>{analyticsError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <MotionInteractions
        enableShakeToRefresh={true}
        enableMotionFeedback={true}
        onShakeDetected={handleRefresh}
      >
        <View style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={
            <RefreshControl
              refreshing={analyticsLoading}
              onRefresh={handleRefresh}
              colors={['#1e40af']}
            />
          }>
          
          {/* Header Controls */}
          <View style={styles.headerControls}>
            <VesselSelector
              vessels={vessels}
              selectedVessel={selectedVessel}
              onVesselChange={handleVesselChange}
            />
            <TimeRangeSelector
              selectedRange={selectedTimeRange}
              onRangeChange={handleTimeRangeChange}
            />
            
            {/* Connection Status */}
            <View style={styles.connectionStatus}>
              <Icon
                name={isWebSocketConnected ? 'wifi' : 'wifi-off'}
                size={16}
                color={isWebSocketConnected ? '#22c55e' : '#ef4444'}
              />
              <Text style={[
                styles.connectionText,
                { color: isWebSocketConnected ? '#22c55e' : '#ef4444' }
              ]}>
                {isWebSocketConnected ? 'Live Updates' : 'Offline'}
              </Text>
            </View>
          </View>

          {vesselAnalytics && (
            <>
              {/* Vessel Info Card */}
              <View style={styles.vesselInfoCard}>
                <View style={styles.vesselInfoHeader}>
                  <Icon name="directions-boat" size={24} color="#1e40af" />
                  <Text style={styles.vesselName}>{vesselAnalytics.vesselInfo.name}</Text>
                </View>
                <View style={styles.vesselInfoDetails}>
                  <Text style={styles.vesselInfoText}>
                    Type: {vesselAnalytics.vesselInfo.type}
                  </Text>
                  <Text style={styles.vesselInfoText}>
                    Location: {vesselAnalytics.vesselInfo.currentLocation}
                  </Text>
                  <Text style={styles.vesselInfoText}>
                    Status: {vesselAnalytics.vesselInfo.status}
                  </Text>
                  <Text style={styles.vesselInfoText}>
                    IMO: {vesselAnalytics.vesselInfo.imoNumber}
                  </Text>
                </View>
              </View>

              {/* Spending Metrics */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Spending Overview</Text>
                <View style={styles.metricsGrid}>
                  <MetricCard
                    title="Total Spend"
                    value={formatCurrency(vesselAnalytics.spendingMetrics.totalSpend, vesselAnalytics.spendingMetrics.currency)}
                    icon="attach-money"
                    color="#1e40af"
                  />
                  <MetricCard
                    title="Monthly Average"
                    value={formatCurrency(vesselAnalytics.spendingMetrics.monthlyAverage, vesselAnalytics.spendingMetrics.currency)}
                    icon="trending-up"
                    color="#059669"
                  />
                  <MetricCard
                    title="Budget Utilization"
                    value={formatPercentage(vesselAnalytics.spendingMetrics.budgetUtilization)}
                    icon="pie-chart"
                    color="#dc2626"
                  />
                  <MetricCard
                    title="Cost Per Day"
                    value={formatCurrency(vesselAnalytics.spendingMetrics.costPerDay, vesselAnalytics.spendingMetrics.currency)}
                    icon="today"
                    color="#7c3aed"
                  />
                </View>
              </View>

              {/* Performance Metrics */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Performance Metrics</Text>
                <View style={styles.metricsGrid}>
                  <MetricCard
                    title="Avg Cycle Time"
                    value={`${vesselAnalytics.performanceMetrics.avgCycleTime} days`}
                    icon="schedule"
                    color="#ea580c"
                  />
                  <MetricCard
                    title="On-Time Delivery"
                    value={formatPercentage(vesselAnalytics.performanceMetrics.onTimeDelivery)}
                    icon="check-circle"
                    color="#16a34a"
                  />
                  <MetricCard
                    title="Emergency Orders"
                    value={vesselAnalytics.performanceMetrics.emergencyRequisitions.toString()}
                    icon="warning"
                    color="#dc2626"
                  />
                  <MetricCard
                    title="Vendor Rating"
                    value={`${vesselAnalytics.performanceMetrics.vendorRating}/5.0`}
                    icon="star"
                    color="#ca8a04"
                  />
                </View>
              </View>

              {/* Environmental Monitoring */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Environmental Monitoring</Text>
                <EnvironmentalMonitor
                  vesselId={selectedVessel}
                  onDataUpdate={(data) => {
                    // Update vessel analytics with environmental data
                    dispatch(updateVesselAnalyticsRealTime({
                      environmentalData: data,
                      timestamp: new Date().toISOString(),
                    }));
                  }}
                  showControls={true}
                />
              </View>

              {/* Category Breakdown */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Spending by Category</Text>
                <View style={styles.categoryList}>
                  {vesselAnalytics.categoryBreakdown.map((category, index) => (
                    <View key={index} style={styles.categoryItem}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryName}>{category.category}</Text>
                        <View style={styles.categoryTrend}>
                          <Icon
                            name={getTrendIcon(category.trend)}
                            size={16}
                            color={getTrendColor(category.trend)}
                          />
                          <Text style={styles.categoryAmount}>
                            {formatCurrency(category.amount, vesselAnalytics.spendingMetrics.currency)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.categoryDetails}>
                        <Text style={styles.categoryPercentage}>
                          {formatPercentage(category.percentage)} of total spend
                        </Text>
                        <Text style={styles.categoryOrders}>
                          {category.orderCount} orders
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${category.percentage}%` }
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Spend Trend Chart */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Spending Trend</Text>
                <DashboardChart
                  data={vesselAnalytics.spendTrend}
                  type="line"
                  xKey="period"
                  yKey="amount"
                  color="#1e40af"
                  height={200}
                />
              </View>

              {/* Top Categories */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Categories</Text>
                <View style={styles.topCategoriesList}>
                  {vesselAnalytics.topCategories.map((category, index) => (
                    <View key={index} style={styles.topCategoryItem}>
                      <View style={styles.topCategoryRank}>
                        <Text style={styles.rankNumber}>{index + 1}</Text>
                      </View>
                      <View style={styles.topCategoryInfo}>
                        <Text style={styles.topCategoryName}>{category.name}</Text>
                        <Text style={styles.topCategoryStats}>
                          {formatCurrency(category.amount, vesselAnalytics.spendingMetrics.currency)} • {category.count} orders
                        </Text>
                      </View>
                      <Text style={styles.topCategoryPercentage}>
                        {formatPercentage(category.percentage)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* Top Vendors */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Vendors</Text>
                <View style={styles.topVendorsList}>
                  {vesselAnalytics.topVendors.map((vendor, index) => (
                    <View key={vendor.id} style={styles.topVendorItem}>
                      <View style={styles.topVendorRank}>
                        <Text style={styles.rankNumber}>{index + 1}</Text>
                      </View>
                      <View style={styles.topVendorInfo}>
                        <Text style={styles.topVendorName}>{vendor.name}</Text>
                        <Text style={styles.topVendorStats}>
                          {formatCurrency(vendor.amount, vesselAnalytics.spendingMetrics.currency)} • {vendor.orderCount} orders
                        </Text>
                      </View>
                      <View style={styles.vendorRating}>
                        <Icon name="star" size={16} color="#ca8a04" />
                        <Text style={styles.ratingText}>
                          {vendor.performanceScore.toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Alerts */}
              {vesselAnalytics.alerts.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Alerts</Text>
                  <View style={styles.alertsList}>
                    {vesselAnalytics.alerts.map((alert) => (
                      <View
                        key={alert.id}
                        style={[
                          styles.alertItem,
                          { borderLeftColor: alert.severity === 'high' ? '#ef4444' : alert.severity === 'medium' ? '#f59e0b' : '#64748b' }
                        ]}>
                        <Icon
                          name={alert.type === 'budget' ? 'account-balance-wallet' : 
                                alert.type === 'performance' ? 'trending-down' :
                                alert.type === 'delivery' ? 'local-shipping' : 'warning'}
                          size={20}
                          color={alert.severity === 'high' ? '#ef4444' : alert.severity === 'medium' ? '#f59e0b' : '#64748b'}
                        />
                        <View style={styles.alertContent}>
                          <Text style={styles.alertMessage}>{alert.message}</Text>
                          <Text style={styles.alertTimestamp}>
                            {new Date(alert.timestamp).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Loading Overlay */}
        {analyticsLoading && vesselAnalytics && (
          <LoadingSpinner overlay message="Updating analytics..." />
        )}
      </View>
      </MotionInteractions>
    </ErrorBoundary>
  );
        }
;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  headerControls: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  connectionText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '500',
  },
  vesselInfoCard: {
    backgroundColor: '#ffffff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  vesselInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  vesselName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginLeft: 8,
  },
  vesselInfoDetails: {
    gap: 4,
  },
  vesselInfoText: {
    fontSize: 14,
    color: '#64748b',
  },
  section: {
    backgroundColor: '#ffffff',
    margin: 16,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryList: {
    gap: 12,
  },
  categoryItem: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  categoryTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  categoryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryPercentage: {
    fontSize: 12,
    color: '#64748b',
  },
  categoryOrders: {
    fontSize: 12,
    color: '#64748b',
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#1e40af',
    borderRadius: 2,
  },
  topCategoriesList: {
    gap: 8,
  },
  topCategoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topCategoryRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e40af',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  topCategoryInfo: {
    flex: 1,
  },
  topCategoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  topCategoryStats: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  topCategoryPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  topVendorsList: {
    gap: 8,
  },
  topVendorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  topVendorRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  topVendorInfo: {
    flex: 1,
  },
  topVendorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  topVendorStats: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  vendorRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ca8a04',
  },
  alertsList: {
    gap: 8,
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderLeftWidth: 4,
    gap: 12,
  },
  alertContent: {
    flex: 1,
  },
  alertMessage: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  alertTimestamp: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#1e40af',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default VesselAnalyticsScreen;