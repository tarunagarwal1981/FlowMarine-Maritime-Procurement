import { Request, Response, NextFunction } from 'express';
import { crewRotationService } from '../services/crewRotationService.js';
import { logger } from '../utils/logger.js';
import { z } from 'zod';

// Validation schemas
const assignCrewSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  vesselId: z.string().min(1, 'Vessel ID is required'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

const endAssignmentSchema = z.object({
  endDate: z.string().datetime(),
});

const rotationScheduleSchema = z.object({
  vesselId: z.string().min(1, 'Vessel ID is required'),
  outgoingUserId: z.string().min(1, 'Outgoing user ID is required'),
  incomingUserId: z.string().min(1, 'Incoming user ID is required'),
  rotationDate: z.string().datetime(),
  transferResponsibilities: z.boolean().default(true),
  notes: z.string().optional(),
});

const responsibilityTransferSchema = z.object({
  fromUserId: z.string().min(1, 'From user ID is required'),
  toUserId: z.string().min(1, 'To user ID is required'),
  vesselId: z.string().min(1, 'Vessel ID is required'),
  permissions: z.array(z.string()).min(1, 'At least one permission is required'),
  reason: z.string().min(1, 'Reason is required'),
  effectiveDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional(),
});

class CrewRotationController {
  /**
   * Assign crew member to vessel
   */
  async assignCrewToVessel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = assignCrewSchema.parse(req.body);

      const assignmentData = {
        ...validatedData,
        startDate: new Date(validatedData.startDate),
        endDate: validatedData.endDate ? new Date(validatedData.endDate) : undefined,
      };

      const assignment = await crewRotationService.assignCrewToVessel(assignmentData, req.user!.id);

      res.status(201).json({
        success: true,
        data: assignment,
        message: 'Crew member assigned to vessel successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * End crew assignment
   */
  async endCrewAssignment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { assignmentId } = req.params;
      const validatedData = endAssignmentSchema.parse(req.body);

      const assignment = await crewRotationService.endCrewAssignment(
        assignmentId,
        new Date(validatedData.endDate),
        req.user!.id
      );

      res.json({
        success: true,
        data: assignment,
        message: 'Crew assignment ended successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Process crew rotation
   */
  async processCrewRotation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = rotationScheduleSchema.parse(req.body);

      const rotationData = {
        ...validatedData,
        rotationDate: new Date(validatedData.rotationDate),
      };

      // Check for conflicts first
      const conflictCheck = await crewRotationService.checkRotationConflicts(rotationData);
      if (conflictCheck.hasConflicts) {
        res.status(400).json({
          success: false,
          error: 'Rotation conflicts detected',
          conflicts: conflictCheck.conflicts,
        });
        return;
      }

      const result = await crewRotationService.processCrewRotation(rotationData, req.user!.id);

      res.json({
        success: true,
        data: result,
        message: 'Crew rotation processed successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Check rotation conflicts
   */
  async checkRotationConflicts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = rotationScheduleSchema.parse(req.body);

      const rotationData = {
        ...validatedData,
        rotationDate: new Date(validatedData.rotationDate),
      };

      const conflictCheck = await crewRotationService.checkRotationConflicts(rotationData);

      res.json({
        success: true,
        data: conflictCheck,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get vessel crew complement
   */
  async getVesselCrewComplement(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vesselId } = req.params;
      const complement = await crewRotationService.getVesselCrewComplement(vesselId);

      res.json({
        success: true,
        data: complement,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get upcoming rotations
   */
  async getUpcomingRotations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { days = '30' } = req.query;

      const rotations = await crewRotationService.getUpcomingRotations(
        vesselId,
        parseInt(days as string)
      );

      res.json({
        success: true,
        data: rotations,
        message: `Found ${rotations.length} upcoming rotations within ${days} days`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Transfer procurement responsibilities
   */
  async transferProcurementResponsibilities(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const validatedData = responsibilityTransferSchema.parse(req.body);

      const transferData = {
        ...validatedData,
        effectiveDate: new Date(validatedData.effectiveDate),
        expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : undefined,
      };

      const delegation = await crewRotationService.transferProcurementResponsibilities(
        transferData,
        req.user!.id
      );

      res.status(201).json({
        success: true,
        data: delegation,
        message: 'Procurement responsibilities transferred successfully',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Get crew rotation history
   */
  async getCrewRotationHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { limit = '50' } = req.query;

      const history = await crewRotationService.getCrewRotationHistory(
        vesselId,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get crew member assignment history
   */
  async getCrewMemberHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const { limit = '20' } = req.query;

      const history = await crewRotationService.getCrewMemberHistory(
        userId,
        parseInt(limit as string)
      );

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user's vessel assignments
   */
  async getCurrentUserAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const history = await crewRotationService.getCrewMemberHistory(req.user!.id, 10);
      
      // Filter for active assignments
      const activeAssignments = history.filter(assignment => assignment.isActive);

      res.json({
        success: true,
        data: {
          active: activeAssignments,
          recent: history.slice(0, 5),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get crew assignments for a vessel
   */
  async getVesselCrewAssignments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vesselId } = req.params;
      const { active = 'true' } = req.query;

      const history = await crewRotationService.getCrewRotationHistory(vesselId, 100);
      
      let assignments = history;
      if (active === 'true') {
        assignments = history.filter(assignment => assignment.isActive);
      }

      res.json({
        success: true,
        data: assignments,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const crewRotationController = new CrewRotationController();