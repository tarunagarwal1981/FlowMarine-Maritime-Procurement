import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface IMPAItem {
  impaCode: string;
  issaCode?: string;
  name: string;
  description: string;
  category: string;
  subCategory: string;
  unitOfMeasure: string;
  specifications: Record<string, any>;
  compatibleVesselTypes: string[];
  compatibleEngineTypes: string[];
  averagePrice?: number;
  currency?: string;
  leadTime?: number;
  suppliers: string[];
  lastUpdated: Date;
}

export interface ISSAItem {
  issaCode: string;
  impaCode?: string;
  name: string;
  description: string;
  category: string;
  technicalSpecs: Record<string, any>;
  safetyClassification: string;
  certificationRequired: boolean;
  storageRequirements: string;
  handlingInstructions: string;
  lastUpdated: Date;
}

export interface CatalogSearchParams {
  query?: string;
  impaCode?: string;
  issaCode?: string;
  category?: string;
  vesselType?: string;
  engineType?: string;
  limit?: number;
  offset?: number;
}

export interface CatalogSearchResult {
  items: IMPAItem[];
  total: number;
  hasMore: boolean;
}

class IMPACatalogIntegrationService {
  private impaApiUrl: string;
  private issaApiUrl: string;
  private apiKey: string;
  private cache: Map<string, { data: any; expiry: number }>;

  constructor() {
    this.impaApiUrl = process.env.IMPA_API_URL || 'https://api.impa.net/v2';
    this.issaApiUrl = process.env.ISSA_API_URL || 'https://api.issa.org/v1';
    this.apiKey = process.env.MARITIME_CATALOG_API_KEY || '';
    this.cache = new Map();
  }

