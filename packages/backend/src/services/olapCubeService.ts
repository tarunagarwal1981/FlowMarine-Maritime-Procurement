import { Pool } from 'pg';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

interface Dimension {
  name: string;
  table: string;
  keyColumn: string;
  nameColumn: string;
  hierarchies: Hierarchy[];
  attributes: DimensionAttribute[];
}

interface Hierarchy {
  name: string;
  levels: HierarchyLevel[];
}

interface HierarchyLevel {
  name: string;
  column: string;
  orderBy?: string;
}

interface DimensionAttribute {
  name: string;
  column: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
}

interface Measure {
  name: string;
  column: string;
  aggregation: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'count_distinct';
  dataType: 'number' | 'currency' | 'percentage';
  formatString?: string;
}

interface CubeDefinition {
  name: string;
  description: string;
  factTable: string;
  dimensions: Dimension[];
  measures: Measure[];
  calculatedMembers: CalculatedMember[];
}

interface CalculatedMember {
  name: string;
  expression: string;
  dataType: 'number' | 'currency' | 'percentage';
  formatString?: string;
}

interface MDXQuery {
  select: string[];
  from: string;
  where?: string[];
  slicer?: string[];
}

interface CubeData {
  dimensions: string[];
  measures: string[];
  data: any[][];
  metadata: {
    dimensionMembers: Record<string, any[]>;
    measureInfo: Record<string, any>;
  };
}

export class OLAPCubeService {
  private warehousePool: Pool;
  private cubes: Map<string, CubeDefinition> = new Map();

  constructor(warehousePool: Pool) {
    this.warehousePool = warehousePool;
    this.initializeCubes();
  }

