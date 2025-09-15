import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface VesselPosition {
  vesselId: string;
  imoNumber: string;
  latitude: number;
  longitude: number;
  course: number;
  speed: number;
  heading: number;
  timestamp: Date;
  source: 'AIS' | 'GPS' | 'SATELLITE';
}

export interface AISData {
  mmsi: string;
  imoNumber: string;
  vesselName: string;
  latitude: number;
  longitude: number;
  course: number;
  speed: number;
  heading: number;
  navStatus: string;
  timestamp: Date;
}

export interface GPSTrackingData {
  deviceId: string;
  vesselId: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number;
  course: number;
  accuracy: number;
  timestamp: Date;
}

class AISGPSIntegrationService {
  private aisApiUrl: string;
  private gpsApiUrl: string;
  private satelliteApiUrl: string;
  private apiKey: string;

  constructor() {
    this.aisApiUrl = process.env.AIS_API_URL || 'https://api.marinetraffic.com/v1';
    this.gpsApiUrl = process.env.GPS_API_URL || 'https://api.gpsgateway.com/v1';
    this.satelliteApiUrl = process.env.SATELLITE_API_URL || 'https://api.exactearth.com/v1';
    this.apiKey = process.env.MARITIME_API_KEY || '';
  }

  /**
   * Get real-time vessel position from AIS data
   */
  async getAISPosition(imoNumber: string): Promise<VesselPosition | null> {
    try {
      const response = await fetch(`${this.aisApiUrl}/vessels/position`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          imo: imoNumber,
          format: 'json'
        })
      });

      if (!response.ok) {
        throw new AppError(`AIS API error: ${response.statusText}`, response.status, 'AIS_API_ERROR');
      }

      const data = await response.json();
      
      if (!data.data || data.data.length === 0) {
        return null;
      }

      const aisData = data.data[0];
      
      return {
        vesselId: '', // Will be populated by calling service
        imoNumber,
        latitude: parseFloat(aisData.lat),
        longitude: parseFloat(aisData.lon),
        course: parseFloat(aisData.course) || 0,
        speed: parseFloat(aisData.speed) || 0,
        heading: parseFloat(aisData.heading) || 0,
        timestamp: new Date(aisData.timestamp),
        source: 'AIS'
      };
    } catch (error) {
      logger.error('Error fetching AIS position:', error);
      throw new AppError('Failed to fetch AIS position data', 500, 'AIS_FETCH_ERROR');
    }
  }

  /**
   * Get GPS tracking data for vessel
   */
  async getGPSPosition(vesselId: string, deviceId: string): Promise<VesselPosition | null> {
    try {
      const response = await fetch(`${this.gpsApiUrl}/devices/${deviceId}/position`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        throw new AppError(`GPS API error: ${response.statusText}`, response.status, 'GPS_API_ERROR');
      }

      const data = await response.json();
      
      return {
        vesselId,
        imoNumber: '', // Will be populated by calling service
        latitude: data.latitude,
        longitude: data.longitude,
        course: data.course || 0,
        speed: data.speed || 0,
        heading: data.heading || 0,
        timestamp: new Date(data.timestamp),
        source: 'GPS'
      };
    } catch (error) {
      logger.error('Error fetching GPS position:', error);
      throw new AppError('Failed to fetch GPS position data', 500, 'GPS_FETCH_ERROR');
    }
  }

  /**
   * Get satellite tracking data for vessel
   */
  async getSatellitePosition(imoNumber: string): Promise<VesselPosition | null> {
    try {
      const response = await fetch(`${this.satelliteApiUrl}/vessels/${imoNumber}/position`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Vessel not found in satellite data
        }
        throw new AppError(`Satellite API error: ${response.statusText}`, response.status, 'SATELLITE_API_ERROR');
      }

      const data = await response.json();
      
      return {
        vesselId: '', // Will be populated by calling service
        imoNumber,
        latitude: data.position.latitude,
        longitude: data.position.longitude,
        course: data.position.course || 0,
        speed: data.position.speed || 0,
        heading: data.position.heading || 0,
        timestamp: new Date(data.position.timestamp),
        source: 'SATELLITE'
      };
    } catch (error) {
      logger.error('Error fetching satellite position:', error);
      throw new AppError('Failed to fetch satellite position data', 500, 'SATELLITE_FETCH_ERROR');
    }
  }

  /**
   * Get best available position using multiple sources with fallback
   */
  async getBestAvailablePosition(vesselId: string, imoNumber: string, gpsDeviceId?: string): Promise<VesselPosition | null> {
    const sources = [];

    // Try AIS first (most reliable for commercial vessels)
    try {
      const aisPosition = await this.getAISPosition(imoNumber);
      if (aisPosition) {
        aisPosition.vesselId = vesselId;
        sources.push(aisPosition);
      }
    } catch (error) {
      logger.warn('AIS position unavailable:', error);
    }

    // Try GPS if device ID available
    if (gpsDeviceId) {
      try {
        const gpsPosition = await this.getGPSPosition(vesselId, gpsDeviceId);
        if (gpsPosition) {
          gpsPosition.imoNumber = imoNumber;
          sources.push(gpsPosition);
        }
      } catch (error) {
        logger.warn('GPS position unavailable:', error);
      }
    }

    // Try satellite as fallback
    try {
      const satellitePosition = await this.getSatellitePosition(imoNumber);
      if (satellitePosition) {
        satellitePosition.vesselId = vesselId;
        sources.push(satellitePosition);
      }
    } catch (error) {
      logger.warn('Satellite position unavailable:', error);
    }

    // Return most recent position
    if (sources.length === 0) {
      return null;
    }

    return sources.reduce((latest, current) => 
      current.timestamp > latest.timestamp ? current : latest
    );
  }

  /**
   * Validate position data quality
   */
  validatePositionData(position: VesselPosition): boolean {
    // Check if coordinates are valid
    if (position.latitude < -90 || position.latitude > 90) return false;
    if (position.longitude < -180 || position.longitude > 180) return false;
    
    // Check if timestamp is reasonable (not too old, not in future)
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const timeDiff = now.getTime() - position.timestamp.getTime();
    
    if (timeDiff < 0 || timeDiff > maxAge) return false;
    
    // Check if speed is reasonable (max 50 knots for commercial vessels)
    if (position.speed > 50) return false;
    
    return true;
  }

  /**
   * Calculate distance between two positions in nautical miles
   */
  calculateDistance(pos1: VesselPosition, pos2: VesselPosition): number {
    const R = 3440.065; // Earth's radius in nautical miles
    const dLat = this.toRadians(pos2.latitude - pos1.latitude);
    const dLon = this.toRadians(pos2.longitude - pos1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(pos1.latitude)) * Math.cos(this.toRadians(pos2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}

export const aisGpsIntegrationService = new AISGPSIntegrationService();