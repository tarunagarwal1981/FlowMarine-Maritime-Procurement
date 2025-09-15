import { Router } from 'express';
import { workflowController } from '../controllers/workflowController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { auditLogger } from '../middleware/auditLogger';

const router = Router();

// Apply authentication to all workflow routes
router.use(authenticateToken);
router.use(auditLogger);

/**
 * @route GET /api/workflow/requisitions/:requisitionId/evaluate
 * @desc Evaluate workflow for a specific requisition
 * @access Private - Requires vessel access
 */
router.get(
  '/requisitions/:requisitionId/evaluate',
  validateVesselAccess,
  workflowController.evaluateRequisitionWorkflow
);

/**
 * @route POST /api/workflow/requisitions/:requisitionId/process
 * @desc Process workflow decision and create approval records
 * @access Private - Requires vessel access
 */
router.post(
  '/requisitions/:requisitionId/process',
  validateVesselAccess,
  workflowController.processWorkflowDecision
);

/**
 * @route GET /api/workflow/config/approval-thresholds
 * @desc Get current approval thresholds configuration
 * @access Private - Admin or Procurement Manager
 */
router.get(
  '/config/approval-thresholds',
  authorizeRole(['ADMIN', 'PROCUREMENT_MANAGER']),
  workflowController.getApprovalThresholds
);

/**
 * @route PUT /api/workflow/config/approval-thresholds
 * @desc Update approval thresholds configuration
 * @access Private - Admin only
 */
router.put(
  '/config/approval-thresholds',
  authorizeRole(['ADMIN']),
  workflowController.updateApprovalThresholds
);

/**
 * @route GET /api/workflow/config/emergency-bypasses
 * @desc Get emergency bypass rules
 * @access Private - Admin or Procurement Manager
 */
router.get(
  '/config/emergency-bypasses',
  authorizeRole(['ADMIN', 'PROCUREMENT_MANAGER']),
  workflowController.getEmergencyBypasses
);

/**
 * @route PUT /api/workflow/config/emergency-bypasses
 * @desc Update emergency bypass rules
 * @access Private - Admin only
 */
router.put(
  '/config/emergency-bypasses',
  authorizeRole(['ADMIN']),
  workflowController.updateEmergencyBypasses
);

/**
 * @route GET /api/workflow/vessels/:vesselId/budget-hierarchy
 * @desc Get budget hierarchy configuration for a vessel
 * @access Private - Requires vessel access
 */
router.get(
  '/vessels/:vesselId/budget-hierarchy',
  validateVesselAccess,
  workflowController.getBudgetHierarchy
);

/**
 * @route GET /api/workflow/metrics
 * @desc Get workflow statistics and metrics
 * @access Private - Admin, Procurement Manager, or Superintendent
 */
router.get(
  '/metrics',
  authorizeRole(['ADMIN', 'PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  workflowController.getWorkflowMetrics
);

export default router;