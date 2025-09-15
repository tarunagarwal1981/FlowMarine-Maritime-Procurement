import { Router } from 'express';
import { vendorController } from '../controllers/vendorController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { auditLogger } from '../middleware/auditLogger';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all vendor routes
router.use(authenticateToken);
router.use(auditLogger);

// Vendor registration and management routes
router.post(
  '/',
  rateLimiter('vendor_registration', 10, 60), // 10 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  vendorController.registerVendor
);

router.get(
  '/',
  rateLimiter('vendor_search', 100, 60), // 100 requests per minute
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  vendorController.getAllVendors
);

router.get(
  '/search',
  rateLimiter('vendor_search', 100, 60),
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  vendorController.searchVendors
);

router.get(
  '/location-capabilities',
  rateLimiter('vendor_search', 100, 60),
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  vendorController.getVendorsByLocationAndCapabilities
);

router.get(
  '/certifications/expiring',
  rateLimiter('vendor_search', 50, 60),
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  vendorController.getExpiringCertifications
);

router.get(
  '/:id',
  rateLimiter('vendor_details', 200, 60), // 200 requests per minute
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  vendorController.getVendorById
);

router.put(
  '/:id',
  rateLimiter('vendor_update', 20, 60), // 20 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  vendorController.updateVendor
);

router.patch(
  '/:id/performance',
  rateLimiter('vendor_performance', 50, 60), // 50 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  vendorController.updateVendorPerformance
);

router.patch(
  '/:id/approval',
  rateLimiter('vendor_approval', 20, 60), // 20 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  vendorController.updateVendorApprovalStatus
);

router.patch(
  '/:id/deactivate',
  rateLimiter('vendor_status', 20, 60), // 20 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  vendorController.deactivateVendor
);

router.patch(
  '/:id/reactivate',
  rateLimiter('vendor_status', 20, 60), // 20 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'ADMIN']),
  vendorController.reactivateVendor
);

router.get(
  '/:id/performance-stats',
  rateLimiter('vendor_stats', 100, 60), // 100 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  vendorController.getVendorPerformanceStats
);

export default router;