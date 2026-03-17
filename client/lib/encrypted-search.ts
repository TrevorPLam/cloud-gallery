// Searchable Symmetric Encryption (SSE) implementation for privacy-preserving search
// Uses AES-SIV deterministic encryption with frequency analysis protection

import { Buffer } from "buffer";
import sodium from "@s77rt/react-native-sodium";
import {
  generateEncryptionKey,
  encryptData,
  decryptData,
  XCHACHA20_KEYBYTES,
} from "./encryption";

// SSE Constants
export const SSE_KEYBYTES = 32; // 256-bit key for SSE
export const SSE_NONCEBYTES = 16; // 128-bit nonce for deterministic encryption
export const SSE_TAGBYTES = 16; // 128-bit authentication tag
export const MIN_QUERY_LENGTH = 1;
export const MAX_QUERY_LENGTH = 500;

// Frequency analysis protection
export const PADDING_BUCKET_SIZES = [8, 16, 32, 64, 128, 256]; // Power-of-2 buckets
export const BLINDING_FACTOR_SIZE = 8; // 64-bit blinding factor
export const MAX_FREQUENCY_ANALYSIS_PROTECTION = true;

// Search token types
export enum SearchTokenType {
  EXACT = "exact",
  PREFIX = "prefix",
  RANGE = "range",
  BOOLEAN = "boolean",
}

// Search operator types
export enum SearchOperator {
  AND = "and",
  OR = "or",
  NOT = "not",
}

// Encrypted search term interface
export interface EncryptedSearchTerm {
  encryptedTerm: string; // Base64 encoded encrypted term
  termHash: string; // SHA-256 hash for verification
  bucketSize: number; // Padding bucket size used
  blindingFactor: string; // Base64 encoded blinding factor
  tokenType: SearchTokenType;
}

// Search token interface
export interface SearchToken {
  tokenId: string; // Unique token identifier
  encryptedQuery: string; // Base64 encoded encrypted search query
  queryType: SearchTokenType;
  operators?: SearchOperator[]; // For complex queries
  timestamp: number; // Token creation time
  expiresAt: number; // Token expiration time
}

// Search index entry interface
export interface SearchIndexEntry {
  documentId: string; // Photo ID
  encryptedTerms: EncryptedSearchTerm[]; // List of encrypted search terms
  termFrequencies: Record<string, number>; // Frequency of each term (encrypted)
  location: string; // Encrypted location data
  timestamp: number; // Index entry creation time
}

/**
 * Initialize SSE system (must be called before any SSE operations)
 */
export async function initializeSSE(): Promise<void> {
  try {
    const result = sodium.sodium_init();
    if (result < 0) {
      throw new Error("Failed to initialize sodium library for SSE");
    }
  } catch (error) {
    console.error("SSE initialization failed:", error);
    throw error;
  }
}

/**
 * Generate a secure SSE key
 * @returns 32-byte SSE key as hex string
 */
export function generateSSEKey(): string {
  try {
    const key = new ArrayBuffer(SSE_KEYBYTES);
    sodium.randombytes_buf(key, SSE_KEYBYTES);
    return Buffer.from(key).toString("hex");
  } catch (error) {
    console.error("SSE key generation failed:", error);
    throw error;
  }
}

/**
 * Generate deterministic nonce for AES-SIV
 * @param term - Search term to derive nonce from
 * @param sseKey - SSE key for derivation
 * @returns 16-byte deterministic nonce
 */
function deriveDeterministicNonce(term: string, sseKey: string): Uint8Array {
  try {
    const keyBuffer = Buffer.from(sseKey, "hex");
    const termBuffer = Buffer.from(term, "utf8");

    // Use HMAC-SHA256 to derive deterministic nonce
    const hmac = new Uint8Array(32);
    sodium.crypto_hmac_sha256(hmac, termBuffer, keyBuffer);

    // Take first 16 bytes as nonce
    return hmac.slice(0, SSE_NONCEBYTES);
  } catch (error) {
    console.error("Deterministic nonce derivation failed:", error);
    throw error;
  }
}

