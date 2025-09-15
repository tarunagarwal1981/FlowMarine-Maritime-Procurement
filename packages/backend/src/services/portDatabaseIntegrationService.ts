import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface Port {
  portCode: string;
  name: string;
  country: string;
  countryCode: string;
  region: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  timeZone: string;
  services: PortService[];
  facilities: PortFacility[];
  restrictions: PortRestriction[];
  contacts: PortContact[];
  operatingHours: OperatingHours;
  anchorageInfo: AnchorageInfo;
  pilotageInfo: PilotageInfo;
  lastUpdated: Date;
}

export interface PortService {
  serviceType: string;
  available: boolean;
  provider: string;
  contactInfo: string;
  operatingHours: string;
  notes?: string;
}

export interface PortFacility {
  facilityType: string;
  capacity: number;
  specifications: Record<string, any>;
  availability: boolean;
  bookingRequired: boolean;
}

export interface PortRestriction {
  restrictionType: string;
  description: string;
  applicableVesselTypes: string[];
  effectiveDate: Date;
  expiryDate?: Date;
}

export interface PortContact {
  contactType: string;
  name: string;
  phone: string;
  email: string;
  radio: string;
  emergencyOnly: boolean;
}

export interface OperatingHours {
  weekdays: string;
  weekends: string;
  holidays: string;
  emergencyContact: boolean;
}

export interface AnchorageInfo {
  available: boolean;
  capacity: number;
  depth: number;
  bottom: string;
  shelter: string;
  restrictions: string[];
}

export interface PilotageInfo {
  compulsory: boolean;
  available: boolean;
  boardingArea: string;
  contactInfo: string;
  advanceNotice: string;
}

export interface DeliveryCoordination {
  portCode: string;
  vesselId: string;
  deliveryDate: Date;
  deliveryWindow: {
    start: Date;
    end: Date;
  };
  contactPerson: string;
  specialInstructions: string;
  customsRequirements: CustomsRequirement[];
  documentationRequired: string[];
  estimatedCost: number;
  currency: string;
}

export interface CustomsRequirement {
  documentType: string;
  required: boolean;
  deadline: Date;
  authority: string;
  notes?: string;
}

export interface PortSearchParams {
  query?: string;
  country?: string;
  region?: string;
  services?: string[];
  maxDistance?: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

class PortDatabaseIntegrationService {
  private portApiUrl: string;
  private customsApiUrl: string;
  private agentApiUrl: string;
  private apiKey: string;
  private cache: Map<string, { data: any; expiry: number }>;

  constructor() {
    this.portApiUrl = process.env.PORT_API_URL || 'https://api.portworld.com/v1';
    this.customsApiUrl = process.env.CUSTOMS_API_URL || 'https://api.customsinfo.com/v1';
    this.agentApiUrl = process.env.AGENT_API_URL || 'https://api.portagents.com/v1';
    this.apiKey = process.env.PORT_API_KEY || '';
    this.cache = new Map();
  }

  /**
   * Search ports by various criteria
   */
  async searchPorts(params: PortSearchParams): Promise<Port[]> {
    try {
      const cacheKey = `port_search_${JSON.stringify(params)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const queryParams = new URLSearchParams();
      if (params.query) queryParams.append('q', params.query);
      if (params.country) queryParams.append('country', params.country);
      if (params.region) queryParams.append('region', params.region);
      if (params.services) {
        params.services.forEach(service => queryParams.append('services', service));
      }
      if (params.coordinates && params.maxDistance) {
        queryParams.append('lat', params.coordinates.latitude.toString());
        queryParams.append('lon', params.coordinates.longitude.toString());
        queryParams.append('radius', params.maxDistance.toString());
      }

      const response = await fetch(`${this.portApiUrl}/ports/search?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new AppError(`Port API error: ${response.statusText}`, response.status, 'PORT_API_ERROR');
      }

      const data = await response.json();
      const ports = data.ports.map((port: any) => this.mapPortData(port));
      
      this.setCache(cacheKey, ports, 600000); // Cache for 10 minutes
      return ports;
    } catch (error) {
      logger.error('Error searching ports:', error);
      throw new AppError('Failed to search ports', 500, 'PORT_SEARCH_ERROR');
    }
  }

