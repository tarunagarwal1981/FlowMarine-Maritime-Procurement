import { Request, Response } from 'express';
import { BudgetService } from '../services/budgetService';
import { logger } from '../utils/logger';

export class BudgetController {
  /**
   * Create budget
   */
  static async createBudget(req: Request, res: Response) {
    try {
      const {
        vesselId,
        costCenterId,
        category,
        amount,
        currency,
        period,
        startDate,
        endDate
      } = req.body;

      if (!category || !amount || !currency || !period || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'category, amount, currency, period, startDate, and endDate are required'
        });
      }

      const budget = await BudgetService.createBudget({
        vesselId,
        costCenterId,
        category,
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        period,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      });

      res.status(201).json({
        success: true,
        data: budget
      });
    } catch (error) {
      logger.error('Error creating budget:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create budget'
      });
    }
  }

  /**
   * Get vessel budget summary
   */
  static async getVesselBudgetSummary(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const { period, baseCurrency = 'USD' } = req.query;

      const summary = await BudgetService.getVesselBudgetSummary(
        vesselId,
        period as string,
        (baseCurrency as string).toUpperCase()
      );

      res.json({
        success: true,
        data: summary
      });
    } catch (error) {
      logger.error('Error getting vessel budget summary:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get vessel budget summary'
      });
    }
  }

  /**
   * Check budget availability
   */
  static async checkBudgetAvailability(req: Request, res: Response) {
    try {
      const { vesselId, category, amount, currency, costCenterId } = req.body;

      if (!vesselId || !category || !amount || !currency) {
        return res.status(400).json({
          success: false,
          error: 'vesselId, category, amount, and currency are required'
        });
      }

      const availability = await BudgetService.checkBudgetAvailability(
        vesselId,
        category,
        parseFloat(amount),
        currency.toUpperCase(),
        costCenterId
      );

      res.json({
        success: true,
        data: availability
      });
    } catch (error) {
      logger.error('Error checking budget availability:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check budget availability'
      });
    }
  }  /**

   * Apply seasonal adjustments
   */
  static async applySeasonalAdjustments(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const { adjustments } = req.body;

      if (!adjustments || !Array.isArray(adjustments)) {
        return res.status(400).json({
          success: false,
          error: 'adjustments array is required'
        });
      }

      await BudgetService.applySeasonalAdjustments(vesselId, adjustments);

      res.json({
        success: true,
        message: 'Seasonal adjustments applied successfully'
      });
    } catch (error) {
      logger.error('Error applying seasonal adjustments:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to apply seasonal adjustments'
      });
    }
  }

  /**
   * Get budget hierarchy
   */
  static async getBudgetHierarchy(req: Request, res: Response) {
    try {
      const { vesselId, category, currency } = req.params;

      const hierarchy = await BudgetService.getBudgetHierarchy(
        vesselId,
        category,
        currency.toUpperCase()
      );

      res.json({
        success: true,
        data: hierarchy
      });
    } catch (error) {
      logger.error('Error getting budget hierarchy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get budget hierarchy'
      });
    }
  }
}