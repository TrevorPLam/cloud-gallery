// Streaming encryption for large files using crypto_secretstream_xchacha20poly1305.
// Enables memory-efficient encryption of files >100MB without loading entire file into memory.

import { Buffer } from "buffer";
import sodium from "@s77rt/react-native-sodium";
import {
  XCHACHA20_KEYBYTES,
  SECRETSTREAM_HEADERBYTES,
  SECRETSTREAM_ABYTES,
  SECRETSTREAM_MESSAGEBYTES_MAX,
  STREAM_CHUNK_SIZE,
  STREAM_TAG_FINAL,
  STREAM_TAG_REKEY,
  generateEncryptionKey,
  secureWipe,
} from "./encryption";

/**
 * Streaming encryption state interface
 */
export interface StreamEncryptionState {
  state: ArrayBuffer;
  header: Uint8Array;
  key: Uint8Array;
}

/**
 * Streaming decryption state interface
 */
export interface StreamDecryptionState {
  state: ArrayBuffer;
  header: Uint8Array;
  key: Uint8Array;
}

/**
 * Progress callback for streaming operations
 */
export type StreamProgressCallback = (
  processedBytes: number,
  totalBytes: number,
) => void;

/**
 * Initialize a new encryption stream
 * @param keyHex - 32-byte encryption key as hex
 * @returns Stream state with header
 */
export function initializeEncryptionStream(
  keyHex: string,
): StreamEncryptionState {
  try {
    const key = Buffer.from(keyHex, "hex");
    if (key.length !== XCHACHA20_KEYBYTES) {
      throw new Error("Invalid key length");
    }

    // Create stream state
    const state = new ArrayBuffer(
      sodium.crypto_secretstream_xchacha20poly1305_STATEBYTES(),
    );
    const header = new ArrayBuffer(SECRETSTREAM_HEADERBYTES);

    // Initialize encryption stream
    const result = sodium.crypto_secretstream_xchacha20poly1305_init_push(
      state,
      header,
      key,
    );

    if (result !== 0) {
      throw new Error("Failed to initialize encryption stream");
    }

    return {
      state,
      header: new Uint8Array(header),
      key,
    };
  } catch (error) {
    console.error("Stream initialization failed:", error);
    throw error;
  }
}

/**
 * Initialize a decryption stream
 * @param keyHex - 32-byte encryption key as hex
 * @param header - Stream header (24 bytes)
 * @returns Stream state for decryption
 */
export function initializeDecryptionStream(
  keyHex: string,
  header: Uint8Array,
): StreamDecryptionState {
  try {
    const key = Buffer.from(keyHex, "hex");
    if (key.length !== XCHACHA20_KEYBYTES) {
      throw new Error("Invalid key length");
    }

    if (header.length !== SECRETSTREAM_HEADERBYTES) {
      throw new Error("Invalid header length");
    }

    // Create stream state
    const state = new ArrayBuffer(
      sodium.crypto_secretstream_xchacha20poly1305_STATEBYTES(),
    );

    // Initialize decryption stream
    const result = sodium.crypto_secretstream_xchacha20poly1305_init_pull(
      state,
      header,
      key,
    );

    if (result !== 0) {
      throw new Error(
        "Failed to initialize decryption stream - invalid header",
      );
    }

    return {
      state,
      header,
      key,
    };
  } catch (error) {
    console.error("Decryption stream initialization failed:", error);
    throw error;
  }
}

/**
 * Encrypt a chunk of data in the stream
 * @param streamState - Current encryption stream state
 * @param plaintext - Data chunk to encrypt
 * @param isFinal - Whether this is the final chunk
 * @param additionalData - Optional additional authenticated data
 * @returns Encrypted chunk
 */
