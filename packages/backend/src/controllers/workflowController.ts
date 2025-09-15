import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { workflowEngine } from '../services/workflowEngine';
import { ApprovalThreshold, EmergencyBypass } from '../models/WorkflowRule';
import { AuditService } from '../services/auditService';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class WorkflowController {
  
  /**
   * Evaluate workflow for a specific requisition
   */
  async evaluateRequisitionWorkflow(req: Request, res: Response) {
    try {
      const { requisitionId } = req.params;
      
      const requisition = await prisma.requisition.findUnique({
        where: { id: requisitionId },
        include: {
          vessel: true,
          requestedBy: true,
          items: {
            include: {
              itemCatalog: {
                select: {
                  criticalityLevel: true,
                  category: true
                }
              }
            }
          }
        }
      });

      if (!requisition) {
        return res.status(404).json({
          success: false,
          error: 'Requisition not found'
        });
      }

      const decision = await workflowEngine.evaluateRequisition(requisition);
      
      // Log the evaluation
      await AuditService.logAction(
        req.user.id,
        'APPROVE',
        'requisition',
        requisitionId,
        null,
        { decision }
      );

      res.json({
        success: true,
        data: {
          requisitionId,
          decision
        }
      });

    } catch (error) {
      logger.error('Error evaluating requisition workflow:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to evaluate workflow'
      });
    }
  }

  /**
   * Process workflow decision and create approval records
   */
  async processWorkflowDecision(req: Request, res: Response) {
    try {
      const { requisitionId } = req.params;
      
      const requisition = await prisma.requisition.findUnique({
        where: { id: requisitionId },
        include: {
          vessel: true,
          requestedBy: true,
          items: {
            include: {
              itemCatalog: {
                select: {
                  criticalityLevel: true,
                  category: true
                }
              }
            }
          }
        }
      });

      if (!requisition) {
        return res.status(404).json({
          success: false,
          error: 'Requisition not found'
        });
      }

      // Evaluate workflow
      const decision = await workflowEngine.evaluateRequisition(requisition);
      
      // Create approval workflow
      await workflowEngine.createApprovalWorkflow(requisitionId, decision);

      // Update requisition status
      const newStatus = decision.autoApprove ? 'APPROVED' : 'UNDER_REVIEW';
      
      await prisma.requisition.update({
        where: { id: requisitionId },
        data: { 
          status: newStatus,
          emergencyOverride: decision.emergencyBypass || false
        }
      });

      // Log the processing
      await AuditService.logAction(
        req.user.id,
        'UPDATE',
        'requisition',
        requisitionId,
        { status: requisition.status },
        { status: newStatus, decision }
      );

      res.json({
        success: true,
        data: {
          requisitionId,
          decision,
          newStatus
        }
      });

    } catch (error) {
      logger.error('Error processing workflow decision:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process workflow decision'
      });
    }
  }

  /**
   * Get current approval thresholds configuration
   */
  async getApprovalThresholds(req: Request, res: Response) {
    try {
      // In production, these would be stored in database
      const thresholds = [
        {
          minAmount: 0,
          maxAmount: 500,
          currency: 'USD',
          requiredRole: 'AUTO_APPROVE',
          approverLevel: 0,
          budgetHierarchy: 'VESSEL',
          costCenterRequired: false
        },
        {
          minAmount: 500,
          maxAmount: 5000,
          currency: 'USD',
          requiredRole: 'SUPERINTENDENT',
          approverLevel: 1,
          budgetHierarchy: 'VESSEL',
          costCenterRequired: true
        },
        {
          minAmount: 5000,
          maxAmount: 25000,
          currency: 'USD',
          requiredRole: 'PROCUREMENT_MANAGER',
          approverLevel: 2,
          budgetHierarchy: 'FLEET',
          costCenterRequired: true
        },
        {
          minAmount: 25000,
          maxAmount: Number.MAX_SAFE_INTEGER,
          currency: 'USD',
          requiredRole: 'FINANCE_TEAM',
          approverLevel: 3,
          budgetHierarchy: 'COMPANY',
          costCenterRequired: true
        }
      ];

      res.json({
        success: true,
        data: thresholds
      });

    } catch (error) {
      logger.error('Error getting approval thresholds:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get approval thresholds'
      });
    }
  }

  /**
   * Update approval thresholds configuration
   */
  async updateApprovalThresholds(req: Request, res: Response) {
    try {
      const { thresholds } = req.body;

      if (!Array.isArray(thresholds)) {
        return res.status(400).json({
          success: false,
          error: 'Thresholds must be an array'
        });
      }

      // Validate threshold structure
      for (const threshold of thresholds) {
        if (!threshold.minAmount || !threshold.maxAmount || !threshold.requiredRole) {
          return res.status(400).json({
            success: false,
            error: 'Invalid threshold structure'
          });
        }
      }

      await workflowEngine.updateApprovalThresholds(thresholds);

      // Log the configuration change
      await AuditService.logAction(
        req.user.id,
        'UPDATE',
        'workflow_config',
        'approval_thresholds',
        null,
        { thresholds }
      );

      res.json({
        success: true,
        message: 'Approval thresholds updated successfully'
      });

    } catch (error) {
      logger.error('Error updating approval thresholds:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update approval thresholds'
      });
    }
  }

  /**
   * Get emergency bypass rules
   */
  async getEmergencyBypasses(req: Request, res: Response) {
    try {
      const bypasses = [
        {
          urgencyLevel: 'EMERGENCY',
          criticalityLevel: 'SAFETY_CRITICAL',
          allowedRoles: ['CAPTAIN', 'CHIEF_ENGINEER'],
          requiresPostApproval: true,
          expirationHours: 24
        },
        {
          urgencyLevel: 'EMERGENCY',
          criticalityLevel: 'OPERATIONAL_CRITICAL',
          allowedRoles: ['CAPTAIN', 'CHIEF_ENGINEER', 'SUPERINTENDENT'],
          requiresPostApproval: true,
          maxAmount: 10000,
          expirationHours: 12
        },
        {
          urgencyLevel: 'URGENT',
          criticalityLevel: 'SAFETY_CRITICAL',
          allowedRoles: ['CAPTAIN', 'CHIEF_ENGINEER'],
          requiresPostApproval: false,
          maxAmount: 5000,
          expirationHours: 6
        }
      ];

      res.json({
        success: true,
        data: bypasses
      });

    } catch (error) {
      logger.error('Error getting emergency bypasses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get emergency bypasses'
      });
    }
  }

  /**
   * Update emergency bypass rules
   */
  async updateEmergencyBypasses(req: Request, res: Response) {
    try {
      const { bypasses } = req.body;

      if (!Array.isArray(bypasses)) {
        return res.status(400).json({
          success: false,
          error: 'Bypasses must be an array'
        });
      }

      await workflowEngine.updateEmergencyBypasses(bypasses);

      // Log the configuration change
      await AuditService.logAction(
        req.user.id,
        'UPDATE',
        'workflow_config',
        'emergency_bypasses',
        null,
        { bypasses }
      );

      res.json({
        success: true,
        message: 'Emergency bypasses updated successfully'
      });

    } catch (error) {
      logger.error('Error updating emergency bypasses:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update emergency bypasses'
      });
    }
  }

  /**
   * Get budget hierarchy configuration
   */
  async getBudgetHierarchy(req: Request, res: Response) {
    try {
      const { vesselId } = req.params;

      const vessel = await prisma.vessel.findUnique({
        where: { id: vesselId },
        include: {
          budgets: {
            where: {
              startDate: { lte: new Date() },
              endDate: { gte: new Date() }
            }
          }
        }
      });

      if (!vessel) {
        return res.status(404).json({
          success: false,
          error: 'Vessel not found'
        });
      }

      // Get current budget period
      const currentPeriod = this.getCurrentBudgetPeriod();
      
      const budgetHierarchy = {
        vessel: {
          level: 'VESSEL',
          budgets: vessel.budgets,
          approvalRequired: false
        },
        fleet: {
          level: 'FLEET',
          parentLevel: 'COMPANY',
          approvalRequired: true,
          approverRole: 'PROCUREMENT_MANAGER'
        },
        company: {
          level: 'COMPANY',
          approvalRequired: true,
          approverRole: 'FINANCE_TEAM'
        }
      };

      res.json({
        success: true,
        data: budgetHierarchy
      });

    } catch (error) {
      logger.error('Error getting budget hierarchy:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get budget hierarchy'
      });
    }
  }

  /**
   * Get workflow statistics and metrics
   */
  async getWorkflowMetrics(req: Request, res: Response) {
    try {
      const { startDate, endDate, vesselId } = req.query;

      const whereClause: any = {};
      
      if (startDate && endDate) {
        whereClause.createdAt = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string)
        };
      }

      if (vesselId) {
        whereClause.vesselId = vesselId;
      }

      // Get approval statistics
      const approvalStats = await prisma.approval.groupBy({
        by: ['status'],
        where: {
          requisition: whereClause
        },
        _count: {
          id: true
        }
      });

      // Get emergency override statistics
      const emergencyStats = await prisma.requisition.groupBy({
        by: ['emergencyOverride'],
        where: whereClause,
        _count: {
          id: true
        }
      });

      // Get average approval time
      const avgApprovalTime = await prisma.approval.aggregate({
        where: {
          status: 'APPROVED',
          approvedAt: { not: null },
          requisition: whereClause
        },
        _avg: {
          // This would need a calculated field for approval time
          // For now, returning null
        }
      });

      const metrics = {
        approvalStats: approvalStats.map(stat => ({
          status: stat.status,
          count: stat._count.id
        })),
        emergencyStats: emergencyStats.map(stat => ({
          emergencyOverride: stat.emergencyOverride,
          count: stat._count.id
        })),
        averageApprovalTimeHours: null // TODO: Calculate actual approval time
      };

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Error getting workflow metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get workflow metrics'
      });
    }
  }

  private getCurrentBudgetPeriod(): string {
    const now = new Date();
    const year = now.getFullYear();
    const quarter = Math.ceil((now.getMonth() + 1) / 3);
    return `${year}-Q${quarter}`;
  }
}

export const workflowController = new WorkflowController();