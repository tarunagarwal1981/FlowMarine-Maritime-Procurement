import { PrismaClient, ItemCategory, CriticalityLevel } from '@prisma/client';
import { logger } from '../utils/logger.js';
import { AuditService } from './auditService.js';

const prisma = new PrismaClient();

export interface ItemCatalogCreateData {
  impaCode?: string;
  issaCode?: string;
  name: string;
  description?: string;
  category: ItemCategory;
  criticalityLevel: CriticalityLevel;
  specifications?: Record<string, any>;
  compatibleVesselTypes: string[];
  compatibleEngineTypes: string[];
  unitOfMeasure: string;
  averagePrice?: number;
  averagePriceCurrency?: string;
  leadTime?: number;
}

export interface ItemCatalogUpdateData extends Partial<ItemCatalogCreateData> {
  id: string;
}

export interface ItemCatalogSearchFilters {
  search?: string;
  category?: ItemCategory;
  criticalityLevel?: CriticalityLevel;
  vesselType?: string;
  engineType?: string;
  impaCode?: string;
  issaCode?: string;
  minPrice?: number;
  maxPrice?: number;
  maxLeadTime?: number;
}

export interface VesselCompatibilityCheck {
  vesselType: string;
  engineType: string;
}

class ItemCatalogService {
  /**
   * Create a new item in the catalog
   */
  async createItem(data: ItemCatalogCreateData, userId?: string) {
    try {
      // Validate IMPA/ISSA codes are unique if provided
      if (data.impaCode) {
        const existingImpa = await prisma.itemCatalog.findUnique({
          where: { impaCode: data.impaCode }
        });
        if (existingImpa) {
          throw new Error(`Item with IMPA code ${data.impaCode} already exists`);
        }
      }

      if (data.issaCode) {
        const existingIssa = await prisma.itemCatalog.findUnique({
          where: { issaCode: data.issaCode }
        });
        if (existingIssa) {
          throw new Error(`Item with ISSA code ${data.issaCode} already exists`);
        }
      }

      const item = await prisma.itemCatalog.create({
        data: {
          ...data,
          averagePriceCurrency: data.averagePriceCurrency || 'USD'
        }
      });

      // Audit log
      if (userId) {
        await AuditService.log({
          userId,
          action: 'CREATE',
          resource: 'ItemCatalog',
          resourceId: item.id,
          newValues: item
        });
      }

      logger.info(`Created item catalog entry: ${item.name} (${item.id})`);
      return item;
    } catch (error) {
      logger.error('Error creating item catalog entry:', error);
      throw error;
    }
  }

  /**
   * Update an existing item in the catalog
   */
  async updateItem(data: ItemCatalogUpdateData, userId?: string) {
    try {
      const { id, ...updateData } = data;

      // Get existing item for audit
      const existingItem = await prisma.itemCatalog.findUnique({
        where: { id }
      });

      if (!existingItem) {
        throw new Error(`Item with ID ${id} not found`);
      }

      // Validate IMPA/ISSA codes are unique if being updated
      if (updateData.impaCode && updateData.impaCode !== existingItem.impaCode) {
        const existingImpa = await prisma.itemCatalog.findUnique({
          where: { impaCode: updateData.impaCode }
        });
        if (existingImpa) {
          throw new Error(`Item with IMPA code ${updateData.impaCode} already exists`);
        }
      }

      if (updateData.issaCode && updateData.issaCode !== existingItem.issaCode) {
        const existingIssa = await prisma.itemCatalog.findUnique({
          where: { issaCode: updateData.issaCode }
        });
        if (existingIssa) {
          throw new Error(`Item with ISSA code ${updateData.issaCode} already exists`);
        }
      }

      const updatedItem = await prisma.itemCatalog.update({
        where: { id },
        data: updateData
      });

      // Audit log
      if (userId) {
        await AuditService.log({
          userId,
          action: 'UPDATE',
          resource: 'ItemCatalog',
          resourceId: id,
          oldValues: existingItem,
          newValues: updatedItem
        });
      }

      logger.info(`Updated item catalog entry: ${updatedItem.name} (${id})`);
      return updatedItem;
    } catch (error) {
      logger.error('Error updating item catalog entry:', error);
      throw error;
    }
  }

  /**
   * Get item by ID
   */
  async getItemById(id: string) {
    try {
      const item = await prisma.itemCatalog.findUnique({
        where: { id }
      });

      if (!item) {
        throw new Error(`Item with ID ${id} not found`);
      }

      return item;
    } catch (error) {
      logger.error('Error fetching item by ID:', error);
      throw error;
    }
  }

