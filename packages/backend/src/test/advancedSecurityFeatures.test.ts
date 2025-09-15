import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { advancedThreatDetectionService } from '../services/advancedThreatDetectionService';
import { auditAnalysisService, AuditAnalysisType } from '../services/auditAnalysisService';
import { dataLossPreventionService } from '../services/dataLossPreventionService';
import { securityIncidentResponseService, ResponseType } from '../services/securityIncidentResponseService';
import { securityMonitoringService, SecurityEventType } from '../services/securityMonitoringService';
import { Request } from 'express';

// Mock dependencies
jest.mock('../utils/logger');
jest.mock('../services/auditService');
jest.mock('@prisma/client');

describe('Advanced Security Features', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Advanced Threat Detection Service', () => {
    test('should detect brute force attacks', async () => {
      const mockRequest = {
        ip: '192.168.1.100',
       