// Security utilities for Cloud Gallery
// Provides cryptographic functions for password hashing, token generation, etc.

import { createHash, randomBytes, pbkdf2 } from 'crypto';
import { promisify } from 'util';

const pbkdf2Async = promisify(pbkdf2);

/**
 * Security configuration constants
 */
export const SECURITY_CONFIG = {
  // Password hashing
  PBKDF2_ITERATIONS: 100000,
  PBKDF2_KEY_LENGTH: 64,
  PBKDF2_DIGEST: 'sha512',
  SALT_LENGTH: 32,
  
  // Token generation
  TOKEN_LENGTH: 32,
  
  // Session
  SESSION_TOKEN_LENGTH: 48,
  ACCESS_TOKEN_TTL: 15 * 60, // 15 minutes in seconds
  REFRESH_TOKEN_TTL: 7 * 24 * 60 * 60, // 7 days in seconds
} as const;

/**
 * Hash a password using PBKDF2
 * 
 * @param password - Plain text password to hash
 * @returns Promise resolving to hashed password in format: `salt:hash`
 * 
 * @example
 * const hashedPassword = await hashPassword('user-password-123');
 * // Store hashedPassword in database
 */
export async function hashPassword(password: string): Promise<string> {
  // Generate random salt
  const salt = randomBytes(SECURITY_CONFIG.SALT_LENGTH);
  
  // Hash password with PBKDF2
  const hash = await pbkdf2Async(
    password,
    salt,
    SECURITY_CONFIG.PBKDF2_ITERATIONS,
    SECURITY_CONFIG.PBKDF2_KEY_LENGTH,
    SECURITY_CONFIG.PBKDF2_DIGEST
  );
  
  // Return salt and hash as hex strings separated by colon
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

/**
 * Verify a password against a stored hash
 * 
 * @param password - Plain text password to verify
 * @param storedHash - Stored hash in format: `salt:hash`
 * @returns Promise resolving to true if password matches, false otherwise
 * 
 * @example
 * const isValid = await verifyPassword('user-password-123', storedHash);
 * if (isValid) {
 *   // Password is correct
 * }
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    // Split stored hash into salt and hash
    const [saltHex, hashHex] = storedHash.split(':');
    
    if (!saltHex || !hashHex) {
      return false;
    }
    
    const salt = Buffer.from(saltHex, 'hex');
    const storedHashBuffer = Buffer.from(hashHex, 'hex');
    
    // Hash the provided password with the stored salt
    const hash = await pbkdf2Async(
      password,
      salt,
      SECURITY_CONFIG.PBKDF2_ITERATIONS,
      SECURITY_CONFIG.PBKDF2_KEY_LENGTH,
      SECURITY_CONFIG.PBKDF2_DIGEST
    );
    
    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(hash, storedHashBuffer);
  } catch (error) {
    // Log error but don't expose details
    console.error('Password verification error:', error);
    return false;
  }
}

/**
 * Timing-safe buffer comparison to prevent timing attacks
 * 
 * @param a - First buffer
 * @param b - Second buffer
 * @returns true if buffers are equal, false otherwise
 */
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  
  return result === 0;
}

/**
 * Generate a cryptographically secure random token
 * 
 * @param length - Length of token in bytes (default: 32)
 * @returns Hex-encoded random token
 * 
 * @example
 * const sessionToken = generateSecureToken();
 * const apiKey = generateSecureToken(48);
 */
export function generateSecureToken(
  length: number = SECURITY_CONFIG.TOKEN_LENGTH
): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a session token with metadata
 * 
 * @returns Object containing token and expiry timestamp
 * 
 * @example
 * const session = generateSessionToken();
 * // Store session.token and session.expiresAt
 */
export function generateSessionToken(): {
  token: string;
  expiresAt: number;
} {
  return {
    token: generateSecureToken(SECURITY_CONFIG.SESSION_TOKEN_LENGTH),
    expiresAt: Date.now() + SECURITY_CONFIG.ACCESS_TOKEN_TTL * 1000,
  };
}

/**
 * Hash data using SHA-256 (for non-password data like tokens)
 * 
 * @param data - Data to hash
 * @returns Hex-encoded SHA-256 hash
 * 
 * @example
 * const tokenHash = sha256('api-token-123');
 * // Store tokenHash instead of plain token
 */
export function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Sanitize string for logging (remove sensitive data)
 * 
 * @param str - String to sanitize
 * @returns Sanitized string with sensitive data masked
 * 
 * @example
 * const safe = sanitizeForLogging(userEmail);
 * console.log('User:', safe); // "User: u***@e***.com"
 */
export function sanitizeForLogging(str: string): string {
  // Email addresses
  str = str.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    (_, user, domain) => {
      const maskedUser = user.charAt(0) + '***';
      const maskedDomain = domain.charAt(0) + '***.' + domain.split('.').pop();
      return `${maskedUser}@${maskedDomain}`;
    }
  );
  
  // IP addresses
  str = str.replace(
    /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    (ip) => ip.split('.').slice(0, 2).join('.') + '.***.***'
  );
  
  // Credit card numbers
  str = str.replace(
    /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    '****-****-****-****'
  );
  
  // Phone numbers
  str = str.replace(
    /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    '***-***-****'
  );
  
  return str;
}

/**
 * Validate password strength
 * 
 * @param password - Password to validate
 * @returns Object with isValid flag and error messages
 * 
 * @example
 * const result = validatePasswordStrength('weak');
 * if (!result.isValid) {
 *   console.error('Password errors:', result.errors);
 * }
 */
export function validatePasswordStrength(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (password.length > 128) {
    errors.push('Password must be at most 128 characters long');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  // Check for common weak passwords
  const weakPasswords = ['password', '12345678', 'qwerty', 'abc123'];
  if (weakPasswords.includes(password.toLowerCase())) {
    errors.push('Password is too common');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}
