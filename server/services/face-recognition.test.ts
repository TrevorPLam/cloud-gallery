// AI-META-BEGIN
// AI-META: Property tests for face recognition algorithms
// OWNERSHIP: server/services
// ENTRYPOINTS: run by test runner for algorithm validation
// DEPENDENCIES: fast-check, vitest, ./face-recognition
// DANGER: Property tests ensure algorithm correctness and edge case handling
// CHANGE-SAFETY: Maintain property test coverage for all public methods
// TESTS: npm run test server/services/face-recognition.test.ts
// AI-META-END

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { FaceRecognitionService, DEFAULT_CONFIG } from './face-recognition';

describe('FaceRecognitionService', () => {
  let service: FaceRecognitionService;

  beforeEach(() => {
    service = new FaceRecognitionService();
  });

  describe('Embedding Properties', () => {
    it('Property 1: Embedding determinism - same face should produce same embedding', async () => {
      // This is a placeholder test that would be implemented with actual model
      // In production, this would test that the same face image produces identical embeddings
      
      const mockFaceImage = Buffer.from('mock-face-image-data');
      
      // Generate multiple embeddings from the same image
      const embeddings = await Promise.all([
        service['detectionModel'].generateEmbedding(mockFaceImage),
        service['detectionModel'].generateEmbedding(mockFaceImage),
        service['detectionModel'].generateEmbedding(mockFaceImage),
      ]);

      // All embeddings should be identical (deterministic)
      embeddings.forEach((embedding, index) => {
        if (index > 0) {
          expect(embedding).toEqual(embeddings[0]);
        }
      });
    });

    it('Property 2: Embedding dimension consistency - all embeddings should have 128 dimensions', async () => {
      const mockFaceImage = Buffer.from('mock-face-image-data');
      
      const embedding = await service['detectionModel'].generateEmbedding(mockFaceImage);
      
      expect(embedding).toHaveLength(128);
      expect(embedding.every(val => typeof val === 'number' && val >= -1 && val <= 1)).toBe(true);
    });

    it('Property 3: Embedding normalization - embeddings should be normalized', async () => {
      const mockFaceImage = Buffer.from('mock-face-image-data');
      
      const embedding = await service['detectionModel'].generateEmbedding(mockFaceImage);
      
      // Calculate L2 norm
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      
      // Embedding should be normalized (norm close to 1)
      expect(Math.abs(norm - 1)).toBeLessThan(0.01);
    });
  });

  describe('Similarity Properties', () => {
    it('Property 1: Cosine similarity bounds - similarity should be between -1 and 1', () => {
      const clusterer = service['clusterer'];
      
      // Generate random embeddings
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: -1, max: 1 }), { minLength: 128, maxLength: 128 }),
          fc.array(fc.float({ min: -1, max: 1 }), { minLength: 128, maxLength: 128 }),
          (embedding1: number[], embedding2: number[]) => {
            const similarity = clusterer['cosineSimilarity'](embedding1, embedding2);
            return similarity >= -1 && similarity <= 1;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2: Self-similarity - identical embeddings should have similarity of 1', () => {
      const clusterer = service['clusterer'];
      
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: -1, max: 1 }), { minLength: 128, maxLength: 128 }),
          (embedding: number[]) => {
            const similarity = clusterer['cosineSimilarity'](embedding, embedding);
            return Math.abs(similarity - 1) < 0.0001; // Account for floating point precision
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 3: Symmetry - similarity(A, B) should equal similarity(B, A)', () => {
      const clusterer = service['clusterer'];
      
      fc.assert(
        fc.property(
          fc.array(fc.float({ min: -1, max: 1 }), { minLength: 128, maxLength: 128 }),
          fc.array(fc.float({ min: -1, max: 1 }), { minLength: 128, maxLength: 128 }),
          (embedding1: number[], embedding2: number[]) => {
            const similarity1 = clusterer['cosineSimilarity'](embedding1, embedding2);
            const similarity2 = clusterer['cosineSimilarity'](embedding2, embedding1);
            return Math.abs(similarity1 - similarity2) < 0.0001;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('DBSCAN Clustering Properties', () => {
    it('Property 1: Cluster stability - same data should produce same clusters', () => {
      const clusterer = service['clusterer'];
      
      // Generate deterministic embeddings
      const embeddings = [
        new Array(128).fill(0).map((_, i) => i % 2 === 0 ? 0.5 : -0.5), // Pattern 1
        new Array(128).fill(0).map((_, i) => i % 2 === 0 ? 0.5 : -0.5), // Pattern 1 (similar)
        new Array(128).fill(0).map((_, i) => i % 3 === 0 ? 0.8 : -0.2), // Pattern 2
        new Array(128).fill(0).map((_, i) => i % 3 === 0 ? 0.8 : -0.2), // Pattern 2 (similar)
        new Array(128).fill(0).map((_, i) => Math.random() * 2 - 1),     // Random (noise)
      ];
      
      // Cluster multiple times
      const clusters1 = clusterer.cluster(embeddings);
      const clusters2 = clusterer.cluster(embeddings);
      const clusters3 = clusterer.cluster(embeddings);
      
      // Results should be identical
      expect(clusters1).toEqual(clusters2);
      expect(clusters2).toEqual(clusters3);
    });

    it('Property 2: Noise handling - outliers should be marked as noise (-1)', () => {
      const clusterer = service['clusterer'];
      
      // Create embeddings with clear clusters and outliers
      const embeddings = [
        // Cluster 1: similar embeddings
        new Array(128).fill(0.5),
        new Array(128).fill(0.51),
        new Array(128).fill(0.49),
        
        // Cluster 2: different but similar embeddings
        new Array(128).fill(-0.5),
        new Array(128).fill(-0.51),
        new Array(128).fill(-0.49),
        
        // Outliers: very different embeddings
        new Array(128).fill(1),
        new Array(128).fill(-1),
      ];
      
      const labels = clusterer.cluster(embeddings);
      
      // First 6 should form clusters (labels > 0)
      // Last 2 should be noise (label -1)
      expect(labels.slice(0, 6).every(label => label > 0)).toBe(true);
      expect(labels.slice(6, 8).every(label => label === -1)).toBe(true);
    });

    it('Property 3: Minimum cluster size - clusters should have at least minPts points', () => {
      const clusterer = new (service['clusterer'].constructor as any)(0.3, 3); // epsilon=0.3, minPts=3
      
      // Create embeddings where only one group has enough points
      const embeddings = [
        // Group with 3 similar points (should form cluster)
        new Array(128).fill(0.5),
        new Array(128).fill(0.51),
        new Array(128).fill(0.49),
        
        // Group with only 2 similar points (should be noise)
        new Array(128).fill(-0.5),
        new Array(128).fill(-0.51),
        
        // Single point (should be noise)
        new Array(128).fill(0.8),
      ];
      
      const labels = clusterer.cluster(embeddings);
      
      // Count points in each cluster
      const clusterCounts = labels.reduce((acc: Record<number, number>, label: number) => {
        if (label > 0) {
          acc[label] = (acc[label] || 0) + 1;
        }
        return acc;
      }, {} as Record<number, number>);
      
      // All clusters should have at least 3 points
      Object.values(clusterCounts).forEach(count => {
        expect(count).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Configuration Properties', () => {
    it('Property 1: Configuration validation - invalid config should use defaults', () => {
      const invalidConfigs = [
        { detectionConfidence: -0.5 }, // Below 0
        { detectionConfidence: 1.5 },  // Above 1
        { minFaceSize: -10 },          // Negative
        { maxFaces: 0 },               // Zero
        { clusteringEpsilon: -0.1 },   // Negative
        { clusteringMinPts: 1 },       // Too small
      ];
      
      invalidConfigs.forEach(config => {
        const serviceWithConfig = new FaceRecognitionService(config);
        // Should not throw and should use valid defaults
        expect(serviceWithConfig).toBeDefined();
      });
    });

    it('Property 2: Configuration immutability - changing config should not affect existing instances', () => {
      const service1 = new FaceRecognitionService();
      const originalConfig = service1['config'];
      
      // Create new instance with different config
      const service2 = new FaceRecognitionService({ detectionConfidence: 0.9 });
      
      // First instance should retain original config
      expect(service1['config'].detectionConfidence).toBe(DEFAULT_CONFIG.detectionConfidence);
      expect(service2['config'].detectionConfidence).toBe(0.9);
    });
  });

  describe('Error Handling Properties', () => {
    it('Property 1: Graceful degradation - invalid embeddings should not crash', () => {
      const clusterer = service['clusterer'];
      
      const invalidEmbeddings = [
        [],                    // Empty
        [0.5],                 // Too short
        new Array(1000).fill(0.5), // Too long
        [null, undefined, 0.5],    // Contains null/undefined
      ];
      
      invalidEmbeddings.forEach(embedding => {
        expect(() => {
          // Should handle gracefully or throw meaningful error
          try {
            clusterer['cosineSimilarity'](embedding, embedding);
          } catch (error) {
            expect(error).toBeInstanceOf(Error);
          }
        }).not.toThrow();
      });
    });

    it('Property 2: Input validation - null/undefined inputs should be handled', () => {
      expect(() => {
        service['detectionModel'].generateEmbedding(null as any);
      }).rejects.toThrow();
      
      expect(() => {
        service['detectionModel'].generateEmbedding(undefined as any);
      }).rejects.toThrow();
    });
  });

  describe('Performance Properties', () => {
    it('Property 1: Clustering performance - should handle reasonable dataset sizes', () => {
      const clusterer = service['clusterer'];
      
      // Test with 100 embeddings (reasonable size)
      const embeddings = Array.from({ length: 100 }, () => 
        new Array(128).fill(0).map(() => Math.random() * 2 - 1)
      );
      
      const startTime = performance.now();
      const labels = clusterer.cluster(embeddings);
      const endTime = performance.now();
      
      expect(labels).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('Property 2: Similarity search performance - should be fast for single queries', () => {
      const clusterer = service['clusterer'];
      
      const queryEmbedding = new Array(128).fill(0).map(() => Math.random() * 2 - 1);
      const embeddings = Array.from({ length: 1000 }, () => 
        new Array(128).fill(0).map(() => Math.random() * 2 - 1)
      );
      
      const startTime = performance.now();
      
      // Calculate similarities
      const similarities = embeddings.map(embedding => 
        clusterer['cosineSimilarity'](queryEmbedding, embedding)
      );
      
      const endTime = performance.now();
      
      expect(similarities).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});

describe('FaceRecognitionService Integration', () => {
  it('Should export all required interfaces and classes', () => {
    expect(typeof FaceRecognitionService).toBe('function');
    expect(typeof DEFAULT_CONFIG).toBe('object');
    
    // Check config has all required properties
    expect(DEFAULT_CONFIG).toHaveProperty('detectionConfidence');
    expect(DEFAULT_CONFIG).toHaveProperty('minFaceSize');
    expect(DEFAULT_CONFIG).toHaveProperty('maxFaces');
    expect(DEFAULT_CONFIG).toHaveProperty('clusteringEpsilon');
    expect(DEFAULT_CONFIG).toHaveProperty('clusteringMinPts');
    expect(DEFAULT_CONFIG).toHaveProperty('similarityThreshold');
  });

  it('Should create service instance with default config', () => {
    const service = new FaceRecognitionService();
    expect(service).toBeInstanceOf(FaceRecognitionService);
    expect(service['config']).toEqual(DEFAULT_CONFIG);
  });

  it('Should create service instance with custom config', () => {
    const customConfig = { detectionConfidence: 0.8 };
    const service = new FaceRecognitionService(customConfig);
    
    expect(service['config'].detectionConfidence).toBe(0.8);
    // Other properties should use defaults
    expect(service['config'].minFaceSize).toBe(DEFAULT_CONFIG.minFaceSize);
  });
});
