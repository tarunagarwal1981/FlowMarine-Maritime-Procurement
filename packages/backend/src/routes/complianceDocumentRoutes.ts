import { Router } from 'express';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import ComplianceDocumentController from '../controllers/complianceDocumentController';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Document Version Control Routes
router.post(
  '/documents/versions',
  authorizeRole(['document:write', 'admin:full']),
  ComplianceDocumentController.createDocumentVersion
);

router.get(
  '/documents/:documentId/versions',
  authorizeRole(['document:read', 'admin:full']),
  ComplianceDocumentController.getDocumentVersionHistory
);

router.get(
  '/documents/:documentId/versions/:version',
  authorizeRole(['document:read', 'admin:full']),
  ComplianceDocumentController.getDocumentVersion
);

router.post(
  '/documents/:documentId/restore',
  authorizeRole(['document:write', 'admin:full']),
  ComplianceDocumentController.restoreDocumentVersion
);

router.get(
  '/documents/:documentId/changes',
  authorizeRole(['document:read', 'admin:full']),
  ComplianceDocumentController.getDocumentChangeHistory
);

// Compliance Flag Management Routes
router.post(
  '/documents/:documentId/compliance-flags',
  authorizeRole(['compliance:write', 'admin:full']),
  ComplianceDocumentController.addComplianceFlag
);

router.patch(
  '/compliance-flags/:flagId/resolve',
  authorizeRole(['compliance:write', 'admin:full']),
  ComplianceDocumentController.resolveComplianceFlag
);

router.get(
  '/documents/:documentId/compliance-flags',
  authorizeRole(['compliance:read', 'admin:full']),
  ComplianceDocumentController.getDocumentComplianceFlags
);

router.get(
  '/compliance-flags/regulation/:regulationType',
  authorizeRole(['compliance:read', 'admin:full']),
  ComplianceDocumentController.getComplianceFlagsByRegulation
);

// Transaction History Routes
router.get(
  '/transactions/:entityType/:entityId/history',
  authorizeRole(['audit:read', 'admin:full']),
  ComplianceDocumentController.getEntityTransactionHistory
);

router.get(
  '/users/:userId/accountability',
  authorizeRole(['audit:read', 'admin:full']),
  ComplianceDocumentController.getUserAccountabilityRecords
);

router.post(
  '/reports/transactions',
  authorizeRole(['audit:read', 'admin:full']),
  ComplianceDocumentController.generateTransactionReport
);

// Compliance Reporting Routes
router.post(
  '/reports/compliance',
  authorizeRole(['compliance:write', 'admin:full']),
  ComplianceDocumentController.generateComplianceReport
);

router.get(
  '/reports/compliance',
  authorizeRole(['compliance:read', 'admin:full']),
  ComplianceDocumentController.getComplianceReports
);

router.patch(
  '/reports/compliance/:reportId/status',
  authorizeRole(['compliance:write', 'admin:full']),
  ComplianceDocumentController.updateComplianceReportStatus
);

// Compliance Audit Trail Routes
router.get(
  '/audit-trail/:regulationType',
  authorizeRole(['compliance:read', 'audit:read', 'admin:full']),
  ComplianceDocumentController.getComplianceAuditTrail
);

// Vessel-specific routes with access control
router.get(
  '/vessels/:vesselId/compliance-flags',
  validateVesselAccess,
  authorizeRole(['compliance:read', 'admin:full']),
  (req, res, next) => {
    req.query.vesselId = req.params.vesselId;
    next();
  },
  ComplianceDocumentController.getComplianceFlagsByRegulation
);

router.post(
  '/vessels/:vesselId/reports/solas',
  validateVesselAccess,
  authorizeRole(['compliance:write', 'admin:full']),
  (req, res, next) => {
    req.body.reportType = 'SOLAS';
    req.body.vesselId = req.params.vesselId;
    next();
  },
  ComplianceDocumentController.generateComplianceReport
);

router.post(
  '/vessels/:vesselId/reports/ism',
  validateVesselAccess,
  authorizeRole(['compliance:write', 'admin:full']),
  (req, res, next) => {
    req.body.reportType = 'ISM';
    req.body.vesselId = req.params.vesselId;
    next();
  },
  ComplianceDocumentController.generateComplianceReport
);

router.get(
  '/vessels/:vesselId/audit-trail/:regulationType',
  validateVesselAccess,
  authorizeRole(['compliance:read', 'audit:read', 'admin:full']),
  (req, res, next) => {
    req.query.vesselId = req.params.vesselId;
    next();
  },
  ComplianceDocumentController.getComplianceAuditTrail
);

export default router;