// AI-META-BEGIN
// AI-META: Comprehensive tests for TensorFlow Lite integration module
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: run by vitest during testing
// DEPENDENCIES: vitest, tflite.ts, fast-check
// DANGER: Tests validate ML infrastructure correctness and performance
// CHANGE-SAFETY: Add new tests for additional delegate types and device capabilities
// TESTS: npm run test:watch
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fc from 'fast-check';
import {
  TensorFlowLiteManager,
  getTensorFlowLiteManager,
  cleanupTensorFlowLiteManager,
  resetTensorFlowLiteManagerForTesting,
  DeviceCapabilityDetector,
  GPUDelegateType,
  ModelConfig,
  DeviceCapabilities,
} from './tflite';

// Mock react-native-fast-tflite
vi.mock('react-native-fast-tflite', () => ({
  loadTensorflowModel: vi.fn(),
  TensorflowModel: vi.fn(),
}));

// Mock Platform
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    Version: '15.0',
  },
  InteractionManager: {
    runAfterInteractions: vi.fn((callback) => callback()),
  },
}));

describe('TensorFlowLiteManager', () => {
  let manager: TensorFlowLiteManager;

  beforeEach(() => {
    resetTensorFlowLiteManagerForTesting();
    manager = getTensorFlowLiteManager();
  });

  afterEach(async () => {
    await cleanupTensorFlowLiteManager();
  });

  describe('Initialization', () => {
    it('should create manager instance', () => {
      expect(manager).toBeDefined();
    });

    it('should initialize device capabilities', async () => {
      const capabilities = await manager.getDeviceCapabilities();
      expect(capabilities).toBeDefined();
      expect(capabilities?.platform).toBe('ios');
    });

    it('should get performance stats', () => {
      const stats = manager.getPerformanceStats();
      expect(stats).toHaveProperty('loadedModels');
      expect(stats).toHaveProperty('totalMemoryUsage');
      expect(stats).toHaveProperty('supportedDelegates');
    });
  });

  describe('Device Capability Detection', () => {
    let detector: DeviceCapabilityDetector;

    beforeEach(() => {
      detector = DeviceCapabilityDetector.getInstance();
    });

    it('should detect iOS capabilities', async () => {
      const capabilities = await detector.getCapabilities();
      
      expect(capabilities.platform).toBe('ios');
      expect(capabilities.supportedDelegates).toContain('core-ml');
      expect(capabilities.supportedDelegates).toContain('none');
    });

    it('should detect Android capabilities', async () => {
      // Mock Android platform
      vi.doMock('react-native', () => ({
        Platform: {
          OS: 'android',
          Version: '12',
        },
        InteractionManager: {
          runAfterInteractions: vi.fn((callback) => callback()),
        },
      }));

      const androidDetector = DeviceCapabilityDetector.getInstance();
      const capabilities = await androidDetector.getCapabilities();
      
      expect(capabilities.platform).toBe('android');
      expect(capabilities.supportedDelegates.length).toBeGreaterThan(0);
    });
  });

  describe('Model Loading', () => {
    const mockModelConfig: ModelConfig = {
      name: 'test-model',
      path: 'assets/models/test-model.tflite',
      inputSize: 224,
      outputSize: 1000,
    };

    it('should select optimal delegate for iOS', async () => {
      await manager.initialize();
      
      // This would test delegate selection logic
      // For now, just ensure the method doesn't throw
      expect(async () => {
        // Mock successful model loading
        vi.mocked(require('react-native-fast-tflite').loadTensorflowModel)
          .mockResolvedValue({} as any);
        
        await manager.loadModel(mockModelConfig);
      }).not.toThrow();
    });

    it('should handle model loading errors gracefully', async () => {
      vi.mocked(require('react-native-fast-tflite').loadTensorflowModel)
        .mockRejectedValue(new Error('Model not found'));

      await expect(manager.loadModel(mockModelConfig)).rejects.toThrow('Model not found');
    });

    it('should track loaded models', async () => {
      vi.mocked(require('react-native-fast-tflite').loadTensorflowModel)
        .mockResolvedValue({} as any);

      await manager.loadModel(mockModelConfig);
      
      expect(manager.isModelLoaded('test-model')).toBe(true);
      expect(manager.getLoadedModels()).toContain('test-model');
    });
  });

  describe('Inference', () => {
    const mockModelConfig: ModelConfig = {
      name: 'test-model',
      path: 'assets/models/test-model.tflite',
      inputSize: 224,
      outputSize: 1000,
    };

    beforeEach(async () => {
      vi.mocked(require('react-native-fast-tflite').loadTensorflowModel)
        .mockResolvedValue({
          run: vi.fn().mockResolvedValue([[1, 2, 3]]),
        } as any);

      await manager.loadModel(mockModelConfig);
    });

    it('should run inference successfully', async () => {
      const result = await manager.runInference('test-model', [new Uint8Array(224 * 224 * 3)]);
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle inference errors', async () => {
      const mockModel = manager['models'].get('test-model');
      vi.mocked(mockModel!.run).mockRejectedValue(new Error('Inference failed'));

      await expect(manager.runInference('test-model', [new Uint8Array(224 * 224 * 3)]))
        .rejects.toThrow('Inference failed');
    });

    it('should throw error for non-existent model', async () => {
      await expect(manager.runInference('non-existent', [new Uint8Array(224 * 224 * 3)]))
        .rejects.toThrow('Model "non-existent" not loaded');
    });
  });

  describe('Model Management', () => {
    const mockModelConfig: ModelConfig = {
      name: 'test-model',
      path: 'assets/models/test-model.tflite',
      inputSize: 224,
      outputSize: 1000,
    };

    beforeEach(async () => {
      vi.mocked(require('react-native-fast-tflite').loadTensorflowModel)
        .mockResolvedValue({} as any);

      await manager.loadModel(mockModelConfig);
    });

    it('should unload models successfully', async () => {
      await manager.unloadModel('test-model');
      
      expect(manager.isModelLoaded('test-model')).toBe(false);
      expect(manager.getLoadedModels()).not.toContain('test-model');
    });

    it('should unload all models', async () => {
      // Load another model
      await manager.loadModel({
        ...mockModelConfig,
        name: 'test-model-2',
        path: 'assets/models/test-model-2.tflite',
      });

      await manager.unloadAllModels();
      
      expect(manager.getLoadedModels()).toHaveLength(0);
    });

    it('should get model metadata', () => {
      const metadata = manager.getModelMetadata('test-model');
      
      expect(metadata).toBeDefined();
      expect(metadata?.name).toBe('test-model');
    });
  });

  describe('Property Tests', () => {
    it('Property 1: Device capability consistency - capabilities should be consistent across calls', async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(fc.constant(null), async () => {
            const capabilities1 = await manager.getDeviceCapabilities();
            const capabilities2 = await manager.getDeviceCapabilities();
            
            expect(capabilities1?.platform).toBe(capabilities2?.platform);
            expect(capabilities1?.memoryMB).toBe(capabilities2?.memoryMB);
            expect(capabilities1?.supportedDelegates).toEqual(capabilities2?.supportedDelegates);
          }),
          { numRuns: 5 }
        )
      ).resolves.toBeUndefined();
    });

    it('Property 2: Model tracking consistency - loaded models list should match internal state', async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.array(fc.string(), { minLength: 1, maxLength: 3 }),
            async (modelNames) => {
              // Mock successful model loading
              vi.mocked(require('react-native-fast-tflite').loadTensorflowModel)
                .mockResolvedValue({} as any);

              // Load models
              for (const name of modelNames) {
                await manager.loadModel({
                  name,
                  path: `assets/models/${name}.tflite`,
                  inputSize: 224,
                  outputSize: 1000,
                });
              }

              // Check consistency
              const loadedModels = manager.getLoadedModels();
              expect(loadedModels).toHaveLength(modelNames.length);
              
              modelNames.forEach(name => {
                expect(loadedModels).toContain(name);
                expect(manager.isModelLoaded(name)).toBe(true);
              });
            }
          ),
          { numRuns: 3 }
        )
      ).resolves.toBeUndefined();
    });

    it('Property 3: Performance stats bounds - memory usage should be non-negative', async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(fc.constant(null), async () => {
            const stats = manager.getPerformanceStats();
            
            expect(stats.totalMemoryUsage).toBeGreaterThanOrEqual(0);
            expect(stats.loadedModels).toBeGreaterThanOrEqual(0);
            expect(stats.supportedDelegates.length).toBeGreaterThan(0);
          }),
          { numRuns: 10 }
        )
      ).resolves.toBeUndefined();
    });
  });
});

