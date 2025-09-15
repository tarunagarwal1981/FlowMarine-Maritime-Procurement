import { Request, Response, NextFunction } from 'express';
import { purchaseOrderService, CreatePOData, POApprovalData } from '../services/purchaseOrderService';
import { AppError } from '../utils/errors';
import { POStatus } from '@prisma/client';

export class PurchaseOrderController {
  /**
   * Generate purchase order from approved quote
   */
  async generatePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { quoteId, deliveryInstructions, specialTerms, notes } = req.body;

      if (!quoteId) {
        throw new AppError('Quote ID is required', 400, 'MISSING_QUOTE_ID');
      }

      const data: CreatePOData = {
        quoteId,
        approvedBy: req.user.id,
        deliveryInstructions,
        specialTerms,
        notes
      };

      const purchaseOrder = await purchaseOrderService.generatePurchaseOrder(data);

      res.status(201).json({
        success: true,
        data: purchaseOrder,
        message: 'Purchase order generated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Approve high-value purchase order
   */
  async approvePurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      const data: POApprovalData = {
        purchaseOrderId: id,
        approvedBy: req.user.id,
        comments
      };

      const approvedPO = await purchaseOrderService.approvePurchaseOrder(data);

      res.json({
        success: true,
        data: approvedPO,
        message: 'Purchase order approved successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get purchase order by ID
   */
  async getPurchaseOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const purchaseOrder = await purchaseOrderService.getPurchaseOrderById(id);

      if (!purchaseOrder) {
        throw new AppError('Purchase order not found', 404, 'PO_NOT_FOUND');
      }

      res.json({
        success: true,
        data: purchaseOrder
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get purchase orders for a vessel
   */
  async getPurchaseOrdersByVessel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { status } = req.query;

      const purchaseOrders = await purchaseOrderService.getPurchaseOrdersByVessel(
        vesselId,
        status as POStatus
      );

      res.json({
        success: true,
        data: purchaseOrders,
        count: purchaseOrders.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all purchase orders with filtering
   */
  async getPurchaseOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, vesselId, vendorId, page = 1, limit = 20 } = req.query;

      // Build filter conditions
      const where: any = {};
      
      if (status) where.status = status;
      if (vesselId) where.vesselId = vesselId;
      if (vendorId) where.vendorId = vendorId;

      // Apply vessel access control
      if (req.user.vessels && req.user.vessels.length > 0) {
        const userVesselIds = req.user.vessels.map((v: any) => v.id);
        if (vesselId && !userVesselIds.includes(vesselId as string)) {
          throw new AppError('Access denied to vessel', 403, 'VESSEL_ACCESS_DENIED');
        }
        if (!vesselId) {
          where.vesselId = { in: userVesselIds };
        }
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [purchaseOrders, total] = await Promise.all([
        purchaseOrderService.getPurchaseOrdersByVessel(where.vesselId, where.status),
        // For simplicity, using the same method - in production would have a separate count method
        purchaseOrderService.getPurchaseOrdersByVessel(where.vesselId, where.status)
      ]);

      res.json({
        success: true,
        data: purchaseOrders.slice(skip, skip + Number(limit)),
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: total.length,
          pages: Math.ceil(total.length / Number(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update purchase order status
   */
  async updatePurchaseOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!status) {
        throw new AppError('Status is required', 400, 'MISSING_STATUS');
      }

      if (!Object.values(POStatus).includes(status)) {
        throw new AppError('Invalid status', 400, 'INVALID_STATUS');
      }

      const updatedPO = await purchaseOrderService.updatePurchaseOrderStatus(
        id,
        status,
        req.user.id,
        notes
      );

      res.json({
        success: true,
        data: updatedPO,
        message: 'Purchase order status updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel purchase order
   */
  async cancelPurchaseOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        throw new AppError('Cancellation reason is required', 400, 'MISSING_REASON');
      }

      const cancelledPO = await purchaseOrderService.updatePurchaseOrderStatus(
        id,
        POStatus.CANCELLED,
        req.user.id,
        `Cancelled: ${reason}`
      );

      res.json({
        success: true,
        data: cancelledPO,
        message: 'Purchase order cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get purchase order statistics
   */
  async getPurchaseOrderStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vesselId, startDate, endDate } = req.query;

      // This would be implemented with proper aggregation queries
      // For now, returning a basic structure
      const stats = {
        totalOrders: 0,
        totalValue: 0,
        statusBreakdown: {
          [POStatus.DRAFT]: 0,
          [POStatus.SENT]: 0,
          [POStatus.ACKNOWLEDGED]: 0,
          [POStatus.IN_PROGRESS]: 0,
          [POStatus.DELIVERED]: 0,
          [POStatus.INVOICED]: 0,
          [POStatus.PAID]: 0,
          [POStatus.CANCELLED]: 0
        },
        averageProcessingTime: 0,
        topVendors: []
      };

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

export const purchaseOrderController = new PurchaseOrderController();