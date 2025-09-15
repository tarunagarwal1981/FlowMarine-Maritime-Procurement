import { Request, Response, NextFunction } from 'express';
import { rfqService, RFQCreationData, RFQUpdateData } from '../services/rfqService';
import { AppError } from '../utils/errors';
import { z } from 'zod';

// Validation schemas
const rfqCreationSchema = z.object({
  requisitionId: z.string().cuid(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  currency: z.string().optional(),
  deliveryLocation: z.string().optional(),
  deliveryDate: z.string().transform(str => str ? new Date(str) : undefined).optional(),
  responseDeadline: z.string().transform(str => str ? new Date(str) : undefined).optional(),
  vendorSelectionCriteria: z.object({
    countries: z.array(z.string()).optional(),
    regions: z.array(z.string()).optional(),
    portCodes: z.array(z.string()).optional(),
    capabilities: z.array(z.string()).optional(),
    minRating: z.number().min(0).max(10).optional(),
    maxVendors: z.number().min(1).max(20).optional()
  }).optional()
});

const rfqUpdateSchema = z.object({
  id: z.string().cuid(),
  title: z.string().optional(),
  description: z.string().optional(),
  deliveryLocation: z.string().optional(),
  deliveryDate: z.string().transform(str => str ? new Date(str) : undefined).optional(),
  responseDeadline: z.string().transform(str => str ? new Date(str) : undefined).optional(),
  status: z.enum(['DRAFT', 'SENT', 'RESPONSES_RECEIVED', 'EVALUATED', 'AWARDED', 'CANCELLED']).optional()
});

const rfqDistributionSchema = z.object({
  vendorIds: z.array(z.string().cuid()).min(1, 'At least one vendor must be selected')
});

const rfqFiltersSchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'RESPONSES_RECEIVED', 'EVALUATED', 'AWARDED', 'CANCELLED']).optional(),
  vesselId: z.string().cuid().optional(),
  dateFrom: z.string().transform(str => str ? new Date(str) : undefined).optional(),
  dateTo: z.string().transform(str => str ? new Date(str) : undefined).optional()
});

class RFQController {
  /**
   * Create RFQ from approved requisition
   */
  async createRFQFromRequisition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = rfqCreationSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const rfq = await rfqService.createRFQFromRequisition(validatedData, userId);

