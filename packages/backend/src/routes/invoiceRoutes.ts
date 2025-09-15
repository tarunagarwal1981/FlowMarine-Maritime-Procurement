import { Router } from 'express';
import { invoiceController, uploadMiddleware } from '../controllers/invoiceController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { auditLogger } from '../middleware/auditLogger';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(auditLogger);

// Create invoice
router.post(
  '/',
  rateLimiter('standard'),
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  invoiceController.createInvoice
);

// Upload and process invoice with OCR
router.post(
  '/:invoiceId/process-ocr',
  rateLimiter('file-upload'),
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  uploadMiddleware,
  invoiceController.processInvoiceOCR
);

// Perform three-way matching
router.post(
  '/:invoiceId/three-way-match',
  rateLimiter('standard'),
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  invoiceController.performThreeWayMatching
);

// Get invoice processing status
router.get(
  '/:invoiceId/status',
  rateLimiter('standard'),
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN', 'SUPERINTENDENT']),
  invoiceController.getInvoiceStatus
);

// Get invoices with filtering and pagination
router.get(
  '/',
  rateLimiter('standard'),
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN', 'SUPERINTENDENT']),
  invoiceController.getInvoices
);

// Update invoice status
router.patch(
  '/:invoiceId/status',
  rateLimiter('standard'),
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  invoiceController.updateInvoiceStatus
);

export default router;