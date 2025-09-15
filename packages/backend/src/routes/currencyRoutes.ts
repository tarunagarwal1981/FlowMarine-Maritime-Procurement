import { Router } from 'express';
import { CurrencyController } from '../controllers/currencyController';
import { CostCenterController } from '../controllers/costCenterController';
import { BudgetController } from '../controllers/budgetController';
import { FinancialController } from '../controllers/financialController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// ============================================================================
// CURRENCY ROUTES
// ============================================================================

/**
 * @route GET /api/currency/supported
 * @desc Get list of supported currencies
 * @access All authenticated users
 */
router.get('/supported', CurrencyController.getSupportedCurrencies);

/**
 * @route GET /api/currency/exchange-rate/:fromCurrency/:toCurrency
 * @desc Get current exchange rate between two currencies
 * @access All authenticated users
 */
router.get('/exchange-rate/:fromCurrency/:toCurrency', CurrencyController.getExchangeRate);

/**
 * @route POST /api/currency/convert
 * @desc Convert amount from one currency to another
 * @access All authenticated users
 */
router.post('/convert', CurrencyController.convertCurrency);

/**
 * @route GET /api/currency/historical/:fromCurrency/:toCurrency
 * @desc Get historical exchange rate for a specific date
 * @access All authenticated users
 */
router.get('/historical/:fromCurrency/:toCurrency', CurrencyController.getHistoricalExchangeRate);

/**
 * @route GET /api/currency/trends/:fromCurrency/:toCurrency
 * @desc Get exchange rate trends over time
 * @access All authenticated users
 */
router.get('/trends/:fromCurrency/:toCurrency', CurrencyController.getExchangeRateTrends);

/**
 * @route POST /api/currency/convert-multiple
 * @desc Convert multiple amounts to a base currency
 * @access All authenticated users
 */
router.post('/convert-multiple', CurrencyController.convertMultipleCurrencies);

// ============================================================================
// COST CENTER ROUTES
// ============================================================================

/**
 * @route POST /api/currency/cost-centers
 * @desc Create a new cost center
 * @access Finance Team, Admin
 */
router.post('/cost-centers', 
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  CostCenterController.createCostCenter
);

/**
 * @route GET /api/currency/cost-centers/hierarchy
 * @desc Get cost center hierarchy
 * @access Finance Team, Procurement Manager, Admin
 */
router.get('/cost-centers/hierarchy',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  CostCenterController.getCostCenterHierarchy
);

/**
 * @route GET /api/currency/cost-centers/code/:code
 * @desc Get cost center by code
 * @access Finance Team, Procurement Manager, Admin
 */
router.get('/cost-centers/code/:code',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  CostCenterController.getCostCenterByCode
);

/**
 * @route POST /api/currency/cost-centers/allocate
 * @desc Allocate costs to cost centers
 * @access Finance Team, Admin
 */
router.post('/cost-centers/allocate',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  CostCenterController.allocateCosts
);

/**
 * @route GET /api/currency/cost-centers/:id/path
 * @desc Get cost center path (breadcrumb)
 * @access Finance Team, Procurement Manager, Admin
 */
router.get('/cost-centers/:id/path',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  CostCenterController.getCostCenterPath
);

/**
 * @route PUT /api/currency/cost-centers/:id
 * @desc Update cost center
 * @access Finance Team, Admin
 */
router.put('/cost-centers/:id',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  CostCenterController.updateCostCenter
);

/**
 * @route GET /api/currency/cost-centers/vessel/:vesselId
 * @desc Get cost centers for vessel
 * @access All authenticated users with vessel access
 */
router.get('/cost-centers/vessel/:vesselId',
  validateVesselAccess,
  CostCenterController.getCostCentersForVessel
);

export default router;/
/ ============================================================================
// BUDGET ROUTES
// ============================================================================

/**
 * @route POST /api/currency/budgets
 * @desc Create a new budget
 * @access Finance Team, Admin
 */
router.post('/budgets',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  BudgetController.createBudget
);

/**
 * @route GET /api/currency/budgets/vessel/:vesselId/summary
 * @desc Get vessel budget summary
 * @access All authenticated users with vessel access
 */
router.get('/budgets/vessel/:vesselId/summary',
  validateVesselAccess,
  BudgetController.getVesselBudgetSummary
);

/**
 * @route POST /api/currency/budgets/check-availability
 * @desc Check budget availability for a purchase
 * @access All authenticated users
 */
router.post('/budgets/check-availability',
  BudgetController.checkBudgetAvailability
);

/**
 * @route POST /api/currency/budgets/vessel/:vesselId/seasonal-adjustments
 * @desc Apply seasonal adjustments to vessel budgets
 * @access Finance Team, Admin
 */
