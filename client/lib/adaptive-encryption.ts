// Adaptive encryption strategy that selects optimal encryption method based on file size.
// Combines direct encryption, chunked encryption, and streaming encryption for optimal performance.

import { Buffer } from "buffer";
import sodium from "@s77rt/react-native-sodium";
import {
  encryptData,
  decryptData,
  generateEncryptionKey,
  initializeCrypto,
  XCHACHA20_KEYBYTES,
} from "./encryption";
import {
  encryptDataStream,
  decryptDataStream,
  encryptFileStreaming,
  decryptFileStreaming,
  StreamProgressCallback,
  SECRETSTREAM_HEADERBYTES,
} from "./streaming-encryption";

// Size thresholds for different encryption strategies
export const DIRECT_ENCRYPTION_MAX_SIZE = 10 * 1024 * 1024; // 10MB
export const CHUNKED_ENCRYPTION_MAX_SIZE = 100 * 1024 * 1024; // 100MB
export const STREAM_CHUNK_SIZE = 1024 * 1024; // 1MB chunks for chunked mode

// Encryption strategy types
export enum EncryptionStrategy {
  DIRECT = "direct",
  CHUNKED = "chunked",
  STREAMING = "streaming",
}

// Encryption metadata interface
export interface EncryptionMetadata {
  strategy: EncryptionStrategy;
  header?: Uint8Array; // For streaming mode
  chunkCount?: number; // For chunked mode
  originalSize: number;
  encryptedSize: number;
  keyId?: string; // For key management
}

// Encrypted file interface
export interface EncryptedFile {
  data: Uint8Array;
  metadata: EncryptionMetadata;
}

/**
 * Determine the optimal encryption strategy based on file size
 * @param fileSize - Size of the file in bytes
 * @returns Recommended encryption strategy
 */
export function determineEncryptionStrategy(
  fileSize: number,
): EncryptionStrategy {
  if (fileSize <= DIRECT_ENCRYPTION_MAX_SIZE) {
    return EncryptionStrategy.DIRECT;
  } else if (fileSize <= CHUNKED_ENCRYPTION_MAX_SIZE) {
    return EncryptionStrategy.CHUNKED;
  } else {
    return EncryptionStrategy.STREAMING;
  }
}

/**
 * Encrypt data using the optimal strategy for its size
 * @param data - Data to encrypt
 * @param keyHex - 32-byte encryption key as hex
 * @param options - Optional encryption options
 * @returns Encrypted data with metadata
 */
export async function encryptDataAdaptive(
  data: Uint8Array,
  keyHex: string,
  options: {
    keyId?: string;
    onProgress?: StreamProgressCallback;
  } = {},
): Promise<EncryptedFile> {
  try {
    // Ensure crypto is initialized
    await initializeCrypto();

    const strategy = determineEncryptionStrategy(data.length);
    let encryptedData: Uint8Array;
    let metadata: EncryptionMetadata;

    switch (strategy) {
      case EncryptionStrategy.DIRECT:
        encryptedData = encryptData(data, keyHex);
        metadata = {
          strategy: EncryptionStrategy.DIRECT,
          originalSize: data.length,
          encryptedSize: encryptedData.length,
          keyId: options.keyId,
        };
        break;

      case EncryptionStrategy.CHUNKED:
        encryptedData = await encryptDataChunked(
          data,
          keyHex,
          options.onProgress,
        );
        const chunkCount = Math.ceil(data.length / STREAM_CHUNK_SIZE);
        metadata = {
          strategy: EncryptionStrategy.CHUNKED,
          chunkCount,
          originalSize: data.length,
          encryptedSize: encryptedData.length,
          keyId: options.keyId,
        };
        break;

      case EncryptionStrategy.STREAMING:
        encryptedData = encryptDataStream(data, keyHex);
        const header = encryptedData.slice(0, SECRETSTREAM_HEADERBYTES);
        metadata = {
          strategy: EncryptionStrategy.STREAMING,
          header,
          originalSize: data.length,
          encryptedSize: encryptedData.length,
          keyId: options.keyId,
        };
        break;

      default:
        throw new Error(`Unsupported encryption strategy: ${strategy}`);
    }

    return { data: encryptedData, metadata };
  } catch (error) {
    console.error("Adaptive encryption failed:", error);
    throw error;
  }
}

/**
 * Decrypt data using the strategy specified in metadata
 * @param encryptedFile - Encrypted data with metadata
 * @param keyHex - 32-byte encryption key as hex
 * @param options - Optional decryption options
 * @returns Decrypted data
 */
