import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

const prisma = new PrismaClient();

export interface BIConfiguration {
  id: string;
  name: string;
  type: 'powerbi' | 'tableau' | 'qlik' | 'generic';
  isActive: boolean;
  configuration: Record<string, any>;
  authentication: {
    type: 'oauth' | 'api_key' | 'basic';
    credentials: Record<string, any>;
  };
  dataMapping: {
    tables: string[];
    fields: Record<string, string>;
    filters: Record<string, any>;
  };
  refreshSchedule?: {
    frequency: 'hourly' | 'daily' | 'weekly';
    time?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface DataSourceConfig {
  connectionString: string;
  tables: string[];
  views: string[];
  permissions: string[];
}

export class BIIntegrationService {
  private configurations: Map<string, BIConfiguration> = new Map();
  private dbPool?: any;

  constructor(dbPool?: any) {
    this.dbPool = dbPool;
    this.loadConfigurations();
  }

  private async loadConfigurations(): Promise<void> {
    try {
      // Load BI configurations from database
      const configs = await prisma.bIConfiguration.findMany({
        where: { isActive: true }
      });

      configs.forEach(config => {
        this.configurations.set(config.id, {
          id: config.id,
          name: config.name,
          type: config.type as any,
          isActive: config.isActive,
          configuration: config.configuration as Record<string, any>,
          authentication: config.authentication as any,
          dataMapping: config.dataMapping as any,
          refreshSchedule: config.refreshSchedule as any,
          createdAt: config.createdAt,
          updatedAt: config.updatedAt
        });
      });

      logger.info(`Loaded ${configs.length} BI configurations`);
    } catch (error) {
      logger.error('Failed to load BI configurations:', error);
    }
  }

  async createConfiguration(config: Omit<BIConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<BIConfiguration> {
    try {
      const newConfig = await prisma.bIConfiguration.create({
        data: {
          name: config.name,
          type: config.type,
          isActive: config.isActive,
          configuration: config.configuration,
          authentication: config.authentication,
          dataMapping: config.dataMapping,
          refreshSchedule: config.refreshSchedule
        }
      });

      const biConfig: BIConfiguration = {
        id: newConfig.id,
        name: newConfig.name,
        type: newConfig.type as any,
        isActive: newConfig.isActive,
        configuration: newConfig.configuration as Record<string, any>,
        authentication: newConfig.authentication as any,
        dataMapping: newConfig.dataMapping as any,
        refreshSchedule: newConfig.refreshSchedule as any,
        createdAt: newConfig.createdAt,
        updatedAt: newConfig.updatedAt
      };

      this.configurations.set(biConfig.id, biConfig);
      
      logger.info(`Created BI configuration: ${config.name}`);
      return biConfig;
    } catch (error) {
      logger.error('Failed to create BI configuration:', error);
      throw new AppError('Failed to create BI configuration', 500, 'BI_CONFIG_CREATE_ERROR');
    }
  }

  async updateConfiguration(id: string, updates: Partial<BIConfiguration>): Promise<BIConfiguration> {
    try {
      const updatedConfig = await prisma.bIConfiguration.update({
        where: { id },
        data: {
          name: updates.name,
          type: updates.type,
          isActive: updates.isActive,
          configuration: updates.configuration,
          authentication: updates.authentication,
          dataMapping: updates.dataMapping,
          refreshSchedule: updates.refreshSchedule
        }
      });

      const biConfig: BIConfiguration = {
        id: updatedConfig.id,
        name: updatedConfig.name,
        type: updatedConfig.type as any,
        isActive: updatedConfig.isActive,
        configuration: updatedConfig.configuration as Record<string, any>,
        authentication: updatedConfig.authentication as any,
        dataMapping: updatedConfig.dataMapping as any,
        refreshSchedule: updatedConfig.refreshSchedule as any,
        createdAt: updatedConfig.createdAt,
        updatedAt: updatedConfig.updatedAt
      };

      this.configurations.set(id, biConfig);
      
      logger.info(`Updated BI configuration: ${id}`);
      return biConfig;
    } catch (error) {
      logger.error('Failed to update BI configuration:', error);
      throw new AppError('Failed to update BI configuration', 500, 'BI_CONFIG_UPDATE_ERROR');
    }
  }

  async deleteConfiguration(id: string): Promise<void> {
    try {
      await prisma.bIConfiguration.delete({
        where: { id }
      });

      this.configurations.delete(id);
      
      logger.info(`Deleted BI configuration: ${id}`);
    } catch (error) {
      logger.error('Failed to delete BI configuration:', error);
      throw new AppError('Failed to delete BI configuration', 500, 'BI_CONFIG_DELETE_ERROR');
    }
  }

  getConfiguration(id: string): BIConfiguration | undefined {
    return this.configurations.get(id);
  }

  getAllConfigurations(): BIConfiguration[] {
    return Array.from(this.configurations.values());
  }

  async testConnection(id: string): Promise<{ success: boolean; message: string }> {
    const config = this.configurations.get(id);
    if (!config) {
      throw new AppError('BI configuration not found', 404, 'BI_CONFIG_NOT_FOUND');
    }

    try {
      switch (config.type) {
        case 'powerbi':
          return await this.testPowerBIConnection(config);
        case 'tableau':
          return await this.testTableauConnection(config);
        case 'qlik':
          return await this.testQlikConnection(config);
        case 'generic':
          return await this.testGenericConnection(config);
        default:
          throw new AppError('Unsupported BI tool type', 400, 'UNSUPPORTED_BI_TYPE');
      }
    } catch (error) {
      logger.error(`Failed to test BI connection for ${id}:`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed'
      };
    }
  }

  private async testPowerBIConnection(config: BIConfiguration): Promise<{ success: boolean; message: string }> {
    const { tenantId, clientId, clientSecret } = config.authentication.credentials;
    
    try {
      const tokenResponse = await axios.post(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: 'https://analysis.windows.net/powerbi/api/.default',
          grant_type: 'client_credentials'
        }),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        }
      );

      if (tokenResponse.data.access_token) {
        return { success: true, message: 'Power BI connection successful' };
      } else {
        return { success: false, message: 'Failed to obtain Power BI access token' };
      }
    } catch (error) {
      return { success: false, message: `Power BI connection failed: ${error}` };
    }
  }

