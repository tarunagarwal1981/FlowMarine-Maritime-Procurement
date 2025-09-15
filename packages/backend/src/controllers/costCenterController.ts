import { Request, Response } from 'express';
import { CostCenterService } from '../services/costCenterService';
import { logger } from '../utils/logger';

export class CostCenterController {
  /**
   * Create cost center
   */
  static async createCostCenter(req: Request, res: Response) {
    try {
      const { code, name, description, parentId } = req.body;

      if (!code || !name) {
        return res.status(400).json({
          success: false,
          error: 'Code and name are required'
        });
      }

      const costCenter = await CostCenterService.createCostCenter({
        code: code.toUpperCase(),
        name,
        description,
        parentId
      });

      res.status(201).json({
        success: true,
        data: costCenter
      });
    } catch (error) {
      logger.error('Error creating cost center:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create cost center'
      });
    }
  }

  /**
   * Get cost center hierarchy
   */
  static async getCostCenterHierarchy(req: Request, res: Response) {
    try {
      const hierarchy = await CostCenterService.getCostCenterHierarchy();

      res.json({
        success: true,
        data: hierarchy
      });
    } catch (error) {
      logger.error('Error getting cost center hierarchy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cost center hierarchy'
      });
    }
  }

  /**
   * Get cost center by code
   */
  static async getCostCenterByCode(req: Request, res: Response) {
    try {
      const { code } = req.params;

      const costCenter = await CostCenterService.getCostCenterByCode(code.toUpperCase());

      if (!costCenter) {
        return res.status(404).json({
          success: false,
          error: 'Cost center not found'
        });
      }

      res.json({
        success: true,
        data: costCenter
      });
    } catch (error) {
      logger.error('Error getting cost center by code:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cost center'
      });
    }
  }  /**

   * Allocate costs
   */
  static async allocateCosts(req: Request, res: Response) {
    try {
      const { totalAmount, currency, allocations } = req.body;

      if (!totalAmount || !currency || !allocations || !Array.isArray(allocations)) {
        return res.status(400).json({
          success: false,
          error: 'totalAmount, currency, and allocations array are required'
        });
      }

      const result = await CostCenterService.allocateCosts(
        parseFloat(totalAmount),
        currency.toUpperCase(),
        allocations
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Error allocating costs:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to allocate costs'
      });
    }
  }

  /**
   * Get cost center path
   */
  static async getCostCenterPath(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const path = await CostCenterService.getCostCenterPath(id);

      res.json({
        success: true,
        data: path
      });
    } catch (error) {
      logger.error('Error getting cost center path:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cost center path'
      });
    }
  }

  /**
   * Update cost center
   */
  static async updateCostCenter(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, description, isActive } = req.body;

      const costCenter = await CostCenterService.updateCostCenter(id, {
        name,
        description,
        isActive
      });

      res.json({
        success: true,
        data: costCenter
      });
    } catch (error) {
      logger.error('Error updating cost center:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update cost center'
      });
    }
  }

  /**
   * Get cost centers for vessel
   */
  static async getCostCentersForVessel(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;

      const costCenters = await CostCenterService.getCostCentersForVessel(vesselId);

      res.json({
        success: true,
        data: costCenters
      });
    } catch (error) {
      logger.error('Error getting cost centers for vessel:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get cost centers for vessel'
      });
    }
  }
}