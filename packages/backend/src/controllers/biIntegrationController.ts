import { Request, Response } from 'express';
import { BIIntegrationService } from '../services/biIntegrationService';
import { DataWarehouseService } from '../services/dataWarehouseService';
import { OLAPCubeService } from '../services/olapCubeService';
import { ExternalAnalyticsAPIService } from '../services/externalAnalyticsApiService';
import { RealTimeStreamingService } from '../services/realTimeStreamingService';
import { logger } from '../utils/logger';

export class BIIntegrationController {
  private biIntegrationService: BIIntegrationService;
  private dataWarehouseService: DataWarehouseService;
  private olapCubeService: OLAPCubeService;
  private externalAnalyticsService: ExternalAnalyticsAPIService;
  private streamingService: RealTimeStreamingService;

  constructor(
    dbPool: any,
    warehousePool: any,
    io: any
  ) {
    this.biIntegrationService = new BIIntegrationService(dbPool);
    this.dataWarehouseService = new DataWarehouseService(dbPool, warehousePool);
    this.olapCubeService = new OLAPCubeService(warehousePool);
    this.externalAnalyticsService = new ExternalAnalyticsAPIService(dbPool);
    this.streamingService = new RealTimeStreamingService(dbPool, io);
  }

  // BI Tool Integration Endpoints
  async getBIToolConfigs(req: Request, res: Response): Promise<void> {
    try {
      const configs = await this.biIntegrationService.getBIToolConfigs();
      res.json({
        success: true,
        data: configs
      });
    } catch (error) {
      logger.error('Failed to get BI tool configurations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get BI tool configurations'
      });
    }
  }

  async updateBIToolConfig(req: Request, res: Response): Promise<void> {
    try {
      const { toolId } = req.params;
      const config = req.body;

      await this.biIntegrationService.updateBIToolConfig(toolId, config);
      
      res.json({
        success: true,
        message: `BI tool configuration updated for ${toolId}`
      });
    } catch (error) {
      logger.error('Failed to update BI tool configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update BI tool configuration'
      });
    }
  }

  async testBIToolConnection(req: Request, res: Response): Promise<void> {
    try {
      const { toolId } = req.params;
      const isConnected = await this.biIntegrationService.testBIToolConnection(toolId);
      
      res.json({
        success: true,
        data: {
          toolId,
          connected: isConnected,
          timestamp: new Date()
        }
      });
    } catch (error) {
      logger.error('Failed to test BI tool connection:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test BI tool connection'
      });
    }
  }

  async syncDataToBITools(req: Request, res: Response): Promise<void> {
    try {
      const { dataSourceId } = req.params;
      const parameters = req.body.parameters || {};

      await this.biIntegrationService.syncDataToAllBITools(dataSourceId, parameters);
      
      res.json({
        success: true,
        message: `Data sync initiated for data source ${dataSourceId}`
      });
    } catch (error) {
      logger.error('Failed to sync data to BI tools:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to sync data to BI tools'
      });
    }
  }

  async getDataSources(req: Request, res: Response): Promise<void> {
    try {
      const dataSources = await this.biIntegrationService.getDataSources();
      res.json({
        success: true,
        data: dataSources
      });
    } catch (error) {
      logger.error('Failed to get data sources:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get data sources'
      });
    }
  }

  async executeDataSourceQuery(req: Request, res: Response): Promise<void> {
    try {
      const { dataSourceId } = req.params;
      const parameters = req.body.parameters || {};

      const data = await this.biIntegrationService.executeDataSourceQuery(dataSourceId, parameters);
      
      res.json({
        success: true,
        data: {
          dataSourceId,
          recordCount: data.length,
          data: data.slice(0, 1000), // Limit response size
          hasMore: data.length > 1000
        }
      });
    } catch (error) {
      logger.error('Failed to execute data source query:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute data source query'
      });
    }
  }

  // Data Warehouse Endpoints
  async getETLJobs(req: Request, res: Response): Promise<void> {
    try {
      const jobs = await this.dataWarehouseService.getETLJobs();
      res.json({
        success: true,
        data: jobs
      });
    } catch (error) {
      logger.error('Failed to get ETL jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get ETL jobs'
      });
    }
  }

  async runETLJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const parameters = req.body.parameters || {};

      await this.dataWarehouseService.runETLJob(jobId, parameters);
      
      res.json({
        success: true,
        message: `ETL job ${jobId} started successfully`
      });
    } catch (error) {
      logger.error('Failed to run ETL job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run ETL job'
      });
    }
  }

  async getETLJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const status = await this.dataWarehouseService.getETLJobStatus(jobId);
      
      if (!status) {
        res.status(404).json({
          success: false,
          error: 'ETL job not found'
        });
        return;
      }

      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      logger.error('Failed to get ETL job status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get ETL job status'
      });
    }
  }

  async enableETLJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      await this.dataWarehouseService.enableETLJob(jobId);
      
      res.json({
        success: true,
        message: `ETL job ${jobId} enabled`
      });
    } catch (error) {
      logger.error('Failed to enable ETL job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to enable ETL job'
      });
    }
  }

  async disableETLJob(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      await this.dataWarehouseService.disableETLJob(jobId);
      
      res.json({
        success: true,
        message: `ETL job ${jobId} disabled`
      });
    } catch (error) {
      logger.error('Failed to disable ETL job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to disable ETL job'
      });
    }
  }

  async runDataQualityCheck(req: Request, res: Response): Promise<void> {
    try {
      const { ruleId } = req.query;
      const results = await this.dataWarehouseService.runDataQualityCheck(ruleId as string);
      
      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Failed to run data quality check:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run data quality check'
      });
    }
  }

  async getDataQualityRules(req: Request, res: Response): Promise<void> {
    try {
      const rules = await this.dataWarehouseService.getDataQualityRules();
      res.json({
        success: true,
        data: rules
      });
    } catch (error) {
      logger.error('Failed to get data quality rules:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get data quality rules'
      });
    }
  }

  // OLAP Cube Endpoints
  async getAllCubes(req: Request, res: Response): Promise<void> {
    try {
      const cubes = await this.olapCubeService.getAllCubes();
      res.json({
        success: true,
        data: cubes
      });
    } catch (error) {
      logger.error('Failed to get OLAP cubes:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get OLAP cubes'
      });
    }
  }

  async getCubeMetadata(req: Request, res: Response): Promise<void> {
    try {
      const { cubeName } = req.params;
      const metadata = await this.olapCubeService.getCubeMetadata(cubeName);
      
      if (!metadata) {
        res.status(404).json({
          success: false,
          error: 'Cube not found'
        });
        return;
      }

      res.json({
        success: true,
        data: metadata
      });
    } catch (error) {
      logger.error('Failed to get cube metadata:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cube metadata'
      });
    }
  }

  async executeMDXQuery(req: Request, res: Response): Promise<void> {
    try {
      const { cubeName } = req.params;
      const { mdxQuery } = req.body;

      const result = await this.olapCubeService.executeMDXQuery(cubeName, mdxQuery);
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to execute MDX query:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute MDX query'
      });
    }
  }

  async getDimensionMembers(req: Request, res: Response): Promise<void> {
    try {
      const { cubeName, dimensionName } = req.params;
      const { hierarchyName } = req.query;

      const members = await this.olapCubeService.getDimensionMembers(
        cubeName, 
        dimensionName, 
        hierarchyName as string
      );
      
      res.json({
        success: true,
        data: members
      });
    } catch (error) {
      logger.error('Failed to get dimension members:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dimension members'
      });
    }
  }

  async executeSliceAndDice(req: Request, res: Response): Promise<void> {
    try {
      const { cubeName } = req.params;
      const { dimensions, measures, filters } = req.body;

      const result = await this.olapCubeService.executeSliceAndDice(
        cubeName, 
        dimensions, 
        measures, 
        filters
      );
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Failed to execute slice and dice:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute slice and dice'
      });
    }
  }

  async calculateRankings(req: Request, res: Response): Promise<void> {
    try {
      const { cubeName } = req.params;
      const { dimension, measure, topN = 10 } = req.body;

      const rankings = await this.olapCubeService.calculateRankings(
        cubeName, 
        dimension, 
        measure, 
        topN
      );
      
      res.json({
        success: true,
        data: rankings
      });
    } catch (error) {
      logger.error('Failed to calculate rankings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate rankings'
      });
    }
  }

  async getCubeStatistics(req: Request, res: Response): Promise<void> {
    try {
      const { cubeName } = req.params;
      const statistics = await this.olapCubeService.getCubeStatistics(cubeName);
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Failed to get cube statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cube statistics'
      });
    }
  }

  async refreshCube(req: Request, res: Response): Promise<void> {
    try {
      const { cubeName } = req.params;
      await this.olapCubeService.refreshCube(cubeName);
      
      res.json({
        success: true,
        message: `Cube ${cubeName} refresh initiated`
      });
    } catch (error) {
      logger.error('Failed to refresh cube:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to refresh cube'
      });
    }
  }

  // External Analytics API Endpoints
  async getAPIKeys(req: Request, res: Response): Promise<void> {
    try {
      const { clientId } = req.query;
      const apiKeys = await this.externalAnalyticsService.getAPIKeys(clientId as string);
      
      res.json({
        success: true,
        data: apiKeys
      });
    } catch (error) {
      logger.error('Failed to get API keys:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get API keys'
      });
    }
  }

  async createAPIKey(req: Request, res: Response): Promise<void> {
    try {
      const { name, clientId, permissions, rateLimit, expiresAt } = req.body;

      const apiKey = await this.externalAnalyticsService.createAPIKey(
        name,
        clientId,
        permissions,
        rateLimit,
        expiresAt ? new Date(expiresAt) : undefined
      );
      
      res.status(201).json({
        success: true,
        data: apiKey
      });
    } catch (error) {
      logger.error('Failed to create API key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create API key'
      });
    }
  }

  async revokeAPIKey(req: Request, res: Response): Promise<void> {
    try {
      const { keyId } = req.params;
      await this.externalAnalyticsService.revokeAPIKey(keyId);
      
      res.json({
        success: true,
        message: `API key ${keyId} revoked`
      });
    } catch (error) {
      logger.error('Failed to revoke API key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke API key'
      });
    }
  }

  async getExportRequests(req: Request, res: Response): Promise<void> {
    try {
      const { apiKeyId } = req.query;
      const requests = await this.externalAnalyticsService.getExportRequests(apiKeyId as string);
      
      res.json({
        success: true,
        data: requests
      });
    } catch (error) {
      logger.error('Failed to get export requests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get export requests'
      });
    }
  }

  async createBatchExport(req: Request, res: Response): Promise<void> {
    try {
      const { apiKeyId, endpoint, parameters, format } = req.body;

      const exportRequest = await this.externalAnalyticsService.createBatchExport(
        apiKeyId,
        endpoint,
        parameters,
        format
      );
      
      res.status(201).json({
        success: true,
        data: exportRequest
      });
    } catch (error) {
      logger.error('Failed to create batch export:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create batch export'
      });
    }
  }

  async getExternalAPIEndpoints(req: Request, res: Response): Promise<void> {
    try {
      const endpoints = this.externalAnalyticsService.getEndpoints();
      res.json({
        success: true,
        data: endpoints
      });
    } catch (error) {
      logger.error('Failed to get external API endpoints:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get external API endpoints'
      });
    }
  }

  // Real-Time Streaming Endpoints
  async getStreams(req: Request, res: Response): Promise<void> {
    try {
      const streams = this.streamingService.getStreams();
      res.json({
        success: true,
        data: streams
      });
    } catch (error) {
      logger.error('Failed to get streams:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get streams'
      });
    }
  }

  async createStream(req: Request, res: Response): Promise<void> {
    try {
      const streamConfig = req.body;
      const stream = await this.streamingService.createStream(streamConfig);
      
      res.status(201).json({
        success: true,
        data: stream
      });
    } catch (error) {
      logger.error('Failed to create stream:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create stream'
      });
    }
  }

  async updateStream(req: Request, res: Response): Promise<void> {
    try {
      const { streamId } = req.params;
      const updates = req.body;

      await this.streamingService.updateStream(streamId, updates);
      
      res.json({
        success: true,
        message: `Stream ${streamId} updated`
      });
    } catch (error) {
      logger.error('Failed to update stream:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update stream'
      });
    }
  }

  async deleteStream(req: Request, res: Response): Promise<void> {
    try {
      const { streamId } = req.params;
      await this.streamingService.deleteStream(streamId);
      
      res.json({
        success: true,
        message: `Stream ${streamId} deleted`
      });
    } catch (error) {
      logger.error('Failed to delete stream:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete stream'
      });
    }
  }

  async getStreamMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { streamId } = req.query;
      const metrics = this.streamingService.getStreamMetrics(streamId as string);
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Failed to get stream metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stream metrics'
      });
    }
  }

  async getAlertRules(req: Request, res: Response): Promise<void> {
    try {
      const rules = this.streamingService.getAlertRules();
      res.json({
        success: true,
        data: rules
      });
    } catch (error) {
      logger.error('Failed to get alert rules:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get alert rules'
      });
    }
  }

  async createAlertRule(req: Request, res: Response): Promise<void> {
    try {
      const ruleConfig = req.body;
      const rule = await this.streamingService.createAlertRule(ruleConfig);
      
      res.status(201).json({
        success: true,
        data: rule
      });
    } catch (error) {
      logger.error('Failed to create alert rule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create alert rule'
      });
    }
  }
}