  private async testTableauConnection(config: BIConfiguration): Promise<{ success: boolean; message: string }> {
    const { serverUrl, username, password, siteName } = config.authentication.credentials;
    
    try {
      const signInResponse = await axios.post(
        `${serverUrl}/api/3.9/auth/signin`,
        {
          tsRequest: {
            credentials: {
              name: username,
              password: password,
              site: { contentUrl: siteName }
            }
          }
        },
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );

      if (signInResponse.data.tsResponse?.credentials?.token) {
        return { success: true, message: 'Tableau connection successful' };
      } else {
        return { success: false, message: 'Failed to authenticate with Tableau' };
      }
    } catch (error) {
      return { success: false, message: `Tableau connection failed: ${error}` };
    }
  }

  private async testQlikConnection(config: BIConfiguration): Promise<{ success: boolean; message: string }> {
    const { serverUrl, apiKey } = config.authentication.credentials;
    
    try {
      const response = await axios.get(
        `${serverUrl}/api/v1/about`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        return { success: true, message: 'Qlik Sense connection successful' };
      } else {
        return { success: false, message: 'Failed to connect to Qlik Sense' };
      }
    } catch (error) {
      return { success: false, message: `Qlik Sense connection failed: ${error}` };
    }
  }

  private async testGenericConnection(config: BIConfiguration): Promise<{ success: boolean; message: string }> {
    const { endpoint, apiKey } = config.authentication.credentials;
    
    try {
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        return { success: true, message: 'Generic API connection successful' };
      } else {
        return { success: false, message: 'Failed to connect to generic API' };
      }
    } catch (error) {
      return { success: false, message: `Generic API connection failed: ${error}` };
    }
  }

  async generateDataSourceConfig(configId: string): Promise<DataSourceConfig> {
    const config = this.configurations.get(configId);
    if (!config) {
      throw new AppError('BI configuration not found', 404, 'BI_CONFIG_NOT_FOUND');
    }

    const connectionString = this.buildConnectionString(config);
    const tables = config.dataMapping.tables || [];
    const views = await this.getAvailableViews();
    const permissions = await this.getDataPermissions(config);

    return {
      connectionString,
      tables,
      views,
      permissions
    };
  }

  private buildConnectionString(config: BIConfiguration): string {
    const dbConfig = process.env.DATABASE_URL;
    if (!dbConfig) {
      throw new AppError('Database configuration not found', 500, 'DB_CONFIG_ERROR');
    }

    // Parse database URL and create BI-specific connection string
    const url = new URL(dbConfig);
    return `Server=${url.hostname};Port=${url.port};Database=${url.pathname.slice(1)};Uid=bi_user;Pwd=${process.env.BI_DB_PASSWORD};`;
  }

  private async getAvailableViews(): Promise<string[]> {
    try {
      const views = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = 'public'
        AND table_name LIKE 'bi_%'
      `;
      
      return views.map(v => v.table_name);
    } catch (error) {
      logger.error('Failed to get available views:', error);
      return [];
    }
  }

  private async getDataPermissions(config: BIConfiguration): Promise<string[]> {
    // Return permissions based on BI tool type and configuration
    const basePermissions = ['SELECT'];
    
    if (config.type === 'powerbi' || config.type === 'tableau') {
      basePermissions.push('CONNECT');
    }
    
    return basePermissions;
  }

  // Methods expected by the controller
  async getBIToolConfigs(): Promise<BIConfiguration[]> {
    return Array.from(this.configurations.values());
  }

  async updateBIToolConfig(toolId: string, config: Partial<BIConfiguration>): Promise<void> {
    await this.updateConfiguration(toolId, config);
  }

  async testBIToolConnection(toolId: string): Promise<boolean> {
    const result = await this.testConnection(toolId);
    return result.success;
  }

  async syncDataToAllBITools(dataSourceId: string, parameters: Record<string, any>): Promise<void> {
    // Implementation for syncing data to all BI tools
    const activeConfigs = Array.from(this.configurations.values()).filter(c => c.isActive);
    
    for (const config of activeConfigs) {
      try {
        await this.syncDataToBITool(config.id, dataSourceId, parameters);
      } catch (error) {
        logger.error(`Failed to sync data to BI tool ${config.name}:`, error);
      }
    }
  }

  private async syncDataToBITool(configId: string, dataSourceId: string, parameters: Record<string, any>): Promise<void> {
    // Implementation for syncing data to a specific BI tool
    const config = this.configurations.get(configId);
    if (!config) {
      throw new Error(`BI configuration not found: ${configId}`);
    }

    // Sync logic based on BI tool type
    switch (config.type) {
      case 'powerbi':
        await this.syncToPowerBI(config, dataSourceId, parameters);
        break;
      case 'tableau':
        await this.syncToTableau(config, dataSourceId, parameters);
        break;
      case 'qlik':
        await this.syncToQlik(config, dataSourceId, parameters);
        break;
      default:
        await this.syncToGeneric(config, dataSourceId, parameters);
    }
  }

  private async syncToPowerBI(config: BIConfiguration, dataSourceId: string, parameters: Record<string, any>): Promise<void> {
    // PowerBI sync implementation
    logger.info(`Syncing data to PowerBI for data source ${dataSourceId}`);
  }

  private async syncToTableau(config: BIConfiguration, dataSourceId: string, parameters: Record<string, any>): Promise<void> {
    // Tableau sync implementation
    logger.info(`Syncing data to Tableau for data source ${dataSourceId}`);
  }

  private async syncToQlik(config: BIConfiguration, dataSourceId: string, parameters: Record<string, any>): Promise<void> {
    // Qlik sync implementation
    logger.info(`Syncing data to Qlik for data source ${dataSourceId}`);
  }

  private async syncToGeneric(config: BIConfiguration, dataSourceId: string, parameters: Record<string, any>): Promise<void> {
    // Generic BI tool sync implementation
    logger.info(`Syncing data to generic BI tool for data source ${dataSourceId}`);
  }

  async getDataSources(): Promise<any[]> {
    // Return available data sources
    try {
      const dataSources = await prisma.$queryRaw<Array<{ table_name: string }>>`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      `;
      
      return dataSources.map(ds => ({
        id: ds.table_name,
        name: ds.table_name,
        type: 'table'
      }));
    } catch (error) {
      logger.error('Failed to get data sources:', error);
      return [];
    }
  }

  async executeDataSourceQuery(dataSourceId: string, parameters: Record<string, any>): Promise<any[]> {
    // Execute query on data source
    try {
      // This is a simplified implementation - in production you'd want proper query building and validation
      const query = `SELECT * FROM ${dataSourceId} LIMIT 1000`;
      const result = await prisma.$queryRawUnsafe(query);
      return result as any[];
    } catch (error) {
      logger.error(`Failed to execute query on data source ${dataSourceId}:`, error);
      return [];
    }
  }
}

export const biIntegrationService = new BIIntegrationService();