// AI-META-BEGIN
// AI-META: Comprehensive tests for camera ML integration with real-time processing
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: run by vitest during testing
// DEPENDENCIES: vitest, camera-ml.ts, fast-check
// DANGER: Tests validate real-time frame processing and performance constraints
// CHANGE-SAFETY: Add new tests for additional frame processors and camera configurations
// TESTS: npm run test:watch
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  FrameProcessorManager,
  FramePreprocessor,
  ResultPostprocessor,
  useMLFrameProcessor,
  getCameraMLCapabilities,
  supportsRealTimeML,
  getOptimalCameraConfig,
  cleanupFrameProcessorManager,
  resetFrameProcessorManagerForTesting,
  FrameProcessorConfig,
  FrameProcessorResult,
  Detection,
} from './camera-ml';

// Mock react-native-vision-camera
vi.mock('react-native-vision-camera', () => ({
  Camera: vi.fn(),
  Frame: vi.fn(),
  useFrameProcessor: vi.fn(),
}));

// Mock react-native-worklets
vi.mock('react-native-worklets', () => ({
  runOnJS: vi.fn((fn) => fn),
}));

// Mock model-manager
vi.mock('./model-manager', () => ({
  getModelManager: vi.fn(),
}));

// Mock react-native
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '15.0',
  },
}));

