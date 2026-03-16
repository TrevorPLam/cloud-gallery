// AI-META-BEGIN
// AI-META: TensorFlow Lite integration with GPU acceleration and device adaptation
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by model-manager and camera-ml modules
// DEPENDENCIES: react-native-fast-tflite, Platform, InteractionManager
// DANGER: Model loading and tensor operations require proper memory management
// CHANGE-SAFETY: Add new delegate types by extending GPUDelegateType enum
// TESTS: client/lib/ml/tflite.test.ts
// AI-META-END

import { Platform, InteractionManager } from 'react-native';
import { loadTensorflowModel, TensorflowModel } from 'react-native-fast-tflite';

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export type GPUDelegateType = 
  | 'core-ml'        // iOS CoreML (Apple Neural Engine)
  | 'android-gpu'    // Android GPU delegate
  | 'nnapi'          // Android NNAPI (deprecated in Android 15)
  | 'none';          // CPU only

export interface ModelConfig {
  name: string;
  path: string | number; // require() path for assets, or URL object
  inputSize: number;
  outputSize: number;
  quantized?: boolean;
  delegate?: GPUDelegateType;
}

export interface TensorInfo {
  name: string;
  shape: number[];
  dataType: 'uint8' | 'float32' | 'int32' | 'int64';
  size: number;
}

export interface ModelMetadata {
  name: string;
  version: string;
  description?: string;
  inputs: TensorInfo[];
  outputs: TensorInfo[];
  delegate: GPUDelegateType;
  loadTime: number;
  memoryUsage: number;
}

export interface InferenceResult {
  outputs: any[];
  inferenceTime: number;
  memoryUsage: number;
  delegate: GPUDelegateType;
}

// ─────────────────────────────────────────────────────────
// DEVICE CAPABILITIES
// ─────────────────────────────────────────────────────────

export interface DeviceCapabilities {
  platform: 'ios' | 'android';
  hasNeuralEngine: boolean;
  hasGPUAcceleration: boolean;
  memoryMB: number;
  cpuCores: number;
  supportedDelegates: GPUDelegateType[];
}

export class DeviceCapabilityDetector {
  private static instance: DeviceCapabilityDetector;
  private capabilities: DeviceCapabilities | null = null;

  static getInstance(): DeviceCapabilityDetector {
    if (!this.instance) {
      this.instance = new DeviceCapabilityDetector();
    }
    return this.instance;
  }

  async getCapabilities(): Promise<DeviceCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    const platform = Platform.OS as 'ios' | 'android';
    const supportedDelegates: GPUDelegateType[] = ['none'];

    // Platform-specific capability detection
    if (platform === 'ios') {
      supportedDelegates.push('core-ml');
      // iOS devices with A11 Bionic chip (2017+) have Neural Engine
      const hasNeuralEngine = await this.detectNeuralEngine();
      this.capabilities = {
        platform,
        hasNeuralEngine,
        hasGPUAcceleration: true, // All iOS devices support GPU acceleration
        memoryMB: await this.getMemorySize(),
        cpuCores: await this.getCpuCores(),
        supportedDelegates,
      };
    } else {
      // Android
      const hasGPUAcceleration = await this.detectAndroidGPU();
      if (hasGPUAcceleration) {
        supportedDelegates.push('android-gpu');
        // NNAPI is deprecated but still available on older devices
        supportedDelegates.push('nnapi');
      }
      
      this.capabilities = {
        platform,
        hasNeuralEngine: false,
        hasGPUAcceleration,
        memoryMB: await this.getMemorySize(),
        cpuCores: await this.getCpuCores(),
        supportedDelegates,
      };
    }

    return this.capabilities;
  }

  private async detectNeuralEngine(): Promise<boolean> {
    // Simplified detection - in production would use device-specific APIs
    // For now, assume all modern iOS devices have Neural Engine
    const version = typeof Platform.Version === 'string' 
      ? parseInt(Platform.Version, 10) 
      : Platform.Version;
    return version >= 11; // iOS 11+ (A11 Bionic and later)
  }

  private async detectAndroidGPU(): Promise<boolean> {
    // Simplified detection - in production would check for GPU libraries
    // For now, assume most modern Android devices have GPU acceleration
    const version = typeof Platform.Version === 'string' 
      ? parseInt(Platform.Version, 10) 
      : Platform.Version;
    return version >= 21; // Android 5.0+ (Lollipop and later)
  }

  private async getMemorySize(): Promise<number> {
    // Simplified memory detection - in production would use native APIs
    // Return reasonable defaults based on platform
    return Platform.OS === 'ios' ? 4096 : 6144; // 4GB iOS, 6GB Android average
  }

  private async getCpuCores(): Promise<number> {
    // Simplified CPU core detection - in production would use native APIs
    return Platform.OS === 'ios' ? 6 : 8; // 6-core iOS, 8-core Android average
  }
}

