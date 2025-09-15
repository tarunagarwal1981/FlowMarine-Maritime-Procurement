import { Router } from 'express';
import { vesselController } from '../controllers/vesselController.js';
import { authenticateToken } from '../middleware/authentication.js';
import { authorizeRole } from '../middleware/authorization.js';
import { validateVesselAccess } from '../middleware/vesselAccess.js';
import { rateLimiter } from '../middleware/rateLimiter.js';
import { auditLogger } from '../middleware/auditLogger.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(auditLogger);

// Vessel management routes
router.post(
  '/',
  rateLimiter('vessel', 10, 60), // 10 requests per minute for vessel operations
  authorizeRole(['vessel:create', 'admin']),
  vesselController.createVessel
);

router.get(
  '/',
  rateLimiter('vessel', 30, 60), // 30 requests per minute for vessel queries
  authorizeRole(['vessel:read', 'admin']),
  vesselController.getVessels
);

router.get(
  '/my-vessels',
  rateLimiter('vessel', 30, 60),
  vesselController.getUserVessels
);

router.get(
  '/certificates/expiring',
  rateLimiter('vessel', 10, 60),
  authorizeRole(['vessel:read', 'certificate:read', 'admin']),
  vesselController.getExpiringCertificates
);

router.get(
  '/:id',
  rateLimiter('vessel', 30, 60),
  authorizeRole(['vessel:read', 'admin']),
  validateVesselAccess,
  vesselController.getVesselById
);

router.get(
  '/imo/:imoNumber',
  rateLimiter('vessel', 30, 60),
  authorizeRole(['vessel:read', 'admin']),
  vesselController.getVesselByImoNumber
);

router.put(
  '/:id',
  rateLimiter('vessel', 10, 60),
  authorizeRole(['vessel:update', 'admin']),
  validateVesselAccess,
  vesselController.updateVessel
);

router.patch(
  '/:id/position',
  rateLimiter('position', 60, 60), // Higher limit for position updates (real-time tracking)
  authorizeRole(['vessel:update', 'position:update', 'admin']),
  validateVesselAccess,
  vesselController.updateVesselPosition
);

router.patch(
  '/:id/voyage',
  rateLimiter('vessel', 10, 60),
  authorizeRole(['vessel:update', 'voyage:update', 'admin']),
  validateVesselAccess,
  vesselController.updateVesselVoyage
);

router.delete(
  '/:id',
  rateLimiter('vessel', 5, 60), // Lower limit for deletion operations
  authorizeRole(['vessel:delete', 'admin']),
  validateVesselAccess,
  vesselController.deactivateVessel
);

// Certificate management routes
router.post(
  '/:id/certificates',
  rateLimiter('vessel', 10, 60),
  authorizeRole(['certificate:create', 'vessel:update', 'admin']),
  validateVesselAccess,
  vesselController.addVesselCertificate
);

router.put(
  '/:id/certificates/:certificateId',
  rateLimiter('vessel', 10, 60),
  authorizeRole(['certificate:update', 'vessel:update', 'admin']),
  validateVesselAccess,
  vesselController.updateVesselCertificate
);

// Specification management routes
router.post(
  '/:id/specifications',
  rateLimiter('vessel', 10, 60),
  authorizeRole(['specification:create', 'vessel:update', 'admin']),
  validateVesselAccess,
  vesselController.addVesselSpecification
);

router.put(
  '/:id/specifications/:specificationId',
  rateLimiter('vessel', 10, 60),
  authorizeRole(['specification:update', 'vessel:update', 'admin']),
  validateVesselAccess,
  vesselController.updateVesselSpecification
);

router.delete(
  '/:id/specifications/:specificationId',
  rateLimiter('vessel', 5, 60),
  authorizeRole(['specification:delete', 'vessel:update', 'admin']),
  validateVesselAccess,
  vesselController.deleteVesselSpecification
);

export default router;