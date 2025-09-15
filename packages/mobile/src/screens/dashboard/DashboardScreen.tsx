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
import Icon from 'react-native-vector-icons/MaterialIcons';
import {RootState} from '../../store/index';
import {
  setSelectedTimeRange,
  setSelectedVessel,
  refreshDashboard,
} from '../../store/slices/dashboardSlice';
import {HomeStackParamList} from '../../navigation/stacks/HomeStackNavigator';
import DashboardChart from '../../components/dashboard/DashboardChart';
import MetricCard from '../../components/dashboard/MetricCard';
import TimeRangeSelector from '../../components/dashboard/TimeRangeSelector';
import VesselSelector from '../../components/dashboard/VesselSelector';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ErrorBoundary from '../../components/common/ErrorBoundary';

type DashboardScreenNavigationProp = StackNavigationProp<HomeStackParamList, 'Dashboard'>;

interface Props {
  navigation: DashboardScreenNavigationProp;
}

const {width} = Dimensions.get('window');

const DashboardScreen: React.FC<Props> = ({navigation}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'spend' | 'vendors'>('overview');
  
  const dispatch = useDispatch();
  const {
    dashboardData,
    selectedTimeRange,
    selectedVessel,
    isLoading,
    error,
  } = useSelector((state: RootState) => state.dashboard);
  const {user} = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    loadDashboardData();
  }, [selectedTimeRange, selectedVessel]);

  const loadDashboardData = async () => {
    dispatch(refreshDashboard());
    // Implementation would load specific dashboard data based on filters
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const handleTimeRangeChange = (range: '7d' | '30d' | '90d' | '1y') => {
    dispatch(setSelectedTimeRange(range));
  };

  const handleVesselChange = (vesselId: string | null) => {
    dispatch(setSelectedVessel(vesselId));
  };

  const renderOverviewTab = () => (
    <View>
      {/* Key Performance Indicators */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Performance Indicators</Text>
        <View style={styles.kpiGrid}>
          <MetricCard
            title="Total Spend"
            value="$125,000"
            change="+12%"
            changeType="positive"
            icon="attach-money"
            color="#1e40af"
          />
          <MetricCard
            title="Budget Utilization"
            value="68%"
            change="+5%"
            changeType="positive"
            icon="pie-chart"
            color="#059669"
          />
          <MetricCard
            title="Avg. Cycle Time"
            value="4.2 days"
            change="-0.8 days"
            changeType="positive"
            icon="schedule"
            color="#dc2626"
          />
          <MetricCard
            title="Vendor Performance"
            value="92%"
            change="+3%"
            changeType="positive"
            icon="star"
            color="#7c3aed"
          />
        </View>
      </View>

      {/* Spend Trend Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spend Trend</Text>
        <DashboardChart
          type="line"
          data={[
            {label: 'Jan', value: 85000},
            {label: 'Feb', value: 92000},
            {label: 'Mar', value: 78000},
            {label: 'Apr', value: 105000},
            {label: 'May', value: 125000},
          ]}
          color="#1e40af"
        />
      </View>

      {/* Category Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spend by Category</Text>
        <DashboardChart
          type="pie"
          data={[
            {label: 'Engine Parts', value: 45000, color: '#1e40af'},
            {label: 'Deck Equipment', value: 32000, color: '#059669'},
            {label: 'Safety Gear', value: 28000, color: '#dc2626'},
            {label: 'Navigation', value: 20000, color: '#7c3aed'},
          ]}
        />
      </View>
    </View>
  );

  const renderSpendTab = () => (
    <View>
      {/* Spend Analytics */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spend Analytics</Text>
        <View style={styles.analyticsGrid}>
          <MetricCard
            title="Monthly Spend"
            value="$125,000"
            change="+18%"
            changeType="negative"
            icon="trending-up"
            color="#ef4444"
          />
          <MetricCard
            title="Cost per Vessel"
            value="$31,250"
            change="-5%"
            changeType="positive"
            icon="directions-boat"
            color="#10b981"
          />
        </View>
      </View>

      {/* Spend by Vessel */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Spend by Vessel</Text>
        <DashboardChart
          type="bar"
          data={[
            {label: 'MV Ocean Star', value: 45000},
            {label: 'MV Sea Breeze', value: 38000},
            {label: 'MV Wave Runner', value: 25000},
            {label: 'MV Blue Horizon', value: 17000},
          ]}
          color="#1e40af"
        />
      </View>

      {/* Budget vs Actual */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Budget vs Actual</Text>
        <DashboardChart
          type="comparison"
          data={[
            {label: 'Q1', budget: 90000, actual: 85000},
            {label: 'Q2', budget: 95000, actual: 105000},
            {label: 'Q3', budget: 88000, actual: 92000},
            {label: 'Q4', budget: 100000, actual: 125000},
          ]}
          colors={['#94a3b8', '#1e40af']}
        />
      </View>
    </View>
  );

  const renderVendorsTab = () => (
    <View>
      {/* Vendor Performance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Vendors</Text>
        <View style={styles.vendorList}>
          {[
            {name: 'Maritime Supply Co.', score: 95, spend: 45000},
            {name: 'Ocean Parts Ltd.', score: 92, spend: 38000},
            {name: 'Ship Equipment Inc.', score: 88, spend: 25000},
            {name: 'Marine Solutions', score: 85, spend: 17000},
          ].map((vendor, index) => (
            <View key={index} style={styles.vendorCard}>
              <View style={styles.vendorInfo}>
                <Text style={styles.vendorName}>{vendor.name}</Text>
                <Text style={styles.vendorSpend}>${vendor.spend.toLocaleString()}</Text>
              </View>
              <View style={styles.vendorScore}>
                <Text style={styles.scoreText}>{vendor.score}%</Text>
                <View style={styles.scoreBar}>
                  <View
                    style={[
                      styles.scoreBarFill,
                      {width: `${vendor.score}%`},
                    ]}
                  />
                </View>
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
          data={[
            {label: 'Jan', value: 88},
            {label: 'Feb', value: 92},
            {label: 'Mar', value: 85},
            {label: 'Apr', value: 95},
            {label: 'May', value: 92},
          ]}
          color="#059669"
        />
      </View>
    </View>
  );

  if (isLoading && !dashboardData) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <TouchableOpacity style={styles.settingsButton}>
            <Icon name="settings" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <TimeRangeSelector
            selectedRange={selectedTimeRange}
            onRangeChange={handleTimeRangeChange}
          />
          <VesselSelector
            vessels={user?.vessels || []}
            selectedVessel={selectedVessel}
            onVesselChange={handleVesselChange}
          />
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          {[
            {key: 'overview', label: 'Overview'},
            {key: 'spend', label: 'Spend'},
            {key: 'vendors', label: 'Vendors'},
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                activeTab === tab.key && styles.activeTab,
              ]}
              onPress={() => setActiveTab(tab.key as any)}>
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.activeTabText,
                ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }>
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'spend' && renderSpendTab()}
          {activeTab === 'vendors' && renderVendorsTab()}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748b',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#1e40af',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitle: {
    flex: 1,
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: 8,
  },
  filtersContainer: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#1e40af',
  },
  tabText: {
    fontSize: 16,
    color: '#64748b',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#1e40af',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1e293b',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
  },
  analyticsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  vendorList: {
    paddingHorizontal: 16,
  },
  vendorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 8,
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
  vendorInfo: {
    flex: 1,
  },
  vendorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  vendorSpend: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  vendorScore: {
    alignItems: 'flex-end',
    minWidth: 80,
  },
  scoreText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#059669',
  },
  scoreBar: {
    width: 60,
    height: 4,
    backgroundColor: '#e2e8f0',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    backgroundColor: '#059669',
    borderRadius: 2,
  },
});

export default DashboardScreen;