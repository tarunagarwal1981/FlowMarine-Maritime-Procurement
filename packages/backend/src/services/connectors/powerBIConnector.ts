import axios from 'axios';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';
import { BIConfiguration } from '../biIntegrationService';

export interface PowerBIDataset {
  id: string;
  name: string;
  tables: PowerBITable[];
  webUrl: string;
  isRefreshable: boolean;
}

export interface PowerBITable {
  name: string;
  columns: PowerBIColumn[];
  measures: PowerBIMeasure[];
  source: {
    expression: string;
  };
}

export interface PowerBIColumn {
  name: string;
  dataType: string;
  isHidden: boolean;
}

export interface PowerBIMeasure {
  name: string;
  expression: string;
  formatString: string;
}

export interface PowerBIRefreshRequest {
  type: 'full' | 'automatic' | 'dataOnly' | 'calculate' | 'clearValues' | 'defragment';
  commitMode?: 'transactional' | 'partialBatch';
  maxParallelism?: number;
  retryCount?: number;
  objects?: Array<{
    table: string;
    partition?: string;
  }>;
}

export class PowerBIConnector {
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;
  private config: BIConfiguration;

  constructor(config: BIConfiguration) {
    this.config = config;
  }

  async authenticate(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.accessToken;
    }

    const { tenantId, clientId, clientSecret } = this.config.authentication.credentials;

    try {
      const response = await axios.post(
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

      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));