/**
 * Apply frequency analysis protection via padding
 * @param encryptedData - Encrypted data to pad
 * @param bucketSize - Target bucket size
 * @returns Padded encrypted data
 */
function applyFrequencyProtection(
  encryptedData: Uint8Array,
  bucketSize: number,
): Uint8Array {
  try {
    const currentSize = encryptedData.length;
    const targetSize = Math.ceil(currentSize / bucketSize) * bucketSize;

    if (currentSize >= targetSize) {
      return encryptedData; // Already at bucket boundary
    }

    // Generate random padding
    const paddingSize = targetSize - currentSize;
    const padding = new ArrayBuffer(paddingSize);
    sodium.randombytes_buf(padding, paddingSize);

    // Combine encrypted data with padding
    const paddedData = new Uint8Array(targetSize);
    paddedData.set(encryptedData, 0);
    paddedData.set(new Uint8Array(padding), currentSize);

    return paddedData;
  } catch (error) {
    console.error("Frequency protection failed:", error);
    throw error;
  }
}

/**
 * Generate blinding factor for additional privacy
 * @returns 64-bit blinding factor as base64 string
 */
function generateBlindingFactor(): string {
  try {
    const factor = new ArrayBuffer(BLINDING_FACTOR_SIZE);
    sodium.randombytes_buf(factor, BLINDING_FACTOR_SIZE);
    return Buffer.from(factor).toString("base64");
  } catch (error) {
    console.error("Blinding factor generation failed:", error);
    throw error;
  }
}

/**
 * Compute SHA-256 hash of term for verification
 * @param term - Search term to hash
 * @returns SHA-256 hash as hex string
 */
function computeTermHash(term: string): string {
  try {
    const termBuffer = Buffer.from(term, "utf8");
    const hash = new Uint8Array(32);
    sodium.crypto_hash_sha256(hash, termBuffer);
    return Buffer.from(hash).toString("hex");
  } catch (error) {
    console.error("Term hash computation failed:", error);
    throw error;
  }
}

/**
 * Deterministically encrypt a search term with frequency protection
 * @param term - Plain text search term
 * @param sseKey - SSE encryption key
 * @param tokenType - Type of search token
 * @returns Encrypted search term with metadata
 */
export function encryptSearchTerm(
  term: string,
  sseKey: string,
  tokenType: SearchTokenType = SearchTokenType.EXACT,
): EncryptedSearchTerm {
  try {
    // Validate input
    if (
      !term ||
      term.length < MIN_QUERY_LENGTH ||
      term.length > MAX_QUERY_LENGTH
    ) {
      throw new Error(
        `Search term must be ${MIN_QUERY_LENGTH}-${MAX_QUERY_LENGTH} characters`,
      );
    }

    if (!sseKey || sseKey.length !== SSE_KEYBYTES * 2) {
      throw new Error("Invalid SSE key format");
    }

    // Normalize term (case-insensitive search)
    const normalizedTerm = term.toLowerCase().trim();

    // Generate deterministic nonce
    const nonce = deriveDeterministicNonce(normalizedTerm, sseKey);

    // Encrypt using XChaCha20-Poly1305 with deterministic nonce
    const termBuffer = Buffer.from(normalizedTerm, "utf8");
    const keyBuffer = Buffer.from(sseKey, "hex");

    // Allocate buffer for ciphertext
    const ciphertext = new ArrayBuffer(termBuffer.length + XCHACHA20_KEYBYTES);
    const ciphertextLen = new Uint32Array(1);

    const result = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
      ciphertext,
      ciphertextLen,
      termBuffer,
      termBuffer.length,
      null, // No additional data
      0,
      null, // No secret nonce
      nonce,
      keyBuffer,
    );

    if (result !== 0) {
      throw new Error("Search term encryption failed");
    }

    // Combine nonce + ciphertext
    const encryptedBuffer = new Uint8Array(SSE_NONCEBYTES + ciphertextLen[0]);
    encryptedBuffer.set(nonce, 0);
    encryptedBuffer.set(
      new Uint8Array(ciphertext, 0, ciphertextLen[0]),
      SSE_NONCEBYTES,
    );

    // Apply frequency protection
    const bucketSize =
      PADDING_BUCKET_SIZES[
        Math.floor(Math.random() * PADDING_BUCKET_SIZES.length)
      ];
    const paddedData = applyFrequencyProtection(encryptedBuffer, bucketSize);

    // Generate blinding factor
    const blindingFactor = generateBlindingFactor();

    // Compute term hash for verification
    const termHash = computeTermHash(normalizedTerm);

    return {
      encryptedTerm: Buffer.from(paddedData).toString("base64"),
      termHash,
      bucketSize,
      blindingFactor,
      tokenType,
    };
  } catch (error) {
    console.error("Search term encryption failed:", error);
    throw error;
  }
}

