import { Router } from 'express';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import SecurityController from '../controllers/securityController';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Security Incidents
router.get(
  '/incidents',
  authorizeRole(['security:read', 'admin:full']),
  SecurityController.getSecurityIncidents
);

router.get(
  '/incidents/:incidentId',
  authorizeRole(['security:read', 'admin:full']),
  SecurityController.getSecurityIncident
);

router.patch(
  '/incidents/:incidentId/status',
  authorizeRole(['security:write', 'admin:full']),
  SecurityController.updateSecurityIncidentStatus
);

router.post(
  '/analysis/trigger',
  authorizeRole(['security:write', 'admin:full']),
  SecurityController.triggerSecurityAnalysis
);

// Audit Logs
router.get(
  '/audit-logs',
  authorizeRole(['audit:read', 'admin:full']),
  SecurityController.getAuditLogs
);

// Data Retention
router.get(
  '/data-retention/policies',
  authorizeRole(['admin:full']),
  SecurityController.getDataRetentionPolicies
);

router.post(
  '/data-retention/execute',
  authorizeRole(['admin:full']),
  SecurityController.executeDataRetention
);

// Legal Holds
router.post(
  '/legal-holds',
  authorizeRole(['legal:write', 'admin:full']),
  SecurityController.placeLegalHold
);

router.delete(
  '/legal-holds',
  authorizeRole(['legal:write', 'admin:full']),
  SecurityController.removeLegalHold
);

// Encryption Testing (Admin only)
router.post(
  '/encryption/test',
  authorizeRole(['admin:full']),
  SecurityController.testFieldEncryption
);

export default router;