      res.status(201).json({
        success: true,
        message: 'RFQ created successfully',
        data: rfq
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get RFQ by ID
   */
  async getRFQById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rfqId = req.params.id;
      const rfq = await rfqService.getRFQById(rfqId);

      res.json({
        success: true,
        data: rfq
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update RFQ
   */
  async updateRFQ(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rfqId = req.params.id;
      const validatedData = rfqUpdateSchema.parse({ ...req.body, id: rfqId });
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const rfq = await rfqService.updateRFQ(validatedData, userId);

      res.json({
        success: true,
        message: 'RFQ updated successfully',
        data: rfq
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get RFQs with filters
   */
  async getRFQs(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = rfqFiltersSchema.parse(req.query);
      const rfqs = await rfqService.getRFQs(filters);

      res.json({
        success: true,
        data: rfqs,
        count: rfqs.length
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Select vendors for RFQ
   */
  async selectVendorsForRFQ(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rfqId = req.params.id;
      const criteria = req.body.criteria;

      const result = await rfqService.selectVendorsForRFQ(rfqId, criteria);

      res.json({
        success: true,
        message: 'Vendors selected successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Distribute RFQ to selected vendors
   */
  async distributeRFQ(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rfqId = req.params.id;
      const { vendorIds } = rfqDistributionSchema.parse(req.body);
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      const result = await rfqService.distributeRFQ(rfqId, vendorIds, userId);

      res.json({
        success: true,
        message: 'RFQ distributed successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel RFQ
   */
  async cancelRFQ(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rfqId = req.params.id;
      const { reason } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      if (!reason || typeof reason !== 'string') {
        throw new AppError('Cancellation reason is required', 400, 'REASON_REQUIRED');
      }

      const rfq = await rfqService.cancelRFQ(rfqId, reason, userId);

      res.json({
        success: true,
        message: 'RFQ cancelled successfully',
        data: rfq
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Auto-generate and distribute RFQ from requisition
   */
  async autoGenerateRFQ(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { requisitionId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new AppError('User not authenticated', 401, 'UNAUTHORIZED');
      }

      // Create RFQ with default title
      const rfqData: RFQCreationData = {
        requisitionId,
        title: `Auto-generated RFQ for Requisition`,
        description: 'Automatically generated RFQ from approved requisition'
      };

      const rfq = await rfqService.createRFQFromRequisition(rfqData, userId);

      // Select vendors automatically
      const vendorSelection = await rfqService.selectVendorsForRFQ(rfq.id);

      // Distribute to selected vendors if any found
      let distributionResult = null;
      if (vendorSelection.selectedVendors.length > 0) {
        const vendorIds = vendorSelection.selectedVendors.map(v => v.id);
        distributionResult = await rfqService.distributeRFQ(rfq.id, vendorIds, userId);
      }

      res.status(201).json({
        success: true,
        message: 'RFQ auto-generated and distributed successfully',
        data: {
          rfq,
          vendorSelection,
          distribution: distributionResult
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get RFQ statistics
   */
  async getRFQStatistics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vesselId, dateFrom, dateTo } = req.query;

      const filters: any = {};
      if (vesselId) filters.vesselId = vesselId as string;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);

      const allRFQs = await rfqService.getRFQs(filters);

      const statistics = {
        total: allRFQs.length,
        byStatus: {
          draft: allRFQs.filter(rfq => rfq.status === 'DRAFT').length,
          sent: allRFQs.filter(rfq => rfq.status === 'SENT').length,
          responsesReceived: allRFQs.filter(rfq => rfq.status === 'RESPONSES_RECEIVED').length,
          evaluated: allRFQs.filter(rfq => rfq.status === 'EVALUATED').length,
          awarded: allRFQs.filter(rfq => rfq.status === 'AWARDED').length,
          cancelled: allRFQs.filter(rfq => rfq.status === 'CANCELLED').length
        },
        averageResponseTime: this.calculateAverageResponseTime(allRFQs),
        topVendorsByParticipation: this.getTopVendorsByParticipation(allRFQs)
      };

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      next(error);
    }
  }

  private calculateAverageResponseTime(rfqs: any[]): number {
    const completedRFQs = rfqs.filter(rfq => 
      rfq.status === 'RESPONSES_RECEIVED' || rfq.status === 'EVALUATED' || rfq.status === 'AWARDED'
    );

    if (completedRFQs.length === 0) return 0;

    const totalDays = completedRFQs.reduce((sum, rfq) => {
      const issueDate = new Date(rfq.issueDate);
      const responseDate = new Date(rfq.updatedAt);
      const daysDiff = Math.ceil((responseDate.getTime() - issueDate.getTime()) / (1000 * 60 * 60 * 24));
      return sum + daysDiff;
    }, 0);

    return Math.round(totalDays / completedRFQs.length);
  }

  private getTopVendorsByParticipation(rfqs: any[]): any[] {
    const vendorParticipation: { [key: string]: { name: string; count: number } } = {};

    rfqs.forEach(rfq => {
      rfq.vendors?.forEach((rfqVendor: any) => {
        const vendorId = rfqVendor.vendor.id;
        const vendorName = rfqVendor.vendor.name;
        
        if (!vendorParticipation[vendorId]) {
          vendorParticipation[vendorId] = { name: vendorName, count: 0 };
        }
        vendorParticipation[vendorId].count++;
      });
    });

    return Object.entries(vendorParticipation)
      .map(([id, data]) => ({ vendorId: id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}

export const rfqController = new RFQController();