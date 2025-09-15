import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export class AnalyticsController {
  /**
   * Get spending analysis
   */
  async getSpendingAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        vesselIds,
        currency = 'USD'
      } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400, 'MISSING_DATE_RANGE');
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError('Invalid date format', 400, 'INVALID_DATE_FORMAT');
      }

      const vesselIdArray = vesselIds 
        ? (Array.isArray(vesselIds) ? vesselIds : [vesselIds]) as string[]
        : undefined;

      const analysis = await analyticsService.generateSpendingAnalysis(
        start,
        end,
        vesselIdArray,
        currency as string
      );

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      logger.error('Error getting spending analysis', { error });
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get vendor performance analytics
   */
  async getVendorPerformanceAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { vendorId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400, 'MISSING_DATE_RANGE');
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError('Invalid date format', 400, 'INVALID_DATE_FORMAT');
      }

      const analytics = await analyticsService.generateVendorPerformanceAnalytics(
        vendorId,
        start,
        end
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Error getting vendor performance analytics', { error });
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get procurement patterns analysis
   */
  async getProcurementPatterns(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400, 'MISSING_DATE_RANGE');
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError('Invalid date format', 400, 'INVALID_DATE_FORMAT');
      }

      const patterns = await analyticsService.analyzeProcurementPatterns(
        vesselId,
        start,
        end
      );

      res.json({
        success: true,
        data: patterns
      });
    } catch (error) {
      logger.error('Error getting procurement patterns', { error });
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get cost optimization recommendations
   */
  async getCostOptimizationRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const { vesselIds, startDate, endDate } = req.query;

      const vesselIdArray = vesselIds 
        ? (Array.isArray(vesselIds) ? vesselIds : [vesselIds]) as string[]
        : undefined;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;

      if (start && isNaN(start.getTime())) {
        throw new AppError('Invalid start date format', 400, 'INVALID_DATE_FORMAT');
      }

      if (end && isNaN(end.getTime())) {
        throw new AppError('Invalid end date format', 400, 'INVALID_DATE_FORMAT');
      }

      const recommendations = await analyticsService.generateCostOptimizationRecommendations(
        vesselIdArray,
        start,
        end
      );

      res.json({
        success: true,
        data: recommendations
      });
    } catch (error) {
      logger.error('Error getting cost optimization recommendations', { error });
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }

  /**
   * Get analytics dashboard data
   */
  async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const {
        startDate,
        endDate,
        vesselIds,
        currency = 'USD'
      } = req.query;

      if (!startDate || !endDate) {
        throw new AppError('Start date and end date are required', 400, 'MISSING_DATE_RANGE');
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError('Invalid date format', 400, 'INVALID_DATE_FORMAT');
      }

      const vesselIdArray = vesselIds 
        ? (Array.isArray(vesselIds) ? vesselIds : [vesselIds]) as string[]
        : undefined;

      // Get spending analysis
      const spendingAnalysis = await analyticsService.generateSpendingAnalysis(
        start,
        end,
        vesselIdArray,
        currency as string
      );

      // Get cost optimization recommendations
      const recommendations = await analyticsService.generateCostOptimizationRecommendations(
        vesselIdArray,
        start,
        end
      );

      // Get top performing vendors
      const topVendors = spendingAnalysis.spendingByVendor
        .sort((a, b) => b.totalAmount - a.totalAmount)
        .slice(0, 5);

      res.json({
        success: true,
        data: {
          spendingAnalysis,
          recommendations: recommendations.slice(0, 5), // Top 5 recommendations
          topVendors,
          summary: {
            totalSpending: spendingAnalysis.totalSpending,
            totalOrders: spendingAnalysis.spendingByVessel.reduce((sum, v) => sum + v.orderCount, 0),
            activeVessels: spendingAnalysis.spendingByVessel.length,
            activeVendors: spendingAnalysis.spendingByVendor.length,
          }
        }
      });
    } catch (error) {
      logger.error('Error getting dashboard data', { error });
      if (error instanceof AppError) {
        res.status(error.statusCode).json({
          success: false,
          error: error.message,
          code: error.errorCode
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal server error'
        });
      }
    }
  }
}

export const analyticsController = new AnalyticsController();