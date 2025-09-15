import { Pool, PoolClient } from 'pg';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import cron from 'node-cron';

interface ETLJobConfig {
  id: string;
  name: string;
  description: string;
  sourceQuery: string;
  targetTable: string;
  transformations: ETLTransformation[];
  schedule: string; // cron expression
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

interface ETLTransformation {
  type: 'map' | 'filter' | 'aggregate' | 'join' | 'calculate';
  config: Record<string, any>;
}

interface DataQualityRule {
  id: string;
  name: string;
  description: string;
  table: string;
  column?: string;
  rule: 'not_null' | 'unique' | 'range' | 'format' | 'reference' | 'custom';
  config: Record<string, any>;
  severity: 'error' | 'warning' | 'info';
}

interface DataQualityResult {
  ruleId: string;
  passed: boolean;
  violationCount: number;
  details: string;
  timestamp: Date;
}

export class DataWarehouseService {
  private dbPool: Pool;
  private warehousePool: Pool;
  private etlJobs: Map<string, ETLJobConfig> = new Map();
  private dataQualityRules: Map<string, DataQualityRule> = new Map();
  private scheduledJobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(dbPool: Pool, warehousePool: Pool) {
    this.dbPool = dbPool;
    this.warehousePool = warehousePool;
    this.initializeWarehouseSchema();
    this.initializeETLJobs();
    this.initializeDataQualityRules();
    this.scheduleETLJobs();
  }

