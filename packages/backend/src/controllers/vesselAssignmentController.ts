import { Request, Response } from 'express';
import { VesselAssignmentService } from '../services/vesselAssignmentService';
import { logger } from '../utils/logger';

export class VesselAssignmentController {
  /**
   * Create a new vessel assignment
   */
  static async createAssignment(req: Request, res: Response): Promise<void> {
    try {
      const { userId, vesselId, startDate, endDate, isActive } = req.body;

      if (!userId || !vesselId || !startDate) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, vesselId, startDate',
          code: 'MISSING_REQUIRED_FIELDS',
        });
        return;
      }

      const assignment = await VesselAssignmentService.createAssignment(
        {
          userId,
          vesselId,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : undefined,
          isActive,
        },
        req.user!.id
      );

      res.status(201).json({
        success: true,
        data: assignment,
      });
    } catch (error) {
      logger.error('Error creating vessel assignment:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create vessel assignment',
        code: 'ASSIGNMENT_CREATION_FAILED',
      });
    }
  }

  /**
   * Get assignments for a user
   */
  static async getUserAssignments(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const includeInactive = req.query.includeInactive === 'true';

      if (!userId) {
        res.status(400).json({
          success: false,
          error: 'User ID is required',
          code: 'USER_ID_REQUIRED',
        });
        return;
      }

      const assignments = await VesselAssignmentService.getUserAssignments(
        userId,
        includeInactive
      );

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      logger.error('Error getting user assignments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user assignments',
        code: 'GET_USER_ASSIGNMENTS_FAILED',
      });
    }
  }

  /**
   * Get assignments for a vessel
   */
  static async getVesselAssignments(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId } = req.params;
      const includeInactive = req.query.includeInactive === 'true';

      const assignments = await VesselAssignmentService.getVesselAssignments(
        vesselId,
        includeInactive
      );

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      logger.error('Error getting vessel assignments:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get vessel assignments',
        code: 'GET_VESSEL_ASSIGNMENTS_FAILED',
      });
    }
  }

  /**
   * Get current crew for a vessel
   */
  static async getCurrentCrew(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId } = req.params;

      const crew = await VesselAssignmentService.getCurrentCrew(vesselId);

      res.json({
        success: true,
        data: crew,
      });
    } catch (error) {
      logger.error('Error getting current crew:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get current crew',
        code: 'GET_CURRENT_CREW_FAILED',
      });
    }
  }

  /**
   * Check vessel access for a user
   */
  static async checkVesselAccess(req: Request, res: Response): Promise<void> {
    try {
      const { userId, vesselId } = req.params;
      const checkDate = req.query.date ? new Date(req.query.date as string) : undefined;

      const hasAccess = await VesselAssignmentService.hasVesselAccess(
        userId,
        vesselId,
        checkDate
      );

      res.json({
        success: true,
        data: {
          hasAccess,
          userId,
          vesselId,
          checkDate,
        },
      });
    } catch (error) {
      logger.error('Error checking vessel access:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check vessel access',
        code: 'CHECK_VESSEL_ACCESS_FAILED',
      });
    }
  }

  /**
   * Get user's accessible vessels
   */
  static async getUserVessels(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const vesselIds = await VesselAssignmentService.getUserVessels(userId);

      res.json({
        success: true,
        data: {
          userId,
          vesselIds,
          count: vesselIds.length,
        },
      });
    } catch (error) {
      logger.error('Error getting user vessels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user vessels',
        code: 'GET_USER_VESSELS_FAILED',
      });
    }
  }

  /**
   * Update vessel assignment
   */
  static async updateAssignment(req: Request, res: Response): Promise<void> {
    try {
      const { assignmentId } = req.params;
      const updates = req.body;

      if (updates.startDate) {
        updates.startDate = new Date(updates.startDate);
      }
      if (updates.endDate) {
        updates.endDate = new Date(updates.endDate);
      }

      const assignment = await VesselAssignmentService.updateAssignment(
        assignmentId,
        updates,
        req.user!.id
      );

      res.json({
        success: true,
        data: assignment,
      });
    } catch (error) {
      logger.error('Error updating vessel assignment:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update vessel assignment',
        code: 'ASSIGNMENT_UPDATE_FAILED',
      });
    }
  }

  /**
   * Deactivate vessel assignment
   */
  static async deactivateAssignment(req: Request, res: Response): Promise<void> {
    try {
      const { assignmentId } = req.params;
      const { reason } = req.body;

      await VesselAssignmentService.deactivateAssignment(
        assignmentId,
        req.user!.id,
        reason
      );

      res.json({
        success: true,
        message: 'Vessel assignment deactivated successfully',
      });
    } catch (error) {
      logger.error('Error deactivating vessel assignment:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate vessel assignment',
        code: 'ASSIGNMENT_DEACTIVATION_FAILED',
      });
    }
  }

  /**
   * Process crew rotation
   */
  static async processCrewRotation(req: Request, res: Response): Promise<void> {
    try {
      const {
        vesselId,
        outgoingUserId,
        incomingUserId,
        rotationDate,
        transferResponsibilities,
        reason,
      } = req.body;

      if (!vesselId || !outgoingUserId || !incomingUserId || !rotationDate || !reason) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: vesselId, outgoingUserId, incomingUserId, rotationDate, reason',
          code: 'MISSING_REQUIRED_FIELDS',
        });
        return;
      }

      const result = await VesselAssignmentService.processCrewRotation(
        {
          vesselId,
          outgoingUserId,
          incomingUserId,
          rotationDate: new Date(rotationDate),
          transferResponsibilities: transferResponsibilities || false,
          reason,
        },
        req.user!.id
      );

      res.json({
        success: true,
        data: result,
        message: 'Crew rotation processed successfully',
      });
    } catch (error) {
      logger.error('Error processing crew rotation:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to process crew rotation',
        code: 'CREW_ROTATION_FAILED',
      });
    }
  }

  /**
   * Grant temporary vessel access
   */
  static async grantTemporaryAccess(req: Request, res: Response): Promise<void> {
    try {
      const {
        userId,
        vesselId,
        reason,
        startDate,
        endDate,
        permissions,
      } = req.body;

      if (!userId || !vesselId || !reason || !startDate || !endDate || !permissions) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: userId, vesselId, reason, startDate, endDate, permissions',
          code: 'MISSING_REQUIRED_FIELDS',
        });
        return;
      }

      const delegation = await VesselAssignmentService.grantTemporaryAccess({
        userId,
        vesselId,
        grantedBy: req.user!.id,
        reason,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        permissions,
      });

      res.status(201).json({
        success: true,
        data: delegation,
        message: 'Temporary access granted successfully',
      });
    } catch (error) {
      logger.error('Error granting temporary access:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to grant temporary access',
        code: 'TEMPORARY_ACCESS_FAILED',
      });
    }
  }

  /**
   * Get crew rotation schedule
   */
  static async getCrewRotationSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Start date and end date are required',
          code: 'DATE_RANGE_REQUIRED',
        });
        return;
      }

      const schedule = await VesselAssignmentService.getCrewRotationSchedule(
        vesselId,
        new Date(startDate as string),
        new Date(endDate as string)
      );

      res.json({
        success: true,
        data: schedule,
      });
    } catch (error) {
      logger.error('Error getting crew rotation schedule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get crew rotation schedule',
        code: 'GET_ROTATION_SCHEDULE_FAILED',
      });
    }
  }

  /**
   * Validate assignment constraints
   */
  static async validateAssignmentConstraints(req: Request, res: Response): Promise<void> {
    try {
      const { vesselId, userId, startDate, endDate } = req.body;

      if (!vesselId || !userId || !startDate) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: vesselId, userId, startDate',
          code: 'MISSING_REQUIRED_FIELDS',
        });
        return;
      }

      const validation = await VesselAssignmentService.validateAssignmentConstraints(
        vesselId,
        userId,
        new Date(startDate),
        endDate ? new Date(endDate) : undefined
      );

      res.json({
        success: true,
        data: validation,
      });
    } catch (error) {
      logger.error('Error validating assignment constraints:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate assignment constraints',
        code: 'VALIDATION_FAILED',
      });
    }
  }

  /**
   * Get assignment history
   */
  static async getAssignmentHistory(req: Request, res: Response): Promise<void> {
    try {
      const { assignmentId } = req.params;

      const history = await VesselAssignmentService.getAssignmentHistory(assignmentId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      logger.error('Error getting assignment history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get assignment history',
        code: 'GET_ASSIGNMENT_HISTORY_FAILED',
      });
    }
  }

  /**
   * Get current user's vessels (convenience endpoint)
   */
  static async getMyVessels(req: Request, res: Response): Promise<void> {
    try {
      const vesselIds = await VesselAssignmentService.getUserVessels(req.user!.id);

      res.json({
        success: true,
        data: {
          userId: req.user!.id,
          vesselIds,
          count: vesselIds.length,
        },
      });
    } catch (error) {
      logger.error('Error getting current user vessels:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get user vessels',
        code: 'GET_MY_VESSELS_FAILED',
      });
    }
  }
}