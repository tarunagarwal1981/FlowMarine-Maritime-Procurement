/**
 * Requisition Routes
 * Defines API endpoints for requisition management
 */

import { Router } from 'express';
import { requisitionController } from '../controllers/requisitionController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { rateLimiter } from '../middleware/rateLimiter';
import { auditLogger } from '../middleware/auditLogger';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Apply audit logging to all routes
router.use(auditLogger);

/**
 * @route   POST /api/requisitions
 * @desc    Create a new requisition
 * @access  Private (Vessel Crew, Chief Engineer, Captain)
 */
router.post(
  '/',
  rateLimiter('requisition_create', 10, 60), // 10 requests per minute
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT']),
  requisitionController.createRequisition
);

/**
 * @route   GET /api/requisitions
 * @desc    Get requisitions with filtering and pagination
 * @access  Private (All authenticated users)
 */
router.get(
  '/',
  rateLimiter('requisition_read', 100, 60), // 100 requests per minute
  requisitionController.getRequisitions
);

/**
 * @route   GET /api/requisitions/stats
 * @desc    Get requisition statistics
 * @access  Private (All authenticated users)
 */
router.get(
  '/stats',
  rateLimiter('requisition_read', 100, 60),
  requisitionController.getRequisitionStats
);

/**
 * @route   POST /api/requisitions/validate
 * @desc    Validate requisition data without creating
 * @access  Private (Vessel Crew, Chief Engineer, Captain)
 */
router.post(
  '/validate',
  rateLimiter('requisition_validate', 20, 60), // 20 requests per minute
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT']),
  requisitionController.validateRequisition
);

/**
 * @route   POST /api/requisitions/sync
 * @desc    Sync offline requisitions
 * @access  Private (Vessel Crew, Chief Engineer, Captain)
 */
router.post(
  '/sync',
  rateLimiter('requisition_sync', 5, 60), // 5 requests per minute
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT']),
  requisitionController.syncOfflineRequisitions
);

/**
 * @route   GET /api/requisitions/:id
 * @desc    Get a single requisition by ID
 * @access  Private (All authenticated users)
 */
router.get(
  '/:id',
  rateLimiter('requisition_read', 100, 60),
  requisitionController.getRequisition
);

/**
 * @route   PUT /api/requisitions/:id
 * @desc    Update a requisition (only DRAFT status)
 * @access  Private (Vessel Crew, Chief Engineer, Captain)
 */
router.put(
  '/:id',
  rateLimiter('requisition_update', 20, 60), // 20 requests per minute
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT']),
  requisitionController.updateRequisition
);

/**
 * @route   POST /api/requisitions/:id/submit
 * @desc    Submit a requisition for approval
 * @access  Private (Vessel Crew, Chief Engineer, Captain)
 */
router.post(
  '/:id/submit',
  rateLimiter('requisition_submit', 10, 60), // 10 requests per minute
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT']),
  requisitionController.submitRequisition
);

/**
 * @route   DELETE /api/requisitions/:id
 * @desc    Delete a requisition (only DRAFT status)
 * @access  Private (Vessel Crew, Chief Engineer, Captain)
 */
router.delete(
  '/:id',
  rateLimiter('requisition_delete', 10, 60), // 10 requests per minute
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT']),
  requisitionController.deleteRequisition
);

export { router as requisitionRoutes };