describe('FramePreprocessor', () => {
  describe('preprocessFrame', () => {
    it('should return Uint8Array with correct size', () => {
      const mockFrame = {
        width: 1920,
        height: 1080,
        timestamp: Date.now(),
        data: new Uint8Array(1920 * 1080 * 3),
      };

      const result = FramePreprocessor.preprocessFrame(mockFrame, 224);

      expect(result).toBeInstanceOf(Uint8Array);
      expect(result.length).toBe(224 * 224 * 3);
    });

    it('should handle different input sizes', () => {
      const sizes = [128, 192, 224, 256, 512];
      const mockFrame = {
        width: 1920,
        height: 1080,
        timestamp: Date.now(),
        data: new Uint8Array(1920 * 1080 * 3),
      };

      sizes.forEach(size => {
        const result = FramePreprocessor.preprocessFrame(mockFrame, size);
        expect(result.length).toBe(size * size * 3);
      });
    });

    it('should convert to float32 when requested', () => {
      const mockFrame = {
        width: 1920,
        height: 1080,
        timestamp: Date.now(),
        data: new Uint8Array(1920 * 1080 * 3),
      };

      const result = FramePreprocessor.preprocessFrameFloat(mockFrame, 224);

      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(224 * 224 * 3);
      
      // Check that values are normalized to [0, 1]
      for (let i = 0; i < Math.min(10, result.length); i++) {
        expect(result[i]).toBeGreaterThanOrEqual(0);
        expect(result[i]).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('bounding box normalization', () => {
    it('should normalize bounding boxes correctly', () => {
      const bbox = { x: 100, y: 50, width: 200, height: 150 };
      const frameWidth = 1000;
      const frameHeight = 500;

      const normalized = FramePreprocessor.normalizeBoundingBox(bbox, frameWidth, frameHeight);

      expect(normalized.x).toBe(0.1); // 100/1000
      expect(normalized.y).toBe(0.1); // 50/500
      expect(normalized.width).toBe(0.2); // 200/1000
      expect(normalized.height).toBe(0.3); // 150/500
    });

    it('should denormalize bounding boxes correctly', () => {
      const normalizedBbox = { x: 0.1, y: 0.1, width: 0.2, height: 0.3 };
      const frameWidth = 1000;
      const frameHeight = 500;

      const denormalized = FramePreprocessor.denormalizeBoundingBox(normalizedBbox, frameWidth, frameHeight);

      expect(denormalized.x).toBe(100); // 0.1 * 1000
      expect(denormalized.y).toBe(50); // 0.1 * 500
      expect(denormalized.width).toBe(200); // 0.2 * 1000
      expect(denormalized.height).toBe(150); // 0.3 * 500
    });
  });
});

describe('ResultPostprocessor', () => {
  describe('processDetections', () => {
    it('should process detection outputs correctly', () => {
      const outputs = [
        // Bounding boxes: [y_min, x_min, y_max, x_max] for 2 detections
        new Float32Array([0.1, 0.2, 0.5, 0.8, 0.3, 0.1, 0.7, 0.9]),
        // Scores: [0.9, 0.3]
        new Float32Array([0.9, 0.3]),
        // Classes: [1, 2]
        new Float32Array([1, 2]),
      ];

      const detections = ResultPostprocessor.processDetections(
        outputs,
        1920, // frame width
        1080, // frame height
        0.7,  // threshold
        10     // max detections
      );

      expect(detections).toHaveLength(2);
      
      // First detection (above threshold)
      expect(detections[0].label).toBe('object_1');
      expect(detections[0].confidence).toBe(0.9);
      expect(detections[0].boundingBox.x).toBe(384); // 0.2 * 1920
      expect(detections[0].boundingBox.y).toBe(108); // 0.1 * 1080
      expect(detections[0].boundingBox.width).toBe(1152); // (0.8 - 0.2) * 1920
      expect(detections[0].boundingBox.height).toBe(432); // (0.5 - 0.1) * 1080

      // Second detection (below threshold)
      expect(detections[1]).toBeUndefined();
    });

    it('should respect max detections limit', () => {
      const outputs = [
        // 15 detections
        new Float32Array(Array(15 * 4).fill(0.1)),
        new Float32Array(Array(15).fill(0.9)),
        new Float32Array(Array(15).fill(1)),
      ];

      const detections = ResultPostprocessor.processDetections(
        outputs,
        1920,
        1080,
        0.5,
        5 // max 5 detections
      );

      expect(detections).toHaveLength(5);
    });

    it('should handle empty outputs', () => {
      const detections = ResultPostprocessor.processDetections([], 1920, 1080);
      expect(detections).toHaveLength(0);
    });
  });

  describe('processClassifications', () => {
    it('should process classification outputs correctly', () => {
      const outputs = [
        new Float32Array([0.1, 0.8, 0.05, 0.05]), // probabilities for 4 classes
      ];

      const classifications = ResultPostprocessor.processClassifications(outputs, 0.6);

      expect(classifications).toHaveLength(1);
      expect(classifications[0].label).toBe('class_1'); // index 1
      expect(classifications[0].confidence).toBe(0.8);
    });

    it('should return multiple classifications above threshold', () => {
      const outputs = [
        new Float32Array([0.7, 0.8, 0.3, 0.9]), // probabilities for 4 classes
      ];

      const classifications = ResultPostprocessor.processClassifications(outputs, 0.5);

      expect(classifications).toHaveLength(3);
      expect(classifications.map(c => c.label)).toEqual(['class_0', 'class_1', 'class_3']);
    });

    it('should sort classifications by confidence', () => {
      const outputs = [
        new Float32Array([0.6, 0.9, 0.7, 0.8]), // probabilities for 4 classes
      ];

      const classifications = ResultPostprocessor.processClassifications(outputs, 0.5);

      expect(classifications).toHaveLength(4);
      expect(classifications[0].confidence).toBe(0.9); // Highest first
      expect(classifications[1].confidence).toBe(0.8);
      expect(classifications[2].confidence).toBe(0.7);
      expect(classifications[3].confidence).toBe(0.6);
    });
  });

  describe('processEmbeddings', () => {
    it('should process embedding outputs correctly', () => {
      const outputs = [
        new Float32Array(128).fill(0.5), // 128-dimensional embedding
      ];

      const embeddings = ResultPostprocessor.processEmbeddings(outputs);

      expect(embeddings).toHaveLength(128);
      expect(embeddings[0]).toBe(0.5);
    });

    it('should return dummy embedding for empty outputs', () => {
      const embeddings = ResultPostprocessor.processEmbeddings([]);

      expect(embeddings).toHaveLength(128);
      embeddings.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('temporal smoothing', () => {
    it('should smooth detections between frames', () => {
      const currentDetections: Detection[] = [
        {
          label: 'person',
          confidence: 0.9,
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          timestamp: Date.now(),
        },
      ];

      const previousDetections: Detection[] = [
        {
          label: 'person',
          confidence: 0.8,
          boundingBox: { x: 90, y: 90, width: 60, height: 110 },
          timestamp: Date.now() - 100,
        },
      ];

      const smoothed = ResultPostprocessor.smoothDetections(currentDetections, previousDetections, 0.7);

      expect(smoothed).toHaveLength(1);
      
      // Bounding box should be smoothed between current and previous
      const smoothedBox = smoothed[0].boundingBox;
      expect(smoothedBox.x).toBeCloseTo(97, 0); // 0.7 * 100 + 0.3 * 90
      expect(smoothedBox.y).toBeCloseTo(97, 0); // 0.7 * 100 + 0.3 * 90
      expect(smoothedBox.width).toBeCloseTo(53, 0); // 0.7 * 50 + 0.3 * 60
      expect(smoothedBox.height).toBeCloseTo(103, 0); // 0.7 * 100 + 0.3 * 110
    });

    it('should handle unmatched detections', () => {
      const currentDetections: Detection[] = [
        {
          label: 'person',
          confidence: 0.9,
          boundingBox: { x: 100, y: 100, width: 50, height: 100 },
          timestamp: Date.now(),
        },
      ];

      const previousDetections: Detection[] = []; // No previous detections

      const smoothed = ResultPostprocessor.smoothDetections(currentDetections, previousDetections);

      expect(smoothed).toHaveLength(1);
      expect(smoothed[0].boundingBox).toEqual(currentDetections[0].boundingBox);
    });
  });

  describe('IoU calculation', () => {
    it('should calculate IoU correctly for overlapping boxes', () => {
      // Box 1: (0, 0, 100, 100)
      // Box 2: (50, 50, 150, 150)
      // Intersection: (50, 50, 100, 100) = 50 * 50 = 2500
      // Union: 10000 + 10000 - 2500 = 17500
      // IoU: 2500 / 17500 = 0.1428...

      const box1 = { x: 0, y: 0, width: 100, height: 100 };
      const box2 = { x: 50, y: 50, width: 100, height: 100 };

      const iou = ResultPostprocessor['calculateIoU'](box1, box2);

      expect(iou).toBeCloseTo(0.1428, 3);
    });

    it('should return 0 for non-overlapping boxes', () => {
      const box1 = { x: 0, y: 0, width: 50, height: 50 };
      const box2 = { x: 100, y: 100, width: 50, height: 50 };

      const iou = ResultPostprocessor['calculateIoU'](box1, box2);

      expect(iou).toBe(0);
    });

    it('should return 1 for identical boxes', () => {
      const box = { x: 50, y: 50, width: 100, height: 100 };

      const iou = ResultPostprocessor['calculateIoU'](box, box);

      expect(iou).toBe(1);
    });
  });
});

describe('FrameProcessorManager', () => {
  let manager: FrameProcessorManager;

  beforeEach(() => {
    resetFrameProcessorManagerForTesting();
    manager = FrameProcessorManager.getInstance();
  });

  afterEach(() => {
    cleanupFrameProcessorManager();
  });

  describe('processor registration', () => {
    it('should register and unregister processors', () => {
      const config: FrameProcessorConfig = {
        modelName: 'test-model',
        modelConfig: {
          name: 'test-model',
          path: 'assets/models/test-model.tflite',
          inputSize: 224,
          outputSize: 1000,
        },
        inputSize: 224,
        outputFormat: 'detections',
      };

      manager.registerProcessor('test-processor', config);

      expect(manager.getRegisteredProcessors()).toContain('test-processor');

      manager.unregisterProcessor('test-processor');

      expect(manager.getRegisteredProcessors()).not.toContain('test-processor');
    });

    it('should track processor statistics', () => {
      const config: FrameProcessorConfig = {
        modelName: 'test-model',
        modelConfig: {
          name: 'test-model',
          path: 'assets/models/test-model.tflite',
          inputSize: 224,
          outputSize: 1000,
        },
        inputSize: 224,
        outputFormat: 'detections',
      };

      manager.registerProcessor('test-processor', config);

      const stats = manager.getProcessorStats('test-processor');
      expect(stats.frameCount).toBe(0);
      expect(stats.fps).toBe(0);
      expect(stats.config).toEqual(config);
    });
  });

  describe('frame processing', () => {
    const mockFrame = {
      width: 1920,
      height: 1080,
      timestamp: Date.now(),
      data: new Uint8Array(1920 * 1080 * 3),
    };

    const config: FrameProcessorConfig = {
      modelName: 'test-model',
      modelConfig: {
        name: 'test-model',
        path: 'assets/models/test-model.tflite',
        inputSize: 224,
        outputSize: 1000,
      },
      inputSize: 224,
      outputFormat: 'detections',
      threshold: 0.7,
      maxDetections: 10,
    };

    beforeEach(() => {
      manager.registerProcessor('test-processor', config);

      // Mock model manager
      const mockModelManager = {
        runInference: vi.fn().mockResolvedValue({
          outputs: [
            new Float32Array([0.1, 0.2, 0.5, 0.8]), // bbox
            new Float32Array([0.9]), // score
            new Float32Array([1]), // class
          ],
        }),
      };

      vi.mocked(require('./model-manager').getModelManager).mockReturnValue(mockModelManager);
    });

    it('should process frames successfully', async () => {
      const result = await manager.processFrame(mockFrame, 'test-processor');

      expect(result).toBeDefined();
      expect(result.detections).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.frameTimestamp).toBe(mockFrame.timestamp);
      expect(result.fps).toBeGreaterThanOrEqual(0);
    });

    it('should handle frame skipping', async () => {
      const configWithSkip: FrameProcessorConfig = {
        ...config,
        frameSkip: 2, // Process every 3rd frame
      };

      manager.unregisterProcessor('test-processor');
      manager.registerProcessor('test-processor', configWithSkip);

      const result = await manager.processFrame(mockFrame, 'test-processor');

      // First frame (index 0) should be skipped
      expect(result.detections).toHaveLength(0);
      expect(result.processingTime).toBe(0);
    });

    it('should handle processing errors', async () => {
      const mockModelManager = {
        runInference: vi.fn().mockRejectedValue(new Error('Inference failed')),
      };

      vi.mocked(require('./model-manager').getModelManager).mockReturnValue(mockModelManager);

      const errorCallback = vi.fn();
      await expect(
        manager.processFrame(mockFrame, 'test-processor', { onError: errorCallback })
      ).rejects.toThrow('Inference failed');

      expect(errorCallback).toHaveBeenCalled();
    });

    it('should call result callback', async () => {
      const resultCallback = vi.fn();
      
      await manager.processFrame(mockFrame, 'test-processor', { onResult: resultCallback });

      expect(resultCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          detections: expect.any(Array),
          processingTime: expect.any(Number),
        })
      );
    });

    it('should handle different output formats', async () => {
      // Test embeddings format
      const embeddingConfig: FrameProcessorConfig = {
        ...config,
        outputFormat: 'embeddings',
      };

      manager.unregisterProcessor('test-processor');
      manager.registerProcessor('test-processor', embeddingConfig);

      const mockModelManager = {
        runInference: vi.fn().mockResolvedValue({
          outputs: [new Float32Array(128).fill(0.5)],
        }),
      };

      vi.mocked(require('./model-manager').getModelManager).mockReturnValue(mockModelManager);

      const result = await manager.processFrame(mockFrame, 'test-processor');

      expect(result.detections).toHaveLength(0);
      expect(result.embeddings).toHaveLength(128);
      expect(result.classifications).toBeUndefined();
    });
  });
});

describe('Camera ML Capabilities', () => {
  describe('getCameraMLCapabilities', () => {
    it('should return capabilities for iOS', () => {
      vi.doMock('react-native', () => ({
        Platform: {
          OS: 'ios',
          Version: '15.0',
        },
      }));

      const capabilities = getCameraMLCapabilities();

      expect(capabilities.supportedFormats).toContain('yuv');
      expect(capabilities.supportedFormats).toContain('rgb');
      expect(capabilities.maxResolution.width).toBe(1920);
      expect(capabilities.maxResolution.height).toBe(1080);
      expect(capabilities.preferredFps).toBe(30);
      expect(capabilities.supportsFrameProcessors).toBe(true);
      expect(capabilities.supportsRealTimeML).toBe(true);
    });

    it('should return capabilities for Android', () => {
      vi.doMock('react-native', () => ({
        Platform: {
          OS: 'android',
          Version: '12',
        },
      }));

      const capabilities = getCameraMLCapabilities();

      expect(capabilities.supportedFormats).toContain('yuv');
      expect(capabilities.maxResolution.width).toBe(1280);
      expect(capabilities.maxResolution.height).toBe(720);
      expect(capabilities.preferredFps).toBe(30);
      expect(capabilities.supportsFrameProcessors).toBe(true);
      expect(capabilities.supportsRealTimeML).toBe(true);
    });
  });

  describe('supportsRealTimeML', () => {
    it('should return true for capable devices', () => {
      vi.doMock('react-native', () => ({
        Platform: {
          OS: 'ios',
          Version: '15.0',
        },
      }));

      expect(supportsRealTimeML()).toBe(true);
    });

    it('should return false for old Android devices', () => {
      vi.doMock('react-native', () => ({
        Platform: {
          OS: 'android',
          Version: '6.0', // Android 6.0 - too old
        },
      }));

      expect(supportsRealTimeML()).toBe(false);
    });
  });

  describe('getOptimalCameraConfig', () => {
    it('should return optimal configuration', () => {
      const config = getOptimalCameraConfig();

      expect(config.format).toBeDefined();
      expect(config.fps).toBeLessThanOrEqual(30);
      expect(config.resolution.width).toBeGreaterThan(0);
      expect(config.resolution.height).toBeGreaterThan(0);
    });
  });
});

describe('Property Tests', () => {
  describe('FramePreprocessor', () => {
    it('Property 1: Output size consistency - preprocessFrame should always return correct size', async () => {
      await expect(
        fc.assert(
          fc.property(
            fc.integer({ min: 64, max: 512 }), // input size
            fc.integer({ min: 640, max: 3840 }), // frame width
            fc.integer({ min: 480, max: 2160 }), // frame height
            (inputSize, frameWidth, frameHeight) => {
              const mockFrame = {
                width: frameWidth,
                height: frameHeight,
                timestamp: Date.now(),
                data: new Uint8Array(frameWidth * frameHeight * 3),
              };

              const result = FramePreprocessor.preprocessFrame(mockFrame, inputSize);
              
              expect(result).toBeInstanceOf(Uint8Array);
              expect(result.length).toBe(inputSize * inputSize * 3);
            }
          ),
          { numRuns: 20 }
        )
      ).resolves.toBeUndefined();
    });

    it('Property 2: Normalization bounds - normalized coordinates should be in [0,1]', async () => {
      await expect(
        fc.assert(
          fc.property(
            fc.integer({ min: 100, max: 2000 }), // bbox x
            fc.integer({ min: 100, max: 2000 }), // bbox y
            fc.integer({ min: 50, max: 500 }),   // bbox width
            fc.integer({ min: 50, max: 500 }),   // bbox height
            fc.integer({ min: 1000, max: 4000 }), // frame width
            fc.integer({ min: 750, max: 3000 }),  // frame height
            (x, y, width, height, frameWidth, frameHeight) => {
              const bbox = { x, y, width, height };
              const normalized = FramePreprocessor.normalizeBoundingBox(bbox, frameWidth, frameHeight);
              
              expect(normalized.x).toBeGreaterThanOrEqual(0);
              expect(normalized.x).toBeLessThanOrEqual(1);
              expect(normalized.y).toBeGreaterThanOrEqual(0);
              expect(normalized.y).toBeLessThanOrEqual(1);
              expect(normalized.width).toBeGreaterThanOrEqual(0);
              expect(normalized.width).toBeLessThanOrEqual(1);
              expect(normalized.height).toBeGreaterThanOrEqual(0);
              expect(normalized.height).toBeLessThanOrEqual(1);
            }
          ),
          { numRuns: 50 }
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('ResultPostprocessor', () => {
    it('Property 1: IoU bounds - IoU should always be in [0,1]', async () => {
      await expect(
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 1000 }), // x1
            fc.integer({ min: 0, max: 1000 }), // y1
            fc.integer({ min: 10, max: 200 }), // w1
            fc.integer({ min: 10, max: 200 }), // h1
            fc.integer({ min: 0, max: 1000 }), // x2
            fc.integer({ min: 0, max: 1000 }), // y2
            fc.integer({ min: 10, max: 200 }), // w2
            fc.integer({ min: 10, max: 200 }), // h2
            (x1, y1, w1, h1, x2, y2, w2, h2) => {
              const box1 = { x: x1, y: y1, width: w1, height: h1 };
              const box2 = { x: x2, y: y2, width: w2, height: h2 };
              
              const iou = ResultPostprocessor['calculateIoU'](box1, box2);
              
              expect(iou).toBeGreaterThanOrEqual(0);
              expect(iou).toBeLessThanOrEqual(1);
            }
          ),
          { numRuns: 100 }
        )
      ).resolves.toBeUndefined();
    });

    it('Property 2: Detection confidence bounds - processed detections should have valid confidence', async () => {
      await expect(
        fc.assert(
          fc.property(
            fc.array(fc.float32({ min: 0, max: 1 }), { minLength: 4, maxLength: 20 }), // bbox values
            fc.array(fc.float32({ min: 0, max: 1 }), { minLength: 1, maxLength: 5 }),  // scores
            fc.array(fc.float32({ min: 0, max: 10 }), { minLength: 1, maxLength: 5 }), // classes
            (bboxValues, scores, classes) => {
              const outputs = [
                new Float32Array(bboxValues),
                new Float32Array(scores),
                new Float32Array(classes),
              ];

              const detections = ResultPostprocessor.processDetections(outputs, 1920, 1080, 0.5, 10);
              
              detections.forEach(detection => {
                expect(detection.confidence).toBeGreaterThanOrEqual(0);
                expect(detection.confidence).toBeLessThanOrEqual(1);
              });
            }
          ),
          { numRuns: 20 }
        )
      ).resolves.toBeUndefined();
    });
  });
});
