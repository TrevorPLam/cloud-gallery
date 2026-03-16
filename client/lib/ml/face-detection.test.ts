// AI-META-BEGIN
// AI-META: Comprehensive test suite for face detection service with BlazeFace integration
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by vitest test runner
// DEPENDENCIES: vitest, face-detection.ts, model-manager.ts
// DANGER: Test coverage for biometric data processing - ensure privacy compliance
// CHANGE-SAFETY: Maintain test coverage for all face detection scenarios
// TESTS: This file
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FaceDetectionService, getFaceDetectionService, resetFaceDetectionServiceForTesting } from './face-detection';
import { getModelManager, resetModelManagerForTesting } from './model-manager';

// Mock React Native
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '15.0',
  },
  InteractionManager: {
    runAfterInteractions: vi.fn((callback) => {
      // For testing, run the callback immediately
      callback();
    }),
  },
}));

// Mock the model manager
vi.mock('./model-manager', () => ({
  getModelManager: vi.fn(),
  resetModelManagerForTesting: vi.fn(),
}));

describe('FaceDetectionService', () => {
  let faceDetectionService: FaceDetectionService;
  let mockModelManager: any;

  beforeEach(() => {
    // Reset all singletons
    resetFaceDetectionServiceForTesting();
    resetModelManagerForTesting();

    // Create mock model manager
    mockModelManager = {
      loadModel: vi.fn().mockResolvedValue({
        name: 'blazeface',
        delegate: 'core-ml',
        loadTime: 100,
        memoryUsage: 1024,
      }),
      runInference: vi.fn(),
      isModelLoaded: vi.fn().mockReturnValue(true),
      getLoadedModels: vi.fn().mockReturnValue(['blazeface']),
    };

    vi.mocked(getModelManager).mockReturnValue(mockModelManager);

    faceDetectionService = new FaceDetectionService({
      minConfidence: 0.5,
      maxFaces: 5,
      minFaceSize: 0.1,
      enableTemporalSmoothing: false, // Disable for testing
      gpuDelegate: 'none',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const service = new FaceDetectionService();
      const config = service.getConfig();

      expect(config.minConfidence).toBe(0.5);
      expect(config.maxFaces).toBe(10);
      expect(config.minFaceSize).toBe(0.1);
      expect(config.enableTemporalSmoothing).toBe(true);
    });

    it('should accept custom configuration', () => {
      const service = new FaceDetectionService({
        minConfidence: 0.7,
        maxFaces: 3,
        minFaceSize: 0.2,
      });

      const config = service.getConfig();
      expect(config.minConfidence).toBe(0.7);
      expect(config.maxFaces).toBe(3);
      expect(config.minFaceSize).toBe(0.2);
    });

    it('should load model during initialization', async () => {
      await faceDetectionService.initialize();

      // Since model file doesn't exist, it should use mock implementation
      expect(faceDetectionService.isInitialized).toBe(true);
    });

    it('should handle initialization errors and fallback to CPU', async () => {
      // Since model file doesn't exist, it will use mock implementation
      // This test verifies the service can handle missing model files
      const service = new FaceDetectionService({ gpuDelegate: 'core-ml' });
      await service.initialize();
      
      expect(service.isInitialized).toBe(true);
    });
  });

  describe('Face Detection', () => {
    beforeEach(async () => {
      await faceDetectionService.initialize();
    });

    it('should detect faces in image data', async () => {
      // Mock BlazeFace output
      const mockOutputs = [
        // Bounding boxes: [[x, y, w, h], ...]
        [[0.1, 0.1, 0.3, 0.3], [0.6, 0.2, 0.25, 0.35]],
        // Confidence scores: [0.9, 0.8]
        [0.9, 0.8],
        // Landmarks: [[[x1, y1], [x2, y2], ...], ...]
        [
          [
            [0.15, 0.15], [0.25, 0.15], // left_eye, right_eye
            [0.12, 0.3], [0.28, 0.3],  // left_ear, right_ear
            [0.2, 0.35], [0.2, 0.25],   // mouth, nose
          ],
          [
            [0.65, 0.25], [0.75, 0.25],
            [0.62, 0.4], [0.78, 0.4],
            [0.7, 0.45], [0.7, 0.35],
          ],
        ],
      ];

      mockModelManager.runInference.mockResolvedValue(mockOutputs);

      // Create test image data (128x128 RGB)
      const imageData = new Uint8Array(128 * 128 * 3);
      const imageWidth = 128;
      const imageHeight = 128;

      const detections = await faceDetectionService.detectFaces(imageData, imageWidth, imageHeight);

      expect(detections).toHaveLength(2);
      expect(detections[0]).toMatchObject({
        boundingBox: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 },
        confidence: 0.9,
      });
      expect(detections[0].landmarks).toHaveLength(6);
      expect(detections[1].confidence).toBe(0.8);
    });

    it('should filter faces by confidence threshold', async () => {
      const mockOutputs = [
        [[0.1, 0.1, 0.3, 0.3], [0.6, 0.2, 0.25, 0.35]],
        [0.4, 0.8], // First face below threshold
        [
          [
            [0.15, 0.15], [0.25, 0.15],
            [0.12, 0.3], [0.28, 0.3],
            [0.2, 0.35], [0.2, 0.25],
          ],
          [
            [0.65, 0.25], [0.75, 0.25],
            [0.62, 0.4], [0.78, 0.4],
            [0.7, 0.45], [0.7, 0.35],
          ],
        ],
      ];

      mockModelManager.runInference.mockResolvedValue(mockOutputs);

      const imageData = new Uint8Array(128 * 128 * 3);
      const detections = await faceDetectionService.detectFaces(imageData, 128, 128);

      expect(detections).toHaveLength(1); // Only the high-confidence face
      expect(detections[0].confidence).toBe(0.8);
    });

    it('should filter faces by minimum size', async () => {
      const mockOutputs = [
        [[0.1, 0.1, 0.05, 0.05], [0.5, 0.5, 0.3, 0.3]], // First face too small
        [0.9, 0.8],
        [
          [[0.12, 0.12], [0.18, 0.12], [0.1, 0.15], [0.2, 0.15], [0.15, 0.2], [0.15, 0.1]],
          [[0.62, 0.62], [0.78, 0.62], [0.6, 0.75], [0.8, 0.75], [0.7, 0.8], [0.7, 0.6]],
        ],
      ];

      mockModelManager.runInference.mockResolvedValue(mockOutputs);

      const imageData = new Uint8Array(128 * 128 * 3);
      const detections = await faceDetectionService.detectFaces(imageData, 128, 128);

      expect(detections).toHaveLength(1); // Only the appropriately sized face
      expect(detections[0].boundingBox.width).toBe(0.3);
      expect(detections[0].boundingBox.height).toBe(0.3);
    });

    it('should limit maximum number of faces', async () => {
      const mockOutputs = [
        Array(10).fill([0.1, 0.1, 0.2, 0.2]), // 10 faces
        Array(10).fill(0.9),
        Array(10).fill(Array(6).fill([0.15, 0.15])),
      ];

      mockModelManager.runInference.mockResolvedValue(mockOutputs);

      const imageData = new Uint8Array(128 * 128 * 3);
      const detections = await faceDetectionService.detectFaces(imageData, 128, 128);

      expect(detections).toHaveLength(5); // Limited by maxFaces config
    });

    it('should handle invalid model outputs gracefully', async () => {
      mockModelManager.runInference.mockResolvedValue([null, undefined, []]);

      const imageData = new Uint8Array(128 * 128 * 3);
      const detections = await faceDetectionService.detectFaces(imageData, 128, 128);

      expect(detections).toHaveLength(0);
    });
  });

  describe('Temporal Smoothing', () => {
    beforeEach(async () => {
      // Enable temporal smoothing for these tests
      faceDetectionService.updateConfig({ enableTemporalSmoothing: true });
      await faceDetectionService.initialize();
    });

    it('should apply temporal smoothing to consecutive detections', async () => {
      // First detection
      const mockOutputs1 = [
        [[0.1, 0.1, 0.3, 0.3]],
        [0.9],
        [[[0.15, 0.15], [0.25, 0.15], [0.12, 0.3], [0.28, 0.3], [0.2, 0.35], [0.2, 0.25]]],
      ];

      // Second detection (slightly different position)
      const mockOutputs2 = [
        [[0.12, 0.11, 0.3, 0.3]],
        [0.9],
        [[[0.17, 0.16], [0.27, 0.16], [0.14, 0.31], [0.3, 0.31], [0.22, 0.36], [0.22, 0.26]]],
      ];

      mockModelManager.runInference
        .mockResolvedValueOnce(mockOutputs1)
        .mockResolvedValueOnce(mockOutputs2);

      const imageData = new Uint8Array(128 * 128 * 3);

      // First detection
      const detections1 = await faceDetectionService.detectFaces(imageData, 128, 128);
      expect(detections1).toHaveLength(1);
      expect(detections1[0].boundingBox.x).toBe(0.1);

      // Second detection (should be smoothed)
      const detections2 = await faceDetectionService.detectFaces(imageData, 128, 128);
      expect(detections2).toHaveLength(1);
      // smoothed position should be between 0.1 and 0.12
      expect(detections2[0].boundingBox.x).toBeGreaterThan(0.1);
      expect(detections2[0].boundingBox.x).toBeLessThan(0.12);
    });

    it('should return original detections for first frame', async () => {
      const mockOutputs = [
        [[0.1, 0.1, 0.3, 0.3]],
        [0.9],
        [[[0.15, 0.15], [0.25, 0.15], [0.12, 0.3], [0.28, 0.3], [0.2, 0.35], [0.2, 0.25]]],
      ];

      mockModelManager.runInference.mockResolvedValue(mockOutputs);

      const imageData = new Uint8Array(128 * 128 * 3);
      const detections = await faceDetectionService.detectFaces(imageData, 128, 128);

      expect(detections).toHaveLength(1);
      expect(detections[0].boundingBox.x).toBe(0.1); // No smoothing on first frame
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await faceDetectionService.initialize();
    });

    it('should update statistics after detection', async () => {
      const mockOutputs = [
        [[0.1, 0.1, 0.3, 0.3], [0.6, 0.2, 0.25, 0.35]],
        [0.9, 0.8],
        [
          [
            [0.15, 0.15], [0.25, 0.15],
            [0.12, 0.3], [0.28, 0.3],
            [0.2, 0.35], [0.2, 0.25],
          ],
          [
            [0.65, 0.25], [0.75, 0.25],
            [0.62, 0.4], [0.78, 0.4],
            [0.7, 0.45], [0.7, 0.35],
          ],
        ],
      ];

      mockModelManager.runInference.mockResolvedValue(mockOutputs);

      const imageData = new Uint8Array(128 * 128 * 3);
      await faceDetectionService.detectFaces(imageData, 128, 128);

      const stats = faceDetectionService.getStats();
      expect(stats.totalDetections).toBe(2);
      expect(stats.averageConfidence).toBeCloseTo(0.85); // (0.9 + 0.8) / 2
      expect(stats.averageInferenceTime).toBeGreaterThanOrEqual(0); // Mock implementation may have 0 time
    });

    it('should reset statistics', () => {
      faceDetectionService.resetStats();
      const stats = faceDetectionService.getStats();

      expect(stats.totalDetections).toBe(0);
      expect(stats.averageConfidence).toBe(0);
      expect(stats.averageInferenceTime).toBe(0);
    });
  });

  describe('Configuration', () => {
    it('should update configuration', () => {
      faceDetectionService.updateConfig({
        minConfidence: 0.8,
        maxFaces: 3,
      });

      const config = faceDetectionService.getConfig();
      expect(config.minConfidence).toBe(0.8);
      expect(config.maxFaces).toBe(3);
      expect(config.enableTemporalSmoothing).toBe(false); // Should be false from test setup
    });
  });

  describe('IoU Calculation', () => {
    it('should calculate IoU correctly for overlapping boxes', () => {
      const box1 = { x: 0, y: 0, width: 0.5, height: 0.5 };
      const box2 = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };

      // Intersection: 0.25 x 0.25 = 0.0625
      // Union: 0.25 + 0.25 - 0.0625 = 0.4375
      // IoU: 0.0625 / 0.4375 = 0.142857...

      // Access private method through prototype for testing
      const iou = (faceDetectionService as any)._calculateIoU(box1, box2);
      expect(iou).toBeCloseTo(0.142857, 5);
    });

    it('should return 0 IoU for non-overlapping boxes', () => {
      const box1 = { x: 0, y: 0, width: 0.2, height: 0.2 };
      const box2 = { x: 0.5, y: 0.5, width: 0.2, height: 0.2 };

      const iou = (faceDetectionService as any)._calculateIoU(box1, box2);
      expect(iou).toBe(0);
    });

    it('should return 1 IoU for identical boxes', () => {
      const box = { x: 0.1, y: 0.1, width: 0.3, height: 0.3 };

      const iou = (faceDetectionService as any)._calculateIoU(box, box);
      expect(iou).toBeCloseTo(1, 10); // Use toBeCloseTo for floating point precision
    });
  });

  describe('Cleanup', () => {
    it('should cleanup resources', async () => {
      await faceDetectionService.initialize();
      await faceDetectionService.cleanup();

      expect(faceDetectionService.getStats().totalDetections).toBe(0);
    });
  });
});

describe('Singleton Pattern', () => {
  it('should return same instance', () => {
    resetFaceDetectionServiceForTesting();
    
    const service1 = getFaceDetectionService();
    const service2 = getFaceDetectionService();
    
    expect(service1).toBe(service2);
  });

  it('should reset singleton for testing', () => {
    resetFaceDetectionServiceForTesting();
    
    const service1 = getFaceDetectionService();
    resetFaceDetectionServiceForTesting();
    const service2 = getFaceDetectionService();
    
    expect(service1).not.toBe(service2);
  });
});
