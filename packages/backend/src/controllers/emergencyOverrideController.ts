import { Request, Response } from 'express';
import { emergencyOverrideService } from '../services/emergencyOverrideService';
import { AuditService } from '../services/auditService';
import { logger } from '../utils/logger';

export class EmergencyOverrideController {

  /**
   * Create an emergency override
   */
  async createEmergencyOverride(req: Request, res: Response) {
    try {
      const { vesselId, reason, expirationHours, requiresPostApproval, metadata } = req.body;

      if (!vesselId || !reason) {
        return res.status(400).json({
          success: false,
          error: 'Vessel ID and reason are required'
        });
      }

      const emergencyOverride = await emergencyOverrideService.createEmergencyOverride({
        userId: req.user.id,
        vesselId,
        reason,
        expirationHours,
        requiresPostApproval,
        metadata
      });

      res.status(201).json({
        success: true,
        data: emergencyOverride
      });

    } catch (error) {
      logger.error('Error creating emergency override:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Approve an emergency override (post-approval)
   */
  async approveEmergencyOverride(req: Request, res: Response) {
    try {
      const { overrideId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Approval reason is required'
        });
      }

      const emergencyOverride = await emergencyOverrideService.approveEmergencyOverride(
        overrideId,
        req.user.id,
        reason
      );

      res.json({
        success: true,
        data: emergencyOverride
      });

    } catch (error) {
      logger.error('Error approving emergency override:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Deactivate an emergency override
   */
  async deactivateEmergencyOverride(req: Request, res: Response) {
    try {
      const { overrideId } = req.params;
      const { reason } = req.body;

      if (!reason) {
        return res.status(400).json({
          success: false,
          error: 'Deactivation reason is required'
        });
      }

      const emergencyOverride = await emergencyOverrideService.deactivateEmergencyOverride(
        overrideId,
        req.user.id,
        reason
      );

      res.json({
        success: true,
        data: emergencyOverride
      });

    } catch (error) {
      logger.error('Error deactivating emergency override:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get active emergency overrides for current user
   */
  async getMyActiveOverrides(req: Request, res: Response) {
    try {
      const overrides = await emergencyOverrideService.getActiveOverrides(req.user.id);

      res.json({
        success: true,
        data: overrides
      });

    } catch (error) {
      logger.error('Error getting active overrides:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get active overrides'
      });
    }
  }

  /**
   * Get emergency overrides requiring post-approval
   */
  async getOverridesRequiringApproval(req: Request, res: Response) {
    try {
      const overrides = await emergencyOverrideService.getOverridesRequiringApproval(req.user.id);

      res.json({
        success: true,
        data: overrides
      });

    } catch (error) {
      logger.error('Error getting overrides requiring approval:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get overrides requiring approval'
      });
    }
  }

  /**
   * Check if user has active emergency override for vessel
   */
  async checkActiveOverride(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;

      const hasOverride = await emergencyOverrideService.hasActiveOverride(req.user.id, vesselId);

      res.json({
        success: true,
        data: {
          hasActiveOverride: hasOverride
        }
      });

    } catch (error) {
      logger.error('Error checking active override:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check active override'
      });
    }
  }

  /**
   * Get emergency override history for a vessel
   */
  async getOverrideHistory(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // This would require a new method in the service
      // For now, return a placeholder response
      res.json({
        success: true,
        data: [],
        message: 'Override history endpoint - to be implemented'
      });

    } catch (error) {
      logger.error('Error getting override history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get override history'
      });
    }
  }

  /**
   * Clean up expired emergency overrides (admin endpoint)
   */
  async cleanupExpiredOverrides(req: Request, res: Response) {
    try {
      const cleanedUp = await emergencyOverrideService.cleanupExpiredOverrides();

      res.json({
        success: true,
        data: {
          cleanedUp
        }
      });

    } catch (error) {
      logger.error('Error cleaning up expired overrides:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup expired overrides'
      });
    }
  }
}

export const emergencyOverrideController = new EmergencyOverrideController();