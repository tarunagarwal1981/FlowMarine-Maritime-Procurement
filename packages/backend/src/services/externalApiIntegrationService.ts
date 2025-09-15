import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { redis } from '../config/redis';
import { AppError } from '../utils/errors';

// IMPA/ISSA Catalog Integration
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

export class ExternalApiIntegrationService extends EventEmitter {
  private impaClient: AxiosInstance;
  private portClient: AxiosInstance;
  private weatherClient: AxiosInstance;
  private aisClient: AxiosInstance;
  private bankingClient: AxiosInstance;

  constructor() {
    super();
    this.initializeClients();
    this.setupRealTimeUpdates();
  }

  private initializeClients(): void {
    // IMPA/ISSA Catalog API Client
    this.impaClient = axios.create({
      baseURL: process.env.IMPA_API_URL || 'https://api.impa.net/v2',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${process.env.IMPA_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Port Database API Client
    this.portClient = axios.create({
      baseURL: process.env.PORT_API_URL || 'https://api.portworld.com/v1',
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${process.env.PORT_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Weather API Client
    this.weatherClient = axios.create({
      baseURL: process.env.WEATHER_API_URL || 'https://api.weatherapi.com/v1',
      timeout: 10000,
      headers: {
        'Authorization': `Bearer ${process.env.WEATHER_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // AIS/GPS Tracking API Client
    this.aisClient = axios.create({
      baseURL: process.env.AIS_API_URL || 'https://api.marinetraffic.com/v1',
      timeout: 15000,
      headers: {
        'Authorization': `Bearer ${process.env.AIS_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    // Banking API Client
    this.bankingClient = axios.create({
      baseURL: process.env.BANKING_API_URL || 'https://api.swift.com/v1',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${process.env.BANKING_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Add request/response interceptors for all clients
    const clients = [this.impaClient, this.portClient, this.weatherClient, this.aisClient, this.bankingClient];
    
    clients.forEach(client => {
      client.interceptors.request.use(
        (config) => {
          logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
          return config;
        },
        (error) => {
          logger.error('API Request Error:', error);
          return Promise.reject(error);
        }
      );

      client.interceptors.response.use(
        (response) => {
          logger.debug(`API Response: ${response.status} ${response.config.url}`);
          return response;
        },
        (error) => {
          logger.error('API Response Error:', error.response?.data || error.message);
          return Promise.reject(new AppError(
            `External API Error: ${error.response?.data?.message || error.message}`,
            error.response?.status || 500,
            'EXTERNAL_API_ERROR'
          ));
        }
      );
    });
  }

  // IMPA/ISSA Catalog Integration
  async searchIMPACatalog(query: {
    searchTerm?: string;
    impaCode?: string;
    issaCode?: string;
    category?: string;
    vesselType?: string;
    engineType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: IMPAItem[]; total: number }> {
    try {
      const cacheKey = `impa:search:${JSON.stringify(query)}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.impaClient.get('/catalog/search', {
        params: query
      });

      const result = {
        items: response.data.items.map(this.transformIMPAItem),
        total: response.data.total
      };

      // Cache for 1 hour
      await redis.setex(cacheKey, 3600, JSON.stringify(result));
      
      return result;
    } catch (error) {
      logger.error('IMPA catalog search error:', error);
      throw error;
    }
  }

  async getIMPAItemDetails(impaCode: string): Promise<IMPAItem> {
    try {
      const cacheKey = `impa:item:${impaCode}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.impaClient.get(`/catalog/items/${impaCode}`);
      const item = this.transformIMPAItem(response.data);

      // Cache for 30 minutes
      await redis.setex(cacheKey, 1800, JSON.stringify(item));
      
      return item;
    } catch (error) {
      logger.error('IMPA item details error:', error);
      throw error;
    }
  }

  async getIMPASupplierPricing(impaCode: string, location?: string): Promise<IMPASupplier[]> {
    try {
      const cacheKey = `impa:pricing:${impaCode}:${location || 'global'}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.impaClient.get(`/catalog/items/${impaCode}/suppliers`, {
        params: { location }
      });

      const suppliers = response.data.suppliers;

      // Cache for 15 minutes (pricing changes frequently)
      await redis.setex(cacheKey, 900, JSON.stringify(suppliers));
      
      return suppliers;
    } catch (error) {
      logger.error('IMPA supplier pricing error:', error);
      throw error;
    }
  }

  private transformIMPAItem(rawItem: any): IMPAItem {
    return {
      impaCode: rawItem.impa_code,
      issaCode: rawItem.issa_code,
      name: rawItem.name,
      description: rawItem.description,
      category: rawItem.category,
      specifications: rawItem.specifications || {},
      compatibleVesselTypes: rawItem.compatible_vessel_types || [],
      compatibleEngineTypes: rawItem.compatible_engine_types || [],
      unitOfMeasure: rawItem.unit_of_measure,
      averagePrice: rawItem.average_price,
      leadTime: rawItem.lead_time,
      suppliers: rawItem.suppliers || [],
      lastUpdated: new Date(rawItem.last_updated)
    };
  }

  // Port Database Integration
  async getPortInformation(portCode: string): Promise<PortData> {
    try {
      const cacheKey = `port:info:${portCode}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.portClient.get(`/ports/${portCode}`);
      const portData = this.transformPortData(response.data);

      // Cache for 24 hours (port info changes infrequently)
      await redis.setex(cacheKey, 86400, JSON.stringify(portData));
      
      return portData;
    } catch (error) {
      logger.error('Port information error:', error);
      throw error;
    }
  }

  async searchPorts(query: {
    country?: string;
    region?: string;
    services?: string[];
    coordinates?: {
      latitude: number;
      longitude: number;
      radius: number;
    };
  }): Promise<PortData[]> {
    try {
      const cacheKey = `port:search:${JSON.stringify(query)}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.portClient.get('/ports/search', {
        params: query
      });

      const ports = response.data.ports.map(this.transformPortData);

      // Cache for 6 hours
      await redis.setex(cacheKey, 21600, JSON.stringify(ports));
      
      return ports;
    } catch (error) {
      logger.error('Port search error:', error);
      throw error;
    }
  }

  private transformPortData(rawPort: any): PortData {
    return {
      portCode: rawPort.port_code,
      portName: rawPort.port_name,
      country: rawPort.country,
      coordinates: {
        latitude: rawPort.latitude,
        longitude: rawPort.longitude
      },
      services: rawPort.services || [],
      customsInfo: {
        clearanceTime: rawPort.customs_info?.clearance_time || 0,
        requiredDocuments: rawPort.customs_info?.required_documents || [],
        fees: rawPort.customs_info?.fees || {}
      },
      logistics: {
        anchorageDepth: rawPort.logistics?.anchorage_depth || 0,
        berthAvailability: rawPort.logistics?.berth_availability || false,
        cargoHandlingCapacity: rawPort.logistics?.cargo_handling_capacity || 0,
        storageCapacity: rawPort.logistics?.storage_capacity || 0
      },
      contacts: {
        portAuthority: rawPort.contacts?.port_authority || '',
        customsOffice: rawPort.contacts?.customs_office || '',
        pilotage: rawPort.contacts?.pilotage || '',
        tugServices: rawPort.contacts?.tug_services || ''
      }
    };
  }

  // Weather API Integration
  async getWeatherData(coordinates: { latitude: number; longitude: number }): Promise<WeatherData> {
    try {
      const cacheKey = `weather:${coordinates.latitude}:${coordinates.longitude}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        return JSON.parse(cached);
      }

      const response = await this.weatherClient.get('/current', {
        params: {
          lat: coordinates.latitude,
          lon: coordinates.longitude,
          include_forecast: true
        }
      });

      const weatherData = this.transformWeatherData(response.data);

      // Cache for 30 minutes
      await redis.setex(cacheKey, 1800, JSON.stringify(weatherData));
      
      return weatherData;
    } catch (error) {
      logger.error('Weather data error:', error);
      throw error;
    }
  }

  async getRouteWeatherForecast(route: { latitude: number; longitude: number }[]): Promise<WeatherData[]> {
    try {
      const promises = route.map(point => this.getWeatherData(point));
      return await Promise.all(promises);
    } catch (error) {
      logger.error('Route weather forecast error:', error);
      throw error;
    }
  }

  private transformWeatherData(rawWeather: any): WeatherData {
    return {
      location: {
        latitude: rawWeather.location.lat,
        longitude: rawWeather.location.lon
      },
      current: {
        temperature: rawWeather.current.temp_c,
        windSpeed: rawWeather.current.wind_kph,
        windDirection: rawWeather.current.wind_degree,
        visibility: rawWeather.current.vis_km,
        seaState: rawWeather.marine?.sea_state || 0,
        waveHeight: rawWeather.marine?.wave_height || 0
      },
      forecast: rawWeather.forecast?.forecastday?.map((day: any) => ({
        date: new Date(day.date),
        temperature: {
          min: day.day.mintemp_c,
          max: day.day.maxtemp_c
        },
        windSpeed: day.day.maxwind_kph,
        windDirection: day.day.wind_degree || 0,
        precipitation: day.day.totalprecip_mm,
        seaState: day.marine?.sea_state || 0,
        waveHeight: day.marine?.wave_height || 0
      })) || []
    };
  }

  // Vessel Tracking Integration
  async getVesselPosition(imoNumber: string): Promise<VesselTrackingData> {
    try {
      const cacheKey = `vessel:position:${imoNumber}`;
      const cached = await redis.get(cacheKey);
      
      if (cached) {
        const data = JSON.parse(cached);
        // Only use cached data if it's less than 5 minutes old
        if (new Date().getTime() - new Date(data.position.timestamp).getTime() < 300000) {
          return data;
        }
      }

      const response = await this.aisClient.get(`/vessels/${imoNumber}/position`);
      const trackingData = this.transformVesselTrackingData(response.data);

      // Cache for 2 minutes
      await redis.setex(cacheKey, 120, JSON.stringify(trackingData));
      
      return trackingData;
    } catch (error) {
      logger.error('Vessel position error:', error);
      throw error;
    }
  }

  async trackMultipleVessels(imoNumbers: string[]): Promise<VesselTrackingData[]> {
    try {
      const promises = imoNumbers.map(imo => this.getVesselPosition(imo));
      return await Promise.all(promises);
    } catch (error) {
      logger.error('Multiple vessel tracking error:', error);
      throw error;
    }
  }

  private transformVesselTrackingData(rawData: any): VesselTrackingData {
    return {
      vesselId: rawData.vessel_id,
      imoNumber: rawData.imo_number,
      position: {
        latitude: rawData.position.lat,
        longitude: rawData.position.lon,
        timestamp: new Date(rawData.position.timestamp)
      },
      course: rawData.course,
      speed: rawData.speed,
      status: rawData.status,
      destination: rawData.destination,
      eta: new Date(rawData.eta),
      ais: {
        mmsi: rawData.ais.mmsi,
        callSign: rawData.ais.call_sign,
        vesselName: rawData.ais.vessel_name,
        vesselType: rawData.ais.vessel_type
      }
    };
  }

  private setupRealTimeUpdates(): void {
    // Set up WebSocket connections for real-time updates
    this.setupIMPARealTimeUpdates();
    this.setupVesselTrackingUpdates();
  }

  private setupIMPARealTimeUpdates(): void {
    // Implementation for real-time IMPA catalog updates
    setInterval(async () => {
      try {
        // Check for catalog updates
        const response = await this.impaClient.get('/catalog/updates', {
          params: { since: new Date(Date.now() - 3600000).toISOString() }
        });

        if (response.data.updates.length > 0) {
          this.emit('impa-updates', response.data.updates);
          logger.info(`Received ${response.data.updates.length} IMPA catalog updates`);
        }
      } catch (error) {
        logger.error('IMPA real-time update error:', error);
      }
    }, 300000); // Check every 5 minutes
  }

  private setupVesselTrackingUpdates(): void {
    // Implementation for real-time vessel tracking updates
    setInterval(async () => {
      try {
        // This would typically be a WebSocket connection in production
        this.emit('vessel-tracking-update', { timestamp: new Date() });
      } catch (error) {
        logger.error('Vessel tracking update error:', error);
      }
    }, 120000); // Check every 2 minutes
  }
}

export const externalApiService = new ExternalApiIntegrationService();