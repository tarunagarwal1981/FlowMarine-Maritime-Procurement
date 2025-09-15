import { Router } from 'express';
import { complianceController } from '../controllers/complianceController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { auditLogger } from '../middleware/auditLogger';

const router = Router();

// Apply authentication and audit logging to all routes
router.use(authenticateToken);
router.use(auditLogger);

/**
 * Generate SOLAS compliance report for a vessel
 * POST /api/compliance/vessels/:vesselId/solas
 */
router.post(
  '/vessels/:vesselId/solas',
  validateVesselAccess,
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN']),
  complianceController.generateSOLASReport.bind(complianceController)
);

/**
 * Generate MARPOL compliance report for a vessel
 * POST /api/compliance/vessels/:vesselId/marpol
 */
router.post(
  '/vessels/:vesselId/marpol',
  validateVesselAccess,
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN']),
  complianceController.generateMARPOLReport.bind(complianceController)
);

/**
 * Generate ISM compliance report for a vessel
 * POST /api/compliance/vessels/:vesselId/ism
 */
router.post(
  '/vessels/:vesselId/ism',
  validateVesselAccess,
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN']),
  complianceController.generateISMReport.bind(complianceController)
);

/**
 * Generate audit trail report
 * POST /api/compliance/audit-trail
 */
router.post(
  '/audit-trail',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN']),
  complianceController.generateAuditTrailReport.bind(complianceController)
);

/**
 * Get compliance alerts
 * GET /api/compliance/alerts
 */
router.get(
  '/alerts',
  authorizeRole(['CAPTAIN', 'CHIEF_ENGINEER', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN']),
  complianceController.getComplianceAlerts.bind(complianceController)
);

/**
 * Get compliance dashboard data
 * GET /api/compliance/dashboard
 */
router.get(
  '/dashboard',
  authorizeRole(['CAPTAIN', 'CHIEF_ENGINEER', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN']),
  complianceController.getComplianceDashboard.bind(complianceController)
);

/**
 * Export compliance report to Excel
 * POST /api/compliance/export/excel
 */
router.post(
  '/export/excel',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN']),
  complianceController.exportReportToExcel.bind(complianceController)
);

/**
 * Export compliance report to PDF
 * POST /api/compliance/export/pdf
 */
router.post(
  '/export/pdf',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN']),
  complianceController.exportReportToPDF.bind(complianceController)
);

/**
 * Export audit trail to CSV
 * POST /api/compliance/export/audit-csv
 */
router.post(
  '/export/audit-csv',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'ADMIN']),
  complianceController.exportAuditTrailToCSV.bind(complianceController)
);

export default router;