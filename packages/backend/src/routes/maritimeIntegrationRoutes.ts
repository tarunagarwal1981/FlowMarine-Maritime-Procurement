import { Router } from 'express';
import { maritimeIntegrationController } from '../controllers/maritimeIntegrationController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// AIS/GPS Integration Routes
router.get(
  '/vessels/:vesselId/position',
  validateVesselAccess,
  rateLimiter('vessel'),
  maritimeIntegrationController.getVesselPosition
);

// IMPA/ISSA Catalog Integration Routes
router.get(
  '/catalog/search',
  rateLimiter('shore'),
  maritimeIntegrationController.searchCatalog
);

router.get(
  '/catalog/items/:code',
  rateLimiter('shore'),
  maritimeIntegrationController.getCatalogItem
);

router.post(
  '/catalog/sync',
  authorizeRole(['ADMIN', 'PROCUREMENT_MANAGER']),
  rateLimiter('shore'),
  maritimeIntegrationController.syncCatalogUpdates
);

// Port Database Integration Routes
router.get(
  '/ports/search',
  rateLimiter('shore'),
  maritimeIntegrationController.searchPorts
);

router.get(
  '/ports/:portCode',
  rateLimiter('shore'),
  maritimeIntegrationController.getPortDetails
);

router.get(
  '/ports/nearest',
  rateLimiter('shore'),
  maritimeIntegrationController.findNearestPorts
);

router.post(
  '/ports/coordinate-delivery',
  authorizeRole(['PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  rateLimiter('shore'),
  maritimeIntegrationController.coordinateDelivery
);

router.get(
  '/ports/customs-requirements',
  rateLimiter('shore'),
  maritimeIntegrationController.getCustomsRequirements
);

router.get(
  '/ports/transit-time',
  rateLimiter('shore'),
  maritimeIntegrationController.calculateTransitTime
);

// Vessel Management System Integration Routes
router.get(
  '/vessels/:vesselId/vms-data',
  validateVesselAccess,
  rateLimiter('vessel'),
  maritimeIntegrationController.getVesselManagementData
);

router.get(
  '/vessels/:vesselId/crew-manifest',
  validateVesselAccess,
  authorizeRole(['CAPTAIN', 'CHIEF_ENGINEER', 'SUPERINTENDENT']),
  rateLimiter('vessel'),
  maritimeIntegrationController.getCrewManifest
);

router.get(
  '/vessels/:vesselId/maintenance-schedule',
  validateVesselAccess,
  authorizeRole(['CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT']),
  rateLimiter('vessel'),
  maritimeIntegrationController.getMaintenanceSchedule
);

router.get(
  '/vessels/:vesselId/integrated-dashboard',
  validateVesselAccess,
  authorizeRole(['CAPTAIN', 'CHIEF_ENGINEER', 'SUPERINTENDENT']),
  rateLimiter('vessel'),
  maritimeIntegrationController.getIntegratedDashboard
);

router.post(
  '/vessels/:vesselId/sync-procurement',
  validateVesselAccess,
  authorizeRole(['PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  rateLimiter('shore'),
  maritimeIntegrationController.syncProcurementData
);

export { router as maritimeIntegrationRoutes };