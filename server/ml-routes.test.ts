// AI-META-BEGIN
// AI-META: Integration tests for ML API endpoints
// OWNERSHIP: server/api
// ENTRYPOINTS: run by vitest during testing
// DEPENDENCIES: supertest, express, vitest, ml-routes
// DANGER: Tests validate API security and functionality
// CHANGE-SAFETY: Add new tests when extending ML endpoints
// TESTS: npm run test
// AI-META-END

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { Express } from 'express';
import express from 'express';
import { registerRoutes } from './routes';
import { createServer } from 'node:http';
import { db } from './db';
import { photos, users } from '../shared/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// ─────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────

describe('ML Routes Integration Tests', () => {
  let app: Express;
  let server: any;
  let authToken: string;
  let testUserId: string;
  let testPhotoId: string;

  beforeEach(async () => {
    // Create test app
    app = express() as Express;
    server = createServer(app);
    
    // Register routes
    await registerRoutes(app);
    
    // Create test user and get auth token
    const testUser = await db
      .insert(users)
      .values({
        username: 'ml_test_user',
        password: 'test_password_hash',
      })
      .returning();

    testUserId = testUser[0].id;
    authToken = jwt.sign({ id: testUserId }, process.env.JWT_SECRET || 'test_secret');

    // Create test photo
    const testPhoto = await db
      .insert(photos)
      .values({
        userId: testUserId,
        uri: 'file:///test/ml_photo.jpg',
        width: 800,
        height: 600,
        filename: 'ml_photo.jpg',
      })
      .returning();

    testPhotoId = testPhoto[0].id;
  });

  afterEach(async () => {
    // Cleanup test data
    await db.delete(photos).where(eq(photos.userId, testUserId));
    await db.delete(users).where(eq(users.id, testUserId));
    
    if (server) {
      server.close();
    }
  });

  // ─────────────────────────────────────────────────────────
  // AUTHENTICATION TESTS
  // ─────────────────────────────────────────────────────────

  describe('Authentication', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .post('/api/ml/analyze')
        .send({
          photoId: testPhotoId,
          analysisTypes: ['object_detection'],
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'User not authenticated');
    });

    it('should reject requests with invalid token', async () => {
      const response = await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', 'Bearer invalid_token')
        .send({
          photoId: testPhotoId,
          analysisTypes: ['object_detection'],
        });

      expect(response.status).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────
  // ML ANALYSIS ENDPOINTS
  // ─────────────────────────────────────────────────────────

  describe('POST /api/ml/analyze', () => {
    it('should accept valid ML analysis request', async () => {
      const response = await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photoId: testPhotoId,
          analysisTypes: ['object_detection', 'ocr'],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'ML analysis completed');
      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toHaveProperty('photoId', testPhotoId);
      expect(response.body.results).toHaveProperty('processingTime');
      expect(response.body.results).toHaveProperty('mlVersion');
    });

    it('should reject requests with invalid photo ID', async () => {
      const response = await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photoId: 'invalid-uuid',
          analysisTypes: ['object_detection'],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request data');
    });

    it('should reject requests for non-existent photo', async () => {
      const response = await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photoId: '123e4567-e89b-12d3-a456-426614174000',
          analysisTypes: ['object_detection'],
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Photo not found');
    });

    it('should reject requests with empty analysis types', async () => {
      const response = await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photoId: testPhotoId,
          analysisTypes: [],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request data');
    });

    it('should reject requests with invalid analysis types', async () => {
      const response = await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photoId: testPhotoId,
          analysisTypes: ['invalid_type'],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request data');
    });
  });

  // ─────────────────────────────────────────────────────────
  // ML STATUS ENDPOINTS
  // ─────────────────────────────────────────────────────────

  describe('GET /api/ml/status/:photoId', () => {
    it('should return ML status for existing photo', async () => {
      const response = await request(app)
        .get(`/api/ml/status/${testPhotoId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('photoId', testPhotoId);
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('results');
      expect(response.body.results).toHaveProperty('hasObjectDetection');
      expect(response.body.results).toHaveProperty('hasOCR');
      expect(response.body.results).toHaveProperty('hasPerceptualHash');
    });

    it('should return 404 for non-existent photo', async () => {
      const response = await request(app)
        .get('/api/ml/status/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Photo not found');
    });
  });

  // ─────────────────────────────────────────────────────────
  // BATCH ANALYSIS ENDPOINTS
  // ─────────────────────────────────────────────────────────

  describe('POST /api/ml/batch', () => {
    it('should accept valid batch analysis request', async () => {
      // Create additional test photos
      const photo2 = await db
        .insert(photos)
        .values({
          userId: testUserId,
          uri: 'file:///test/ml_photo2.jpg',
          width: 800,
          height: 600,
          filename: 'ml_photo2.jpg',
        })
        .returning();

      const response = await request(app)
        .post('/api/ml/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photoIds: [testPhotoId, photo2[0].id],
          analysisTypes: ['object_detection'],
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Batch analysis queued');
      expect(response.body).toHaveProperty('batchId');
      expect(response.body).toHaveProperty('photoCount', 2);
      expect(response.body).toHaveProperty('estimatedTime');

      // Cleanup
      await db.delete(photos).where(eq(photos.id, photo2[0].id));
    });

    it('should reject batch requests exceeding size limit', async () => {
      const photoIds = Array(51).fill('123e4567-e89b-12d3-a456-426614174000');

      const response = await request(app)
        .post('/api/ml/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photoIds,
          analysisTypes: ['object_detection'],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid batch request data');
    });

    it('should reject batch requests with invalid photo IDs', async () => {
      const response = await request(app)
        .post('/api/ml/batch')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photoIds: ['invalid-uuid'],
          analysisTypes: ['object_detection'],
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid batch request data');
    });
  });

  // ─────────────────────────────────────────────────────────
  // ML STATISTICS ENDPOINTS
  // ─────────────────────────────────────────────────────────

  describe('GET /api/ml/stats', () => {
    it('should return ML processing statistics', async () => {
      const response = await request(app)
        .get('/api/ml/stats')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('totalPhotos');
      expect(response.body).toHaveProperty('processedPhotos');
      expect(response.body).toHaveProperty('processingRate');
      expect(response.body).toHaveProperty('photosWithObjects');
      expect(response.body).toHaveProperty('photosWithText');
      expect(response.body).toHaveProperty('photosWithHash');
      expect(response.body).toHaveProperty('totalObjects');
      expect(response.body).toHaveProperty('averageObjectsPerPhoto');
      expect(response.body).toHaveProperty('commonObjects');
      expect(Array.isArray(response.body.commonObjects)).toBe(true);
    });

    it('should return zero statistics for new user', async () => {
      // Create new user with no photos
      const newUser = await db
        .insert(users)
        .values({
          username: 'new_ml_test_user',
          password: 'test_password_hash',
        })
        .returning();

      const newUserToken = jwt.sign({ id: newUser[0].id }, process.env.JWT_SECRET || 'test_secret');

      const response = await request(app)
        .get('/api/ml/stats')
        .set('Authorization', `Bearer ${newUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalPhotos).toBe(0);
      expect(response.body.processedPhotos).toBe(0);
      expect(response.body.processingRate).toBe(0);

      // Cleanup
      await db.delete(users).where(eq(users.id, newUser[0].id));
    });
  });

  // ─────────────────────────────────────────────────────────
  // DATABASE INTEGRATION TESTS
  // ─────────────────────────────────────────────────────────

  describe('Database Integration', () => {
    it('should update photo with ML results after analysis', async () => {
      // Trigger ML analysis
      await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photoId: testPhotoId,
          analysisTypes: ['object_detection', 'ocr', 'perceptual_hash'],
        });

      // Check if photo was updated
      const updatedPhoto = await db
        .select()
        .from(photos)
        .where(eq(photos.id, testPhotoId))
        .limit(1);

      expect(updatedPhoto.length).toBe(1);
      expect(updatedPhoto[0].mlProcessedAt).toBeDefined();
      expect(updatedPhoto[0].mlVersion).toBe('1.0.0');
      expect(Array.isArray(updatedPhoto[0].mlLabels)).toBe(true);
      expect(updatedPhoto[0].ocrText).toBeDefined();
      expect(updatedPhoto[0].ocrLanguage).toBeDefined();
      expect(updatedPhoto[0].perceptualHash).toBeDefined();
    });

    it('should maintain user isolation for ML analysis', async () => {
      // Create another user and photo
      const otherUser = await db
        .insert(users)
        .values({
          username: 'other_ml_user',
          password: 'test_password_hash',
        })
        .returning();

      const otherPhoto = await db
        .insert(photos)
        .values({
          userId: otherUser[0].id,
          uri: 'file:///test/other_photo.jpg',
          width: 800,
          height: 600,
          filename: 'other_photo.jpg',
        })
        .returning();

      const otherToken = jwt.sign({ id: otherUser[0].id }, process.env.JWT_SECRET || 'test_secret');

      // Try to analyze other user's photo with first user's token
      const response = await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photoId: otherPhoto[0].id,
          analysisTypes: ['object_detection'],
        });

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Photo not found');

      // Cleanup
      await db.delete(photos).where(eq(photos.id, otherPhoto[0].id));
      await db.delete(users).where(eq(users.id, otherUser[0].id));
    });
  });

  // ─────────────────────────────────────────────────────────
  // ERROR HANDLING TESTS
  // ─────────────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Content-Type', 'application/json')
        .send('invalid json');

      expect(response.status).toBe(400);
    });

    it('should handle missing required fields', async () => {
      const response = await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          // Missing photoId and analysisTypes
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Invalid request data');
    });

    it('should handle server errors gracefully', async () => {
      // Mock database error by temporarily breaking the connection
      const originalDb = db;
      // @ts-ignore - Intentionally breaking for test
      (global as any).db = null;

      const response = await request(app)
        .post('/api/ml/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          photoId: testPhotoId,
          analysisTypes: ['object_detection'],
        });

      expect(response.status).toBe(500);

      // Restore database connection
      (global as any).db = originalDb;
    });
  });
});