  private initializeCubes(): void {
    // Maritime Procurement Cube
    const procurementCube: CubeDefinition = {
      name: 'MaritimeProcurement',
      description: 'Maritime procurement analytics cube',
      factTable: 'warehouse.fact_procurement',
      dimensions: [
        {
          name: 'Time',
          table: 'warehouse.dim_time',
          keyColumn: 'time_key',
          nameColumn: 'date_actual',
          hierarchies: [
            {
              name: 'Calendar',
              levels: [
                { name: 'Year', column: 'year' },
                { name: 'Quarter', column: 'quarter', orderBy: 'quarter' },
                { name: 'Month', column: 'month_name', orderBy: 'month' },
                { name: 'Date', column: 'date_actual' }
              ]
            },
            {
              name: 'Fiscal',
              levels: [
                { name: 'FiscalYear', column: 'fiscal_year' },
                { name: 'FiscalQuarter', column: 'fiscal_quarter', orderBy: 'fiscal_quarter' },
                { name: 'Month', column: 'month_name', orderBy: 'month' }
              ]
            }
          ],
          attributes: [
            { name: 'DayOfWeek', column: 'day_of_week', dataType: 'number' },
            { name: 'IsWeekend', column: 'is_weekend', dataType: 'boolean' },
            { name: 'IsHoliday', column: 'is_holiday', dataType: 'boolean' }
          ]
        },
        {
          name: 'Vessel',
          table: 'warehouse.dim_vessel',
          keyColumn: 'vessel_key',
          nameColumn: 'vessel_name',
          hierarchies: [
            {
              name: 'VesselHierarchy',
              levels: [
                { name: 'VesselType', column: 'vessel_type' },
                { name: 'Flag', column: 'flag' },
                { name: 'Vessel', column: 'vessel_name' }
              ]
            }
          ],
          attributes: [
            { name: 'IMONumber', column: 'imo_number', dataType: 'string' },
            { name: 'EngineType', column: 'engine_type', dataType: 'string' },
            { name: 'CargoCapacity', column: 'cargo_capacity', dataType: 'number' },
            { name: 'FuelConsumption', column: 'fuel_consumption', dataType: 'number' },
            { name: 'CrewComplement', column: 'crew_complement', dataType: 'number' }
          ]
        },
        {
          name: 'Vendor',
          table: 'warehouse.dim_vendor',
          keyColumn: 'vendor_key',
          nameColumn: 'vendor_name',
          hierarchies: [
            {
              name: 'Geography',
              levels: [
                { name: 'Country', column: 'country' },
                { name: 'City', column: 'city' },
                { name: 'Vendor', column: 'vendor_name' }
              ]
            },
            {
              name: 'VendorType',
              levels: [
                { name: 'VendorType', column: 'vendor_type' },
                { name: 'Vendor', column: 'vendor_name' }
              ]
            }
          ],
          attributes: [
            { name: 'VendorCode', column: 'vendor_code', dataType: 'string' },
            { name: 'PaymentTerms', column: 'payment_terms', dataType: 'string' },
            { name: 'CreditLimit', column: 'credit_limit', dataType: 'number' },
            { name: 'QualityRating', column: 'quality_rating', dataType: 'number' },
            { name: 'DeliveryRating', column: 'delivery_rating', dataType: 'number' },
            { name: 'OverallScore', column: 'overall_score', dataType: 'number' }
          ]
        },
        {
          name: 'Category',
          table: 'warehouse.dim_category',
          keyColumn: 'category_key',
          nameColumn: 'category_name',
          hierarchies: [
            {
              name: 'CategoryHierarchy',
              levels: [
                { name: 'Level1', column: 'category_level' },
                { name: 'Category', column: 'category_name' }
              ]
            }
          ],
          attributes: [
            { name: 'IMPACode', column: 'impa_code', dataType: 'string' },
            { name: 'ISSACode', column: 'issa_code', dataType: 'string' },
            { name: 'CriticalityLevel', column: 'criticality_level', dataType: 'string' }
          ]
        },
        {
          name: 'Geography',
          table: 'warehouse.dim_geography',
          keyColumn: 'geography_key',
          nameColumn: 'port_name',
          hierarchies: [
            {
              name: 'Geographic',
              levels: [
                { name: 'Continent', column: 'continent' },
                { name: 'Region', column: 'region' },
                { name: 'Country', column: 'country' },
                { name: 'City', column: 'city' },
                { name: 'Port', column: 'port_name' }
              ]
            }
          ],
          attributes: [
            { name: 'PortCode', column: 'port_code', dataType: 'string' },
            { name: 'Latitude', column: 'latitude', dataType: 'number' },
            { name: 'Longitude', column: 'longitude', dataType: 'number' },
            { name: 'TimeZone', column: 'time_zone', dataType: 'string' }
          ]
        }
      ],
      measures: [
        {
          name: 'RequisitionAmount',
          column: 'requisition_amount',
          aggregation: 'sum',
          dataType: 'currency',
          formatString: '$#,##0.00'
        },
        {
          name: 'POAmount',
          column: 'po_amount',
          aggregation: 'sum',
          dataType: 'currency',
          formatString: '$#,##0.00'
        },
        {
          name: 'InvoiceAmount',
          column: 'invoice_amount',
          aggregation: 'sum',
          dataType: 'currency',
          formatString: '$#,##0.00'
        },
        {
          name: 'PaidAmount',
          column: 'paid_amount',
          aggregation: 'sum',
          dataType: 'currency',
          formatString: '$#,##0.00'
        },
        {
          name: 'QuantityRequested',
          column: 'quantity_requested',
          aggregation: 'sum',
          dataType: 'number',
          formatString: '#,##0'
        },
        {
          name: 'QuantityOrdered',
          column: 'quantity_ordered',
          aggregation: 'sum',
          dataType: 'number',
          formatString: '#,##0'
        },
        {
          name: 'QuantityDelivered',
          column: 'quantity_delivered',
          aggregation: 'sum',
          dataType: 'number',
          formatString: '#,##0'
        },
        {
          name: 'ApprovalCycleTime',
          column: 'approval_cycle_time',
          aggregation: 'avg',
          dataType: 'number',
          formatString: '#,##0.0'
        },
        {
          name: 'ProcurementCycleTime',
          column: 'procurement_cycle_time',
          aggregation: 'avg',
          dataType: 'number',
          formatString: '#,##0.0'
        },
        {
          name: 'DeliveryCycleTime',
          column: 'delivery_cycle_time',
          aggregation: 'avg',
          dataType: 'number',
          formatString: '#,##0.0'
        },
        {
          name: 'PaymentCycleTime',
          column: 'payment_cycle_time',
          aggregation: 'avg',
          dataType: 'number',
          formatString: '#,##0.0'
        },
        {
          name: 'TransactionCount',
          column: 'procurement_key',
          aggregation: 'count',
          dataType: 'number',
          formatString: '#,##0'
        },
        {
          name: 'EmergencyCount',
          column: 'is_emergency',
          aggregation: 'sum',
          dataType: 'number',
          formatString: '#,##0'
        },
        {
          name: 'OnTimeDeliveryCount',
          column: 'is_on_time',
          aggregation: 'sum',
          dataType: 'number',
          formatString: '#,##0'
        }
      ],
      calculatedMembers: [
        {
          name: 'AverageOrderValue',
          expression: '[Measures].[POAmount] / [Measures].[TransactionCount]',
          dataType: 'currency',
          formatString: '$#,##0.00'
        },
        {
          name: 'DeliveryEfficiency',
          expression: '[Measures].[OnTimeDeliveryCount] / [Measures].[TransactionCount] * 100',
          dataType: 'percentage',
          formatString: '#,##0.0%'
        },
        {
          name: 'EmergencyRate',
          expression: '[Measures].[EmergencyCount] / [Measures].[TransactionCount] * 100',
          dataType: 'percentage',
          formatString: '#,##0.0%'
        },
        {
          name: 'FulfillmentRate',
          expression: '[Measures].[QuantityDelivered] / [Measures].[QuantityOrdered] * 100',
          dataType: 'percentage',
          formatString: '#,##0.0%'
        },
        {
          name: 'BudgetVariance',
          expression: '([Measures].[POAmount] - [Measures].[RequisitionAmount]) / [Measures].[RequisitionAmount] * 100',
          dataType: 'percentage',
          formatString: '#,##0.0%'
        }
      ]
    };

    this.cubes.set('MaritimeProcurement', procurementCube);

    // Spend Analysis Cube
    const spendCube: CubeDefinition = {
      name: 'SpendAnalysis',
      description: 'Financial spend analysis cube',
      factTable: 'warehouse.fact_spend',
      dimensions: [
        {
          name: 'Time',
          table: 'warehouse.dim_time',
          keyColumn: 'time_key',
          nameColumn: 'date_actual',
          hierarchies: [
            {
              name: 'Calendar',
              levels: [
                { name: 'Year', column: 'year' },
                { name: 'Quarter', column: 'quarter' },
                { name: 'Month', column: 'month_name' }
              ]
            }
          ],
          attributes: []
        },
        {
          name: 'Vessel',
          table: 'warehouse.dim_vessel',
          keyColumn: 'vessel_key',
          nameColumn: 'vessel_name',
          hierarchies: [
            {
              name: 'VesselHierarchy',
              levels: [
                { name: 'VesselType', column: 'vessel_type' },
                { name: 'Vessel', column: 'vessel_name' }
              ]
            }
          ],
          attributes: []
        },
        {
          name: 'Currency',
          table: 'warehouse.dim_currency',
          keyColumn: 'currency_key',
          nameColumn: 'currency_name',
          hierarchies: [
            {
              name: 'CurrencyHierarchy',
              levels: [
                { name: 'Currency', column: 'currency_name' }
              ]
            }
          ],
          attributes: [
            { name: 'CurrencyCode', column: 'currency_code', dataType: 'string' },
            { name: 'Symbol', column: 'symbol', dataType: 'string' }
          ]
        }
      ],
      measures: [
        {
          name: 'GrossAmount',
          column: 'gross_amount',
          aggregation: 'sum',
          dataType: 'currency',
          formatString: '$#,##0.00'
        },
        {
          name: 'NetAmount',
          column: 'net_amount',
          aggregation: 'sum',
          dataType: 'currency',
          formatString: '$#,##0.00'
        },
        {
          name: 'USDAmount',
          column: 'usd_amount',
          aggregation: 'sum',
          dataType: 'currency',
          formatString: '$#,##0.00'
        },
        {
          name: 'DiscountAmount',
          column: 'discount_amount',
          aggregation: 'sum',
          dataType: 'currency',
          formatString: '$#,##0.00'
        },
        {
          name: 'TaxAmount',
          column: 'tax_amount',
          aggregation: 'sum',
          dataType: 'currency',
          formatString: '$#,##0.00'
        }
      ],
      calculatedMembers: [
        {
          name: 'DiscountRate',
          expression: '[Measures].[DiscountAmount] / [Measures].[GrossAmount] * 100',
          dataType: 'percentage',
          formatString: '#,##0.0%'
        },
        {
          name: 'TaxRate',
          expression: '[Measures].[TaxAmount] / [Measures].[NetAmount] * 100',
          dataType: 'percentage',
          formatString: '#,##0.0%'
        }
      ]
    };

    this.cubes.set('SpendAnalysis', spendCube);
  }

