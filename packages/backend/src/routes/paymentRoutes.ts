import { Router } from 'express';
import { paymentController } from '../controllers/paymentController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { auditLogger } from '../middleware/auditLogger';
import { rateLimiter } from '../middleware/rateLimiter';
import { ipRestriction } from '../middleware/ipRestriction';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(auditLogger);

// Initiate payment (restricted to finance team and requires IP restriction for security)
router.post(
  '/initiate',
  rateLimiter('financial'),
  ipRestriction, // Financial operations require IP restriction
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  paymentController.initiatePayment
);

// Approve payment
router.post(
  '/:invoiceId/approve',
  rateLimiter('standard'),
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  paymentController.approvePayment
);

// Get payment status
router.get(
  '/:invoiceId/status',
  rateLimiter('standard'),
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN', 'SUPERINTENDENT']),
  paymentController.getPaymentStatus
);

// Handle payment exceptions
router.post(
  '/:invoiceId/exception',
  rateLimiter('standard'),
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  paymentController.handlePaymentException
);

// Get payment history
router.get(
  '/history',
  rateLimiter('standard'),
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN', 'SUPERINTENDENT']),
  paymentController.getPaymentHistory
);

// Get pending payments
router.get(
  '/pending',
  rateLimiter('standard'),
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN', 'SUPERINTENDENT']),
  paymentController.getPendingPayments
);

export default router;