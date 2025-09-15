import React, {useEffect, useState, useCallback} from 'react';
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
import Icon from 'react-native-vector-icons/MaterialIcons';
import {RootState} from '../../store/index';
import {HomeStackParamList} from '../../navigation/stacks/HomeStackNavigator';
import {
  setAnalyticsLoading,
  setAnalyticsError,
  setSelectedTimeRange,
  setSelectedVessel,
} from '../../store/slices/dashboardSlice';
import DashboardChart from '../../components/dashboard/DashboardChart';
import MetricCard from '../../components/dashboard/MetricCard';
import VesselSelector from '../../components/dashboard/VesselSelector';
import TimeRangeSelector from '../../components/dashboard/TimeRangeSelector';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import {analyticsApiService, SpendAnalyticsData} from '../../services/api/analyticsApiService';

type SpendAnalyticsScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'SpendAnalytics'>;

interface Props {
  navigation: SpendAnalyticsScreenNavigationProp;
}

const {width: screenWidth} = Dimensions.get('window');

const SpendAnalyticsScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useDispatch();
  const {
    selectedTimeRange,
    selectedVessel,
    analyticsLoading,
    analyticsError,
  } = useSelector((state: RootState) => state.dashboard);
  const {user} = useSelector((state: RootState) => state.auth);
  const vessels = user?.vessels || [];

  const [spendData, setSpendData] = useState<SpendAnalyticsData | null>(null);

  useEffect(() => {
    loadSpendAnalytics();
  }, [selectedVessel, selectedTimeRange]);

  const loadSpendAnalytics = async (forceRefresh = false) => {
    dispatch(setAnalyticsLoading(true));
    dispatch(setAnalyticsError(null));

    try {
      const filters = buildFilters();
      const response = await analyticsApiService.getSpendAnalytics(filters);

      if (response.success && response.data) {
        setSpendData(response.data);
      } else {
        throw new Error(response.error || 'Failed to load spend analytics');
      }
    } catch (error) {
      console.error('Error loading spend analytics:', error);
      dispatch(setAnalyticsError(error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      dispatch(setAnalyticsLoading(false));
    }
  };

  const buildFilters = () => {
    const endDate = new Date();
    const startDate = new Date();

    switch (selectedTimeRange) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      vesselIds: selectedVessel ? [selectedVessel] : undefined,
    };
  };

  const handleRefresh = useCallback(async () => {
    await loadSpendAnalytics(true);
  }, [selectedVessel, selectedTimeRange]);

  const handleTimeRangeChange = useCallback((range: '7d' | '30d' | '90d' | '1y') => {
    dispatch(setSelectedTimeRange(range));
  }, [dispatch]);

  const handleVesselChange = useCallback((vesselId: string | null) => {
    dispatch(setSelectedVessel(vesselId));
  }, [dispatch]);

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

  if (analyticsLoading && !spendData) {
    return (
      <View style={styles.container}>
        <LoadingSpinner message="Loading spend analytics..." />
      </View>
    );
  }

  if (analyticsError && !spendData) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to Load Analytics</Text>
          <Text style={styles.errorMessage}>{analyticsError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ErrorBoundary>
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
          </View>

          {spendData && (
            <>
              {/* Overview Metrics */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Spending Overview</Text>
                <View style={styles.metricsGrid}>
                  <MetricCard
                    title="Total Spend"
                    value={formatCurrency(spendData.totalSpend, spendData.currency)}
                    change={formatPercentage(spendData.trends.monthOverMonth)}
                    changeType={spendData.trends.monthOverMonth >= 0 ? 'positive' : 'negative'}
                    icon="attach-money"
                    color="#1e40af"
                  />
                  <MetricCard
                    title="Growth Rate"
                    value={formatPercentage(spendData.trends.growthRate)}
                    change={formatPercentage(spendData.trends.yearOverYear)}
                    changeType={spendData.trends.yearOverYear >= 0 ? 'positive' : 'negative'}
                    icon="trending-up"
                    color="#059669"
                  />
                  <MetricCard
                    title="Monthly Change"
                    value={formatPercentage(spendData.trends.monthOverMonth)}
                    change={formatPercentage(spendData.trends.quarterOverQuarter)}
                    changeType={spendData.trends.quarterOverQuarter >= 0 ? 'positive' : 'negative'}
                    icon="calendar-today"
                    color="#dc2626"
                  />
                  <MetricCard
                    title="Quarterly Change"
                    value={formatPercentage(spendData.trends.quarterOverQuarter)}
                    change={formatPercentage(spendData.trends.yearOverYear)}
                    changeType={spendData.trends.yearOverYear >= 0 ? 'positive' : 'negative'}
                    icon="bar-chart"
                    color="#7c3aed"
                  />
                </View>
              </View>

              {/* Spending by Vessel */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Spending by Vessel</Text>
                <View style={styles.vesselList}>
                  {spendData.breakdown.byVessel.map((vessel, index) => (
                    <View key={vessel.vesselId} style={styles.vesselItem}>
                      <View style={styles.vesselHeader}>
                        <View style={styles.vesselInfo}>
                          <Icon name="directions-boat" size={20} color="#1e40af" />
                          <Text style={styles.vesselName}>{vessel.vesselName}</Text>
                        </View>
                        <View style={styles.vesselTrend}>
                          <Icon
                            name={getTrendIcon(vessel.trend)}
                            size={16}
                            color={getTrendColor(vessel.trend)}
                          />
                          <Text style={styles.vesselAmount}>
                            {formatCurrency(vessel.totalAmount, spendData.currency)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.vesselDetails}>
                        <Text style={styles.vesselPercentage}>
                          {formatPercentage(vessel.percentage)} of total spend
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${vessel.percentage}%` }
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Spending by Category */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Spending by Category</Text>
                <DashboardChart
                  type="pie"
                  data={spendData.breakdown.byCategory.map(category => ({
                    label: category.categoryName,
                    value: category.totalAmount,
                    color: `hsl(${Math.random() * 360}, 70%, 50%)`,
                  }))}
                />
                <View style={styles.categoryList}>
                  {spendData.breakdown.byCategory.map((category, index) => (
                    <View key={category.categoryCode} style={styles.categoryItem}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryName}>{category.categoryName}</Text>
                        <View style={styles.categoryTrend}>
                          <Icon
                            name={getTrendIcon(category.trend)}
                            size={16}
                            color={getTrendColor(category.trend)}
                          />
                          <Text style={styles.categoryAmount}>
                            {formatCurrency(category.totalAmount, spendData.currency)}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.categoryDetails}>
                        <Text style={styles.categoryPercentage}>
                          {formatPercentage(category.percentage)} of total spend
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

              {/* Top Vendors by Spend */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Vendors by Spend</Text>
                <View style={styles.vendorList}>
                  {spendData.breakdown.byVendor.map((vendor, index) => (
                    <View key={vendor.vendorId} style={styles.vendorItem}>
                      <View style={styles.vendorRank}>
                        <Text style={styles.rankNumber}>{index + 1}</Text>
                      </View>
                      <View style={styles.vendorInfo}>
                        <Text style={styles.vendorName}>{vendor.vendorName}</Text>
                        <Text style={styles.vendorStats}>
                          {formatCurrency(vendor.totalAmount, spendData.currency)} • {formatPercentage(vendor.percentage)}
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
            </>
          )}
        </ScrollView>

        {/* Loading Overlay */}
        {analyticsLoading && spendData && (
          <LoadingSpinner overlay message="Updating analytics..." />
        )}
      </View>
    </ErrorBoundary>
  );
};

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
  vesselList: {
    gap: 12,
  },
  vesselItem: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vesselHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vesselInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vesselName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  vesselTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  vesselAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  vesselDetails: {
    marginBottom: 8,
  },
  vesselPercentage: {
    fontSize: 12,
    color: '#64748b',
  },
  categoryList: {
    gap: 12,
    marginTop: 16,
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
    marginBottom: 8,
  },
  categoryPercentage: {
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
  vendorList: {
    gap: 8,
  },
  vendorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vendorRank: {
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
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  vendorStats: {
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

export default SpendAnalyticsScreen;