router.post('/budgets/vessel/:vesselId/seasonal-adjustments',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  validateVesselAccess,
  BudgetController.applySeasonalAdjustments
);

/**
 * @route GET /api/currency/budgets/hierarchy/:vesselId/:category/:currency
 * @desc Get budget hierarchy (vessel -> fleet -> company)
 * @access Finance Team, Procurement Manager, Admin
 */
router.get('/budgets/hierarchy/:vesselId/:category/:currency',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  validateVesselAccess,
  BudgetController.getBudgetHierarchy
);
// 
============================================================================
// FINANCIAL CONTROLS AND REPORTING ROUTES
// ============================================================================

/**
 * @route POST /api/currency/purchase-categories
 * @desc Create a new purchase category
 * @access Finance Team, Admin
 */
router.post('/purchase-categories',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  FinancialController.createPurchaseCategory
);

/**
 * @route GET /api/currency/purchase-categories
 * @desc Get all purchase categories
 * @access Finance Team, Procurement Manager, Admin
 */
router.get('/purchase-categories',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  FinancialController.getAllPurchaseCategories
);

/**
 * @route GET /api/currency/purchase-categories/hierarchy
 * @desc Get purchase category hierarchy
 * @access Finance Team, Procurement Manager, Admin
 */
router.get('/purchase-categories/hierarchy',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  FinancialController.getCategoryHierarchy
);

/**
 * @route GET /api/currency/purchase-categories/code/:code
 * @desc Get purchase category by code
 * @access Finance Team, Procurement Manager, Admin
 */
router.get('/purchase-categories/code/:code',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  FinancialController.getPurchaseCategoryByCode
);

/**
 * @route PUT /api/currency/purchase-categories/:id
 * @desc Update purchase category
 * @access Finance Team, Admin
 */
router.put('/purchase-categories/:id',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  FinancialController.updatePurchaseCategory
);

/**
 * @route GET /api/currency/purchase-categories/spending-analysis
 * @desc Get category spending analysis
 * @access Finance Team, Procurement Manager, Admin
 */
router.get('/purchase-categories/spending-analysis',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  FinancialController.getCategorySpendingAnalysis
);

/**
 * @route GET /api/currency/purchase-categories/report
 * @desc Generate category report
 * @access Finance Team, Procurement Manager, Admin
 */
router.get('/purchase-categories/report',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  FinancialController.generateCategoryReport
);

/**
 * @route PUT /api/currency/vendors/:vendorId/payment-terms
 * @desc Update vendor payment terms and credit limit
 * @access Finance Team, Admin
 */
router.put('/vendors/:vendorId/payment-terms',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  FinancialController.updateVendorPaymentTerms
);

/**
 * @route GET /api/currency/vendors/:vendorId/payment-terms
 * @desc Get vendor payment terms and credit status
 * @access Finance Team, Procurement Manager, Admin
 */
router.get('/vendors/:vendorId/payment-terms',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  FinancialController.getVendorPaymentTerms
);

/**
 * @route GET /api/currency/vendors/:vendorId/credit-report
 * @desc Generate vendor credit report
 * @access Finance Team, Admin
 */
router.get('/vendors/:vendorId/credit-report',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  FinancialController.generateVendorCreditReport
);

/**
 * @route POST /api/currency/vendors/check-credit
 * @desc Check credit availability for vendor
 * @access Finance Team, Procurement Manager, Admin
 */
router.post('/vendors/check-credit',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  FinancialController.checkCreditAvailability
);

/**
 * @route GET /api/currency/vendors/credit-issues
 * @desc Get vendors with credit issues
 * @access Finance Team, Admin
 */
router.get('/vendors/credit-issues',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  FinancialController.getVendorsWithCreditIssues
);

/**
 * @route GET /api/currency/payment-analytics
 * @desc Get payment analytics
 * @access Finance Team, Admin
 */
router.get('/payment-analytics',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  FinancialController.getPaymentAnalytics
);

/**
 * @route POST /api/currency/reports/generate
 * @desc Generate financial report
 * @access Finance Team, Admin
 */
router.post('/reports/generate',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  FinancialController.generateFinancialReport
);

/**
 * @route POST /api/currency/budgets/seasonal-adjustments
 * @desc Apply seasonal budget adjustments
 * @access Finance Team, Admin
 */
router.post('/budgets/seasonal-adjustments',
  authorizeRole(['FINANCE_TEAM', 'ADMIN']),
  FinancialController.applySeasonalBudgetAdjustments
);

/**
 * @route GET /api/currency/dashboard
 * @desc Get financial dashboard data
 * @access Finance Team, Procurement Manager, Admin
 */
router.get('/dashboard',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'ADMIN']),
  FinancialController.getFinancialDashboard
);