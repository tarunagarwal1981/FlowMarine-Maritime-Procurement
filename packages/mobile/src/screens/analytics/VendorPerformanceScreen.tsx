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
import {analyticsApiService} from '../../services/api/analyticsApiService';

type VendorPerformanceScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'VendorPerformance'>;

interface Props {
  navigation: VendorPerformanceScreenNavigationProp;
}

interface VendorPerformanceData {
  overview: {
    totalVendors: number;
    activeVendors: number;
    averageRating: number;
    totalOrders: number;
    totalSpend: number;
    currency: string;
  };
  topVendors: Array<{
    vendorId: string;
    vendorName: string;
    overallScore: number;
    deliveryScore: number;
    qualityScore: number;
    priceScore: number;
    totalOrders: number;
    totalSpend: number;
    onTimeDeliveryRate: number;
    averageDeliveryTime: number;
    defectRate: number;
    responseTime: number;
    trend: 'improving' | 'declining' | 'stable';
  }>;
  performanceMetrics: {
    deliveryPerformance: {
      averageOnTimeRate: number;
      averageDeliveryTime: number;
      deliveryTrend: Array<{
        period: string;
        onTimeRate: number;
        averageTime: number;
      }>;
    };
    qualityMetrics: {
      averageQualityScore: number;
      defectRate: number;
      qualityTrend: Array<{
        period: string;
        qualityScore: number;
        defectRate: number;
      }>;
    };
    priceCompetitiveness: {
      averagePriceScore: number;
      costSavings: number;
      priceTrend: Array<{
        period: string;
        averagePrice: number;
        marketPrice: number;
      }>;
    };
  };
  vendorCategories: Array<{
    category: string;
    vendorCount: number;
    averageScore: number;
    totalSpend: number;
    topVendor: {
      name: string;
      score: number;
    };
  }>;
  riskAssessment: Array<{
    vendorId: string;
    vendorName: string;
    riskLevel: 'high' | 'medium' | 'low';
    riskFactors: string[];
    recommendations: string[];
    financialStability: number;
    dependencyLevel: number;
  }>;
}

const {width: screenWidth} = Dimensions.get('window');

const VendorPerformanceScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useDispatch();
  const {
    selectedTimeRange,
    selectedVessel,
    analyticsLoading,
    analyticsError,
  } = useSelector((state: RootState) => state.dashboard);
  const {user} = useSelector((state: RootState) => state.auth);
  const vessels = user?.vessels || [];

  const [vendorData, setVendorData] = useState<VendorPerformanceData | null>(null);

  useEffect(() => {
    loadVendorPerformance();
  }, [selectedVessel, selectedTimeRange]);

  const loadVendorPerformance = async (forceRefresh = false) => {
    dispatch(setAnalyticsLoading(true));
    dispatch(setAnalyticsError(null));

    try {
      const filters = buildFilters();
      const response = await analyticsApiService.getVendorPerformance(filters);

      if (response.success && response.data) {
        setVendorData(response.data);
      } else {
        throw new Error(response.error || 'Failed to load vendor performance');
      }
    } catch (error) {
      console.error('Error loading vendor performance:', error);
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
    await loadVendorPerformance(true);
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

  const formatDays = (days: number) => {
    return `${days.toFixed(1)} days`;
  };

  const getTrendIcon = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving':
        return 'trending-up';
      case 'declining':
        return 'trending-down';
      default:
        return 'trending-flat';
    }
  };

  const getTrendColor = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving':
        return '#22c55e';
      case 'declining':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const getRiskColor = (risk: 'high' | 'medium' | 'low') => {
    switch (risk) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      default:
        return '#22c55e';
    }
  };

  const getRiskIcon = (risk: 'high' | 'medium' | 'low') => {
    switch (risk) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'check-circle';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 4.0) return '#22c55e';
    if (score >= 3.0) return '#f59e0b';
    return '#ef4444';
  };

  if (analyticsLoading && !vendorData) {
    return (
      <View style={styles.container}>
        <LoadingSpinner message="Loading vendor performance..." />
      </View>
    );
  }

  if (analyticsError && !vendorData) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to Load Performance Data</Text>
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

          {vendorData && (
            <>
              {/* Overview Metrics */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vendor Overview</Text>
                <View style={styles.metricsGrid}>
                  <MetricCard
                    title="Total Vendors"
                    value={vendorData.overview.totalVendors.toString()}
                    change={vendorData.overview.activeVendors.toString()}
                    changeType="positive"
                    icon="business"
                    color="#1e40af"
                  />
                  <MetricCard
                    title="Avg Rating"
                    value={`${vendorData.overview.averageRating.toFixed(1)}/5.0`}
                    change={vendorData.overview.totalOrders.toString()}
                    changeType="positive"
                    icon="star"
                    color="#059669"
                  />
                  <MetricCard
                    title="Total Spend"
                    value={formatCurrency(vendorData.overview.totalSpend, vendorData.overview.currency)}
                    change={formatPercentage(vendorData.performanceMetrics.deliveryPerformance.averageOnTimeRate)}
                    changeType="positive"
                    icon="attach-money"
                    color="#dc2626"
                  />
                  <MetricCard
                    title="Active Vendors"
                    value={vendorData.overview.activeVendors.toString()}
                    change={formatPercentage(vendorData.performanceMetrics.qualityMetrics.averageQualityScore * 20)}
                    changeType="positive"
                    icon="verified"
                    color="#7c3aed"
                  />
                </View>
              </View>

              {/* Top Performing Vendors */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Top Performing Vendors</Text>
                <View style={styles.vendorsList}>
                  {vendorData.topVendors.map((vendor, index) => (
                    <View key={vendor.vendorId} style={styles.vendorCard}>
                      <View style={styles.vendorHeader}>
                        <View style={styles.vendorRank}>
                          <Text style={styles.rankNumber}>{index + 1}</Text>
                        </View>
                        <View style={styles.vendorInfo}>
                          <Text style={styles.vendorName}>{vendor.vendorName}</Text>
                          <View style={styles.vendorTrend}>
                            <Icon
                              name={getTrendIcon(vendor.trend)}
                              size={16}
                              color={getTrendColor(vendor.trend)}
                            />
                            <Text style={[styles.trendText, {color: getTrendColor(vendor.trend)}]}>
                              {vendor.trend}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.overallScore}>
                          <Text style={[styles.scoreValue, {color: getScoreColor(vendor.overallScore)}]}>
                            {vendor.overallScore.toFixed(1)}
                          </Text>
                          <Text style={styles.scoreLabel}>Overall</Text>
                        </View>
                      </View>

                      <View style={styles.vendorMetrics}>
                        <View style={styles.metricItem}>
                          <Text style={styles.metricLabel}>Delivery</Text>
                          <Text style={[styles.metricValue, {color: getScoreColor(vendor.deliveryScore)}]}>
                            {vendor.deliveryScore.toFixed(1)}
                          </Text>
                        </View>
                        <View style={styles.metricItem}>
                          <Text style={styles.metricLabel}>Quality</Text>
                          <Text style={[styles.metricValue, {color: getScoreColor(vendor.qualityScore)}]}>
                            {vendor.qualityScore.toFixed(1)}
                          </Text>
                        </View>
                        <View style={styles.metricItem}>
                          <Text style={styles.metricLabel}>Price</Text>
                          <Text style={[styles.metricValue, {color: getScoreColor(vendor.priceScore)}]}>
                            {vendor.priceScore.toFixed(1)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.vendorStats}>
                        <View style={styles.statItem}>
                          <Icon name="shopping-cart" size={16} color="#64748b" />
                          <Text style={styles.statText}>{vendor.totalOrders} orders</Text>
                        </View>
                        <View style={styles.statItem}>
                          <Icon name="attach-money" size={16} color="#64748b" />
                          <Text style={styles.statText}>
                            {formatCurrency(vendor.totalSpend, vendorData.overview.currency)}
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Icon name="schedule" size={16} color="#64748b" />
                          <Text style={styles.statText}>
                            {formatPercentage(vendor.onTimeDeliveryRate)} on-time
                          </Text>
                        </View>
                        <View style={styles.statItem}>
                          <Icon name="timer" size={16} color="#64748b" />
                          <Text style={styles.statText}>
                            {formatDays(vendor.averageDeliveryTime)} avg
                          </Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Performance Trends */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Performance Trends</Text>
                
                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Delivery Performance</Text>
                  <DashboardChart
                    type="line"
                    data={vendorData.performanceMetrics.deliveryPerformance.deliveryTrend.map(item => ({
                      label: item.period,
                      value: item.onTimeRate,
                    }))}
                    color="#059669"
                  />
                </View>

                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Quality Metrics</Text>
                  <DashboardChart
                    type="line"
                    data={vendorData.performanceMetrics.qualityMetrics.qualityTrend.map(item => ({
                      label: item.period,
                      value: item.qualityScore * 20, // Convert to percentage
                    }))}
                    color="#7c3aed"
                  />
                </View>

                <View style={styles.chartContainer}>
                  <Text style={styles.chartTitle}>Price Competitiveness</Text>
                  <DashboardChart
                    type="comparison"
                    data={vendorData.performanceMetrics.priceCompetitiveness.priceTrend.map(item => ({
                      label: item.period,
                      budget: item.marketPrice,
                      actual: item.averagePrice,
                    }))}
                  />
                </View>
              </View>

              {/* Vendor Categories */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Performance by Category</Text>
                <View style={styles.categoriesList}>
                  {vendorData.vendorCategories.map((category, index) => (
                    <View key={category.category} style={styles.categoryCard}>
                      <View style={styles.categoryHeader}>
                        <Text style={styles.categoryName}>{category.category}</Text>
                        <Text style={[styles.categoryScore, {color: getScoreColor(category.averageScore)}]}>
                          {category.averageScore.toFixed(1)}
                        </Text>
                      </View>
                      <View style={styles.categoryStats}>
                        <Text style={styles.categoryStatText}>
                          {category.vendorCount} vendors • {formatCurrency(category.totalSpend, vendorData.overview.currency)}
                        </Text>
                        <Text style={styles.topVendorText}>
                          Top: {category.topVendor.name} ({category.topVendor.score.toFixed(1)})
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Risk Assessment */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Risk Assessment</Text>
                <View style={styles.riskList}>
                  {vendorData.riskAssessment.map((risk, index) => (
                    <View key={risk.vendorId} style={styles.riskCard}>
                      <View style={styles.riskHeader}>
                        <View style={styles.riskInfo}>
                          <Icon
                            name={getRiskIcon(risk.riskLevel)}
                            size={20}
                            color={getRiskColor(risk.riskLevel)}
                          />
                          <Text style={styles.riskVendorName}>{risk.vendorName}</Text>
                        </View>
                        <View style={[styles.riskBadge, {backgroundColor: getRiskColor(risk.riskLevel)}]}>
                          <Text style={styles.riskBadgeText}>{risk.riskLevel.toUpperCase()}</Text>
                        </View>
                      </View>

                      <View style={styles.riskMetrics}>
                        <View style={styles.riskMetricItem}>
                          <Text style={styles.riskMetricLabel}>Financial Stability</Text>
                          <View style={styles.riskProgressBar}>
                            <View
                              style={[
                                styles.riskProgressFill,
                                { 
                                  width: `${risk.financialStability}%`,
                                  backgroundColor: risk.financialStability >= 70 ? '#22c55e' : 
                                                 risk.financialStability >= 40 ? '#f59e0b' : '#ef4444'
                                }
                              ]}
                            />
                          </View>
                          <Text style={styles.riskMetricValue}>{risk.financialStability}%</Text>
                        </View>
                        <View style={styles.riskMetricItem}>
                          <Text style={styles.riskMetricLabel}>Dependency Level</Text>
                          <View style={styles.riskProgressBar}>
                            <View
                              style={[
                                styles.riskProgressFill,
                                { 
                                  width: `${risk.dependencyLevel}%`,
                                  backgroundColor: risk.dependencyLevel <= 30 ? '#22c55e' : 
                                                 risk.dependencyLevel <= 60 ? '#f59e0b' : '#ef4444'
                                }
                              ]}
                            />
                          </View>
                          <Text style={styles.riskMetricValue}>{risk.dependencyLevel}%</Text>
                        </View>
                      </View>

                      <View style={styles.riskFactors}>
                        <Text style={styles.riskFactorsTitle}>Risk Factors:</Text>
                        {risk.riskFactors.map((factor, factorIndex) => (
                          <View key={factorIndex} style={styles.riskFactorItem}>
                            <Icon name="warning" size={14} color="#f59e0b" />
                            <Text style={styles.riskFactorText}>{factor}</Text>
                          </View>
                        ))}
                      </View>

                      <View style={styles.recommendations}>
                        <Text style={styles.recommendationsTitle}>Recommendations:</Text>
                        {risk.recommendations.map((recommendation, recIndex) => (
                          <View key={recIndex} style={styles.recommendationItem}>
                            <Icon name="lightbulb-outline" size={14} color="#1e40af" />
                            <Text style={styles.recommendationText}>{recommendation}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {/* Loading Overlay */}
        {analyticsLoading && vendorData && (
          <LoadingSpinner overlay message="Updating performance data..." />
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
  vendorsList: {
    gap: 16,
  },
  vendorCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
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
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  vendorTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  overallScore: {
    alignItems: 'center',
  },
  scoreValue: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  scoreLabel: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  vendorMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  vendorStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 12,
    color: '#64748b',
  },
  chartContainer: {
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  categoriesList: {
    gap: 12,
  },
  categoryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
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
  categoryScore: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoryStats: {
    gap: 4,
  },
  categoryStatText: {
    fontSize: 12,
    color: '#64748b',
  },
  topVendorText: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
  },
  riskList: {
    gap: 16,
  },
  riskCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  riskHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  riskInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskVendorName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  riskMetrics: {
    gap: 12,
    marginBottom: 12,
  },
  riskMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  riskMetricLabel: {
    fontSize: 12,
    color: '#64748b',
    width: 100,
  },
  riskProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  riskProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  riskMetricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    width: 40,
    textAlign: 'right',
  },
  riskFactors: {
    marginBottom: 12,
  },
  riskFactorsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  riskFactorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  riskFactorText: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
  },
  recommendations: {
    marginTop: 8,
  },
  recommendationsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 4,
  },
  recommendationText: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
    lineHeight: 16,
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

export default VendorPerformanceScreen;