-- Initialize FlowMarine database with required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create additional schemas for organization
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS reporting;

-- Set timezone
SET timezone = 'UTC';

-- Create initial indexes for performance
-- These will be expanded when Prisma migrations are run