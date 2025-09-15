import { Router } from 'express';
import { crewRotationController } from '../controllers/crewRotationController.js';
import { authenticateToken } from '../middleware/authentication.js';
import { authorizeRole } from '../middleware/authorization.js';
import { validateVesselAccess } from '../middleware/vesselAccess.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { auditLogger } from '../middleware/auditLogger.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(auditLogger);

// Crew assignment routes
router.post(
  '/assignments',
  rateLimiter('crew', 10, 60), // 10 requests per minute for crew operations
  authorizeRole(['crew:assign', 'vessel:manage', 'admin']),
  crewRotationController.assignCrewToVessel
);

router.patch(
  '/assignments/:assignmentId/end',
  rateLimiter('crew', 10, 60),
  authorizeRole(['crew:assign', 'vessel:manage', 'admin']),
  crewRotationController.endCrewAssignment
);

// Crew rotation routes
router.post(
  '/rotations',
  rateLimiter('crew', 5, 60), // Lower limit for rotation operations
  authorizeRole(['crew:rotate', 'vessel:manage', 'admin']),
  crewRotationController.processCrewRotation
);

router.post(
  '/rotations/check-conflicts',
  rateLimiter('crew', 20, 60),
  authorizeRole(['crew:rotate', 'crew:read', 'vessel:manage', 'admin']),
  crewRotationController.checkRotationConflicts
);

// Responsibility transfer routes
router.post(
  '/responsibilities/transfer',
  rateLimiter('crew', 5, 60),
  authorizeRole(['crew:delegate', 'vessel:manage', 'admin']),
  crewRotationController.transferProcurementResponsibilities
);

// Vessel-specific crew management routes
router.get(
  '/vessels/:vesselId/complement',
  rateLimiter('crew', 30, 60),
  authorizeRole(['crew:read', 'vessel:read', 'admin']),
  validateVesselAccess,
  crewRotationController.getVesselCrewComplement
);

router.get(
  '/vessels/:vesselId/assignments',
  rateLimiter('crew', 30, 60),
  authorizeRole(['crew:read', 'vessel:read', 'admin']),
  validateVesselAccess,
  crewRotationController.getVesselCrewAssignments
);

router.get(
  '/vessels/:vesselId/rotations/upcoming',
  rateLimiter('crew', 30, 60),
  authorizeRole(['crew:read', 'vessel:read', 'admin']),
  validateVesselAccess,
  crewRotationController.getUpcomingRotations
);

router.get(
  '/vessels/:vesselId/rotations/history',
  rateLimiter('crew', 20, 60),
  authorizeRole(['crew:read', 'vessel:read', 'admin']),
  validateVesselAccess,
  crewRotationController.getCrewRotationHistory
);

// User-specific crew routes
router.get(
  '/users/:userId/history',
  rateLimiter('crew', 30, 60),
  authorizeRole(['crew:read', 'admin']),
  crewRotationController.getCrewMemberHistory
);

router.get(
  '/my-assignments',
  rateLimiter('crew', 30, 60),
  crewRotationController.getCurrentUserAssignments
);

export default router;