  /**
   * Get detailed port information
   */
  async getPortDetails(portCode: string): Promise<Port | null> {
    try {
      const cacheKey = `port_details_${portCode}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await fetch(`${this.portApiUrl}/ports/${portCode}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new AppError(`Port API error: ${response.statusText}`, response.status, 'PORT_API_ERROR');
      }

      const data = await response.json();
      const port = this.mapPortData(data);
      
      this.setCache(cacheKey, port, 1800000); // Cache for 30 minutes
      return port;
    } catch (error) {
      logger.error('Error fetching port details:', error);
      throw new AppError('Failed to fetch port details', 500, 'PORT_FETCH_ERROR');
    }
  }

  /**
   * Find nearest ports to given coordinates
   */
  async findNearestPorts(latitude: number, longitude: number, radius: number = 100): Promise<Port[]> {
    return this.searchPorts({
      coordinates: { latitude, longitude },
      maxDistance: radius
    });
  }

  /**
   * Get ports along a route
   */
  async getPortsAlongRoute(waypoints: Array<{lat: number, lon: number}>, maxDistance: number = 50): Promise<Port[]> {
    try {
      const allPorts: Port[] = [];
      
      for (const waypoint of waypoints) {
        const nearbyPorts = await this.findNearestPorts(waypoint.lat, waypoint.lon, maxDistance);
        allPorts.push(...nearbyPorts);
      }

      // Remove duplicates
      const uniquePorts = allPorts.filter((port, index, self) => 
        index === self.findIndex(p => p.portCode === port.portCode)
      );

      return uniquePorts;
    } catch (error) {
      logger.error('Error finding ports along route:', error);
      throw new AppError('Failed to find ports along route', 500, 'ROUTE_PORTS_ERROR');
    }
  }

  /**
   * Coordinate delivery to port
   */
  async coordinateDelivery(coordination: DeliveryCoordination): Promise<{
    confirmationNumber: string;
    estimatedCost: number;
    requiredDocuments: string[];
    contactInfo: PortContact;
  }> {
    try {
      const response = await fetch(`${this.agentApiUrl}/deliveries/coordinate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          port_code: coordination.portCode,
          vessel_id: coordination.vesselId,
          delivery_date: coordination.deliveryDate.toISOString(),
          delivery_window: {
            start: coordination.deliveryWindow.start.toISOString(),
            end: coordination.deliveryWindow.end.toISOString()
          },
          contact_person: coordination.contactPerson,
          special_instructions: coordination.specialInstructions,
          customs_requirements: coordination.customsRequirements,
          documentation_required: coordination.documentationRequired
        })
      });

      if (!response.ok) {
        throw new AppError(`Delivery coordination error: ${response.statusText}`, response.status, 'DELIVERY_COORD_ERROR');
      }

      const data = await response.json();
      
      return {
        confirmationNumber: data.confirmation_number,
        estimatedCost: data.estimated_cost,
        requiredDocuments: data.required_documents,
        contactInfo: this.mapContactData(data.contact_info)
      };
    } catch (error) {
      logger.error('Error coordinating delivery:', error);
      throw new AppError('Failed to coordinate delivery', 500, 'DELIVERY_COORD_ERROR');
    }
  }

  /**
   * Get customs requirements for port
   */
  async getCustomsRequirements(portCode: string, vesselFlag: string, cargoType: string): Promise<CustomsRequirement[]> {
    try {
      const cacheKey = `customs_${portCode}_${vesselFlag}_${cargoType}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await fetch(`${this.customsApiUrl}/requirements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          port_code: portCode,
          vessel_flag: vesselFlag,
          cargo_type: cargoType
        })
      });

      if (!response.ok) {
        throw new AppError(`Customs API error: ${response.statusText}`, response.status, 'CUSTOMS_API_ERROR');
      }

      const data = await response.json();
      const requirements = data.requirements.map((req: any) => ({
        documentType: req.document_type,
        required: req.required,
        deadline: new Date(req.deadline),
        authority: req.authority,
        notes: req.notes
      }));
      
      this.setCache(cacheKey, requirements, 3600000); // Cache for 1 hour
      return requirements;
    } catch (error) {
      logger.error('Error fetching customs requirements:', error);
      throw new AppError('Failed to fetch customs requirements', 500, 'CUSTOMS_FETCH_ERROR');
    }
  }

  /**
   * Calculate estimated transit time between ports
   */
  async calculateTransitTime(fromPortCode: string, toPortCode: string, vesselSpeed: number = 12): Promise<{
    distanceNM: number;
    transitTimeHours: number;
    estimatedArrival: Date;
  }> {
    try {
      const [fromPort, toPort] = await Promise.all([
        this.getPortDetails(fromPortCode),
        this.getPortDetails(toPortCode)
      ]);

      if (!fromPort || !toPort) {
        throw new AppError('Port not found', 404, 'PORT_NOT_FOUND');
      }

      const distance = this.calculateDistance(
        fromPort.coordinates.latitude,
        fromPort.coordinates.longitude,
        toPort.coordinates.latitude,
        toPort.coordinates.longitude
      );

      const transitTimeHours = distance / vesselSpeed;
      const estimatedArrival = new Date(Date.now() + (transitTimeHours * 60 * 60 * 1000));

      return {
        distanceNM: Math.round(distance),
        transitTimeHours: Math.round(transitTimeHours * 10) / 10,
        estimatedArrival
      };
    } catch (error) {
      logger.error('Error calculating transit time:', error);
      throw new AppError('Failed to calculate transit time', 500, 'TRANSIT_CALC_ERROR');
    }
  }

  private mapPortData(data: any): Port {
    return {
      portCode: data.port_code,
      name: data.name,
      country: data.country,
      countryCode: data.country_code,
      region: data.region,
      coordinates: {
        latitude: data.coordinates.latitude,
        longitude: data.coordinates.longitude
      },
      timeZone: data.time_zone,
      services: data.services?.map((s: any) => ({
        serviceType: s.service_type,
        available: s.available,
        provider: s.provider,
        contactInfo: s.contact_info,
        operatingHours: s.operating_hours,
        notes: s.notes
      })) || [],
      facilities: data.facilities?.map((f: any) => ({
        facilityType: f.facility_type,
        capacity: f.capacity,
        specifications: f.specifications || {},
        availability: f.availability,
        bookingRequired: f.booking_required
      })) || [],
      restrictions: data.restrictions?.map((r: any) => ({
        restrictionType: r.restriction_type,
        description: r.description,
        applicableVesselTypes: r.applicable_vessel_types || [],
        effectiveDate: new Date(r.effective_date),
        expiryDate: r.expiry_date ? new Date(r.expiry_date) : undefined
      })) || [],
      contacts: data.contacts?.map((c: any) => this.mapContactData(c)) || [],
      operatingHours: {
        weekdays: data.operating_hours?.weekdays || '24/7',
        weekends: data.operating_hours?.weekends || '24/7',
        holidays: data.operating_hours?.holidays || 'Limited',
        emergencyContact: data.operating_hours?.emergency_contact || true
      },
      anchorageInfo: {
        available: data.anchorage_info?.available || false,
        capacity: data.anchorage_info?.capacity || 0,
        depth: data.anchorage_info?.depth || 0,
        bottom: data.anchorage_info?.bottom || 'Unknown',
        shelter: data.anchorage_info?.shelter || 'Unknown',
        restrictions: data.anchorage_info?.restrictions || []
      },
      pilotageInfo: {
        compulsory: data.pilotage_info?.compulsory || false,
        available: data.pilotage_info?.available || false,
        boardingArea: data.pilotage_info?.boarding_area || '',
        contactInfo: data.pilotage_info?.contact_info || '',
        advanceNotice: data.pilotage_info?.advance_notice || ''
      },
      lastUpdated: new Date(data.last_updated)
    };
  }

  private mapContactData(data: any): PortContact {
    return {
      contactType: data.contact_type,
      name: data.name,
      phone: data.phone,
      email: data.email,
      radio: data.radio,
      emergencyOnly: data.emergency_only || false
    };
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3440.065; // Earth's radius in nautical miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private getFromCache(key: string): any {
    const cached = this.cache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }
}

export const portDatabaseIntegrationService = new PortDatabaseIntegrationService();