// AES-256-GCM client-side encryption for sensitive metadata.
// Uses @noble/ciphers (audited). Key must be 32 bytes; store in SecureStore.

import { gcm } from "@noble/ciphers/aes.js";
import {
  managedNonce,
  bytesToHex,
  hexToBytes,
  utf8ToBytes,
  bytesToUtf8,
} from "@noble/ciphers/utils.js";

const AES_KEY_LENGTH = 32;
const GCM = managedNonce(gcm);

/**
 * Encrypt plaintext with AES-256-GCM. Uses a random nonce per encryption.
 * @param plaintextUtf8 - UTF-8 string to encrypt
 * @param keyHex - 32-byte key as hex string
 * @returns Base64 string: nonce (12) + ciphertext + auth tag (16)
 */
export function encryptMetadata(plaintextUtf8: string, keyHex: string): string {
  const key = hexToBytes(keyHex);
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error("Encryption key must be 32 bytes");
  }
  const plaintext = utf8ToBytes(plaintextUtf8);
  const cipher = GCM(key);
  const encrypted = cipher.encrypt(plaintext);
  return btoa(String.fromCharCode(...encrypted));
}

/**
 * Decrypt payload produced by encryptMetadata.
 * @param base64Payload - Base64 string (nonce + ciphertext + tag)
 * @param keyHex - 32-byte key as hex string
 * @returns Decrypted UTF-8 string
 */
export function decryptMetadata(base64Payload: string, keyHex: string): string {
  const key = hexToBytes(keyHex);
  if (key.length !== AES_KEY_LENGTH) {
    throw new Error("Encryption key must be 32 bytes");
  }
  const binary = atob(base64Payload);
  const encrypted = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    encrypted[i] = binary.charCodeAt(i);
  }
  const cipher = GCM(key);
  const decrypted = cipher.decrypt(encrypted);
  return bytesToUtf8(decrypted);
}

/**
 * Generate a 32-byte key suitable for AES-256, as hex string.
 * Caller should store in SecureStore.
 */
export function generateEncryptionKeyHex(): string {
  const key = new Uint8Array(AES_KEY_LENGTH);
  if (typeof globalThis !== "undefined" && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(key);
  } else {
    throw new Error("crypto.getRandomValues is required to generate keys");
  }
  return bytesToHex(key);
}