  /**
   * Get item by IMPA code
   */
  async getItemByImpaCode(impaCode: string) {
    try {
      const item = await prisma.itemCatalog.findUnique({
        where: { impaCode }
      });

      return item;
    } catch (error) {
      logger.error('Error fetching item by IMPA code:', error);
      throw error;
    }
  }

  /**
   * Get item by ISSA code
   */
  async getItemByIssaCode(issaCode: string) {
    try {
      const item = await prisma.itemCatalog.findUnique({
        where: { issaCode }
      });

      return item;
    } catch (error) {
      logger.error('Error fetching item by ISSA code:', error);
      throw error;
    }
  }

  /**
   * Search items with advanced filtering and enhanced search capabilities
   */
  async searchItems(filters: ItemCatalogSearchFilters, page = 1, limit = 50) {
    try {
      const skip = (page - 1) * limit;
      
      // Build where clause
      const where: any = {};

      if (filters.search) {
        // Enhanced search with better relevance scoring and fuzzy matching
        const searchTerms = filters.search.toLowerCase().split(' ').filter(term => term.length > 0);
        
        where.OR = [
          // Exact name match (highest priority)
          { name: { equals: filters.search, mode: 'insensitive' } },
          // Name starts with search term
          { name: { startsWith: filters.search, mode: 'insensitive' } },
          // Name contains search term
          { name: { contains: filters.search, mode: 'insensitive' } },
          // Description contains search term
          { description: { contains: filters.search, mode: 'insensitive' } },
          // IMPA code exact match
          { impaCode: { equals: filters.search, mode: 'insensitive' } },
          // IMPA code starts with
          { impaCode: { startsWith: filters.search, mode: 'insensitive' } },
          // IMPA code contains (for partial matches)
          { impaCode: { contains: filters.search, mode: 'insensitive' } },
          // ISSA code exact match
          { issaCode: { equals: filters.search, mode: 'insensitive' } },
          // ISSA code starts with
          { issaCode: { startsWith: filters.search, mode: 'insensitive' } },
          // ISSA code contains (for partial matches)
          { issaCode: { contains: filters.search, mode: 'insensitive' } },
          // Search in specifications JSON (manufacturer, part numbers, etc.)
          {
            specifications: {
              path: [],
              string_contains: filters.search
            }
          }
        ];

        // Add multi-term search for better results
        if (searchTerms.length > 1) {
          where.OR.push({
            AND: searchTerms.map(term => ({
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { description: { contains: term, mode: 'insensitive' } },
                { impaCode: { contains: term, mode: 'insensitive' } },
                { issaCode: { contains: term, mode: 'insensitive' } }
              ]
            }))
          });
        }

        // Add fuzzy search for common typos and variations
        const fuzzyVariations = this.generateFuzzyVariations(filters.search);
        fuzzyVariations.forEach(variation => {
          where.OR.push(
            { name: { contains: variation, mode: 'insensitive' } },
            { description: { contains: variation, mode: 'insensitive' } }
          );
        });
      }

      if (filters.category) {
        where.category = filters.category;
      }

      if (filters.criticalityLevel) {
        where.criticalityLevel = filters.criticalityLevel;
      }

      if (filters.vesselType) {
        where.compatibleVesselTypes = {
          has: filters.vesselType
        };
      }

      if (filters.engineType) {
        where.compatibleEngineTypes = {
          has: filters.engineType
        };
      }

      if (filters.impaCode) {
        where.impaCode = { contains: filters.impaCode, mode: 'insensitive' };
      }

      if (filters.issaCode) {
        where.issaCode = { contains: filters.issaCode, mode: 'insensitive' };
      }

      if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
        where.averagePrice = {};
        if (filters.minPrice !== undefined) {
          where.averagePrice.gte = filters.minPrice;
        }
        if (filters.maxPrice !== undefined) {
          where.averagePrice.lte = filters.maxPrice;
        }
      }

      if (filters.maxLeadTime !== undefined) {
        where.leadTime = {
          lte: filters.maxLeadTime
        };
      }

      // Enhanced ordering for better search results
      const orderBy: any[] = [];
      
      if (filters.search) {
        // When searching, prioritize by relevance and criticality
        orderBy.push(
          { criticalityLevel: 'asc' }, // Safety critical first
          { averagePrice: 'asc' } // Then by price for cost optimization
        );
      } else {
        // Default ordering
        orderBy.push(
          { criticalityLevel: 'asc' },
          { category: 'asc' },
          { name: 'asc' }
        );
      }

