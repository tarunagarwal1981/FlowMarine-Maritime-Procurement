import { Router } from 'express';
import { rfqController } from '../controllers/rfqController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { auditLogger } from '../middleware/auditLogger';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all RFQ routes
router.use(authenticateToken);
router.use(auditLogger);

// RFQ creation and management routes
router.post(
  '/',
  rateLimiter('rfq_creation', 20, 60), // 20 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  rfqController.createRFQFromRequisition
);

router.get(
  '/',
  rateLimiter('rfq_list', 100, 60), // 100 requests per minute
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  rfqController.getRFQs
);

router.get(
  '/statistics',
  rateLimiter('rfq_stats', 50, 60), // 50 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  rfqController.getRFQStatistics
);

router.get(
  '/:id',
  rateLimiter('rfq_details', 200, 60), // 200 requests per minute
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  rfqController.getRFQById
);

router.put(
  '/:id',
  rateLimiter('rfq_update', 30, 60), // 30 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  rfqController.updateRFQ
);

router.post(
  '/:id/select-vendors',
  rateLimiter('vendor_selection', 50, 60), // 50 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  rfqController.selectVendorsForRFQ
);

router.post(
  '/:id/distribute',
  rateLimiter('rfq_distribution', 20, 60), // 20 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  rfqController.distributeRFQ
);

router.patch(
  '/:id/cancel',
  rateLimiter('rfq_cancel', 20, 60), // 20 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  rfqController.cancelRFQ
);

// Auto-generation route for approved requisitions
router.post(
  '/auto-generate/:requisitionId',
  rateLimiter('rfq_auto_generate', 10, 60), // 10 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  rfqController.autoGenerateRFQ
);

export default router;