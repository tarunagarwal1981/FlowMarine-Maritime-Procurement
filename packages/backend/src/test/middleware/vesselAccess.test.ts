import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { validateVesselAccess } from '@/middleware/vesselAccess';

// Mock audit service
vi.mock('@/services/auditService', () => ({
  auditLogger: {
    log: vi.fn()
  }
}));

describe('Vessel Access Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 'user123',
        vessels: [
          { id: 'vessel1' },
          { id: 'vessel2' }
        ]
      },
      params: {},
      body: {},
      ip: '127.0.0.1'
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn();
  });

  describe('Vessel Access Validation', () => {
    it('should allow access to assigned vessel via params', () => {
      mockRequest.params = { vesselId: 'vessel1' };

      validateVesselAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(403);
    });

    it('should allow access to assigned vessel via body', () => {
      mockRequest.body = { vesselId: 'vessel2' };

      validateVesselAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access to unassigned vessel', () => {
      mockRequest.params = { vesselId: 'vessel3' };

      validateVesselAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access denied to vessel'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow access when no vessel ID is specified', () => {
      // No vesselId in params or body
      validateVesselAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Audit Logging', () => {
    it('should log vessel access denial', () => {
      const { auditLogger } = require('@/services/auditService');
      
      mockRequest.params = { vesselId: 'unauthorized-vessel' };
      const userVessels = ['vessel1', 'vessel2'];

      validateVesselAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(auditLogger.log).toHaveBeenCalledWith({
        userId: 'user123',
        action: 'VESSEL_ACCESS_DENIED',
        vesselId: 'unauthorized-vessel',
        userVessels,
        ip: '127.0.0.1'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user vessels', () => {
      mockRequest.user!.vessels = [];
      mockRequest.params = { vesselId: 'vessel1' };

      validateVesselAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should handle undefined user vessels', () => {
      mockRequest.user!.vessels = undefined as any;
      mockRequest.params = { vesselId: 'vessel1' };

      validateVesselAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should prioritize params over body when both exist', () => {
      mockRequest.params = { vesselId: 'vessel1' }; // allowed
      mockRequest.body = { vesselId: 'vessel3' }; // not allowed

      validateVesselAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled(); // Should use params vesselId
    });
  });

  describe('Maritime Scenarios', () => {
    it('should handle crew rotation scenarios', () => {
      // Simulate crew member with access to multiple vessels during rotation
      mockRequest.user!.vessels = [
        { id: 'vessel-current' },
        { id: 'vessel-next' }
      ];
      mockRequest.params = { vesselId: 'vessel-next' };

      validateVesselAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle superintendent with fleet access', () => {
      // Superintendent typically has access to multiple vessels
      mockRequest.user!.vessels = [
        { id: 'vessel-alpha' },
        { id: 'vessel-beta' },
        { id: 'vessel-gamma' }
      ];
      mockRequest.params = { vesselId: 'vessel-beta' };

      validateVesselAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle single vessel crew member', () => {
      // Regular crew member typically assigned to one vessel
      mockRequest.user!.vessels = [{ id: 'mv-atlantic' }];
      mockRequest.params = { vesselId: 'mv-atlantic' };

      validateVesselAccess(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});