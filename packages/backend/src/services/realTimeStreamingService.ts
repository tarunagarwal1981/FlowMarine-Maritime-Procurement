import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { Server as SocketIOServer } from 'socket.io';
import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

interface StreamConfig {
  id: string;
  name: string;
  description: string;
  sourceType: 'database' | 'api' | 'webhook' | 'file';
  sourceConfig: Record<string, any>;
  transformations: StreamTransformation[];
  destinations: StreamDestination[];
  isActive: boolean;
  batchSize: number;
  flushInterval: number; // milliseconds
  retryPolicy: RetryPolicy;
  createdAt: Date;
}

interface StreamTransformation {
  type: 'filter' | 'map' | 'aggregate' | 'enrich' | 'validate';
  config: Record<string, any>;
}

interface StreamDestination {
  type: 'kafka' | 'websocket' | 'webhook' | 'database' | 'file' | 'bi_tool';
  config: Record<string, any>;
}

interface RetryPolicy {
  maxRetries: number;
  backoffMultiplier: number;
  maxBackoffMs: number;
}

interface StreamEvent {
  id: string;
  streamId: string;
  eventType: string;
  timestamp: Date;
  data: any;
  metadata?: Record<string, any>;
}

interface StreamMetrics {
  streamId: string;
  eventsProcessed: number;
  eventsPerSecond: number;
  errorCount: number;
  lastProcessedAt: Date;
  avgProcessingTime: number;
  backlogSize: number;
}

interface AlertRule {
  id: string;
  streamId: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  actions: AlertAction[];
  isActive: boolean;
}

interface AlertAction {
  type: 'email' | 'webhook' | 'slack' | 'sms';
  config: Record<string, any>;
}

export class RealTimeStreamingService extends EventEmitter {
  private dbPool: Pool;
  private redisClient: RedisClientType;
  private io: SocketIOServer;
  private streams: Map<string, StreamConfig> = new Map();
  private streamProcessors: Map<string, NodeJS.Timer> = new Map();
  private streamMetrics: Map<string, StreamMetrics> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private eventBuffer: Map<string, StreamEvent[]> = new Map();

  constructor(dbPool: Pool, io: SocketIOServer) {
    super();
    this.dbPool = dbPool;
    this.io = io;
    this.initializeRedis();
    this.initializeStreams();
    this.setupEventHandlers();
  }