  async executeMDXQuery(cubeName: string, mdxQuery: string): Promise<CubeData> {
    const cube = this.cubes.get(cubeName);
    if (!cube) {
      throw new AppError(`Cube ${cubeName} not found`, 404, 'CUBE_NOT_FOUND');
    }

    try {
      // Parse MDX query (simplified implementation)
      const parsedQuery = this.parseMDXQuery(mdxQuery);
      
      // Convert MDX to SQL
      const sqlQuery = this.convertMDXToSQL(cube, parsedQuery);
      
      // Execute SQL query
      const result = await this.warehousePool.query(sqlQuery.query, sqlQuery.parameters);
      
      // Format result as cube data
      return this.formatCubeData(cube, parsedQuery, result.rows);
    } catch (error) {
      logger.error(`MDX query execution failed for cube ${cubeName}:`, error);
      throw new AppError('MDX query execution failed', 500, 'MDX_EXECUTION_FAILED');
    }
  }

  private parseMDXQuery(mdxQuery: string): MDXQuery {
    // Simplified MDX parser - in production, use a proper MDX parser
    const lines = mdxQuery.split('\n').map(line => line.trim()).filter(line => line);
    
    const parsed: MDXQuery = {
      select: [],
      from: ''
    };

    for (const line of lines) {
      if (line.toUpperCase().startsWith('SELECT')) {
        const selectPart = line.substring(6).trim();
        parsed.select = selectPart.split(',').map(s => s.trim());
      } else if (line.toUpperCase().startsWith('FROM')) {
        parsed.from = line.substring(4).trim();
      } else if (line.toUpperCase().startsWith('WHERE')) {
        parsed.where = [line.substring(5).trim()];
      }
    }

    return parsed;
  }

