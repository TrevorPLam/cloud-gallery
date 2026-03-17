// AI-META-BEGIN
// AI-META: Mock factories for ML modules to resolve TypeScript errors in tests
// OWNERSHIP: client/lib/ml/__mocks__
// ENTRYPOINTS: Imported by vitest setup and test files
// DEPENDENCIES: vitest, typescript
// DANGER: Mocks must match real module interfaces exactly
// CHANGE-SAFETY: Update mocks when real module interfaces change
// TESTS: Used throughout ML test suite
// AI-META-END

// Mock factories for ML modules
// Provides comprehensive mocking for TensorFlow Lite and related ML dependencies

import { vi } from 'vitest';

// Device capabilities interface
export interface DeviceCapabilities {
  hasGPU: boolean;
  hasNPU: boolean;
  hasDSP: boolean;
  maxMemory: number;
  supportedModelFormats: string[];
  computeUnits: number;
}

// Model configuration interface
export interface ModelConfig {
  name: string;
  version: string;
  size: number;
  format: string;
  optimizeForMobile: boolean;
  useQuantization: boolean;
}

// Model metadata interface
export interface ModelMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  size: number;
  format: string;
  hash: string;
  isOptimized: boolean;
}

// GPU delegate configuration
export interface GPUDelegateConfig {
  enableGPU: boolean;
  allowPrecisionLoss: boolean;
  maxDelegateDevices: number;
  minDeviceMemory: number;
}

/**
 * Create mock TensorFlow Lite manager with error simulation
 */
export const createMockTFLiteManager = (options: { 
  shouldFailLoading?: boolean; 
  shouldFailInference?: boolean;
  shouldFailDeviceCapabilities?: boolean;
} = {}) => ({
  // Device capability detection
  getDeviceCapabilities: vi.fn().mockImplementation(() => {
    if (options.shouldFailDeviceCapabilities) {
      return Promise.reject(new Error("Device capabilities detection failed"));
    }
    return Promise.resolve({
      hasGPU: true,
      hasNPU: false,
      hasDSP: true,
      maxMemory: 1024 * 1024 * 1024, // 1GB
      supportedModelFormats: ['tflite', 'onnx'],
      computeUnits: 8,
    } as DeviceCapabilities);
  }),

  // Model loading and management
  loadModel: vi.fn().mockImplementation((config) => {
    if (options.shouldFailLoading) {
      return Promise.reject(new Error("Model loading failed"));
    }
    return Promise.resolve(true);
  }),
  unloadModel: vi.fn().mockResolvedValue(true),
  isModelLoaded: vi.fn().mockReturnValue(true),
  getModelInfo: vi.fn().mockReturnValue({
    name: 'test-model',
    version: '1.0.0',
    size: 1024 * 1024,
    format: 'tflite',
  } as ModelConfig),

  // Model execution
  runModel: vi.fn().mockImplementation((modelName, inputs) => {
    if (options.shouldFailInference) {
      return Promise.reject(new Error("Inference failed"));
    }
    return Promise.resolve({
      outputs: [[0.1, 0.2, 0.3, 0.4]],
      executionTime: 50,
      memoryUsage: 1024 * 1024,
    });
  }),

  // GPU delegate management
  enableGPUDelegate: vi.fn().mockResolvedValue(true),
  disableGPUDelegate: vi.fn().mockResolvedValue(true),
  getGPUDelegateInfo: vi.fn().mockReturnValue({
    enabled: true,
    deviceName: 'Mock GPU',
    memoryInfo: {
      totalMemory: 1024 * 1024 * 1024,
      usedMemory: 512 * 1024 * 1024,
    },
  } as GPUDelegateConfig),

  // Performance monitoring
  getPerformanceMetrics: vi.fn().mockReturnValue({
    averageInferenceTime: 45.5,
    memoryUsage: 1024 * 1024,
    gpuUtilization: 0.75,
    thermalState: 'normal' as const,
  }),

  // Cleanup
  cleanup: vi.fn().mockResolvedValue(true),
  unloadAllModels: vi.fn().mockResolvedValue(true),
});

/**
 * Create mock model cache
 */
export const createMockModelCache = () => ({
  // Cache operations
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(true),
  delete: vi.fn().mockResolvedValue(true),
  clear: vi.fn().mockResolvedValue(true),
  has: vi.fn().mockResolvedValue(false),

  // Cache statistics
  getStats: vi.fn().mockReturnValue({
    size: 0,
    maxSize: 100 * 1024 * 1024, // 100MB
    hitCount: 0,
    missCount: 0,
    hitRate: 0,
  }),

  // Cache management
  loadCacheMetadata: vi.fn().mockResolvedValue(true),
  saveCacheMetadata: vi.fn().mockResolvedValue(true),
  optimize: vi.fn().mockResolvedValue(true),
});

