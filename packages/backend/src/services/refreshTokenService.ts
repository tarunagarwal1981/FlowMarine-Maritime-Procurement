import { PrismaClient } from '@prisma/client';
import { generateRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class RefreshTokenService {
  /**
   * Create and store a new refresh token for a user
   */
  static async createRefreshToken(userId: string, deviceInfo?: {
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
  }): Promise<string> {
    // Generate the refresh token
    const token = generateRefreshToken(userId);
    
    // Calculate expiry date (7 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    // Store in database
    await prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
        isRevoked: false,
        ipAddress: deviceInfo?.ipAddress,
        deviceInfo: deviceInfo ? {
          userAgent: deviceInfo.userAgent,
          deviceName: deviceInfo.deviceName
        } : undefined,
        lastUsed: new Date()
      }
    });
    
    return token;
  }
  
  /**
   * Validate refresh token and return user data if valid
   */
  static async validateRefreshToken(token: string): Promise<{ userId: string } | null> {
    try {
      // First verify the JWT signature and structure
      const { userId } = verifyRefreshToken(token);
      
      // Check if token exists in database and is not revoked
      const storedToken = await prisma.refreshToken.findUnique({
        where: { token },
        include: {
          user: {
            select: {
              id: true,
              isActive: true
            }
          }
        }
      });
      
      if (!storedToken) {
        return null;
      }
      
      // Check if token is revoked
      if (storedToken.isRevoked) {
        return null;
      }
      
      // Check if token is expired
      if (storedToken.expiresAt < new Date()) {
        // Clean up expired token
        await this.revokeRefreshToken(token);
        return null;
      }
      
      // Check if user is still active
      if (!storedToken.user.isActive) {
        await this.revokeRefreshToken(token);
        return null;
      }
      
      // Update last used timestamp
      await prisma.refreshToken.update({
        where: { token },
        data: { lastUsed: new Date() }
      });
      
      return { userId };
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Revoke a refresh token
   */
  static async revokeRefreshToken(token: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { token },
      data: { isRevoked: true }
    });
  }
  
  /**
   * Revoke all refresh tokens for a user (useful for logout all devices)
   */
  static async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { 
        userId,
        isRevoked: false
      },
      data: { 
        isRevoked: true,
        revokedAt: new Date()
      }
    });
  }
  
  /**
   * Revoke all refresh tokens for a user except the specified one
   */
  static async revokeAllUserTokensExcept(userId: string, exceptToken?: string): Promise<void> {
    const whereClause: any = {
      userId,
      isRevoked: false
    };
    
    if (exceptToken) {
      whereClause.token = { not: exceptToken };
    }
    
    await prisma.refreshToken.updateMany({
      where: whereClause,
      data: { 
        isRevoked: true,
        revokedAt: new Date()
      }
    });
  }
  
  /**
   * Rotate refresh token - revoke old and create new
   */
  static async rotateRefreshToken(oldToken: string): Promise<string | null> {
    const userId = await this.validateRefreshToken(oldToken);
    
    if (!userId) {
      return null;
    }
    
    // Revoke the old token
    await this.revokeRefreshToken(oldToken);
    
    // Create new token
    return this.createRefreshToken(userId);
  }
  
  /**
   * Clean up expired tokens (should be run periodically)
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const result = await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isRevoked: true }
        ]
      }
    });
    
    return result.count;
  }
  
  /**
   * Get active token count for a user
   */
  static async getActiveTokenCount(userId: string): Promise<number> {
    return prisma.refreshToken.count({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() }
      }
    });
  }
  
  /**
   * Limit the number of active tokens per user (security measure)
   */
  static async enforceTokenLimit(userId: string, maxTokens: number = 5): Promise<void> {
    const tokens = await prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    if (tokens.length >= maxTokens) {
      // Revoke oldest tokens to stay within limit
      const tokensToRevoke = tokens.slice(0, tokens.length - maxTokens + 1);
      const tokenIds = tokensToRevoke.map(t => t.token);
      
      await prisma.refreshToken.updateMany({
        where: { token: { in: tokenIds } },
        data: { isRevoked: true }
      });
    }
  }
}