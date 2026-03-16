// AI-META-BEGIN
// AI-META: Adaptive model selection with device capability detection and performance optimization
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by ML services and auto-optimization features
// DEPENDENCIES: tflite.ts, model-manager.ts, Platform
// DANGER: Model selection requires careful performance monitoring and fallback strategies
// CHANGE-SAFETY: Add new model variants by extending ModelVariant and ModelProfile
// TESTS: client/lib/ml/adaptive-models.test.ts
// AI-META-END

import { Platform } from 'react-native';
import { 
  getTensorFlowLiteManager, 
  DeviceCapabilities, 
  GPUDelegateType,
  ModelConfig,
  ModelMetadata,
} from './tflite';
import { getModelManager, CacheStrategy } from './model-manager';

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface ModelVariant {
  name: string;
  path: string | number;
  inputSize: number;
  outputSize: number;
  quantized: boolean;
  delegate?: GPUDelegateType;
  complexity: 'low' | 'medium' | 'high';
  accuracy: number; // 0-1
  speed: number;    // 0-1 (higher is faster)
  memoryUsage: number; // MB
  description: string;
}

export interface ModelProfile {
  baseName: string;
  variants: ModelVariant[];
  useCase: 'object-detection' | 'face-detection' | 'face-recognition' | 'image-classification' | 'semantic-search';
  description: string;
  tags: string[];
}

export interface PerformanceMetrics {
  inferenceTime: number;
  memoryUsage: number;
  accuracy: number;
  batteryImpact: 'low' | 'medium' | 'high';
  thermalImpact: 'low' | 'medium' | 'high';
}

export interface SelectionCriteria {
  prioritizeSpeed?: boolean;
  prioritizeAccuracy?: boolean;
  prioritizeMemory?: boolean;
  prioritizeBattery?: boolean;
  maxInferenceTime?: number; // ms
  maxMemoryUsage?: number;   // MB
  minAccuracy?: number;     // 0-1
  delegate?: GPUDelegateType;
}

export interface AdaptiveSelectionResult {
  selectedVariant: ModelVariant;
  reasoning: string[];
  expectedPerformance: PerformanceMetrics;
  fallbackOptions: ModelVariant[];
}

// ─────────────────────────────────────────────────────────
// MODEL REGISTRY
// ─────────────────────────────────────────────────────────

export class ModelRegistry {
  private static instance: ModelRegistry;
  private profiles = new Map<string, ModelProfile>();

  static getInstance(): ModelRegistry {
    if (!this.instance) {
      this.instance = new ModelRegistry();
      this.instance.initializeDefaultProfiles();
    }
    return this.instance;
  }