export async function decryptDataAdaptive(
  encryptedFile: EncryptedFile,
  keyHex: string,
  options: {
    onProgress?: StreamProgressCallback;
  } = {},
): Promise<Uint8Array> {
  try {
    // Ensure crypto is initialized
    await initializeCrypto();

    const { data: encryptedData, metadata } = encryptedFile;

    switch (metadata.strategy) {
      case EncryptionStrategy.DIRECT:
        return decryptData(encryptedData, keyHex);

      case EncryptionStrategy.CHUNKED:
        return await decryptDataChunked(
          encryptedData,
          keyHex,
          metadata.chunkCount || 0,
          options.onProgress,
        );

      case EncryptionStrategy.STREAMING:
        if (!metadata.header) {
          throw new Error("Missing header for streaming decryption");
        }
        return decryptDataStream(encryptedData, keyHex);

      default:
        throw new Error(
          `Unsupported encryption strategy: ${metadata.strategy}`,
        );
    }
  } catch (error) {
    console.error("Adaptive decryption failed:", error);
    throw error;
  }
}

/**
 * Encrypt a file using the optimal strategy for its size
 * @param inputUri - URI of the file to encrypt
 * @param outputUri - URI for the encrypted output file
 * @param keyHex - 32-byte encryption key as hex
 * @param options - Optional encryption options
 * @returns Encryption metadata
 */
export async function encryptFileAdaptive(
  inputUri: string,
  outputUri: string,
  keyHex: string,
  options: {
    keyId?: string;
    onProgress?: StreamProgressCallback;
  } = {},
): Promise<EncryptionMetadata> {
  try {
    // Ensure crypto is initialized
    await initializeCrypto();

    // Get file size to determine strategy
    const fileInfo = await getFileInfo(inputUri);
    const strategy = determineEncryptionStrategy(fileInfo.size);

    let metadata: EncryptionMetadata;

    switch (strategy) {
      case EncryptionStrategy.DIRECT:
        await encryptFileDirect(inputUri, outputUri, keyHex);
        const encryptedFileInfo = await getFileInfo(outputUri);
        metadata = {
          strategy: EncryptionStrategy.DIRECT,
          originalSize: fileInfo.size,
          encryptedSize: encryptedFileInfo.size,
          keyId: options.keyId,
        };
        break;

      case EncryptionStrategy.CHUNKED:
        await encryptFileChunked(
          inputUri,
          outputUri,
          keyHex,
          options.onProgress,
        );
        const chunkedEncryptedInfo = await getFileInfo(outputUri);
        const chunkCount = Math.ceil(fileInfo.size / STREAM_CHUNK_SIZE);
        metadata = {
          strategy: EncryptionStrategy.CHUNKED,
          chunkCount,
          originalSize: fileInfo.size,
          encryptedSize: chunkedEncryptedInfo.size,
          keyId: options.keyId,
        };
        break;

      case EncryptionStrategy.STREAMING:
        const header = await encryptFileStreaming(
          inputUri,
          keyHex,
          outputUri,
          options.onProgress,
        );
        const streamEncryptedInfo = await getFileInfo(outputUri);
        metadata = {
          strategy: EncryptionStrategy.STREAMING,
          header,
          originalSize: fileInfo.size,
          encryptedSize: streamEncryptedInfo.size,
          keyId: options.keyId,
        };
        break;

      default:
        throw new Error(`Unsupported encryption strategy: ${strategy}`);
    }

    return metadata;
  } catch (error) {
    console.error("Adaptive file encryption failed:", error);
    throw error;
  }
}

/**
 * Decrypt a file using the strategy specified in metadata
 * @param inputUri - URI of the encrypted file
 * @param outputUri - URI for the decrypted output file
 * @param metadata - Encryption metadata
 * @param keyHex - 32-byte encryption key as hex
 * @param options - Optional decryption options
 */
export async function decryptFileAdaptive(
  inputUri: string,
  outputUri: string,
  metadata: EncryptionMetadata,
  keyHex: string,
  options: {
    onProgress?: StreamProgressCallback;
  } = {},
): Promise<void> {
  try {
    // Ensure crypto is initialized
    await initializeCrypto();

    switch (metadata.strategy) {
      case EncryptionStrategy.DIRECT:
        await decryptFileDirect(inputUri, outputUri, keyHex);
        break;

      case EncryptionStrategy.CHUNKED:
        await decryptFileChunked(
          inputUri,
          outputUri,
          keyHex,
          metadata.chunkCount || 0,
          options.onProgress,
        );
        break;

      case EncryptionStrategy.STREAMING:
        if (!metadata.header) {
          throw new Error("Missing header for streaming decryption");
        }
        await decryptFileStreaming(
          inputUri,
          keyHex,
          metadata.header,
          outputUri,
          options.onProgress,
        );
        break;

      default:
        throw new Error(
          `Unsupported encryption strategy: ${metadata.strategy}`,
        );
    }
  } catch (error) {
    console.error("Adaptive file decryption failed:", error);
    throw error;
  }
}

