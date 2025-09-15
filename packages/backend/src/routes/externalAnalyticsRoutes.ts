import { Router, Request, Response, NextFunction } from 'express';
import { ExternalAnalyticsAPIService } from '../services/externalAnalyticsApiService';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { Pool } from 'pg';
import { query, validationResult } from 'express-validator';

// Custom middleware for API key authentication