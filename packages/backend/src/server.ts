import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import authRoutes from './routes/authRoutes.js';
import vesselRoutes from './routes/vesselRoutes.js';
import crewRotationRoutes from './routes/crewRotationRoutes.js';
import workflowRoutes from './routes/workflowRoutes.js';
import emergencyOverrideRoutes from './routes/emergencyOverrideRoutes.js';
import delegationRoutes from './routes/delegationRoutes.js';
import { requisitionRoutes } from './routes/requisitionRoutes.js';
import { itemCatalogRoutes } from './routes/itemCatalogRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import rfqRoutes from './routes/rfqRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import currencyRoutes from './routes/currencyRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import complianceRoutes from './routes/complianceRoutes.js';
import securityRoutes from './routes/securityRoutes.js';
import { maritimeIntegrationRoutes } from './routes/maritimeIntegrationRoutes.js';
import { financialIntegrationRoutes } from './routes/financialIntegrationRoutes.js';
import { dashboardRoutes } from './routes/dashboardRoutes.js';
import { externalApiRoutes } from './routes/externalApiRoutes.js';
import { securityIncidentService } from './services/securityIncidentService.js';
import { dataRetentionService } from './services/dataRetentionService.js';
import { websocketService } from './services/websocketService.js';
import { dashboardWebSocketService } from './services/dashboardWebSocketService.js';
import { PerformanceEnhancementService } from './services/performanceEnhancementService.js';

const app = express();

// Initialize Performance Enhancement Service
const performanceConfig = {
  cache: {
    redis: {
      host: env.REDIS_HOST || 'localhost',
      port: parseInt(env.REDIS_PORT || '6379'),
      password: env.REDIS_PASSWORD,
      db: parseInt(env.REDIS_DB || '0'),
    },
    memory: {
      maxSize: 1000,
      ttl: 300000, // 5 minutes
    },
    strategies: {
      writeThrough: true,
      writeBack: false,
      readThrough: true,
    },
  },
  loadBalancing: {
    strategy: 'least-response-time' as const,
    autoScaling: {
      enabled: env.NODE_ENV === 'production',
      minInstances: 2,
      maxInstances: 10,
      scaleUpThreshold: {
        cpuUsage: 70,
        memoryUsage: 80,
        responseTime: 2000,
        connectionCount: 100,
      },
      scaleDownThreshold: {
        cpuUsage: 30,
        memoryUsage: 50,
        responseTime: 500,
        connectionCount: 20,
      },
      cooldownPeriod: 300, // 5 minutes
    },
  },
  cdn: {
    provider: 'aws-cloudfront' as const,
    config: {
      aws: {
        region: env.AWS_REGION || 'us-east-1',
        accessKeyId: env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY || '',
        bucketName: env.AWS_S3_BUCKET || '',
        distributionId: env.AWS_CLOUDFRONT_DISTRIBUTION_ID || '',
      },
    },
  },
  monitoring: {
    metricsInterval: 10000,
    alertThresholds: [],
  },
  testing: {
    continuousTesting: {
      enabled: env.NODE_ENV === 'production',
      interval: 60, // minutes
      thresholds: {
        responseTime: 2000,
        errorRate: 5,
        throughput: 100,
      },
    },
  },
};

const performanceService = new PerformanceEnhancementService(performanceConfig);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compression middleware
app.use(compression());

// Performance monitoring middleware
app.use(performanceService.getMiddleware());

// Health check endpoint
app.get('/health', async (req, res) => {
  const healthStatus = performanceService.getHealthStatus();
  res.json({
    status: healthStatus.overall,
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    version: '1.0.0',
    performance: healthStatus,
  });
});

// Performance metrics endpoint
app.get('/api/performance/metrics', (req, res) => {
  const metrics = performanceService.getPerformanceMetrics();
  res.json(metrics);
});

// Performance testing endpoint
app.post('/api/performance/test', async (req, res) => {
  try {
    const testConfig = req.body;
    const result = await performanceService.runLoadTest(testConfig);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CDN asset upload endpoint
app.post('/api/performance/cdn/upload', async (req, res) => {
  try {
    const { key, contentType, content } = req.body;
    const buffer = Buffer.from(content, 'base64');
    const result = await performanceService.uploadAssetToCDN(key, buffer, contentType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CDN cache invalidation endpoint
app.post('/api/performance/cdn/invalidate', async (req, res) => {
  try {
    const { paths } = req.body;
    const result = await performanceService.invalidateCDNCache(paths);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'FlowMarine API Server',
    version: '1.0.0',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Vessel management routes
app.use('/api/vessels', vesselRoutes);

// Crew rotation management routes
app.use('/api/crew', crewRotationRoutes);

// Workflow management routes
app.use('/api/workflow', workflowRoutes);

// Emergency override routes
app.use('/api/emergency-overrides', emergencyOverrideRoutes);

// Delegation management routes
app.use('/api/delegations', delegationRoutes);

// Requisition management routes
app.use('/api/requisitions', requisitionRoutes);

// Item catalog routes
app.use('/api/catalog', itemCatalogRoutes);

// Vendor management routes
app.use('/api/vendors', vendorRoutes);

// RFQ management routes
app.use('/api/rfqs', rfqRoutes);

// Purchase order management routes
app.use('/api/purchase-orders', purchaseOrderRoutes);

// Delivery management routes
app.use('/api/deliveries', deliveryRoutes);

// Currency and financial management routes
app.use('/api/currency', currencyRoutes);

// Invoice processing routes
app.use('/api/invoices', invoiceRoutes);

// Payment processing routes
app.use('/api/payments', paymentRoutes);

// Analytics and reporting routes
app.use('/api/analytics', analyticsRoutes);

// Compliance reporting routes
app.use('/api/compliance', complianceRoutes);

// Security management routes
app.use('/api/security', securityRoutes);

// Maritime integration routes
app.use('/api/maritime', maritimeIntegrationRoutes);

// Financial integration routes
app.use('/api/financial', financialIntegrationRoutes);

// Dashboard routes
app.use('/api/dashboard', dashboardRoutes);

// External API integration routes
app.use('/api/external-api', externalApiRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  
  res.status(500).json({
    error: env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    ...(env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
});

// Initialize security services
console.log('🔒 Initializing security services...');
securityIncidentService.scheduleSecurityAnalysis();
dataRetentionService.scheduleRetentionExecution();
console.log('✅ Security services initialized');

// Initialize performance enhancement service
console.log('⚡ Initializing performance enhancement service...');
performanceService.initialize().then(() => {
  console.log('✅ Performance enhancement service initialized');
}).catch((error) => {
  console.error('❌ Failed to initialize performance enhancement service:', error);
});

// Start server
const server = app.listen(env.PORT, () => {
  console.log(`🚢 FlowMarine API Server running on port ${env.PORT}`);
  console.log(`📊 Environment: ${env.NODE_ENV}`);
  console.log(`🌐 Frontend URL: ${env.FRONTEND_URL}`);
  console.log(`⚡ Server ready at http://localhost:${env.PORT}`);
});

// Initialize WebSocket services
console.log('🔌 Initializing WebSocket services...');
websocketService.initialize(server);
dashboardWebSocketService.initialize(server);
console.log('✅ WebSocket services initialized');

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  performanceService.shutdown().then(() => {
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  performanceService.shutdown().then(() => {
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  });
});

export default app;