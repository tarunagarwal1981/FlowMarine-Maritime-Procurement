import { Router } from 'express';
import { purchaseOrderController } from '../controllers/purchaseOrderController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { auditLogger } from '../middleware/auditLogger';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(auditLogger);

// Generate purchase order from approved quote
router.post(
  '/generate',
  rateLimiter('po_generation', 10, 60), // 10 requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'SUPERINTENDENT', 'ADMIN']),
  purchaseOrderController.generatePurchaseOrder
);

// Approve high-value purchase order
router.post(
  '/:id/approve',
  rateLimiter('po_approval', 20, 60), // 20 approvals per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  purchaseOrderController.approvePurchaseOrder
);

// Get purchase order by ID
router.get(
  '/:id',
  rateLimiter('po_read', 100, 60), // 100 reads per minute
  purchaseOrderController.getPurchaseOrderById
);

// Get purchase orders with filtering
router.get(
  '/',
  rateLimiter('po_list', 50, 60), // 50 list requests per minute
  purchaseOrderController.getPurchaseOrders
);

// Get purchase orders for a specific vessel
router.get(
  '/vessel/:vesselId',
  rateLimiter('po_vessel', 50, 60), // 50 vessel requests per minute
  validateVesselAccess,
  purchaseOrderController.getPurchaseOrdersByVessel
);

// Update purchase order status
router.patch(
  '/:id/status',
  rateLimiter('po_update', 30, 60), // 30 updates per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'VESSEL_CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'ADMIN']),
  purchaseOrderController.updatePurchaseOrderStatus
);

// Cancel purchase order
router.post(
  '/:id/cancel',
  rateLimiter('po_cancel', 10, 60), // 10 cancellations per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'SUPERINTENDENT', 'ADMIN']),
  purchaseOrderController.cancelPurchaseOrder
);

// Get purchase order statistics
router.get(
  '/stats/summary',
  rateLimiter('po_stats', 20, 60), // 20 stats requests per minute
  authorizeRole(['PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'SUPERINTENDENT', 'ADMIN']),
  purchaseOrderController.getPurchaseOrderStats
);

export default router;