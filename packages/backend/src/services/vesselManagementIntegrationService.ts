import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface VesselManagementSystem {
  systemId: string;
  name: string;
  version: string;
  apiEndpoint: string;
  authMethod: 'API_KEY' | 'OAUTH' | 'BASIC_AUTH';
  dataFormat: 'JSON' | 'XML' | 'EDI';
  supportedOperations: string[];
}

export interface VesselDataExchange {
  vesselId: string;
  imoNumber: string;
  dataType: 'POSITION' | 'VOYAGE' | 'CREW' | 'MAINTENANCE' | 'CERTIFICATES' | 'INVENTORY';
  data: Record<string, any>;
  timestamp: Date;
  source: string;
  version: string;
}

export interface CrewManifest {
  vesselId: string;
  manifestDate: Date;
  crew: CrewMember[];
  totalCrew: number;
  officersCount: number;
  ratingsCount: number;
  lastUpdated: Date;
}

export interface CrewMember {
  id: string;
  name: string;
  rank: string;
  nationality: string;
  certificateNumber: string;
  certificateExpiry: Date;
  signOnDate: Date;
  signOffDate?: Date;
  emergencyContact: string;
}

export interface MaintenanceSchedule {
  vesselId: string;
  scheduleId: string;
  maintenanceType: 'ROUTINE' | 'PLANNED' | 'EMERGENCY' | 'SURVEY';
  equipment: string;
  description: string;
  scheduledDate: Date;
  estimatedDuration: number;
  requiredParts: string[];
  assignedCrew: string[];
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface CertificateStatus {
  vesselId: string;
  certificateType: string;
  certificateNumber: string;
  issuingAuthority: string;
  issueDate: Date;
  expiryDate: Date;
  status: 'VALID' | 'EXPIRING' | 'EXPIRED' | 'SUSPENDED';
  renewalRequired: boolean;
  daysToExpiry: number;
}

export interface InventoryItem {
  vesselId: string;
  itemId: string;
  impaCode?: string;
  name: string;
  category: string;
  currentStock: number;
  minimumStock: number;
  maximumStock: number;
  unit: string;
  location: string;
  lastUpdated: Date;
  reorderRequired: boolean;
}

class VesselManagementIntegrationService {
  private registeredSystems: Map<string, VesselManagementSystem>;
  private dataCache: Map<string, { data: any; expiry: number }>;

  constructor() {
    this.registeredSystems = new Map();
    this.dataCache = new Map();
    this.initializeDefaultSystems();
  }

  /**
   * Register a vessel management system
   */
  registerSystem(system: VesselManagementSystem): void {
    this.registeredSystems.set(system.systemId, system);
    logger.info(`Registered vessel management system: ${system.name}`);
  }

  /**
   * Exchange vessel data with external system
   */
  async exchangeVesselData(
    systemId: string, 
    vesselId: string, 
    dataType: VesselDataExchange['dataType'],
    operation: 'GET' | 'POST' | 'PUT'
  ): Promise<VesselDataExchange | null> {
    try {
      const system = this.registeredSystems.get(systemId);
      if (!system) {
        throw new AppError(`Vessel management system not found: ${systemId}`, 404, 'SYSTEM_NOT_FOUND');
      }

      const cacheKey = `${systemId}_${vesselId}_${dataType}`;
      
      if (operation === 'GET') {
        const cached = this.getFromCache(cacheKey);
        if (cached) {
          return cached;
        }
      }

      const endpoint = `${system.apiEndpoint}/vessels/${vesselId}/${dataType.toLowerCase()}`;
      const headers = this.buildHeaders(system);

      const response = await fetch(endpoint, {
        method: operation,
        headers
      });

      if (!response.ok) {
        throw new AppError(
          `${system.name} API error: ${response.statusText}`, 
          response.status, 
          'VMS_API_ERROR'
        );
      }

      const data = await this.parseResponse(response, system.dataFormat);
      
      const exchange: VesselDataExchange = {
        vesselId,
        imoNumber: data.imo_number || '',
        dataType,
        data: data,
        timestamp: new Date(),
        source: system.name,
        version: system.version
      };

      if (operation === 'GET') {
        this.setCache(cacheKey, exchange, 300000); // Cache for 5 minutes
      }

      return exchange;
    } catch (error) {
      logger.error(`Error exchanging vessel data with ${systemId}:`, error);
      throw new AppError('Failed to exchange vessel data', 500, 'VMS_EXCHANGE_ERROR');
    }
  }