// ─────────────────────────────────────────────────────────
// TENSORFLOW LITE MANAGER
// ─────────────────────────────────────────────────────────

export class TensorFlowLiteManager {
  private models = new Map<string, TensorflowModel>();
  private metadata = new Map<string, ModelMetadata>();
  private deviceCapabilities: DeviceCapabilities | null = null;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.initialize();
  }

  // ─── INITIALIZATION ──────────────────────────────────────

  private async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeInternal();
    return this.initializationPromise;
  }

  private async _initializeInternal(): Promise<void> {
    try {
      const detector = DeviceCapabilityDetector.getInstance();
      this.deviceCapabilities = await detector.getCapabilities();
      
      console.log('TensorFlowLiteManager: Initialized with device capabilities:', {
        platform: this.deviceCapabilities.platform,
        supportedDelegates: this.deviceCapabilities.supportedDelegates,
        memoryMB: this.deviceCapabilities.memoryMB,
      });
    } catch (error) {
      console.error('TensorFlowLiteManager: Initialization failed:', error);
      throw error;
    }
  }

  // ─── MODEL LOADING ───────────────────────────────────────

  /**
   * Load a TensorFlow Lite model with optimal delegate selection
   */
  async loadModel(config: ModelConfig): Promise<ModelMetadata> {
    await this.initialize();

    const startTime = Date.now();
    const delegate = this.selectOptimalDelegate(config);
    
    try {
      // Load model in background to avoid blocking UI
      const model = await new Promise<TensorflowModel>((resolve, reject) => {
        InteractionManager.runAfterInteractions(async () => {
          try {
            const loadedModel = await loadTensorflowModel(config.path, delegate);
            resolve(loadedModel);
          } catch (error) {
            reject(error);
          }
        });
      });

      // Extract model metadata
      const metadata = this.extractModelMetadata(model, config, delegate, Date.now() - startTime);
      
      // Cache model and metadata
      this.models.set(config.name, model);
      this.metadata.set(config.name, metadata);

      console.log(`TensorFlowLiteManager: Model "${config.name}" loaded successfully`, {
        delegate,
        loadTime: metadata.loadTime,
        memoryUsage: metadata.memoryUsage,
      });

      return metadata;
    } catch (error) {
      console.error(`TensorFlowLiteManager: Failed to load model "${config.name}":`, error);
      
      // Fallback to CPU-only if GPU delegate failed
      if (delegate !== 'none') {
        console.log(`TensorFlowLiteManager: Retrying "${config.name}" with CPU-only delegate`);
        return this.loadModel({ ...config, delegate: 'none' });
      }
      
      throw error;
    }
  }

  /**
   * Select optimal delegate based on device capabilities and model requirements
   */
  private selectOptimalDelegate(config: ModelConfig): GPUDelegateType {
    if (!this.deviceCapabilities) {
      return 'none';
    }

    // Use specified delegate if provided and supported
    if (config.delegate && this.deviceCapabilities.supportedDelegates.includes(config.delegate)) {
      return config.delegate;
    }

    // Auto-select best delegate
    const { platform, supportedDelegates, hasNeuralEngine } = this.deviceCapabilities;

    // Prioritize delegates based on performance
    if (platform === 'ios' && supportedDelegates.includes('core-ml')) {
      return hasNeuralEngine ? 'core-ml' : 'none';
    }

    if (platform === 'android') {
      if (supportedDelegates.includes('android-gpu')) {
        return 'android-gpu';
      }
      if (supportedDelegates.includes('nnapi')) {
        return 'nnapi';
      }
    }

    return 'none';
  }

  /**
   * Extract metadata from loaded model
   */
  private extractModelMetadata(
    model: TensorflowModel,
    config: ModelConfig,
    delegate: GPUDelegateType,
    loadTime: number
  ): ModelMetadata {
    // Extract tensor information from model
    // Note: react-native-fast-tflite doesn't expose tensor metadata directly
    // This is a simplified implementation - in production would parse model file
    
    const inputs: TensorInfo[] = [
      {
        name: 'input',
        shape: [1, config.inputSize, config.inputSize, 3],
        dataType: config.quantized ? 'uint8' : 'float32',
        size: config.inputSize * config.inputSize * 3 * (config.quantized ? 1 : 4),
      },
    ];

    const outputs: TensorInfo[] = [
      {
        name: 'output',
        shape: [1, config.outputSize],
        dataType: 'float32',
        size: config.outputSize * 4,
      },
    ];

    return {
      name: config.name,
      version: '1.0.0',
      description: `TensorFlow Lite model with ${delegate} delegate`,
      inputs,
      outputs,
      delegate,
      loadTime,
      memoryUsage: this.estimateMemoryUsage(inputs, outputs),
    };
  }

  /**
   * Estimate memory usage for model
   */
  private estimateMemoryUsage(inputs: TensorInfo[], outputs: TensorInfo[]): number {
    const inputMemory = inputs.reduce((sum, tensor) => sum + tensor.size, 0);
    const outputMemory = outputs.reduce((sum, tensor) => sum + tensor.size, 0);
    return inputMemory + outputMemory;
  }

  // ─── INFERENCE ────────────────────────────────────────────

  /**
   * Run inference with loaded model
   */
  async runInference(modelName: string, inputs: any[]): Promise<InferenceResult> {
    await this.initialize();

    const model = this.models.get(modelName);
    const metadata = this.metadata.get(modelName);

    if (!model || !metadata) {
      throw new Error(`Model "${modelName}" not loaded`);
    }

    const startTime = Date.now();

    try {
      // Run inference in background to avoid blocking UI
      const outputs = await new Promise<any[]>((resolve, reject) => {
        InteractionManager.runAfterInteractions(async () => {
          try {
            const result = await model.run(inputs);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });

      const inferenceTime = Date.now() - startTime;

      return {
        outputs,
        inferenceTime,
        memoryUsage: metadata.memoryUsage,
        delegate: metadata.delegate,
      };
    } catch (error) {
      console.error(`TensorFlowLiteManager: Inference failed for model "${modelName}":`, error);
      throw error;
    }
  }

  /**
   * Run synchronous inference (for camera frame processors)
   */
  runInferenceSync(modelName: string, inputs: any[]): InferenceResult {
    const model = this.models.get(modelName);
    const metadata = this.metadata.get(modelName);

    if (!model || !metadata) {
      throw new Error(`Model "${modelName}" not loaded`);
    }

    const startTime = Date.now();

    try {
      // Synchronous inference for real-time processing
      const outputs = (model as any).runSync(inputs);
      const inferenceTime = Date.now() - startTime;

      return {
        outputs,
        inferenceTime,
        memoryUsage: metadata.memoryUsage,
        delegate: metadata.delegate,
      };
    } catch (error) {
      console.error(`TensorFlowLiteManager: Sync inference failed for model "${modelName}":`, error);
      throw error;
    }
  }

  // ─── MODEL MANAGEMENT ─────────────────────────────────────

  /**
   * Get loaded model metadata
   */
  getModelMetadata(modelName: string): ModelMetadata | undefined {
    return this.metadata.get(modelName);
  }

  /**
   * Get all loaded models
   */
  getLoadedModels(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(modelName: string): boolean {
    return this.models.has(modelName);
  }

  /**
   * Unload model and free memory
   */
  async unloadModel(modelName: string): Promise<void> {
    const model = this.models.get(modelName);
    if (model) {
      // Models are automatically cleaned up when garbage collected
      // Explicit cleanup not available in react-native-fast-tflite
      this.models.delete(modelName);
      this.metadata.delete(modelName);
      
      console.log(`TensorFlowLiteManager: Model "${modelName}" unloaded`);
    }
  }

  /**
   * Unload all models and free memory
   */
  async unloadAllModels(): Promise<void> {
    const modelNames = Array.from(this.models.keys());
    await Promise.all(modelNames.map(name => this.unloadModel(name)));
    
    console.log('TensorFlowLiteManager: All models unloaded');
  }

  // ─── DEVICE INFORMATION ───────────────────────────────────

  /**
   * Get device capabilities
   */
  async getDeviceCapabilities(): Promise<DeviceCapabilities | null> {
    await this.initialize();
    return this.deviceCapabilities;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    loadedModels: number;
    totalMemoryUsage: number;
    supportedDelegates: GPUDelegateType[];
  } {
    const loadedModels = this.models.size;
    const totalMemoryUsage = Array.from(this.metadata.values())
      .reduce((sum, meta) => sum + meta.memoryUsage, 0);
    const supportedDelegates = this.deviceCapabilities?.supportedDelegates || [];

    return {
      loadedModels,
      totalMemoryUsage,
      supportedDelegates,
    };
  }
}

// ─────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────

let tfliteManagerInstance: TensorFlowLiteManager | null = null;

/**
 * Get singleton instance of TensorFlowLiteManager
 */
export function getTensorFlowLiteManager(): TensorFlowLiteManager {
  if (!tfliteManagerInstance) {
    tfliteManagerInstance = new TensorFlowLiteManager();
  }
  return tfliteManagerInstance;
}

/**
 * Cleanup singleton instance
 */
export async function cleanupTensorFlowLiteManager(): Promise<void> {
  if (tfliteManagerInstance) {
    await tfliteManagerInstance.unloadAllModels();
    tfliteManagerInstance = null;
  }
}

/**
 * Reset singleton instance (testing only)
 */
export function resetTensorFlowLiteManagerForTesting(): void {
  tfliteManagerInstance = null;
}
