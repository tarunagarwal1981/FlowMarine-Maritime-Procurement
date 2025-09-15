import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CostAnalysisVarianceTracking from '../../components/analytics/CostAnalysisVarianceTracking';
import { CostAnalysisVarianceData } from '../../types/analytics';

// Mock Chart.js
jest.mock('react-chartjs-2', () => ({
  Line: ({ data, options }: any) => (
    <div data-testid="line-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Line Chart
    </div>
  ),
  Bar: ({ data, options }: any) => (
    <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Bar Chart
    </div>
  ),
  Doughnut: ({ data, options }: any) => (
    <div data-testid="doughnut-chart" data-chart-data={JSON.stringify(data)} data-chart-options={JSON.stringify(options)}>
      Doughnut Chart
    </div>
  )
}));

const mockData: CostAnalysisVarianceData = {
  budgetVsActualAnalysis: {
    totalBudget: 1200000,
    totalActual: 1150000,
    totalVariance: -50000,
    variancePercentage: -4.17
  },
  categoryBreakdown: [],
  monthlyTrends: [],
  topVariances: [],
  recommendations: []
};