      logger.info('Power BI authentication successful');
      return this.accessToken;
    } catch (error) {
      logger.error('Power BI authentication failed:', error);
      throw new AppError('Power BI authentication failed', 401, 'POWERBI_AUTH_ERROR');
    }
  }

  async createDataset(datasetDefinition: Partial<PowerBIDataset>): Promise<PowerBIDataset> {
    const token = await this.authenticate();
    const { workspaceId } = this.config.configuration;

    try {
      const response = await axios.post(
        `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets`,
        {
          name: datasetDefinition.name,
          tables: datasetDefinition.tables?.map(table => ({
            name: table.name,
            columns: table.columns?.map(col => ({
              name: col.name,
              dataType: col.dataType
            }))
          }))
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Created Power BI dataset: ${datasetDefinition.name}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to create Power BI dataset:', error);
      throw new AppError('Failed to create Power BI dataset', 500, 'POWERBI_DATASET_CREATE_ERROR');
    }
  }

  async updateDatasetSchema(datasetId: string, tables: PowerBITable[]): Promise<void> {
    const token = await this.authenticate();
    const { workspaceId } = this.config.configuration;

    try {
      await axios.put(
        `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/tables`,
        { tables },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Updated Power BI dataset schema: ${datasetId}`);
    } catch (error) {
      logger.error('Failed to update Power BI dataset schema:', error);
      throw new AppError('Failed to update dataset schema', 500, 'POWERBI_SCHEMA_UPDATE_ERROR');
    }
  }

  async pushData(datasetId: string, tableName: string, data: any[]): Promise<void> {
    const token = await this.authenticate();
    const { workspaceId } = this.config.configuration;

    try {
      await axios.post(
        `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/tables/${tableName}/rows`,
        { rows: data },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Pushed ${data.length} rows to Power BI table: ${tableName}`);
    } catch (error) {
      logger.error('Failed to push data to Power BI:', error);
      throw new AppError('Failed to push data to Power BI', 500, 'POWERBI_DATA_PUSH_ERROR');
    }
  }

  async refreshDataset(datasetId: string, refreshRequest?: PowerBIRefreshRequest): Promise<string> {
    const token = await this.authenticate();
    const { workspaceId } = this.config.configuration;

    try {
      const response = await axios.post(
        `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/refreshes`,
        refreshRequest || { type: 'full' },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const refreshId = response.headers['requestid'] || 'unknown';
      logger.info(`Started Power BI dataset refresh: ${datasetId}, Request ID: ${refreshId}`);
      return refreshId;
    } catch (error) {
      logger.error('Failed to refresh Power BI dataset:', error);
      throw new AppError('Failed to refresh dataset', 500, 'POWERBI_REFRESH_ERROR');
    }
  }

  async getRefreshStatus(datasetId: string, refreshId: string): Promise<any> {
    const token = await this.authenticate();
    const { workspaceId } = this.config.configuration;

    try {
      const response = await axios.get(
        `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/refreshes/${refreshId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      logger.error('Failed to get Power BI refresh status:', error);
      throw new AppError('Failed to get refresh status', 500, 'POWERBI_REFRESH_STATUS_ERROR');
    }
  }

  async createDataSource(datasetId: string, connectionDetails: any): Promise<void> {
    const token = await this.authenticate();
    const { workspaceId } = this.config.configuration;

    try {
      await axios.post(
        `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}/datasources`,
        {
          datasourceType: 'PostgreSql',
          connectionDetails: {
            server: connectionDetails.server,
            database: connectionDetails.database
          },
          credentialDetails: {
            credentialType: 'Basic',
            credentials: JSON.stringify({
              username: connectionDetails.username,
              password: connectionDetails.password
            }),
            encryptedConnection: 'Encrypted',
            encryptionAlgorithm: 'None',
            privacyLevel: 'Organizational'
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Created Power BI data source for dataset: ${datasetId}`);
    } catch (error) {
      logger.error('Failed to create Power BI data source:', error);
      throw new AppError('Failed to create data source', 500, 'POWERBI_DATASOURCE_CREATE_ERROR');
    }
  }

  async getDatasets(): Promise<PowerBIDataset[]> {
    const token = await this.authenticate();
    const { workspaceId } = this.config.configuration;

    try {
      const response = await axios.get(
        `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data.value;
    } catch (error) {
      logger.error('Failed to get Power BI datasets:', error);
      throw new AppError('Failed to get datasets', 500, 'POWERBI_DATASETS_GET_ERROR');
    }
  }

  async deleteDataset(datasetId: string): Promise<void> {
    const token = await this.authenticate();
    const { workspaceId } = this.config.configuration;

    try {
      await axios.delete(
        `https://api.powerbi.com/v1.0/myorg/groups/${workspaceId}/datasets/${datasetId}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Deleted Power BI dataset: ${datasetId}`);
    } catch (error) {
      logger.error('Failed to delete Power BI dataset:', error);
      throw new AppError('Failed to delete dataset', 500, 'POWERBI_DATASET_DELETE_ERROR');
    }
  }

  async setupFlowMarineDataset(): Promise<PowerBIDataset> {
    const fleetSpendTable: PowerBITable = {
      name: 'FleetSpendAnalytics',
      columns: [
        { name: 'VesselId', dataType: 'String', isHidden: false },
        { name: 'VesselName', dataType: 'String', isHidden: false },
        { name: 'Category', dataType: 'String', isHidden: false },
        { name: 'Amount', dataType: 'Decimal', isHidden: false },
        { name: 'Currency', dataType: 'String', isHidden: false },
        { name: 'Date', dataType: 'DateTime', isHidden: false },
        { name: 'VendorId', dataType: 'String', isHidden: false },
        { name: 'VendorName', dataType: 'String', isHidden: false }
      ],
      measures: [
        {
          name: 'TotalSpend',
          expression: 'SUM(FleetSpendAnalytics[Amount])',
          formatString: '#,##0.00'
        },
        {
          name: 'AverageSpend',
          expression: 'AVERAGE(FleetSpendAnalytics[Amount])',
          formatString: '#,##0.00'
        }
      ],
      source: {
        expression: 'SELECT * FROM bi_fleet_spend_analytics'
      }
    };

    const vendorPerformanceTable: PowerBITable = {
      name: 'VendorPerformance',
      columns: [
        { name: 'VendorId', dataType: 'String', isHidden: false },
        { name: 'VendorName', dataType: 'String', isHidden: false },
        { name: 'DeliveryScore', dataType: 'Decimal', isHidden: false },
        { name: 'QualityScore', dataType: 'Decimal', isHidden: false },
        { name: 'PriceScore', dataType: 'Decimal', isHidden: false },
        { name: 'OverallScore', dataType: 'Decimal', isHidden: false },
        { name: 'TotalOrders', dataType: 'Int64', isHidden: false },
        { name: 'OnTimeDeliveryRate', dataType: 'Decimal', isHidden: false }
      ],
      measures: [
        {
          name: 'AverageDeliveryScore',
          expression: 'AVERAGE(VendorPerformance[DeliveryScore])',
          formatString: '0.00'
        },
        {
          name: 'TopPerformers',
          expression: 'COUNTROWS(FILTER(VendorPerformance, VendorPerformance[OverallScore] >= 4.0))',
          formatString: '#,##0'
        }
      ],
      source: {
        expression: 'SELECT * FROM bi_vendor_performance'
      }
    };

    return await this.createDataset({
      name: 'FlowMarine Maritime Procurement Analytics',
      tables: [fleetSpendTable, vendorPerformanceTable],
      isRefreshable: true
    });
  }
}