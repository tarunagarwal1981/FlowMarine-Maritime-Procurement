import { Request, Response } from 'express';
import { DelegationService } from '../services/delegationService';
import { AuditService } from '../services/auditService';
import { logger } from '../utils/logger';

export class DelegationController {

  /**
   * Create a new delegation
   */
  async createDelegation(req: Request, res: Response) {
    try {
      const { delegateId, vesselId, permissions, reason, startDate, endDate } = req.body;

      if (!delegateId || !permissions || !reason || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Delegate ID, permissions, reason, start date, and end date are required'
        });
      }

      const delegation = await DelegationService.createDelegation({
        delegatorId: req.user.id,
        delegateId,
        vesselId,
        permissions,
        reason,
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      });

      res.status(201).json({
        success: true,
        data: delegation
      });

    } catch (error) {
      logger.error('Error creating delegation:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Transfer responsibilities during crew rotation
   */
  async transferResponsibilities(req: Request, res: Response) {
    try {
      const { toUserId, vesselId, reason, transferPendingApprovals, effectiveDate } = req.body;

      if (!toUserId || !vesselId || !reason || !effectiveDate) {
        return res.status(400).json({
          success: false,
          error: 'To user ID, vessel ID, reason, and effective date are required'
        });
      }

      const result = await DelegationService.transferResponsibilities({
        fromUserId: req.user.id,
        toUserId,
        vesselId,
        reason,
        transferPendingApprovals: transferPendingApprovals || false,
        effectiveDate: new Date(effectiveDate)
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error transferring responsibilities:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Escalate overdue approvals
   */
  async escalateOverdueApprovals(req: Request, res: Response) {
    try {
      const { vesselId } = req.query;

      const result = await DelegationService.escalateOverdueApprovals(vesselId as string);

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error escalating overdue approvals:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to escalate overdue approvals'
      });
    }
  }

  /**
   * Get delegation by ID
   */
  async getDelegationById(req: Request, res: Response) {
    try {
      const { delegationId } = req.params;

      const delegation = await DelegationService.getDelegationById(delegationId);

      if (!delegation) {
        return res.status(404).json({
          success: false,
          error: 'Delegation not found'
        });
      }

      res.json({
        success: true,
        data: delegation
      });

    } catch (error) {
      logger.error('Error getting delegation by ID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get delegation'
      });
    }
  }

  /**
   * Get delegations where current user is delegator
   */
  async getMyDelegations(req: Request, res: Response) {
    try {
      const delegations = await DelegationService.getDelegationsByDelegator(req.user.id);

      res.json({
        success: true,
        data: delegations
      });

    } catch (error) {
      logger.error('Error getting user delegations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get delegations'
      });
    }
  }

  /**
   * Get delegations where current user is delegate
   */
  async getDelegationsToMe(req: Request, res: Response) {
    try {
      const delegations = await DelegationService.getDelegationsByDelegate(req.user.id);

      res.json({
        success: true,
        data: delegations
      });

    } catch (error) {
      logger.error('Error getting delegations to user:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get delegations'
      });
    }
  }

  /**
   * Update a delegation
   */
  async updateDelegation(req: Request, res: Response) {
    try {
      const { delegationId } = req.params;
      const updateData = req.body;

      // Convert date strings to Date objects if present
      if (updateData.startDate) {
        updateData.startDate = new Date(updateData.startDate);
      }
      if (updateData.endDate) {
        updateData.endDate = new Date(updateData.endDate);
      }

      const delegation = await DelegationService.updateDelegation(
        delegationId,
        updateData,
        req.user.id
      );

      res.json({
        success: true,
        data: delegation
      });

    } catch (error) {
      logger.error('Error updating delegation:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Deactivate a delegation
   */
  async deactivateDelegation(req: Request, res: Response) {
    try {
      const { delegationId } = req.params;
      const { reason } = req.body;

      const delegation = await DelegationService.deactivateDelegation(
        delegationId,
        req.user.id,
        reason
      );

      res.json({
        success: true,
        data: delegation
      });

    } catch (error) {
      logger.error('Error deactivating delegation:', error);
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Check if user has specific permission (including delegated)
   */
  async checkPermission(req: Request, res: Response) {
    try {
      const { permission } = req.params;
      const { vesselId } = req.query;

      const hasPermission = await DelegationService.hasPermission(
        req.user.id,
        permission,
        vesselId as string
      );

      res.json({
        success: true,
        data: {
          hasPermission
        }
      });

    } catch (error) {
      logger.error('Error checking permission:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check permission'
      });
    }
  }

  /**
   * Get all permissions for current user (including delegated)
   */
  async getMyPermissions(req: Request, res: Response) {
    try {
      const { vesselId } = req.query;

      const permissions = await DelegationService.getUserPermissions(
        req.user.id,
        vesselId as string
      );

      res.json({
        success: true,
        data: {
          permissions
        }
      });

    } catch (error) {
      logger.error('Error getting user permissions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get permissions'
      });
    }
  }

  /**
   * Clean up expired delegations (admin endpoint)
   */
  async cleanupExpiredDelegations(req: Request, res: Response) {
    try {
      const cleanedUp = await DelegationService.cleanupExpiredDelegations();

      res.json({
        success: true,
        data: {
          cleanedUp
        }
      });

    } catch (error) {
      logger.error('Error cleaning up expired delegations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup expired delegations'
      });
    }
  }
}

export const delegationController = new DelegationController();