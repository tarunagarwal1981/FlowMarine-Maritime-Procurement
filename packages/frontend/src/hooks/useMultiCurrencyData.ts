import { useState, useEffect, useCallback } from 'react';
import { MultiCurrencyConsolidationData } from '../types/analytics';

export interface MultiCurrencyFilters {
  startDate: Date;
  endDate: Date;
  vesselIds?: string[];
  categories?: string[];
  vendorIds?: string[];
  baseCurrency?: string;
}

interface UseMultiCurrencyDataResult {
  data: MultiCurrencyConsolidationData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export const useMultiCurrencyData = (
  filters: MultiCurrencyFilters
): UseMultiCurrencyDataResult => {
  const [data, setData] = useState<MultiCurrencyConsolidationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams({
        startDate: filters.startDate.toISOString(),
        endDate: filters.endDate.toISOString(),
        ...(filters.baseCurrency && { baseCurrency: filters.baseCurrency }),
        ...(filters.vesselIds?.length && { vesselIds: filters.vesselIds.join(',') }),
        ...(filters.categories?.length && { categories: filters.categories.join(',') }),
        ...(filters.vendorIds?.length && { vendorIds: filters.vendorIds.join(',') })
      });

      const response = await fetch(`/api/analytics/financial/multi-currency?${queryParams}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch multi-currency data');
      }

      setData(result.data);
    } catch (err) {
      console.error('Error fetching multi-currency data:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      
      // Set mock data for development/demo purposes
      setData(generateMockMultiCurrencyData(filters));
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch
  };
};

// Mock data generator for development/demo purposes
const generateMockMultiCurrencyData = (filters: MultiCurrencyFilters): MultiCurrencyConsolidationData => {
  const baseCurrency = filters.baseCurrency || 'USD';
  
  // Mock exchange rates
  const exchangeRates = {
    'USD': 1.0,
    'EUR': 1.08,
    'GBP': 1.26,
    'JPY': 0.0067,
    'CAD': 0.74,
    'AUD': 0.66
  };

  // Generate mock currency breakdown
  const currencies = ['USD', 'EUR', 'GBP', 'JPY'];
  const currencyBreakdown = currencies.map(currency => {
    const amount = Math.random() * 500000 + 100000;
    const exchangeRate = exchangeRates[currency as keyof typeof exchangeRates] || 1;
    const amountInBaseCurrency = currency === baseCurrency ? amount : amount * exchangeRate;
    
    return {
      currency,
      amount,
      amountInBaseCurrency,
      exchangeRate: currency === baseCurrency ? 1 : exchangeRate,
      percentage: 0, // Will be calculated below
      trend: ['strengthening', 'weakening', 'stable'][Math.floor(Math.random() * 3)] as 'strengthening' | 'weakening' | 'stable',
      volatility: Math.random() * 0.2 + 0.05 // 5-25% volatility
    };
  });

  // Calculate percentages
  const totalSpend = currencyBreakdown.reduce((sum, c) => sum + c.amountInBaseCurrency, 0);
  currencyBreakdown.forEach(c => {
    c.percentage = (c.amountInBaseCurrency / totalSpend) * 100;
  });

  // Generate mock monthly impact data
  const monthlyImpact = [];
  const startDate = new Date(filters.startDate);
  const endDate = new Date(filters.endDate);
  
  for (let d = new Date(startDate); d <= endDate; d.setMonth(d.getMonth() + 1)) {
    monthlyImpact.push({
      month: d.toISOString().substring(0, 7),
      gainLoss: (Math.random() - 0.5) * 20000,
      exchangeRate: 1 + (Math.random() - 0.5) * 0.1,
      volume: Math.random() * 100000 + 50000
    });
  }

  const totalGainLoss = monthlyImpact.reduce((sum, m) => sum + m.gainLoss, 0);

  // Generate mock historical rates
  const historicalRates = [];
  const daysBack = 90;
  
  for (const currency of currencies.filter(c => c !== baseCurrency)) {
    const baseRate = exchangeRates[currency as keyof typeof exchangeRates] || 1;
    
    for (let i = 0; i < daysBack; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      const rate = baseRate * (1 + (Math.random() - 0.5) * 0.1);
      const change = (Math.random() - 0.5) * 0.02;
      
      historicalRates.push({
        currency,
        date,
        rate,
        change,
        changePercentage: change * 100
      });
    }
  }

  // Generate mock hedging recommendations
  const hedgingRecommendations = currencyBreakdown
    .filter(c => c.currency !== baseCurrency && c.amountInBaseCurrency > 50000 && c.volatility > 0.1)
    .map(c => ({
      id: `hedge-${c.currency}-${Date.now()}`,
      currency: c.currency,
      recommendationType: c.volatility > 0.15 ? 'option' : 'forward_contract' as 'forward_contract' | 'option' | 'swap' | 'natural_hedge',
      title: `Hedge ${c.currency} Exposure`,
      description: `Consider hedging ${c.currency} exposure of ${c.amountInBaseCurrency.toLocaleString()} ${baseCurrency} due to high volatility (${(c.volatility * 100).toFixed(1)}%)`,
      riskLevel: c.volatility > 0.15 ? 'high' : 'medium' as 'low' | 'medium' | 'high',
      potentialSavings: c.amountInBaseCurrency * c.volatility * 0.5,
      timeHorizon: '3-6 months',
      implementation: `Work with treasury team to establish ${c.volatility > 0.15 ? 'option contracts' : 'forward contracts'} for upcoming ${c.currency} payments`
    }));

  return {
    totalSpendBaseCurrency: totalSpend,
    baseCurrency,
    currencyBreakdown: currencyBreakdown.sort((a, b) => b.amountInBaseCurrency - a.amountInBaseCurrency),
    exchangeRateImpact: {
      gainLoss: totalGainLoss,
      percentage: totalSpend > 0 ? (totalGainLoss / totalSpend) * 100 : 0,
      trend: totalGainLoss > 0 ? 'favorable' : totalGainLoss < 0 ? 'unfavorable' : 'neutral' as 'favorable' | 'unfavorable' | 'neutral',
      impactByMonth: monthlyImpact
    },
    historicalRates: historicalRates.sort((a, b) => b.date.getTime() - a.date.getTime()),
    hedgingRecommendations
  };
};