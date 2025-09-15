import { describe, it, expect, beforeEach } from 'vitest';
import { encrypt, decrypt, hashPassword, verifyPassword } from '@/utils/encryption';

describe('Encryption Utils', () => {
  describe('Field Encryption', () => {
    it('should encrypt and decrypt data correctly', () => {
      const originalData = 'sensitive banking information';
      const encrypted = encrypt(originalData);
      const decrypted = decrypt(encrypted);
      
      expect(encrypted).not.toBe(originalData);
      expect(decrypted).toBe(originalData);
    });

    it('should produce different encrypted values for same input', () => {
      const data = 'test data';
      const encrypted1 = encrypt(data);
      const encrypted2 = encrypt(data);
      
      expect(encrypted1).not.toBe(encrypted2);
      expect(decrypt(encrypted1)).toBe(data);
      expect(decrypt(encrypted2)).toBe(data);
    });

    it('should handle empty strings', () => {
      const encrypted = encrypt('');
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe('');
    });

    it('should handle special characters and unicode', () => {
      const specialData = '🚢 Maritime Data: €1,234.56 - Account#: IBAN-GB29-NWBK-6016-1331-9268-19';
      const encrypted = encrypt(specialData);
      const decrypted = decrypt(encrypted);
      
      expect(decrypted).toBe(specialData);
    });
  });

  describe('Password Hashing', () => {
    it('should hash passwords securely', async () => {
      const password = 'SecurePassword123!';
      const hash = await hashPassword(password);
      
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
      expect(hash.startsWith('$2b$')).toBe(true);
    });

    it('should verify correct passwords', async () => {
      const password = 'TestPassword456!';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(password, hash);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect passwords', async () => {
      const password = 'CorrectPassword';
      const wrongPassword = 'WrongPassword';
      const hash = await hashPassword(password);
      const isValid = await verifyPassword(wrongPassword, hash);
      
      expect(isValid).toBe(false);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'SamePassword123';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
      expect(await verifyPassword(password, hash1)).toBe(true);
      expect(await verifyPassword(password, hash2)).toBe(true);
    });
  });
});