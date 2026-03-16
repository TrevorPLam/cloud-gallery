// Zero-knowledge key derivation and management system with biometric support.
// Implements hierarchical key derivation using Argon2id with OWASP parameters.

import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import * as LocalAuthentication from "expo-local-authentication";
import { generateEncryptionKey, XCHACHA20_KEYBYTES } from "./encryption";

// Key hierarchy constants
export const KEY_DERIVATION_SALT_BYTES = 16;
export const KEY_DERIVATION_INFO_BYTES = 32;
export const MASTER_KEY_SALT = "cloud_gallery_master_key_salt";
export const FILE_KEY_CONTEXT = "cloud_gallery_file_encryption";
export const SHARING_KEY_CONTEXT = "cloud_gallery_sharing";
export const DEVICE_KEY_CONTEXT = "cloud_gallery_device";

// Storage keys
export const MASTER_KEY_DERIVATION_SALT = "master_key_derivation_salt";
export const MASTER_KEY_ENCRYPTED = "master_key_encrypted";
export const BIOMETRIC_ENROLLMENT_KEY = "biometric_enrollment_status";

// OWASP recommended Argon2id parameters for mobile (2024)
export const ARGON2ID_CONFIG = {
  memoryCost: 64 * 1024, // 64MB - balanced for mobile devices
  timeCost: 3, // 3 iterations - OWASP recommended minimum
  parallelism: 2, // 2 threads - good balance for mobile CPUs
  hashLength: XCHACHA20_KEYBYTES, // 32 bytes for XChaCha20-Poly1305
  type: "argon2id" as const,
} as const;

/**
 * Key hierarchy types for different encryption purposes
 */
export enum KeyType {
  MASTER = "master",
  FILE = "file",
  SHARING = "sharing",
  DEVICE = "device",
}

/**
 * Key derivation result with metadata
 */
export interface DerivedKey {
  key: string; // Hex-encoded key
  salt: string; // Hex-encoded salt
  context: string; // Derivation context
  timestamp: number; // Creation timestamp
}

/**
 * Biometric authentication result
 */
export interface BiometricResult {
  success: boolean;
  error?: string;
  biometricType?: string[];
}

/**
 * Enhanced Argon2id key derivation with context-specific salts
 * @param password - User password or master key
 * @param salt - Salt for key derivation (16 bytes)
 * @param context - Context string for domain separation
 * @param keyLength - Desired key length in bytes
 * @returns Derived key as hex string
 */
