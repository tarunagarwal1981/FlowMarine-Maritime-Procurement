import { z } from 'zod';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('Invalid database URL'),
  DATABASE_URL_TEST: z.string().url('Invalid test database URL').optional(),
  REDIS_URL: z.string().url('Invalid Redis URL'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT refresh secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().min(1).max(65535)).default('3001'),
  FRONTEND_URL: z.string().url('Invalid frontend URL'),

  // Email
  SMTP_HOST: z.string().min(1, 'SMTP host is required'),
  SMTP_PORT: z.string().transform(Number).pipe(z.number().int().min(1).max(65535)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email('Invalid SMTP from email'),

  // File Upload
  MAX_FILE_SIZE: z.string().transform(Number).pipe(z.number().int().positive()).default('10485760'),
  UPLOAD_PATH: z.string().default('./uploads'),

  // Security
  BCRYPT_ROUNDS: z.string().transform(Number).pipe(z.number().int().min(10).max(15)).default('12'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().int().positive()).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().int().positive()).default('100'),

  // Audit
  AUDIT_LOG_RETENTION_DAYS: z.string().transform(Number).pipe(z.number().int().positive()).default('2555'),
  ENABLE_AUDIT_LOGGING: z.string().transform(val => val === 'true').default('true'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // External APIs (optional for development)
  EXCHANGE_RATE_API_KEY: z.string().optional(),
  IMPA_API_KEY: z.string().optional(),
  ISSA_API_KEY: z.string().optional(),
  PORT_DATABASE_API_KEY: z.string().optional(),

  // Performance Enhancement
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().int().min(1).max(65535)).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).pipe(z.number().int().min(0).max(15)).default('0'),

  // CDN Configuration
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_CLOUDFRONT_DISTRIBUTION_ID: z.string().optional(),

  // Performance Monitoring
  ENABLE_PERFORMANCE_MONITORING: z.string().transform(val => val === 'true').default('true'),
  ENABLE_CONTINUOUS_TESTING: z.string().transform(val => val === 'true').default('false'),
  PERFORMANCE_TEST_INTERVAL: z.string().transform(Number).pipe(z.number().int().positive()).default('60'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let env: EnvConfig;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Invalid environment configuration:');
    error.errors.forEach((err) => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

export { env };

// Validate critical security settings in production
if (env.NODE_ENV === 'production') {
  const productionChecks = [
    { key: 'JWT_SECRET', value: env.JWT_SECRET, check: (val: string) => val !== 'your-super-secret-jwt-key-change-in-production' },
    { key: 'JWT_REFRESH_SECRET', value: env.JWT_REFRESH_SECRET, check: (val: string) => val !== 'your-super-secret-refresh-key-change-in-production' },
  ];

  const failedChecks = productionChecks.filter(({ check, value }) => !check(value));
  
  if (failedChecks.length > 0) {
    console.error('❌ Production security check failed:');
    failedChecks.forEach(({ key }) => {
      console.error(`  ${key} must be changed from default value in production`);
    });
    process.exit(1);
  }
}

export default env;