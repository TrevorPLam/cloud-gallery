// AI-META-BEGIN
// AI-META: Model management with caching, background loading, and memory optimization
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by ML services and adaptive model selection
// DEPENDENCIES: tflite.ts, AsyncStorage, Platform, InteractionManager
// DANGER: Model caching requires careful memory management and cleanup
// CHANGE-SAFETY: Add new caching strategies by extending CacheStrategy enum
// TESTS: client/lib/ml/model-manager.test.ts
// AI-META-END

import { Platform, InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getTensorFlowLiteManager,
  ModelConfig,
  ModelMetadata,
  GPUDelegateType,
  DeviceCapabilities,
  cleanupTensorFlowLiteManager,
} from './tflite';

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export type CacheStrategy = 
  | 'memory-only'     // Keep models in memory only
  | 'disk-priority'   // Prioritize disk caching with memory fallback
  | 'adaptive'        // Adapt based on memory pressure
  | 'aggressive';     // Cache everything aggressively

export interface ModelCacheEntry {
  metadata: ModelMetadata;
  lastUsed: number;
  useCount: number;
  size: number;
  priority: 'high' | 'medium' | 'low';
}

export interface CacheConfig {
  strategy: CacheStrategy;
  maxMemoryMB: number;
  maxDiskCacheMB: number;
  maxModels: number;
  backgroundLoading: boolean;
  preloadModels: string[];
}

export interface LoadingProgress {
  modelName: string;
  progress: number;
  stage: 'downloading' | 'loading' | 'ready' | 'error';
  error?: string;
}

export interface ModelManagerStats {
  loadedModels: number;
  cachedModels: number;
  memoryUsageMB: number;
  diskCacheUsageMB: number;
  totalInferences: number;
  averageInferenceTime: number;
  cacheHitRate: number;
}

// ─────────────────────────────────────────────────────────
// MODEL CACHE STORAGE
// ─────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  CACHE_METADATA: '@ml_cache_metadata',
  MODEL_USAGE: '@ml_model_usage',
  CACHE_CONFIG: '@ml_cache_config',
} as const;

class ModelCacheStorage {
  private cache = new Map<string, ModelCacheEntry>();
  private loadingPromises = new Map<string, Promise<ModelMetadata>>();
  private progressCallbacks = new Set<(progress: LoadingProgress) => void>();

  // ─── CACHE METADATA ─────────────────────────────────────

  async saveCacheMetadata(): Promise<void> {
    try {
      const metadata = Array.from(this.cache.entries()).map(([key, entry]) => [
        key,
        {
          ...entry,
          // Don't store actual metadata in AsyncStorage, just cache info
          lastUsed: entry.lastUsed,
          useCount: entry.useCount,
          size: entry.size,
          priority: entry.priority,
        },
      ]);
      
      await AsyncStorage.setItem(STORAGE_KEYS.CACHE_METADATA, JSON.stringify(metadata));
    } catch (error) {
      console.warn('ModelCacheStorage: Failed to save cache metadata:', error);
    }
  }

