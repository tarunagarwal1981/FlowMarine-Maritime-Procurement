import { apiClient } from './apiClient';

// Types
export interface IMPAItem {
  impaCode: string;
  issaCode?: string;
  name: string;
  description: string;
  category: string;
  specifications: Record<string, any>;
  compatibleVesselTypes: string[];
  compatibleEngineTypes: string[];
  unitOfMeasure: string;
  averagePrice?: number;
  leadTime?: number;
  suppliers: IMPASupplier[];
  lastUpdated: Date;
}

export interface IMPASupplier {
  supplierId: string;
  supplierName: string;
  price: number;
  currency: string;
  availability: 'IN_STOCK' | 'LIMITED' | 'OUT_OF_STOCK' | 'ON_ORDER';
  leadTime: number;
  minimumOrderQuantity: number;
  location: string;
}

export interface PortData {
  portCode: string;
  portName: string;
  country: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  services: string[];
  customsInfo: {
    clearanceTime: number;
    requiredDocuments: string[];
    fees: Record<string, number>;
  };
  logistics: {
    anchorageDepth: number;
    berthAvailability: boolean;
    cargoHandlingCapacity: number;
    storageCapacity: number;
  };
  contacts: {
    portAuthority: string;
    customsOffice: string;
    pilotage: string;
    tugServices: string;
  };
}

export interface WeatherData {
  location: {
    latitude: number;
    longitude: number;
  };
  current: {
    temperature: number;
    windSpeed: number;
    windDirection: number;
    visibility: number;
    seaState: number;
    waveHeight: number;
  };
  forecast: WeatherForecast[];
}

export interface WeatherForecast {
  date: Date;
  temperature: {
    min: number;
    max: number;
  };
  windSpeed: number;
  windDirection: number;
  precipitation: number;
  seaState: number;
  waveHeight: number;
}

export interface VesselTrackingData {
  vesselId: string;
  imoNumber: string;
  position: {
    latitude: number;
    longitude: number;
    timestamp: Date;
  };
  course: number;
  speed: number;
  status: 'UNDERWAY' | 'AT_ANCHOR' | 'MOORED' | 'NOT_UNDER_COMMAND';
  destination: string;
  eta: Date;
  ais: {
    mmsi: string;
    callSign: string;
    vesselName: string;
    vesselType: string;
  };
}

export interface ExchangeRate {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  timestamp: Date;
  source: string;
  bid: number;
  ask: number;
  spread: number;
}

export interface BankAccount {
  accountId: string;
  accountNumber: string;
  bankCode: string;
  bankName: string;
  currency: string;
  balance: number;
  accountType: 'CHECKING' | 'SAVINGS' | 'BUSINESS';
  status: 'ACTIVE' | 'INACTIVE' | 'FROZEN';
  country: string;
}

export interface CashPosition {
  currency: string;
  totalBalance: number;
  availableBalance: number;
  pendingIncoming: number;
  pendingOutgoing: number;
  accounts: BankAccount[];
  lastUpdated: Date;
}

export interface PaymentInstruction {
  paymentId: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  currency: string;
  exchangeRate?: number;
  targetCurrency?: string;
  paymentMethod: 'WIRE' | 'ACH' | 'SWIFT' | 'SEPA' | 'DIGITAL';
  urgency: 'STANDARD' | 'URGENT' | 'SAME_DAY';
  reference: string;
  beneficiaryDetails: BeneficiaryDetails;
}

export interface BeneficiaryDetails {
  name: string;
  address: string;
  bankName: string;
  bankAddress: string;
  accountNumber: string;
  routingNumber?: string;
  swiftCode?: string;
  iban?: string;
  country: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  statusDetails: string;
  fees: PaymentFee[];
  exchangeRateUsed?: number;
  actualAmount?: number;
  completedAt?: Date;
  failureReason?: string;
  trackingReference?: string;
}

export interface PaymentFee {
  type: 'TRANSFER' | 'EXCHANGE' | 'CORRESPONDENT' | 'COMPLIANCE';
  amount: number;
  currency: string;
  description: string;
}

