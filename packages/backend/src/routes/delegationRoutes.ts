import { Router } from 'express';
import { delegationController } from '../controllers/delegationController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { auditLogger } from '../middleware/auditLogger';

const router = Router();

// Apply authentication to all delegation routes
router.use(authenticateToken);
router.use(auditLogger);

/**
 * @route POST /api/delegations
 * @desc Create a new delegation
 * @access Private - Users can delegate their own permissions
 */
router.post(
  '/',
  delegationController.createDelegation
);

/**
 * @route POST /api/delegations/transfer-responsibilities
 * @desc Transfer responsibilities during crew rotation
 * @access Private - Users can transfer their responsibilities
 */
router.post(
  '/transfer-responsibilities',
  delegationController.transferResponsibilities
);

/**
 * @route POST /api/delegations/escalate-overdue
 * @desc Escalate overdue approvals
 * @access Private - Superintendent, Procurement Manager, Admin
 */
router.post(
  '/escalate-overdue',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN']),
  delegationController.escalateOverdueApprovals
);

/**
 * @route GET /api/delegations/:delegationId
 * @desc Get delegation by ID
 * @access Private - Delegator, delegate, or admin
 */
router.get(
  '/:delegationId',
  delegationController.getDelegationById
);

/**
 * @route GET /api/delegations/my/given
 * @desc Get delegations where current user is delegator
 * @access Private
 */
router.get(
  '/my/given',
  delegationController.getMyDelegations
);

/**
 * @route GET /api/delegations/my/received
 * @desc Get delegations where current user is delegate
 * @access Private
 */
router.get(
  '/my/received',
  delegationController.getDelegationsToMe
);

/**
 * @route PUT /api/delegations/:delegationId
 * @desc Update a delegation
 * @access Private - Delegator or admin
 */
router.put(
  '/:delegationId',
  delegationController.updateDelegation
);

/**
 * @route POST /api/delegations/:delegationId/deactivate
 * @desc Deactivate a delegation
 * @access Private - Delegator or admin
 */
router.post(
  '/:delegationId/deactivate',
  delegationController.deactivateDelegation
);

/**
 * @route GET /api/delegations/permissions/check/:permission
 * @desc Check if user has specific permission (including delegated)
 * @access Private
 */
router.get(
  '/permissions/check/:permission',
  delegationController.checkPermission
);

/**
 * @route GET /api/delegations/permissions/my
 * @desc Get all permissions for current user (including delegated)
 * @access Private
 */
router.get(
  '/permissions/my',
  delegationController.getMyPermissions
);

/**
 * @route POST /api/delegations/cleanup-expired
 * @desc Clean up expired delegations
 * @access Private - Admin only
 */
router.post(
  '/cleanup-expired',
  authorizeRole(['ADMIN']),
  delegationController.cleanupExpiredDelegations
);

export default router;