import { Router } from 'express';
import { BIIntegrationController } from '../controllers/biIntegrationController';
import { authenticateToken, authorizeRole } from '../middleware/authentication';
import { validateRequest } from '../middleware/validation';
import { Pool } from 'pg';
import { body, param, query } from 'express-validator';

export function createBIIntegrationRoutes(dbPool: Pool, warehousePool: Pool, io: any): Router {
  const router = Router();
  const controller = new BIIntegrationController(dbPool, warehousePool, io);

  // Apply authentication to all routes
  router.use(authenticateToken);

  // BI Tool Integration Routes
  router.get('/bi-tools/configs', 
    authorizeRole(['admin', 'bi_admin']),
    controller.getBIToolConfigs.bind(controller)
  );

  router.put('/bi-tools/:toolId/config',
    authorizeRole(['admin', 'bi_admin']),
    [
      param('toolId').isString().notEmpty(),
      body('enabled').optional().isBoolean(),
      body('authentication').optional().isObject(),
      body('endpoints').optional().isObject(),
      body('dataMapping').optional().isObject(),
      body('refreshInterval').optional().isInt({ min: 1 })
    ],
    validateRequest,
    controller.updateBIToolConfig.bind(controller)
  );

  router.post('/bi-tools/:toolId/test-connection',
    authorizeRole(['admin', 'bi_admin']),
    [param('toolId').isString().notEmpty()],
    validateRequest,
    controller.testBIToolConnection.bind(controller)
  );

  router.post('/bi-tools/sync/:dataSourceId',
    authorizeRole(['admin', 'bi_admin', 'analytics_user']),
    [
      param('dataSourceId').isString().notEmpty(),
      body('parameters').optional().isObject()
    ],
    validateRequest,
    controller.syncDataToBITools.bind(controller)
  );

  router.get('/data-sources',
    authorizeRole(['admin', 'bi_admin', 'analytics_user']),
    controller.getDataSources.bind(controller)
  );

  router.post('/data-sources/:dataSourceId/execute',
    authorizeRole(['admin', 'bi_admin', 'analytics_user']),
    [
      param('dataSourceId').isString().notEmpty(),
      body('parameters').optional().isObject()
    ],
    validateRequest,
    controller.executeDataSourceQuery.bind(controller)
  );

  // Data Warehouse Routes
  router.get('/etl/jobs',
    authorizeRole(['admin', 'bi_admin', 'etl_operator']),
    controller.getETLJobs.bind(controller)
  );

  router.post('/etl/jobs/:jobId/run',
    authorizeRole(['admin', 'bi_admin', 'etl_operator']),
    [
      param('jobId').isString().notEmpty(),
      body('parameters').optional().isObject()
    ],
    validateRequest,
    controller.runETLJob.bind(controller)
  );

  router.get('/etl/jobs/:jobId/status',
    authorizeRole(['admin', 'bi_admin', 'etl_operator']),
    [param('jobId').isString().notEmpty()],
    validateRequest,
    controller.getETLJobStatus.bind(controller)
  );

  router.post('/etl/jobs/:jobId/enable',
    authorizeRole(['admin', 'bi_admin']),
    [param('jobId').isString().notEmpty()],
    validateRequest,
    controller.enableETLJob.bind(controller)
  );

  router.post('/etl/jobs/:jobId/disable',
    authorizeRole(['admin', 'bi_admin']),
    [param('jobId').isString().notEmpty()],
    validateRequest,
    controller.disableETLJob.bind(controller)
  );

  router.get('/data-quality/check',
    authorizeRole(['admin', 'bi_admin', 'data_analyst']),
    [query('ruleId').optional().isString()],
    validateRequest,
    controller.runDataQualityCheck.bind(controller)
  );

  router.get('/data-quality/rules',
    authorizeRole(['admin', 'bi_admin', 'data_analyst']),
    controller.getDataQualityRules.bind(controller)
  );

  // OLAP Cube Routes
  router.get('/olap/cubes',
    authorizeRole(['admin', 'bi_admin', 'analytics_user']),
    controller.getAllCubes.bind(controller)
  );

  router.get('/olap/cubes/:cubeName/metadata',
    authorizeRole(['admin', 'bi_admin', 'analytics_user']),
    [param('cubeName').isString().notEmpty()],
    validateRequest,
    controller.getCubeMetadata.bind(controller)
  );

  router.post('/olap/cubes/:cubeName/query',
    authorizeRole(['admin', 'bi_admin', 'analytics_user']),
    [
      param('cubeName').isString().notEmpty(),
      body('mdxQuery').isString().notEmpty()
    ],
    validateRequest,
    controller.executeMDXQuery.bind(controller)
  );

  router.get('/olap/cubes/:cubeName/dimensions/:dimensionName/members',
    authorizeRole(['admin', 'bi_admin', 'analytics_user']),
    [
      param('cubeName').isString().notEmpty(),
      param('dimensionName').isString().notEmpty(),
      query('hierarchyName').optional().isString()
    ],
    validateRequest,
    controller.getDimensionMembers.bind(controller)
  );

  router.post('/olap/cubes/:cubeName/slice-and-dice',
    authorizeRole(['admin', 'bi_admin', 'analytics_user']),
    [
      param('cubeName').isString().notEmpty(),
      body('dimensions').isArray(),
      body('measures').isArray(),
      body('filters').optional().isObject()
    ],
    validateRequest,
    controller.executeSliceAndDice.bind(controller)
  );

  router.post('/olap/cubes/:cubeName/rankings',
    authorizeRole(['admin', 'bi_admin', 'analytics_user']),
    [
      param('cubeName').isString().notEmpty(),
      body('dimension').isString().notEmpty(),
      body('measure').isString().notEmpty(),
      body('topN').optional().isInt({ min: 1, max: 100 })
    ],
    validateRequest,
    controller.calculateRankings.bind(controller)
  );

  router.get('/olap/cubes/:cubeName/statistics',
    authorizeRole(['admin', 'bi_admin', 'analytics_user']),
    [param('cubeName').isString().notEmpty()],
    validateRequest,
    controller.getCubeStatistics.bind(controller)
  );

  router.post('/olap/cubes/:cubeName/refresh',
    authorizeRole(['admin', 'bi_admin']),
    [param('cubeName').isString().notEmpty()],
    validateRequest,
    controller.refreshCube.bind(controller)
  );

  // External Analytics API Management Routes
  router.get('/external-api/keys',
    authorizeRole(['admin', 'api_admin']),
    [query('clientId').optional().isString()],
    validateRequest,
    controller.getAPIKeys.bind(controller)
  );

  router.post('/external-api/keys',
    authorizeRole(['admin', 'api_admin']),
    [
      body('name').isString().notEmpty(),
      body('clientId').isString().notEmpty(),
      body('permissions').isArray(),
      body('rateLimit').isObject(),
      body('rateLimit.requests').isInt({ min: 1 }),
      body('rateLimit.window').isInt({ min: 1 }),
      body('expiresAt').optional().isISO8601()
    ],
    validateRequest,
    controller.createAPIKey.bind(controller)
  );

  router.delete('/external-api/keys/:keyId',
    authorizeRole(['admin', 'api_admin']),
    [param('keyId').isString().notEmpty()],
    validateRequest,
    controller.revokeAPIKey.bind(controller)
  );

  router.get('/external-api/exports',
    authorizeRole(['admin', 'api_admin']),
    [query('apiKeyId').optional().isString()],
    validateRequest,
    controller.getExportRequests.bind(controller)
  );

  router.post('/external-api/exports',
    authorizeRole(['admin', 'api_admin']),
    [
      body('apiKeyId').isString().notEmpty(),
      body('endpoint').isString().notEmpty(),
      body('parameters').optional().isObject(),
      body('format').isIn(['json', 'csv', 'xml', 'parquet'])
    ],
    validateRequest,
    controller.createBatchExport.bind(controller)
  );

  router.get('/external-api/endpoints',
    authorizeRole(['admin', 'api_admin', 'analytics_user']),
    controller.getExternalAPIEndpoints.bind(controller)
  );

  // Real-Time Streaming Routes
  router.get('/streaming/streams',
    authorizeRole(['admin', 'streaming_admin']),
    controller.getStreams.bind(controller)
  );

  router.post('/streaming/streams',
    authorizeRole(['admin', 'streaming_admin']),
    [
      body('name').isString().notEmpty(),
      body('description').isString().notEmpty(),
      body('sourceType').isIn(['database', 'api', 'webhook', 'file']),
      body('sourceConfig').isObject(),
      body('transformations').isArray(),
      body('destinations').isArray(),
      body('isActive').isBoolean(),
      body('batchSize').isInt({ min: 1 }),
      body('flushInterval').isInt({ min: 100 }),
      body('retryPolicy').isObject()
    ],
    validateRequest,
    controller.createStream.bind(controller)
  );

  router.put('/streaming/streams/:streamId',
    authorizeRole(['admin', 'streaming_admin']),
    [
      param('streamId').isString().notEmpty(),
      body('name').optional().isString(),
      body('description').optional().isString(),
      body('isActive').optional().isBoolean(),
      body('batchSize').optional().isInt({ min: 1 }),
      body('flushInterval').optional().isInt({ min: 100 })
    ],
    validateRequest,
    controller.updateStream.bind(controller)
  );

  router.delete('/streaming/streams/:streamId',
    authorizeRole(['admin', 'streaming_admin']),
    [param('streamId').isString().notEmpty()],
    validateRequest,
    controller.deleteStream.bind(controller)
  );

  router.get('/streaming/metrics',
    authorizeRole(['admin', 'streaming_admin', 'monitoring_user']),
    [query('streamId').optional().isString()],
    validateRequest,
    controller.getStreamMetrics.bind(controller)
  );

  router.get('/streaming/alerts/rules',
    authorizeRole(['admin', 'streaming_admin']),
    controller.getAlertRules.bind(controller)
  );

  router.post('/streaming/alerts/rules',
    authorizeRole(['admin', 'streaming_admin']),
    [
      body('streamId').isString().notEmpty(),
      body('name').isString().notEmpty(),
      body('condition').isString().notEmpty(),
      body('threshold').isNumeric(),
      body('severity').isIn(['low', 'medium', 'high', 'critical']),
      body('actions').isArray(),
      body('isActive').isBoolean()
    ],
    validateRequest,
    controller.createAlertRule.bind(controller)
  );

  return router;
}