  /**
   * Get crew manifest from vessel management system
   */
  async getCrewManifest(systemId: string, vesselId: string): Promise<CrewManifest | null> {
    try {
      const exchange = await this.exchangeVesselData(systemId, vesselId, 'CREW', 'GET');
      if (!exchange) return null;

      return this.mapCrewManifest(exchange.data);
    } catch (error) {
      logger.error('Error fetching crew manifest:', error);
      throw new AppError('Failed to fetch crew manifest', 500, 'CREW_MANIFEST_ERROR');
    }
  }

  /**
   * Get maintenance schedule from vessel management system
   */
  async getMaintenanceSchedule(systemId: string, vesselId: string): Promise<MaintenanceSchedule[]> {
    try {
      const exchange = await this.exchangeVesselData(systemId, vesselId, 'MAINTENANCE', 'GET');
      if (!exchange) return [];

      return this.mapMaintenanceSchedule(exchange.data);
    } catch (error) {
      logger.error('Error fetching maintenance schedule:', error);
      throw new AppError('Failed to fetch maintenance schedule', 500, 'MAINTENANCE_SCHEDULE_ERROR');
    }
  }

  /**
   * Get certificate status from vessel management system
   */
  async getCertificateStatus(systemId: string, vesselId: string): Promise<CertificateStatus[]> {
    try {
      const exchange = await this.exchangeVesselData(systemId, vesselId, 'CERTIFICATES', 'GET');
      if (!exchange) return [];

      return this.mapCertificateStatus(exchange.data, vesselId);
    } catch (error) {
      logger.error('Error fetching certificate status:', error);
      throw new AppError('Failed to fetch certificate status', 500, 'CERTIFICATE_STATUS_ERROR');
    }
  }

  /**
   * Get vessel inventory from vessel management system
   */
  async getVesselInventory(systemId: string, vesselId: string): Promise<InventoryItem[]> {
    try {
      const exchange = await this.exchangeVesselData(systemId, vesselId, 'INVENTORY', 'GET');
      if (!exchange) return [];

      return this.mapInventoryItems(exchange.data, vesselId);
    } catch (error) {
      logger.error('Error fetching vessel inventory:', error);
      throw new AppError('Failed to fetch vessel inventory', 500, 'INVENTORY_ERROR');
    }
  }

  /**
   * Sync procurement data with vessel management system
   */
  async syncProcurementData(systemId: string, vesselId: string, procurementData: {
    requisitions: any[];
    purchaseOrders: any[];
    deliveries: any[];
  }): Promise<{ success: boolean; errors: string[] }> {
    const errors: string[] = [];
    
    try {
      const system = this.registeredSystems.get(systemId);
      if (!system) {
        throw new AppError(`Vessel management system not found: ${systemId}`, 404, 'SYSTEM_NOT_FOUND');
      }

      // Sync requisitions
      try {
        await this.syncRequisitions(system, vesselId, procurementData.requisitions);
      } catch (error) {
        errors.push(`Requisition sync failed: ${error.message}`);
      }

      // Sync purchase orders
      try {
        await this.syncPurchaseOrders(system, vesselId, procurementData.purchaseOrders);
      } catch (error) {
        errors.push(`Purchase order sync failed: ${error.message}`);
      }

      // Sync deliveries
      try {
        await this.syncDeliveries(system, vesselId, procurementData.deliveries);
      } catch (error) {
        errors.push(`Delivery sync failed: ${error.message}`);
      }

      return {
        success: errors.length === 0,
        errors
      };
    } catch (error) {
      logger.error('Error syncing procurement data:', error);
      return {
        success: false,
        errors: [error.message]
      };
    }
  }

