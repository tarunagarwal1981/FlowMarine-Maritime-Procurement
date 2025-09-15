import { Request, Response } from 'express';
import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { EventEmitter } from 'events';

interface APIKey {
  id: string;
  name: string;
  key: string;
  clientId: string;
  permissions: string[];
  rateLimit: {
    requests: number;
    window: number; // in seconds
  };
  isActive: boolean;
  expiresAt?: Date;
  createdAt: Date;
  lastUsed?: Date;
}

interface DataExportRequest {
  id: string;
  apiKeyId: string;
  endpoint: string;
  parameters: Record<string, any>;
  format: 'json' | 'csv' | 'xml' | 'parquet';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  downloadUrl?: string;
  recordCount?: number;
  fileSizeBytes?: number;
  createdAt: Date;
  completedAt?: Date;
  expiresAt: Date;
}

interface StreamingSubscription {
  id: string;
  apiKeyId: string;
  eventTypes: string[];
  filters: Record<string, any>;
  webhookUrl?: string;
  isActive: boolean;
  createdAt: Date;
  lastDelivery?: Date;
}

interface APIEndpoint {
  path: string;
  method: 'GET' | 'POST';
  description: string;
  parameters: APIParameter[];
  responseSchema: any;
  requiredPermissions: string[];
  rateLimit?: {
    requests: number;
    window: number;
  };
}

interface APIParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'array';
  required: boolean;
  description: string;
  defaultValue?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

export class ExternalAnalyticsAPIService extends EventEmitter {
  private dbPool: Pool;
  private apiKeys: Map<string, APIKey> = new Map();
  private exportRequests: Map<string, DataExportRequest> = new Map();
  private streamingSubscriptions: Map<string, StreamingSubscription> = new Map();
  private endpoints: Map<string, APIEndpoint> = new Map();

  constructor(dbPool: Pool) {
    super();
    this.dbPool = dbPool;
    this.initializeEndpoints();
    this.setupEventHandlers();
  }

