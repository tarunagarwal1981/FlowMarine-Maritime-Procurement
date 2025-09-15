import { Router } from 'express';
import { emergencyOverrideController } from '../controllers/emergencyOverrideController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { auditLogger } from '../middleware/auditLogger';

const router = Router();

// Apply authentication to all emergency override routes
router.use(authenticateToken);
router.use(auditLogger);

/**
 * @route POST /api/emergency-overrides
 * @desc Create an emergency override
 * @access Private - Captain, Chief Engineer, or Superintendent
 */
router.post(
  '/',
  authorizeRole(['CAPTAIN', 'CHIEF_ENGINEER', 'SUPERINTENDENT']),
  validateVesselAccess,
  emergencyOverrideController.createEmergencyOverride
);

/**
 * @route POST /api/emergency-overrides/:overrideId/approve
 * @desc Approve an emergency override (post-approval)
 * @access Private - Requires appropriate authority level
 */
router.post(
  '/:overrideId/approve',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  emergencyOverrideController.approveEmergencyOverride
);

/**
 * @route POST /api/emergency-overrides/:overrideId/deactivate
 * @desc Deactivate an emergency override
 * @access Private - Override creator or higher authority
 */
router.post(
  '/:overrideId/deactivate',
  emergencyOverrideController.deactivateEmergencyOverride
);

/**
 * @route GET /api/emergency-overrides/my-active
 * @desc Get active emergency overrides for current user
 * @access Private
 */
router.get(
  '/my-active',
  emergencyOverrideController.getMyActiveOverrides
);

/**
 * @route GET /api/emergency-overrides/requiring-approval
 * @desc Get emergency overrides requiring post-approval
 * @access Private - Superintendent, Procurement Manager, Finance Team, Admin
 */
router.get(
  '/requiring-approval',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  emergencyOverrideController.getOverridesRequiringApproval
);

/**
 * @route GET /api/emergency-overrides/check/:vesselId
 * @desc Check if user has active emergency override for vessel
 * @access Private - Requires vessel access
 */
router.get(
  '/check/:vesselId',
  validateVesselAccess,
  emergencyOverrideController.checkActiveOverride
);

/**
 * @route GET /api/emergency-overrides/history/:vesselId
 * @desc Get emergency override history for a vessel
 * @access Private - Requires vessel access
 */
router.get(
  '/history/:vesselId',
  validateVesselAccess,
  authorizeRole(['CAPTAIN', 'CHIEF_ENGINEER', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN']),
  emergencyOverrideController.getOverrideHistory
);

/**
 * @route POST /api/emergency-overrides/cleanup-expired
 * @desc Clean up expired emergency overrides
 * @access Private - Admin only
 */
router.post(
  '/cleanup-expired',
  authorizeRole(['ADMIN']),
  emergencyOverrideController.cleanupExpiredOverrides
);

export default router;