import { Request, Response, NextFunction } from 'express';
import { itemCatalogService, ItemCatalogCreateData, ItemCatalogUpdateData, ItemCatalogSearchFilters } from '../services/itemCatalogService.js';
import { ItemCategory, CriticalityLevel } from '@prisma/client';
import { logger } from '../utils/logger.js';

export class ItemCatalogController {
  /**
   * Create a new item in the catalog
   */
  async createItem(req: Request, res: Response, next: NextFunction) {
    try {
      const data: ItemCatalogCreateData = req.body;
      
      // Validate required fields
      if (!data.name || !data.category || !data.criticalityLevel || !data.unitOfMeasure) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, category, criticalityLevel, unitOfMeasure'
        });
      }

      // Validate arrays
      if (!Array.isArray(data.compatibleVesselTypes)) {
        data.compatibleVesselTypes = [];
      }
      if (!Array.isArray(data.compatibleEngineTypes)) {
        data.compatibleEngineTypes = [];
      }

      const item = await itemCatalogService.createItem(data, req.user?.id);

      res.status(201).json({
        success: true,
        data: item
      });
    } catch (error) {
      logger.error('Error in createItem controller:', error);
      next(error);
    }
  }

  /**
   * Update an existing item
   */
  async updateItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const updateData: ItemCatalogUpdateData = { ...req.body, id };

      const item = await itemCatalogService.updateItem(updateData, req.user?.id);

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      logger.error('Error in updateItem controller:', error);
      next(error);
    }
  }

  /**
   * Get item by ID
   */
  async getItemById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const item = await itemCatalogService.getItemById(id);

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      logger.error('Error in getItemById controller:', error);
      next(error);
    }
  }

  /**
   * Get item by IMPA code
   */
  async getItemByImpaCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { impaCode } = req.params;
      const item = await itemCatalogService.getItemByImpaCode(impaCode);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: `Item with IMPA code ${impaCode} not found`
        });
      }

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      logger.error('Error in getItemByImpaCode controller:', error);
      next(error);
    }
  }

  /**
   * Get item by ISSA code
   */
  async getItemByIssaCode(req: Request, res: Response, next: NextFunction) {
    try {
      const { issaCode } = req.params;
      const item = await itemCatalogService.getItemByIssaCode(issaCode);

      if (!item) {
        return res.status(404).json({
          success: false,
          error: `Item with ISSA code ${issaCode} not found`
        });
      }

      res.json({
        success: true,
        data: item
      });
    } catch (error) {
      logger.error('Error in getItemByIssaCode controller:', error);
      next(error);
    }
  }

  /**
   * Search items with advanced filtering
   */
  async searchItems(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: ItemCatalogSearchFilters = {
        search: req.query.search as string,
        category: req.query.category as ItemCategory,
        criticalityLevel: req.query.criticalityLevel as CriticalityLevel,
        vesselType: req.query.vesselType as string,
        engineType: req.query.engineType as string,
        impaCode: req.query.impaCode as string,
        issaCode: req.query.issaCode as string,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        maxLeadTime: req.query.maxLeadTime ? parseInt(req.query.maxLeadTime as string) : undefined
      };

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100); // Max 100 items per page

      const result = await itemCatalogService.searchItems(filters, page, limit);

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error in searchItems controller:', error);
      next(error);
    }
  }

  /**
   * Check vessel compatibility for items
   */
  async checkVesselCompatibility(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemIds, vesselType, engineType } = req.body;

      if (!Array.isArray(itemIds) || !vesselType || !engineType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: itemIds (array), vesselType, engineType'
        });
      }

      const compatibilityResults = await itemCatalogService.checkVesselCompatibility(
        itemIds,
        { vesselType, engineType }
      );

      res.json({
        success: true,
        data: compatibilityResults
      });
    } catch (error) {
      logger.error('Error in checkVesselCompatibility controller:', error);
      next(error);
    }
  }

  /**
   * Get items by category with criticality grouping
   */
  async getItemsByCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const { category } = req.params;
      const vesselType = req.query.vesselType as string;
      const engineType = req.query.engineType as string;

      // Validate category
      if (!Object.values(ItemCategory).includes(category as ItemCategory)) {
        return res.status(400).json({
          success: false,
          error: `Invalid category. Must be one of: ${Object.values(ItemCategory).join(', ')}`
        });
      }

      const groupedItems = await itemCatalogService.getItemsByCategory(
        category as ItemCategory,
        vesselType,
        engineType
      );

      res.json({
        success: true,
        data: groupedItems
      });
    } catch (error) {
      logger.error('Error in getItemsByCategory controller:', error);
      next(error);
    }
  }

  /**
   * Update average pricing and lead time
   */
  async updateAveragePricing(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { price, currency, leadTime } = req.body;

      if (!price || !currency) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: price, currency'
        });
      }

      if (price <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Price must be greater than 0'
        });
      }

      const updatedItem = await itemCatalogService.updateAveragePricing(
        id,
        price,
        currency,
        leadTime
      );

      res.json({
        success: true,
        data: updatedItem
      });
    } catch (error) {
      logger.error('Error in updateAveragePricing controller:', error);
      next(error);
    }
  }

  /**
   * Get maritime categories with item counts
   */
  async getMaritimeCategoriesWithCounts(req: Request, res: Response, next: NextFunction) {
    try {
      const vesselType = req.query.vesselType as string;
      const engineType = req.query.engineType as string;

      const categoryCounts = await itemCatalogService.getMaritimeCategoriesWithCounts(
        vesselType,
        engineType
      );

      res.json({
        success: true,
        data: categoryCounts
      });
    } catch (error) {
      logger.error('Error in getMaritimeCategoriesWithCounts controller:', error);
      next(error);
    }
  }

  /**
   * Get autocomplete suggestions
   */
  async getAutocompleteSuggestions(req: Request, res: Response, next: NextFunction) {
    try {
      const { query, field = 'name', limit = 10 } = req.query;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Query parameter is required'
        });
      }

      const validFields = ['name', 'impaCode', 'issaCode'];
      if (!validFields.includes(field as string)) {
        return res.status(400).json({
          success: false,
          error: `Invalid field. Must be one of: ${validFields.join(', ')}`
        });
      }

      // Use search functionality with specific field focus
      const filters: ItemCatalogSearchFilters = {};
      if (field === 'name') {
        filters.search = query as string;
      } else if (field === 'impaCode') {
        filters.impaCode = query as string;
      } else if (field === 'issaCode') {
        filters.issaCode = query as string;
      }

      const result = await itemCatalogService.searchItems(
        filters,
        1,
        Math.min(parseInt(limit as string) || 10, 20)
      );

      // Extract relevant field values for autocomplete
      const suggestions = result.items.map(item => {
        if (field === 'name') {
          return { value: item.name, id: item.id, category: item.category };
        } else if (field === 'impaCode') {
          return { value: item.impaCode, id: item.id, name: item.name };
        } else if (field === 'issaCode') {
          return { value: item.issaCode, id: item.id, name: item.name };
        }
      }).filter(item => item.value); // Remove null/undefined values

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      logger.error('Error in getAutocompleteSuggestions controller:', error);
      next(error);
    }
  }

  /**
   * Get advanced autocomplete suggestions with enhanced filtering
   */
  async getAdvancedAutocompleteSuggestions(req: Request, res: Response, next: NextFunction) {
    try {
      const { 
        query, 
        field = 'all', 
        category, 
        criticalityLevel, 
        vesselType, 
        engineType, 
        limit = 10 
      } = req.query;

      if (!query || typeof query !== 'string' || query.length < 2) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter is required and must be at least 2 characters'
        });
      }

      const validFields = ['name', 'impaCode', 'issaCode', 'all'];
      if (!validFields.includes(field as string)) {
        return res.status(400).json({
          success: false,
          error: `Invalid field. Must be one of: ${validFields.join(', ')}`
        });
      }

      const options = {
        field: field as 'name' | 'impaCode' | 'issaCode' | 'all',
        category: category as ItemCategory,
        criticalityLevel: criticalityLevel as CriticalityLevel,
        vesselType: vesselType as string,
        engineType: engineType as string,
        limit: Math.min(parseInt(limit as string) || 10, 50)
      };

      const suggestions = await itemCatalogService.getAdvancedAutocompleteSuggestions(
        query as string,
        options
      );

      res.json({
        success: true,
        data: suggestions
      });
    } catch (error) {
      logger.error('Error in getAdvancedAutocompleteSuggestions controller:', error);
      next(error);
    }
  }

  /**
   * Update item specifications
   */
  async updateItemSpecifications(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { specifications } = req.body;

      if (!specifications || typeof specifications !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Specifications object is required'
        });
      }

      const updatedItem = await itemCatalogService.updateItemSpecifications(
        id,
        specifications,
        req.user?.id
      );

      res.json({
        success: true,
        data: updatedItem
      });
    } catch (error) {
      logger.error('Error in updateItemSpecifications controller:', error);
      next(error);
    }
  }

  /**
   * Get specification templates
   */
  async getSpecificationTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const { category } = req.query;
      
      const templates = await itemCatalogService.getSpecificationTemplates(
        category as ItemCategory
      );

      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      logger.error('Error in getSpecificationTemplates controller:', error);
      next(error);
    }
  }

  /**
   * Get items with pricing analytics
   */
  async getItemsWithPricingAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: ItemCatalogSearchFilters & {
        includePricingTrends?: boolean;
        includeLeadTimeTrends?: boolean;
      } = {
        search: req.query.search as string,
        category: req.query.category as ItemCategory,
        criticalityLevel: req.query.criticalityLevel as CriticalityLevel,
        vesselType: req.query.vesselType as string,
        engineType: req.query.engineType as string,
        impaCode: req.query.impaCode as string,
        issaCode: req.query.issaCode as string,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice as string) : undefined,
        maxLeadTime: req.query.maxLeadTime ? parseInt(req.query.maxLeadTime as string) : undefined,
        includePricingTrends: req.query.includePricingTrends === 'true',
        includeLeadTimeTrends: req.query.includeLeadTimeTrends === 'true'
      };

      const result = await itemCatalogService.getItemsWithPricingAnalytics(filters);

      res.json({
        success: true,
        data: result.items,
        pagination: result.pagination
      });
    } catch (error) {
      logger.error('Error in getItemsWithPricingAnalytics controller:', error);
      next(error);
    }
  }

  /**
   * Bulk update pricing from quotes
   */
  async bulkUpdatePricingFromQuotes(req: Request, res: Response, next: NextFunction) {
    try {
      const { itemIds } = req.body;

      if (itemIds && !Array.isArray(itemIds)) {
        return res.status(400).json({
          success: false,
          error: 'itemIds must be an array if provided'
        });
      }

      const updateResults = await itemCatalogService.bulkUpdatePricingFromQuotes(
        itemIds,
        req.user?.id
      );

      res.json({
        success: true,
        data: updateResults,
        message: `Updated pricing for ${updateResults.length} items`
      });
    } catch (error) {
      logger.error('Error in bulkUpdatePricingFromQuotes controller:', error);
      next(error);
    }
  }

  /**
   * Get search analytics and insights
   */
  async getSearchAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const filters: ItemCatalogSearchFilters = {
        category: req.query.category as ItemCategory,
        criticalityLevel: req.query.criticalityLevel as CriticalityLevel,
        vesselType: req.query.vesselType as string,
        engineType: req.query.engineType as string
      };

      const analytics = await itemCatalogService.getSearchAnalytics(filters);

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error in getSearchAnalytics controller:', error);
      next(error);
    }
  }

  /**
   * Delete item from catalog
   */
  async deleteItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const result = await itemCatalogService.deleteItem(id, req.user?.id);

      res.json({
        success: true,
        message: 'Item deleted successfully'
      });
    } catch (error) {
      logger.error('Error in deleteItem controller:', error);
      next(error);
    }
  }
}

export const itemCatalogController = new ItemCatalogController();