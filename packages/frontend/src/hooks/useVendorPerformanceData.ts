import { useState, useEffect, useCallback } from 'react';
import { VendorPerformance, HistoricalScore } from '../types/analytics';

interface UseVendorPerformanceDataProps {
  topVendorsCount: number;
  performanceMetrics: string[];
  timeRange: { from: Date; to: Date };
  autoRefresh?: boolean;
  refreshInterval?: number; // in milliseconds
}

interface UseVendorPerformanceDataReturn {
  data: VendorPerformance[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  handleVendorSelect: (vendor: VendorPerformance) => void;
  handleRecommendationClick: (vendorId: string, recommendation: string) => void;
  selectedVendor: VendorPerformance | null;
}

export const useVendorPerformanceData = ({
  topVendorsCount,
  performanceMetrics,
  timeRange,
  autoRefresh = true,
  refreshInterval = 60000, // 1 minute
}: UseVendorPerformanceDataProps): UseVendorPerformanceDataReturn => {
  const [data, setData] = useState<VendorPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<VendorPerformance | null>(null);

  // Generate mock vendor performance data
  const generateMockVendorData = useCallback((): VendorPerformance[] => {
    const vendorNames = [
      'Maritime Supply Co.',
      'Ocean Parts Ltd.',
      'Nautical Equipment Inc.',
      'SeaTech Solutions',
      'Marine Logistics Corp.',
      'Anchor Supply Chain',
      'Blue Water Parts',
      'Compass Marine Services',
      'Harbor Equipment Co.',
      'Tide Marine Supply',
      'Wave Tech Industries',
      'Deep Sea Components',
    ];

    const generateHistoricalScores = (): HistoricalScore[] => {
      const scores: HistoricalScore[] = [];
      const now = new Date();
      
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const period = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        
        // Generate scores with some trend
        const baseOverall = 70 + Math.random() * 25;
        const baseDelivery = 65 + Math.random() * 30;
        const baseQuality = 70 + Math.random() * 25;
        const basePrice = 60 + Math.random() * 35;
        
        scores.push({
          period,
          overallScore: Math.min(100, baseOverall + (Math.random() - 0.5) * 10),
          deliveryScore: Math.min(100, baseDelivery + (Math.random() - 0.5) * 15),
          qualityScore: Math.min(100, baseQuality + (Math.random() - 0.5) * 12),
          priceScore: Math.min(100, basePrice + (Math.random() - 0.5) * 20),
        });
      }
      
      return scores;
    };

    const generateRecommendations = (vendor: string, scores: any): string[] => {
      const recommendations: string[] = [];
      
      if (scores.deliveryScore < 75) {
        recommendations.push(`Improve delivery performance for ${vendor} - currently at ${scores.deliveryScore.toFixed(1)}%`);
        recommendations.push('Consider implementing delivery tracking system and setting stricter SLAs');
      }
      
      if (scores.qualityScore < 80) {
        recommendations.push(`Address quality issues with ${vendor} - quality score is ${scores.qualityScore.toFixed(1)}%`);
        recommendations.push('Implement quality assurance checks and vendor audits');
      }
      
      if (scores.priceScore < 70) {
        recommendations.push(`Negotiate better pricing with ${vendor} - price competitiveness is ${scores.priceScore.toFixed(1)}%`);
        recommendations.push('Consider bulk purchasing agreements or long-term contracts');
      }
      
      if (scores.overallScore > 90) {
        recommendations.push(`${vendor} is a top performer - consider expanding partnership`);
        recommendations.push('Explore opportunities for preferred vendor status and volume discounts');
      }
      
      return recommendations;
    };

    return vendorNames.slice(0, Math.max(topVendorsCount, 12)).map((name, index) => {
      const deliveryScore = 60 + Math.random() * 35;
      const qualityScore = 65 + Math.random() * 30;
      const priceScore = 55 + Math.random() * 40;
      const overallScore = (deliveryScore * 0.3 + qualityScore * 0.3 + priceScore * 0.4);
      
      const totalOrders = Math.floor(10 + Math.random() * 200);
      const onTimeDeliveryRate = Math.min(100, deliveryScore + Math.random() * 10);
      const averageDeliveryTime = 3 + Math.random() * 12;
      const costSavings = Math.floor(Math.random() * 50000);
      
      // Determine trend based on historical data
      const historicalScores = generateHistoricalScores();
      const recentScores = historicalScores.slice(-3);
      const olderScores = historicalScores.slice(0, 3);
      const recentAvg = recentScores.reduce((sum, s) => sum + s.overallScore, 0) / recentScores.length;
      const olderAvg = olderScores.reduce((sum, s) => sum + s.overallScore, 0) / olderScores.length;
      
      let trend: 'improving' | 'declining' | 'stable';
      if (recentAvg > olderAvg + 5) {
        trend = 'improving';
      } else if (recentAvg < olderAvg - 5) {
        trend = 'declining';
      } else {
        trend = 'stable';
      }

      const vendorData = {
        vendorId: `vendor-${index + 1}`,
        vendorName: name,
        overallScore,
        deliveryScore,
        qualityScore,
        priceScore,
        totalOrders,
        onTimeDeliveryRate,
        averageDeliveryTime,
        costSavings,
        trend,
        historicalScores,
        recommendations: [] as string[],
      };

      // Generate recommendations based on performance
      vendorData.recommendations = generateRecommendations(name, vendorData);

      return vendorData;
    });
  }, [topVendorsCount]);

  // Fetch vendor performance data
  const fetchVendorData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));

      // In a real implementation, this would be an API call
      // const response = await fetch('/api/analytics/vendor-performance', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     topVendorsCount,
      //     performanceMetrics,
      //     timeRange,
      //   }),
      // });
      // const result = await response.json();
      // setData(result.data);

      // For now, use mock data
      const mockData = generateMockVendorData();
      setData(mockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vendor performance data');
    } finally {
      setLoading(false);
    }
  }, [topVendorsCount, performanceMetrics, timeRange, generateMockVendorData]);

  // Handle vendor selection
  const handleVendorSelect = useCallback((vendor: VendorPerformance) => {
    setSelectedVendor(vendor);
    console.log('Vendor selected:', vendor.vendorName);
    
    // In a real implementation, this might:
    // - Update other dashboard components
    // - Navigate to vendor detail view
    // - Load additional vendor data
  }, []);

  // Handle recommendation clicks
  const handleRecommendationClick = useCallback((vendorId: string, recommendation: string) => {
    console.log('Recommendation clicked:', { vendorId, recommendation });
    
    // In a real implementation, this might:
    // - Open recommendation details modal
    // - Navigate to action plan page
    // - Create task or reminder
    // - Log user interaction for analytics
    
    const vendor = data.find(v => v.vendorId === vendorId);
    if (vendor) {
      console.log(`Processing recommendation for ${vendor.vendorName}: ${recommendation}`);
    }
  }, [data]);

  // Refresh data manually
  const refreshData = useCallback(async () => {
    await fetchVendorData();
  }, [fetchVendorData]);

  // Initial data fetch
  useEffect(() => {
    fetchVendorData();
  }, [fetchVendorData]);

  // Auto-refresh setup
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchVendorData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchVendorData]);

  return {
    data,
    loading,
    error,
    refreshData,
    handleVendorSelect,
    handleRecommendationClick,
    selectedVendor,
  };
};