export function encryptStreamChunk(
  streamState: StreamEncryptionState,
  plaintext: Uint8Array,
  isFinal: boolean = false,
  additionalData?: Uint8Array,
): Uint8Array {
  try {
    const ad = additionalData ? new Uint8Array(additionalData) : null;
    const tag = isFinal ? STREAM_TAG_FINAL : STREAM_TAG_MESSAGE;

    // Allocate buffer for ciphertext (plaintext + authentication bytes)
    const ciphertext = new ArrayBuffer(plaintext.length + SECRETSTREAM_ABYTES);
    const ciphertextLen = new Uint32Array(1);

    const result = sodium.crypto_secretstream_xchacha20poly1305_push(
      streamState.state,
      ciphertext,
      ciphertextLen,
      plaintext,
      plaintext.length,
      ad,
      ad ? ad.length : 0,
      tag,
    );

    if (result !== 0) {
      throw new Error("Stream encryption failed");
    }

    return new Uint8Array(ciphertext, 0, ciphertextLen[0]);
  } catch (error) {
    console.error("Stream chunk encryption failed:", error);
    throw error;
  }
}

/**
 * Decrypt a chunk of data from the stream
 * @param streamState - Current decryption stream state
 * @param ciphertext - Encrypted chunk
 * @param additionalData - Optional additional authenticated data
 * @returns Decrypted chunk and tag
 */
export function decryptStreamChunk(
  streamState: StreamDecryptionState,
  ciphertext: Uint8Array,
  additionalData?: Uint8Array,
): { plaintext: Uint8Array; isFinal: boolean } {
  try {
    const ad = additionalData ? new Uint8Array(additionalData) : null;
    const tag = new Uint8Array(1);

    // Allocate buffer for plaintext
    const plaintext = new ArrayBuffer(ciphertext.length - SECRETSTREAM_ABYTES);
    const plaintextLen = new Uint32Array(1);

    const result = sodium.crypto_secretstream_xchacha20poly1305_pull(
      streamState.state,
      plaintext,
      plaintextLen,
      tag,
      ciphertext,
      ciphertext.length,
      ad,
      ad ? ad.length : 0,
    );

    if (result !== 0) {
      throw new Error("Stream decryption failed - data may be corrupted");
    }

    return {
      plaintext: new Uint8Array(plaintext, 0, plaintextLen[0]),
      isFinal: tag[0] === STREAM_TAG_FINAL,
    };
  } catch (error) {
    console.error("Stream chunk decryption failed:", error);
    throw error;
  }
}

/**
 * Rekey the stream (forward secrecy)
 * @param streamState - Current stream state (encryption or decryption)
 */
export function rekeyStream(
  streamState: StreamEncryptionState | StreamDecryptionState,
): void {
  try {
    sodium.crypto_secretstream_xchacha20poly1305_rekey(streamState.state);
  } catch (error) {
    console.error("Stream rekeying failed:", error);
    throw error;
  }
}

/**
 * Encrypt a file using streaming encryption
 * @param fileUri - URI of the file to encrypt
 * @param keyHex - 32-byte encryption key as hex
 * @param outputUri - URI for encrypted output file
 * @param onProgress - Optional progress callback
 * @returns Header that must be stored for decryption
 */
export async function encryptFileStreaming(
  fileUri: string,
  keyHex: string,
  outputUri: string,
  onProgress?: StreamProgressCallback,
): Promise<Uint8Array> {
  try {
    // Initialize stream
    const streamState = initializeEncryptionStream(keyHex);

    // Get file info (React Native file system)
    const fileInfo = await getFileSize(fileUri);
    const totalBytes = fileInfo.size;

    // Open input and output streams
    const inputStream = await openFileReadStream(fileUri);
    const outputStream = await openFileWriteStream(outputUri);

    // Write header first
    await outputStream.write(streamState.header);

    let processedBytes = 0;
    let chunksSinceRekey = 0;
    const REKEY_INTERVAL = 1000; // Rekey every 1000 chunks for forward secrecy

    try {
      while (processedBytes < totalBytes) {
        // Read chunk
        const chunkSize = Math.min(
          STREAM_CHUNK_SIZE,
          totalBytes - processedBytes,
        );
        const chunk = await inputStream.read(chunkSize);

        if (chunk.length === 0) break;

        // Determine if this is the final chunk
        const isFinal = processedBytes + chunk.length >= totalBytes;

        // Encrypt chunk
        const encryptedChunk = encryptStreamChunk(streamState, chunk, isFinal);

        // Write encrypted chunk
        await outputStream.write(encryptedChunk);

        // Rekey periodically for forward secrecy
        chunksSinceRekey++;
        if (chunksSinceRekey >= REKEY_INTERVAL && !isFinal) {
          rekeyStream(streamState);
          chunksSinceRekey = 0;
        }

        processedBytes += chunk.length;

        // Report progress
        if (onProgress) {
          onProgress(processedBytes, totalBytes);
        }

        // Secure wipe plaintext chunk
        secureWipe(chunk);
      }
    } finally {
      // Clean up streams
      await inputStream.close();
      await outputStream.close();

      // Secure wipe stream state
      secureWipe(new Uint8Array(streamState.state));
      secureWipe(streamState.key);
    }

    return streamState.header;
  } catch (error) {
    console.error("File streaming encryption failed:", error);
    throw error;
  }
}