  private initializeDefaultProfiles(): void {
    // MobileNet v3 variants for object detection
    this.registerProfile({
      baseName: 'mobilenet_v3',
      variants: [
        {
          name: 'mobilenet_v3_small_quant',
          path: 'assets/models/mobilenet_v3_small_quant.tflite',
          inputSize: 192,
          outputSize: 1000,
          quantized: true,
          complexity: 'low',
          accuracy: 0.76,
          speed: 0.9,
          memoryUsage: 4.2,
          description: 'MobileNet V3 Small (8-bit quantized)',
        },
        {
          name: 'mobilenet_v3_small',
          path: 'assets/models/mobilenet_v3_small.tflite',
          inputSize: 192,
          outputSize: 1000,
          quantized: false,
          complexity: 'low',
          accuracy: 0.78,
          speed: 0.7,
          memoryUsage: 8.5,
          description: 'MobileNet V3 Small (float32)',
        },
        {
          name: 'mobilenet_v3_large_quant',
          path: 'assets/models/mobilenet_v3_large_quant.tflite',
          inputSize: 224,
          outputSize: 1000,
          quantized: true,
          complexity: 'medium',
          accuracy: 0.83,
          speed: 0.6,
          memoryUsage: 12.8,
          description: 'MobileNet V3 Large (8-bit quantized)',
        },
        {
          name: 'mobilenet_v3_large',
          path: 'assets/models/mobilenet_v3_large.tflite',
          inputSize: 224,
          outputSize: 1000,
          quantized: false,
          complexity: 'medium',
          accuracy: 0.85,
          speed: 0.4,
          memoryUsage: 25.6,
          description: 'MobileNet V3 Large (float32)',
        },
      ],
      useCase: 'object-detection',
      description: 'MobileNet V3 object detection models',
      tags: ['object-detection', 'mobile-optimized', 'versatile'],
    });

    // BlazeFace variants for face detection
    this.registerProfile({
      baseName: 'blazeface',
      variants: [
        {
          name: 'blazeface_short_range',
          path: 'assets/models/blazeface_short_range.tflite',
          inputSize: 128,
          outputSize: 896, // 56 faces * 16 values per face
          quantized: true,
          complexity: 'low',
          accuracy: 0.89,
          speed: 0.95,
          memoryUsage: 0.8,
          description: 'BlazeFace short-range (optimized for close-up faces)',
        },
        {
          name: 'blazeface_full_range',
          path: 'assets/models/blazeface_full_range.tflite',
          inputSize: 128,
          outputSize: 896,
          quantized: true,
          complexity: 'medium',
          accuracy: 0.91,
          speed: 0.8,
          memoryUsage: 1.2,
          description: 'BlazeFace full-range (optimized for various distances)',
        },
        {
          name: 'blazeface_full_range_sparse',
          path: 'assets/models/blazeface_full_range_sparse.tflite',
          inputSize: 128,
          outputSize: 896,
          quantized: true,
          complexity: 'medium',
          accuracy: 0.92,
          speed: 0.7,
          memoryUsage: 1.1,
          description: 'BlazeFace full-range sparse (better accuracy)',
        },
      ],
      useCase: 'face-detection',
      description: 'BlazeFace face detection models',
      tags: ['face-detection', 'real-time', 'mobile-optimized'],
    });

    // EfficientNet variants for image classification
    this.registerProfile({
      baseName: 'efficientnet',
      variants: [
        {
          name: 'efficientnet_b0_quant',
          path: 'assets/models/efficientnet_b0_quant.tflite',
          inputSize: 224,
          outputSize: 1000,
          quantized: true,
          complexity: 'medium',
          accuracy: 0.77,
          speed: 0.8,
          memoryUsage: 16.4,
          description: 'EfficientNet B0 (8-bit quantized)',
        },
        {
          name: 'efficientnet_b0',
          path: 'assets/models/efficientnet_b0.tflite',
          inputSize: 224,
          outputSize: 1000,
          quantized: false,
          complexity: 'medium',
          accuracy: 0.81,
          speed: 0.5,
          memoryUsage: 32.8,
          description: 'EfficientNet B0 (float32)',
        },
        {
          name: 'efficientnet_b1_quant',
          path: 'assets/models/efficientnet_b1_quant.tflite',
          inputSize: 240,
          outputSize: 1000,
          quantized: true,
          complexity: 'high',
          accuracy: 0.79,
          speed: 0.6,
          memoryUsage: 23.7,
          description: 'EfficientNet B1 (8-bit quantized)',
        },
      ],
      useCase: 'image-classification',
      description: 'EfficientNet image classification models',
      tags: ['image-classification', 'accuracy-focused', 'efficient'],
    });

    // FaceNet variants for face recognition
    this.registerProfile({
      baseName: 'facenet',
      variants: [
        {
          name: 'facenet_mobilenet',
          path: 'assets/models/facenet_mobilenet.tflite',
          inputSize: 112,
          outputSize: 128, // 128-dimensional embedding
          quantized: false,
          complexity: 'medium',
          accuracy: 0.92,
          speed: 0.7,
          memoryUsage: 8.9,
          description: 'FaceNet with MobileNet backbone',
        },
        {
          name: 'facenet_inception_resnet',
          path: 'assets/models/facenet_inception_resnet.tflite',
          inputSize: 160,
          outputSize: 128,
          quantized: false,
          complexity: 'high',
          accuracy: 0.96,
          speed: 0.3,
          memoryUsage: 45.2,
          description: 'FaceNet with InceptionResNet backbone',
        },
      ],
      useCase: 'face-recognition',
      description: 'FaceNet face recognition models',
      tags: ['face-recognition', 'embeddings', 'high-accuracy'],
    });

    // CLIP variants for semantic search
    this.registerProfile({
      baseName: 'clip',
      variants: [
        {
          name: 'clip_vit_b32_quant',
          path: 'assets/models/clip_vit_b32_quant.tflite',
          inputSize: 224,
          outputSize: 512, // 512-dimensional embedding
          quantized: true,
          complexity: 'high',
          accuracy: 0.85,
          speed: 0.4,
          memoryUsage: 91.3,
          description: 'CLIP ViT-B/32 (8-bit quantized)',
        },
        {
          name: 'clip_vit_b32',
          path: 'assets/models/clip_vit_b32.tflite',
          inputSize: 224,
          outputSize: 512,
          quantized: false,
          complexity: 'high',
          accuracy: 0.88,
          speed: 0.2,
          memoryUsage: 182.6,
          description: 'CLIP ViT-B/32 (float32)',
        },
      ],
      useCase: 'semantic-search',
      description: 'CLIP multimodal embedding models',
      tags: ['semantic-search', 'multimodal', 'text-image'],
    });
  }