  private initializeEndpoints(): void {
    // Vessel Analytics Endpoint
    this.endpoints.set('/api/external/vessel-analytics', {
      path: '/api/external/vessel-analytics',
      method: 'GET',
      description: 'Get vessel performance and spending analytics',
      parameters: [
        {
          name: 'vessel_id',
          type: 'string',
          required: false,
          description: 'Filter by specific vessel ID'
        },
        {
          name: 'start_date',
          type: 'date',
          required: false,
          description: 'Start date for analytics period (ISO 8601 format)'
        },
        {
          name: 'end_date',
          type: 'date',
          required: false,
          description: 'End date for analytics period (ISO 8601 format)'
        },
        {
          name: 'metrics',
          type: 'array',
          required: false,
          description: 'Specific metrics to include',
          validation: {
            enum: ['spend', 'cycle_time', 'emergency_rate', 'vendor_performance']
          }
        },
        {
          name: 'group_by',
          type: 'string',
          required: false,
          description: 'Group results by time period',
          validation: {
            enum: ['day', 'week', 'month', 'quarter', 'year']
          }
        },
        {
          name: 'limit',
          type: 'number',
          required: false,
          description: 'Maximum number of records to return',
          defaultValue: 1000,
          validation: { min: 1, max: 10000 }
        },
        {
          name: 'offset',
          type: 'number',
          required: false,
          description: 'Number of records to skip for pagination',
          defaultValue: 0,
          validation: { min: 0 }
        }
      ],
      responseSchema: {
        type: 'object',
        properties: {
          data: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                vessel_id: { type: 'string' },
                vessel_name: { type: 'string' },
                period: { type: 'string' },
                total_spend: { type: 'number' },
                transaction_count: { type: 'number' },
                avg_cycle_time: { type: 'number' },
                emergency_rate: { type: 'number' }
              }
            }
          },
          pagination: {
            type: 'object',
            properties: {
              total: { type: 'number' },
              limit: { type: 'number' },
              offset: { type: 'number' },
              has_more: { type: 'boolean' }
            }
          }
        }
      },
      requiredPermissions: ['analytics:read', 'vessel:read']
    });

    // Procurement Metrics Endpoint
    this.endpoints.set('/api/external/procurement-metrics', {
      path: '/api/external/procurement-metrics',
      method: 'GET',
      description: 'Get procurement performance metrics and KPIs',
      parameters: [
        {
          name: 'start_date',
          type: 'date',
          required: true,
          description: 'Start date for metrics period'
        },
        {
          name: 'end_date',
          type: 'date',
          required: true,
          description: 'End date for metrics period'
        },
        {
          name: 'vessel_ids',
          type: 'array',
          required: false,
          description: 'Filter by specific vessel IDs'
        },
        {
          name: 'category_ids',
          type: 'array',
          required: false,
          description: 'Filter by procurement categories'
        },
        {
          name: 'aggregation',
          type: 'string',
          required: false,
          description: 'Aggregation level for metrics',
          defaultValue: 'daily',
          validation: {
            enum: ['hourly', 'daily', 'weekly', 'monthly']
          }
        }
      ],
      responseSchema: {
        type: 'object',
        properties: {
          metrics: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                period: { type: 'string' },
                total_requisitions: { type: 'number' },
                completed_requisitions: { type: 'number' },
                avg_approval_time: { type: 'number' },
                avg_procurement_time: { type: 'number' },
                emergency_requisitions: { type: 'number' },
                total_value: { type: 'number' },
                vendor_count: { type: 'number' }
              }
            }
          }
        }
      },
      requiredPermissions: ['analytics:read', 'procurement:read']
    });

    // Financial Data Endpoint
    this.endpoints.set('/api/external/financial-data', {
      path: '/api/external/financial-data',
      method: 'GET',
      description: 'Get financial analytics and spending data',
      parameters: [
        {
          name: 'start_date',
          type: 'date',
          required: true,
          description: 'Start date for financial period'
        },
        {
          name: 'end_date',
          type: 'date',
          required: true,
          description: 'End date for financial period'
        },
        {
          name: 'currency',
          type: 'string',
          required: false,
          description: 'Currency for amounts (3-letter code)',
          validation: { pattern: '^[A-Z]{3}$' }
        },
        {
          name: 'include_breakdown',
          type: 'boolean',
          required: false,
          description: 'Include detailed breakdown by category/vendor',
          defaultValue: false
        }
      ],
      responseSchema: {
        type: 'object',
        properties: {
          summary: {
            type: 'object',
            properties: {
              total_spend: { type: 'number' },
              total_orders: { type: 'number' },
              avg_order_value: { type: 'number' },
              currency: { type: 'string' }
            }
          },
          breakdown: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                amount: { type: 'number' },
                percentage: { type: 'number' }
              }
            }
          }
        }
      },
      requiredPermissions: ['analytics:read', 'financial:read']
    });

    // Vendor Performance Endpoint
    this.endpoints.set('/api/external/vendor-performance', {
      path: '/api/external/vendor-performance',
      method: 'GET',
      description: 'Get vendor performance metrics and ratings',
      parameters: [
        {
          name: 'vendor_ids',
          type: 'array',
          required: false,
          description: 'Filter by specific vendor IDs'
        },
        {
          name: 'start_date',
          type: 'date',
          required: false,
          description: 'Start date for performance period'
        },
        {
          name: 'end_date',
          type: 'date',
          required: false,
          description: 'End date for performance period'
        },
        {
          name: 'min_orders',
          type: 'number',
          required: false,
          description: 'Minimum number of orders for inclusion',
          defaultValue: 1,
          validation: { min: 1 }
        }
      ],
      responseSchema: {
        type: 'object',
        properties: {
          vendors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                vendor_id: { type: 'string' },
                vendor_name: { type: 'string' },
                total_orders: { type: 'number' },
                on_time_delivery_rate: { type: 'number' },
                quality_score: { type: 'number' },
                price_competitiveness: { type: 'number' },
                overall_score: { type: 'number' }
              }
            }
          }
        }
      },
      requiredPermissions: ['analytics:read', 'vendor:read']
    });

    // Real-time Events Endpoint
    this.endpoints.set('/api/external/events/stream', {
      path: '/api/external/events/stream',
      method: 'GET',
      description: 'Server-Sent Events stream for real-time data',
      parameters: [
        {
          name: 'event_types',
          type: 'array',
          required: false,
          description: 'Types of events to subscribe to',
          validation: {
            enum: ['requisition_created', 'requisition_approved', 'order_placed', 'delivery_completed', 'invoice_paid']
          }
        },
        {
          name: 'vessel_ids',
          type: 'array',
          required: false,
          description: 'Filter events by vessel IDs'
        }
      ],
      responseSchema: {
        type: 'text/event-stream'
      },
      requiredPermissions: ['events:read']
    });
  }

  private setupEventHandlers(): void {
    // Listen for internal events and broadcast to subscribers
    this.on('requisition_created', (data) => this.broadcastEvent('requisition_created', data));
    this.on('requisition_approved', (data) => this.broadcastEvent('requisition_approved', data));
    this.on('order_placed', (data) => this.broadcastEvent('order_placed', data));
    this.on('delivery_completed', (data) => this.broadcastEvent('delivery_completed', data));
    this.on('invoice_paid', (data) => this.broadcastEvent('invoice_paid', data));
  }

  // API Key Management
  async createAPIKey(
    name: string,
    clientId: string,
    permissions: string[],
    rateLimit: { requests: number; window: number },
    expiresAt?: Date
  ): Promise<APIKey> {
    const apiKey: APIKey = {
      id: this.generateId(),
      name,
      key: this.generateAPIKey(),
      clientId,
      permissions,
      rateLimit,
      isActive: true,
      expiresAt,
      createdAt: new Date()
    };

    this.apiKeys.set(apiKey.key, apiKey);
    
    // Store in database
    await this.dbPool.query(`
      INSERT INTO api_keys (id, name, key_hash, client_id, permissions, rate_limit, is_active, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      apiKey.id,
      apiKey.name,
      this.hashAPIKey(apiKey.key),
      apiKey.clientId,
      JSON.stringify(apiKey.permissions),
      JSON.stringify(apiKey.rateLimit),
      apiKey.isActive,
      apiKey.expiresAt,
      apiKey.createdAt
    ]);

    logger.info(`Created API key for client ${clientId}: ${name}`);
    return apiKey;
  }

  async validateAPIKey(key: string): Promise<APIKey | null> {
    const apiKey = this.apiKeys.get(key);
    if (!apiKey) {
      return null;
    }

    if (!apiKey.isActive) {
      return null;
    }

    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return null;
    }

    // Update last used timestamp
    apiKey.lastUsed = new Date();
    await this.dbPool.query(
      'UPDATE api_keys SET last_used = $1 WHERE id = $2',
      [apiKey.lastUsed, apiKey.id]
    );

    return apiKey;
  }

  // Rate Limiting
  createRateLimiter(apiKey: APIKey) {
    return rateLimit({
      windowMs: apiKey.rateLimit.window * 1000,
      max: apiKey.rateLimit.requests,
      keyGenerator: (req: Request) => apiKey.key,
      message: {
        error: 'Rate limit exceeded',
        limit: apiKey.rateLimit.requests,
        window: apiKey.rateLimit.window
      }
    });
  }

  // Data Export Methods
  async executeVesselAnalytics(parameters: Record<string, any>): Promise<any[]> {
    const {
      vessel_id,
      start_date,
      end_date,
      metrics = ['spend', 'cycle_time', 'emergency_rate'],
      group_by = 'month',
      limit = 1000,
      offset = 0
    } = parameters;

    let query = `
      SELECT 
        v.id as vessel_id,
        v.name as vessel_name,
        DATE_TRUNC($1, r.created_at) as period,
        SUM(r.total_amount) as total_spend,
        COUNT(r.id) as transaction_count,
        AVG(EXTRACT(EPOCH FROM (po.created_at - r.created_at))/86400) as avg_cycle_time,
        COUNT(CASE WHEN r.urgency_level = 'EMERGENCY' THEN 1 END)::float / COUNT(r.id) * 100 as emergency_rate
      FROM vessels v
      LEFT JOIN requisitions r ON v.id = r.vessel_id
      LEFT JOIN purchase_orders po ON r.id = po.requisition_id
      WHERE 1=1
    `;

    const queryParams: any[] = [group_by];
    let paramIndex = 2;

    if (vessel_id) {
      query += ` AND v.id = $${paramIndex}`;
      queryParams.push(vessel_id);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND r.created_at >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND r.created_at <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }

    query += `
      GROUP BY v.id, v.name, DATE_TRUNC($1, r.created_at)
      ORDER BY period DESC, total_spend DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await this.dbPool.query(query, queryParams);
    return result.rows;
  }

  async executeProcurementMetrics(parameters: Record<string, any>): Promise<any[]> {
    const {
      start_date,
      end_date,
      vessel_ids,
      category_ids,
      aggregation = 'daily'
    } = parameters;

    let query = `
      SELECT 
        DATE_TRUNC($1, r.created_at) as period,
        COUNT(r.id) as total_requisitions,
        COUNT(CASE WHEN r.status = 'COMPLETED' THEN 1 END) as completed_requisitions,
        AVG(EXTRACT(EPOCH FROM (r.updated_at - r.created_at))/3600) as avg_approval_time,
        AVG(EXTRACT(EPOCH FROM (po.created_at - r.created_at))/3600) as avg_procurement_time,
        COUNT(CASE WHEN r.urgency_level = 'EMERGENCY' THEN 1 END) as emergency_requisitions,
        SUM(r.total_amount) as total_value,
        COUNT(DISTINCT po.vendor_id) as vendor_count
      FROM requisitions r
      LEFT JOIN purchase_orders po ON r.id = po.requisition_id
      WHERE r.created_at >= $2 AND r.created_at <= $3
    `;

    const queryParams: any[] = [aggregation, start_date, end_date];
    let paramIndex = 4;

    if (vessel_ids && vessel_ids.length > 0) {
      query += ` AND r.vessel_id = ANY($${paramIndex})`;
      queryParams.push(vessel_ids);
      paramIndex++;
    }

    query += `
      GROUP BY DATE_TRUNC($1, r.created_at)
      ORDER BY period DESC
    `;

    const result = await this.dbPool.query(query, queryParams);
    return result.rows;
  }

  async executeFinancialData(parameters: Record<string, any>): Promise<any> {
    const {
      start_date,
      end_date,
      currency = 'USD',
      include_breakdown = false
    } = parameters;

    // Get summary data
    const summaryQuery = `
      SELECT 
        SUM(po.total_amount) as total_spend,
        COUNT(po.id) as total_orders,
        AVG(po.total_amount) as avg_order_value,
        po.currency
      FROM purchase_orders po
      WHERE po.created_at >= $1 AND po.created_at <= $2
        AND ($3 = 'ALL' OR po.currency = $3)
      GROUP BY po.currency
    `;

    const summaryResult = await this.dbPool.query(summaryQuery, [start_date, end_date, currency]);
    
    let breakdown = [];
    if (include_breakdown) {
      const breakdownQuery = `
        SELECT 
          ic.category_name as category,
          SUM(po.total_amount) as amount,
          SUM(po.total_amount) / (
            SELECT SUM(total_amount) 
            FROM purchase_orders 
            WHERE created_at >= $1 AND created_at <= $2
          ) * 100 as percentage
        FROM purchase_orders po
        JOIN requisitions r ON po.requisition_id = r.id
        JOIN requisition_items ri ON r.id = ri.requisition_id
        JOIN item_catalog ic ON ri.item_id = ic.id
        WHERE po.created_at >= $1 AND po.created_at <= $2
        GROUP BY ic.category_name
        ORDER BY amount DESC
      `;

      const breakdownResult = await this.dbPool.query(breakdownQuery, [start_date, end_date]);
      breakdown = breakdownResult.rows;
    }

    return {
      summary: summaryResult.rows[0] || { total_spend: 0, total_orders: 0, avg_order_value: 0, currency },
      breakdown
    };
  }

  async executeVendorPerformance(parameters: Record<string, any>): Promise<any[]> {
    const {
      vendor_ids,
      start_date,
      end_date,
      min_orders = 1
    } = parameters;

    let query = `
      SELECT 
        v.id as vendor_id,
        v.name as vendor_name,
        COUNT(po.id) as total_orders,
        COUNT(CASE WHEN d.delivered_at <= d.expected_delivery_date THEN 1 END)::float / COUNT(d.id) * 100 as on_time_delivery_rate,
        v.quality_rating as quality_score,
        v.price_rating as price_competitiveness,
        v.overall_score
      FROM vendors v
      JOIN purchase_orders po ON v.id = po.vendor_id
      LEFT JOIN deliveries d ON po.id = d.purchase_order_id
      WHERE 1=1
    `;

    const queryParams: any[] = [];
    let paramIndex = 1;

    if (vendor_ids && vendor_ids.length > 0) {
      query += ` AND v.id = ANY($${paramIndex})`;
      queryParams.push(vendor_ids);
      paramIndex++;
    }

    if (start_date) {
      query += ` AND po.created_at >= $${paramIndex}`;
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      query += ` AND po.created_at <= $${paramIndex}`;
      queryParams.push(end_date);
      paramIndex++;
    }

    query += `
      GROUP BY v.id, v.name, v.quality_rating, v.price_rating, v.overall_score
      HAVING COUNT(po.id) >= $${paramIndex}
      ORDER BY v.overall_score DESC
    `;

    queryParams.push(min_orders);

    const result = await this.dbPool.query(query, queryParams);
    return result.rows;
  }

  // Batch Export Methods
  async createBatchExport(
    apiKeyId: string,
    endpoint: string,
    parameters: Record<string, any>,
    format: 'json' | 'csv' | 'xml' | 'parquet'
  ): Promise<DataExportRequest> {
    const exportRequest: DataExportRequest = {
      id: this.generateId(),
      apiKeyId,
      endpoint,
      parameters,
      format,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    this.exportRequests.set(exportRequest.id, exportRequest);

    // Store in database
    await this.dbPool.query(`
      INSERT INTO data_export_requests (id, api_key_id, endpoint, parameters, format, status, created_at, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      exportRequest.id,
      exportRequest.apiKeyId,
      exportRequest.endpoint,
      JSON.stringify(exportRequest.parameters),
      exportRequest.format,
      exportRequest.status,
      exportRequest.createdAt,
      exportRequest.expiresAt
    ]);

    // Process export asynchronously
    this.processBatchExport(exportRequest.id);

    return exportRequest;
  }

  private async processBatchExport(exportId: string): Promise<void> {
    const exportRequest = this.exportRequests.get(exportId);
    if (!exportRequest) return;

    try {
      exportRequest.status = 'processing';
      
      // Execute the appropriate data query
      let data: any[];
      switch (exportRequest.endpoint) {
        case '/api/external/vessel-analytics':
          data = await this.executeVesselAnalytics(exportRequest.parameters);
          break;
        case '/api/external/procurement-metrics':
          data = await this.executeProcurementMetrics(exportRequest.parameters);
          break;
        case '/api/external/financial-data':
          data = [await this.executeFinancialData(exportRequest.parameters)];
          break;
        case '/api/external/vendor-performance':
          data = await this.executeVendorPerformance(exportRequest.parameters);
          break;
        default:
          throw new Error(`Unknown endpoint: ${exportRequest.endpoint}`);
      }

      // Generate file based on format
      const fileName = `export_${exportId}.${exportRequest.format}`;
      const filePath = await this.generateExportFile(data, exportRequest.format, fileName);

      exportRequest.status = 'completed';
      exportRequest.completedAt = new Date();
      exportRequest.downloadUrl = `/api/external/downloads/${fileName}`;
      exportRequest.recordCount = data.length;

      // Update database
      await this.dbPool.query(`
        UPDATE data_export_requests 
        SET status = $1, completed_at = $2, download_url = $3, record_count = $4
        WHERE id = $5
      `, [
        exportRequest.status,
        exportRequest.completedAt,
        exportRequest.downloadUrl,
        exportRequest.recordCount,
        exportRequest.id
      ]);

      logger.info(`Batch export completed: ${exportId}`);
    } catch (error) {
      exportRequest.status = 'failed';
      logger.error(`Batch export failed: ${exportId}`, error);
      
      await this.dbPool.query(
        'UPDATE data_export_requests SET status = $1 WHERE id = $2',
        ['failed', exportId]
      );
    }
  }

  private async generateExportFile(data: any[], format: string, fileName: string): Promise<string> {
    // In a real implementation, this would generate actual files
    // For now, we'll just simulate the file generation
    
    const filePath = `/tmp/exports/${fileName}`;
    
    switch (format) {
      case 'json':
        // Generate JSON file
        break;
      case 'csv':
        // Generate CSV file
        break;
      case 'xml':
        // Generate XML file
        break;
      case 'parquet':
        // Generate Parquet file
        break;
    }

    return filePath;
  }

  // Real-time Streaming Methods
  async createStreamingSubscription(
    apiKeyId: string,
    eventTypes: string[],
    filters: Record<string, any>,
    webhookUrl?: string
  ): Promise<StreamingSubscription> {
    const subscription: StreamingSubscription = {
      id: this.generateId(),
      apiKeyId,
      eventTypes,
      filters,
      webhookUrl,
      isActive: true,
      createdAt: new Date()
    };

    this.streamingSubscriptions.set(subscription.id, subscription);

    // Store in database
    await this.dbPool.query(`
      INSERT INTO streaming_subscriptions (id, api_key_id, event_types, filters, webhook_url, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      subscription.id,
      subscription.apiKeyId,
      JSON.stringify(subscription.eventTypes),
      JSON.stringify(subscription.filters),
      subscription.webhookUrl,
      subscription.isActive,
      subscription.createdAt
    ]);

    return subscription;
  }

  private async broadcastEvent(eventType: string, data: any): Promise<void> {
    const activeSubscriptions = Array.from(this.streamingSubscriptions.values())
      .filter(sub => sub.isActive && sub.eventTypes.includes(eventType));

    for (const subscription of activeSubscriptions) {
      try {
        // Apply filters
        if (!this.matchesFilters(data, subscription.filters)) {
          continue;
        }

        const eventData = {
          id: this.generateId(),
          type: eventType,
          timestamp: new Date().toISOString(),
          data
        };

        if (subscription.webhookUrl) {
          // Send webhook
          await this.sendWebhook(subscription.webhookUrl, eventData);
        }

        // Emit to SSE connections (handled by the route handler)
        this.emit('sse_event', {
          subscriptionId: subscription.id,
          event: eventData
        });

        subscription.lastDelivery = new Date();
      } catch (error) {
        logger.error(`Failed to broadcast event to subscription ${subscription.id}:`, error);
      }
    }
  }

  private matchesFilters(data: any, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        if (!value.includes(data[key])) {
          return false;
        }
      } else if (data[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private async sendWebhook(url: string, data: any): Promise<void> {
    // Implementation would send HTTP POST to webhook URL
    // This is a placeholder
    logger.info(`Sending webhook to ${url}`, data);
  }

  // Utility Methods
  private generateId(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private generateAPIKey(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 64; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private hashAPIKey(key: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  // Management Methods
  async getAPIKeys(clientId?: string): Promise<APIKey[]> {
    const keys = Array.from(this.apiKeys.values());
    return clientId ? keys.filter(key => key.clientId === clientId) : keys;
  }

  async revokeAPIKey(keyId: string): Promise<void> {
    const key = Array.from(this.apiKeys.values()).find(k => k.id === keyId);
    if (key) {
      key.isActive = false;
      await this.dbPool.query('UPDATE api_keys SET is_active = false WHERE id = $1', [keyId]);
    }
  }

  async getExportRequests(apiKeyId?: string): Promise<DataExportRequest[]> {
    const requests = Array.from(this.exportRequests.values());
    return apiKeyId ? requests.filter(req => req.apiKeyId === apiKeyId) : requests;
  }

  async getStreamingSubscriptions(apiKeyId?: string): Promise<StreamingSubscription[]> {
    const subscriptions = Array.from(this.streamingSubscriptions.values());
    return apiKeyId ? subscriptions.filter(sub => sub.apiKeyId === apiKeyId) : subscriptions;
  }

  getEndpoints(): APIEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  getEndpoint(path: string): APIEndpoint | undefined {
    return this.endpoints.get(path);
  }
}