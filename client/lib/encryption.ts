// Zero-knowledge file encryption using XChaCha20-Poly1305 with JSI performance.
// Provides secure, authenticated encryption for photo/video files with streaming support.

import { Buffer } from "buffer";
import sodium from "@s77rt/react-native-sodium";

// Constants for XChaCha20-Poly1305
export const XCHACHA20_KEYBYTES = 32; // 256-bit key
export const XCHACHA20_NONCEBYTES = 24; // 192-bit nonce
export const XCHACHA20_ABYTES = 16; // 128-bit authentication tag

// Streaming encryption constants
export const SECRETSTREAM_HEADERBYTES = 24; // Stream header size
export const SECRETSTREAM_ABYTES = 17; // Additional bytes per chunk (16 tag + 1)
export const SECRETSTREAM_MESSAGEBYTES_MAX = 0x400000; // 4MB max per chunk

// Chunk size thresholds for hybrid strategy
export const DIRECT_ENCRYPTION_MAX_SIZE = 10 * 1024 * 1024; // 10MB
export const CHUNKED_ENCRYPTION_MAX_SIZE = 100 * 1024 * 1024; // 100MB
export const STREAM_CHUNK_SIZE = 64 * 1024; // 64KB chunks for streaming

// Stream tags
export const STREAM_TAG_MESSAGE = 0x00;
export const STREAM_TAG_PUSH = 0x01;
export const STREAM_TAG_REKEY = 0x02;
export const STREAM_TAG_FINAL = 0x03;

/**
 * Initialize sodium library (must be called before any crypto operations)
 */
export async function initializeCrypto(): Promise<void> {
  try {
    const result = sodium.sodium_init();
    if (result < 0) {
      throw new Error("Failed to initialize sodium library");
    }
  } catch (error) {
    console.error("Crypto initialization failed:", error);
    throw error;
  }
}

/**
 * Generate a secure XChaCha20-Poly1305 key
 * @returns 32-byte key as hex string
 */
export function generateEncryptionKey(): string {
  try {
    const key = new ArrayBuffer(XCHACHA20_KEYBYTES);
    sodium.randombytes_buf(key, XCHACHA20_KEYBYTES);
    return Buffer.from(key).toString("hex");
  } catch (error) {
    console.error("Key generation failed:", error);
    throw error;
  }
}

/**
 * Generate a random nonce for XChaCha20-Poly1305
 * @returns 24-byte nonce as hex string
 */
export function generateNonce(): string {
  try {
    const nonce = new ArrayBuffer(XCHACHA20_NONCEBYTES);
    sodium.randombytes_buf(nonce, XCHACHA20_NONCEBYTES);
    return Buffer.from(nonce).toString("hex");
  } catch (error) {
    console.error("Nonce generation failed:", error);
    throw error;
  }
}

/**
 * Encrypt data using XChaCha20-Poly1305 (direct mode for small files)
 * @param plaintext - Data to encrypt
 * @param keyHex - 32-byte encryption key as hex
 * @param additionalData - Optional additional authenticated data
 * @returns Encrypted data with nonce prepended (nonce + ciphertext + tag)
 */
export function encryptData(
  plaintext: Uint8Array,
  keyHex: string,
  additionalData?: Uint8Array,
): Uint8Array {
  try {
    const key = Buffer.from(keyHex, "hex");
    if (key.length !== XCHACHA20_KEYBYTES) {
      throw new Error("Invalid key length");
    }

    const nonce = Buffer.from(generateNonce(), "hex");
    const message = new Uint8Array(plaintext);
    const ad = additionalData ? new Uint8Array(additionalData) : null;

    // Allocate buffer for ciphertext (plaintext + authentication tag)
    const ciphertext = new ArrayBuffer(message.length + XCHACHA20_ABYTES);
    const ciphertextLen = new Uint32Array(1);

    const result = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      ciphertext,
      ciphertextLen,
      message,
      message.length,
      ad,
      ad ? ad.length : 0,
      null, // No secret nonce
      nonce,
      key,
    );

    if (result !== 0) {
      throw new Error("Encryption failed");
    }

    // Return nonce + ciphertext
    const resultBuffer = new Uint8Array(nonce.length + ciphertextLen[0]);
    resultBuffer.set(nonce, 0);
    resultBuffer.set(
      new Uint8Array(ciphertext, 0, ciphertextLen[0]),
      nonce.length,
    );

    return resultBuffer;
  } catch (error) {
    console.error("Encryption failed:", error);
    throw error;
  }
}

