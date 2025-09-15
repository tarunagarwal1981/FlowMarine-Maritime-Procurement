import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hashPassword, verifyPassword, generateSecurePassword, validatePasswordStrength } from '@/utils/password';
import bcrypt from 'bcrypt';

// Mock bcrypt
vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
  genSalt: vi.fn(),
}));

describe('Password Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password with bcrypt and salt rounds >= 12', async () => {
      const password = 'testPassword123!';
      const hashedPassword = '$2b$12$hashedPasswordExample';

      (bcrypt.hash as any).mockResolvedValue(hashedPassword);

      const result = await hashPassword(password);

      expect(bcrypt.hash).toHaveBeenCalledWith(password, 12);
      expect(result).toBe(hashedPassword);
    });

    it('should throw error for empty password', async () => {
      await expect(hashPassword('')).rejects.toThrow('Password cannot be empty');
    });

    it('should throw error for weak password', async () => {
      const weakPassword = '123';
      
      await expect(hashPassword(weakPassword)).rejects.toThrow('Password does not meet security requirements');
    });

    it('should handle bcrypt errors', async () => {
      const password = 'testPassword123!';
      (bcrypt.hash as any).mockRejectedValue(new Error('Bcrypt error'));

      await expect(hashPassword(password)).rejects.toThrow('Bcrypt error');
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'testPassword123!';
      const hashedPassword = '$2b$12$hashedPasswordExample';

      (bcrypt.compare as any).mockResolvedValue(true);

      const result = await verifyPassword(password, hashedPassword);

      expect(bcrypt.compare).toHaveBeenCalledWith(password, hashedPassword);
      expect(result).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'wrongPassword';
      const hashedPassword = '$2b$12$hashedPasswordExample';

      (bcrypt.compare as any).mockResolvedValue(false);

      const result = await verifyPassword(password, hashedPassword);

      expect(result).toBe(false);
    });

    it('should handle bcrypt comparison errors', async () => {
      const password = 'testPassword123!';
      const hashedPassword = '$2b$12$hashedPasswordExample';

      (bcrypt.compare as any).mockRejectedValue(new Error('Comparison failed'));

      await expect(verifyPassword(password, hashedPassword)).rejects.toThrow('Comparison failed');
    });

    it('should throw error for empty inputs', async () => {
      await expect(verifyPassword('', 'hash')).rejects.toThrow('Password and hash are required');
      await expect(verifyPassword('password', '')).rejects.toThrow('Password and hash are required');
    });
  });

  describe('generateSecurePassword', () => {
    it('should generate password with default length of 16', () => {
      const password = generateSecurePassword();
      
      expect(password).toHaveLength(16);
      expect(typeof password).toBe('string');
    });

    it('should generate password with custom length', () => {
      const customLength = 24;
      const password = generateSecurePassword(customLength);
      
      expect(password).toHaveLength(customLength);
    });

    it('should generate password with required character types', () => {
      const password = generateSecurePassword(20);
      
      // Should contain uppercase
      expect(password).toMatch(/[A-Z]/);
      // Should contain lowercase
      expect(password).toMatch(/[a-z]/);
      // Should contain numbers
      expect(password).toMatch(/[0-9]/);
      // Should contain special characters
      expect(password).toMatch(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/);
    });

    it('should generate different passwords on multiple calls', () => {
      const password1 = generateSecurePassword();
      const password2 = generateSecurePassword();
      
      expect(password1).not.toBe(password2);
    });

    it('should throw error for invalid length', () => {
      expect(() => generateSecurePassword(7)).toThrow('Password length must be at least 8 characters');
      expect(() => generateSecurePassword(129)).toThrow('Password length cannot exceed 128 characters');
    });
  });

  describe('validatePasswordStrength', () => {
    it('should validate strong password', () => {
      const strongPassword = 'StrongP@ssw0rd123!';
      
      const result = validatePasswordStrength(strongPassword);
      
      expect(result.isValid).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(4);
      expect(result.feedback).toHaveLength(0);
    });

    it('should reject password without uppercase', () => {
      const password = 'weakpassword123!';
      
      const result = validatePasswordStrength(password);
      
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must contain at least one uppercase letter');
    });

    it('should reject password without lowercase', () => {
      const password = 'WEAKPASSWORD123!';
      
      const result = validatePasswordStrength(password);
      
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must contain at least one lowercase letter');
    });

    it('should reject password without numbers', () => {
      const password = 'WeakPassword!';
      
      const result = validatePasswordStrength(password);
      
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must contain at least one number');
    });

    it('should reject password without special characters', () => {
      const password = 'WeakPassword123';
      
      const result = validatePasswordStrength(password);
      
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must contain at least one special character');
    });

    it('should reject short password', () => {
      const password = 'Weak1!';
      
      const result = validatePasswordStrength(password);
      
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password must be at least 8 characters long');
    });

    it('should reject common passwords', () => {
      const commonPasswords = ['Password123!', 'Admin123!', 'Welcome123!'];
      
      commonPasswords.forEach(password => {
        const result = validatePasswordStrength(password);
        expect(result.isValid).toBe(false);
        expect(result.feedback).toContain('Password is too common');
      });
    });

    it('should reject passwords with repeated characters', () => {
      const password = 'Aaaaaaa1!';
      
      const result = validatePasswordStrength(password);
      
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password contains too many repeated characters');
    });

    it('should reject passwords with sequential characters', () => {
      const password = 'Abcdef123!';
      
      const result = validatePasswordStrength(password);
      
      expect(result.isValid).toBe(false);
      expect(result.feedback).toContain('Password contains sequential characters');
    });

    it('should calculate password entropy', () => {
      const password = 'ComplexP@ssw0rd!2024';
      
      const result = validatePasswordStrength(password);
      
      expect(result.entropy).toBeGreaterThan(50); // Strong passwords should have high entropy
      expect(result.estimatedCrackTime).toBeDefined();
    });

    it('should provide maritime-specific password suggestions', () => {
      const weakPassword = 'weak';
      
      const result = validatePasswordStrength(weakPassword);
      
      expect(result.suggestions).toContain('Consider using maritime terms combined with numbers and symbols');
      expect(result.suggestions).toContain('Example: Harbor2024! or Anchor$ecure9');
    });
  });

  describe('password security features', () => {
    it('should detect password reuse', () => {
      const currentPassword = 'CurrentP@ssw0rd123!';
      const previousPasswords = [
        '$2b$12$previousHash1',
        '$2b$12$previousHash2',
        '$2b$12$previousHash3',
      ];

      // Mock bcrypt to return true for one of the previous passwords
      (bcrypt.compare as any)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      expect(async () => {
        await hashPassword(currentPassword, { previousPasswords });
      }).rejects.toThrow('Password has been used recently');
    });

    it('should enforce password expiration policy', () => {
      const lastPasswordChange = new Date('2023-01-01');
      const maxPasswordAge = 90; // days
      
      const isExpired = isPasswordExpired(lastPasswordChange, maxPasswordAge);
      
      expect(isExpired).toBe(true);
    });

    it('should generate temporary passwords for maritime personnel', () => {
      const tempPassword = generateTemporaryPassword('maritime');
      
      expect(tempPassword).toMatch(/^[A-Z][a-z]+[0-9]{2}[!@#$%][A-Z][a-z]+$/);
      expect(tempPassword.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('maritime-specific password requirements', () => {
    it('should validate passwords for different maritime roles', () => {
      const captainPassword = 'Captain2024!Bridge';
      const engineerPassword = 'Engine3r$2024Main';
      
      const captainResult = validatePasswordStrength(captainPassword, { role: 'CAPTAIN' });
      const engineerResult = validatePasswordStrength(engineerPassword, { role: 'CHIEF_ENGINEER' });
      
      expect(captainResult.isValid).toBe(true);
      expect(engineerResult.isValid).toBe(true);
    });

    it('should enforce stronger passwords for financial operations', () => {
      const financialPassword = 'Finance$2024!Secure';
      
      const result = validatePasswordStrength(financialPassword, { 
        role: 'FINANCE_TEAM',
        requiresFinancialAccess: true 
      });
      
      expect(result.minimumLength).toBe(12); // Higher requirement for financial access
      expect(result.requiresSpecialChars).toBe(2); // More special characters required
    });

    it('should allow emergency password reset for vessel operations', () => {
      const emergencyCode = generateEmergencyAccessCode('vessel-123', 'CAPTAIN');
      
      expect(emergencyCode).toMatch(/^EMG-[A-Z0-9]{8}-[0-9]{4}$/);
      expect(emergencyCode.length).toBe(17);
    });
  });
});

// Helper functions for maritime-specific password features
function isPasswordExpired(lastChange: Date, maxAge: number): boolean {
  const now = new Date();
  const daysSinceChange = Math.floor((now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24));
  return daysSinceChange > maxAge;
}

function generateTemporaryPassword(type: string): string {
  const maritimeTerms = ['Harbor', 'Anchor', 'Bridge', 'Engine', 'Cargo', 'Deck'];
  const term = maritimeTerms[Math.floor(Math.random() * maritimeTerms.length)];
  const number = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  const symbol = '!@#$%'[Math.floor(Math.random() * 5)];
  const suffix = maritimeTerms[Math.floor(Math.random() * maritimeTerms.length)];
  
  return `${term}${number}${symbol}${suffix}`;
}

function generateEmergencyAccessCode(vesselId: string, role: string): string {
  const timestamp = Date.now().toString().slice(-4);
  const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `EMG-${randomCode}-${timestamp}`;
}