export async function deriveKeyWithContext(
  password: string,
  salt: string,
  context: string,
  keyLength: number = XCHACHA20_KEYBYTES,
): Promise<string> {
  try {
    // Import argon2 dynamically since it's a heavy dependency
    const { argon2 } = await import("argon2");

    const saltBuffer = Buffer.from(salt, "hex");
    if (saltBuffer.length !== KEY_DERIVATION_SALT_BYTES) {
      throw new Error("Salt must be 16 bytes");
    }

    // Create context-specific info for HKDF-like domain separation
    const infoBuffer = Buffer.from(context, "utf8");
    
    // Use Argon2id with OWASP parameters and context info
    const hash = await argon2.hash(password, {
      ...ARGON2ID_CONFIG,
      salt: saltBuffer,
      associatedData: infoBuffer, // Context for domain separation
      raw: true, // Return raw hash
      hashLength: keyLength,
    });

    return Buffer.from(hash).toString("hex");
  } catch (error) {
    console.error("Key derivation failed:", error);
    throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Generate a cryptographically secure salt for key derivation
 * @returns 16-byte salt as hex string
 */
export function generateDerivationSalt(): string {
  try {
    const salt = new ArrayBuffer(KEY_DERIVATION_SALT_BYTES);
    // Use crypto.getRandomValues if available, fallback to sodium
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(new Uint8Array(salt));
    } else {
      // Fallback to sodium if crypto is not available
      const sodium = require("@s77rt/react-native-sodium");
      sodium.randombytes_buf(salt, KEY_DERIVATION_SALT_BYTES);
    }
    return Buffer.from(salt).toString("hex");
  } catch (error) {
    console.error("Salt generation failed:", error);
    throw new Error("Failed to generate secure salt");
  }
}

/**
 * Derive master key from user password using Argon2id
 * @param password - User password
 * @param salt - Optional salt (generates new one if not provided)
 * @returns Master key derivation result
 */
export async function deriveMasterKey(
  password: string,
  salt?: string,
): Promise<DerivedKey> {
  const masterSalt = salt || generateDerivationSalt();
  
  const key = await deriveKeyWithContext(
    password,
    masterSalt,
    MASTER_KEY_SALT,
    XCHACHA20_KEYBYTES,
  );

  return {
    key,
    salt: masterSalt,
    context: MASTER_KEY_SALT,
    timestamp: Date.now(),
  };
}

/**
 * Derive specialized keys from master key using context separation
 * @param masterKey - Master key (hex string)
 * @param keyType - Type of key to derive
 * @param identifier - Optional identifier for uniqueness (e.g., file ID)
 * @returns Derived key for specific purpose
 */
export async function deriveSpecializedKey(
  masterKey: string,
  keyType: KeyType,
  identifier?: string,
): Promise<DerivedKey> {
  if (!isValidKey(masterKey)) {
    throw new Error("Invalid master key format");
  }

  let context: string;
  switch (keyType) {
    case KeyType.FILE:
      context = identifier 
        ? `${FILE_KEY_CONTEXT}:${identifier}`
        : FILE_KEY_CONTEXT;
      break;
    case KeyType.SHARING:
      context = identifier 
        ? `${SHARING_KEY_CONTEXT}:${identifier}`
        : SHARING_KEY_CONTEXT;
      break;
    case KeyType.DEVICE:
      context = identifier 
        ? `${DEVICE_KEY_CONTEXT}:${identifier}`
        : DEVICE_KEY_CONTEXT;
      break;
    default:
      throw new Error(`Unsupported key type: ${keyType}`);
  }

  // Use master key as "password" for derivation with context-specific salt
  const salt = generateDerivationSalt();
  const key = await deriveKeyWithContext(masterKey, salt, context);

  return {
    key,
    salt,
    context,
    timestamp: Date.now(),
  };
}

/**
 * Check if biometric authentication is available and enrolled
 * @returns Biometric availability and enrollment status
 */
export async function checkBiometricAvailability(): Promise<{
  available: boolean;
  enrolled: boolean;
  types: string[];
}> {
  try {
    const [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);

    return {
      available: hasHardware,
      enrolled: isEnrolled,
      types: supportedTypes.map(type => type.toString()),
    };
  } catch (error) {
    console.error("Biometric availability check failed:", error);
    return { available: false, enrolled: false, types: [] };
  }
}

/**
 * Authenticate user with biometrics
 * @param reason - Reason for authentication (shown to user)
 * @returns Authentication result
 */
export async function authenticateWithBiometrics(
  reason: string = "Authenticate to access your encrypted photos",
): Promise<BiometricResult> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      cancelLabel: "Cancel",
      fallbackLabel: "Use Password",
    });

    if (result.success) {
      const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
      return {
        success: true,
        biometricType: supportedTypes.map(type => type.toString()),
      };
    } else {
      return {
        success: false,
        error: result.error || "Biometric authentication failed",
      };
    }
  } catch (error) {
    console.error("Biometric authentication failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown biometric error",
    };
  }
}

/**
 * Store master key securely with optional biometric protection
 * @param masterKey - Master key to store
 * @param useBiometrics - Whether to require biometrics for access
 * @returns Storage success status
 */
export async function storeMasterKey(
  masterKey: string,
  useBiometrics: boolean = false,
): Promise<boolean> {
  try {
    if (!isValidKey(masterKey)) {
      throw new Error("Invalid master key format");
    }

    // Store the master key with appropriate security level
    const options: SecureStore.SecureStoreOptions = {
      keychainAccessible: useBiometrics
        ? SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
        : SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    };

    await SecureStore.setItemAsync(MASTER_KEY_ENCRYPTED, masterKey, options);
    
    // Store biometric enrollment status
    await SecureStore.setItemAsync(
      BIOMETRIC_ENROLLMENT_KEY,
      useBiometrics ? "true" : "false",
    );

    return true;
  } catch (error) {
    console.error("Failed to store master key:", error);
    return false;
  }
}