export class ExternalApiService {
  // IMPA/ISSA Catalog Methods
  async searchIMPACatalog(params: {
    searchTerm?: string;
    impaCode?: string;
    issaCode?: string;
    category?: string;
    vesselType?: string;
    engineType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: IMPAItem[]; total: number; pagination: any }> {
    const response = await apiClient.get('/external-api/catalog/search', { params });
    return response.data;
  }

  async getIMPAItemDetails(impaCode: string): Promise<IMPAItem> {
    const response = await apiClient.get(`/external-api/catalog/items/${impaCode}`);
    return response.data.data;
  }

  async getIMPASupplierPricing(impaCode: string, location?: string): Promise<IMPASupplier[]> {
    const params = location ? { location } : {};
    const response = await apiClient.get(`/external-api/catalog/items/${impaCode}/suppliers`, { params });
    return response.data.data;
  }

  // Port Database Methods
  async getPortInformation(portCode: string): Promise<PortData> {
    const response = await apiClient.get(`/external-api/ports/${portCode}`);
    return response.data.data;
  }

  async searchPorts(params: {
    country?: string;
    region?: string;
    services?: string[];
    coordinates?: {
      latitude: number;
      longitude: number;
      radius: number;
    };
  }): Promise<PortData[]> {
    const queryParams: any = {};
    
    if (params.country) queryParams.country = params.country;
    if (params.region) queryParams.region = params.region;
    if (params.services) queryParams.services = params.services.join(',');
    if (params.coordinates) {
      queryParams.latitude = params.coordinates.latitude;
      queryParams.longitude = params.coordinates.longitude;
      queryParams.radius = params.coordinates.radius;
    }

    const response = await apiClient.get('/external-api/ports/search', { params: queryParams });
    return response.data.data;
  }

  // Weather API Methods
  async getWeatherData(coordinates: { latitude: number; longitude: number }): Promise<WeatherData> {
    const response = await apiClient.get('/external-api/weather', {
      params: coordinates
    });
    return response.data.data;
  }

  async getRouteWeatherForecast(route: { latitude: number; longitude: number }[]): Promise<WeatherData[]> {
    const response = await apiClient.post('/external-api/weather/route-forecast', { route });
    return response.data.data;
  }

  // Vessel Tracking Methods
  async getVesselPosition(imoNumber: string): Promise<VesselTrackingData> {
    const response = await apiClient.get(`/external-api/vessels/${imoNumber}/position`);
    return response.data.data;
  }

  async trackMultipleVessels(imoNumbers: string[]): Promise<VesselTrackingData[]> {
    const response = await apiClient.post('/external-api/vessels/track-multiple', { imoNumbers });
    return response.data.data;
  }

  // Banking API Methods
  async getCurrentExchangeRates(currencies: string[]): Promise<ExchangeRate[]> {
    const response = await apiClient.get('/external-api/banking/exchange-rates', {
      params: { currencies: currencies.join(',') }
    });
    return response.data.data;
  }

  async getHistoricalExchangeRates(
    fromCurrency: string,
    toCurrency: string,
    startDate: Date,
    endDate: Date
  ): Promise<ExchangeRate[]> {
    const response = await apiClient.get('/external-api/banking/exchange-rates/historical', {
      params: {
        fromCurrency,
        toCurrency,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      }
    });
    return response.data.data;
  }

  async getBankAccounts(): Promise<BankAccount[]> {
    const response = await apiClient.get('/external-api/banking/accounts');
    return response.data.data;
  }

  async getCashPosition(currency?: string): Promise<CashPosition[]> {
    const params = currency ? { currency } : {};
    const response = await apiClient.get('/external-api/banking/cash-position', { params });
    return response.data.data;
  }

  async initiatePayment(instruction: PaymentInstruction): Promise<PaymentStatus> {
    const response = await apiClient.post('/external-api/banking/payments', instruction);
    return response.data.data;
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    const response = await apiClient.get(`/external-api/banking/payments/${paymentId}/status`);
    return response.data.data;
  }

  async getFXHedgingRecommendations(exposures: { currency: string; amount: number }[]): Promise<any[]> {
    const response = await apiClient.post('/external-api/banking/fx-hedging/recommendations', { exposures });
    return response.data.data;
  }

  // System Status Methods
  async getSystemStatus(): Promise<any> {
    const response = await apiClient.get('/external-api/status');
    return response.data.data;
  }

  // Utility Methods for Real-time Updates
  subscribeToIMPAUpdates(callback: (updates: any[]) => void): () => void {
    // This would typically use WebSocket or Server-Sent Events
    // For now, we'll use polling as a fallback
    const interval = setInterval(async () => {
      try {
        // Check for updates (this would be replaced with real-time connection)
        const status = await this.getSystemStatus();
        if (status.impa === 'UPDATED') {
          callback([]);
        }
      } catch (error) {
        console.error('Error checking IMPA updates:', error);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }

  subscribeToExchangeRateUpdates(
    currencies: string[],
    callback: (rates: ExchangeRate[]) => void
  ): () => void {
    const interval = setInterval(async () => {
      try {
        const rates = await this.getCurrentExchangeRates(currencies);
        callback(rates);
      } catch (error) {
        console.error('Error fetching exchange rates:', error);
      }
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }

  subscribeToVesselTracking(
    imoNumbers: string[],
    callback: (trackingData: VesselTrackingData[]) => void
  ): () => void {
    const interval = setInterval(async () => {
      try {
        const trackingData = await this.trackMultipleVessels(imoNumbers);
        callback(trackingData);
      } catch (error) {
        console.error('Error tracking vessels:', error);
      }
    }, 120000); // Update every 2 minutes

    return () => clearInterval(interval);
  }
}

export const externalApiService = new ExternalApiService();