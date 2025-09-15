import { Router } from 'express';
import { financialIntegrationController } from '../controllers/financialIntegrationController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { rateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Banking Integration Routes
router.post(
  '/banking/payments',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  rateLimiter('shore'),
  financialIntegrationController.processBankingPayment
);

router.get(
  '/banking/payments/:instructionId/status',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  rateLimiter('shore'),
  financialIntegrationController.getBankingPaymentStatus
);

router.post(
  '/banking/payments/:instructionId/cancel',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  rateLimiter('shore'),
  financialIntegrationController.cancelBankingPayment
);

router.get(
  '/banking/payments/history',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  rateLimiter('shore'),
  financialIntegrationController.getBankingPaymentHistory
);

router.get(
  '/banking/accounts/:providerId/:accountNumber/balance',
  authorizeRole(['FINANCE_TEAM']),
  rateLimiter('shore'),
  financialIntegrationController.getAccountBalance
);

// Exchange Rate Integration Routes
router.get(
  '/exchange-rates/:fromCurrency/:toCurrency',
  rateLimiter('shore'),
  financialIntegrationController.getExchangeRate
);

router.get(
  '/exchange-rates/:baseCurrency/multiple',
  rateLimiter('shore'),
  financialIntegrationController.getMultipleExchangeRates
);

router.post(
  '/exchange-rates/convert',
  rateLimiter('shore'),
  financialIntegrationController.convertCurrency
);

router.get(
  '/exchange-rates/:fromCurrency/:toCurrency/historical',
  rateLimiter('shore'),
  financialIntegrationController.getHistoricalExchangeRates
);

router.get(
  '/exchange-rates/currencies/supported',
  rateLimiter('shore'),
  financialIntegrationController.getSupportedCurrencies
);

router.get(
  '/exchange-rates/providers/status',
  authorizeRole(['ADMIN', 'FINANCE_TEAM']),
  rateLimiter('shore'),
  financialIntegrationController.getExchangeRateProviderStatus
);

// Payment Gateway Integration Routes
router.post(
  '/payment-gateways/payments',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  rateLimiter('shore'),
  financialIntegrationController.processGatewayPayment
);

router.get(
  '/payment-gateways/payments/:transactionId/status',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  rateLimiter('shore'),
  financialIntegrationController.getGatewayPaymentStatus
);

router.post(
  '/payment-gateways/refunds',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  rateLimiter('shore'),
  financialIntegrationController.processRefund
);

router.post(
  '/payment-gateways/validate-payment-method',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  rateLimiter('shore'),
  financialIntegrationController.validatePaymentMethod
);

router.get(
  '/payment-gateways/available',
  rateLimiter('shore'),
  financialIntegrationController.getAvailableGateways
);

// Accounting System Integration Routes
router.post(
  '/accounting/:systemId/chart-of-accounts/sync',
  authorizeRole(['ADMIN', 'FINANCE_TEAM']),
  rateLimiter('shore'),
  financialIntegrationController.syncChartOfAccounts
);

router.post(
  '/accounting/:systemId/cost-centers/sync',
  authorizeRole(['ADMIN', 'FINANCE_TEAM']),
  rateLimiter('shore'),
  financialIntegrationController.syncCostCenters
);

router.post(
  '/accounting/:systemId/journal-entries',
  authorizeRole(['FINANCE_TEAM']),
  rateLimiter('shore'),
  financialIntegrationController.postJournalEntry
);

router.get(
  '/accounting/:systemId/trial-balance',
  authorizeRole(['FINANCE_TEAM']),
  rateLimiter('shore'),
  financialIntegrationController.getTrialBalance
);

router.get(
  '/accounting/:systemId/reports/financial',
  authorizeRole(['FINANCE_TEAM', 'SUPERINTENDENT']),
  rateLimiter('shore'),
  financialIntegrationController.generateFinancialReport
);

router.post(
  '/accounting/:systemId/sync-procurement',
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  rateLimiter('shore'),
  financialIntegrationController.syncProcurementTransactions
);

router.get(
  '/accounting/:systemId/budget-vs-actual',
  authorizeRole(['FINANCE_TEAM', 'SUPERINTENDENT']),
  rateLimiter('shore'),
  financialIntegrationController.getBudgetVsActual
);

export { router as financialIntegrationRoutes };