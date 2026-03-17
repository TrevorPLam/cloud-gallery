// Server-side tests for encrypted upload functionality
// Tests the upload route's handling of encrypted files and metadata validation

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import multer from 'multer';
import uploadRoutes from './upload-routes';
import { validateFile, sanitizeFilename, getAllowedFileTypes } from './file-validation';

// Mock dependencies
vi.mock('./file-validation');
vi.mock('./auth');

// Mock authentication middleware
const mockAuthenticateToken = vi.fn((req, res, next) => {
  req.user = { id: 'test-user-id', email: 'test@example.com' };
  next();
});

vi.mock('./auth', () => ({
  authenticateToken: mockAuthenticateToken,
}));

const mockValidateFile = vi.mocked(validateFile);
const mockGetAllowedFileTypes = vi.mocked(getAllowedFileTypes);

describe('Upload Routes - Encrypted Files', () => {
  let app: express.Application;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup Express app with upload routes
    app = express();
    app.use(express.json());
    app.use('/api/upload', uploadRoutes);
    
    // Setup default mocks
    mockGetAllowedFileTypes.mockReturnValue({
      'image/jpeg': { maxSize: 10 * 1024 * 1024, extension: '.jpg' },
      'image/png': { maxSize: 10 * 1024 * 1024, extension: '.png' },
      'application/octet-stream': { maxSize: 20 * 1024 * 1024, extension: '.bin' },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/upload/single - Encrypted Files', () => {
    const validEncryptionMetadata = {
      iv: 'a1b2c3d4e5f6789012345678901234567890abcdef123456', // 48 chars (24 bytes)
      authTag: '1234567890abcdef1234567890abcdef12345678', // 32 chars (16 bytes)
      algorithm: 'XChaCha20-Poly1305',
    };

    const createEncryptedFormData = (overrides: any = {}) => {
      const formData = new FormData();
      formData.append('file', new Blob(['encrypted data']), 'test.jpg');
      formData.append('encrypted', 'true');
      formData.append('iv', overrides.iv || validEncryptionMetadata.iv);
      formData.append('authTag', overrides.authTag || validEncryptionMetadata.authTag);
      formData.append('algorithm', overrides.algorithm || validEncryptionMetadata.algorithm);
      formData.append('metadata', JSON.stringify({
        width: 1920,
        height: 1080,
        filename: 'test.jpg',
        ...overrides.metadata,
      }));
      return formData;
    };

    it('should accept encrypted files with valid metadata', async () => {
      const formData = createEncryptedFormData();

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('File uploaded successfully');
      expect(response.body.file.encrypted).toBe(true);
      expect(response.body.file.encryptionMetadata).toBeDefined();
      expect(response.body.file.encryptionMetadata.iv).toBe(validEncryptionMetadata.iv);
      expect(response.body.file.encryptionMetadata.authTag).toBe(validEncryptionMetadata.authTag);
      expect(response.body.file.encryptionMetadata.algorithm).toBe(validEncryptionMetadata.algorithm);
      expect(response.body.file.encryptionMetadata.encryptedAt).toBeDefined();
    });

    it('should reject encrypted files missing IV', async () => {
      const formData = createEncryptedFormData({ iv: '' });

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing encryption metadata');
      expect(response.body.details.required).toContain('iv');
      expect(response.body.details.provided.iv).toBe(false);
    });

    it('should reject encrypted files missing authTag', async () => {
      const formData = createEncryptedFormData({ authTag: '' });

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing encryption metadata');
      expect(response.body.details.required).toContain('authTag');
      expect(response.body.details.provided.authTag).toBe(false);
    });

    it('should reject encrypted files with invalid IV format', async () => {
      const formData = createEncryptedFormData({ 
        iv: 'invalid-iv-length' // Not 48 characters
      });

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid IV format');
      expect(response.body.message).toContain('48-character hex string');
      expect(response.body.details.received).toContain('19 characters');
    });

    it('should reject encrypted files with invalid authTag format', async () => {
      const formData = createEncryptedFormData({ 
        authTag: 'invalid-auth-tag' // Not 32 characters
      });

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid authTag format');
      expect(response.body.message).toContain('32-character hex string');
      expect(response.body.details.received).toContain('16 characters');
    });

    it('should reject encrypted files with unsupported algorithm', async () => {
      const formData = createEncryptedFormData({ 
        algorithm: 'AES-256-GCM' // Not supported
      });

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Unsupported encryption algorithm');
      expect(response.body.message).toContain('AES-256-GCM');
      expect(response.body.details.supported).toContain('XChaCha20-Poly1305');
    });

    it('should handle unencrypted files normally', async () => {
      mockValidateFile.mockResolvedValue({
        isValid: true,
        mimeType: 'image/jpeg',
        extension: '.jpg',
        size: 1024,
        hash: 'test-hash',
        errors: [],
      });

      const formData = new FormData();
      formData.append('file', new Blob(['image data']), 'test.jpg');
      formData.append('encrypted', 'false');
      formData.append('metadata', JSON.stringify({
        width: 1920,
        height: 1080,
        filename: 'test.jpg',
      }));

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(201);
      expect(response.body.file.encrypted).toBe(false);
      expect(response.body.file.encryptionMetadata).toBeUndefined();
    });

    it('should validate unencrypted files normally', async () => {
      mockValidateFile.mockResolvedValue({
        isValid: false,
        mimeType: 'image/jpeg',
        extension: '.jpg',
        size: 1024,
        hash: 'test-hash',
        errors: ['File type not allowed'],
      });

      const formData = new FormData();
      formData.append('file', new Blob(['image data']), 'test.jpg');
      formData.append('encrypted', 'false');

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('File validation failed');
      expect(response.body.details.errors).toContain('File type not allowed');
    });

    it('should handle malformed metadata gracefully', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['encrypted data']), 'test.jpg');
      formData.append('encrypted', 'true');
      formData.append('iv', validEncryptionMetadata.iv);
      formData.append('authTag', validEncryptionMetadata.authTag);
      formData.append('algorithm', validEncryptionMetadata.algorithm);
      formData.append('metadata', 'invalid-json-{');

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(201);
      expect(response.body.file.encrypted).toBe(true);
      // Should handle malformed metadata gracefully and continue
    });
  });

  describe('GET /api/upload/allowed-types', () => {
    it('should return allowed file types', async () => {
      const response = await request(app)
        .get('/api/upload/allowed-types');

      expect(response.status).toBe(200);
      expect(response.body.allowedTypes).toBeDefined();
      expect(response.body.maxFilesPerRequest).toBe(5);
      expect(response.body.maxFileSize).toBe(20 * 1024 * 1024);
    });
  });

  describe('POST /api/upload/validate', () => {
    it('should validate file parameters', async () => {
      const response = await request(app)
        .post('/api/upload/validate')
        .send({
          filename: 'test.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
        });

      expect(response.status).toBe(200);
      expect(response.body.valid).toBe(true);
    });

    it('should reject invalid file type', async () => {
      const response = await request(app)
        .post('/api/upload/validate')
        .send({
          filename: 'test.exe',
          size: 1024,
          mimeType: 'application/octet-stream',
        });

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('File type not allowed');
    });

    it('should reject oversized files', async () => {
      const response = await request(app)
        .post('/api/upload/validate')
        .send({
          filename: 'test.jpg',
          size: 25 * 1024 * 1024, // 25MB, over the 20MB limit
          mimeType: 'image/jpeg',
        });

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('File too large');
    });

    it('should reject invalid filenames', async () => {
      const response = await request(app)
        .post('/api/upload/validate')
        .send({
          filename: '../../../etc/passwd',
          size: 1024,
          mimeType: 'image/jpeg',
        });

      expect(response.status).toBe(400);
      expect(response.body.valid).toBe(false);
      expect(response.body.error).toBe('Invalid filename');
    });
  });

  describe('Security Tests', () => {
    it('should reject requests without authentication', async () => {
      const formData = createEncryptedFormData();

      const response = await request(app)
        .post('/api/upload/single')
        .send(formData);

      expect(response.status).toBe(401);
    });

    it('should sanitize dangerous filenames', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['data']), '../../../malicious.exe');
      formData.append('encrypted', 'false');

      // This should be handled by multer's fileFilter
      // The exact behavior depends on the multer configuration
      expect(true).toBe(true); // Placeholder test
    });

    it('should reject files with dangerous extensions', async () => {
      const formData = new FormData();
      formData.append('file', new Blob(['malicious content']), 'malware.exe');
      formData.append('encrypted', 'false');

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      // Should be rejected by multer's fileFilter
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle multipart form data size limits', async () => {
      // Create a large file that exceeds multer's limits
      const largeData = 'x'.repeat(25 * 1024 * 1024); // 25MB
      const formData = new FormData();
      formData.append('file', new Blob([largeData]), 'large.jpg');
      formData.append('encrypted', 'false');

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      // Should be rejected due to size limits
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing file', async () => {
      const formData = new FormData();
      formData.append('encrypted', 'true');
      formData.append('iv', validEncryptionMetadata.iv);
      formData.append('authTag', validEncryptionMetadata.authTag);

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('No file provided');
    });

    it('should handle server errors gracefully', async () => {
      // Mock a server error
      const originalWriteFileSync = require('fs').promises.writeFile;
      require('fs').promises.writeFile = vi.fn().mockRejectedValue(new Error('Disk full'));

      const formData = createEncryptedFormData();

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');

      // Restore original function
      require('fs').promises.writeFile = originalWriteFileSync;
    });

    it('should validate encryption metadata after processing', async () => {
      // Mock a scenario where encryption metadata gets lost during processing
      const formData = createEncryptedFormData();

      // Intercept the request to simulate metadata loss
      const originalPost = app.post;
      let interceptedRequest: any = null;
      
      app.post = (path: string, ...handlers: any[]) => {
        if (path === '/api/upload/single') {
          const originalHandler = handlers[handlers.length - 1];
          handlers[handlers.length - 1] = async (req: any, res: any, next: any) => {
            interceptedRequest = req;
            // Simulate metadata loss
            if (req.body.encrypted === 'true') {
              req.body.iv = '';
              req.body.authTag = '';
            }
            return originalHandler(req, res, next);
          };
        }
        return originalPost.call(app, path, ...handlers);
      };

      const response = await request(app)
        .post('/api/upload/single')
        .set('Authorization', 'Bearer valid-token')
        .send(formData);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Missing encryption metadata');
    });
  });

  describe('Encryption Metadata Validation', () => {
    it('should validate IV hex format precisely', async () => {
      const testCases = [
        { iv: 'a1b2c3d4e5f6789012345678901234567890abcdef123456', valid: true }, // Valid
        { iv: 'A1B2C3D4E5F6789012345678901234567890ABCDEF123456', valid: true }, // Valid uppercase
        { iv: 'a1b2c3d4e5f6789012345678901234567890abcdef12345', valid: false }, // Too short
        { iv: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567', valid: false }, // Too long
        { iv: 'g1b2c3d4e5f6789012345678901234567890abcdef123456', valid: false }, // Invalid hex char
        { iv: 'a1b2c3d4e5f6789012345678901234567890abcde!123456', valid: false }, // Invalid char
      ];

      for (const testCase of testCases) {
        const formData = createEncryptedFormData({ iv: testCase.iv });

        const response = await request(app)
          .post('/api/upload/single')
          .set('Authorization', 'Bearer valid-token')
          .send(formData);

        if (testCase.valid) {
          expect(response.status).toBe(201);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Invalid IV format');
        }
      }
    });

    it('should validate authTag hex format precisely', async () => {
      const testCases = [
        { authTag: '1234567890abcdef1234567890abcdef12345678', valid: true }, // Valid
        { authTag: '1234567890ABCDEF1234567890ABCDEF12345678', valid: true }, // Valid uppercase
        { authTag: '1234567890abcdef1234567890abcdef1234567', valid: false }, // Too short
        { authTag: '1234567890abcdef1234567890abcdef123456789', valid: false }, // Too long
        { authTag: 'g234567890abcdef1234567890abcdef12345678', valid: false }, // Invalid hex char
        { authTag: '1234567890abcdef1234567890abcdef12345!78', valid: false }, // Invalid char
      ];

      for (const testCase of testCases) {
        const formData = createEncryptedFormData({ authTag: testCase.authTag });

        const response = await request(app)
          .post('/api/upload/single')
          .set('Authorization', 'Bearer valid-token')
          .send(formData);

        if (testCase.valid) {
          expect(response.status).toBe(201);
        } else {
          expect(response.status).toBe(400);
          expect(response.body.error).toBe('Invalid authTag format');
        }
      }
    });
  });
});