/**
 * Decrypt data using XChaCha20-Poly1305
 * @param encryptedData - Encrypted data (nonce + ciphertext + tag)
 * @param keyHex - 32-byte encryption key as hex
 * @param additionalData - Optional additional authenticated data
 * @returns Decrypted plaintext
 */
export function decryptData(
  encryptedData: Uint8Array,
  keyHex: string,
  additionalData?: Uint8Array,
): Uint8Array {
  try {
    const key = Buffer.from(keyHex, "hex");
    if (key.length !== XCHACHA20_KEYBYTES) {
      throw new Error("Invalid key length");
    }

    if (encryptedData.length < XCHACHA20_NONCEBYTES + XCHACHA20_ABYTES) {
      throw new Error("Invalid encrypted data format");
    }

    // Extract nonce and ciphertext
    const nonce = encryptedData.slice(0, XCHACHA20_NONCEBYTES);
    const ciphertext = encryptedData.slice(XCHACHA20_NONCEBYTES);
    const ad = additionalData ? new Uint8Array(additionalData) : null;

    // Allocate buffer for plaintext
    const plaintext = new ArrayBuffer(ciphertext.length - XCHACHA20_ABYTES);
    const plaintextLen = new Uint32Array(1);

    const result = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      plaintext,
      plaintextLen,
      null, // No secret nonce
      ciphertext,
      ciphertext.length,
      ad,
      ad ? ad.length : 0,
      nonce,
      key,
    );

    if (result !== 0) {
      throw new Error("Decryption failed - data may be corrupted");
    }

    return new Uint8Array(plaintext, 0, plaintextLen[0]);
  } catch (error) {
    console.error("Decryption failed:", error);
    throw error;
  }
}

/**
 * Encrypt a string message (convenient wrapper for text data)
 * @param message - Text message to encrypt
 * @param keyHex - 32-byte encryption key as hex
 * @param additionalData - Optional additional authenticated data
 * @returns Base64 encoded encrypted data
 */
export function encryptMessage(
  message: string,
  keyHex: string,
  additionalData?: Uint8Array,
): string {
  const messageBytes = Buffer.from(message, "utf8");
  const encrypted = encryptData(messageBytes, keyHex, additionalData);
  return Buffer.from(encrypted).toString("base64");
}

/**
 * Decrypt a string message
 * @param encryptedMessage - Base64 encoded encrypted data
 * @param keyHex - 32-byte encryption key as hex
 * @param additionalData - Optional additional authenticated data
 * @returns Decrypted text message
 */
export function decryptMessage(
  encryptedMessage: string,
  keyHex: string,
  additionalData?: Uint8Array,
): string {
  const encryptedBytes = Buffer.from(encryptedMessage, "base64");
  const decrypted = decryptData(encryptedBytes, keyHex, additionalData);
  return Buffer.from(decrypted).toString("utf8");
}

/**
 * Derive encryption key from user password using Argon2id
 * @param password - User password
 * @param salt - 16-byte salt
 * @returns 32-byte derived key as hex
 */
export async function deriveKeyFromPassword(
  password: string,
  salt: string,
): Promise<string> {
  try {
    // Import argon2 dynamically since it's a heavy dependency
    const { argon2 } = await import("argon2");

    const saltBuffer = Buffer.from(salt, "hex");
    if (saltBuffer.length !== 16) {
      throw new Error("Salt must be 16 bytes");
    }

    // OWASP recommended parameters for Argon2id
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 64 * 1024, // 64MB
      timeCost: 3, // 3 iterations
      parallelism: 2, // 2 threads
      hashLength: XCHACHA20_KEYBYTES,
      salt: saltBuffer,
      raw: true, // Return raw hash
    });

    return Buffer.from(hash).toString("hex");
  } catch (error) {
    console.error("Key derivation failed:", error);
    throw error;
  }
}

/**
 * Generate a secure random salt for key derivation
 * @returns 16-byte salt as hex string
 */
export function generateSalt(): string {
  try {
    const salt = new ArrayBuffer(16);
    sodium.randombytes_buf(salt, 16);
    return Buffer.from(salt).toString("hex");
  } catch (error) {
    console.error("Salt generation failed:", error);
    throw error;
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
    return key.length === XCHACHA20_KEYBYTES;
  } catch {
    return false;
  }
}

/**
 * Wipe sensitive data from memory (best effort)
 * @param buffer - Buffer to wipe
 */
export function secureWipe(buffer: Uint8Array | ArrayBuffer): void {
  try {
    if (buffer instanceof ArrayBuffer) {
      new Uint8Array(buffer).fill(0);
    } else {
      buffer.fill(0);
    }
  } catch (error) {
    // Best effort - ignore errors in wiping
    console.warn("Failed to wipe buffer:", error);
  }
}
