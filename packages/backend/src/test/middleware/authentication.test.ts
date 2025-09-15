import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticateToken } from '@/middleware/authentication';
import { generateAccessToken } from '@/utils/jwt';

// Mock dependencies
vi.mock('@/services/refreshTokenService');
vi.mock('@/utils/logger');

describe('Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      user: undefined
    };
    mockResponse = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn()
    };
    mockNext = vi.fn();
  });

  describe('Token Validation', () => {
    it('should authenticate valid token', async () => {
      const token = generateAccessToken('user123', ['vessel1'], 'CAPTAIN');
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(401);
    });

    it('should reject request without token', async () => {
      mockRequest.headers = {};

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Access token required'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject malformed authorization header', async () => {
      mockRequest.headers = {
        authorization: 'InvalidFormat'
      };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should reject invalid token', async () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid.token.here'
      };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('Token Refresh', () => {
    it('should provide new token when current token is close to expiry', async () => {
      // Create token with short expiry
      const shortToken = generateAccessToken('user123', ['vessel1'], 'CAPTAIN', '5m');
      mockRequest.headers = {
        authorization: `Bearer ${shortToken}`
      };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      // Should set new token header if refresh is available
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('User Context', () => {
    it('should set user context on successful authentication', async () => {
      const token = generateAccessToken('user123', ['vessel1'], 'CAPTAIN');
      mockRequest.headers = {
        authorization: `Bearer ${token}`
      };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeDefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Security Headers', () => {
    it('should handle case-insensitive authorization header', async () => {
      const token = generateAccessToken('user123', ['vessel1'], 'CAPTAIN');
      mockRequest.headers = {
        Authorization: `Bearer ${token}` // Capital A
      };

      await authenticateToken(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});