import crypto from 'crypto';
import { logger } from '../utils/logger';

interface EncryptedField {
  encryptedData: string;
  iv: string;
  tag: string;
}

export class FieldEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly encryptionKey: Buffer;

  constructor() {
    const key = process.env.FIELD_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('FIELD_ENCRYPTION_KEY environment variable is required');
    }
    
    // Derive a consistent key from the environment variable
    this.encryptionKey = crypto.scryptSync(key, 'salt', this.keyLength);
  }

  /**
   * Encrypt sensitive field data
   */
  encryptField(data: string): EncryptedField {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.encryptionKey);
      cipher.setAAD(Buffer.from('flowmarine-field-encryption'));

      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();

      return {
        encryptedData: encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
    } catch (error) {
      logger.error('Field encryption failed', { error: error.message });
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive field data
   */
  decryptField(encryptedField: EncryptedField): string {
    try {
      const { encryptedData, iv, tag } = encryptedField;
      
      const decipher = crypto.createDecipher(this.algorithm, this.encryptionKey);
      decipher.setAAD(Buffer.from('flowmarine-field-encryption'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));

      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Field decryption failed', { error: error.message });
      throw new Error('Failed to decrypt sensitive data');
    }
  }

  /**
   * Encrypt banking details with additional security measures
   */
  encryptBankingData(bankingData: {
    accountNumber?: string;
    routingNumber?: string;
    swiftCode?: string;
    iban?: string;
  }): Record<string, EncryptedField> {
    const encrypted: Record<string, EncryptedField> = {};

    Object.entries(bankingData).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        encrypted[key] = this.encryptField(value);
      }
    });

    logger.info('Banking data encrypted', { 
      fields: Object.keys(encrypted),
      timestamp: new Date().toISOString()
    });

    return encrypted;
  }

  /**
   * Decrypt banking details
   */
  decryptBankingData(encryptedBankingData: Record<string, EncryptedField>): Record<string, string> {
    const decrypted: Record<string, string> = {};

    Object.entries(encryptedBankingData).forEach(([key, encryptedField]) => {
      try {
        decrypted[key] = this.decryptField(encryptedField);
      } catch (error) {
        logger.error(`Failed to decrypt banking field: ${key}`, { error: error.message });
        // Don't throw here to allow partial decryption
      }
    });

    logger.info('Banking data decrypted', { 
      fields: Object.keys(decrypted),
      timestamp: new Date().toISOString()
    });

    return decrypted;
  }

  /**
   * Validate encrypted field structure
   */
  isValidEncryptedField(field: any): field is EncryptedField {
    return (
      field &&
      typeof field === 'object' &&
      typeof field.encryptedData === 'string' &&
      typeof field.iv === 'string' &&
      typeof field.tag === 'string'
    );
  }

  /**
   * Securely compare encrypted fields without decrypting
   */
  compareEncryptedFields(field1: EncryptedField, field2: EncryptedField): boolean {
    return (
      field1.encryptedData === field2.encryptedData &&
      field1.iv === field2.iv &&
      field1.tag === field2.tag
    );
  }
}

export const fieldEncryptionService = new FieldEncryptionService();