/**
 * Create mock face detection service
 */
export const createMockFaceDetectionService = () => ({
  // Face detection
  detectFaces: vi.fn().mockResolvedValue({
    faces: [
      {
        id: 'face_1',
        boundingBox: { x: 100, y: 100, width: 50, height: 50 },
        confidence: 0.95,
        landmarks: [
          { x: 110, y: 110, type: 'left_eye' },
          { x: 140, y: 110, type: 'right_eye' },
          { x: 125, y: 130, type: 'nose' },
          { x: 125, y: 145, type: 'mouth' },
        ],
        embedding: new Array(128).fill(0).map((_, i) => Math.random()),
      },
    ],
    processingTime: 150,
    imageDimensions: { width: 300, height: 300 },
  }),

  // Face recognition
  generateEmbedding: vi.fn().mockResolvedValue(
    new Array(128).fill(0).map((_, i) => Math.random())
  ),
  compareFaces: vi.fn().mockResolvedValue({
    similarity: 0.85,
    isMatch: true,
    confidence: 0.9,
  }),

  // Model management
  loadModel: vi.fn().mockResolvedValue(true),
  isModelReady: vi.fn().mockReturnValue(true),
  getModelInfo: vi.fn().mockReturnValue({
    name: 'face-detection-model',
    version: '2.0.0',
    inputSize: [224, 224],
    outputSize: 128,
  }),
});

/**
 * Create mock CLIP embeddings service
 */
export const createMockCLIPService = () => ({
  // Text embeddings
  embedText: vi.fn().mockResolvedValue(
    new Array(512).fill(0).map((_, i) => Math.random())
  ),
  embedTextBatch: vi.fn().mockResolvedValue(
    Array(5).fill(null).map(() => 
      new Array(512).fill(0).map((_, i) => Math.random())
    )
  ),

  // Image embeddings
  embedImage: vi.fn().mockResolvedValue(
    new Array(512).fill(0).map((_, i) => Math.random())
  ),
  embedImageBatch: vi.fn().mockResolvedValue(
    Array(5).fill(null).map(() => 
      new Array(512).fill(0).map((_, i) => Math.random())
    )
  ),

  // Similarity calculation
  calculateSimilarity: vi.fn().mockReturnValue(0.75),
  findBestMatches: vi.fn().mockResolvedValue([
    { text: 'test', similarity: 0.85 },
    { text: 'example', similarity: 0.72 },
  ]),

  // Model management
  loadModel: vi.fn().mockResolvedValue(true),
  isModelReady: vi.fn().mockReturnValue(true),
  getModelInfo: vi.fn().mockReturnValue({
    name: 'clip-vit-base-patch32',
    version: '1.0.0',
    embeddingSize: 512,
    maxLength: 77,
  }),
});

/**
 * Create mock adaptive models service
 */
export const createMockAdaptiveModelsService = () => ({
  // Model adaptation
  adaptModel: vi.fn().mockResolvedValue({
    adaptedModelId: 'adapted_model_1',
    improvement: 0.15,
    adaptationTime: 5000,
  }),

  // Model evaluation
  evaluateModel: vi.fn().mockResolvedValue({
    accuracy: 0.92,
    precision: 0.89,
    recall: 0.94,
    f1Score: 0.91,
    confusionMatrix: [[100, 5], [3, 92]],
  }),

  // Model optimization
  optimizeModel: vi.fn().mockResolvedValue({
    optimizedModelId: 'optimized_model_1',
    sizeReduction: 0.3,
    speedImprovement: 0.25,
    accuracyLoss: 0.02,
  }),

  // Performance monitoring
  getPerformanceMetrics: vi.fn().mockReturnValue({
    inferenceTime: 45.2,
    memoryUsage: 512 * 1024,
    accuracy: 0.92,
    throughput: 20.5,
  }),

  // Model management
  loadModel: vi.fn().mockResolvedValue(true),
  saveModel: vi.fn().mockResolvedValue(true),
  deleteModel: vi.fn().mockResolvedValue(true),
  listModels: vi.fn().mockResolvedValue([
    { id: 'model_1', name: 'Base Model', type: 'base' },
    { id: 'model_2', name: 'Adapted Model', type: 'adapted' },
  ]),
});

/**
 * Mock TensorFlow Lite namespace
 */
export const mockTFLite = {
  createMockTFLiteManager,
  createMockModelCache,
  createMockFaceDetectionService,
  createMockCLIPService,
  createMockAdaptiveModelsService,
};

// Export default mock for easy importing
export default mockTFLite;
