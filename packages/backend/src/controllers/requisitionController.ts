/**
 * Requisition Controller
 * Handles HTTP requests for requisition management
 */

import { Request, Response, NextFunction } from 'express';
import { requisitionService, CreateRequisitionData, RequisitionFilters } from '../services/requisitionService';
import { AppError } from '../utils/errors';
import { UrgencyLevel, RequisitionStatus } from '@prisma/client';

export class RequisitionController {
  /**
   * Create a new requisition
   */
  async createRequisition(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const data: CreateRequisitionData = req.body;

      // Validate required fields
      if (!data.vesselId) {
        throw new AppError('Vessel ID is required', 400, 'MISSING_VESSEL_ID');
      }

      if (!data.items || data.items.length === 0) {
        throw new AppError('At least one item is required', 400, 'MISSING_ITEMS');
      }

      // Convert date strings to Date objects
      if (data.deliveryDate) {
        data.deliveryDate = new Date(data.deliveryDate);
      }

      const requisition = await requisitionService.createRequisition(data, userId);

      res.status(201).json({
        success: true,
        data: requisition
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get requisitions with filtering and pagination
   */
  async getRequisitions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const filters: RequisitionFilters = {};

      // Apply filters from query parameters
      if (req.query.vesselId) {
        filters.vesselId = req.query.vesselId as string;
      }

      if (req.query.status) {
        filters.status = req.query.status as RequisitionStatus;
      }

      if (req.query.urgencyLevel) {
        filters.urgencyLevel = req.query.urgencyLevel as UrgencyLevel;
      }

      if (req.query.requestedById) {
        filters.requestedById = req.query.requestedById as string;
      }

      if (req.query.dateFrom) {
        filters.dateFrom = new Date(req.query.dateFrom as string);
      }

      if (req.query.dateTo) {
        filters.dateTo = new Date(req.query.dateTo as string);
      }

      const result = await requisitionService.getRequisitions(filters, userId, page, limit);

      res.json({
        success: true,
        data: result.requisitions,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single requisition by ID
   */
  async getRequisition(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const requisition = await requisitionService.getRequisitionById(id, userId);

      if (!requisition) {
        throw new AppError('Requisition not found', 404, 'REQUISITION_NOT_FOUND');
      }

      res.json({
        success: true,
        data: requisition
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a requisition
   */
  async updateRequisition(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const updates = req.body;

      // Convert date strings to Date objects
      if (updates.deliveryDate) {
        updates.deliveryDate = new Date(updates.deliveryDate);
      }

      const requisition = await requisitionService.updateRequisition(id, updates, userId);

      res.json({
        success: true,
        data: requisition
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Submit a requisition for approval
   */
  async submitRequisition(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const requisition = await requisitionService.submitRequisition(id, userId);

      res.json({
        success: true,
        data: requisition,
        message: 'Requisition submitted for approval'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a requisition
   */
  async deleteRequisition(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      await requisitionService.deleteRequisition(id, userId);

      res.json({
        success: true,
        message: 'Requisition deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get requisition statistics
   */
  async getRequisitionStats(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const vesselId = req.query.vesselId as string;

      const stats = await requisitionService.getRequisitionStats(userId, vesselId);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Validate requisition data
   */
  async validateRequisition(req: Request, res: Response, next: NextFunction) {
    try {
      const data: CreateRequisitionData = req.body;

      // This would use the private validation method from the service
      // For now, we'll do basic validation here
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!data.vesselId) {
        errors.push('Vessel ID is required');
      }

      if (!data.items || data.items.length === 0) {
        errors.push('At least one item is required');
      }

      if (data.totalAmount <= 0) {
        errors.push('Total amount must be greater than zero');
      }

      // Validate items
      data.items?.forEach((item, index) => {
        if (item.quantity <= 0) {
          errors.push(`Item ${index + 1}: Quantity must be greater than zero`);
        }
        if (item.unitPrice < 0) {
          errors.push(`Item ${index + 1}: Unit price cannot be negative`);
        }
      });

      // Emergency requisitions need justification
      if (data.urgencyLevel === 'EMERGENCY' && !data.justification) {
        errors.push('Emergency requisitions require justification');
      }

      res.json({
        success: true,
        data: {
          isValid: errors.length === 0,
          errors,
          warnings
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Sync offline requisitions
   */
  async syncOfflineRequisitions(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { requisitions } = req.body;

      if (!Array.isArray(requisitions)) {
        throw new AppError('Requisitions must be an array', 400, 'INVALID_REQUISITIONS_FORMAT');
      }

      const results = [];

      for (const offlineRequisition of requisitions) {
        try {
          // Convert offline requisition to create data format
          const createData: CreateRequisitionData = {
            vesselId: offlineRequisition.vesselId,
            urgencyLevel: offlineRequisition.urgencyLevel,
            totalAmount: offlineRequisition.totalAmount,
            currency: offlineRequisition.currency,
            deliveryLocation: offlineRequisition.deliveryLocation,
            deliveryDate: offlineRequisition.deliveryDate ? new Date(offlineRequisition.deliveryDate) : undefined,
            justification: offlineRequisition.justification,
            items: offlineRequisition.items.map((item: any) => ({
              itemCatalogId: item.itemCatalogId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              urgencyLevel: item.urgencyLevel,
              justification: item.justification,
              specifications: item.specifications
            }))
          };

          const requisition = await requisitionService.createRequisition(createData, userId);

          results.push({
            tempId: offlineRequisition.tempId,
            success: true,
            requisition: requisition
          });
        } catch (error) {
          results.push({
            tempId: offlineRequisition.tempId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: true,
        data: results,
        message: `Synced ${results.filter(r => r.success).length} of ${results.length} requisitions`
      });
    } catch (error) {
      next(error);
    }
  }
}

export const requisitionController = new RequisitionController();