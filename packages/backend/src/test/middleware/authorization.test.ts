import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authorizeRole } from '@/middleware/authorization';

// Mock audit service
vi.mock('@/services/auditService', () => ({
  auditLogger: {
    log: vi.fn()
  }
}));

describe('Authorization Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 'user123',
        permissions: []
      },
      path: '/test-path',
      ip: '127.0.0.1'
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis()
    };
    mockNext = vi.fn();
  });

  describe('Permission Validation', () => {
    it('should allow access with correct permissions', () => {
      mockRequest.user!.permissions = [
        { name: 'requisition:create' },
        { name: 'requisition:read' }
      ];

      const middleware = authorizeRole(['requisition:create']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(403);
    });

    it('should deny access without required permissions', () => {
      mockRequest.user!.permissions = [
        { name: 'requisition:read' }
      ];

      const middleware = authorizeRole(['requisition:create']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Insufficient permissions'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should allow access if user has any of the required permissions', () => {
      mockRequest.user!.permissions = [
        { name: 'requisition:read' },
        { name: 'vessel:manage' }
      ];

      const middleware = authorizeRole(['requisition:create', 'vessel:manage']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny access if user has none of the required permissions', () => {
      mockRequest.user!.permissions = [
        { name: 'requisition:read' }
      ];

      const middleware = authorizeRole(['requisition:create', 'vessel:manage']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Audit Logging', () => {
    it('should log unauthorized access attempts', () => {
      const { auditLogger } = require('@/services/auditService');
      
      mockRequest.user!.permissions = [];
      const requiredPermissions = ['admin:access'];

      const middleware = authorizeRole(requiredPermissions);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(auditLogger.log).toHaveBeenCalledWith({
        userId: 'user123',
        action: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        resource: '/test-path',
        requiredPermissions,
        userPermissions: [],
        ip: '127.0.0.1'
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty permissions array', () => {
      mockRequest.user!.permissions = [];

      const middleware = authorizeRole(['any:permission']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('should handle empty required permissions', () => {
      mockRequest.user!.permissions = [{ name: 'some:permission' }];

      const middleware = authorizeRole([]);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should handle missing user permissions property', () => {
      mockRequest.user!.permissions = undefined as any;

      const middleware = authorizeRole(['any:permission']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });

  describe('Maritime-Specific Permissions', () => {
    it('should validate captain emergency override permissions', () => {
      mockRequest.user!.permissions = [
        { name: 'emergency:override' },
        { name: 'captain:authority' }
      ];

      const middleware = authorizeRole(['emergency:override']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate procurement manager permissions', () => {
      mockRequest.user!.permissions = [
        { name: 'procurement:manage' },
        { name: 'vendor:approve' },
        { name: 'budget:allocate' }
      ];

      const middleware = authorizeRole(['procurement:manage']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should validate crew member basic permissions', () => {
      mockRequest.user!.permissions = [
        { name: 'requisition:create' },
        { name: 'requisition:read' }
      ];

      const middleware = authorizeRole(['requisition:create']);
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});