  private async initializeRedis(): Promise<void> {
    this.redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });

    this.redisClient.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    await this.redisClient.connect();
    logger.info('Connected to Redis for streaming service');
  }

  private initializeStreams(): void {
    // Procurement Events Stream
    this.streams.set('procurement_events', {
      id: 'procurement_events',
      name: 'Procurement Events Stream',
      description: 'Real-time stream of procurement-related events',
      sourceType: 'database',
      sourceConfig: {
        tables: ['requisitions', 'purchase_orders', 'invoices', 'deliveries'],
        changeDetection: 'trigger',
        pollInterval: 5000
      },
      transformations: [
        {
          type: 'filter',
          config: {
            conditions: ['status_changed', 'amount_threshold']
          }
        },
        {
          type: 'enrich',
          config: {
            joinTables: ['vessels', 'vendors', 'users']
          }
        }
      ],
      destinations: [
        {
          type: 'websocket',
          config: {
            rooms: ['procurement_dashboard', 'vessel_operations']
          }
        },
        {
          type: 'kafka',
          config: {
            topic: 'flowmarine.procurement.events',
            partition: 'vessel_id'
          }
        }
      ],
      isActive: true,
      batchSize: 100,
      flushInterval: 1000,
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffMs: 30000
      },
      createdAt: new Date()
    });

    // Financial Events Stream
    this.streams.set('financial_events', {
      id: 'financial_events',
      name: 'Financial Events Stream',
      description: 'Real-time stream of financial transactions and updates',
      sourceType: 'database',
      sourceConfig: {
        tables: ['invoices', 'payments', 'budget_allocations'],
        changeDetection: 'trigger'
      },
      transformations: [
        {
          type: 'map',
          config: {
            currencyConversion: true,
            baseCurrency: 'USD'
          }
        },
        {
          type: 'aggregate',
          config: {
            window: '1m',
            functions: ['sum', 'count', 'avg']
          }
        }
      ],
      destinations: [
        {
          type: 'websocket',
          config: {
            rooms: ['financial_dashboard']
          }
        },
        {
          type: 'bi_tool',
          config: {
            tools: ['powerbi', 'tableau'],
            realTimeDatasets: ['financial_metrics']
          }
        }
      ],
      isActive: true,
      batchSize: 50,
      flushInterval: 2000,
      retryPolicy: {
        maxRetries: 5,
        backoffMultiplier: 1.5,
        maxBackoffMs: 60000
      },
      createdAt: new Date()
    });

    // Vessel Operations Stream
    this.streams.set('vessel_operations', {
      id: 'vessel_operations',
      name: 'Vessel Operations Stream',
      description: 'Real-time stream of vessel operational data',
      sourceType: 'api',
      sourceConfig: {
        endpoints: [
          { url: '/api/vessels/positions', interval: 30000 },
          { url: '/api/vessels/status', interval: 60000 }
        ]
      },
      transformations: [
        {
          type: 'validate',
          config: {
            schema: 'vessel_position_schema'
          }
        },
        {
          type: 'enrich',
          config: {
            geoData: true,
            weatherData: true
          }
        }
      ],
      destinations: [
        {
          type: 'websocket',
          config: {
            rooms: ['fleet_tracking', 'operations_center']
          }
        },
        {
          type: 'database',
          config: {
            table: 'vessel_position_history',
            batchInsert: true
          }
        }
      ],
      isActive: true,
      batchSize: 20,
      flushInterval: 5000,
      retryPolicy: {
        maxRetries: 2,
        backoffMultiplier: 2,
        maxBackoffMs: 15000
      },
      createdAt: new Date()
    });

    // Analytics Events Stream
    this.streams.set('analytics_events', {
      id: 'analytics_events',
      name: 'Analytics Events Stream',
      description: 'Real-time stream for analytics and reporting',
      sourceType: 'database',
      sourceConfig: {
        materialized_views: ['procurement_metrics_mv', 'financial_summary_mv'],
        refreshInterval: 300000 // 5 minutes
      },
      transformations: [
        {
          type: 'aggregate',
          config: {
            groupBy: ['vessel_id', 'category', 'vendor_id'],
            window: '5m',
            functions: ['sum', 'count', 'avg', 'min', 'max']
          }
        }
      ],
      destinations: [
        {
          type: 'websocket',
          config: {
            rooms: ['analytics_dashboard']
          }
        },
        {
          type: 'kafka',
          config: {
            topic: 'flowmarine.analytics.aggregated',
            partition: 'metric_type'
          }
        }
      ],
      isActive: true,
      batchSize: 200,
      flushInterval: 30000,
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 2,
        maxBackoffMs: 45000
      },
      createdAt: new Date()
    });

    this.initializeAlertRules();
    this.startStreamProcessors();
  }

  private initializeAlertRules(): void {
    // High-value transaction alert
    this.alertRules.set('high_value_transaction', {
      id: 'high_value_transaction',
      streamId: 'procurement_events',
      name: 'High Value Transaction Alert',
      condition: 'event.data.amount > threshold',
      threshold: 50000,
      severity: 'high',
      actions: [
        {
          type: 'email',
          config: {
            recipients: ['finance@company.com', 'procurement@company.com'],
            template: 'high_value_alert'
          }
        },
        {
          type: 'webhook',
          config: {
            url: 'https://api.company.com/alerts/high-value',
            method: 'POST'
          }
        }
      ],
      isActive: true
    });

    // Emergency requisition alert
    this.alertRules.set('emergency_requisition', {
      id: 'emergency_requisition',
      streamId: 'procurement_events',
      name: 'Emergency Requisition Alert',
      condition: 'event.data.urgency_level === "EMERGENCY"',
      threshold: 1,
      severity: 'critical',
      actions: [
        {
          type: 'sms',
          config: {
            recipients: ['+1234567890'],
            message: 'Emergency requisition created for vessel {vessel_name}'
          }
        },
        {
          type: 'slack',
          config: {
            channel: '#emergency-alerts',
            webhook: process.env.SLACK_WEBHOOK_URL
          }
        }
      ],
      isActive: true
    });

    // Stream processing error alert
    this.alertRules.set('stream_processing_error', {
      id: 'stream_processing_error',
      streamId: 'all',
      name: 'Stream Processing Error Alert',
      condition: 'metrics.errorCount > threshold',
      threshold: 10,
      severity: 'medium',
      actions: [
        {
          type: 'email',
          config: {
            recipients: ['devops@company.com'],
            template: 'stream_error_alert'
          }
        }
      ],
      isActive: true
    });
  }

  private setupEventHandlers(): void {
    // Listen for database changes
    this.on('database_change', (change) => {
      this.processEvent('procurement_events', {
        id: this.generateEventId(),
        streamId: 'procurement_events',
        eventType: 'database_change',
        timestamp: new Date(),
        data: change
      });
    });

    // Listen for API events
    this.on('api_event', (event) => {
      this.processEvent('vessel_operations', {
        id: this.generateEventId(),
        streamId: 'vessel_operations',
        eventType: 'api_event',
        timestamp: new Date(),
        data: event
      });
    });

    // WebSocket connection handling
    this.io.on('connection', (socket) => {
      logger.info(`Client connected to streaming service: ${socket.id}`);

      socket.on('subscribe_stream', (streamId: string, filters?: any) => {
        this.subscribeToStream(socket, streamId, filters);
      });

      socket.on('unsubscribe_stream', (streamId: string) => {
        this.unsubscribeFromStream(socket, streamId);
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected from streaming service: ${socket.id}`);
      });
    });
  }

  private startStreamProcessors(): void {
    for (const [streamId, stream] of this.streams) {
      if (stream.isActive) {
        this.startStreamProcessor(streamId);
      }
    }
  }

  private startStreamProcessor(streamId: string): void {
    const stream = this.streams.get(streamId);
    if (!stream) return;

    // Initialize metrics
    this.streamMetrics.set(streamId, {
      streamId,
      eventsProcessed: 0,
      eventsPerSecond: 0,
      errorCount: 0,
      lastProcessedAt: new Date(),
      avgProcessingTime: 0,
      backlogSize: 0
    });

    // Initialize event buffer
    this.eventBuffer.set(streamId, []);

    // Start processor timer
    const processor = setInterval(async () => {
      try {
        await this.processStreamBatch(streamId);
      } catch (error) {
        logger.error(`Stream processor error for ${streamId}:`, error);
        this.updateStreamMetrics(streamId, { errorCount: 1 });
      }
    }, stream.flushInterval);

    this.streamProcessors.set(streamId, processor);
    logger.info(`Started stream processor for ${streamId}`);
  }

  private async processStreamBatch(streamId: string): Promise<void> {
    const stream = this.streams.get(streamId);
    const buffer = this.eventBuffer.get(streamId);
    
    if (!stream || !buffer || buffer.length === 0) return;

    const startTime = Date.now();
    const batchSize = Math.min(buffer.length, stream.batchSize);
    const batch = buffer.splice(0, batchSize);

    try {
      // Apply transformations
      const transformedEvents = await this.applyTransformations(batch, stream.transformations);

      // Send to destinations
      await this.sendToDestinations(transformedEvents, stream.destinations);

      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateStreamMetrics(streamId, {
        eventsProcessed: batch.length,
        avgProcessingTime: processingTime,
        backlogSize: buffer.length
      });

      // Check alert rules
      await this.checkAlertRules(streamId, transformedEvents);

    } catch (error) {
      logger.error(`Batch processing failed for stream ${streamId}:`, error);
      
      // Retry logic
      if (stream.retryPolicy.maxRetries > 0) {
        await this.retryBatch(streamId, batch, 1);
      }
      
      this.updateStreamMetrics(streamId, { errorCount: batch.length });
    }
  }

  private async applyTransformations(events: StreamEvent[], transformations: StreamTransformation[]): Promise<StreamEvent[]> {
    let transformedEvents = [...events];

    for (const transformation of transformations) {
      switch (transformation.type) {
        case 'filter':
          transformedEvents = await this.applyFilter(transformedEvents, transformation.config);
          break;
        case 'map':
          transformedEvents = await this.applyMap(transformedEvents, transformation.config);
          break;
        case 'aggregate':
          transformedEvents = await this.applyAggregation(transformedEvents, transformation.config);
          break;
        case 'enrich':
          transformedEvents = await this.applyEnrichment(transformedEvents, transformation.config);
          break;
        case 'validate':
          transformedEvents = await this.applyValidation(transformedEvents, transformation.config);
          break;
      }
    }

    return transformedEvents;
  }

  private async applyFilter(events: StreamEvent[], config: any): Promise<StreamEvent[]> {
    return events.filter(event => {
      // Apply filter conditions
      for (const condition of config.conditions) {
        switch (condition) {
          case 'status_changed':
            if (!event.data.status_changed) return false;
            break;
          case 'amount_threshold':
            if (event.data.amount && event.data.amount < (config.minAmount || 0)) return false;
            break;
        }
      }
      return true;
    });
  }

  private async applyMap(events: StreamEvent[], config: any): Promise<StreamEvent[]> {
    return events.map(event => {
      const mappedEvent = { ...event };
      
      if (config.currencyConversion && event.data.amount && event.data.currency) {
        // Apply currency conversion (simplified)
        mappedEvent.data.usd_amount = event.data.amount; // Placeholder
      }

      return mappedEvent;
    });
  }

  private async applyAggregation(events: StreamEvent[], config: any): Promise<StreamEvent[]> {
    // Group events by specified fields
    const groups = new Map<string, StreamEvent[]>();
    
    for (const event of events) {
      const groupKey = config.groupBy?.map((field: string) => event.data[field]).join('|') || 'default';
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(event);
    }

    // Apply aggregation functions
    const aggregatedEvents: StreamEvent[] = [];
    
    for (const [groupKey, groupEvents] of groups) {
      const aggregatedData: any = {};
      
      for (const func of config.functions) {
        switch (func) {
          case 'sum':
            aggregatedData.sum_amount = groupEvents.reduce((sum, e) => sum + (e.data.amount || 0), 0);
            break;
          case 'count':
            aggregatedData.count = groupEvents.length;
            break;
          case 'avg':
            aggregatedData.avg_amount = aggregatedData.sum_amount / aggregatedData.count;
            break;
        }
      }

      aggregatedEvents.push({
        id: this.generateEventId(),
        streamId: events[0].streamId,
        eventType: 'aggregated',
        timestamp: new Date(),
        data: aggregatedData,
        metadata: { groupKey, originalEventCount: groupEvents.length }
      });
    }

    return aggregatedEvents;
  }

  private async applyEnrichment(events: StreamEvent[], config: any): Promise<StreamEvent[]> {
    const enrichedEvents: StreamEvent[] = [];

    for (const event of events) {
      const enrichedEvent = { ...event };
      
      // Join with additional tables
      if (config.joinTables) {
        for (const table of config.joinTables) {
          try {
            const enrichmentData = await this.getEnrichmentData(table, event.data);
            enrichedEvent.data = { ...enrichedEvent.data, ...enrichmentData };
          } catch (error) {
            logger.warn(`Failed to enrich event with ${table} data:`, error);
          }
        }
      }

      // Add geo data
      if (config.geoData && event.data.latitude && event.data.longitude) {
        enrichedEvent.data.location = {
          lat: event.data.latitude,
          lng: event.data.longitude,
          // Add reverse geocoding, timezone, etc.
        };
      }

      enrichedEvents.push(enrichedEvent);
    }

    return enrichedEvents;
  }

  private async applyValidation(events: StreamEvent[], config: any): Promise<StreamEvent[]> {
    return events.filter(event => {
      // Apply validation schema
      try {
        // Simplified validation - in production, use a proper schema validator
        return this.validateEventSchema(event, config.schema);
      } catch (error) {
        logger.warn(`Event validation failed:`, error);
        return false;
      }
    });
  }

  private async sendToDestinations(events: StreamEvent[], destinations: StreamDestination[]): Promise<void> {
    const promises = destinations.map(destination => this.sendToDestination(events, destination));
    await Promise.allSettled(promises);
  }

  private async sendToDestination(events: StreamEvent[], destination: StreamDestination): Promise<void> {
    switch (destination.type) {
      case 'websocket':
        await this.sendToWebSocket(events, destination.config);
        break;
      case 'kafka':
        await this.sendToKafka(events, destination.config);
        break;
      case 'webhook':
        await this.sendToWebhook(events, destination.config);
        break;
      case 'database':
        await this.sendToDatabase(events, destination.config);
        break;
      case 'bi_tool':
        await this.sendToBITool(events, destination.config);
        break;
    }
  }

  private async sendToWebSocket(events: StreamEvent[], config: any): Promise<void> {
    for (const room of config.rooms) {
      this.io.to(room).emit('stream_events', events);
    }
  }

  private async sendToKafka(events: StreamEvent[], config: any): Promise<void> {
    // Kafka implementation would go here
    logger.info(`Sending ${events.length} events to Kafka topic: ${config.topic}`);
  }

  private async sendToWebhook(events: StreamEvent[], config: any): Promise<void> {
    // Webhook implementation would go here
    logger.info(`Sending ${events.length} events to webhook: ${config.url}`);
  }

  private async sendToDatabase(events: StreamEvent[], config: any): Promise<void> {
    if (config.batchInsert && events.length > 0) {
      // Batch insert implementation
      const values = events.map(event => [event.id, event.streamId, event.eventType, event.timestamp, JSON.stringify(event.data)]);
      
      // This is a simplified example
      logger.info(`Batch inserting ${events.length} events to ${config.table}`);
    }
  }

  private async sendToBITool(events: StreamEvent[], config: any): Promise<void> {
    // BI tool integration would go here
    logger.info(`Sending ${events.length} events to BI tools: ${config.tools.join(', ')}`);
  }

  // Public API Methods
  async processEvent(streamId: string, event: StreamEvent): Promise<void> {
    const buffer = this.eventBuffer.get(streamId);
    if (buffer) {
      buffer.push(event);
    }
  }

  async createStream(streamConfig: Omit<StreamConfig, 'id' | 'createdAt'>): Promise<StreamConfig> {
    const stream: StreamConfig = {
      ...streamConfig,
      id: this.generateEventId(),
      createdAt: new Date()
    };

    this.streams.set(stream.id, stream);
    
    if (stream.isActive) {
      this.startStreamProcessor(stream.id);
    }

    return stream;
  }

  async updateStream(streamId: string, updates: Partial<StreamConfig>): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream) {
      throw new AppError(`Stream ${streamId} not found`, 404, 'STREAM_NOT_FOUND');
    }

    Object.assign(stream, updates);

    if (updates.isActive !== undefined) {
      if (updates.isActive) {
        this.startStreamProcessor(streamId);
      } else {
        this.stopStreamProcessor(streamId);
      }
    }
  }

  async deleteStream(streamId: string): Promise<void> {
    this.stopStreamProcessor(streamId);
    this.streams.delete(streamId);
    this.streamMetrics.delete(streamId);
    this.eventBuffer.delete(streamId);
  }

  private stopStreamProcessor(streamId: string): void {
    const processor = this.streamProcessors.get(streamId);
    if (processor) {
      clearInterval(processor);
      this.streamProcessors.delete(streamId);
    }
  }

  private subscribeToStream(socket: any, streamId: string, filters?: any): void {
    socket.join(`stream_${streamId}`);
    logger.info(`Client ${socket.id} subscribed to stream ${streamId}`);
  }

  private unsubscribeFromStream(socket: any, streamId: string): void {
    socket.leave(`stream_${streamId}`);
    logger.info(`Client ${socket.id} unsubscribed from stream ${streamId}`);
  }

  private updateStreamMetrics(streamId: string, updates: Partial<StreamMetrics>): void {
    const metrics = this.streamMetrics.get(streamId);
    if (metrics) {
      Object.assign(metrics, updates);
      metrics.lastProcessedAt = new Date();
      
      // Calculate events per second
      const now = Date.now();
      const timeDiff = now - metrics.lastProcessedAt.getTime();
      if (timeDiff > 0 && updates.eventsProcessed) {
        metrics.eventsPerSecond = (updates.eventsProcessed / timeDiff) * 1000;
      }
    }
  }

  private async checkAlertRules(streamId: string, events: StreamEvent[]): Promise<void> {
    const relevantRules = Array.from(this.alertRules.values())
      .filter(rule => rule.isActive && (rule.streamId === streamId || rule.streamId === 'all'));

    for (const rule of relevantRules) {
      for (const event of events) {
        if (this.evaluateAlertCondition(rule, event)) {
          await this.triggerAlert(rule, event);
        }
      }
    }
  }

  private evaluateAlertCondition(rule: AlertRule, event: StreamEvent): boolean {
    try {
      // Simplified condition evaluation
      const condition = rule.condition
        .replace(/event\.data\.(\w+)/g, (match, prop) => `event.data.${prop}`)
        .replace(/threshold/g, rule.threshold.toString());
      
      return eval(condition);
    } catch (error) {
      logger.warn(`Failed to evaluate alert condition for rule ${rule.id}:`, error);
      return false;
    }
  }

  private async triggerAlert(rule: AlertRule, event: StreamEvent): Promise<void> {
    logger.warn(`Alert triggered: ${rule.name}`, { rule: rule.id, event: event.id });

    for (const action of rule.actions) {
      try {
        await this.executeAlertAction(action, rule, event);
      } catch (error) {
        logger.error(`Failed to execute alert action:`, error);
      }
    }
  }

  private async executeAlertAction(action: AlertAction, rule: AlertRule, event: StreamEvent): Promise<void> {
    switch (action.type) {
      case 'email':
        // Send email alert
        logger.info(`Sending email alert for rule ${rule.id}`);
        break;
      case 'webhook':
        // Send webhook alert
        logger.info(`Sending webhook alert for rule ${rule.id}`);
        break;
      case 'slack':
        // Send Slack alert
        logger.info(`Sending Slack alert for rule ${rule.id}`);
        break;
      case 'sms':
        // Send SMS alert
        logger.info(`Sending SMS alert for rule ${rule.id}`);
        break;
    }
  }

  // Utility methods
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private async getEnrichmentData(table: string, eventData: any): Promise<any> {
    // Simplified enrichment data retrieval
    switch (table) {
      case 'vessels':
        if (eventData.vessel_id) {
          const result = await this.dbPool.query('SELECT name, vessel_type FROM vessels WHERE id = $1', [eventData.vessel_id]);
          return result.rows[0] || {};
        }
        break;
      case 'vendors':
        if (eventData.vendor_id) {
          const result = await this.dbPool.query('SELECT name, country FROM vendors WHERE id = $1', [eventData.vendor_id]);
          return result.rows[0] || {};
        }
        break;
    }
    return {};
  }

  private validateEventSchema(event: StreamEvent, schemaName: string): boolean {
    // Simplified schema validation
    switch (schemaName) {
      case 'vessel_position_schema':
        return event.data.latitude && event.data.longitude && event.data.vessel_id;
      default:
        return true;
    }
  }

  private async retryBatch(streamId: string, batch: StreamEvent[], attempt: number): Promise<void> {
    const stream = this.streams.get(streamId);
    if (!stream || attempt > stream.retryPolicy.maxRetries) {
      logger.error(`Max retries exceeded for stream ${streamId}, dropping ${batch.length} events`);
      return;
    }

    const backoffMs = Math.min(
      1000 * Math.pow(stream.retryPolicy.backoffMultiplier, attempt - 1),
      stream.retryPolicy.maxBackoffMs
    );

    setTimeout(async () => {
      try {
        const transformedEvents = await this.applyTransformations(batch, stream.transformations);
        await this.sendToDestinations(transformedEvents, stream.destinations);
        logger.info(`Retry successful for stream ${streamId}, attempt ${attempt}`);
      } catch (error) {
        logger.warn(`Retry ${attempt} failed for stream ${streamId}:`, error);
        await this.retryBatch(streamId, batch, attempt + 1);
      }
    }, backoffMs);
  }

  // Management API
  getStreams(): StreamConfig[] {
    return Array.from(this.streams.values());
  }

  getStreamMetrics(streamId?: string): StreamMetrics[] {
    const metrics = Array.from(this.streamMetrics.values());
    return streamId ? metrics.filter(m => m.streamId === streamId) : metrics;
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const alertRule: AlertRule = {
      ...rule,
      id: this.generateEventId()
    };

    this.alertRules.set(alertRule.id, alertRule);
    return alertRule;
  }

  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>): Promise<void> {
    const rule = this.alertRules.get(ruleId);
    if (!rule) {
      throw new AppError(`Alert rule ${ruleId} not found`, 404, 'ALERT_RULE_NOT_FOUND');
    }

    Object.assign(rule, updates);
  }

  async deleteAlertRule(ruleId: string): Promise<void> {
    this.alertRules.delete(ruleId);
  }
}