  private convertMDXToSQL(cube: CubeDefinition, mdxQuery: MDXQuery): { query: string; parameters: any[] } {
    // Simplified MDX to SQL conversion
    const selectClauses: string[] = [];
    const joinClauses: string[] = [];
    const whereClauses: string[] = [];
    const groupByClauses: string[] = [];
    const parameters: any[] = [];

    // Process SELECT clause
    for (const selectItem of mdxQuery.select) {
      if (selectItem.includes('[Measures].')) {
        // Handle measures
        const measureName = selectItem.replace(/\[Measures\]\.\[([^\]]+)\]/, '$1');
        const measure = cube.measures.find(m => m.name === measureName);
        if (measure) {
          selectClauses.push(`${measure.aggregation.toUpperCase()}(f.${measure.column}) as ${measure.name}`);
        }
      } else {
        // Handle dimensions
        const dimensionMatch = selectItem.match(/\[([^\]]+)\]\.\[([^\]]+)\]/);
        if (dimensionMatch) {
          const dimensionName = dimensionMatch[1];
          const levelName = dimensionMatch[2];
          
          const dimension = cube.dimensions.find(d => d.name === dimensionName);
          if (dimension) {
            const hierarchy = dimension.hierarchies[0]; // Use first hierarchy for simplicity
            const level = hierarchy.levels.find(l => l.name === levelName);
            if (level) {
              const alias = `d_${dimensionName.toLowerCase()}`;
              selectClauses.push(`${alias}.${level.column} as ${dimensionName}_${levelName}`);
              groupByClauses.push(`${alias}.${level.column}`);
              
              // Add join if not already added
              if (!joinClauses.some(j => j.includes(alias))) {
                joinClauses.push(`LEFT JOIN ${dimension.table} ${alias} ON f.${dimensionName.toLowerCase()}_key = ${alias}.${dimension.keyColumn}`);
              }
            }
          }
        }
      }
    }

    // Process WHERE clause
    if (mdxQuery.where) {
      for (const whereItem of mdxQuery.where) {
        // Simplified WHERE processing
        whereClauses.push('1=1'); // Placeholder
      }
    }

    // Build final SQL query
    const query = `
      SELECT ${selectClauses.join(', ')}
      FROM ${cube.factTable} f
      ${joinClauses.join(' ')}
      ${whereClauses.length > 0 ? 'WHERE ' + whereClauses.join(' AND ') : ''}
      ${groupByClauses.length > 0 ? 'GROUP BY ' + groupByClauses.join(', ') : ''}
      ORDER BY ${groupByClauses.join(', ')}
    `;

    return { query, parameters };
  }

  private formatCubeData(cube: CubeDefinition, mdxQuery: MDXQuery, rows: any[]): CubeData {
    const dimensions: string[] = [];
    const measures: string[] = [];
    const dimensionMembers: Record<string, any[]> = {};
    const measureInfo: Record<string, any> = {};

    // Extract dimensions and measures from query
    for (const selectItem of mdxQuery.select) {
      if (selectItem.includes('[Measures].')) {
        const measureName = selectItem.replace(/\[Measures\]\.\[([^\]]+)\]/, '$1');
        measures.push(measureName);
        
        const measure = cube.measures.find(m => m.name === measureName);
        if (measure) {
          measureInfo[measureName] = {
            dataType: measure.dataType,
            formatString: measure.formatString,
            aggregation: measure.aggregation
          };
        }
      } else {
        const dimensionMatch = selectItem.match(/\[([^\]]+)\]\.\[([^\]]+)\]/);
        if (dimensionMatch) {
          const dimensionName = dimensionMatch[1];
          const levelName = dimensionMatch[2];
          const fullName = `${dimensionName}_${levelName}`;
          dimensions.push(fullName);
          
          // Extract unique dimension members
          const members = [...new Set(rows.map(row => row[fullName]))].filter(m => m != null);
          dimensionMembers[fullName] = members;
        }
      }
    }

    // Format data as multidimensional array
    const data: any[][] = rows.map(row => {
      const rowData: any[] = [];
      
      // Add dimension values
      for (const dim of dimensions) {
        rowData.push(row[dim]);
      }
      
      // Add measure values
      for (const measure of measures) {
        rowData.push(row[measure]);
      }
      
      return rowData;
    });

    return {
      dimensions,
      measures,
      data,
      metadata: {
        dimensionMembers,
        measureInfo
      }
    };
  }

  async getCubeMetadata(cubeName: string): Promise<CubeDefinition | null> {
    return this.cubes.get(cubeName) || null;
  }

  async getAllCubes(): Promise<CubeDefinition[]> {
    return Array.from(this.cubes.values());
  }

  async getDimensionMembers(cubeName: string, dimensionName: string, hierarchyName?: string): Promise<any[]> {
    const cube = this.cubes.get(cubeName);
    if (!cube) {
      throw new AppError(`Cube ${cubeName} not found`, 404, 'CUBE_NOT_FOUND');
    }

    const dimension = cube.dimensions.find(d => d.name === dimensionName);
    if (!dimension) {
      throw new AppError(`Dimension ${dimensionName} not found in cube ${cubeName}`, 404, 'DIMENSION_NOT_FOUND');
    }

    const hierarchy = hierarchyName ? 
      dimension.hierarchies.find(h => h.name === hierarchyName) : 
      dimension.hierarchies[0];

    if (!hierarchy) {
      throw new AppError(`Hierarchy ${hierarchyName} not found in dimension ${dimensionName}`, 404, 'HIERARCHY_NOT_FOUND');
    }

    try {
      const query = `
        SELECT DISTINCT ${hierarchy.levels.map(l => l.column).join(', ')}
        FROM ${dimension.table}
        WHERE is_current = true
        ORDER BY ${hierarchy.levels.map(l => l.orderBy || l.column).join(', ')}
      `;

      const result = await this.warehousePool.query(query);
      return result.rows;
    } catch (error) {
      logger.error(`Failed to get dimension members for ${dimensionName}:`, error);
      throw new AppError('Failed to get dimension members', 500, 'DIMENSION_MEMBERS_FAILED');
    }
  }

  async executeDrillDown(cubeName: string, baseQuery: string, drillPath: string[]): Promise<CubeData> {
    const cube = this.cubes.get(cubeName);
    if (!cube) {
      throw new AppError(`Cube ${cubeName} not found`, 404, 'CUBE_NOT_FOUND');
    }

    // Modify the base query to include drill-down dimensions
    let modifiedQuery = baseQuery;
    
    for (const drillDimension of drillPath) {
      // Add drill dimension to SELECT and GROUP BY
      // This is a simplified implementation
      modifiedQuery = modifiedQuery.replace(
        'SELECT',
        `SELECT [${drillDimension}],`
      );
    }

    return this.executeMDXQuery(cubeName, modifiedQuery);
  }

  async executeSliceAndDice(
    cubeName: string, 
    dimensions: string[], 
    measures: string[], 
    filters: Record<string, any[]>
  ): Promise<CubeData> {
    const cube = this.cubes.get(cubeName);
    if (!cube) {
      throw new AppError(`Cube ${cubeName} not found`, 404, 'CUBE_NOT_FOUND');
    }

    // Build MDX query for slice and dice operation
    const selectClause = [
      ...dimensions.map(dim => `[${dim}]`),
      ...measures.map(measure => `[Measures].[${measure}]`)
    ].join(', ');

    let mdxQuery = `SELECT ${selectClause} FROM [${cubeName}]`;

    // Add filters
    if (Object.keys(filters).length > 0) {
      const whereConditions = Object.entries(filters).map(([dimension, values]) => {
        const valueList = values.map(v => `[${dimension}].[${v}]`).join(', ');
        return `{${valueList}}`;
      });
      
      mdxQuery += ` WHERE ${whereConditions.join(' * ')}`;
    }

    return this.executeMDXQuery(cubeName, mdxQuery);
  }

  async calculateRankings(
    cubeName: string,
    dimension: string,
    measure: string,
    topN: number = 10
  ): Promise<any[]> {
    const cube = this.cubes.get(cubeName);
    if (!cube) {
      throw new AppError(`Cube ${cubeName} not found`, 404, 'CUBE_NOT_FOUND');
    }

    const mdxQuery = `
      SELECT 
        TopCount([${dimension}].Members, ${topN}, [Measures].[${measure}]) ON ROWS,
        [Measures].[${measure}] ON COLUMNS
      FROM [${cubeName}]
    `;

    const result = await this.executeMDXQuery(cubeName, mdxQuery);
    
    // Convert to ranking format
    return result.data.map((row, index) => ({
      rank: index + 1,
      dimension: row[0],
      value: row[1]
    }));
  }

  async calculateGrowthRates(
    cubeName: string,
    timeDimension: string,
    measure: string,
    periods: number = 12
  ): Promise<any[]> {
    const cube = this.cubes.get(cubeName);
    if (!cube) {
      throw new AppError(`Cube ${cubeName} not found`, 404, 'CUBE_NOT_FOUND');
    }

    const mdxQuery = `
      SELECT 
        [${timeDimension}].Members ON ROWS,
        {[Measures].[${measure}], 
         ([Measures].[${measure}], [${timeDimension}].PrevMember)} ON COLUMNS
      FROM [${cubeName}]
    `;

    const result = await this.executeMDXQuery(cubeName, mdxQuery);
    
    // Calculate growth rates
    return result.data.map(row => {
      const current = parseFloat(row[1]) || 0;
      const previous = parseFloat(row[2]) || 0;
      const growthRate = previous !== 0 ? ((current - previous) / previous) * 100 : 0;
      
      return {
        period: row[0],
        current,
        previous,
        growthRate: Math.round(growthRate * 100) / 100
      };
    });
  }

  async refreshCube(cubeName: string): Promise<void> {
    const cube = this.cubes.get(cubeName);
    if (!cube) {
      throw new AppError(`Cube ${cubeName} not found`, 404, 'CUBE_NOT_FOUND');
    }

    try {
      logger.info(`Starting cube refresh for ${cubeName}`);

      // In a real implementation, this would:
      // 1. Refresh the underlying fact and dimension tables
      // 2. Rebuild aggregations and indexes
      // 3. Update cube metadata
      // 4. Clear related caches

      // For now, we'll just log the refresh
      logger.info(`Cube refresh completed for ${cubeName}`);
    } catch (error) {
      logger.error(`Cube refresh failed for ${cubeName}:`, error);
      throw new AppError('Cube refresh failed', 500, 'CUBE_REFRESH_FAILED');
    }
  }

  async getCubeStatistics(cubeName: string): Promise<any> {
    const cube = this.cubes.get(cubeName);
    if (!cube) {
      throw new AppError(`Cube ${cubeName} not found`, 404, 'CUBE_NOT_FOUND');
    }

    try {
      const stats = await this.warehousePool.query(`
        SELECT 
          COUNT(*) as total_records,
          MIN(created_at) as earliest_date,
          MAX(created_at) as latest_date
        FROM ${cube.factTable}
      `);

      const dimensionStats = await Promise.all(
        cube.dimensions.map(async (dim) => {
          const dimStats = await this.warehousePool.query(`
            SELECT COUNT(DISTINCT ${dim.keyColumn}) as member_count
            FROM ${dim.table}
            WHERE is_current = true
          `);
          
          return {
            dimension: dim.name,
            memberCount: parseInt(dimStats.rows[0].member_count)
          };
        })
      );

      return {
        cubeName,
        factTable: cube.factTable,
        totalRecords: parseInt(stats.rows[0].total_records),
        dateRange: {
          earliest: stats.rows[0].earliest_date,
          latest: stats.rows[0].latest_date
        },
        dimensions: dimensionStats,
        measures: cube.measures.length,
        calculatedMembers: cube.calculatedMembers.length,
        lastRefresh: new Date()
      };
    } catch (error) {
      logger.error(`Failed to get cube statistics for ${cubeName}:`, error);
      throw new AppError('Failed to get cube statistics', 500, 'CUBE_STATS_FAILED');
    }
  }
}