  /**
   * Register a new model profile
   */
  registerProfile(profile: ModelProfile): void {
    this.profiles.set(profile.baseName, profile);
  }

  /**
   * Get model profile by base name
   */
  getProfile(baseName: string): ModelProfile | undefined {
    return this.profiles.get(baseName);
  }

  /**
   * Get all profiles
   */
  getAllProfiles(): ModelProfile[] {
    return Array.from(this.profiles.values());
  }

  /**
   * Get profiles by use case
   */
  getProfilesByUseCase(useCase: string): ModelProfile[] {
    return Array.from(this.profiles.values()).filter(profile => profile.useCase === useCase);
  }

  /**
   * Get profiles by tags
   */
  getProfilesByTags(tags: string[]): Profile[] {
    return Array.from(this.profiles.values()).filter(profile =>
      tags.some(tag => profile.tags.includes(tag))
    );
  }

  /**
   * Search profiles
   */
  searchProfiles(query: string): Profile[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.profiles.values()).filter(profile =>
      profile.baseName.toLowerCase().includes(lowerQuery) ||
      profile.description.toLowerCase().includes(lowerQuery) ||
      profile.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
}

// ─────────────────────────────────────────────────────────
// ADAPTIVE MODEL SELECTOR
// ─────────────────────────────────────────────────────────

export class AdaptiveModelSelector {
  private static instance: AdaptiveModelSelector;
  private registry = ModelRegistry.getInstance();
  private tfliteManager = getTensorFlowLiteManager();
  private modelManager = getModelManager();
  private deviceCapabilities: DeviceCapabilities | null = null;
  private performanceHistory = new Map<string, PerformanceMetrics[]>();

  static getInstance(): AdaptiveModelSelector {
    if (!this.instance) {
      this.instance = new AdaptiveModelSelector();
    }
    return this.instance;
  }

  /**
   * Initialize the selector
   */
  async initialize(): Promise<void> {
    this.deviceCapabilities = await this.tfliteManager.getDeviceCapabilities();
    console.log('AdaptiveModelSelector: Initialized with device capabilities:', {
      platform: this.deviceCapabilities.platform,
      memoryMB: this.deviceCapabilities.memoryMB,
      supportedDelegates: this.deviceCapabilities.supportedDelegates,
    });
  }

  /**
   * Select optimal model variant based on criteria and device capabilities
   */
  async selectModel(
    baseName: string,
    criteria: SelectionCriteria = {}
  ): Promise<AdaptiveSelectionResult> {
    await this.initialize();

    const profile = this.registry.getProfile(baseName);
    if (!profile) {
      throw new Error(`Model profile "${baseName}" not found`);
    }

    // Filter variants based on device capabilities and criteria
    const candidateVariants = this.filterVariants(profile.variants, criteria);
    
    if (candidateVariants.length === 0) {
      throw new Error(`No suitable model variants found for "${baseName}"`);
    }

    // Score each variant
    const scoredVariants = await Promise.all(
      candidateVariants.map(async variant => ({
        variant,
        score: await this.scoreVariant(variant, criteria),
        expectedPerformance: this.estimatePerformance(variant),
      }))
    );

    // Sort by score (highest first)
    scoredVariants.sort((a, b) => b.score - a.score);

    const selected = scoredVariants[0];
    const fallbackOptions = scoredVariants.slice(1, 3).map(s => s.variant);

    const result: AdaptiveSelectionResult = {
      selectedVariant: selected.variant,
      reasoning: this.generateReasoning(selected.variant, criteria, selected.score),
      expectedPerformance: selected.expectedPerformance,
      fallbackOptions,
    };

    console.log(`AdaptiveModelSelector: Selected "${selected.variant.name}" for "${baseName}"`, {
      score: selected.score,
      reasoning: result.reasoning,
    });

    return result;
  }

