import { Router } from 'express';
import { externalApiController } from '../controllers/externalApiController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';
import { validateVesselAccess } from '../middleware/vesselAccess';
import { rateLimiter } from '../middleware/rateLimiting';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// IMPA/ISSA Catalog Routes
router.get('/catalog/search', 
  rateLimiter('catalog', 100, 60), // 100 requests per minute
  authorizeRole(['CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER']),
  externalApiController.searchIMPACatalog
);

router.get('/catalog/items/:impaCode',
  rateLimiter('catalog', 100, 60),
  authorizeRole(['CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER']),
  externalApiController.getIMPAItemDetails
);

router.get('/catalog/items/:impaCode/suppliers',
  rateLimiter('catalog', 100, 60),
  authorizeRole(['PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  externalApiController.getIMPASupplierPricing
);

// Port Database Routes
router.get('/ports/:portCode',
  rateLimiter('ports', 200, 60), // 200 requests per minute
  authorizeRole(['CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER']),
  externalApiController.getPortInformation
);

router.get('/ports/search',
  rateLimiter('ports', 200, 60),
  authorizeRole(['CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT', 'PROCUREMENT_MANAGER']),
  externalApiController.searchPorts
);

// Weather API Routes
router.get('/weather',
  rateLimiter('weather', 300, 60), // 300 requests per minute
  authorizeRole(['CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT']),
  externalApiController.getWeatherData
);

router.post('/weather/route-forecast',
  rateLimiter('weather', 50, 60), // 50 requests per minute (more expensive)
  authorizeRole(['CAPTAIN', 'SUPERINTENDENT']),
  externalApiController.getRouteWeatherForecast
);

// Vessel Tracking Routes
router.get('/vessels/:imoNumber/position',
  rateLimiter('tracking', 500, 60), // 500 requests per minute
  authorizeRole(['CREW', 'CHIEF_ENGINEER', 'CAPTAIN', 'SUPERINTENDENT']),
  validateVesselAccess,
  externalApiController.getVesselPosition
);

router.post('/vessels/track-multiple',
  rateLimiter('tracking', 100, 60), // 100 requests per minute
  authorizeRole(['SUPERINTENDENT', 'FLEET_MANAGER']),
  externalApiController.trackMultipleVessels
);

// Banking API Routes (Restricted Access)
router.get('/banking/exchange-rates',
  rateLimiter('banking', 200, 60), // 200 requests per minute
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  externalApiController.getCurrentExchangeRates
);

router.get('/banking/exchange-rates/historical',
  rateLimiter('banking', 50, 60), // 50 requests per minute
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  externalApiController.getHistoricalExchangeRates
);

router.get('/banking/accounts',
  rateLimiter('banking', 100, 60), // 100 requests per minute
  authorizeRole(['FINANCE_TEAM']),
  externalApiController.getBankAccounts
);

router.get('/banking/cash-position',
  rateLimiter('banking', 100, 60), // 100 requests per minute
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  externalApiController.getCashPosition
);

router.post('/banking/payments',
  rateLimiter('banking', 20, 60), // 20 requests per minute (critical operation)
  authorizeRole(['FINANCE_TEAM']),
  externalApiController.initiatePayment
);

router.get('/banking/payments/:paymentId/status',
  rateLimiter('banking', 100, 60), // 100 requests per minute
  authorizeRole(['FINANCE_TEAM', 'PROCUREMENT_MANAGER']),
  externalApiController.getPaymentStatus
);

router.post('/banking/fx-hedging/recommendations',
  rateLimiter('banking', 30, 60), // 30 requests per minute
  authorizeRole(['FINANCE_TEAM']),
  externalApiController.getFXHedgingRecommendations
);

// System Status Routes
router.get('/status',
  rateLimiter('status', 60, 60), // 60 requests per minute
  authorizeRole(['ADMIN', 'SUPERINTENDENT']),
  externalApiController.getSystemStatus
);

export { router as externalApiRoutes };