/**
 * Decrypt a file using streaming decryption
 * @param encryptedUri - URI of encrypted file
 * @param keyHex - 32-byte encryption key as hex
 * @param header - Stream header (24 bytes)
 * @param outputUri - URI for decrypted output file
 * @param onProgress - Optional progress callback
 */
export async function decryptFileStreaming(
  encryptedUri: string,
  keyHex: string,
  header: Uint8Array,
  outputUri: string,
  onProgress?: StreamProgressCallback,
): Promise<void> {
  try {
    // Initialize decryption stream
    const streamState = initializeDecryptionStream(keyHex, header);

    // Get file info
    const fileInfo = await getFileSize(encryptedUri);
    const totalBytes = fileInfo.size;

    // Open streams
    const inputStream = await openFileReadStream(encryptedUri);
    const outputStream = await openFileWriteStream(outputUri);

    let processedBytes = 0;
    let chunksSinceRekey = 0;
    const REKEY_INTERVAL = 1000;

    try {
      while (processedBytes < totalBytes) {
        // Read encrypted chunk
        // We need to determine chunk size dynamically since encrypted chunks are larger
        const maxChunkSize = STREAM_CHUNK_SIZE + SECRETSTREAM_ABYTES;
        const remainingBytes = totalBytes - processedBytes;
        const chunkSize = Math.min(maxChunkSize, remainingBytes);

        const encryptedChunk = await inputStream.read(chunkSize);

        if (encryptedChunk.length === 0) break;

        // Decrypt chunk
        const { plaintext, isFinal } = decryptStreamChunk(
          streamState,
          encryptedChunk,
        );

        // Write decrypted chunk
        await outputStream.write(plaintext);

        // Rekey if needed (matching encryption rekey pattern)
        chunksSinceRekey++;
        if (chunksSinceRekey >= REKEY_INTERVAL && !isFinal) {
          rekeyStream(streamState);
          chunksSinceRekey = 0;
        }

        processedBytes += encryptedChunk.length;

        // Report progress
        if (onProgress) {
          onProgress(processedBytes, totalBytes);
        }

        // Secure wipe plaintext
        secureWipe(plaintext);
      }
    } finally {
      // Clean up
      await inputStream.close();
      await outputStream.close();

      secureWipe(new Uint8Array(streamState.state));
      secureWipe(streamState.key);
    }
  } catch (error) {
    console.error("File streaming decryption failed:", error);
    throw error;
  }
}

/**
 * Encrypt data in memory using streaming approach (for testing/validation)
 * @param data - Data to encrypt
 * @param keyHex - 32-byte encryption key as hex
 * @returns Encrypted data with header prepended
 */
export function encryptDataStream(
  data: Uint8Array,
  keyHex: string,
): Uint8Array {
  try {
    const streamState = initializeEncryptionStream(keyHex);

    // Calculate total size: header + encrypted chunks
    const totalChunks = Math.ceil(data.length / STREAM_CHUNK_SIZE);
    let totalSize = streamState.header.length;

    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = i * STREAM_CHUNK_SIZE;
      const chunkEnd = Math.min(chunkStart + STREAM_CHUNK_SIZE, data.length);
      const chunkSize = chunkEnd - chunkStart;
      totalSize += chunkSize + SECRETSTREAM_ABYTES;
    }

    // Allocate result buffer
    const result = new Uint8Array(totalSize);
    let offset = 0;

    // Copy header
    result.set(streamState.header, offset);
    offset += streamState.header.length;

    // Encrypt chunks
    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = i * STREAM_CHUNK_SIZE;
      const chunkEnd = Math.min(chunkStart + STREAM_CHUNK_SIZE, data.length);
      const chunk = data.slice(chunkStart, chunkEnd);
      const isFinal = i === totalChunks - 1;

      const encryptedChunk = encryptStreamChunk(streamState, chunk, isFinal);
      result.set(encryptedChunk, offset);
      offset += encryptedChunk.length;
    }

    // Clean up
    secureWipe(new Uint8Array(streamState.state));
    secureWipe(streamState.key);

    return result;
  } catch (error) {
    console.error("Data stream encryption failed:", error);
    throw error;
  }
}