  /**
   * Filter variants based on hard constraints
   */
  private filterVariants(variants: ModelVariant[], criteria: SelectionCriteria): ModelVariant[] {
    return variants.filter(variant => {
      // Memory constraint
      if (criteria.maxMemoryUsage && variant.memoryUsage > criteria.maxMemoryUsage) {
        return false;
      }

      // Accuracy constraint
      if (criteria.minAccuracy && variant.accuracy < criteria.minAccuracy) {
        return false;
      }

      // Delegate constraint
      if (criteria.delegate && variant.delegate && variant.delegate !== criteria.delegate) {
        return false;
      }

      // Device capability constraints
      if (!this.isVariantSupported(variant)) {
        return false;
      }

      return true;
    });
  }

  /**
   * Check if variant is supported on current device
   */
  private isVariantSupported(variant: ModelVariant): boolean {
    if (!this.deviceCapabilities) return false;

    // Check delegate support
    if (variant.delegate && !this.deviceCapabilities.supportedDelegates.includes(variant.delegate)) {
      return false;
    }

    // Check memory requirements
    if (variant.memoryUsage > this.deviceCapabilities.memoryMB * 0.3) { // Don't use more than 30% of total memory
      return false;
    }

    // Check complexity vs device capability
    if (variant.complexity === 'high' && this.deviceCapabilities.memoryMB < 6144) { // Less than 6GB
      return false;
    }

    return true;
  }