/**
 * Chunked encryption for medium-sized files (10MB - 100MB)
 * @param data - Data to encrypt
 * @param keyHex - 32-byte encryption key as hex
 * @param onProgress - Optional progress callback
 * @returns Encrypted data with chunk headers
 */
async function encryptDataChunked(
  data: Uint8Array,
  keyHex: string,
  onProgress?: StreamProgressCallback,
): Promise<Uint8Array> {
  const chunkCount = Math.ceil(data.length / STREAM_CHUNK_SIZE);
  const encryptedChunks: Uint8Array[] = [];

  // Pre-allocate result buffer with space for chunk headers
  let totalSize = 0;
  for (let i = 0; i < chunkCount; i++) {
    const chunkStart = i * STREAM_CHUNK_SIZE;
    const chunkEnd = Math.min(chunkStart + STREAM_CHUNK_SIZE, data.length);
    const chunk = data.slice(chunkStart, chunkEnd);
    const encryptedChunk = encryptData(chunk, keyHex);
    encryptedChunks.push(encryptedChunk);
    totalSize += 4 + encryptedChunk.length; // 4 bytes for chunk size + encrypted data

    if (onProgress) {
      onProgress(chunkEnd, data.length);
    }
  }

  // Combine all chunks with size headers
  const result = new Uint8Array(totalSize);
  let offset = 0;

  for (const chunk of encryptedChunks) {
    // Write chunk size (4 bytes, big-endian)
    const chunkSizeView = new DataView(result.buffer, offset, 4);
    chunkSizeView.setUint32(0, chunk.length, false); // big-endian
    offset += 4;

    // Write encrypted chunk
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Chunked decryption for medium-sized files
 * @param encryptedData - Encrypted data with chunk headers
 * @param keyHex - 32-byte encryption key as hex
 * @param chunkCount - Number of chunks to expect
 * @param onProgress - Optional progress callback
 * @returns Decrypted data
 */
async function decryptDataChunked(
  encryptedData: Uint8Array,
  keyHex: string,
  chunkCount: number,
  onProgress?: StreamProgressCallback,
): Promise<Uint8Array> {
  const decryptedChunks: Uint8Array[] = [];
  let offset = 0;
  let totalDecryptedSize = 0;

  for (let i = 0; i < chunkCount; i++) {
    if (offset + 4 > encryptedData.length) {
      throw new Error(`Invalid chunk header at chunk ${i}`);
    }

    // Read chunk size
    const chunkSizeView = new DataView(encryptedData.buffer, offset, 4);
    const chunkSize = chunkSizeView.getUint32(0, false); // big-endian
    offset += 4;

    if (offset + chunkSize > encryptedData.length) {
      throw new Error(`Invalid chunk size at chunk ${i}: ${chunkSize}`);
    }

    // Extract and decrypt chunk
    const encryptedChunk = encryptedData.slice(offset, offset + chunkSize);
    const decryptedChunk = decryptData(encryptedChunk, keyHex);
    decryptedChunks.push(decryptedChunk);
    totalDecryptedSize += decryptedChunk.length;
    offset += chunkSize;

    if (onProgress) {
      onProgress(i + 1, chunkCount);
    }
  }

  // Combine all decrypted chunks
  const result = new Uint8Array(totalDecryptedSize);
  let resultOffset = 0;

  for (const chunk of decryptedChunks) {
    result.set(chunk, resultOffset);
    resultOffset += chunk.length;
  }

  return result;
}

/**
 * Direct file encryption for small files
 * @param inputUri - Input file URI
 * @param outputUri - Output file URI
 * @param keyHex - 32-byte encryption key as hex
 */
async function encryptFileDirect(
  inputUri: string,
  outputUri: string,
  keyHex: string,
): Promise<void> {
  // Read entire file
  const fileData = await readFileAsUint8Array(inputUri);

  // Encrypt data
  const encryptedData = encryptData(fileData, keyHex);

  // Write encrypted file
  await writeFileFromUint8Array(outputUri, encryptedData);
}

/**
 * Direct file decryption for small files
 * @param inputUri - Input encrypted file URI
 * @param outputUri - Output decrypted file URI
 * @param keyHex - 32-byte encryption key as hex
 */
async function decryptFileDirect(
  inputUri: string,
  outputUri: string,
  keyHex: string,
): Promise<void> {
  // Read encrypted file
  const encryptedData = await readFileAsUint8Array(inputUri);

  // Decrypt data
  const decryptedData = decryptData(encryptedData, keyHex);

  // Write decrypted file
  await writeFileFromUint8Array(outputUri, decryptedData);
}

/**
 * Chunked file encryption for medium-sized files
 * @param inputUri - Input file URI
 * @param outputUri - Output file URI
 * @param keyHex - 32-byte encryption key as hex
 * @param onProgress - Optional progress callback
 */
async function encryptFileChunked(
  inputUri: string,
  outputUri: string,
  keyHex: string,
  onProgress?: StreamProgressCallback,
): Promise<void> {
  const fileInfo = await getFileInfo(inputUri);
  const totalSize = fileInfo.size;
  const chunkCount = Math.ceil(totalSize / STREAM_CHUNK_SIZE);

  // Open output stream
  const outputStream = await openFileWriteStream(outputUri);

  try {
    for (let i = 0; i < chunkCount; i++) {
      const chunkStart = i * STREAM_CHUNK_SIZE;
      const chunkEnd = Math.min(chunkStart + STREAM_CHUNK_SIZE, totalSize);
      const chunkSize = chunkEnd - chunkStart;

      // Read chunk
      const chunk = await readFileChunk(inputUri, chunkStart, chunkSize);

      // Encrypt chunk
      const encryptedChunk = encryptData(chunk, keyHex);

      // Write chunk size (4 bytes, big-endian) + encrypted data
      const sizeHeader = new Uint8Array(4);
      const sizeView = new DataView(sizeHeader.buffer);
      sizeView.setUint32(0, encryptedChunk.length, false);

      await outputStream.write(sizeHeader);
      await outputStream.write(encryptedChunk);

      if (onProgress) {
        onProgress(chunkEnd, totalSize);
      }
    }
  } finally {
    await outputStream.close();
  }
}

/**
 * Chunked file decryption for medium-sized files
 * @param inputUri - Input encrypted file URI
 * @param outputUri - Output decrypted file URI
 * @param keyHex - 32-byte encryption key as hex
 * @param chunkCount - Number of chunks to expect
 * @param onProgress - Optional progress callback
 */
async function decryptFileChunked(
  inputUri: string,
  outputUri: string,
  keyHex: string,
  chunkCount: number,
  onProgress?: StreamProgressCallback,
): Promise<void> {
  const outputStream = await openFileWriteStream(outputUri);
  let offset = 0;

  try {
    for (let i = 0; i < chunkCount; i++) {
      // Read chunk size
      const sizeHeader = await readFileChunk(inputUri, offset, 4);
      const sizeView = new DataView(sizeHeader.buffer);
      const chunkSize = sizeView.getUint32(0, false); // big-endian
      offset += 4;

      // Read encrypted chunk
      const encryptedChunk = await readFileChunk(inputUri, offset, chunkSize);
      offset += chunkSize;

      // Decrypt chunk
      const decryptedChunk = decryptData(encryptedChunk, keyHex);

      // Write decrypted chunk
      await outputStream.write(decryptedChunk);

      if (onProgress) {
        onProgress(i + 1, chunkCount);
      }
    }
  } finally {
    await outputStream.close();
  }
}

// Helper functions (these would need to be implemented based on the file system library used)

async function getFileInfo(fileUri: string): Promise<{ size: number }> {
  // Implementation depends on file system library
  throw new Error("getFileInfo not implemented - requires file system library");
}

async function readFileAsUint8Array(fileUri: string): Promise<Uint8Array> {
  // Implementation depends on file system library
  throw new Error(
    "readFileAsUint8Array not implemented - requires file system library",
  );
}

async function writeFileFromUint8Array(
  fileUri: string,
  data: Uint8Array,
): Promise<void> {
  // Implementation depends on file system library
  throw new Error(
    "writeFileFromUint8Array not implemented - requires file system library",
  );
}

async function readFileChunk(
  fileUri: string,
  start: number,
  length: number,
): Promise<Uint8Array> {
  // Implementation depends on file system library
  throw new Error(
    "readFileChunk not implemented - requires file system library",
  );
}

async function openFileWriteStream(fileUri: string): Promise<{
  write: (data: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
}> {
  // Implementation depends on file system library
  throw new Error(
    "openFileWriteStream not implemented - requires file system library",
  );
}
