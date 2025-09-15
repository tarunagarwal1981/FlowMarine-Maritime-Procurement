import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController';
import { complianceController } from '../controllers/complianceController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { auditLogger } from '../middleware/auditLogger';

const router = Router();

// Apply authentication to all analytics routes
router.use(authenticateToken);

// Apply audit logging to all analytics routes
router.use(auditLogger);

/**
 * @route GET /api/analytics/spending
 * @desc Get spending analysis
 * @access Superintendent, Procurement Manager, Finance Team, Admin
 */
router.get(
  '/spending',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  analyticsController.getSpendingAnalysis
);

/**
 * @route GET /api/analytics/vendors/:vendorId/performance
 * @desc Get vendor performance analytics
 * @access Superintendent, Procurement Manager, Finance Team, Admin
 */
router.get(
  '/vendors/:vendorId/performance',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  analyticsController.getVendorPerformanceAnalytics
);

/**
 * @route GET /api/analytics/vessels/:vesselId/procurement-patterns
 * @desc Get procurement patterns for a vessel
 * @access Superintendent, Procurement Manager, Finance Team, Admin, Captain (own vessel)
 */
router.get(
  '/vessels/:vesselId/procurement-patterns',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN', 'CAPTAIN']),
  validateVesselAccess,
  analyticsController.getProcurementPatterns
);

/**
 * @route GET /api/analytics/cost-optimization
 * @desc Get cost optimization recommendations
 * @access Superintendent, Procurement Manager, Finance Team, Admin
 */
router.get(
  '/cost-optimization',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  analyticsController.getCostOptimizationRecommendations
);

/**
 * @route GET /api/analytics/dashboard
 * @desc Get analytics dashboard data
 * @access Superintendent, Procurement Manager, Finance Team, Admin
 */
router.get(
  '/dashboard',
  authorizeRole(['SUPERINTENDENT', 'PROCUREMENT_MANAGER', 'FINANCE_TEAM', 'ADMIN']),
  analyticsController.getDashboardData
);

// ============================================================================
// COMPLIANCE REPORTING ROUTES
// ============================================================================

/**
 * @route GET /api/analytics/compliance/solas/:vesselId
 * @desc Generate SOLAS compliance report for a vessel
 * @access Superintendent, Admin, Captain (own vessel)
 */
router.get(
  '/compliance/solas/:vesselId',
  authorizeRole(['SUPERINTENDENT', 'ADMIN', 'CAPTAIN']),
  validateVesselAccess,
  complianceController.generateSOLASReport
);

/**
 * @route GET /api/analytics/compliance/marpol/:vesselId
 * @desc Generate MARPOL compliance report for a vessel
 * @access Superintendent, Admin, Captain (own vessel)
 */
router.get(
  '/compliance/marpol/:vesselId',
  authorizeRole(['SUPERINTENDENT', 'ADMIN', 'CAPTAIN']),
  validateVesselAccess,
  complianceController.generateMARPOLReport
);

/**
 * @route GET /api/analytics/compliance/ism/:vesselId
 * @desc Generate ISM compliance report for a vessel
 * @access Superintendent, Admin, Captain (own vessel)
 */
router.get(
  '/compliance/ism/:vesselId',
  authorizeRole(['SUPERINTENDENT', 'ADMIN', 'CAPTAIN']),
  validateVesselAccess,
  complianceController.generateISMReport
);

/**
 * @route GET /api/analytics/compliance/audit-trail
 * @desc Generate audit trail report
 * @access Superintendent, Admin
 */
router.get(
  '/compliance/audit-trail',
  authorizeRole(['SUPERINTENDENT', 'ADMIN']),
  complianceController.generateAuditTrailReport
);

/**
 * @route GET /api/analytics/compliance/alerts
 * @desc Get compliance alerts
 * @access Superintendent, Admin, Captain
 */
router.get(
  '/compliance/alerts',
  authorizeRole(['SUPERINTENDENT', 'ADMIN', 'CAPTAIN']),
  complianceController.getComplianceAlerts
);

/**
 * @route GET /api/analytics/compliance/dashboard
 * @desc Get compliance dashboard data
 * @access Superintendent, Admin, Captain
 */
router.get(
  '/compliance/dashboard',
  authorizeRole(['SUPERINTENDENT', 'ADMIN', 'CAPTAIN']),
  complianceController.getComplianceDashboard
);

export default router;