  private async initializeWarehouseSchema(): Promise<void> {
    const client = await this.warehousePool.connect();
    
    try {
      // Create dimension tables
      await client.query(`
        CREATE SCHEMA IF NOT EXISTS warehouse;
        
        -- Time Dimension
        CREATE TABLE IF NOT EXISTS warehouse.dim_time (
          time_key SERIAL PRIMARY KEY,
          date_actual DATE NOT NULL UNIQUE,
          year INTEGER NOT NULL,
          quarter INTEGER NOT NULL,
          month INTEGER NOT NULL,
          week INTEGER NOT NULL,
          day_of_year INTEGER NOT NULL,
          day_of_month INTEGER NOT NULL,
          day_of_week INTEGER NOT NULL,
          month_name VARCHAR(20) NOT NULL,
          day_name VARCHAR(20) NOT NULL,
          is_weekend BOOLEAN NOT NULL,
          is_holiday BOOLEAN DEFAULT FALSE,
          fiscal_year INTEGER,
          fiscal_quarter INTEGER,
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Vessel Dimension
        CREATE TABLE IF NOT EXISTS warehouse.dim_vessel (
          vessel_key SERIAL PRIMARY KEY,
          vessel_id VARCHAR(50) NOT NULL UNIQUE,
          vessel_name VARCHAR(255) NOT NULL,
          imo_number VARCHAR(20),
          vessel_type VARCHAR(100),
          flag VARCHAR(100),
          engine_type VARCHAR(100),
          cargo_capacity DECIMAL(15,2),
          fuel_consumption DECIMAL(10,2),
          crew_complement INTEGER,
          build_year INTEGER,
          classification_society VARCHAR(100),
          effective_date DATE NOT NULL,
          expiry_date DATE,
          is_current BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Vendor Dimension
        CREATE TABLE IF NOT EXISTS warehouse.dim_vendor (
          vendor_key SERIAL PRIMARY KEY,
          vendor_id VARCHAR(50) NOT NULL,
          vendor_name VARCHAR(255) NOT NULL,
          vendor_code VARCHAR(50),
          country VARCHAR(100),
          city VARCHAR(100),
          vendor_type VARCHAR(100),
          payment_terms VARCHAR(100),
          credit_limit DECIMAL(15,2),
          quality_rating DECIMAL(3,2),
          delivery_rating DECIMAL(3,2),
          price_rating DECIMAL(3,2),
          overall_score DECIMAL(3,2),
          is_active BOOLEAN DEFAULT TRUE,
          effective_date DATE NOT NULL,
          expiry_date DATE,
          is_current BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Category Dimension
        CREATE TABLE IF NOT EXISTS warehouse.dim_category (
          category_key SERIAL PRIMARY KEY,
          category_id VARCHAR(50) NOT NULL UNIQUE,
          category_name VARCHAR(255) NOT NULL,
          parent_category_id VARCHAR(50),
          category_level INTEGER NOT NULL,
          category_path VARCHAR(500),
          impa_code VARCHAR(20),
          issa_code VARCHAR(20),
          criticality_level VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Geography Dimension
        CREATE TABLE IF NOT EXISTS warehouse.dim_geography (
          geography_key SERIAL PRIMARY KEY,
          port_code VARCHAR(10) NOT NULL UNIQUE,
          port_name VARCHAR(255) NOT NULL,
          city VARCHAR(100),
          country VARCHAR(100),
          region VARCHAR(100),
          continent VARCHAR(50),
          latitude DECIMAL(10,8),
          longitude DECIMAL(11,8),
          time_zone VARCHAR(50),
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Currency Dimension
        CREATE TABLE IF NOT EXISTS warehouse.dim_currency (
          currency_key SERIAL PRIMARY KEY,
          currency_code VARCHAR(3) NOT NULL UNIQUE,
          currency_name VARCHAR(100) NOT NULL,
          symbol VARCHAR(10),
          decimal_places INTEGER DEFAULT 2,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create fact tables
      await client.query(`
        -- Procurement Fact Table
        CREATE TABLE IF NOT EXISTS warehouse.fact_procurement (
          procurement_key SERIAL PRIMARY KEY,
          time_key INTEGER REFERENCES warehouse.dim_time(time_key),
          vessel_key INTEGER REFERENCES warehouse.dim_vessel(vessel_key),
          vendor_key INTEGER REFERENCES warehouse.dim_vendor(vendor_key),
          category_key INTEGER REFERENCES warehouse.dim_category(category_key),
          geography_key INTEGER REFERENCES warehouse.dim_geography(geography_key),
          currency_key INTEGER REFERENCES warehouse.dim_currency(currency_key),
          
          -- Identifiers
          requisition_id VARCHAR(50),
          purchase_order_id VARCHAR(50),
          invoice_id VARCHAR(50),
          
          -- Measures
          requisition_amount DECIMAL(15,2),
          po_amount DECIMAL(15,2),
          invoice_amount DECIMAL(15,2),
          paid_amount DECIMAL(15,2),
          
          -- Quantities
          quantity_requested DECIMAL(10,2),
          quantity_ordered DECIMAL(10,2),
          quantity_delivered DECIMAL(10,2),
          
          -- Time measures (in days)
          approval_cycle_time INTEGER,
          procurement_cycle_time INTEGER,
          delivery_cycle_time INTEGER,
          payment_cycle_time INTEGER,
          
          -- Status flags
          is_emergency BOOLEAN DEFAULT FALSE,
          is_completed BOOLEAN DEFAULT FALSE,
          is_on_time BOOLEAN DEFAULT FALSE,
          is_within_budget BOOLEAN DEFAULT FALSE,
          
          -- Dates
          requisition_date DATE,
          approval_date DATE,
          po_date DATE,
          delivery_date DATE,
          invoice_date DATE,
          payment_date DATE,
          
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        );

        -- Spend Fact Table
        CREATE TABLE IF NOT EXISTS warehouse.fact_spend (
          spend_key SERIAL PRIMARY KEY,
          time_key INTEGER REFERENCES warehouse.dim_time(time_key),
          vessel_key INTEGER REFERENCES warehouse.dim_vessel(vessel_key),
          vendor_key INTEGER REFERENCES warehouse.dim_vendor(vendor_key),
          category_key INTEGER REFERENCES warehouse.dim_category(category_key),
          currency_key INTEGER REFERENCES warehouse.dim_currency(currency_key),
          
          -- Spend measures
          gross_amount DECIMAL(15,2),
          discount_amount DECIMAL(15,2),
          tax_amount DECIMAL(15,2),
          net_amount DECIMAL(15,2),
          
          -- Exchange rates
          exchange_rate DECIMAL(10,6),
          usd_amount DECIMAL(15,2),
          
          -- Transaction details
          transaction_type VARCHAR(50),
          payment_method VARCHAR(50),
          
          created_at TIMESTAMP DEFAULT NOW()
        );

        -- Performance Fact Table
        CREATE TABLE IF NOT EXISTS warehouse.fact_performance (
          performance_key SERIAL PRIMARY KEY,
          time_key INTEGER REFERENCES warehouse.dim_time(time_key),
          vessel_key INTEGER REFERENCES warehouse.dim_vessel(vessel_key),
          vendor_key INTEGER REFERENCES warehouse.dim_vendor(vendor_key),
          
          -- Performance measures
          delivery_performance DECIMAL(5,2),
          quality_score DECIMAL(5,2),
          price_competitiveness DECIMAL(5,2),
          response_time_hours INTEGER,
          
          -- Counts
          total_orders INTEGER,
          on_time_deliveries INTEGER,
          quality_issues INTEGER,
          
          created_at TIMESTAMP DEFAULT NOW()
        );
      `);

      // Create indexes for performance
      await client.query(`
        -- Time dimension indexes
        CREATE INDEX IF NOT EXISTS idx_dim_time_date ON warehouse.dim_time(date_actual);
        CREATE INDEX IF NOT EXISTS idx_dim_time_year_month ON warehouse.dim_time(year, month);
        
        -- Vessel dimension indexes
        CREATE INDEX IF NOT EXISTS idx_dim_vessel_id ON warehouse.dim_vessel(vessel_id);
        CREATE INDEX IF NOT EXISTS idx_dim_vessel_current ON warehouse.dim_vessel(is_current);
        
        -- Vendor dimension indexes
        CREATE INDEX IF NOT EXISTS idx_dim_vendor_id ON warehouse.dim_vendor(vendor_id);
        CREATE INDEX IF NOT EXISTS idx_dim_vendor_current ON warehouse.dim_vendor(is_current);
        
        -- Fact table indexes
        CREATE INDEX IF NOT EXISTS idx_fact_procurement_time ON warehouse.fact_procurement(time_key);
        CREATE INDEX IF NOT EXISTS idx_fact_procurement_vessel ON warehouse.fact_procurement(vessel_key);
        CREATE INDEX IF NOT EXISTS idx_fact_procurement_vendor ON warehouse.fact_procurement(vendor_key);
        CREATE INDEX IF NOT EXISTS idx_fact_procurement_date ON warehouse.fact_procurement(requisition_date);
        
        CREATE INDEX IF NOT EXISTS idx_fact_spend_time ON warehouse.fact_spend(time_key);
        CREATE INDEX IF NOT EXISTS idx_fact_spend_vessel ON warehouse.fact_spend(vessel_key);
        CREATE INDEX IF NOT EXISTS idx_fact_spend_vendor ON warehouse.fact_spend(vendor_key);
        
        CREATE INDEX IF NOT EXISTS idx_fact_performance_time ON warehouse.fact_performance(time_key);
        CREATE INDEX IF NOT EXISTS idx_fact_performance_vessel ON warehouse.fact_performance(vessel_key);
        CREATE INDEX IF NOT EXISTS idx_fact_performance_vendor ON warehouse.fact_performance(vendor_key);
      `);

      logger.info('Data warehouse schema initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize warehouse schema:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private initializeETLJobs(): void {
    // Time Dimension ETL
    this.etlJobs.set('load_dim_time', {
      id: 'load_dim_time',
      name: 'Load Time Dimension',
      description: 'Populate time dimension with date records',
      sourceQuery: `
        SELECT 
          generate_series(
            CURRENT_DATE - INTERVAL '2 years',
            CURRENT_DATE + INTERVAL '2 years',
            '1 day'::interval
          )::date as date_actual
      `,
      targetTable: 'warehouse.dim_time',
      transformations: [
        {
          type: 'calculate',
          config: {
            fields: {
              year: 'EXTRACT(YEAR FROM date_actual)',
              quarter: 'EXTRACT(QUARTER FROM date_actual)',
              month: 'EXTRACT(MONTH FROM date_actual)',
              week: 'EXTRACT(WEEK FROM date_actual)',
              day_of_year: 'EXTRACT(DOY FROM date_actual)',
              day_of_month: 'EXTRACT(DAY FROM date_actual)',
              day_of_week: 'EXTRACT(DOW FROM date_actual)',
              month_name: 'TO_CHAR(date_actual, \'Month\')',
              day_name: 'TO_CHAR(date_actual, \'Day\')',
              is_weekend: 'EXTRACT(DOW FROM date_actual) IN (0, 6)',
              fiscal_year: 'CASE WHEN EXTRACT(MONTH FROM date_actual) >= 4 THEN EXTRACT(YEAR FROM date_actual) ELSE EXTRACT(YEAR FROM date_actual) - 1 END',
              fiscal_quarter: 'CASE WHEN EXTRACT(MONTH FROM date_actual) BETWEEN 4 AND 6 THEN 1 WHEN EXTRACT(MONTH FROM date_actual) BETWEEN 7 AND 9 THEN 2 WHEN EXTRACT(MONTH FROM date_actual) BETWEEN 10 AND 12 THEN 3 ELSE 4 END'
            }
          }
        }
      ],
      schedule: '0 2 * * 0', // Weekly on Sunday at 2 AM
      enabled: true,
      status: 'idle'
    });

    // Vessel Dimension ETL
    this.etlJobs.set('load_dim_vessel', {
      id: 'load_dim_vessel',
      name: 'Load Vessel Dimension',
      description: 'Load vessel dimension with SCD Type 2',
      sourceQuery: `
        SELECT 
          id as vessel_id,
          name as vessel_name,
          imo_number,
          vessel_type,
          flag,
          engine_type,
          cargo_capacity,
          fuel_consumption,
          crew_complement,
          EXTRACT(YEAR FROM created_at) as build_year,
          'Unknown' as classification_society,
          created_at::date as effective_date
        FROM vessels
        WHERE updated_at > COALESCE($1, '1900-01-01'::timestamp)
      `,
      targetTable: 'warehouse.dim_vessel',
      transformations: [
        {
          type: 'map',
          config: {
            scd_type: 2,
            natural_key: 'vessel_id',
            compare_fields: ['vessel_name', 'vessel_type', 'flag', 'engine_type']
          }
        }
      ],
      schedule: '0 3 * * *', // Daily at 3 AM
      enabled: true,
      status: 'idle'
    });

    // Procurement Fact ETL
    this.etlJobs.set('load_fact_procurement', {
      id: 'load_fact_procurement',
      name: 'Load Procurement Facts',
      description: 'Load procurement transaction facts',
      sourceQuery: `
        SELECT 
          r.id as requisition_id,
          po.id as purchase_order_id,
          i.id as invoice_id,
          r.vessel_id,
          po.vendor_id,
          'Unknown' as category_id,
          'Unknown' as port_code,
          r.currency as currency_code,
          r.total_amount as requisition_amount,
          po.total_amount as po_amount,
          i.amount as invoice_amount,
          CASE WHEN i.status = 'PAID' THEN i.amount ELSE 0 END as paid_amount,
          1 as quantity_requested,
          1 as quantity_ordered,
          CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END as quantity_delivered,
          EXTRACT(EPOCH FROM (r.updated_at - r.created_at))/86400 as approval_cycle_time,
          EXTRACT(EPOCH FROM (po.created_at - r.created_at))/86400 as procurement_cycle_time,
          EXTRACT(EPOCH FROM (d.delivered_at - po.created_at))/86400 as delivery_cycle_time,
          EXTRACT(EPOCH FROM (i.paid_date - i.created_at))/86400 as payment_cycle_time,
          r.urgency_level = 'EMERGENCY' as is_emergency,
          r.status = 'COMPLETED' as is_completed,
          d.delivered_at <= d.expected_delivery_date as is_on_time,
          po.total_amount <= r.total_amount * 1.1 as is_within_budget,
          r.created_at::date as requisition_date,
          r.updated_at::date as approval_date,
          po.created_at::date as po_date,
          d.delivered_at::date as delivery_date,
          i.created_at::date as invoice_date,
          i.paid_date::date as payment_date
        FROM requisitions r
        LEFT JOIN purchase_orders po ON r.id = po.requisition_id
        LEFT JOIN invoices i ON po.id = i.purchase_order_id
        LEFT JOIN deliveries d ON po.id = d.purchase_order_id
        WHERE r.updated_at > COALESCE($1, '1900-01-01'::timestamp)
      `,
      targetTable: 'warehouse.fact_procurement',
      transformations: [
        {
          type: 'join',
          config: {
            joins: [
              { table: 'warehouse.dim_time', on: 'requisition_date = date_actual', select: 'time_key' },
              { table: 'warehouse.dim_vessel', on: 'vessel_id = vessel_id AND is_current = true', select: 'vessel_key' },
              { table: 'warehouse.dim_vendor', on: 'vendor_id = vendor_id AND is_current = true', select: 'vendor_key' },
              { table: 'warehouse.dim_currency', on: 'currency_code = currency_code', select: 'currency_key' }
            ]
          }
        }
      ],
      schedule: '0 4 * * *', // Daily at 4 AM
      enabled: true,
      status: 'idle'
    });
  }

  private initializeDataQualityRules(): void {
    // Not null rules
    this.dataQualityRules.set('vessel_name_not_null', {
      id: 'vessel_name_not_null',
      name: 'Vessel Name Not Null',
      description: 'Vessel name must not be null',
      table: 'warehouse.dim_vessel',
      column: 'vessel_name',
      rule: 'not_null',
      config: {},
      severity: 'error'
    });

    // Unique rules
    this.dataQualityRules.set('vessel_id_unique', {
      id: 'vessel_id_unique',
      name: 'Vessel ID Unique',
      description: 'Vessel ID must be unique for current records',
      table: 'warehouse.dim_vessel',
      column: 'vessel_id',
      rule: 'unique',
      config: { where: 'is_current = true' },
      severity: 'error'
    });

    // Range rules
    this.dataQualityRules.set('amount_positive', {
      id: 'amount_positive',
      name: 'Amount Positive',
      description: 'Procurement amounts must be positive',
      table: 'warehouse.fact_procurement',
      column: 'requisition_amount',
      rule: 'range',
      config: { min: 0 },
      severity: 'warning'
    });

    // Format rules
    this.dataQualityRules.set('currency_code_format', {
      id: 'currency_code_format',
      name: 'Currency Code Format',
      description: 'Currency code must be 3 characters',
      table: 'warehouse.dim_currency',
      column: 'currency_code',
      rule: 'format',
      config: { pattern: '^[A-Z]{3}$' },
      severity: 'error'
    });
  }

  async runETLJob(jobId: string, parameters: Record<string, any> = {}): Promise<void> {
    const job = this.etlJobs.get(jobId);
    if (!job) {
      throw new AppError(`ETL job ${jobId} not found`, 404, 'ETL_JOB_NOT_FOUND');
    }

    if (job.status === 'running') {
      throw new AppError(`ETL job ${jobId} is already running`, 409, 'ETL_JOB_RUNNING');
    }

    job.status = 'running';
    job.lastRun = new Date();

    const client = await this.warehousePool.connect();
    
    try {
      logger.info(`Starting ETL job: ${job.name}`);

      // Extract data from source
      const sourceClient = await this.dbPool.connect();
      let sourceData: any[];
      
      try {
        const lastRunTime = parameters.lastRunTime || job.lastRun;
        const result = await sourceClient.query(job.sourceQuery, lastRunTime ? [lastRunTime] : []);
        sourceData = result.rows;
      } finally {
        sourceClient.release();
      }

      if (sourceData.length === 0) {
        logger.info(`No data to process for ETL job: ${job.name}`);
        job.status = 'completed';
        return;
      }

      // Transform data
      const transformedData = await this.transformData(sourceData, job.transformations);

      // Load data into warehouse
      await this.loadData(client, job.targetTable, transformedData);

      job.status = 'completed';
      logger.info(`ETL job completed: ${job.name}, processed ${transformedData.length} records`);

    } catch (error) {
      job.status = 'failed';
      logger.error(`ETL job failed: ${job.name}`, error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async transformData(data: any[], transformations: ETLTransformation[]): Promise<any[]> {
    let transformedData = [...data];

    for (const transformation of transformations) {
      switch (transformation.type) {
        case 'calculate':
          transformedData = transformedData.map(row => {
            const calculatedFields: Record<string, any> = {};
            for (const [field, expression] of Object.entries(transformation.config.fields)) {
              // This is a simplified calculation - in production, you'd use a proper expression evaluator
              calculatedFields[field] = this.evaluateExpression(expression as string, row);
            }
            return { ...row, ...calculatedFields };
          });
          break;

        case 'filter':
          transformedData = transformedData.filter(row => 
            this.evaluateCondition(transformation.config.condition, row)
          );
          break;

        case 'map':
          if (transformation.config.scd_type === 2) {
            // Handle Slowly Changing Dimension Type 2
            transformedData = await this.handleSCD2(transformedData, transformation.config);
          }
          break;

        case 'join':
          transformedData = await this.performJoins(transformedData, transformation.config.joins);
          break;
      }
    }

    return transformedData;
  }

  private evaluateExpression(expression: string, row: any): any {
    // Simplified expression evaluator - in production, use a proper library
    try {
      // Replace column references with actual values
      let evaluatedExpression = expression;
      for (const [key, value] of Object.entries(row)) {
        evaluatedExpression = evaluatedExpression.replace(new RegExp(`\\b${key}\\b`, 'g'), `'${value}'`);
      }
      
      // This is unsafe - in production, use a safe expression evaluator
      return eval(evaluatedExpression);
    } catch (error) {
      logger.warn(`Failed to evaluate expression: ${expression}`, error);
      return null;
    }
  }

  private evaluateCondition(condition: string, row: any): boolean {
    // Simplified condition evaluator
    try {
      let evaluatedCondition = condition;
      for (const [key, value] of Object.entries(row)) {
        evaluatedCondition = evaluatedCondition.replace(new RegExp(`\\b${key}\\b`, 'g'), `'${value}'`);
      }
      
      return eval(evaluatedCondition);
    } catch (error) {
      logger.warn(`Failed to evaluate condition: ${condition}`, error);
      return false;
    }
  }

  private async handleSCD2(data: any[], config: any): Promise<any[]> {
    // Simplified SCD Type 2 implementation
    const naturalKey = config.natural_key;
    const compareFields = config.compare_fields;
    
    const result: any[] = [];
    
    for (const row of data) {
      // Check if record exists and has changed
      const existingRecord = await this.warehousePool.query(
        `SELECT * FROM ${config.target_table} WHERE ${naturalKey} = $1 AND is_current = true`,
        [row[naturalKey]]
      );

      if (existingRecord.rows.length === 0) {
        // New record
        result.push({
          ...row,
          effective_date: new Date(),
          expiry_date: null,
          is_current: true
        });
      } else {
        // Check if any compare fields have changed
        const existing = existingRecord.rows[0];
        const hasChanged = compareFields.some((field: string) => existing[field] !== row[field]);

        if (hasChanged) {
          // Expire existing record
          await this.warehousePool.query(
            `UPDATE ${config.target_table} SET expiry_date = CURRENT_DATE, is_current = false WHERE ${naturalKey} = $1 AND is_current = true`,
            [row[naturalKey]]
          );

          // Add new version
          result.push({
            ...row,
            effective_date: new Date(),
            expiry_date: null,
            is_current: true
          });
        }
      }
    }

    return result;
  }

  private async performJoins(data: any[], joins: any[]): Promise<any[]> {
    // Simplified join implementation
    const result: any[] = [];

    for (const row of data) {
      let joinedRow = { ...row };

      for (const join of joins) {
        const joinResult = await this.warehousePool.query(
          `SELECT ${join.select} FROM ${join.table} WHERE ${join.on}`,
          []
        );

        if (joinResult.rows.length > 0) {
          joinedRow = { ...joinedRow, ...joinResult.rows[0] };
        }
      }

      result.push(joinedRow);
    }

    return result;
  }

  private async loadData(client: PoolClient, targetTable: string, data: any[]): Promise<void> {
    if (data.length === 0) return;

    // Generate INSERT statement
    const columns = Object.keys(data[0]);
    const placeholders = data.map((_, index) => 
      `(${columns.map((_, colIndex) => `$${index * columns.length + colIndex + 1}`).join(', ')})`
    ).join(', ');

    const values = data.flatMap(row => columns.map(col => row[col]));

    const insertQuery = `
      INSERT INTO ${targetTable} (${columns.join(', ')})
      VALUES ${placeholders}
      ON CONFLICT DO NOTHING
    `;

    await client.query(insertQuery, values);
  }

  private scheduleETLJobs(): void {
    for (const [jobId, job] of this.etlJobs) {
      if (job.enabled && job.schedule) {
        const task = cron.schedule(job.schedule, async () => {
          try {
            await this.runETLJob(jobId);
          } catch (error) {
            logger.error(`Scheduled ETL job failed: ${jobId}`, error);
          }
        }, {
          scheduled: false
        });

        this.scheduledJobs.set(jobId, task);
        task.start();

        // Calculate next run time
        job.nextRun = this.getNextRunTime(job.schedule);
        
        logger.info(`Scheduled ETL job: ${job.name} (${job.schedule})`);
      }
    }
  }

  private getNextRunTime(cronExpression: string): Date {
    // Simplified next run calculation - use a proper cron library in production
    const now = new Date();
    return new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day for simplicity
  }

  async runDataQualityCheck(ruleId?: string): Promise<DataQualityResult[]> {
    const rulesToCheck = ruleId ? 
      [this.dataQualityRules.get(ruleId)!] : 
      Array.from(this.dataQualityRules.values());

    const results: DataQualityResult[] = [];

    for (const rule of rulesToCheck) {
      if (!rule) continue;

      try {
        const result = await this.executeDataQualityRule(rule);
        results.push(result);
      } catch (error) {
        logger.error(`Data quality check failed for rule ${rule.id}:`, error);
        results.push({
          ruleId: rule.id,
          passed: false,
          violationCount: -1,
          details: `Check failed: ${error.message}`,
          timestamp: new Date()
        });
      }
    }

    return results;
  }

  private async executeDataQualityRule(rule: DataQualityRule): Promise<DataQualityResult> {
    let query: string;
    let expectedViolations = 0;

    switch (rule.rule) {
      case 'not_null':
        query = `SELECT COUNT(*) as violations FROM ${rule.table} WHERE ${rule.column} IS NULL`;
        break;

      case 'unique':
        const whereClause = rule.config.where ? ` WHERE ${rule.config.where}` : '';
        query = `
          SELECT COUNT(*) - COUNT(DISTINCT ${rule.column}) as violations 
          FROM ${rule.table}${whereClause}
        `;
        break;

      case 'range':
        const conditions: string[] = [];
        if (rule.config.min !== undefined) {
          conditions.push(`${rule.column} < ${rule.config.min}`);
        }
        if (rule.config.max !== undefined) {
          conditions.push(`${rule.column} > ${rule.config.max}`);
        }
        query = `SELECT COUNT(*) as violations FROM ${rule.table} WHERE ${conditions.join(' OR ')}`;
        break;

      case 'format':
        query = `
          SELECT COUNT(*) as violations 
          FROM ${rule.table} 
          WHERE ${rule.column} !~ '${rule.config.pattern}'
        `;
        break;

      case 'reference':
        query = `
          SELECT COUNT(*) as violations 
          FROM ${rule.table} t1
          LEFT JOIN ${rule.config.reference_table} t2 ON t1.${rule.column} = t2.${rule.config.reference_column}
          WHERE t2.${rule.config.reference_column} IS NULL AND t1.${rule.column} IS NOT NULL
        `;
        break;

      case 'custom':
        query = rule.config.query;
        break;

      default:
        throw new AppError(`Unknown data quality rule type: ${rule.rule}`, 400, 'UNKNOWN_RULE_TYPE');
    }

    const result = await this.warehousePool.query(query);
    const violationCount = parseInt(result.rows[0].violations || '0');

    return {
      ruleId: rule.id,
      passed: violationCount === expectedViolations,
      violationCount,
      details: violationCount > 0 ? 
        `Found ${violationCount} violations of rule: ${rule.description}` : 
        'No violations found',
      timestamp: new Date()
    };
  }

  // Management methods
  async getETLJobs(): Promise<ETLJobConfig[]> {
    return Array.from(this.etlJobs.values());
  }

  async getETLJobStatus(jobId: string): Promise<ETLJobConfig | null> {
    return this.etlJobs.get(jobId) || null;
  }

  async enableETLJob(jobId: string): Promise<void> {
    const job = this.etlJobs.get(jobId);
    if (!job) {
      throw new AppError(`ETL job ${jobId} not found`, 404, 'ETL_JOB_NOT_FOUND');
    }

    job.enabled = true;
    
    if (job.schedule && !this.scheduledJobs.has(jobId)) {
      const task = cron.schedule(job.schedule, async () => {
        try {
          await this.runETLJob(jobId);
        } catch (error) {
          logger.error(`Scheduled ETL job failed: ${jobId}`, error);
        }
      });

      this.scheduledJobs.set(jobId, task);
      task.start();
    }
  }

  async disableETLJob(jobId: string): Promise<void> {
    const job = this.etlJobs.get(jobId);
    if (!job) {
      throw new AppError(`ETL job ${jobId} not found`, 404, 'ETL_JOB_NOT_FOUND');
    }

    job.enabled = false;
    
    const scheduledTask = this.scheduledJobs.get(jobId);
    if (scheduledTask) {
      scheduledTask.stop();
      this.scheduledJobs.delete(jobId);
    }
  }

  async getDataQualityRules(): Promise<DataQualityRule[]> {
    return Array.from(this.dataQualityRules.values());
  }

  async addDataQualityRule(rule: DataQualityRule): Promise<void> {
    this.dataQualityRules.set(rule.id, rule);
  }

  async removeDataQualityRule(ruleId: string): Promise<void> {
    this.dataQualityRules.delete(ruleId);
  }
}