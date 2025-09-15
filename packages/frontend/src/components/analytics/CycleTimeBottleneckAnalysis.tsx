import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  CycleTimeData,
  CycleTimeStage,
  Bottleneck,
  VesselCycleTimeComparison,
  EfficiencyRecommendation,
  DashboardFilters
} from '../../types/analytics';
import { useCycleTimeData } from '../../hooks/useCycleTimeData';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface CycleTimeBottleneckAnalysisProps {
  filters: DashboardFilters;
  vessels: string[];
  onDrillDown?: (stage: string, vesselId?: string) => void;
}

export const CycleTimeBottleneckAnalysis: React.FC<CycleTimeBottleneckAnalysisProps> = ({
  filters,
  vessels,
  onDrillDown
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'stages' | 'vessels' | 'bottlenecks' | 'recommendations'>('overview');
  const [selectedVessel, setSelectedVessel] = useState<string | null>(null);
  
  const { data: cycleTimeData, loading, error, refetch } = useCycleTimeData(filters);

  useEffect(() => {
    refetch();
  }, [filters, refetch]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !cycleTimeData) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-center text-red-600">
          <p>Error loading cycle time data</p>
          <button 
            onClick={() => refetch()}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const renderOverviewTab = () => {
    const overviewData = {
      labels: ['Current Period', 'Previous Period', 'Fleet Average'],
      datasets: [
        {
          label: 'Average Cycle Time (Hours)',
          data: [
            cycleTimeData.averageCycleTime,
            cycleTimeData.trends[cycleTimeData.trends.length - 2]?.averageCycleTime || 0,
            cycleTimeData.vesselComparison.reduce((sum, v) => sum + v.averageCycleTime, 0) / cycleTimeData.vesselComparison.length
          ],
          backgroundColor: ['#3B82F6', '#6B7280', '#10B981'],
          borderColor: ['#2563EB', '#4B5563', '#059669'],
          borderWidth: 1
        }
      ]
    };

    const trendData = {
      labels: cycleTimeData.trends.map(t => t.period),
      datasets: [
        {
          label: 'Average Cycle Time',
          data: cycleTimeData.trends.map(t => t.averageCycleTime),
          borderColor: '#3B82F6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Efficiency %',
          data: cycleTimeData.trends.map(t => t.efficiency),
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          fill: false,
          yAxisID: 'y1'
        }
      ]
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Cycle Time Overview'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Hours'
          }
        },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          title: {
            display: true,
            text: 'Efficiency %'
          },
          grid: {
            drawOnChartArea: false,
          },
        }
      }
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800">Average Cycle Time</h3>
            <p className="text-2xl font-bold text-blue-600">{cycleTimeData.averageCycleTime.toFixed(1)} hrs</p>
            <p className="text-sm text-blue-600">
              {cycleTimeData.trends.length > 1 && (
                <>
                  {((cycleTimeData.averageCycleTime - cycleTimeData.trends[cycleTimeData.trends.length - 2].averageCycleTime) / cycleTimeData.trends[cycleTimeData.trends.length - 2].averageCycleTime * 100).toFixed(1)}% 
                  {cycleTimeData.averageCycleTime > cycleTimeData.trends[cycleTimeData.trends.length - 2].averageCycleTime ? ' ↑' : ' ↓'} from last period
                </>
              )}
            </p>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800">Active Bottlenecks</h3>
            <p className="text-2xl font-bold text-green-600">{cycleTimeData.bottlenecks.length}</p>
            <p className="text-sm text-green-600">
              {cycleTimeData.bottlenecks.filter(b => b.impact === 'high').length} high impact
            </p>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-purple-800">Efficiency Score</h3>
            <p className="text-2xl font-bold text-purple-600">
              {cycleTimeData.trends[cycleTimeData.trends.length - 1]?.efficiency.toFixed(1) || 0}%
            </p>
            <p className="text-sm text-purple-600">Fleet average</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Current vs Previous Period</h3>
            <div style={{ height: '300px' }}>
              <Bar data={overviewData} options={{ ...chartOptions, maintainAspectRatio: false }} />
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4">Cycle Time Trends</h3>
            <div style={{ height: '300px' }}>
              <Line data={trendData} options={{ ...chartOptions, maintainAspectRatio: false }} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStagesTab = () => {
    const stageData = {
      labels: cycleTimeData.cycleTimeByStage.map(stage => stage.stageName),
      datasets: [
        {
          label: 'Average Time (Hours)',
          data: cycleTimeData.cycleTimeByStage.map(stage => stage.averageTime),
          backgroundColor: cycleTimeData.cycleTimeByStage.map(stage => 
            stage.bottlenecks.length > 0 ? '#EF4444' : '#3B82F6'
          ),
          borderColor: cycleTimeData.cycleTimeByStage.map(stage => 
            stage.bottlenecks.length > 0 ? '#DC2626' : '#2563EB'
          ),
          borderWidth: 1
        },
        {
          label: 'Efficiency %',
          data: cycleTimeData.cycleTimeByStage.map(stage => stage.efficiency),
          type: 'line' as const,
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          yAxisID: 'y1'
        }
      ]
    };

    const stageOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Stage-by-Stage Analysis'
        },
        tooltip: {
          callbacks: {
            afterBody: (context: any) => {
              const stageIndex = context[0].dataIndex;
              const stage = cycleTimeData.cycleTimeByStage[stageIndex];
              if (stage.bottlenecks.length > 0) {
                return `Bottlenecks: ${stage.bottlenecks.length}`;
              }
              return '';
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Hours'
          }
        },
        y1: {
          type: 'linear' as const,
          display: true,
          position: 'right' as const,
          title: {
            display: true,
            text: 'Efficiency %'
          },
          grid: {
            drawOnChartArea: false,
          },
        }
      },
      onClick: (event: any, elements: any) => {
        if (elements.length > 0) {
          const stageIndex = elements[0].index;
          const stage = cycleTimeData.cycleTimeByStage[stageIndex];
          onDrillDown?.(stage.stage);
        }
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg border">
          <div style={{ height: '400px' }}>
            <Bar data={stageData} options={stageOptions} />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Stage Details</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Efficiency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bottlenecks
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cycleTimeData.cycleTimeByStage.map((stage, index) => (
                  <tr key={stage.stage} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {stage.stageName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stage.averageTime.toFixed(1)} hrs
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stage.minTime.toFixed(1)} - {stage.maxTime.toFixed(1)} hrs
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${stage.efficiency}%` }}
                          ></div>
                        </div>
                        {stage.efficiency.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {stage.bottlenecks.length > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {stage.bottlenecks.length} issues
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          No issues
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderVesselsTab = () => {
    const vesselData = {
      labels: cycleTimeData.vesselComparison.map(v => v.vesselName),
      datasets: [
        {
          label: 'Average Cycle Time (Hours)',
          data: cycleTimeData.vesselComparison.map(v => v.averageCycleTime),
          backgroundColor: cycleTimeData.vesselComparison.map(v => 
            v.efficiency > 80 ? '#10B981' : v.efficiency > 60 ? '#F59E0B' : '#EF4444'
          ),
          borderColor: cycleTimeData.vesselComparison.map(v => 
            v.efficiency > 80 ? '#059669' : v.efficiency > 60 ? '#D97706' : '#DC2626'
          ),
          borderWidth: 1
        }
      ]
    };

    const vesselOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: 'Vessel Performance Comparison'
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Hours'
          }
        }
      },
      onClick: (event: any, elements: any) => {
        if (elements.length > 0) {
          const vesselIndex = elements[0].index;
          const vessel = cycleTimeData.vesselComparison[vesselIndex];
          setSelectedVessel(vessel.vesselId);
          onDrillDown?.('vessel', vessel.vesselId);
        }
      }
    };

    return (
      <div className="space-y-6">
        <div className="bg-white p-4 rounded-lg border">
          <div style={{ height: '400px' }}>
            <Bar data={vesselData} options={vesselOptions} />
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg border">
          <h3 className="text-lg font-semibold mb-4">Vessel Rankings</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vessel
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Cycle Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Efficiency
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Improvement
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bottlenecks
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {cycleTimeData.vesselComparison
                  .sort((a, b) => a.rank - b.rank)
                  .map((vessel) => (
                  <tr 
                    key={vessel.vesselId} 
                    className={`hover:bg-gray-50 cursor-pointer ${selectedVessel === vessel.vesselId ? 'bg-blue-50' : ''}`}
                    onClick={() => setSelectedVessel(vessel.vesselId)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      #{vessel.rank}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {vessel.vesselName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {vessel.averageCycleTime.toFixed(1)} hrs
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div 
                            className={`h-2 rounded-full ${
                              vessel.efficiency > 80 ? 'bg-green-600' : 
                              vessel.efficiency > 60 ? 'bg-yellow-600' : 'bg-red-600'
                            }`}
                            style={{ width: `${vessel.efficiency}%` }}
                          ></div>
                        </div>
                        {vessel.efficiency.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`inline-flex items-center ${
                        vessel.improvement > 0 ? 'text-green-600' : 
                        vessel.improvement < 0 ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {vessel.improvement > 0 ? '↑' : vessel.improvement < 0 ? '↓' : '→'} 
                        {Math.abs(vessel.improvement).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {vessel.bottleneckCount > 0 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {vessel.bottleneckCount}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          0
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderBottlenecksTab = () => {
    const bottlenecksByStage = cycleTimeData.bottlenecks.reduce((acc, bottleneck) => {
      if (!acc[bottleneck.stage]) {
        acc[bottleneck.stage] = [];
      }
      acc[bottleneck.stage].push(bottleneck);
      return acc;
    }, {} as Record<string, Bottleneck[]>);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-red-800">High Impact</h3>
            <p className="text-2xl font-bold text-red-600">
              {cycleTimeData.bottlenecks.filter(b => b.impact === 'high').length}
            </p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-800">Medium Impact</h3>
            <p className="text-2xl font-bold text-yellow-600">
              {cycleTimeData.bottlenecks.filter(b => b.impact === 'medium').length}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800">Low Impact</h3>
            <p className="text-2xl font-bold text-blue-600">
              {cycleTimeData.bottlenecks.filter(b => b.impact === 'low').length}
            </p>
          </div>
        </div>

        {Object.entries(bottlenecksByStage).map(([stage, bottlenecks]) => (
          <div key={stage} className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 capitalize">{stage.replace('_', ' ')} Stage</h3>
            <div className="space-y-4">
              {bottlenecks.map((bottleneck) => (
                <div 
                  key={bottleneck.id} 
                  className={`p-4 rounded-lg border-l-4 ${
                    bottleneck.impact === 'high' ? 'border-red-500 bg-red-50' :
                    bottleneck.impact === 'medium' ? 'border-yellow-500 bg-yellow-50' :
                    'border-blue-500 bg-blue-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-900">{bottleneck.description}</h4>
                      <p className="text-sm text-gray-600 mt-1">{bottleneck.rootCause}</p>
                      <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                        <span>Frequency: {bottleneck.frequency}/month</span>
                        <span>Avg Delay: {bottleneck.averageDelay.toFixed(1)} hrs</span>
                        <span>Potential Savings: {bottleneck.estimatedSavings.toFixed(1)} hrs</span>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                      bottleneck.impact === 'high' ? 'bg-red-100 text-red-800' :
                      bottleneck.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {bottleneck.impact} impact
                    </div>
                  </div>
                  <div className="mt-3 p-3 bg-white rounded border">
                    <p className="text-sm font-medium text-gray-700">Recommendation:</p>
                    <p className="text-sm text-gray-600">{bottleneck.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderRecommendationsTab = () => {
    const recommendationsByCategory = cycleTimeData.recommendations.reduce((acc, rec) => {
      if (!acc[rec.category]) {
        acc[rec.category] = [];
      }
      acc[rec.category].push(rec);
      return acc;
    }, {} as Record<string, EfficiencyRecommendation[]>);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-green-800">Potential Time Savings</h3>
            <p className="text-2xl font-bold text-green-600">
              {cycleTimeData.recommendations.reduce((sum, r) => sum + r.estimatedTimeSavings, 0).toFixed(1)} hrs
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-lg font-semibold text-blue-800">Potential Cost Savings</h3>
            <p className="text-2xl font-bold text-blue-600">
              ${cycleTimeData.recommendations.reduce((sum, r) => sum + r.estimatedCostSavings, 0).toLocaleString()}
            </p>
          </div>
        </div>

        {Object.entries(recommendationsByCategory).map(([category, recommendations]) => (
          <div key={category} className="bg-white p-4 rounded-lg border">
            <h3 className="text-lg font-semibold mb-4 capitalize">{category} Recommendations</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {recommendations.map((recommendation) => (
                <div 
                  key={recommendation.id} 
                  className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-900">{recommendation.title}</h4>
                    <div className="flex space-x-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        recommendation.impact === 'high' ? 'bg-red-100 text-red-800' :
                        recommendation.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {recommendation.impact} impact
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        recommendation.effort === 'high' ? 'bg-red-100 text-red-800' :
                        recommendation.effort === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {recommendation.effort} effort
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{recommendation.description}</p>
                  <div className="flex justify-between items-center text-sm">
                    <div className="text-green-600">
                      <span className="font-medium">Time Savings:</span> {recommendation.estimatedTimeSavings.toFixed(1)} hrs
                    </div>
                    <div className="text-blue-600">
                      <span className="font-medium">Cost Savings:</span> ${recommendation.estimatedCostSavings.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="border-b border-gray-200">
        <div className="px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Cycle Time & Bottleneck Analysis</h2>
          <p className="text-sm text-gray-600 mt-1">
            Track procurement cycle times and identify bottlenecks across the workflow
          </p>
        </div>
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {[
            { id: 'overview', name: 'Overview' },
            { id: 'stages', name: 'Stages' },
            { id: 'vessels', name: 'Vessels' },
            { id: 'bottlenecks', name: 'Bottlenecks' },
            { id: 'recommendations', name: 'Recommendations' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'stages' && renderStagesTab()}
        {activeTab === 'vessels' && renderVesselsTab()}
        {activeTab === 'bottlenecks' && renderBottlenecksTab()}
        {activeTab === 'recommendations' && renderRecommendationsTab()}
      </div>
    </div>
  );
};

export default CycleTimeBottleneckAnalysis;