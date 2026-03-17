// AI-META-BEGIN
// AI-META: Integration tests for object storage service
// OWNERSHIP: server/services
// ENTRYPOINTS: run via vitest test suite
// DEPENDENCIES: vitest, @aws-sdk/client-s3, @aws-sdk/s3-request-presigner
// DANGER: Tests interact with storage services - ensure proper isolation
// CHANGE-SAFETY: Maintain test coverage for all storage operations
// TESTS: npm run test server/services/object-storage.test.ts
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ObjectStorageService, initializeObjectStorage, generateObjectKey, extractUserIdFromKey } from './object-storage';

// Mock environment variables
const mockEnv = {
  STORAGE_PROVIDER: 'minio',
  STORAGE_BUCKET: 'test-bucket',
  STORAGE_REGION: 'us-east-1',
  STORAGE_ACCESS_KEY: 'test-access-key',
  STORAGE_SECRET_KEY: 'test-secret-key',
  STORAGE_ENDPOINT: 'http://localhost:9000',
};

// Mock AWS SDK
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ input })),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://test-presigned-url.com'),
}));

describe('ObjectStorageService', () => {
  let storageService: ObjectStorageService;

  beforeEach(() => {
    // Set up environment variables
    Object.entries(mockEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Clear any existing service instance
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variables
    Object.keys(mockEnv).forEach(key => {
      delete process.env[key];
    });
  });

  describe('initializeObjectStorage', () => {
    it('should initialize service with valid environment variables', () => {
      const service = initializeObjectStorage();
      expect(service).toBeInstanceOf(ObjectStorageService);
    });

    it('should throw error when access key is missing', () => {
      delete process.env.STORAGE_ACCESS_KEY;
      expect(() => initializeObjectStorage()).toThrow('Storage credentials are required');
    });

    it('should throw error when secret key is missing', () => {
      delete process.env.STORAGE_SECRET_KEY;
      expect(() => initializeObjectStorage()).toThrow('Storage credentials are required');
    });

    it('should throw error when bucket is missing', () => {
      delete process.env.STORAGE_BUCKET;
      expect(() => initializeObjectStorage()).toThrow('Storage bucket is required');
    });

    it('should throw error when MinIO endpoint is missing', () => {
      process.env.STORAGE_PROVIDER = 'minio';
      delete process.env.STORAGE_ENDPOINT;
      expect(() => initializeObjectStorage()).toThrow('MinIO requires STORAGE_ENDPOINT');
    });

    it('should throw error when Backblaze B2 endpoint is missing', () => {
      process.env.STORAGE_PROVIDER = 'b2';
      delete process.env.STORAGE_ENDPOINT;
      expect(() => initializeObjectStorage()).toThrow('Backblaze B2 requires STORAGE_ENDPOINT');
    });
  });

  describe('generateObjectKey', () => {
    it('should generate unique object keys with user ID', () => {
      const userId = 'user-123';
      const key1 = generateObjectKey(userId);
      const key2 = generateObjectKey(userId);

      expect(key1).toMatch(/^user-123\/[a-f0-9-]{36}$/);
      expect(key2).toMatch(/^user-123\/[a-f0-9-]{36}$/);
      expect(key1).not.toBe(key2); // Should be unique
    });

    it('should include file extension when provided', () => {
      const userId = 'user-123';
      const originalName = 'photo.jpg';
      const key = generateObjectKey(userId, originalName);

      expect(key).toMatch(/^user-123\/[a-f0-9-]{36}\.jpg$/);
    });

    it('should handle files without extension', () => {
      const userId = 'user-123';
      const originalName = 'photo';
      const key = generateObjectKey(userId, originalName);

      expect(key).toMatch(/^user-123\/[a-f0-9-]{36}$/);
    });
  });

  describe('extractUserIdFromKey', () => {
    it('should extract user ID from valid object key', () => {
      const key = 'user-123/abc-123-def-456.jpg';
      const userId = extractUserIdFromKey(key);
      expect(userId).toBe('user-123');
    });

    it('should return null for invalid object key', () => {
      const invalidKey = 'invalid-key';
      const userId = extractUserIdFromKey(invalidKey);
      expect(userId).toBeNull();
    });

    it('should return null for empty key', () => {
      const userId = extractUserIdFromKey('');
      expect(userId).toBeNull();
    });

    it('should handle keys with multiple path segments', () => {
      const key = 'user-123/abc-123/def-456.jpg';
      const userId = extractUserIdFromKey(key);
      expect(userId).toBe('user-123');
    });
  });

  describe('ObjectStorageService operations', () => {
    beforeEach(() => {
      storageService = initializeObjectStorage();
    });

    describe('uploadObject', () => {
      it('should upload object successfully', async () => {
        const mockSend = vi.fn().mockResolvedValue({
          ETag: '"abc-123"',
          Location: 'https://test-bucket.s3.amazonaws.com/test-key',
        });

        // Mock the S3Client send method
        const { S3Client } = await import('@aws-sdk/client-s3');
        vi.mocked(S3Client).mockImplementation(() => ({
          send: mockSend,
        } as any));

        const key = 'user-123/test-file.jpg';
        const body = Buffer.from('test file content');
        const contentType = 'image/jpeg';
        const userId = 'user-123';

        const result = await storageService.uploadObject(key, body, contentType, userId);

        expect(result).toEqual({
          key: 'user-123/test-file.jpg',
          etag: '"abc-123"',
          location: 'https://test-bucket.s3.amazonaws.com/test-key',
        });

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              Bucket: 'test-bucket',
              Key: 'user-123/test-file.jpg',
              Body: body,
              ContentType: contentType,
              Metadata: expect.objectContaining({
                userId: 'user-123',
                uploadedAt: expect.any(String),
                originalSize: body.length.toString(),
              }),
            }),
          })
        );
      });

      it('should prefix key with userId if not already present', async () => {
        const mockSend = vi.fn().mockResolvedValue({ ETag: '"test-etag"' });

        const { S3Client } = await import('@aws-sdk/client-s3');
        vi.mocked(S3Client).mockImplementation(() => ({
          send: mockSend,
        } as any));

        const key = 'test-file.jpg';
        const body = Buffer.from('test content');
        const contentType = 'image/jpeg';
        const userId = 'user-123';

        await storageService.uploadObject(key, body, contentType, userId);

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              Key: 'user-123/test-file.jpg', // Should be prefixed
            }),
          })
        );
      });

      it('should not modify key if already prefixed with userId', async () => {
        const mockSend = vi.fn().mockResolvedValue({ ETag: '"test-etag"' });

        const { S3Client } = await import('@aws-sdk/client-s3');
        vi.mocked(S3Client).mockImplementation(() => ({
          send: mockSend,
        } as any));

        const key = 'user-123/existing-file.jpg';
        const body = Buffer.from('test content');
        const contentType = 'image/jpeg';
        const userId = 'user-123';

        await storageService.uploadObject(key, body, contentType, userId);

        expect(mockSend).toHaveBeenCalledWith(
          expect.objectContaining({
            input: expect.objectContaining({
              Key: 'user-123/existing-file.jpg', // Should remain unchanged
            }),
          })
        );
      });

      it('should handle upload errors', async () => {
        const mockSend = vi.fn().mockRejectedValue(new Error('Upload failed'));

        const { S3Client } = await import('@aws-sdk/client-s3');
        vi.mocked(S3Client).mockImplementation(() => ({
          send: mockSend,
        } as any));

        const key = 'user-123/test-file.jpg';
        const body = Buffer.from('test content');
        const contentType = 'image/jpeg';
        const userId = 'user-123';

        await expect(
          storageService.uploadObject(key, body, contentType, userId)
        ).rejects.toThrow('Failed to upload object: Upload failed');
      });
    });

    describe('getPresignedUrl', () => {
      it('should generate presigned URL with default expiration', async () => {
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        vi.mocked(getSignedUrl).mockResolvedValue('https://presigned-url.com');

        const key = 'user-123/test-file.jpg';
        const url = await storageService.getPresignedUrl(key);

        expect(url).toBe('https://presigned-url.com');
        expect(getSignedUrl).toHaveBeenCalledWith(
          expect.any(Object), // client
          expect.any(Object), // command
          { expiresIn: 1800 } // default 30 minutes
        );
      });

      it('should generate presigned URL with custom expiration', async () => {
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        vi.mocked(getSignedUrl).mockResolvedValue('https://presigned-url.com');

        const key = 'user-123/test-file.jpg';
        const url = await storageService.getPresignedUrl(key, { expiresIn: 300 });

        expect(url).toBe('https://presigned-url.com');
        expect(getSignedUrl).toHaveBeenCalledWith(
          expect.any(Object),
          expect.any(Object),
          { expiresIn: 300 } // custom 5 minutes
        );
      });

      it('should handle presigned URL generation errors', async () => {
        const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
        vi.mocked(getSignedUrl).mockRejectedValue(new Error('URL generation failed'));

        const key = 'user-123/test-file.jpg';

        await expect(
          storageService.getPresignedUrl(key)
        ).rejects.toThrow('Failed to generate presigned URL: URL generation failed');
      });
    });

    describe('objectExists', () => {
      it('should return true when object exists', async () => {
        const mockSend = vi.fn().mockResolvedValue({ Body: Buffer.from('test') });

        const { S3Client } = await import('@aws-sdk/client-s3');
        vi.mocked(S3Client).mockImplementation(() => ({
          send: mockSend,
        } as any));

        const key = 'user-123/existing-file.jpg';
        const exists = await storageService.objectExists(key);

        expect(exists).toBe(true);
      });

      it('should return false when object does not exist', async () => {
        const mockSend = vi.fn().mockRejectedValue(new Error('NoSuchKey'));
        (mockSend as any).mockRejectedValue = vi.fn().mockRejectedValue({
          name: 'NoSuchKey',
        });

        const { S3Client } = await import('@aws-sdk/client-s3');
        vi.mocked(S3Client).mockImplementation(() => ({
          send: mockSend,
        } as any));

        const key = 'user-123/non-existing-file.jpg';
        const exists = await storageService.objectExists(key);

        expect(exists).toBe(false);
      });

      it('should throw error for other types of errors', async () => {
        const mockSend = vi.fn().mockRejectedValue(new Error('Access denied'));

        const { S3Client } = await import('@aws-sdk/client-s3');
        vi.mocked(S3Client).mockImplementation(() => ({
          send: mockSend,
        } as any));

        const key = 'user-123/test-file.jpg';

        await expect(
          storageService.objectExists(key)
        ).rejects.toThrow('Access denied');
      });
    });

    describe('getProviderInfo', () => {
      it('should return provider information', () => {
        const info = storageService.getProviderInfo();

        expect(info).toEqual({
          provider: 'minio',
          bucket: 'test-bucket',
        });
      });
    });
  });

  describe('getObjectStorage', () => {
    it('should return initialized service instance', () => {
      const service = initializeObjectStorage();
      const retrieved = getObjectStorage();

      expect(retrieved).toBe(service);
    });

    it('should throw error when service not initialized', () => {
      // Clear the service instance
      vi.clearAllMocks();

      expect(() => getObjectStorage()).toThrow(
        'Object storage service not initialized. Call initializeObjectStorage() first.'
      );
    });
  });
});
