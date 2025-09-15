import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * Hash password using bcrypt with 12+ rounds for security
 */
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
  
  // Ensure minimum 12 rounds for maritime security requirements
  if (saltRounds < 12) {
    throw new Error('BCRYPT_ROUNDS must be at least 12 for security compliance');
  }
  
  return bcrypt.hash(password, saltRounds);
};

/**
 * Verify password against hash
 */
export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

/**
 * Generate secure random token for password reset, email verification, etc.
 */
export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate secure random token with expiry
 */
export const generateTokenWithExpiry = (expiryHours: number = 24): {
  token: string;
  expiresAt: Date;
} => {
  const token = generateSecureToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiryHours);
  
  return { token, expiresAt };
};

/**
 * Validate password strength for maritime security requirements
 */
export const validatePasswordStrength = (password: string): {
  isValid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];
  
  // Minimum length
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  // Maximum length (prevent DoS)
  if (password.length > 128) {
    errors.push('Password must be less than 128 characters long');
  }
  
  // Must contain uppercase letter
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  // Must contain lowercase letter
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  // Must contain number
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  // Must contain special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common patterns
  const commonPatterns = [
    /123456/,
    /password/i,
    /qwerty/i,
    /admin/i,
    /maritime/i,
    /vessel/i,
    /ship/i
  ];
  
  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains common patterns and is not secure');
      break;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Generate temporary password for new users
 */
export const generateTemporaryPassword = (): string => {
  const length = 12;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Ensure at least one character from each required category
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]; // Uppercase
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)]; // Lowercase
  password += '0123456789'[Math.floor(Math.random() * 10)]; // Number
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)]; // Special
  
  // Fill remaining length with random characters
  for (let i = 4; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password to avoid predictable patterns
  return password.split('').sort(() => Math.random() - 0.5).join('');
};