  async loadCacheMetadata(): Promise<void> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CACHE_METADATA);
      if (data) {
        const metadata: Array<[string, any]> = JSON.parse(data);
        
        // Restore cache entries without actual model metadata
        metadata.forEach(([key, entry]) => {
          this.cache.set(key, {
            ...entry,
            metadata: {
              name: key,
              version: '1.0.0',
              inputs: [],
              outputs: [],
              delegate: 'none',
              loadTime: 0,
              memoryUsage: entry.size,
            },
          });
        });
      }
    } catch (error) {
      console.warn('ModelCacheStorage: Failed to load cache metadata:', error);
    }
  }

  // ─── CACHE OPERATIONS ───────────────────────────────────

  async addToCache(modelName: string, metadata: ModelMetadata, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<void> {
    const entry: ModelCacheEntry = {
      metadata,
      lastUsed: Date.now(),
      useCount: 1,
      size: metadata.memoryUsage,
      priority,
    };

    this.cache.set(modelName, entry);
    await this.saveCacheMetadata();
  }

  async updateCacheUsage(modelName: string): Promise<void> {
    const entry = this.cache.get(modelName);
    if (entry) {
      entry.lastUsed = Date.now();
      entry.useCount++;
      await this.saveCacheMetadata();
    }
  }

  async removeFromCache(modelName: string): Promise<void> {
    this.cache.delete(modelName);
    await this.saveCacheMetadata();
  }

  getCacheEntry(modelName: string): ModelCacheEntry | undefined {
    return this.cache.get(modelName);
  }

  getAllCacheEntries(): ModelCacheEntry[] {
    return Array.from(this.cache.values());
  }

  // ─── LOADING MANAGEMENT ───────────────────────────────────

  setLoadingPromise(modelName: string, promise: Promise<ModelMetadata>): void {
    this.loadingPromises.set(modelName, promise);
  }

  getLoadingPromise(modelName: string): Promise<ModelMetadata> | undefined {
    return this.loadingPromises.get(modelName);
  }

  removeLoadingPromise(modelName: string): void {
    this.loadingPromises.delete(modelName);
  }

  // ─── PROGRESS CALLBACKS ───────────────────────────────────

  addProgressCallback(callback: (progress: LoadingProgress) => void): void {
    this.progressCallbacks.add(callback);
  }

  removeProgressCallback(callback: (progress: LoadingProgress) => void): void {
    this.progressCallbacks.delete(callback);
  }

  notifyProgress(progress: LoadingProgress): void {
    this.progressCallbacks.forEach(callback => {
      try {
        callback(progress);
      } catch (error) {
        console.warn('ModelCacheStorage: Progress callback error:', error);
      }
    });
  }

  // ─── CACHE STATISTICS ─────────────────────────────────────

  getCacheStats(): {
    entries: number;
    totalSize: number;
    totalUsage: number;
    priorityBreakdown: Record<string, number>;
  } {
    const entries = this.getAllCacheEntries();
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const totalUsage = entries.reduce((sum, entry) => sum + entry.useCount, 0);
    
    const priorityBreakdown = entries.reduce((acc, entry) => {
      acc[entry.priority] = (acc[entry.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      entries: entries.length,
      totalSize,
      totalUsage,
      priorityBreakdown,
    };
  }
}

// ─────────────────────────────────────────────────────────
// MODEL MANAGER
// ─────────────────────────────────────────────────────────

export class ModelManager {
  private cache = new ModelCacheStorage();
  private config: CacheConfig;
  private tfliteManager = getTensorFlowLiteManager();
  private deviceCapabilities: DeviceCapabilities | null = null;
  private inferenceCount = 0;
  private totalInferenceTime = 0;
  private cacheHits = 0;
  private cacheRequests = 0;
  private initializationPromise: Promise<void> | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      strategy: 'adaptive',
      maxMemoryMB: 512, // 512MB for model caching
      maxDiskCacheMB: 1024, // 1GB disk cache
      maxModels: 10,
      backgroundLoading: true,
      preloadModels: [],
      ...config,
    };

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
      // Load cache metadata
      await this.cache.loadCacheMetadata();
      
      // Get device capabilities
      this.deviceCapabilities = await this.tfliteManager.getDeviceCapabilities();
      
      // Adjust config based on device capabilities
      this.adjustConfigForDevice();
      
      // Preload high-priority models
      if (this.config.preloadModels.length > 0) {
        this.preloadModels();
      }
      
      console.log('ModelManager: Initialized with config:', this.config);
    } catch (error) {
      console.error('ModelManager: Initialization failed:', error);
      throw error;
    }
  }

  private adjustConfigForDevice(): void {
    if (!this.deviceCapabilities) return;

    const { memoryMB, platform } = this.deviceCapabilities;

    // Adjust memory limits based on available memory
    if (memoryMB < 4096) { // Less than 4GB
      this.config.maxMemoryMB = Math.min(this.config.maxMemoryMB, 128);
      this.config.maxModels = Math.min(this.config.maxModels, 3);
    } else if (memoryMB < 8192) { // Less than 8GB
      this.config.maxMemoryMB = Math.min(this.config.maxMemoryMB, 256);
      this.config.maxModels = Math.min(this.config.maxModels, 5);
    }

    // Adjust strategy based on platform
    if (platform === 'ios' && this.deviceCapabilities.hasNeuralEngine) {
      // iOS with Neural Engine can handle more aggressive caching
      this.config.strategy = 'aggressive';
    } else if (memoryMB < 6144) {
      // Low memory devices use disk-priority caching
      this.config.strategy = 'disk-priority';
    }
  }

  private async preloadModels(): Promise<void> {
    if (!this.config.backgroundLoading) return;

    // Preload models in background with low priority
    InteractionManager.runAfterInteractions(async () => {
      for (const modelName of this.config.preloadModels) {
        try {
          await this.loadModel({ name: modelName, path: `assets/models/${modelName}.tflite`, inputSize: 224, outputSize: 1000 });
          console.log(`ModelManager: Preloaded model "${modelName}"`);
        } catch (error) {
          console.warn(`ModelManager: Failed to preload model "${modelName}":`, error);
        }
      }
    });
  }

  // ─── MODEL LOADING ───────────────────────────────────────

  /**
   * Load a model with caching and background loading
   */
  async loadModel(config: ModelConfig, priority: 'high' | 'medium' | 'low' = 'medium'): Promise<ModelMetadata> {
    await this.initialize();

    this.cacheRequests++;

    // Check if already loading
    const existingPromise = this.cache.getLoadingPromise(config.name);
    if (existingPromise) {
      return existingPromise;
    }

    // Check if already cached
    const cachedEntry = this.cache.getCacheEntry(config.name);
    if (cachedEntry && this.tfliteManager.isModelLoaded(config.name)) {
      this.cacheHits++;
      await this.cache.updateCacheUsage(config.name);
      return cachedEntry.metadata;
    }

    // Create loading promise
    const loadingPromise = this._loadModelInternal(config, priority);
    this.cache.setLoadingPromise(config.name, loadingPromise);

    try {
      const metadata = await loadingPromise;
      await this.cache.addToCache(config.name, metadata, priority);
      this.cache.removeLoadingPromise(config.name);
      return metadata;
    } catch (error) {
      this.cache.removeLoadingPromise(config.name);
      throw error;
    }
  }

  private async _loadModelInternal(config: ModelConfig, priority: 'high' | 'medium' | 'low'): Promise<ModelMetadata> {
    // Notify loading start
    this.cache.notifyProgress({
      modelName: config.name,
      progress: 0,
      stage: 'loading',
    });

    try {
      // Check memory usage and cleanup if needed
      await this.ensureMemoryCapacity(config);

      // Load model using TensorFlow Lite manager
      const metadata = await this.tfliteManager.loadModel(config);

      // Notify loading complete
      this.cache.notifyProgress({
        modelName: config.name,
        progress: 100,
        stage: 'ready',
      });

      return metadata;
    } catch (error) {
      // Notify loading error
      this.cache.notifyProgress({
        modelName: config.name,
        progress: 0,
        stage: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Ensure enough memory capacity for new model
   */
  private async ensureMemoryCapacity(config: ModelConfig): Promise<void> {
    const currentUsage = this.getCurrentMemoryUsage();
    const estimatedUsage = config.inputSize * config.inputSize * 3 * 4; // Rough estimate
    
    if (currentUsage + estimatedUsage > this.config.maxMemoryMB * 1024 * 1024) {
      await this.cleanupMemory(estimatedUsage);
    }

    // Check model count limit
    const loadedModels = this.tfliteManager.getLoadedModels();
    if (loadedModels.length >= this.config.maxModels) {
      await this.unloadLeastUsedModels(1);
    }
  }

  /**
   * Get current memory usage in bytes
   */
  private getCurrentMemoryUsage(): number {
    return this.cache.getAllCacheEntries()
      .reduce((sum, entry) => sum + entry.size, 0);
  }

  /**
   * Cleanup memory to make room for new model
   */
  private async cleanupMemory(requiredBytes: number): Promise<void> {
    const entries = this.cache.getAllCacheEntries()
      .sort((a, b) => {
        // Sort by priority and last used time
        const priorityOrder = { low: 0, medium: 1, high: 2 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.lastUsed - b.lastUsed;
      });

    let freedBytes = 0;
    for (const entry of entries) {
      if (freedBytes >= requiredBytes) break;
      
      await this.unloadModel(entry.metadata.name);
      freedBytes += entry.size;
    }
  }

  /**
   * Unload least used models
   */
  private async unloadLeastUsedModels(count: number): Promise<void> {
    const entries = this.cache.getAllCacheEntries()
      .sort((a, b) => a.lastUsed - b.lastUsed)
      .slice(0, count);

    await Promise.all(entries.map(entry => this.unloadModel(entry.metadata.name)));
  }

  // ─── INFERENCE ────────────────────────────────────────────

  /**
   * Run inference with automatic model loading
   */
  async runInference(modelName: string, inputs: any[], config?: ModelConfig): Promise<any[]> {
    await this.initialize();

    // Load model if not already loaded
    if (!this.tfliteManager.isModelLoaded(modelName)) {
      if (!config) {
        throw new Error(`Model "${modelName}" not loaded and no config provided`);
      }
      await this.loadModel(config);
    }

    const startTime = Date.now();
    
    try {
      const result = await this.tfliteManager.runInference(modelName, inputs);
      
      // Update statistics
      this.inferenceCount++;
      this.totalInferenceTime += Date.now() - startTime;
      await this.cache.updateCacheUsage(modelName);
      
      return result.outputs;
    } catch (error) {
      console.error(`ModelManager: Inference failed for model "${modelName}":`, error);
      throw error;
    }
  }

  /**
   * Run synchronous inference (for real-time processing)
   */
  runInferenceSync(modelName: string, inputs: any[]): any[] {
    if (!this.tfliteManager.isModelLoaded(modelName)) {
      throw new Error(`Model "${modelName}" not loaded for sync inference`);
    }

    const startTime = Date.now();
    
    try {
      const result = this.tfliteManager.runInferenceSync(modelName, inputs);
      
      // Update statistics
      this.inferenceCount++;
      this.totalInferenceTime += Date.now() - startTime;
      this.cache.updateCacheUsage(modelName); // Async but fire-and-forget for sync
      
      return result.outputs;
    } catch (error) {
      console.error(`ModelManager: Sync inference failed for model "${modelName}":`, error);
      throw error;
    }
  }

  // ─── MODEL MANAGEMENT ─────────────────────────────────────

  /**
   * Unload a specific model
   */
  async unloadModel(modelName: string): Promise<void> {
    await this.tfliteManager.unloadModel(modelName);
    await this.cache.removeFromCache(modelName);
  }

  /**
   * Unload all models
   */
  async unloadAllModels(): Promise<void> {
    await this.tfliteManager.unloadAllModels();
    
    // Clear cache entries but keep metadata for disk caching
    const entries = this.cache.getAllCacheEntries();
    await Promise.all(entries.map(entry => this.cache.removeFromCache(entry.metadata.name)));
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(modelName: string): boolean {
    return this.tfliteManager.isModelLoaded(modelName);
  }

  /**
   * Get model metadata
   */
  getModelMetadata(modelName: string): ModelMetadata | undefined {
    return this.tfliteManager.getModelMetadata(modelName);
  }

  /**
   * Get all loaded models
   */
  getLoadedModels(): string[] {
    return this.tfliteManager.getLoadedModels();
  }

  // ─── CACHE MANAGEMENT ─────────────────────────────────────

  /**
   * Clear disk cache
   */
  async clearDiskCache(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.CACHE_METADATA,
        STORAGE_KEYS.MODEL_USAGE,
        STORAGE_KEYS.CACHE_CONFIG,
      ]);
      console.log('ModelManager: Disk cache cleared');
    } catch (error) {
      console.error('ModelManager: Failed to clear disk cache:', error);
    }
  }

  /**
   * Optimize cache based on usage patterns
   */
  async optimizeCache(): Promise<void> {
    const entries = this.cache.getAllCacheEntries();
    
    // Identify unused models
    const unusedThreshold = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7 days ago
    const unusedModels = entries.filter(entry => entry.lastUsed < unusedThreshold);
    
    // Unload unused models
    await Promise.all(unusedModels.map(entry => this.unloadModel(entry.metadata.name)));
    
    console.log(`ModelManager: Optimized cache, unloaded ${unusedModels.length} unused models`);
  }

  // ─── STATISTICS AND MONITORING ─────────────────────────────

  /**
   * Get comprehensive manager statistics
   */
  async getStats(): Promise<ModelManagerStats> {
    const cacheStats = this.cache.getCacheStats();
    const tfliteStats = this.tfliteManager.getPerformanceStats();
    
    return {
      loadedModels: tfliteStats.loadedModels,
      cachedModels: cacheStats.entries,
      memoryUsageMB: tfliteStats.totalMemoryUsage / (1024 * 1024),
      diskCacheUsageMB: cacheStats.totalSize / (1024 * 1024),
      totalInferences: this.inferenceCount,
      averageInferenceTime: this.inferenceCount > 0 ? this.totalInferenceTime / this.inferenceCount : 0,
      cacheHitRate: this.cacheRequests > 0 ? this.cacheHits / this.cacheRequests : 0,
    };
  }

  /**
   * Add progress callback for model loading
   */
  onLoadingProgress(callback: (progress: LoadingProgress) => void): void {
    this.cache.addProgressCallback(callback);
  }

  /**
   * Remove progress callback
   */
  removeLoadingProgress(callback: (progress: LoadingProgress) => void): void {
    this.cache.removeProgressCallback(callback);
  }

  /**
   * Get current configuration
   */
  getConfig(): CacheConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(newConfig: Partial<CacheConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };
    this.adjustConfigForDevice();
    
    // Save config to storage
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.CACHE_CONFIG, JSON.stringify(this.config));
    } catch (error) {
      console.warn('ModelManager: Failed to save config:', error);
    }
  }

  // ─── CLEANUP ────────────────────────────────────────────

  /**
   * Cleanup all resources
   */
  async cleanup(): Promise<void> {
    await this.unloadAllModels();
    await this.clearDiskCache();
    await cleanupTensorFlowLiteManager();
  }
}

// ─────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────

let modelManagerInstance: ModelManager | null = null;

/**
 * Get singleton instance of ModelManager
 */
export function getModelManager(config?: Partial<CacheConfig>): ModelManager {
  if (!modelManagerInstance) {
    modelManagerInstance = new ModelManager(config);
  }
  return modelManagerInstance;
}

/**
 * Cleanup singleton instance
 */
export async function cleanupModelManager(): Promise<void> {
  if (modelManagerInstance) {
    await modelManagerInstance.cleanup();
    modelManagerInstance = null;
  }
}

/**
 * Reset singleton instance (testing only)
 */
export function resetModelManagerForTesting(): void {
  modelManagerInstance = null;
}