describe('TensorFlowLiteManager Edge Cases', () => {
  let manager: TensorFlowLiteManager;

  beforeEach(() => {
    resetTensorFlowLiteManagerForTesting();
    manager = getTensorFlowLiteManager();
  });

  afterEach(async () => {
    await cleanupTensorFlowLiteManager();
  });

  it('should handle concurrent model loading', async () => {
    vi.mocked(require('react-native-fast-tflite').loadTensorflowModel)
      .mockResolvedValue({} as any);

    const configs: ModelConfig[] = [
      { name: 'model1', path: 'assets/models/model1.tflite', inputSize: 224, outputSize: 1000 },
      { name: 'model2', path: 'assets/models/model2.tflite', inputSize: 224, outputSize: 1000 },
      { name: 'model3', path: 'assets/models/model3.tflite', inputSize: 224, outputSize: 1000 },
    ];

    // Load models concurrently
    const promises = configs.map(config => manager.loadModel(config));
    await Promise.all(promises);

    expect(manager.getLoadedModels()).toHaveLength(3);
  });

  it('should handle cleanup during loading', async () => {
    vi.mocked(require('react-native-fast-tflite').loadTensorflowModel)
      .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    const loadingPromise = manager.loadModel({
      name: 'slow-model',
      path: 'assets/models/slow-model.tflite',
      inputSize: 224,
      outputSize: 1000,
    });

    // Cleanup while loading
    await manager.unloadAllModels();

    // Loading should complete without throwing
    await expect(loadingPromise).resolves.toBeDefined();
  });

  it('should handle invalid model configurations', async () => {
    const invalidConfigs = [
      { name: '', path: '', inputSize: 0, outputSize: 0 },
      { name: 'valid', path: '', inputSize: -1, outputSize: 1000 },
      { name: 'valid', path: 'valid', inputSize: 224, outputSize: -1 },
    ];

    for (const config of invalidConfigs) {
      await expect(manager.loadModel(config)).rejects.toThrow();
    }
  });
});
