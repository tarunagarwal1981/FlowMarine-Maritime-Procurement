import { Router } from 'express';
import { deliveryController } from '../controllers/deliveryController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { auditLogger } from '../middleware/auditLogger';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(auditLogger);

// Create delivery schedule
router.post(
  '/',
  rateLimiter('delivery_create', 20, 60), // 20 creations per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'ADMIN']),
  deliveryController.createDelivery
);

// Update delivery status and tracking
router.patch(
  '/:id',
  rateLimiter('delivery_update', 50, 60), // 50 updates per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'ADMIN']),
  deliveryController.updateDelivery
);

// Confirm delivery with photo documentation
router.post(
  '/:id/confirm',
  rateLimiter('delivery_confirm', 30, 60), // 30 confirmations per minute
  authorizeRole(['VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'PROCUREMENT_MANAGER', 'ADMIN']),
  deliveryController.confirmDelivery
);

// Get delivery tracking information
router.get(
  '/:id/tracking',
  rateLimiter('delivery_tracking', 100, 60), // 100 tracking requests per minute
  deliveryController.getDeliveryTracking
);

// Get delivery by ID
router.get(
  '/:id',
  rateLimiter('delivery_read', 100, 60), // 100 reads per minute
  deliveryController.getDeliveryById
);

// Get all deliveries with filtering
router.get(
  '/',
  rateLimiter('delivery_list', 50, 60), // 50 list requests per minute
  deliveryController.getDeliveries
);

// Get deliveries for a specific vessel
router.get(
  '/vessel/:vesselId',
  rateLimiter('delivery_vessel', 50, 60), // 50 vessel requests per minute
  validateVesselAccess,
  deliveryController.getDeliveriesByVessel
);

// Cancel delivery
router.post(
  '/:id/cancel',
  rateLimiter('delivery_cancel', 10, 60), // 10 cancellations per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'SUPERINTENDENT', 'ADMIN']),
  deliveryController.cancelDelivery
);

// Calculate estimated delivery time
router.get(
  '/estimate/delivery-time',
  rateLimiter('delivery_estimate', 30, 60), // 30 estimates per minute
  deliveryController.calculateDeliveryTime
);

// Get port information
router.get(
  '/ports/:portCode',
  rateLimiter('port_info', 50, 60), // 50 port info requests per minute
  deliveryController.getPortInfo
);

// Search ports
router.get(
  '/ports/search/query',
  rateLimiter('port_search', 30, 60), // 30 searches per minute
  deliveryController.searchPorts
);

// Get delivery statistics
router.get(
  '/stats/summary',
  rateLimiter('delivery_stats', 20, 60), // 20 stats requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'SUPERINTENDENT', 'ADMIN']),
  deliveryController.getDeliveryStats
);

export default router;