  /**
   * Score a variant based on criteria and device capabilities
   */
  private async scoreVariant(variant: ModelVariant, criteria: SelectionCriteria): Promise<number> {
    let score = 0;

    // Base score from accuracy
    score += variant.accuracy * 30;

    // Speed score
    if (criteria.prioritizeSpeed) {
      score += variant.speed * 40;
    } else {
      score += variant.speed * 20;
    }

    // Memory efficiency
    const memoryEfficiency = Math.max(0, 1 - variant.memoryUsage / 100); // Normalize to 0-1
    if (criteria.prioritizeMemory) {
      score += memoryEfficiency * 30;
    } else {
      score += memoryEfficiency * 15;
    }

    // Complexity penalty/bonus
    if (criteria.prioritizeSpeed) {
      // Prefer lower complexity for speed
      score += variant.complexity === 'low' ? 10 : variant.complexity === 'medium' ? 5 : 0;
    } else if (criteria.prioritizeAccuracy) {
      // Prefer higher complexity for accuracy
      score += variant.complexity === 'high' ? 10 : variant.complexity === 'medium' ? 5 : 0;
    }

    // Quantization bonus for memory/battery optimization
    if (criteria.prioritizeMemory || criteria.prioritizeBattery) {
      score += variant.quantized ? 10 : 0;
    }

    // Historical performance adjustment
    const history = this.performanceHistory.get(variant.name);
    if (history && history.length > 0) {
      const avgPerformance = this.calculateAveragePerformance(history);
      
      if (criteria.prioritizeSpeed && avgPerformance.inferenceTime > (criteria.maxInferenceTime || 100)) {
        score -= 20; // Penalty for slow performance
      }
      
      if (criteria.prioritizeAccuracy && avgPerformance.accuracy < variant.accuracy * 0.9) {
        score -= 15; // Penalty for lower than expected accuracy
      }
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Estimate performance for a variant
   */
  private estimatePerformance(variant: ModelVariant): PerformanceMetrics {
    if (!this.deviceCapabilities) {
      // Return conservative estimates
      return {
        inferenceTime: variant.speed === 'high' ? 50 : variant.speed === 'medium' ? 100 : 200,
        memoryUsage: variant.memoryUsage,
        accuracy: variant.accuracy,
        batteryImpact: variant.memoryUsage > 50 ? 'high' : variant.memoryUsage > 20 ? 'medium' : 'low',
        thermalImpact: variant.complexity === 'high' ? 'high' : variant.complexity === 'medium' ? 'medium' : 'low',
      };
    }

    // Base inference time estimation
    let inferenceTime = variant.speed === 'high' ? 50 : variant.speed === 'medium' ? 100 : 200;

    // Adjust for device capabilities
    if (this.deviceCapabilities.hasNeuralEngine) {
      inferenceTime *= 0.5; // Neural Engine speeds up inference
    } else if (this.deviceCapabilities.hasGPUAcceleration) {
      inferenceTime *= 0.7; // GPU acceleration helps
    }

    // Adjust for delegate
    if (variant.delegate === 'core-ml') {
      inferenceTime *= 0.6;
    } else if (variant.delegate === 'android-gpu') {
      inferenceTime *= 0.8;
    }

    // Adjust for quantization
    if (variant.quantized) {
      inferenceTime *= 0.8; // Quantized models are faster
    }

    return {
      inferenceTime: Math.round(inferenceTime),
      memoryUsage: variant.memoryUsage,
      accuracy: variant.accuracy,
      batteryImpact: this.estimateBatteryImpact(variant, inferenceTime),
      thermalImpact: this.estimateThermalImpact(variant, inferenceTime),
    };
  }

  /**
   * Estimate battery impact
   */
  private estimateBatteryImpact(variant: ModelVariant, inferenceTime: number): 'low' | 'medium' | 'high' {
    const powerUsage = (variant.memoryUsage / 10) * (inferenceTime / 100);
    
    if (powerUsage < 2) return 'low';
    if (powerUsage < 5) return 'medium';
    return 'high';
  }

  /**
   * Estimate thermal impact
   */
  private estimateThermalImpact(variant: ModelVariant, inferenceTime: number): 'low' | 'medium' | 'high' {
    const thermalLoad = (variant.complexity === 'high' ? 3 : variant.complexity === 'medium' ? 2 : 1) * 
                       (inferenceTime / 100);
    
    if (thermalLoad < 1) return 'low';
    if (thermalLoad < 2.5) return 'medium';
    return 'high';
  }

  /**
   * Generate reasoning for selection
   */
  private generateReasoning(variant: ModelVariant, criteria: SelectionCriteria, score: number): string[] {
    const reasoning: string[] = [];

    reasoning.push(`Selected ${variant.name} with score ${score.toFixed(1)}`);

    if (criteria.prioritizeSpeed && variant.speed > 0.7) {
      reasoning.push('High speed variant prioritized for performance requirements');
    }

    if (criteria.prioritizeAccuracy && variant.accuracy > 0.85) {
      reasoning.push('High accuracy variant selected for quality requirements');
    }

    if (criteria.prioritizeMemory && variant.quantized) {
      reasoning.push('Quantized model selected for memory efficiency');
    }

    if (variant.delegate) {
      reasoning.push(`GPU acceleration (${variant.delegate}) enabled for better performance`);
    }

    if (variant.memoryUsage < 10) {
      reasoning.push('Low memory footprint suitable for mobile devices');
    }

    return reasoning;
  }

  /**
   * Record actual performance metrics
   */
  recordPerformance(variantName: string, metrics: PerformanceMetrics): void {
    if (!this.performanceHistory.has(variantName)) {
      this.performanceHistory.set(variantName, []);
    }

    const history = this.performanceHistory.get(variantName)!;
    history.push(metrics);

    // Keep only last 10 measurements
    if (history.length > 10) {
      history.shift();
    }
  }

  /**
   * Calculate average performance from history
   */
  private calculateAveragePerformance(history: PerformanceMetrics[]): PerformanceMetrics {
    const avg: PerformanceMetrics = {
      inferenceTime: 0,
      memoryUsage: 0,
      accuracy: 0,
      batteryImpact: 'low',
      thermalImpact: 'low',
    };

    history.forEach(metrics => {
      avg.inferenceTime += metrics.inferenceTime;
      avg.memoryUsage += metrics.memoryUsage;
      avg.accuracy += metrics.accuracy;
    });

    const count = history.length;
    avg.inferenceTime /= count;
    avg.memoryUsage /= count;
    avg.accuracy /= count;

    // Determine most common impact levels
    const batteryImpacts = history.map(m => m.batteryImpact);
    const thermalImpacts = history.map(m => m.thermalImpact);
    
    avg.batteryImpact = this.getMostCommon(batteryImpacts);
    avg.thermalImpact = this.getMostCommon(thermalImpacts);

    return avg;
  }

  /**
   * Get most common value from array
   */
  private getMostCommon<T>(array: T[]): T {
    const counts = new Map<T, number>();
    
    array.forEach(item => {
      counts.set(item, (counts.get(item) || 0) + 1);
    });

    let mostCommon = array[0];
    let maxCount = 0;

    counts.forEach((count, item) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    });

    return mostCommon;
  }

  /**
   * Get performance history for a variant
   */
  getPerformanceHistory(variantName: string): PerformanceMetrics[] {
    return this.performanceHistory.get(variantName) || [];
  }

  /**
   * Clear performance history
   */
  clearPerformanceHistory(variantName?: string): void {
    if (variantName) {
      this.performanceHistory.delete(variantName);
    } else {
      this.performanceHistory.clear();
    }
  }

  /**
   * Get device capability summary
   */
  getDeviceCapabilitySummary(): {
    platform: string;
    memoryMB: number;
    supportedDelegates: string[];
    hasNeuralEngine: boolean;
    hasGPUAcceleration: boolean;
    recommendedComplexity: 'low' | 'medium' | 'high';
  } | null {
    if (!this.deviceCapabilities) return null;

    const { platform, memoryMB, supportedDelegates, hasNeuralEngine, hasGPUAcceleration } = this.deviceCapabilities;
    
    let recommendedComplexity: 'low' | 'medium' | 'high' = 'medium';
    
    if (memoryMB < 4096) {
      recommendedComplexity = 'low';
    } else if (memoryMB > 8192 && hasNeuralEngine) {
      recommendedComplexity = 'high';
    }

    return {
      platform,
      memoryMB,
      supportedDelegates,
      hasNeuralEngine,
      hasGPUAcceleration,
      recommendedComplexity,
    };
  }
}

// ─────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────

/**
 * Get optimal model for a use case
 */
export async function getOptimalModel(
  useCase: string,
  criteria: SelectionCriteria = {}
): Promise<AdaptiveSelectionResult> {
  const selector = AdaptiveModelSelector.getInstance();
  const registry = ModelRegistry.getInstance();
  
  const profiles = registry.getProfilesByUseCase(useCase);
  if (profiles.length === 0) {
    throw new Error(`No profiles found for use case "${useCase}"`);
  }

  // For now, use the first profile (could be enhanced to select best profile)
  const profile = profiles[0];
  return await selector.selectModel(profile.baseName, criteria);
}

/**
 * Auto-configure model manager based on device capabilities
 */
export async function autoConfigureModelManager(): Promise<void> {
  const selector = AdaptiveModelSelector.getInstance();
  await selector.initialize();
  
  const capabilities = selector.getDeviceCapabilitySummary();
  if (!capabilities) return;

  let cacheStrategy: CacheStrategy = 'adaptive';
  let maxMemoryMB = 256;
  let maxModels = 5;

  // Configure based on device capabilities
  if (capabilities.memoryMB < 4096) {
    cacheStrategy = 'disk-priority';
    maxMemoryMB = 128;
    maxModels = 3;
  } else if (capabilities.memoryMB > 8192 && capabilities.hasNeuralEngine) {
    cacheStrategy = 'aggressive';
    maxMemoryMB = 512;
    maxModels = 8;
  }

  const modelManager = getModelManager();
  await modelManager.updateConfig({
    strategy: cacheStrategy,
    maxMemoryMB,
    maxModels,
  });

  console.log('ModelManager auto-configured:', {
    strategy: cacheStrategy,
    maxMemoryMB,
    maxModels,
    deviceCapabilities: capabilities,
  });
}

/**
 * Get model recommendations for device
 */
export async function getModelRecommendations(): Promise<{
  recommended: Array<{ profile: ModelProfile; variant: ModelVariant; reason: string }>;
  fallback: Array<{ profile: ModelProfile; variant: ModelVariant; reason: string }>;
}> {
  const selector = AdaptiveModelSelector.getInstance();
  await selector.initialize();
  
  const registry = ModelRegistry.getInstance();
  const profiles = registry.getAllProfiles();
  
  const recommended: Array<{ profile: ModelProfile; variant: ModelVariant; reason: string }> = [];
  const fallback: Array<{ profile: ModelProfile; variant: ModelVariant; reason: string }> = [];

  for (const profile of profiles) {
    try {
      const result = await selector.selectModel(profile.baseName, {
        prioritizeSpeed: true,
        prioritizeMemory: true,
      });
      
      recommended.push({
        profile,
        variant: result.selectedVariant,
        reason: result.reasoning.join(', '),
      });

      // Add first fallback option
      if (result.fallbackOptions.length > 0) {
        fallback.push({
          profile,
          variant: result.fallbackOptions[0],
          reason: 'Fallback option with lower performance',
        });
      }
    } catch (error) {
      // Skip profiles that don't have suitable variants
      continue;
    }
  }

  return { recommended, fallback };
}

// ─────────────────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────────────────

/**
 * Cleanup adaptive model selector
 */
export function cleanupAdaptiveModelSelector(): void {
  const selector = AdaptiveModelSelector.getInstance();
  selector.clearPerformanceHistory();
}

/**
 * Reset adaptive model selector (testing only)
 */
export function resetAdaptiveModelSelectorForTesting(): void {
  const selector = AdaptiveModelSelector.getInstance();
  selector.clearPerformanceHistory();
}
