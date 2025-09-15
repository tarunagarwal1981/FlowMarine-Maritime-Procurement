import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { reportBuilderController } from '../controllers/reportBuilderController';
import { authenticateToken } from '../middleware/authentication';
import { authorizeRole } from '../middleware/authorization';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Template Management Routes
router.post('/templates',
  authorizeRole(['ADMIN', 'PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  [
    body('name').notEmpty().withMessage('Template name is required'),
    body('description').optional().isString(),
    body('category').notEmpty().withMessage('Category is required'),
    body('dataSource').notEmpty().withMessage('Data source is required'),
    body('query').notEmpty().withMessage('Query is required'),
    body('parameters').optional().isArray(),
    body('visualizations').isArray().withMessage('Visualizations must be an array'),
    body('layout').isObject().withMessage('Layout must be an object'),
    body('permissions').optional().isArray(),
    body('isPublic').optional().isBoolean(),
  ],
  reportBuilderController.createTemplate
);

router.get('/templates',
  [
    query('category').optional().isString(),
    query('isPublic').optional().isBoolean(),
  ],
  reportBuilderController.getTemplates
);

router.get('/templates/:templateId',
  param('templateId').isUUID().withMessage('Invalid template ID'),
  reportBuilderController.getTemplate
);

router.put('/templates/:templateId',
  authorizeRole(['ADMIN', 'PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  param('templateId').isUUID().withMessage('Invalid template ID'),
  reportBuilderController.updateTemplate
);

router.delete('/templates/:templateId',
  authorizeRole(['ADMIN', 'PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  param('templateId').isUUID().withMessage('Invalid template ID'),
  reportBuilderController.deleteTemplate
);

// Report Execution Routes
router.post('/templates/:templateId/execute',
  param('templateId').isUUID().withMessage('Invalid template ID'),
  [
    body('parameters').optional().isObject(),
  ],
  reportBuilderController.executeReport
);

router.get('/executions/:executionId',
  param('executionId').isUUID().withMessage('Invalid execution ID'),
  reportBuilderController.getExecutionStatus
);

// Scheduled Reports Routes
router.post('/scheduled',
  authorizeRole(['ADMIN', 'PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  [
    body('templateId').isUUID().withMessage('Invalid template ID'),
    body('name').notEmpty().withMessage('Scheduled report name is required'),
    body('schedule').isObject().withMessage('Schedule configuration is required'),
    body('schedule.type').isIn(['daily', 'weekly', 'monthly', 'quarterly']).withMessage('Invalid schedule type'),
    body('schedule.time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format'),
    body('parameters').optional().isObject(),
    body('recipients').isArray().withMessage('Recipients must be an array'),
    body('format').isIn(['pdf', 'excel', 'csv', 'html']).withMessage('Invalid format'),
    body('isActive').optional().isBoolean(),
  ],
  reportBuilderController.createScheduledReport
);

router.get('/scheduled',
  reportBuilderController.getScheduledReports
);

router.put('/scheduled/:reportId',
  authorizeRole(['ADMIN', 'PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  param('reportId').isUUID().withMessage('Invalid report ID'),
  reportBuilderController.updateScheduledReport
);

router.delete('/scheduled/:reportId',
  authorizeRole(['ADMIN', 'PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  param('reportId').isUUID().withMessage('Invalid report ID'),
  reportBuilderController.deleteScheduledReport
);

// Report Sharing Routes
router.post('/templates/:templateId/share',
  authorizeRole(['ADMIN', 'PROCUREMENT_MANAGER', 'SUPERINTENDENT']),
  param('templateId').isUUID().withMessage('Invalid template ID'),
  [
    body('shareWith').isArray().withMessage('shareWith must be an array of email addresses'),
    body('permissions').isArray().withMessage('permissions must be an array'),
  ],
  reportBuilderController.shareReport
);

router.get('/shared',
  reportBuilderController.getSharedReports
);

// Configuration Routes
router.get('/data-sources',
  reportBuilderController.getDataSources
);

router.get('/visualization-types',
  reportBuilderController.getVisualizationTypes
);

export default router;