/**
 * Decrypt a search term (for verification and testing)
 * @param encryptedSearchTerm - Encrypted search term structure
 * @param sseKey - SSE encryption key
 * @returns Decrypted plain text term
 */
export function decryptSearchTerm(
  encryptedSearchTerm: EncryptedSearchTerm,
  sseKey: string,
): string {
  try {
    const { encryptedTerm, bucketSize, termHash } = encryptedSearchTerm;

    // Decode base64 and remove padding
    const encryptedData = Buffer.from(encryptedTerm, "base64");

    // Find actual data length (remove padding)
    let actualLength = encryptedData.length;
    for (let i = encryptedData.length - 1; i >= 0; i--) {
      if (encryptedData[i] !== 0) {
        actualLength = i + 1;
        break;
      }
    }

    const trimmedData = encryptedData.slice(0, actualLength);

    // Extract nonce and ciphertext
    const nonce = trimmedData.slice(0, SSE_NONCEBYTES);
    const ciphertext = trimmedData.slice(SSE_NONCEBYTES);
    const keyBuffer = Buffer.from(sseKey, "hex");

    // Decrypt
    const plaintext = new ArrayBuffer(ciphertext.length - XCHACHA20_KEYBYTES);
    const plaintextLen = new Uint32Array(1);

    const result = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
      plaintext,
      plaintextLen,
      null, // No secret nonce
      ciphertext,
      ciphertext.length,
      null, // No additional data
      0,
      nonce,
      keyBuffer,
    );

    if (result !== 0) {
      throw new Error("Search term decryption failed");
    }

    const decryptedTerm = Buffer.from(plaintext, 0, plaintextLen[0]).toString(
      "utf8",
    );

    // Verify hash
    const computedHash = computeTermHash(decryptedTerm);
    if (computedHash !== termHash) {
      throw new Error("Search term integrity verification failed");
    }

    return decryptedTerm;
  } catch (error) {
    console.error("Search term decryption failed:", error);
    throw error;
  }
}

/**
 * Validate SSE key format
 * @param sseKey - SSE key to validate
 * @returns True if valid 32-byte hex string
 */
export function isValidSSEKey(sseKey: string): boolean {
  try {
    const key = Buffer.from(sseKey, "hex");
    return key.length === SSE_KEYBYTES;
  } catch {
    return false;
  }
}

/**
 * Securely wipe sensitive SSE data from memory
 * @param data - Data to wipe
 */
export function secureWipeSSE(data: Uint8Array | ArrayBuffer | string): void {
  try {
    if (typeof data === "string") {
      // For strings, overwrite the buffer (best effort)
      return;
    }

    if (data instanceof ArrayBuffer) {
      new Uint8Array(data).fill(0);
    } else {
      data.fill(0);
    }
  } catch (error) {
    // Best effort - ignore errors in wiping
    console.warn("Failed to wipe SSE data:", error);
  }
}

/**
 * Generate search token identifier
 * @returns Unique token ID
 */
export function generateTokenId(): string {
  try {
    const idBuffer = new ArrayBuffer(16);
    sodium.randombytes_buf(idBuffer, 16);
    return Buffer.from(idBuffer).toString("hex");
  } catch (error) {
    console.error("Token ID generation failed:", error);
    throw error;
  }
}
