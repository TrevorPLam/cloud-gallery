// AI-META-BEGIN
// AI-META: Integration test for complete face detection, embedding, and clustering workflow
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by vitest test runner
// DEPENDENCIES: face-detection.ts, face-embeddings.ts, face-clustering.ts
// DANGER: Integration test for biometric data pipeline - ensure privacy compliance
// CHANGE-SAFETY: Maintain test coverage for end-to-end face processing
// TESTS: This file
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  FaceDetectionService,
  getFaceDetectionService,
  resetFaceDetectionServiceForTesting,
} from "./face-detection";
import {
  FaceEmbeddingService,
  getFaceEmbeddingService,
  resetFaceEmbeddingServiceForTesting,
} from "./face-embeddings";
import {
  FaceClusteringService,
  getFaceClusteringService,
  resetFaceClusteringServiceForTesting,
} from "./face-clustering";
import { getModelManager, resetModelManagerForTesting } from "./model-manager";

// Mock React Native
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    Version: "15.0",
  },
  InteractionManager: {
    runAfterInteractions: vi.fn((callback) => {
      // For testing, run the callback immediately
      callback();
    }),
  },
  AsyncStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    multiRemove: vi.fn(),
  },
}));

// Mock the model manager
vi.mock("./model-manager", () => ({
  getModelManager: vi.fn(),
  resetModelManagerForTesting: vi.fn(),
}));

