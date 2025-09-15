import { Router } from 'express';
import { quoteComparisonController } from '../controllers/quoteComparisonController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { auditLogger } from '../middleware/auditLogger';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(auditLogger);

// Apply rate limiting
router.use(rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many quote comparison requests, please try again later'
}));

/**
 * @route POST /api/quote-comparison/:rfqId/score
 * @desc Score and compare quotes for an RFQ
 * @access Private - Procurement Manager, Superintendent, Admin
 */
router.post(
  '/:rfqId/score',
  authorizeRole(['procurement_manager', 'superintendent', 'admin']),
  quoteComparisonController.scoreQuotes
);

/**
 * @route GET /api/quote-comparison/:rfqId/report
 * @desc Get quote comparison report
 * @access Private - Procurement Manager, Superintendent, Finance Team, Admin
 */
router.get(
  '/:rfqId/report',
  authorizeRole(['procurement_manager', 'superintendent', 'finance_team', 'admin']),
  quoteComparisonController.getComparisonReport
);

/**
 * @route GET /api/quote-comparison/:rfqId/recommendation
 * @desc Get automated vendor recommendation
 * @access Private - Procurement Manager, Superintendent, Admin
 */
router.get(
  '/:rfqId/recommendation',
  authorizeRole(['procurement_manager', 'superintendent', 'admin']),
  quoteComparisonController.getVendorRecommendation
);

/**
 * @route GET /api/quote-comparison/:rfqId/side-by-side
 * @desc Get side-by-side quote comparison
 * @access Private - Procurement Manager, Superintendent, Finance Team, Admin
 */
router.get(
  '/:rfqId/side-by-side',
  authorizeRole(['procurement_manager', 'superintendent', 'finance_team', 'admin']),
  quoteComparisonController.getSideBySideComparison
);

/**
 * @route PUT /api/quote-comparison/:rfqId/weights
 * @desc Update scoring weights and re-score quotes
 * @access Private - Procurement Manager, Admin
 */
router.put(
  '/:rfqId/weights',
  authorizeRole(['procurement_manager', 'admin']),
  quoteComparisonController.updateScoringWeights
);

/**
 * @route POST /api/quote-comparison/quotes/:quoteId/approve
 * @desc Approve a quote with justification
 * @access Private - Procurement Manager, Superintendent, Admin
 */
router.post(
  '/quotes/:quoteId/approve',
  authorizeRole(['procurement_manager', 'superintendent', 'admin']),
  quoteComparisonController.approveQuote
);

/**
 * @route GET /api/quote-comparison/quotes/:quoteId/scoring-details
 * @desc Get detailed scoring information for a specific quote
 * @access Private - Procurement Manager, Superintendent, Finance Team, Admin
 */
router.get(
  '/quotes/:quoteId/scoring-details',
  authorizeRole(['procurement_manager', 'superintendent', 'finance_team', 'admin']),
  quoteComparisonController.getQuoteScoringDetails
);

export default router;