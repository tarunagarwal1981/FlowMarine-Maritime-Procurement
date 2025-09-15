import { Router } from 'express';
import { itemCatalogController } from '../controllers/itemCatalogController.js';
import { authenticateToken } from '../middleware/authentication.js';
import { authorizeRole } from '../middleware/authorization.js';
import { auditLogger } from '../middleware/auditLogger.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);
router.use(auditLogger);

// Apply rate limiting
router.use(rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
}));

// Public read routes (all authenticated users)
router.get('/search', itemCatalogController.searchItems);
router.get('/search/analytics', itemCatalogController.getItemsWithPricingAnalytics);
router.get('/analytics', itemCatalogController.getSearchAnalytics);
router.get('/categories', itemCatalogController.getMaritimeCategoriesWithCounts);
router.get('/categories/:category', itemCatalogController.getItemsByCategory);
router.get('/autocomplete', itemCatalogController.getAutocompleteSuggestions);
router.get('/autocomplete/advanced', itemCatalogController.getAdvancedAutocompleteSuggestions);
router.get('/specifications/templates', itemCatalogController.getSpecificationTemplates);
router.get('/impa/:impaCode', itemCatalogController.getItemByImpaCode);
router.get('/issa/:issaCode', itemCatalogController.getItemByIssaCode);
router.get('/:id', itemCatalogController.getItemById);

// Vessel compatibility check (vessel crew and above)
router.post('/compatibility/check', 
  authorizeRole(['vessel_crew', 'chief_engineer', 'captain', 'superintendent', 'procurement_manager', 'admin']),
  itemCatalogController.checkVesselCompatibility
);

// Management routes (procurement manager and admin only)
router.post('/', 
  authorizeRole(['procurement_manager', 'admin']),
  itemCatalogController.createItem
);

router.put('/:id', 
  authorizeRole(['procurement_manager', 'admin']),
  itemCatalogController.updateItem
);

router.put('/:id/pricing', 
  authorizeRole(['procurement_manager', 'admin']),
  itemCatalogController.updateAveragePricing
);

router.put('/:id/specifications', 
  authorizeRole(['procurement_manager', 'admin']),
  itemCatalogController.updateItemSpecifications
);

router.post('/pricing/bulk-update', 
  authorizeRole(['procurement_manager', 'admin']),
  itemCatalogController.bulkUpdatePricingFromQuotes
);

router.delete('/:id', 
  authorizeRole(['admin']),
  itemCatalogController.deleteItem
);

export default router;