/**
 * Decrypt data in memory using streaming approach
 * @param encryptedData - Encrypted data with header
 * @param keyHex - 32-byte encryption key as hex
 * @returns Decrypted data
 */
export function decryptDataStream(
  encryptedData: Uint8Array,
  keyHex: string,
): Uint8Array {
  try {
    if (encryptedData.length < SECRETSTREAM_HEADERBYTES) {
      throw new Error("Invalid encrypted data - missing header");
    }

    // Extract header
    const header = encryptedData.slice(0, SECRETSTREAM_HEADERBYTES);
    const ciphertextData = encryptedData.slice(SECRETSTREAM_HEADERBYTES);

    // Initialize decryption stream
    const streamState = initializeDecryptionStream(keyHex, header);

    // Calculate approximate total size (we don't know exact size beforehand)
    const resultChunks: Uint8Array[] = [];
    let offset = 0;
    let isFinal = false;

    while (offset < ciphertextData.length && !isFinal) {
      // Determine chunk size (encrypted chunk is larger than plaintext)
      const remainingBytes = ciphertextData.length - offset;
      const maxChunkSize = STREAM_CHUNK_SIZE + SECRETSTREAM_ABYTES;
      const chunkSize = Math.min(maxChunkSize, remainingBytes);

      const encryptedChunk = ciphertextData.slice(offset, offset + chunkSize);

      try {
        const { plaintext, isFinal: chunkIsFinal } = decryptStreamChunk(
          streamState,
          encryptedChunk,
        );

        resultChunks.push(plaintext);
        isFinal = chunkIsFinal;
        offset += encryptedChunk.length;

        // Secure wipe plaintext chunk
        secureWipe(plaintext);
      } catch (error) {
        // If we can't decrypt a chunk, it might be because we read too much/little
        // Try with a smaller chunk size
        if (chunkSize > SECRETSTREAM_ABYTES + 1) {
          const smallerChunk = encryptedChunk.slice(0, chunkSize - 1);
          const { plaintext, isFinal: chunkIsFinal } = decryptStreamChunk(
            streamState,
            smallerChunk,
          );

          resultChunks.push(plaintext);
          isFinal = chunkIsFinal;
          offset += smallerChunk.length;
          secureWipe(plaintext);
        } else {
          throw error;
        }
      }
    }

    // Combine all chunks
    const totalSize = resultChunks.reduce(
      (sum, chunk) => sum + chunk.length,
      0,
    );
    const result = new Uint8Array(totalSize);
    let resultOffset = 0;

    for (const chunk of resultChunks) {
      result.set(chunk, resultOffset);
      resultOffset += chunk.length;
    }

    // Clean up
    secureWipe(new Uint8Array(streamState.state));
    secureWipe(streamState.key);

    return result;
  } catch (error) {
    console.error("Data stream decryption failed:", error);
    throw error;
  }
}

// Helper functions (these would need to be implemented based on the file system library used)

async function getFileSize(fileUri: string): Promise<{ size: number }> {
  // Implementation depends on the file system library (react-native-fs, expo-file-system, etc.)
  // This is a placeholder - actual implementation would use the appropriate library
  throw new Error("getFileSize not implemented - requires file system library");
}

async function openFileReadStream(fileUri: string): Promise<{
  read: (size: number) => Promise<Uint8Array>;
  close: () => Promise<void>;
}> {
  // Implementation depends on the file system library
  throw new Error(
    "openFileReadStream not implemented - requires file system library",
  );
}

async function openFileWriteStream(fileUri: string): Promise<{
  write: (data: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
}> {
  // Implementation depends on the file system library
  throw new Error(
    "openFileWriteStream not implemented - requires file system library",
  );
}