  /**
   * Search IMPA catalog for items
   */
  async searchIMPACatalog(params: CatalogSearchParams): Promise<CatalogSearchResult> {
    try {
      const cacheKey = `impa_search_${JSON.stringify(params)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const queryParams = new URLSearchParams();
      if (params.query) queryParams.append('q', params.query);
      if (params.impaCode) queryParams.append('impa_code', params.impaCode);
      if (params.category) queryParams.append('category', params.category);
      if (params.vesselType) queryParams.append('vessel_type', params.vesselType);
      if (params.engineType) queryParams.append('engine_type', params.engineType);
      queryParams.append('limit', (params.limit || 50).toString());
      queryParams.append('offset', (params.offset || 0).toString());

      const response = await fetch(`${this.impaApiUrl}/catalog/search?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new AppError(`IMPA API error: ${response.statusText}`, response.status, 'IMPA_API_ERROR');
      }

      const data = await response.json();
      
      const result: CatalogSearchResult = {
        items: data.items.map((item: any) => this.mapIMPAItem(item)),
        total: data.total,
        hasMore: data.hasMore
      };

      this.setCache(cacheKey, result, 300000); // Cache for 5 minutes
      return result;
    } catch (error) {
      logger.error('Error searching IMPA catalog:', error);
      throw new AppError('Failed to search IMPA catalog', 500, 'IMPA_SEARCH_ERROR');
    }
  }

  /**
   * Get specific IMPA item by code
   */
  async getIMPAItem(impaCode: string): Promise<IMPAItem | null> {
    try {
      const cacheKey = `impa_item_${impaCode}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await fetch(`${this.impaApiUrl}/catalog/items/${impaCode}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new AppError(`IMPA API error: ${response.statusText}`, response.status, 'IMPA_API_ERROR');
      }

      const data = await response.json();
      const item = this.mapIMPAItem(data);
      
      this.setCache(cacheKey, item, 600000); // Cache for 10 minutes
      return item;
    } catch (error) {
      logger.error('Error fetching IMPA item:', error);
      throw new AppError('Failed to fetch IMPA item', 500, 'IMPA_FETCH_ERROR');
    }
  }

  /**
   * Search ISSA catalog for items
   */
  async searchISSACatalog(params: CatalogSearchParams): Promise<ISSAItem[]> {
    try {
      const cacheKey = `issa_search_${JSON.stringify(params)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const queryParams = new URLSearchParams();
      if (params.query) queryParams.append('search', params.query);
      if (params.issaCode) queryParams.append('issa_code', params.issaCode);
      if (params.category) queryParams.append('category', params.category);
      queryParams.append('limit', (params.limit || 50).toString());

      const response = await fetch(`${this.issaApiUrl}/catalog/search?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new AppError(`ISSA API error: ${response.statusText}`, response.status, 'ISSA_API_ERROR');
      }

      const data = await response.json();
      const items = data.items.map((item: any) => this.mapISSAItem(item));
      
      this.setCache(cacheKey, items, 300000); // Cache for 5 minutes
      return items;
    } catch (error) {
      logger.error('Error searching ISSA catalog:', error);
      throw new AppError('Failed to search ISSA catalog', 500, 'ISSA_SEARCH_ERROR');
    }
  }

  /**
   * Get specific ISSA item by code
   */
  async getISSAItem(issaCode: string): Promise<ISSAItem | null> {
    try {
      const cacheKey = `issa_item_${issaCode}`;
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }

      const response = await fetch(`${this.issaApiUrl}/catalog/items/${issaCode}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new AppError(`ISSA API error: ${response.statusText}`, response.status, 'ISSA_API_ERROR');
      }

      const data = await response.json();
      const item = this.mapISSAItem(data);
      
      this.setCache(cacheKey, item, 600000); // Cache for 10 minutes
      return item;
    } catch (error) {
      logger.error('Error fetching ISSA item:', error);
      throw new AppError('Failed to fetch ISSA item', 500, 'ISSA_FETCH_ERROR');
    }
  }

  /**
   * Get combined catalog data (IMPA + ISSA)
   */
  async getCombinedCatalogData(params: CatalogSearchParams): Promise<{
    impaItems: IMPAItem[];
    issaItems: ISSAItem[];
    total: number;
  }> {
    try {
      const [impaResult, issaItems] = await Promise.all([
        this.searchIMPACatalog(params),
        this.searchISSACatalog(params)
      ]);

      return {
        impaItems: impaResult.items,
        issaItems,
        total: impaResult.total + issaItems.length
      };
    } catch (error) {
      logger.error('Error fetching combined catalog data:', error);
      throw new AppError('Failed to fetch combined catalog data', 500, 'CATALOG_FETCH_ERROR');
    }
  }

  /**
   * Sync catalog updates from external APIs
   */
  async syncCatalogUpdates(lastSyncDate?: Date): Promise<{
    impaUpdates: number;
    issaUpdates: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let impaUpdates = 0;
    let issaUpdates = 0;

    try {
      // Sync IMPA updates
      const impaParams = new URLSearchParams();
      if (lastSyncDate) {
        impaParams.append('updated_since', lastSyncDate.toISOString());
      }

      const impaResponse = await fetch(`${this.impaApiUrl}/catalog/updates?${impaParams}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (impaResponse.ok) {
        const impaData = await impaResponse.json();
        impaUpdates = impaData.updates?.length || 0;
        
        // Process IMPA updates
        for (const update of impaData.updates || []) {
          try {
            await this.processIMPAUpdate(update);
          } catch (error) {
            errors.push(`IMPA update error for ${update.impaCode}: ${error.message}`);
          }
        }
      } else {
        errors.push(`IMPA sync failed: ${impaResponse.statusText}`);
      }
    } catch (error) {
      errors.push(`IMPA sync error: ${error.message}`);
    }

    try {
      // Sync ISSA updates
      const issaParams = new URLSearchParams();
      if (lastSyncDate) {
        issaParams.append('modified_since', lastSyncDate.toISOString());
      }

      const issaResponse = await fetch(`${this.issaApiUrl}/catalog/updates?${issaParams}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      if (issaResponse.ok) {
        const issaData = await issaResponse.json();
        issaUpdates = issaData.updates?.length || 0;
        
        // Process ISSA updates
        for (const update of issaData.updates || []) {
          try {
            await this.processISSAUpdate(update);
          } catch (error) {
            errors.push(`ISSA update error for ${update.issaCode}: ${error.message}`);
          }
        }
      } else {
        errors.push(`ISSA sync failed: ${issaResponse.statusText}`);
      }
    } catch (error) {
      errors.push(`ISSA sync error: ${error.message}`);
    }

    return { impaUpdates, issaUpdates, errors };
  }

  private mapIMPAItem(data: any): IMPAItem {
    return {
      impaCode: data.impa_code,
      issaCode: data.issa_code,
      name: data.name,
      description: data.description,
      category: data.category,
      subCategory: data.sub_category,
      unitOfMeasure: data.unit_of_measure,
      specifications: data.specifications || {},
      compatibleVesselTypes: data.compatible_vessel_types || [],
      compatibleEngineTypes: data.compatible_engine_types || [],
      averagePrice: data.average_price,
      currency: data.currency,
      leadTime: data.lead_time,
      suppliers: data.suppliers || [],
      lastUpdated: new Date(data.last_updated)
    };
  }

  private mapISSAItem(data: any): ISSAItem {
    return {
      issaCode: data.issa_code,
      impaCode: data.impa_code,
      name: data.name,
      description: data.description,
      category: data.category,
      technicalSpecs: data.technical_specs || {},
      safetyClassification: data.safety_classification,
      certificationRequired: data.certification_required || false,
      storageRequirements: data.storage_requirements,
      handlingInstructions: data.handling_instructions,
      lastUpdated: new Date(data.last_updated)
    };
  }

  private async processIMPAUpdate(update: any): Promise<void> {
    // This would integrate with local database to update item catalog
    logger.info(`Processing IMPA update for ${update.impaCode}`);
    // Implementation would depend on local database structure
  }

  private async processISSAUpdate(update: any): Promise<void> {
    // This would integrate with local database to update item catalog
    logger.info(`Processing ISSA update for ${update.issaCode}`);
    // Implementation would depend on local database structure
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

export const impaCatalogIntegrationService = new IMPACatalogIntegrationService();