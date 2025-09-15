import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateAccessToken, generateRefreshToken, verifyToken, extractTokenPayload } from '@/utils/jwt';

describe('JWT Utils', () => {
  const mockUserId = 'user-123';
  const mockVessels = ['vessel-1', 'vessel-2'];
  const mockRole = 'CAPTAIN';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Generation', () => {
    it('should generate valid access token', () => {
      const token = generateAccessToken(mockUserId, mockVessels, mockRole);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should generate valid refresh token', () => {
      const token = generateRefreshToken(mockUserId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include correct payload in access token', () => {
      const token = generateAccessToken(mockUserId, mockVessels, mockRole);
      const payload = extractTokenPayload(token);
      
      expect(payload.userId).toBe(mockUserId);
      expect(payload.vessels).toEqual(mockVessels);
      expect(payload.role).toBe(mockRole);
      expect(payload.type).toBe('access');
    });

    it('should include correct payload in refresh token', () => {
      const token = generateRefreshToken(mockUserId);
      const payload = extractTokenPayload(token);
      
      expect(payload.userId).toBe(mockUserId);
      expect(payload.type).toBe('refresh');
    });
  });

  describe('Token Verification', () => {
    it('should verify valid tokens', () => {
      const token = generateAccessToken(mockUserId, mockVessels, mockRole);
      const result = verifyToken(token);
      
      expect(result.valid).toBe(true);
      expect(result.payload?.userId).toBe(mockUserId);
    });

    it('should reject invalid tokens', () => {
      const invalidToken = 'invalid.token.here';
      const result = verifyToken(invalidToken);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject malformed tokens', () => {
      const malformedToken = 'not-a-jwt-token';
      const result = verifyToken(malformedToken);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should detect token expiry', () => {
      // Create token with very short expiry
      const shortLivedToken = generateAccessToken(mockUserId, mockVessels, mockRole, '1ms');
      
      // Wait for token to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          const result = verifyToken(shortLivedToken);
          expect(result.valid).toBe(false);
          expect(result.error).toContain('expired');
          resolve(undefined);
        }, 10);
      });
    });
  });

  describe('Token Payload Extraction', () => {
    it('should extract payload without verification', () => {
      const token = generateAccessToken(mockUserId, mockVessels, mockRole);
      const payload = extractTokenPayload(token);
      
      expect(payload.userId).toBe(mockUserId);
      expect(payload.vessels).toEqual(mockVessels);
      expect(payload.role).toBe(mockRole);
    });

    it('should handle malformed tokens gracefully', () => {
      expect(() => extractTokenPayload('invalid-token')).toThrow();
    });
  });
});