/**
 * Retrieve master key from secure storage
 * @param requireBiometrics - Whether to require biometric authentication
 * @returns Master key or null if unavailable
 */
export async function retrieveMasterKey(
  requireBiometrics: boolean = false,
): Promise<string | null> {
  try {
    // Check if biometrics are required
    const biometricEnrolled = await SecureStore.getItemAsync(BIOMETRIC_ENROLLMENT_KEY);
    const shouldUseBiometrics = requireBiometrics || biometricEnrolled === "true";

    if (shouldUseBiometrics) {
      // Authenticate with biometrics first
      const authResult = await authenticateWithBiometrics();
      if (!authResult.success) {
        console.warn("Biometric authentication failed:", authResult.error);
        return null;
      }
    }

    return await SecureStore.getItemAsync(MASTER_KEY_ENCRYPTED);
  } catch (error) {
    console.error("Failed to retrieve master key:", error);
    return null;
  }
}

/**
 * Validate encryption key format
 * @param keyHex - Key to validate
 * @returns True if valid 32-byte hex string
 */
export function isValidKey(keyHex: string): boolean {
  try {
    const key = Buffer.from(keyHex, "hex");
    return key.length === XCHACHA20_KEYBYTES && /^[0-9a-fA-F]+$/.test(keyHex);
  } catch {
    return false;
  }
}

/**
 * Clear all stored keys (for logout or reset)
 * @returns Success status
 */
export async function clearAllKeys(): Promise<boolean> {
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(MASTER_KEY_ENCRYPTED),
      SecureStore.deleteItemAsync(BIOMETRIC_ENROLLMENT_KEY),
      SecureStore.deleteItemAsync(MASTER_KEY_DERIVATION_SALT),
    ]);
    return true;
  } catch (error) {
    console.error("Failed to clear keys:", error);
    return false;
  }
}

/**
 * Generate a new master key and store it securely
 * @param password - User password for derivation
 * @param useBiometrics - Whether to enable biometric protection
 * @returns Generated master key or null if failed
 */
export async function createAndStoreMasterKey(
  password: string,
  useBiometrics: boolean = false,
): Promise<string | null> {
  try {
    // Derive master key from password
    const masterKeyResult = await deriveMasterKey(password);
    
    // Store the derived master key
    const stored = await storeMasterKey(masterKeyResult.key, useBiometrics);
    
    if (stored) {
      // Store the derivation salt for future verification
      await SecureStore.setItemAsync(
        MASTER_KEY_DERIVATION_SALT,
        masterKeyResult.salt,
      );
      return masterKeyResult.key;
    }
    
    return null;
  } catch (error) {
    console.error("Failed to create and store master key:", error);
    return null;
  }
}

/**
 * Verify master key by attempting to derive it with stored salt
 * @param password - User password to verify
 * @returns True if password is correct
 */
export async function verifyMasterKey(password: string): Promise<boolean> {
  try {
    // Get stored salt
    const storedSalt = await SecureStore.getItemAsync(MASTER_KEY_DERIVATION_SALT);
    if (!storedSalt) {
      return false;
    }

    // Derive key with stored salt
    const derivedResult = await deriveMasterKey(password, storedSalt);
    
    // Get stored master key
    const storedKey = await SecureStore.getItemAsync(MASTER_KEY_ENCRYPTED);
    if (!storedKey) {
      return false;
    }

    // Compare derived key with stored key (constant-time comparison)
    return crypto.subtle!.timingSafeEqual(
      Buffer.from(derivedResult.key, "hex"),
      Buffer.from(storedKey, "hex"),
    );
  } catch (error) {
    console.error("Master key verification failed:", error);
    return false;
  }
}
