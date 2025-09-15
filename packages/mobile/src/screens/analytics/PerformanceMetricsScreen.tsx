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

type PerformanceMetricsScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'PerformanceMetrics'>;

interface Props {
  navigation: PerformanceMetricsScreenNavigationProp;
}

interface PerformanceMetricsData {
  cycleTimeMetrics: {
    averageCycleTime: number;
    medianCycleTime: number;
    cycleTimeByStage: Array<{
      stage: string;
      averageTime: number;
      percentage: number;
    }>;
    cycleTimeTrend: Array<{
      period: string;
      averageTime: number;
      count: number;
    }>;
  };
  deliveryMetrics: {
    onTimeDeliveryRate: number;
    averageDeliveryTime: number;
    deliveryPerformanceTrend: Array<{
      period: string;
      onTimeRate: number;
      totalDeliveries: number;
    }>;
    deliveryByPort: Array<{
      portName: string;
      onTimeRate: number;
      averageTime: number;
      totalDeliveries: number;
    }>;
  };
  requisitionMetrics: {
    totalRequisitions: number;
    emergencyRequisitions: number;
    emergencyRate: number;
    approvalMetrics: {
      averageApprovalTime: number;
      autoApprovalRate: number;
      rejectionRate: number;
    };
    requisitionsByUrgency: Array<{
      urgency: string;
      count: number;
      percentage: number;
    }>;
  };
  vendorMetrics: {
    averageVendorRating: number;
    topPerformingVendors: Array<{
      vendorId: string;
      vendorName: string;
      performanceScore: number;
      onTimeRate: number;
      qualityScore: number;
    }>;
    vendorPerformanceTrend: Array<{
      period: string;
      averageScore: number;
      vendorCount: number;
    }>;
  };
  bottlenecks: Array<{
    stage: string;
    averageDelay: number;
    frequency: number;
    impact: 'high' | 'medium' | 'low';
    recommendations: string[];
  }>;
}

const {width: screenWidth} = Dimensions.get('window');

const PerformanceMetricsScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useDispatch();
  const {
    selectedTimeRange,
    selectedVessel,
    analyticsLoading,
    analyticsError,
  } = useSelector((state: RootState) => state.dashboard);
  const {user} = useSelector((state: RootState) => state.auth);
  const vessels = user?.vessels || [];

  const [performanceData, setPerformanceData] = useState<PerformanceMetricsData | null>(null);

  useEffect(() => {
    loadPerformanceMetrics();
  }, [selectedVessel, selectedTimeRange]);

  const loadPerformanceMetrics = async (forceRefresh = false) => {
    dispatch(setAnalyticsLoading(true));
    dispatch(setAnalyticsError(null));

    try {
      const filters = buildFilters();
      const response = await analyticsApiService.getOperationalMetrics(filters);

      if (response.success && response.data) {
        setPerformanceData(response.data);
      } else {
        throw new Error(response.error || 'Failed to load performance metrics');
      }
    } catch (error) {
      console.error('Error loading performance metrics:', error);
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
    await loadPerformanceMetrics(true);
  }, [selectedVessel, selectedTimeRange]);

  const handleTimeRangeChange = useCallback((range: '7d' | '30d' | '90d' | '1y') => {
    dispatch(setSelectedTimeRange(range));
  }, [dispatch]);

  const handleVesselChange = useCallback((vesselId: string | null) => {
    dispatch(setSelectedVessel(vesselId));
  }, [dispatch]);

  const formatDays = (days: number) => {
    return `${days.toFixed(1)} days`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getImpactColor = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      default:
        return '#22c55e';
    }
  };

  const getImpactIcon = (impact: 'high' | 'medium' | 'low') => {
    switch (impact) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'check-circle';
    }
  };

  if (analyticsLoading && !performanceData) {
    return (
      <View style={styles.container}>
        <LoadingSpinner message="Loading performance metrics..." />
      </View>
    );
  }

  if (analyticsError && !performanceData) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color="#ef4444" />
          <Text style={styles.errorTitle}>Failed to Load Metrics</Text>
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

          {performanceData && (
            <>
              {/* Key Performance Indicators */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
                <View style={styles.metricsGrid}>
                  <MetricCard
                    title="Avg Cycle Time"
                    value={formatDays(performanceData.cycleTimeMetrics.averageCycleTime)}
                    change={formatDays(performanceData.cycleTimeMetrics.medianCycleTime)}
                    changeType="positive"
                    icon="schedule"
                    color="#1e40af"
                  />
                  <MetricCard
                    title="On-Time Delivery"
                    value={formatPercentage(performanceData.deliveryMetrics.onTimeDeliveryRate)}
                    change={formatDays(performanceData.deliveryMetrics.averageDeliveryTime)}
                    changeType="positive"
                    icon="check-circle"
                    color="#059669"
                  />
                  <MetricCard
                    title="Emergency Rate"
                    value={formatPercentage(performanceData.requisitionMetrics.emergencyRate)}
                    change={performanceData.requisitionMetrics.emergencyRequisitions.toString()}
                    changeType="negative"
                    icon="warning"
                    color="#dc2626"
                  />
                  <MetricCard
                    title="Vendor Rating"
                    value={`${performanceData.vendorMetrics.averageVendorRating.toFixed(1)}/5.0`}
                    change={formatPercentage(performanceData.requisitionMetrics.approvalMetrics.autoApprovalRate)}
                    changeType="positive"
                    icon="star"
                    color="#7c3aed"
                  />
                </View>
              </View>

              {/* Cycle Time Analysis */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Cycle Time Analysis</Text>
                <DashboardChart
                  type="line"
                  data={performanceData.cycleTimeMetrics.cycleTimeTrend.map(item => ({
                    label: item.period,
                    value: item.averageTime,
                  }))}
                  color="#1e40af"
                />
                
                <View style={styles.stagesList}>
                  <Text style={styles.subsectionTitle}>Time by Stage</Text>
                  {performanceData.cycleTimeMetrics.cycleTimeByStage.map((stage, index) => (
                    <View key={stage.stage} style={styles.stageItem}>
                      <View style={styles.stageHeader}>
                        <Text style={styles.stageName}>{stage.stage}</Text>
                        <Text style={styles.stageTime}>{formatDays(stage.averageTime)}</Text>
                      </View>
                      <View style={styles.stageDetails}>
                        <Text style={styles.stagePercentage}>
                          {formatPercentage(stage.percentage)} of total cycle time
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { width: `${stage.percentage}%` }
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Delivery Performance */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Delivery Performance</Text>
                <DashboardChart
                  type="line"
                  data={performanceData.deliveryMetrics.deliveryPerformanceTrend.map(item => ({
                    label: item.period,
                    value: item.onTimeRate,
                  }))}
                  color="#059669"
                />
                
                <View style={styles.portsList}>
                  <Text style={styles.subsectionTitle}>Performance by Port</Text>
                  {performanceData.deliveryMetrics.deliveryByPort.map((port, index) => (
                    <View key={port.portName} style={styles.portItem}>
                      <View style={styles.portHeader}>
                        <View style={styles.portInfo}>
                          <Icon name="location-on" size={20} color="#1e40af" />
                          <Text style={styles.portName}>{port.portName}</Text>
                        </View>
                        <Text style={styles.portRate}>
                          {formatPercentage(port.onTimeRate)}
                        </Text>
                      </View>
                      <View style={styles.portDetails}>
                        <Text style={styles.portStats}>
                          Avg: {formatDays(port.averageTime)} • {port.totalDeliveries} deliveries
                        </Text>
                      </View>
                      <View style={styles.progressBar}>
                        <View
                          style={[
                            styles.progressFill,
                            { 
                              width: `${port.onTimeRate}%`,
                              backgroundColor: port.onTimeRate >= 90 ? '#22c55e' : port.onTimeRate >= 70 ? '#f59e0b' : '#ef4444'
                            }
                          ]}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Requisition Analysis */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Requisition Analysis</Text>
                <View style={styles.requisitionMetrics}>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Total Requisitions</Text>
                    <Text style={styles.metricValue}>{performanceData.requisitionMetrics.totalRequisitions}</Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Emergency Requisitions</Text>
                    <Text style={[styles.metricValue, {color: '#dc2626'}]}>
                      {performanceData.requisitionMetrics.emergencyRequisitions}
                    </Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Avg Approval Time</Text>
                    <Text style={styles.metricValue}>
                      {formatDays(performanceData.requisitionMetrics.approvalMetrics.averageApprovalTime)}
                    </Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Auto-Approval Rate</Text>
                    <Text style={[styles.metricValue, {color: '#059669'}]}>
                      {formatPercentage(performanceData.requisitionMetrics.approvalMetrics.autoApprovalRate)}
                    </Text>
                  </View>
                  <View style={styles.metricRow}>
                    <Text style={styles.metricLabel}>Rejection Rate</Text>
                    <Text style={[styles.metricValue, {color: '#dc2626'}]}>
                      {formatPercentage(performanceData.requisitionMetrics.approvalMetrics.rejectionRate)}
                    </Text>
                  </View>
                </View>

                <DashboardChart
                  type="pie"
                  data={performanceData.requisitionMetrics.requisitionsByUrgency.map(item => ({
                    label: item.urgency,
                    value: item.count,
                    color: item.urgency === 'EMERGENCY' ? '#dc2626' : 
                           item.urgency === 'URGENT' ? '#f59e0b' : '#22c55e',
                  }))}
                />
              </View>

              {/* Vendor Performance */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Vendor Performance</Text>
                <DashboardChart
                  type="line"
                  data={performanceData.vendorMetrics.vendorPerformanceTrend.map(item => ({
                    label: item.period,
                    value: item.averageScore,
                  }))}
                  color="#7c3aed"
                />
                
                <View style={styles.vendorsList}>
                  <Text style={styles.subsectionTitle}>Top Performing Vendors</Text>
                  {performanceData.vendorMetrics.topPerformingVendors.map((vendor, index) => (
                    <View key={vendor.vendorId} style={styles.vendorItem}>
                      <View style={styles.vendorRank}>
                        <Text style={styles.rankNumber}>{index + 1}</Text>
                      </View>
                      <View style={styles.vendorInfo}>
                        <Text style={styles.vendorName}>{vendor.vendorName}</Text>
                        <Text style={styles.vendorStats}>
                          Score: {vendor.performanceScore.toFixed(1)} • On-time: {formatPercentage(vendor.onTimeRate)}
                        </Text>
                      </View>
                      <View style={styles.vendorRating}>
                        <Icon name="star" size={16} color="#ca8a04" />
                        <Text style={styles.ratingText}>
                          {vendor.qualityScore.toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>

              {/* Bottleneck Analysis */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Bottleneck Analysis</Text>
                <View style={styles.bottlenecksList}>
                  {performanceData.bottlenecks.map((bottleneck, index) => (
                    <View key={bottleneck.stage} style={styles.bottleneckItem}>
                      <View style={styles.bottleneckHeader}>
                        <View style={styles.bottleneckInfo}>
                          <Icon
                            name={getImpactIcon(bottleneck.impact)}
                            size={20}
                            color={getImpactColor(bottleneck.impact)}
                          />
                          <Text style={styles.bottleneckStage}>{bottleneck.stage}</Text>
                        </View>
                        <View style={styles.bottleneckMetrics}>
                          <Text style={styles.bottleneckDelay}>
                            +{formatDays(bottleneck.averageDelay)}
                          </Text>
                          <Text style={styles.bottleneckFrequency}>
                            {bottleneck.frequency}% frequency
                          </Text>
                        </View>
                      </View>
                      <View style={styles.recommendationsList}>
                        {bottleneck.recommendations.map((recommendation, recIndex) => (
                          <View key={recIndex} style={styles.recommendationItem}>
                            <Icon name="lightbulb-outline" size={16} color="#64748b" />
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
        {analyticsLoading && performanceData && (
          <LoadingSpinner overlay message="Updating metrics..." />
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
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
    marginTop: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  stagesList: {
    marginTop: 16,
  },
  stageItem: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  stageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stageName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  stageTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  stageDetails: {
    marginBottom: 8,
  },
  stagePercentage: {
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
  portsList: {
    marginTop: 16,
  },
  portItem: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  portHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  portInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  portName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  portRate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#059669',
  },
  portDetails: {
    marginBottom: 8,
  },
  portStats: {
    fontSize: 12,
    color: '#64748b',
  },
  requisitionMetrics: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  metricLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  vendorsList: {
    marginTop: 16,
  },
  vendorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  vendorRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7c3aed',
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
  bottlenecksList: {
    gap: 12,
  },
  bottleneckItem: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  bottleneckHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  bottleneckInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bottleneckStage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  bottleneckMetrics: {
    alignItems: 'flex-end',
  },
  bottleneckDelay: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  bottleneckFrequency: {
    fontSize: 12,
    color: '#64748b',
  },
  recommendationsList: {
    gap: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
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

export default PerformanceMetricsScreen;