      const [items, total] = await Promise.all([
        prisma.itemCatalog.findMany({
          where,
          skip,
          take: limit,
          orderBy
        }),
        prisma.itemCatalog.count({ where })
      ]);

      return {
        items,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      logger.error('Error searching items:', error);
      throw error;
    }
  }

  /**
   * Check vessel compatibility for items
   */
  async checkVesselCompatibility(itemIds: string[], vesselCompatibility: VesselCompatibilityCheck) {
    try {
      const items = await prisma.itemCatalog.findMany({
        where: {
          id: { in: itemIds }
        },
        select: {
          id: true,
          name: true,
          compatibleVesselTypes: true,
          compatibleEngineTypes: true,
          criticalityLevel: true
        }
      });

      const compatibilityResults = items.map(item => {
        const vesselTypeCompatible = item.compatibleVesselTypes.length === 0 || 
          item.compatibleVesselTypes.includes(vesselCompatibility.vesselType);
        
        const engineTypeCompatible = item.compatibleEngineTypes.length === 0 || 
          item.compatibleEngineTypes.includes(vesselCompatibility.engineType);

        return {
          itemId: item.id,
          itemName: item.name,
          criticalityLevel: item.criticalityLevel,
          compatible: vesselTypeCompatible && engineTypeCompatible,
          vesselTypeCompatible,
          engineTypeCompatible,
          warnings: []
        };
      });

      return compatibilityResults;
    } catch (error) {
      logger.error('Error checking vessel compatibility:', error);
      throw error;
    }
  }

  /**
   * Get items by category with criticality grouping
   */
  async getItemsByCategory(category: ItemCategory, vesselType?: string, engineType?: string) {
    try {
      const where: any = { category };

      if (vesselType) {
        where.compatibleVesselTypes = { has: vesselType };
      }

      if (engineType) {
        where.compatibleEngineTypes = { has: engineType };
      }

      const items = await prisma.itemCatalog.findMany({
        where,
        orderBy: [
          { criticalityLevel: 'asc' },
          { name: 'asc' }
        ]
      });

      // Group by criticality level
      const grouped = {
        SAFETY_CRITICAL: items.filter(item => item.criticalityLevel === 'SAFETY_CRITICAL'),
        OPERATIONAL_CRITICAL: items.filter(item => item.criticalityLevel === 'OPERATIONAL_CRITICAL'),
        ROUTINE: items.filter(item => item.criticalityLevel === 'ROUTINE')
      };

      return grouped;
    } catch (error) {
      logger.error('Error fetching items by category:', error);
      throw error;
    }
  }

  /**
   * Update average pricing and lead time
   */
  async updateAveragePricing(itemId: string, price: number, currency: string, leadTime?: number) {
    try {
      const updateData: any = {
        averagePrice: price,
        averagePriceCurrency: currency
      };

      if (leadTime !== undefined) {
        updateData.leadTime = leadTime;
      }

      const updatedItem = await prisma.itemCatalog.update({
        where: { id: itemId },
        data: updateData
      });

      logger.info(`Updated pricing for item ${itemId}: ${price} ${currency}`);
      return updatedItem;
    } catch (error) {
      logger.error('Error updating average pricing:', error);
      throw error;
    }
  }

  /**
   * Get maritime categories with item counts
   */
  async getMaritimeCategoriesWithCounts(vesselType?: string, engineType?: string) {
    try {
      const where: any = {};

      if (vesselType) {
        where.compatibleVesselTypes = { has: vesselType };
      }

      if (engineType) {
        where.compatibleEngineTypes = { has: engineType };
      }

      const categoryCounts = await prisma.itemCatalog.groupBy({
        by: ['category'],
        where,
        _count: {
          id: true
        },
        orderBy: {
          category: 'asc'
        }
      });

      return categoryCounts.map(item => ({
        category: item.category,
        count: item._count.id
      }));
    } catch (error) {
      logger.error('Error fetching category counts:', error);
      throw error;
    }
  }

  /**
   * Get advanced autocomplete suggestions with enhanced search and caching
   */
  async getAdvancedAutocompleteSuggestions(query: string, options: {
    field?: 'name' | 'impaCode' | 'issaCode' | 'all';
    category?: ItemCategory;
    criticalityLevel?: CriticalityLevel;
    vesselType?: string;
    engineType?: string;
    limit?: number;
  } = {}) {
    try {
      const { field = 'all', limit = 10, category, criticalityLevel, vesselType, engineType } = options;
      
      if (!query || query.length < 2) {
        return [];
      }

      const where: any = {};

      // Apply filters
      if (category) where.category = category;
      if (criticalityLevel) where.criticalityLevel = criticalityLevel;
      if (vesselType) where.compatibleVesselTypes = { has: vesselType };
      if (engineType) where.compatibleEngineTypes = { has: engineType };

      // Enhanced search conditions with fuzzy matching
      const searchConditions: any[] = [];
      const queryLower = query.toLowerCase();
      
      if (field === 'name' || field === 'all') {
        searchConditions.push(
          // Exact match (highest priority)
          { name: { equals: query, mode: 'insensitive' } },
          // Starts with (high priority)
          { name: { startsWith: query, mode: 'insensitive' } },
          // Contains (medium priority)
          { name: { contains: query, mode: 'insensitive' } }
        );
      }

      if (field === 'impaCode' || field === 'all') {
        searchConditions.push(
          { impaCode: { equals: query, mode: 'insensitive' } },
          { impaCode: { startsWith: query, mode: 'insensitive' } },
          { impaCode: { contains: query, mode: 'insensitive' } }
        );
      }

      if (field === 'issaCode' || field === 'all') {
        searchConditions.push(
          { issaCode: { equals: query, mode: 'insensitive' } },
          { issaCode: { startsWith: query, mode: 'insensitive' } },
          { issaCode: { contains: query, mode: 'insensitive' } }
        );
      }

      // Add fuzzy variations for better matching
      const fuzzyVariations = this.generateFuzzyVariations(query);
      fuzzyVariations.forEach(variation => {
        if (field === 'name' || field === 'all') {
          searchConditions.push(
            { name: { contains: variation, mode: 'insensitive' } }
          );
        }
      });

      // Add search in specifications for technical terms
      if (field === 'all') {
        searchConditions.push({
          specifications: {
            path: [],
            string_contains: query
          }
        });
      }

      where.OR = searchConditions;

      const items = await prisma.itemCatalog.findMany({
        where,
        select: {
          id: true,
          name: true,
          impaCode: true,
          issaCode: true,
          category: true,
          criticalityLevel: true,
          averagePrice: true,
          averagePriceCurrency: true,
          leadTime: true,
          unitOfMeasure: true,
          description: true,
          specifications: true
        },
        orderBy: [
          { criticalityLevel: 'asc' },
          { name: 'asc' }
        ],
        take: Math.min(limit * 2, 100) // Get more items for better scoring
      });

      // Enhanced relevance scoring with multiple factors
      const suggestions = items.map(item => {
        let relevanceScore = 0;
        let matchedField = '';
        let matchedValue = '';
        const queryLower = query.toLowerCase();

        // Name matching with position-based scoring
        if (item.name?.toLowerCase() === queryLower) {
          relevanceScore += 1000; // Exact match
          matchedField = 'name';
          matchedValue = item.name;
        } else if (item.name?.toLowerCase().startsWith(queryLower)) {
          relevanceScore += 500; // Starts with
          matchedField = 'name';
          matchedValue = item.name;
        } else if (item.name?.toLowerCase().includes(queryLower)) {
          const position = item.name.toLowerCase().indexOf(queryLower);
          relevanceScore += Math.max(100 - position, 50); // Earlier position = higher score
          matchedField = 'name';
          matchedValue = item.name;
        }

        // IMPA code matching
        if (item.impaCode?.toLowerCase() === queryLower) {
          relevanceScore += 900;
          matchedField = 'impaCode';
          matchedValue = item.impaCode;
        } else if (item.impaCode?.toLowerCase().startsWith(queryLower)) {
          relevanceScore += 450;
          matchedField = 'impaCode';
          matchedValue = item.impaCode;
        } else if (item.impaCode?.toLowerCase().includes(queryLower)) {
          relevanceScore += 200;
          matchedField = 'impaCode';
          matchedValue = item.impaCode;
        }

        // ISSA code matching
        if (item.issaCode?.toLowerCase() === queryLower) {
          relevanceScore += 900;
          matchedField = 'issaCode';
          matchedValue = item.issaCode;
        } else if (item.issaCode?.toLowerCase().startsWith(queryLower)) {
          relevanceScore += 450;
          matchedField = 'issaCode';
          matchedValue = item.issaCode;
        } else if (item.issaCode?.toLowerCase().includes(queryLower)) {
          relevanceScore += 200;
          matchedField = 'issaCode';
          matchedValue = item.issaCode;
        }

        // Description matching
        if (item.description?.toLowerCase().includes(queryLower)) {
          relevanceScore += 75;
          if (!matchedField) {
            matchedField = 'description';
            matchedValue = item.description;
          }
        }

        // Specifications matching
        if (item.specifications && typeof item.specifications === 'object') {
          const specsString = JSON.stringify(item.specifications).toLowerCase();
          if (specsString.includes(queryLower)) {
            relevanceScore += 50;
            if (!matchedField) {
              matchedField = 'specifications';
              matchedValue = 'Technical specifications';
            }
          }
        }

        // Criticality boost (safety items prioritized)
        if (item.criticalityLevel === 'SAFETY_CRITICAL') {
          relevanceScore += 100;
        } else if (item.criticalityLevel === 'OPERATIONAL_CRITICAL') {
          relevanceScore += 50;
        }

        // Availability boost (items with pricing and lead time)
        if (item.averagePrice && item.leadTime) {
          relevanceScore += 25;
        }

        // Fuzzy matching bonus
        const fuzzyVariations = this.generateFuzzyVariations(query);
        fuzzyVariations.forEach(variation => {
          if (item.name?.toLowerCase().includes(variation.toLowerCase())) {
            relevanceScore += 30;
          }
        });

        return {
          id: item.id,
          name: item.name,
          impaCode: item.impaCode,
          issaCode: item.issaCode,
          category: item.category,
          criticalityLevel: item.criticalityLevel,
          averagePrice: item.averagePrice,
          averagePriceCurrency: item.averagePriceCurrency,
          leadTime: item.leadTime,
          unitOfMeasure: item.unitOfMeasure,
          matchedField,
          matchedValue: matchedValue || item.name,
          relevanceScore
        };
      });

      // Sort by relevance score and return top results
      return suggestions
        .filter(s => s.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
    } catch (error) {
      logger.error('Error getting advanced autocomplete suggestions:', error);
      throw error;
    }
  }

  /**
   * Update item specifications with technical documentation
   */
  async updateItemSpecifications(itemId: string, specifications: Record<string, any>, userId?: string) {
    try {
      const existingItem = await prisma.itemCatalog.findUnique({
        where: { id: itemId }
      });

      if (!existingItem) {
        throw new Error(`Item with ID ${itemId} not found`);
      }

      // Merge with existing specifications
      const updatedSpecifications = {
        ...existingItem.specifications as Record<string, any> || {},
        ...specifications,
        lastUpdated: new Date().toISOString(),
        updatedBy: userId
      };

      const updatedItem = await prisma.itemCatalog.update({
        where: { id: itemId },
        data: {
          specifications: updatedSpecifications
        }
      });

      // Audit log
      if (userId) {
        await AuditService.log({
          userId,
          action: 'UPDATE',
          resource: 'ItemCatalog',
          resourceId: itemId,
          oldValues: { specifications: existingItem.specifications },
          newValues: { specifications: updatedSpecifications }
        });
      }

      logger.info(`Updated specifications for item ${itemId}`);
      return updatedItem;
    } catch (error) {
      logger.error('Error updating item specifications:', error);
      throw error;
    }
  }

  /**
   * Get items with pricing and lead time analytics
   */
  async getItemsWithPricingAnalytics(filters: ItemCatalogSearchFilters & {
    includePricingTrends?: boolean;
    includeLeadTimeTrends?: boolean;
  }) {
    try {
      const { includePricingTrends = false, includeLeadTimeTrends = false, ...searchFilters } = filters;
      
      const result = await this.searchItems(searchFilters, 1, 100);
      
      if (!includePricingTrends && !includeLeadTimeTrends) {
        return result;
      }

      // Enhance items with analytics data
      const enhancedItems = await Promise.all(
        result.items.map(async (item) => {
          const analytics: any = {};

          if (includePricingTrends && item.averagePrice) {
            // Get pricing trends from quote line items
            const pricingData = await prisma.quoteLineItem.findMany({
              where: { itemCatalogId: item.id },
              select: {
                unitPrice: true,
                currency: true,
                createdAt: true
              },
              orderBy: { createdAt: 'desc' },
              take: 10
            });

            if (pricingData.length > 0) {
              const prices = pricingData.map(p => p.unitPrice);
              analytics.pricingTrends = {
                recentPrices: prices,
                averageRecentPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
                priceVariation: Math.max(...prices) - Math.min(...prices),
                dataPoints: pricingData.length
              };
            }
          }

          if (includeLeadTimeTrends && item.leadTime) {
            // Calculate lead time reliability from delivery data
            const deliveryData = await prisma.$queryRaw`
              SELECT AVG(EXTRACT(DAY FROM (d.actual_date - d.scheduled_date))) as avg_delay
              FROM deliveries d
              JOIN purchase_orders po ON d.purchase_order_id = po.id
              JOIN quotes q ON po.quote_id = q.id
              JOIN quote_line_items qli ON q.id = qli.quote_id
              WHERE qli.item_catalog_id = ${item.id}
              AND d.actual_date IS NOT NULL
              AND d.scheduled_date IS NOT NULL
            `;

            analytics.leadTimeTrends = {
              estimatedLeadTime: item.leadTime,
              averageDelay: deliveryData[0]?.avg_delay || 0,
              reliability: item.leadTime && deliveryData[0]?.avg_delay 
                ? Math.max(0, 100 - (deliveryData[0].avg_delay / item.leadTime * 100))
                : null
            };
          }

          return {
            ...item,
            analytics
          };
        })
      );

      return {
        ...result,
        items: enhancedItems
      };
    } catch (error) {
      logger.error('Error getting items with pricing analytics:', error);
      throw error;
    }
  }

  /**
   * Bulk update average pricing from recent quotes
   */
  async bulkUpdatePricingFromQuotes(itemIds?: string[], userId?: string) {
    try {
      const whereClause = itemIds ? { id: { in: itemIds } } : {};
      
      const items = await prisma.itemCatalog.findMany({
        where: whereClause,
        select: { id: true, name: true }
      });

      const updateResults = [];

      for (const item of items) {
        // Get recent quote data for this item
        const recentQuotes = await prisma.quoteLineItem.findMany({
          where: {
            itemCatalogId: item.id,
            createdAt: {
              gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
            }
          },
          select: {
            unitPrice: true,
            currency: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' },
          take: 20
        });

        if (recentQuotes.length >= 3) { // Need at least 3 data points
          // Calculate weighted average (more recent quotes have higher weight)
          let totalWeightedPrice = 0;
          let totalWeight = 0;
          
          recentQuotes.forEach((quote, index) => {
            const weight = recentQuotes.length - index; // More recent = higher weight
            totalWeightedPrice += quote.unitPrice * weight;
            totalWeight += weight;
          });

          const newAveragePrice = totalWeightedPrice / totalWeight;
          const currency = recentQuotes[0].currency; // Use most recent currency

          // Update the item
          await prisma.itemCatalog.update({
            where: { id: item.id },
            data: {
              averagePrice: newAveragePrice,
              averagePriceCurrency: currency
            }
          });

          updateResults.push({
            itemId: item.id,
            itemName: item.name,
            newAveragePrice,
            currency,
            dataPoints: recentQuotes.length
          });

          // Audit log
          if (userId) {
            await AuditService.log({
              userId,
              action: 'UPDATE',
              resource: 'ItemCatalog',
              resourceId: item.id,
              newValues: { 
                averagePrice: newAveragePrice, 
                averagePriceCurrency: currency,
                source: 'bulk_update_from_quotes'
              }
            });
          }
        }
      }

      logger.info(`Bulk updated pricing for ${updateResults.length} items`);
      return updateResults;
    } catch (error) {
      logger.error('Error bulk updating pricing from quotes:', error);
      throw error;
    }
  }

  /**
   * Get specification templates for different item categories
   */
  async getSpecificationTemplates(category?: ItemCategory) {
    try {
      const templates: Record<string, any> = {
        ENGINE_PARTS: {
          dimensions: { length: '', width: '', height: '', unit: 'mm' },
          weight: { value: '', unit: 'kg' },
          material: '',
          manufacturer: '',
          partNumber: '',
          compatibility: { engines: [], models: [] },
          certifications: [],
          operatingConditions: {
            temperature: { min: '', max: '', unit: 'C' },
            pressure: { max: '', unit: 'bar' }
          }
        },
        SAFETY_GEAR: {
          certifications: { required: ['SOLAS', 'MED'], obtained: [] },
          expiryDate: '',
          inspectionInterval: { value: '', unit: 'months' },
          capacity: { persons: '', weight: '' },
          dimensions: { length: '', width: '', height: '', unit: 'mm' },
          material: '',
          manufacturer: '',
          approvalNumber: ''
        },
        DECK_EQUIPMENT: {
          workingLoad: { value: '', unit: 'tonnes' },
          breakingLoad: { value: '', unit: 'tonnes' },
          dimensions: { length: '', width: '', height: '', unit: 'mm' },
          weight: { value: '', unit: 'kg' },
          material: '',
          coating: '',
          manufacturer: '',
          certifications: []
        },
        NAVIGATION: {
          powerRequirements: { voltage: '', current: '', frequency: '' },
          operatingConditions: {
            temperature: { min: '', max: '', unit: 'C' },
            humidity: { max: '', unit: '%' }
          },
          accuracy: '',
          range: '',
          interfaces: [],
          certifications: ['IMO', 'IEC'],
          manufacturer: '',
          modelNumber: ''
        },
        ELECTRICAL: {
          voltage: { rated: '', range: '', unit: 'V' },
          current: { rated: '', max: '', unit: 'A' },
          power: { rated: '', max: '', unit: 'W' },
          frequency: { value: '', unit: 'Hz' },
          protection: { ip_rating: '', class: '' },
          certifications: ['IEC', 'DNV'],
          manufacturer: '',
          partNumber: ''
        }
      };

      if (category) {
        return templates[category] || {};
      }

      return templates;
    } catch (error) {
      logger.error('Error getting specification templates:', error);
      throw error;
    }
  }

  /**
   * Get search analytics and insights
   */
  async getSearchAnalytics(filters: ItemCatalogSearchFilters = {}) {
    try {
      const where: any = {};
      
      // Apply basic filters
      if (filters.category) where.category = filters.category;
      if (filters.criticalityLevel) where.criticalityLevel = filters.criticalityLevel;
      if (filters.vesselType) where.compatibleVesselTypes = { has: filters.vesselType };
      if (filters.engineType) where.compatibleEngineTypes = { has: filters.engineType };

      // Get comprehensive analytics
      const [
        totalItems,
        categoryBreakdown,
        criticalityBreakdown,
        pricingStats,
        leadTimeStats,
        topCategories,
        recentlyUpdated
      ] = await Promise.all([
        // Total items count
        prisma.itemCatalog.count({ where }),
        
        // Category breakdown
        prisma.itemCatalog.groupBy({
          by: ['category'],
          where,
          _count: { id: true },
          _avg: { averagePrice: true, leadTime: true },
          orderBy: { _count: { id: 'desc' } }
        }),
        
        // Criticality breakdown
        prisma.itemCatalog.groupBy({
          by: ['criticalityLevel'],
          where,
          _count: { id: true },
          _avg: { averagePrice: true, leadTime: true }
        }),
        
        // Pricing statistics
        prisma.itemCatalog.aggregate({
          where: { ...where, averagePrice: { not: null } },
          _count: { averagePrice: true },
          _avg: { averagePrice: true },
          _min: { averagePrice: true },
          _max: { averagePrice: true }
        }),
        
        // Lead time statistics
        prisma.itemCatalog.aggregate({
          where: { ...where, leadTime: { not: null } },
          _count: { leadTime: true },
          _avg: { leadTime: true },
          _min: { leadTime: true },
          _max: { leadTime: true }
        }),
        
        // Top categories by item count
        prisma.itemCatalog.groupBy({
          by: ['category'],
          where,
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 5
        }),
        
        // Recently updated items
        prisma.itemCatalog.findMany({
          where,
          select: {
            id: true,
            name: true,
            category: true,
            averagePrice: true,
            updatedAt: true
          },
          orderBy: { updatedAt: 'desc' },
          take: 10
        })
      ]);

      // Calculate data completeness metrics
      const itemsWithPricing = await prisma.itemCatalog.count({
        where: { ...where, averagePrice: { not: null } }
      });
      
      const itemsWithLeadTime = await prisma.itemCatalog.count({
        where: { ...where, leadTime: { not: null } }
      });
      
      const itemsWithSpecifications = await prisma.itemCatalog.count({
        where: { ...where, specifications: { not: null } }
      });

      const itemsWithIMPA = await prisma.itemCatalog.count({
        where: { ...where, impaCode: { not: null } }
      });

      const itemsWithISSA = await prisma.itemCatalog.count({
        where: { ...where, issaCode: { not: null } }
      });

      return {
        overview: {
          totalItems,
          dataCompleteness: {
            pricing: totalItems > 0 ? (itemsWithPricing / totalItems) * 100 : 0,
            leadTime: totalItems > 0 ? (itemsWithLeadTime / totalItems) * 100 : 0,
            specifications: totalItems > 0 ? (itemsWithSpecifications / totalItems) * 100 : 0,
            impaCode: totalItems > 0 ? (itemsWithIMPA / totalItems) * 100 : 0,
            issaCode: totalItems > 0 ? (itemsWithISSA / totalItems) * 100 : 0
          }
        },
        categoryBreakdown: categoryBreakdown.map(item => ({
          category: item.category,
          count: item._count.id,
          averagePrice: item._avg.averagePrice,
          averageLeadTime: item._avg.leadTime
        })),
        criticalityBreakdown: criticalityBreakdown.map(item => ({
          level: item.criticalityLevel,
          count: item._count.id,
          averagePrice: item._avg.averagePrice,
          averageLeadTime: item._avg.leadTime
        })),
        pricingStats: {
          totalWithPricing: pricingStats._count.averagePrice,
          averagePrice: pricingStats._avg.averagePrice,
          minPrice: pricingStats._min.averagePrice,
          maxPrice: pricingStats._max.averagePrice
        },
        leadTimeStats: {
          totalWithLeadTime: leadTimeStats._count.leadTime,
          averageLeadTime: leadTimeStats._avg.leadTime,
          minLeadTime: leadTimeStats._min.leadTime,
          maxLeadTime: leadTimeStats._max.leadTime
        },
        topCategories: topCategories.map(item => ({
          category: item.category,
          count: item._count.id
        })),
        recentlyUpdated
      };
    } catch (error) {
      logger.error('Error getting search analytics:', error);
      throw error;
    }
  }

  /**
   * Generate fuzzy search variations for better search results
   */
  private generateFuzzyVariations(searchTerm: string): string[] {
    const variations: string[] = [];
    const term = searchTerm.toLowerCase();
    
    // Common maritime terminology variations
    const maritimeVariations: Record<string, string[]> = {
      'engine': ['motor', 'powerplant'],
      'motor': ['engine', 'powerplant'],
      'pump': ['pumping', 'pumps'],
      'valve': ['valves', 'valving'],
      'filter': ['filters', 'filtration'],
      'bearing': ['bearings'],
      'gasket': ['gaskets', 'sealing'],
      'seal': ['seals', 'sealing', 'gasket'],
      'bolt': ['bolts', 'fastener', 'screw'],
      'screw': ['screws', 'bolt', 'fastener'],
      'pipe': ['pipes', 'piping', 'tube'],
      'tube': ['tubes', 'pipe', 'piping'],
      'hose': ['hoses', 'tubing'],
      'cable': ['cables', 'wire', 'wiring'],
      'wire': ['wires', 'cable', 'wiring']
    };

    // Add direct variations
    if (maritimeVariations[term]) {
      variations.push(...maritimeVariations[term]);
    }

    // Add plural/singular variations
    if (term.endsWith('s') && term.length > 3) {
      variations.push(term.slice(0, -1)); // Remove 's'
    } else if (!term.endsWith('s')) {
      variations.push(term + 's'); // Add 's'
    }

    // Add common abbreviations
    const abbreviations: Record<string, string[]> = {
      'stainless steel': ['ss', 'stainless'],
      'marine diesel': ['md', 'diesel'],
      'high pressure': ['hp', 'high-pressure'],
      'low pressure': ['lp', 'low-pressure'],
      'temperature': ['temp'],
      'pressure': ['press'],
      'diameter': ['dia', 'diam'],
      'length': ['len'],
      'width': ['w'],
      'height': ['h', 'ht']
    };

    Object.entries(abbreviations).forEach(([full, abbrevs]) => {
      if (term.includes(full)) {
        abbrevs.forEach(abbrev => {
          variations.push(term.replace(full, abbrev));
        });
      }
      abbrevs.forEach(abbrev => {
        if (term.includes(abbrev)) {
          variations.push(term.replace(abbrev, full));
        }
      });
    });

    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Delete item from catalog
   */
  async deleteItem(id: string, userId?: string) {
    try {
      // Check if item is used in any requisitions
      const requisitionCount = await prisma.requisitionItem.count({
        where: { itemCatalogId: id }
      });

      if (requisitionCount > 0) {
        throw new Error(`Cannot delete item: it is referenced in ${requisitionCount} requisition(s)`);
      }

      // Get existing item for audit
      const existingItem = await prisma.itemCatalog.findUnique({
        where: { id }
      });

      if (!existingItem) {
        throw new Error(`Item with ID ${id} not found`);
      }

      await prisma.itemCatalog.delete({
        where: { id }
      });

      // Audit log
      if (userId) {
        await AuditService.log({
          userId,
          action: 'DELETE',
          resource: 'ItemCatalog',
          resourceId: id,
          oldValues: existingItem
        });
      }

      logger.info(`Deleted item catalog entry: ${existingItem.name} (${id})`);
      return { success: true };
    } catch (error) {
      logger.error('Error deleting item catalog entry:', error);
      throw error;
    }
  }
}

export const itemCatalogService = new ItemCatalogService();