  /**
   * Get integrated vessel dashboard data
   */
  async getIntegratedDashboardData(systemId: string, vesselId: string): Promise<{
    position: any;
    crew: CrewManifest | null;
    maintenance: MaintenanceSchedule[];
    certificates: CertificateStatus[];
    inventory: InventoryItem[];
    lastUpdated: Date;
  }> {
    try {
      const [positionExchange, crew, maintenance, certificates, inventory] = await Promise.all([
        this.exchangeVesselData(systemId, vesselId, 'POSITION', 'GET'),
        this.getCrewManifest(systemId, vesselId),
        this.getMaintenanceSchedule(systemId, vesselId),
        this.getCertificateStatus(systemId, vesselId),
        this.getVesselInventory(systemId, vesselId)
      ]);

      return {
        position: positionExchange?.data || null,
        crew,
        maintenance,
        certificates,
        inventory,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error('Error fetching integrated dashboard data:', error);
      throw new AppError('Failed to fetch integrated dashboard data', 500, 'DASHBOARD_DATA_ERROR');
    }
  }

  private initializeDefaultSystems(): void {
    // Register common vessel management systems
    const defaultSystems: VesselManagementSystem[] = [
      {
        systemId: 'danaos',
        name: 'Danaos Vessel Management',
        version: '2.1',
        apiEndpoint: process.env.DANAOS_API_URL || 'https://api.danaos.com/v2',
        authMethod: 'API_KEY',
        dataFormat: 'JSON',
        supportedOperations: ['POSITION', 'CREW', 'MAINTENANCE', 'CERTIFICATES']
      },
      {
        systemId: 'shipserv',
        name: 'ShipServ Fleet Management',
        version: '3.0',
        apiEndpoint: process.env.SHIPSERV_API_URL || 'https://api.shipserv.com/v3',
        authMethod: 'OAUTH',
        dataFormat: 'JSON',
        supportedOperations: ['INVENTORY', 'MAINTENANCE', 'PROCUREMENT']
      },
      {
        systemId: 'amos',
        name: 'AMOS Maintenance System',
        version: '1.5',
        apiEndpoint: process.env.AMOS_API_URL || 'https://api.amos.com/v1',
        authMethod: 'BASIC_AUTH',
        dataFormat: 'XML',
        supportedOperations: ['MAINTENANCE', 'INVENTORY', 'CERTIFICATES']
      }
    ];

    defaultSystems.forEach(system => this.registerSystem(system));
  }

  private buildHeaders(system: VesselManagementSystem): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': system.dataFormat === 'JSON' ? 'application/json' : 'application/xml'
    };

    switch (system.authMethod) {
      case 'API_KEY':
        headers['Authorization'] = `Bearer ${process.env[`${system.systemId.toUpperCase()}_API_KEY`]}`;
        break;
      case 'OAUTH':
        headers['Authorization'] = `Bearer ${process.env[`${system.systemId.toUpperCase()}_ACCESS_TOKEN`]}`;
        break;
      case 'BASIC_AUTH':
        const username = process.env[`${system.systemId.toUpperCase()}_USERNAME`];
        const password = process.env[`${system.systemId.toUpperCase()}_PASSWORD`];
        headers['Authorization'] = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        break;
    }

    return headers;
  }

  private async parseResponse(response: Response, format: string): Promise<any> {
    if (format === 'JSON') {
      return await response.json();
    } else if (format === 'XML') {
      const text = await response.text();
      // XML parsing would require additional library like xml2js
      // For now, return as text
      return { xmlData: text };
    }
    return {};
  }

