// AI-META-BEGIN
// AI-META: S3-compatible object storage service for Cloud Gallery
// OWNERSHIP: server/services
// ENTRYPOINTS: imported by upload-routes.ts and photo-routes.ts
// DEPENDENCIES: @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, crypto
// DANGER: Handles file uploads and storage credentials - ensure proper security validation
// CHANGE-SAFETY: Maintain backward compatibility with existing photo records, preserve error handling patterns
// TESTS: server/services/object-storage.test.ts, integration tests for upload/download flows
// AI-META-END

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// Storage provider types
export type StorageProvider = 's3' | 'b2' | 'minio';

export interface StorageConfig {
  provider: StorageProvider;
  bucket: string;
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface UploadResult {
  key: string;
  etag?: string;
  location?: string;
}

export interface PresignedUrlOptions {
  expiresIn?: number; // seconds, default 1800 (30 minutes)
}

/**
 * Object Storage Service
 * 
 * Provides S3-compatible storage abstraction supporting:
 * - AWS S3
 * - Backblaze B2 
 * - MinIO
 * 
 * All files are stored with UUID keys under user-specific prefixes
 * to ensure isolation and prevent conflicts.
 */
export class ObjectStorageService {
  private client: S3Client;
  private bucket: string;
  private provider: StorageProvider;

  constructor(config: StorageConfig) {
    this.bucket = config.bucket;
    this.provider = config.provider;

    // Create S3 client with provider-specific configuration
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      // MinIO requires forcePathStyle for compatibility
      forcePathStyle: config.provider === 'minio',
      // Backblaze B2 requires path style
      forcePathStyle: config.provider === 'b2',
    });
  }

  /**
   * Upload an object to storage
   * 
   * @param key - Object key (will be prefixed with userId if not already)
   * @param body - File buffer
   * @param contentType - MIME type
   * @param userId - User ID for isolation (optional if key already includes userId)
   * @returns Upload result with object key and metadata
   */
  async uploadObject(
    key: string,
    body: Buffer,
    contentType: string,
    userId?: string
  ): Promise<UploadResult> {
    try {
      // Ensure user isolation by prefixing with userId if not already present
      const objectKey = userId && !key.startsWith(`${userId}/`) 
        ? `${userId}/${key}` 
        : key;

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        Body: body,
        ContentType: contentType,
        // Add metadata for tracking
        Metadata: {
          uploadedAt: new Date().toISOString(),
          originalSize: body.length.toString(),
          ...(userId && { userId }),
        },
      });

      const result = await this.client.send(command);

      return {
        key: objectKey,
        etag: result.ETag,
        location: result.Location,
      };
    } catch (error) {
      console.error('Object storage upload failed:', error);
      throw new Error(`Failed to upload object: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate a presigned URL for object access
   * 
   * @param key - Object key
   * @param options - URL generation options
   * @returns Presigned URL string
   */
  async getPresignedUrl(
    key: string, 
    options: PresignedUrlOptions = {}
  ): Promise<string> {
    try {
      const { expiresIn = 1800 } = options; // Default 30 minutes

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const url = await getSignedUrl(this.client, command, { expiresIn });

      return url;
    } catch (error) {
      console.error('Failed to generate presigned URL:', error);
      throw new Error(`Failed to generate presigned URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if an object exists
   * 
   * @param key - Object key
   * @returns True if object exists
   */
  async objectExists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      // If object doesn't exist, return false
      if (error instanceof Error && error.name === 'NoSuchKey') {
        return false;
      }
      // For other errors, log and rethrow
      console.error('Failed to check object existence:', error);
      throw error;
    }
  }

  /**
   * Get storage provider information
   */
  getProviderInfo(): { provider: StorageProvider; bucket: string } {
    return {
      provider: this.provider,
      bucket: this.bucket,
    };
  }
}

// Global storage service instance
let storageService: ObjectStorageService | null = null;

/**
 * Initialize object storage service from environment variables
 */
export function initializeObjectStorage(): ObjectStorageService {
  if (storageService) {
    return storageService;
  }

  const provider = (process.env.STORAGE_PROVIDER || 'minio') as StorageProvider;
  const bucket = process.env.STORAGE_BUCKET || 'cloud-gallery-photos';
  const region = process.env.STORAGE_REGION || 'us-east-1';
  const accessKeyId = process.env.STORAGE_ACCESS_KEY;
  const secretAccessKey = process.env.STORAGE_SECRET_KEY;
  const endpoint = process.env.STORAGE_ENDPOINT;

  // Validate required environment variables
  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Storage credentials (STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY) are required');
  }

  if (!bucket) {
    throw new Error('Storage bucket (STORAGE_BUCKET) is required');
  }

  // Provider-specific endpoint requirements
  if (provider === 'minio' && !endpoint) {
    throw new Error('MinIO requires STORAGE_ENDPOINT to be configured');
  }

  if (provider === 'b2' && !endpoint) {
    throw new Error('Backblaze B2 requires STORAGE_ENDPOINT to be configured');
  }

  const config: StorageConfig = {
    provider,
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint,
  };

  storageService = new ObjectStorageService(config);
  return storageService;
}

/**
 * Get the initialized storage service instance
 */
export function getObjectStorage(): ObjectStorageService {
  if (!storageService) {
    throw new Error('Object storage service not initialized. Call initializeObjectStorage() first.');
  }
  return storageService;
}

/**
 * Generate a unique object key for a user's file
 * 
 * @param userId - User ID for isolation
 * @param originalName - Original filename (optional, for extension)
 * @returns Unique object key
 */
export function generateObjectKey(userId: string, originalName?: string): string {
  const uuid = randomUUID();
  
  if (originalName) {
    // Extract file extension from original name
    const lastDot = originalName.lastIndexOf('.');
    const extension = lastDot > 0 ? originalName.substring(lastDot) : '';
    return `${userId}/${uuid}${extension}`;
  }
  
  return `${userId}/${uuid}`;
}

/**
 * Extract user ID from an object key
 * 
 * @param key - Object key in format "userId/uuid[.ext]"
 * @returns User ID or null if format is invalid
 */
export function extractUserIdFromKey(key: string): string | null {
  const parts = key.split('/');
  if (parts.length >= 2 && parts[0]) {
    return parts[0];
  }
  return null;
}
