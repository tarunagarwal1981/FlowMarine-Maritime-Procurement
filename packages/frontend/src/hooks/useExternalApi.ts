import { useState, useEffect, useCallback } from 'react';
import { externalApiService, IMPAItem, PortData, WeatherData, VesselTrackingData, ExchangeRate, BankAccount, CashPosition } from '../services/externalApiService';

// IMPA Catalog Hook
export const useIMPACatalog = () => {
  const [items, setItems] = useState<IMPAItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  const searchCatalog = useCallback(async (params: {
    searchTerm?: string;
    impaCode?: string;
    issaCode?: string;
    category?: string;
    vesselType?: string;
    engineType?: string;
    limit?: number;
    offset?: number;
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await externalApiService.searchIMPACatalog(params);
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  const getItemDetails = useCallback(async (impaCode: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const item = await externalApiService.getIMPAItemDetails(impaCode);
      return item;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get item details');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    items,
    loading,
    error,
    total,
    searchCatalog,
    getItemDetails
  };
};

// Port Database Hook
export const usePortDatabase = () => {
  const [ports, setPorts] = useState<PortData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchPorts = useCallback(async (params: {
    country?: string;
    region?: string;
    services?: string[];
    coordinates?: {
      latitude: number;
      longitude: number;
      radius: number;
    };
  }) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await externalApiService.searchPorts(params);
      setPorts(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search ports');
    } finally {
      setLoading(false);
    }
  }, []);

  const getPortInfo = useCallback(async (portCode: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const port = await externalApiService.getPortInformation(portCode);
      return port;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get port information');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    ports,
    loading,
    error,
    searchPorts,
    getPortInfo
  };
};

// Weather Data Hook
export const useWeatherData = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [routeForecast, setRouteForecast] = useState<WeatherData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getWeather = useCallback(async (coordinates: { latitude: number; longitude: number }) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await externalApiService.getWeatherData(coordinates);
      setWeatherData(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get weather data');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getRouteForecast = useCallback(async (route: { latitude: number; longitude: number }[]) => {
    setLoading(true);
    setError(null);
    
    try {
      const forecast = await externalApiService.getRouteWeatherForecast(route);
      setRouteForecast(forecast);
      return forecast;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get route forecast');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    weatherData,
    routeForecast,
    loading,
    error,
    getWeather,
    getRouteForecast
  };
};

// Vessel Tracking Hook
export const useVesselTracking = (imoNumbers?: string[]) => {
  const [trackingData, setTrackingData] = useState<VesselTrackingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trackVessel = useCallback(async (imoNumber: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await externalApiService.getVesselPosition(imoNumber);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to track vessel');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const trackMultipleVessels = useCallback(async (vessels: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await externalApiService.trackMultipleVessels(vessels);
      setTrackingData(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to track vessels');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-track vessels if IMO numbers provided
  useEffect(() => {
    if (imoNumbers && imoNumbers.length > 0) {
      trackMultipleVessels(imoNumbers);
      
      // Set up real-time tracking
      const unsubscribe = externalApiService.subscribeToVesselTracking(
        imoNumbers,
        (data) => setTrackingData(data)
      );
      
      return unsubscribe;
    }
  }, [imoNumbers, trackMultipleVessels]);

  return {
    trackingData,
    loading,
    error,
    trackVessel,
    trackMultipleVessels
  };
};

// Exchange Rates Hook
export const useExchangeRates = (currencies?: string[]) => {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentRates = useCallback(async (currencyList: string[]) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await externalApiService.getCurrentExchangeRates(currencyList);
      setRates(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get exchange rates');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getHistoricalRates = useCallback(async (
    fromCurrency: string,
    toCurrency: string,
    startDate: Date,
    endDate: Date
  ) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await externalApiService.getHistoricalExchangeRates(
        fromCurrency,
        toCurrency,
        startDate,
        endDate
      );
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get historical rates');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch rates if currencies provided
  useEffect(() => {
    if (currencies && currencies.length > 0) {
      getCurrentRates(currencies);
      
      // Set up real-time rate updates
      const unsubscribe = externalApiService.subscribeToExchangeRateUpdates(
        currencies,
        (data) => setRates(data)
      );
      
      return unsubscribe;
    }
  }, [currencies, getCurrentRates]);

  return {
    rates,
    loading,
    error,
    getCurrentRates,
    getHistoricalRates
  };
};

// Banking Hook
export const useBanking = () => {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cashPositions, setCashPositions] = useState<CashPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getBankAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await externalApiService.getBankAccounts();
      setAccounts(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get bank accounts');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getCashPosition = useCallback(async (currency?: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await externalApiService.getCashPosition(currency);
      setCashPositions(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get cash position');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const initiatePayment = useCallback(async (instruction: any) => {
    setLoading(true);
    setError(null);
    
    try {
      const status = await externalApiService.initiatePayment(instruction);
      return status;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate payment');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const getPaymentStatus = useCallback(async (paymentId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const status = await externalApiService.getPaymentStatus(paymentId);
      return status;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get payment status');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    accounts,
    cashPositions,
    loading,
    error,
    getBankAccounts,
    getCashPosition,
    initiatePayment,
    getPaymentStatus
  };
};

// System Status Hook
export const useSystemStatus = () => {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const data = await externalApiService.getSystemStatus();
      setStatus(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get system status');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getStatus();
    
    // Check status every 5 minutes
    const interval = setInterval(getStatus, 300000);
    return () => clearInterval(interval);
  }, [getStatus]);

  return {
    status,
    loading,
    error,
    getStatus
  };
};