describe("Face Recognition Integration", () => {
  let faceDetectionService: FaceDetectionService;
  let faceEmbeddingService: FaceEmbeddingService;
  let faceClusteringService: FaceClusteringService;
  let mockModelManager: any;

  beforeEach(async () => {
    // Reset all singletons
    resetFaceDetectionServiceForTesting();
    resetFaceEmbeddingServiceForTesting();
    resetFaceClusteringServiceForTesting();
    resetModelManagerForTesting();

    // Create mock model manager
    mockModelManager = {
      loadModel: vi.fn().mockResolvedValue({
        name: "blazeface",
        delegate: "core-ml",
        loadTime: 100,
        memoryUsage: 1024,
      }),
      runInference: vi.fn(),
      isModelLoaded: vi.fn().mockReturnValue(true),
      getLoadedModels: vi.fn().mockReturnValue(["blazeface", "facenet"]),
    };

    vi.mocked(getModelManager).mockReturnValue(mockModelManager);

    // Initialize services
    faceDetectionService = getFaceDetectionService({
      minConfidence: 0.5,
      maxFaces: 10,
      minFaceSize: 0.1,
      enableTemporalSmoothing: false,
      gpuDelegate: "none",
    });

    faceEmbeddingService = getFaceEmbeddingService({
      minQuality: 0.7,
      minAlignmentConfidence: 0.8,
      normalizeEmbeddings: true,
      faceImageSize: 160,
      gpuDelegate: "none",
    });

    faceClusteringService = getFaceClusteringService({
      epsilon: 0.3,
      minPts: 2,
      minClusterQuality: 0.7,
      maxSampleEmbeddings: 5,
      persistClusters: false, // Disable persistence for testing
    });

    // Wait for initialization
    await Promise.all([
      faceDetectionService.initialize(),
      faceEmbeddingService.initialize(),
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Complete Face Processing Workflow", () => {
    it("should process faces from image to person clusters", async () => {
      // Mock BlazeFace output for face detection
      const mockFaceDetectionOutputs = [
        // Bounding boxes: [[x, y, w, h], ...]
        [
          [0.1, 0.1, 0.3, 0.3],
          [0.6, 0.2, 0.25, 0.35],
          [0.3, 0.5, 0.2, 0.25],
        ],
        // Confidence scores: [0.9, 0.8, 0.7]
        [0.9, 0.8, 0.7],
        // Landmarks: [[[x1, y1], [x2, y2], ...], ...]
        [
          [
            [0.15, 0.15],
            [0.25, 0.15], // left_eye, right_eye
            [0.12, 0.3],
            [0.28, 0.3], // left_ear, right_ear
            [0.2, 0.35],
            [0.2, 0.25], // mouth, nose
          ],
          [
            [0.65, 0.25],
            [0.75, 0.25],
            [0.62, 0.4],
            [0.78, 0.4],
            [0.7, 0.45],
            [0.7, 0.35],
          ],
          [
            [0.35, 0.55],
            [0.45, 0.55],
            [0.32, 0.7],
            [0.48, 0.7],
            [0.4, 0.75],
            [0.4, 0.65],
          ],
        ],
      ];

      // Mock FaceNet output for embeddings
      const mockFaceEmbeddingOutputs = [
        // 128-dimensional embeddings for 3 faces
        Array(128)
          .fill(0)
          .map((_, i) => (i % 2 === 0 ? 0.5 : -0.5) + Math.random() * 0.1),
        Array(128)
          .fill(0)
          .map((_, i) => (i % 2 === 0 ? 0.6 : -0.4) + Math.random() * 0.1),
        Array(128)
          .fill(0)
          .map((_, i) => (i % 2 === 0 ? 0.4 : -0.6) + Math.random() * 0.1),
      ];

      // Setup mock responses
      mockModelManager.runInference
        .mockResolvedValueOnce(mockFaceDetectionOutputs) // Face detection
        .mockResolvedValueOnce(mockFaceEmbeddingOutputs); // Face embeddings

      // Create test image data
      const imageData = new Uint8Array(128 * 128 * 3);
      const imageWidth = 128;
      const imageHeight = 128;

      // Step 1: Detect faces
      const faceDetections = await faceDetectionService.detectFaces(
        imageData,
        imageWidth,
        imageHeight,
      );
      expect(faceDetections).toHaveLength(3);
      expect(faceDetections[0].confidence).toBe(0.9);
      expect(faceDetections[1].confidence).toBe(0.8);
      expect(faceDetections[2].confidence).toBe(0.7);

      // Step 2: Generate embeddings
      const embeddings = await faceEmbeddingService.generateEmbeddings(
        imageData,
        imageWidth,
        imageHeight,
        faceDetections,
      );
      expect(embeddings).toHaveLength(3);
      expect(embeddings[0].vector).toHaveLength(128);
      expect(embeddings[0].quality).toBeGreaterThan(0);
      expect(embeddings[0].alignmentConfidence).toBeGreaterThan(0);

      // Step 3: Cluster faces
      const clusterResult =
        await faceClusteringService.clusterFaces(embeddings);
      expect(clusterResult.people).toBeDefined();
      expect(clusterResult.unclusteredCount).toBeGreaterThanOrEqual(0);
      expect(clusterResult.metadata.totalFaces).toBe(3);
      expect(clusterResult.metadata.clusteringTime).toBeGreaterThan(0);

      // Verify clustering results
      if (clusterResult.people.length > 0) {
        const person = clusterResult.people[0];
        expect(person.id).toBeDefined();
        expect(person.faceCount).toBeGreaterThan(0);
        expect(person.clusterQuality).toBeGreaterThanOrEqual(0);
        expect(person.sampleEmbeddings).toBeDefined();
        expect(person.createdAt).toBeDefined();
        expect(person.updatedAt).toBeDefined();
      }

      // Verify statistics
      const detectionStats = faceDetectionService.getStats();
      expect(detectionStats.totalDetections).toBe(3);
      expect(detectionStats.averageConfidence).toBeCloseTo(0.8); // (0.9 + 0.8 + 0.7) / 3

      const embeddingStats = faceEmbeddingService.getStats();
      expect(embeddingStats.totalEmbeddings).toBe(3);
      expect(embeddingStats.averageQuality).toBeGreaterThan(0);

      const clusteringStats = faceClusteringService.getStats();
      expect(clusteringStats.totalFaces).toBe(3);
      expect(clusteringStats.clusteringTime).toBeGreaterThan(0);
    });

    it("should handle low-quality faces appropriately", async () => {
      // Mock low-confidence face detection
      const mockFaceDetectionOutputs = [
        [
          [0.1, 0.1, 0.3, 0.3],
          [0.6, 0.2, 0.25, 0.35],
        ],
        [0.3, 0.4], // Both below confidence threshold
        [
          [
            [0.15, 0.15],
            [0.25, 0.15],
            [0.12, 0.3],
            [0.28, 0.3],
            [0.2, 0.35],
            [0.2, 0.25],
          ],
          [
            [0.65, 0.25],
            [0.75, 0.25],
            [0.62, 0.4],
            [0.78, 0.4],
            [0.7, 0.45],
            [0.7, 0.35],
          ],
        ],
      ];

      mockModelManager.runInference.mockResolvedValue(mockFaceDetectionOutputs);

      const imageData = new Uint8Array(128 * 128 * 3);
      const faceDetections = await faceDetectionService.detectFaces(
        imageData,
        128,
        128,
      );

      // Should filter out low-confidence faces
      expect(faceDetections).toHaveLength(0);

      // Embedding generation should return empty array
      const embeddings = await faceEmbeddingService.generateEmbeddings(
        imageData,
        128,
        128,
        faceDetections,
      );
      expect(embeddings).toHaveLength(0);

      // Clustering should handle empty input gracefully
      const clusterResult =
        await faceClusteringService.clusterFaces(embeddings);
      expect(clusterResult.people).toHaveLength(0);
      expect(clusterResult.unclusteredCount).toBe(0);
    });

    it("should handle embedding quality filtering", async () => {
      // Mock face detection
      const mockFaceDetectionOutputs = [
        [
          [0.1, 0.1, 0.3, 0.3],
          [0.6, 0.2, 0.25, 0.35],
        ],
        [0.9, 0.8],
        [
          [
            [0.15, 0.15],
            [0.25, 0.15],
            [0.12, 0.3],
            [0.28, 0.3],
            [0.2, 0.35],
            [0.2, 0.25],
          ],
          [
            [0.65, 0.25],
            [0.75, 0.25],
            [0.62, 0.4],
            [0.78, 0.4],
            [0.7, 0.45],
            [0.7, 0.35],
          ],
        ],
      ];

      // Mock embeddings with different quality scores
      const mockFaceEmbeddingOutputs = [
        Array(128)
          .fill(0)
          .map((_, i) => 0.1), // Low quality
        Array(128)
          .fill(0)
          .map((_, i) => 0.8), // High quality
      ];

      mockModelManager.runInference
        .mockResolvedValueOnce(mockFaceDetectionOutputs)
        .mockResolvedValueOnce(mockFaceEmbeddingOutputs);

      const imageData = new Uint8Array(128 * 128 * 3);
      const faceDetections = await faceDetectionService.detectFaces(
        imageData,
        128,
        128,
      );
      expect(faceDetections).toHaveLength(2);

      // Mock embedding quality calculation
      const originalCalculateQuality =
        faceEmbeddingService["_calculateEmbeddingQuality"];
      faceEmbeddingService["_calculateEmbeddingQuality"] = vi
        .fn()
        .mockReturnValueOnce(0.5) // Below threshold
        .mockReturnValueOnce(0.9); // Above threshold

      const embeddings = await faceEmbeddingService.generateEmbeddings(
        imageData,
        128,
        128,
        faceDetections,
      );

      // Should filter out low-quality embeddings
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0].quality).toBe(0.9);

      // Restore original method
      faceEmbeddingService["_calculateEmbeddingQuality"] =
        originalCalculateQuality;
    });
  });

  describe("Person Management Integration", () => {
    it("should manage person lifecycle correctly", async () => {
      // Create test embeddings
      const embeddings = [
        {
          vector: Array(128)
            .fill(0)
            .map((_, i) => 0.5 + Math.random() * 0.1),
          quality: 0.9,
          alignmentConfidence: 0.8,
          timestamp: Date.now(),
          sourceDetection: {
            boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
            confidence: 0.9,
            landmarks: [],
            timestamp: Date.now(),
          },
        },
        {
          vector: Array(128)
            .fill(0)
            .map((_, i) => 0.6 + Math.random() * 0.1),
          quality: 0.85,
          alignmentConfidence: 0.8,
          timestamp: Date.now(),
          sourceDetection: {
            boundingBox: { x: 0.6, y: 0.2, width: 0.25, height: 0.35 },
            confidence: 0.8,
            landmarks: [],
            timestamp: Date.now(),
          },
        },
      ];

      // Cluster faces
      const clusterResult =
        await faceClusteringService.clusterFaces(embeddings);
      expect(clusterResult.people.length).toBeGreaterThan(0);

      const person = clusterResult.people[0];
      expect(person.name).toBeNull();
      expect(person.isPinned).toBe(false);
      expect(person.isHidden).toBe(false);

      // Update person name
      const updatedPerson = await faceClusteringService.updatePerson(
        person.id,
        {
          name: "John Doe",
        },
      );
      expect(updatedPerson).toBeTruthy();
      expect(updatedPerson?.name).toBe("John Doe");
      expect(updatedPerson?.updatedAt).toBeGreaterThan(person.updatedAt);

      // Pin person
      const pinnedPerson = await faceClusteringService.updatePerson(person.id, {
        isPinned: true,
      });
      expect(pinnedPerson?.isPinned).toBe(true);

      // Hide person
      const hiddenPerson = await faceClusteringService.updatePerson(person.id, {
        isHidden: true,
      });
      expect(hiddenPerson?.isHidden).toBe(true);

      // Load clusters and verify persistence
      const loadedClusters = await faceClusteringService.loadClusters();
      const loadedPerson = loadedClusters.find((p) => p.id === person.id);
      expect(loadedPerson).toBeTruthy();
      expect(loadedPerson?.name).toBe("John Doe");
      expect(loadedPerson?.isPinned).toBe(true);
      expect(loadedPerson?.isHidden).toBe(true);
    });

    it("should handle person merging correctly", async () => {
      // Create test embeddings for two different people
      const embeddings = [
        {
          vector: Array(128)
            .fill(0)
            .map((_, i) => 0.5 + Math.random() * 0.1),
          quality: 0.9,
          alignmentConfidence: 0.8,
          timestamp: Date.now(),
          sourceDetection: {
            boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
            confidence: 0.9,
            landmarks: [],
            timestamp: Date.now(),
          },
        },
        {
          vector: Array(128)
            .fill(0)
            .map((_, i) => 0.8 + Math.random() * 0.1),
          quality: 0.85,
          alignmentConfidence: 0.8,
          timestamp: Date.now(),
          sourceDetection: {
            boundingBox: { x: 0.6, y: 0.2, width: 0.25, height: 0.35 },
            confidence: 0.8,
            landmarks: [],
            timestamp: Date.now(),
          },
        },
      ];

      // Cluster to create two separate people
      const clusterResult1 = await faceClusteringService.clusterFaces([
        embeddings[0],
      ]);
      const clusterResult2 = await faceClusteringService.clusterFaces([
        embeddings[1],
      ]);

      expect(clusterResult1.people).toHaveLength(1);
      expect(clusterResult2.people).toHaveLength(1);

      const person1 = clusterResult1.people[0];
      const person2 = clusterResult2.people[0];

      // Merge person2 into person1
      const mergedPerson = await faceClusteringService.mergePeople(
        person2.id,
        person1.id,
      );
      expect(mergedPerson).toBeTruthy();
      expect(mergedPerson?.faceCount).toBe(2); // Combined face count

      // Verify person2 was deleted
      const clusters = await faceClusteringService.loadClusters();
      expect(clusters.find((p) => p.id === person2.id)).toBeFalsy();
      expect(clusters.find((p) => p.id === person1.id)).toBeTruthy();
    });

    it("should find similar faces correctly", async () => {
      // Create test embeddings
      const embeddings = [
        {
          vector: Array(128)
            .fill(0)
            .map((_, i) => 0.5 + Math.random() * 0.1),
          quality: 0.9,
          alignmentConfidence: 0.8,
          timestamp: Date.now(),
          sourceDetection: {
            boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
            confidence: 0.9,
            landmarks: [],
            timestamp: Date.now(),
          },
        },
      ];

      // Cluster faces
      const clusterResult =
        await faceClusteringService.clusterFaces(embeddings);
      const person = clusterResult.people[0];

      // Create similar query embedding
      const queryEmbedding = person.sampleEmbeddings[0].map(
        (val: number) => val + 0.01,
      );

      // Find similar faces
      const similarPeople = await faceClusteringService.findSimilarFaces(
        queryEmbedding,
        0.7,
      );
      expect(similarPeople).toHaveLength(1);
      expect(similarPeople[0].id).toBe(person.id);

      // Test with dissimilar embedding
      const dissimilarEmbedding = Array(128)
        .fill(0)
        .map((_, i) => Math.random());
      const dissimilarPeople = await faceClusteringService.findSimilarFaces(
        dissimilarEmbedding,
        0.7,
      );
      expect(dissimilarPeople).toHaveLength(0);
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle model loading failures gracefully", async () => {
      // Mock model loading failure
      mockModelManager.loadModel.mockRejectedValue(
        new Error("Model loading failed"),
      );

      const service = new FaceDetectionService();
      await expect(service.initialize()).rejects.toThrow(
        "Model loading failed",
      );

      // Should fallback to CPU and retry
      expect(mockModelManager.loadModel).toHaveBeenCalledTimes(2);
    });

    it("should handle inference failures gracefully", async () => {
      // Mock inference failure
      mockModelManager.runInference.mockRejectedValue(
        new Error("Inference failed"),
      );

      const imageData = new Uint8Array(128 * 128 * 3);

      await expect(
        faceDetectionService.detectFaces(imageData, 128, 128),
      ).rejects.toThrow("Inference failed");
    });

    it("should handle empty image data", async () => {
      const emptyImageData = new Uint8Array(0);

      const detections = await faceDetectionService.detectFaces(
        emptyImageData,
        0,
        0,
      );
      expect(detections).toHaveLength(0);
    });

    it("should handle malformed model outputs", async () => {
      // Mock malformed outputs
      mockModelManager.runInference.mockResolvedValue([null, undefined, []]);

      const imageData = new Uint8Array(128 * 128 * 3);

      const detections = await faceDetectionService.detectFaces(
        imageData,
        128,
        128,
      );
      expect(detections).toHaveLength(0);
    });
  });

  describe("Performance and Memory Management", () => {
    it("should handle large numbers of faces efficiently", async () => {
      // Mock many faces
      const numFaces = 50;
      const mockFaceDetectionOutputs = [
        Array(numFaces).fill([0.1, 0.1, 0.3, 0.3]),
        Array(numFaces).fill(0.9),
        Array(numFaces).fill(Array(6).fill([0.15, 0.15])),
      ];

      mockModelManager.runInference.mockResolvedValue(mockFaceDetectionOutputs);

      const imageData = new Uint8Array(128 * 128 * 3);
      const detections = await faceDetectionService.detectFaces(
        imageData,
        128,
        128,
      );

      // Should limit to maxFaces
      expect(detections.length).toBeLessThanOrEqual(10);
    });

    it("should cleanup resources properly", async () => {
      await faceDetectionService.cleanup();
      await faceEmbeddingService.cleanup();
      await faceClusteringService.cleanup();

      // Verify cleanup
      expect(faceDetectionService.getStats().totalDetections).toBe(0);
      expect(faceEmbeddingService.getStats().totalEmbeddings).toBe(0);
      expect(faceClusteringService.getStats().totalClusters).toBe(0);
    });
  });
});
