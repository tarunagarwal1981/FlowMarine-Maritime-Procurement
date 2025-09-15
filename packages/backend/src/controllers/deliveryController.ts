import { Request, Response, NextFunction } from 'express';
import { deliveryService, CreateDeliveryData, UpdateDeliveryData, DeliveryConfirmationData } from '../services/deliveryService';
import { AppError } from '../utils/errors';
import { DeliveryStatus } from '@prisma/client';

export class DeliveryController {
  /**
   * Create delivery schedule for purchase order
   */
  async createDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { purchaseOrderId, scheduledDate, deliveryAddress, carrier, trackingNumber, notes } = req.body;

      if (!purchaseOrderId || !scheduledDate || !deliveryAddress) {
        throw new AppError('Purchase order ID, scheduled date, and delivery address are required', 400, 'MISSING_REQUIRED_FIELDS');
      }

      const data: CreateDeliveryData = {
        purchaseOrderId,
        scheduledDate: new Date(scheduledDate),
        deliveryAddress,
        carrier,
        trackingNumber,
        notes
      };

      const delivery = await deliveryService.createDelivery(data, req.user.id);

      res.status(201).json({
        success: true,
        data: delivery,
        message: 'Delivery scheduled successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update delivery status and tracking information
   */
  async updateDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status, actualDate, trackingNumber, carrier, receivedBy, photoUrls, notes } = req.body;

      const data: UpdateDeliveryData = {
        status,
        actualDate: actualDate ? new Date(actualDate) : undefined,
        trackingNumber,
        carrier,
        receivedBy,
        photoUrls,
        notes
      };

      const updatedDelivery = await deliveryService.updateDelivery(id, data, req.user.id);

      res.json({
        success: true,
        data: updatedDelivery,
        message: 'Delivery updated successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Confirm delivery with photo documentation
   */
  async confirmDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { receivedBy, actualDate, photoUrls, notes, discrepancies } = req.body;

      if (!receivedBy || !actualDate || !photoUrls || photoUrls.length === 0) {
        throw new AppError('Received by, actual date, and at least one photo are required', 400, 'MISSING_CONFIRMATION_DATA');
      }

      const data: DeliveryConfirmationData = {
        deliveryId: id,
        receivedBy,
        actualDate: new Date(actualDate),
        photoUrls,
        notes,
        discrepancies
      };

      const confirmedDelivery = await deliveryService.confirmDelivery(data, req.user.id);

      res.json({
        success: true,
        data: confirmedDelivery,
        message: 'Delivery confirmed successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get delivery tracking information
   */
  async getDeliveryTracking(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const tracking = await deliveryService.getDeliveryTracking(id);

      res.json({
        success: true,
        data: tracking
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Calculate estimated delivery time
   */
  async calculateDeliveryTime(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { originPort, destinationPort, carrier } = req.query;

      if (!originPort || !destinationPort || !carrier) {
        throw new AppError('Origin port, destination port, and carrier are required', 400, 'MISSING_CALCULATION_PARAMS');
      }

      const estimation = await deliveryService.calculateEstimatedDeliveryTime(
        originPort as string,
        destinationPort as string,
        carrier as string
      );

      res.json({
        success: true,
        data: estimation
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get port information
   */
  async getPortInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { portCode } = req.params;

      const portInfo = await deliveryService.getPortInfo(portCode);

      if (!portInfo) {
        throw new AppError('Port information not found', 404, 'PORT_NOT_FOUND');
      }

      res.json({
        success: true,
        data: portInfo
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Search ports by name or code
   */
  async searchPorts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string' || q.length < 2) {
        throw new AppError('Search query must be at least 2 characters', 400, 'INVALID_SEARCH_QUERY');
      }

      const ports = await deliveryService.searchPorts(q);

      res.json({
        success: true,
        data: ports,
        count: ports.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get deliveries for a vessel
   */
  async getDeliveriesByVessel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { status } = req.query;

      const deliveries = await deliveryService.getDeliveriesByVessel(
        vesselId,
        status as DeliveryStatus
      );

      res.json({
        success: true,
        data: deliveries,
        count: deliveries.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all deliveries with filtering
   */
  async getDeliveries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, vesselId, carrier, page = 1, limit = 20 } = req.query;

      // Apply vessel access control
      let targetVesselId = vesselId as string;
      if (req.user.vessels && req.user.vessels.length > 0) {
        const userVesselIds = req.user.vessels.map((v: any) => v.id);
        if (vesselId && !userVesselIds.includes(vesselId as string)) {
          throw new AppError('Access denied to vessel', 403, 'VESSEL_ACCESS_DENIED');
        }
        if (!vesselId) {
          // If no specific vessel requested, get deliveries for all user's vessels
          // For simplicity, we'll get the first vessel's deliveries
          targetVesselId = userVesselIds[0];
        }
      }

      const deliveries = await deliveryService.getDeliveriesByVessel(
        targetVesselId,
        status as DeliveryStatus
      );

      // Apply pagination
      const skip = (Number(page) - 1) * Number(limit);
      const paginatedDeliveries = deliveries.slice(skip, skip + Number(limit));

      res.json({
        success: true,
        data: paginatedDeliveries,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: deliveries.length,
          pages: Math.ceil(deliveries.length / Number(limit))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get delivery by ID
   */
  async getDeliveryById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // This would be implemented in the service
      // For now, we'll use the tracking method which includes delivery details
      const tracking = await deliveryService.getDeliveryTracking(id);

      res.json({
        success: true,
        data: tracking
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel delivery
   */
  async cancelDelivery(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!reason) {
        throw new AppError('Cancellation reason is required', 400, 'MISSING_REASON');
      }

      const cancelledDelivery = await deliveryService.updateDelivery(
        id,
        {
          status: DeliveryStatus.CANCELLED,
          notes: `Cancelled: ${reason}`
        },
        req.user.id
      );

      res.json({
        success: true,
        data: cancelledDelivery,
        message: 'Delivery cancelled successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vesselId, startDate, endDate } = req.query;

      // This would be implemented with proper aggregation queries
      // For now, returning a basic structure
      const stats = {
        totalDeliveries: 0,
        onTimeDeliveries: 0,
        delayedDeliveries: 0,
        averageDeliveryTime: 0,
        statusBreakdown: {
          [DeliveryStatus.SCHEDULED]: 0,
          [DeliveryStatus.IN_TRANSIT]: 0,
          [DeliveryStatus.DELIVERED]: 0,
          [DeliveryStatus.DELAYED]: 0,
          [DeliveryStatus.CANCELLED]: 0
        },
        topCarriers: [],
        deliveryPerformance: {
          onTimePercentage: 0,
          averageDelayDays: 0
        }
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

export const deliveryController = new DeliveryController();