  private mapCrewManifest(data: any): CrewManifest {
    return {
      vesselId: data.vessel_id,
      manifestDate: new Date(data.manifest_date),
      crew: data.crew?.map((member: any) => ({
        id: member.id,
        name: member.name,
        rank: member.rank,
        nationality: member.nationality,
        certificateNumber: member.certificate_number,
        certificateExpiry: new Date(member.certificate_expiry),
        signOnDate: new Date(member.sign_on_date),
        signOffDate: member.sign_off_date ? new Date(member.sign_off_date) : undefined,
        emergencyContact: member.emergency_contact
      })) || [],
      totalCrew: data.total_crew || 0,
      officersCount: data.officers_count || 0,
      ratingsCount: data.ratings_count || 0,
      lastUpdated: new Date(data.last_updated)
    };
  }

  private mapMaintenanceSchedule(data: any): MaintenanceSchedule[] {
    return data.maintenance_items?.map((item: any) => ({
      vesselId: item.vessel_id,
      scheduleId: item.schedule_id,
      maintenanceType: item.maintenance_type,
      equipment: item.equipment,
      description: item.description,
      scheduledDate: new Date(item.scheduled_date),
      estimatedDuration: item.estimated_duration,
      requiredParts: item.required_parts || [],
      assignedCrew: item.assigned_crew || [],
      status: item.status,
      priority: item.priority
    })) || [];
  }

  private mapCertificateStatus(data: any, vesselId: string): CertificateStatus[] {
    return data.certificates?.map((cert: any) => {
      const expiryDate = new Date(cert.expiry_date);
      const now = new Date();
      const daysToExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      return {
        vesselId,
        certificateType: cert.certificate_type,
        certificateNumber: cert.certificate_number,
        issuingAuthority: cert.issuing_authority,
        issueDate: new Date(cert.issue_date),
        expiryDate,
        status: daysToExpiry < 0 ? 'EXPIRED' : daysToExpiry < 30 ? 'EXPIRING' : 'VALID',
        renewalRequired: daysToExpiry < 60,
        daysToExpiry
      };
    }) || [];
  }

  private mapInventoryItems(data: any, vesselId: string): InventoryItem[] {
    return data.inventory_items?.map((item: any) => ({
      vesselId,
      itemId: item.item_id,
      impaCode: item.impa_code,
      name: item.name,
      category: item.category,
      currentStock: item.current_stock,
      minimumStock: item.minimum_stock,
      maximumStock: item.maximum_stock,
      unit: item.unit,
      location: item.location,
      lastUpdated: new Date(item.last_updated),
      reorderRequired: item.current_stock <= item.minimum_stock
    })) || [];
  }

  private async syncRequisitions(system: VesselManagementSystem, vesselId: string, requisitions: any[]): Promise<void> {
    const endpoint = `${system.apiEndpoint}/vessels/${vesselId}/requisitions/sync`;
    const headers = this.buildHeaders(system);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requisitions })
    });

    if (!response.ok) {
      throw new AppError(`Requisition sync failed: ${response.statusText}`, response.status, 'SYNC_ERROR');
    }
  }

  private async syncPurchaseOrders(system: VesselManagementSystem, vesselId: string, purchaseOrders: any[]): Promise<void> {
    const endpoint = `${system.apiEndpoint}/vessels/${vesselId}/purchase-orders/sync`;
    const headers = this.buildHeaders(system);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ purchase_orders: purchaseOrders })
    });

    if (!response.ok) {
      throw new AppError(`Purchase order sync failed: ${response.statusText}`, response.status, 'SYNC_ERROR');
    }
  }

  private async syncDeliveries(system: VesselManagementSystem, vesselId: string, deliveries: any[]): Promise<void> {
    const endpoint = `${system.apiEndpoint}/vessels/${vesselId}/deliveries/sync`;
    const headers = this.buildHeaders(system);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({ deliveries })
    });

    if (!response.ok) {
      throw new AppError(`Delivery sync failed: ${response.statusText}`, response.status, 'SYNC_ERROR');
    }
  }

  private getFromCache(key: string): any {
    const cached = this.dataCache.get(key);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }
    this.dataCache.delete(key);
    return null;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.dataCache.set(key, {
      data,
      expiry: Date.now() + ttl
    });
  }
}

export const vesselManagementIntegrationService = new VesselManagementIntegrationService();