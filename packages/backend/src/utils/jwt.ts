import jwt from 'jsonwebtoken';
import { z } from 'zod';

// JWT payload schema for validation
export const JWTPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  role: z.enum([
    'VESSEL_CREW',
    'CHIEF_ENGINEER', 
    'CAPTAIN',
    'SUPERINTENDENT',
    'PROCUREMENT_MANAGER',
    'FINANCE_TEAM',
    'ADMIN'
  ]),
  vessels: z.array(z.string()).optional(),
  permissions: z.array(z.string()).optional(),
  iat: z.number(),
  exp: z.number()
});

export type JWTPayload = z.infer<typeof JWTPayloadSchema>;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Generate JWT access token with user information
 */
export const generateAccessToken = (payload: {
  userId: string;
  email: string;
  role: string;
  vessels?: string[];
  permissions?: string[];
}): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      vessels: payload.vessels || [],
      permissions: payload.permissions || []
    },
    secret,
    {
      expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
      issuer: 'flowmarine',
      audience: 'flowmarine-users'
    }
  );
};

/**
 * Generate JWT refresh token
 */
export const generateRefreshToken = (userId: string): string => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }

  return jwt.sign(
    { userId, type: 'refresh' },
    secret,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
      issuer: 'flowmarine',
      audience: 'flowmarine-users'
    }
  );
};

/**
 * Verify and decode JWT access token
 */
export const verifyAccessToken = (token: string): JWTPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'flowmarine',
      audience: 'flowmarine-users'
    }) as any;

    // Validate the payload structure
    return JWTPayloadSchema.parse(decoded);
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    throw error;
  }
};

/**
 * Verify refresh token
 */
export const verifyRefreshToken = (token: string): { userId: string } => {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is required');
  }

  try {
    const decoded = jwt.verify(token, secret, {
      issuer: 'flowmarine',
      audience: 'flowmarine-users'
    }) as any;

    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    return { userId: decoded.userId };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    throw error;
  }
};

/**
 * Check if token is close to expiry (within 5 minutes)
 */
export const isTokenNearExpiry = (token: string): boolean => {
  try {
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return true;
    
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = decoded.exp - now;
    
    // Return true if token expires within 5 minutes (300 seconds)
    return timeUntilExpiry <= 300;
  } catch {
    return true;
  }
};

/**
 * Extract token from Authorization header
 */
export const extractTokenFromHeader = (authHeader: string | undefined): string | null => {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
};