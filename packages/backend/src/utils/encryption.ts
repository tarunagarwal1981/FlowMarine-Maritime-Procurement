import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const SECRET_KEY = process.env.ENCRYPTION_SECRET || 'your-secret-key-here-32-characters';
const IV_LENGTH = 16; // For GCM, this is always 16

/**
 * Encrypt sensitive data
 */
export function encrypt(text: string): string {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipher(ALGORITHM, SECRET_KEY);
    cipher.setAAD(Buffer.from('FlowMarine', 'utf8'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Combine iv, authTag, and encrypted data
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  } catch (error) {
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  try {
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher(ALGORITHM, SECRET_KEY);
    decipher.setAAD(Buffer.from('FlowMarine', 'utf8'));
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed');
  }
}

/**
 * Hash sensitive data (one-way)
 */
export function hash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate secure random token
 */
export function generateSecureToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}