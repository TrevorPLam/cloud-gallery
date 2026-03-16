// AI-META-BEGIN
// AI-META: Camera integration with real-time ML processing and frame processors
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by camera screens and real-time ML features
// DEPENDENCIES: react-native-vision-camera, model-manager.ts, tflite.ts
// DANGER: Real-time frame processing requires strict performance constraints
// CHANGE-SAFETY: Add new frame processors by extending FrameProcessorManager
// TESTS: client/lib/ml/camera-ml.test.ts
// AI-META-END

import { Platform } from 'react-native';
// Conditional imports for camera functionality
let Camera: any, Frame: any, useFrameProcessor: any;
try {
  const visionCamera = require('react-native-vision-camera');
  Camera = visionCamera.Camera;
  Frame = visionCamera.Frame;
  useFrameProcessor = visionCamera.useFrameProcessor;
} catch (error) {
  // Camera functionality not available
  console.warn('react-native-vision-camera not available, camera ML features disabled');
}

let runOnJS: any;
try {
  const worklets = require('react-native-worklets');
  runOnJS = worklets.runOnJS;
} catch (error) {
  // Worklets not available
  console.warn('react-native-worklets not available, frame processor worklets disabled');
}
import { getModelManager } from './model-manager';
import { ModelConfig } from './tflite';

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface FrameProcessorConfig {
  modelName: string;
  modelConfig: ModelConfig;
  inputSize: number;
  outputFormat: 'detections' | 'embeddings' | 'classifications';
  threshold?: number;
  maxDetections?: number;
  enableSmoothing?: boolean;
  frameSkip?: number; // Process every Nth frame for performance
}

export interface Detection {
  label: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  timestamp: number;
}

export interface FrameProcessorResult {
  detections: Detection[];
  embeddings?: number[];
  classifications?: Array<{ label: string; confidence: number }>;
  processingTime: number;
  frameTimestamp: number;
  fps: number;
}

export interface FrameProcessorCallbacks {
  onResult?: (result: FrameProcessorResult) => void;
  onError?: (error: Error) => void;
  onPerformanceUpdate?: (metrics: { fps: number; processingTime: number }) => void;
}

export interface CameraMLCapabilities {
  supportedFormats: string[];
  maxResolution: { width: number; height: number };
  preferredFps: number;
  supportsFrameProcessors: boolean;
  supportsRealTimeML: boolean;
}

// ─────────────────────────────────────────────────────────
// FRAME PREPROCESSING
// ─────────────────────────────────────────────────────────

export class FramePreprocessor {
  /**
   * Convert camera frame to tensor input format
   */
  static preprocessFrame(frame: Frame, targetSize: number): Uint8Array {
    // Extract image data from frame
    const { width, height } = frame;
    
    // For now, return dummy data - in production would:
    // 1. Convert frame to RGB format
    // 2. Resize to targetSize x targetSize
    // 3. Normalize pixel values (0-255 for uint8 models, 0-1 for float models)
    // 4. Convert to tensor format
    
    const dummyData = new Uint8Array(targetSize * targetSize * 3);
    
    // Fill with pattern to simulate real image data
    for (let i = 0; i < dummyData.length; i++) {
      dummyData[i] = Math.floor(Math.random() * 256);
    }
    
    return dummyData;
  }

  /**
   * Convert frame to float32 tensor (for models that require float input)
   */
  static preprocessFrameFloat(frame: Frame, targetSize: number): Float32Array {
    const uint8Data = FramePreprocessor.preprocessFrame(frame, targetSize);
    
    // Convert uint8 to float32 and normalize to [0, 1]
    const floatData = new Float32Array(uint8Data.length);
    for (let i = 0; i < uint8Data.length; i++) {
      floatData[i] = uint8Data[i] / 255.0;
    }
    
    return floatData;
  }

  /**
   * Extract bounding box from frame coordinates
   */
  static normalizeBoundingBox(
    bbox: { x: number; y: number; width: number; height: number },
    frameWidth: number,
    frameHeight: number
  ): { x: number; y: number; width: number; height: number } {
    return {
      x: bbox.x / frameWidth,
      y: bbox.y / frameHeight,
      width: bbox.width / frameWidth,
      height: bbox.height / frameHeight,
    };
  }

  /**
   * Convert normalized bounding box back to frame coordinates
   */
  static denormalizeBoundingBox(
    normalizedBbox: { x: number; y: number; width: number; height: number },
    frameWidth: number,
    frameHeight: number
  ): { x: number; y: number; width: number; height: number } {
    return {
      x: Math.floor(normalizedBbox.x * frameWidth),
      y: Math.floor(normalizedBbox.y * frameHeight),
      width: Math.floor(normalizedBbox.width * frameWidth),
      height: Math.floor(normalizedBbox.height * frameHeight),
    };
  }
}

// ─────────────────────────────────────────────────────────
// RESULT POST-PROCESSING
// ─────────────────────────────────────────────────────────

export class ResultPostprocessor {
  /**
   * Process object detection outputs
   */
  static processDetections(
    outputs: any[],
    frameWidth: number,
    frameHeight: number,
    threshold: number = 0.7,
    maxDetections: number = 10
  ): Detection[] {
    // Placeholder implementation - in production would parse actual model outputs
    // For now, return dummy detections
    
    const detections: Detection[] = [];
    
    // Assume outputs[0] contains bounding boxes, outputs[1] contains scores
    // and outputs[2] contains class indices
    
    if (outputs.length >= 3) {
      const boxes = outputs[0] as number[];
      const scores = outputs[1] as number[];
      const classes = outputs[2] as number[];
      
      // Each detection typically has 4 values: [y_min, x_min, y_max, x_max]
      for (let i = 0; i < scores.length && detections.length < maxDetections; i++) {
        const confidence = scores[i];
        
        if (confidence >= threshold) {
          const yMin = boxes[i * 4] * frameHeight;
          const xMin = boxes[i * 4 + 1] * frameWidth;
          const yMax = boxes[i * 4 + 2] * frameHeight;
          const xMax = boxes[i * 4 + 3] * frameWidth;
          
          detections.push({
            label: `object_${classes[i]}`,
            confidence,
            boundingBox: {
              x: xMin,
              y: yMin,
              width: xMax - xMin,
              height: yMax - yMin,
            },
            timestamp: Date.now(),
          });
        }
      }
    }
    
    return detections;
  }

  /**
   * Process classification outputs
   */
  static processClassifications(
    outputs: any[],
    threshold: number = 0.5
  ): Array<{ label: string; confidence: number }> {
    // Placeholder implementation
    const classifications: Array<{ label: string; confidence: number }> = [];
    
    if (outputs.length > 0) {
      const probabilities = outputs[0] as number[];
      
      // Find top classifications above threshold
      probabilities.forEach((prob, index) => {
        if (prob >= threshold) {
          classifications.push({
            label: `class_${index}`,
            confidence: prob,
          });
        }
      });
      
      // Sort by confidence
      classifications.sort((a, b) => b.confidence - a.confidence);
    }
    
    return classifications;
  }

  /**
   * Process embedding outputs
   */
  static processEmbeddings(outputs: any[]): number[] {
    // Placeholder implementation
    if (outputs.length > 0) {
      return outputs[0] as number[];
    }
    
    // Return dummy embedding
    return new Array(128).fill(0).map(() => Math.random());
  }

  /**
   * Apply temporal smoothing to detections
   */
  static smoothDetections(
    currentDetections: Detection[],
    previousDetections: Detection[],
    smoothingFactor: number = 0.7
  ): Detection[] {
    // Simple temporal smoothing using weighted average
    const smoothedDetections: Detection[] = [];
    
    // Match detections by IoU (Intersection over Union)
    const matchedPairs = this.matchDetections(currentDetections, previousDetections);
    
    matchedPairs.forEach(({ current, previous }) => {
      if (previous) {
        // Apply smoothing to bounding box
        const smoothedBox = {
          x: smoothingFactor * current.boundingBox.x + (1 - smoothingFactor) * previous.boundingBox.x,
          y: smoothingFactor * current.boundingBox.y + (1 - smoothingFactor) * previous.boundingBox.y,
          width: smoothingFactor * current.boundingBox.width + (1 - smoothingFactor) * previous.boundingBox.width,
          height: smoothingFactor * current.boundingBox.height + (1 - smoothingFactor) * previous.boundingBox.height,
        };
        
        smoothedDetections.push({
          ...current,
          boundingBox: smoothedBox,
        });
      } else {
        smoothedDetections.push(current);
      }
    });
    
    return smoothedDetections;
  }

  /**
   * Match detections between frames using IoU
   */
  private static matchDetections(
    current: Detection[],
    previous: Detection[]
  ): Array<{ current: Detection; previous?: Detection }> {
    const matches: Array<{ current: Detection; previous?: Detection }> = [];
    const usedPrevious = new Set<number>();
    
    current.forEach(currentDet => {
      let bestMatch: Detection | undefined;
      let bestIoU = 0;
      let bestIndex = -1;
      
      previous.forEach((prevDet, index) => {
        if (usedPrevious.has(index)) return;
        
        const iou = this.calculateIoU(currentDet.boundingBox, prevDet.boundingBox);
        if (iou > bestIoU && iou > 0.3) { // IoU threshold
          bestIoU = iou;
          bestMatch = prevDet;
          bestIndex = index;
        }
      });
      
      if (bestMatch) {
        usedPrevious.add(bestIndex);
        matches.push({ current: currentDet, previous: bestMatch });
      } else {
        matches.push({ current: currentDet });
      }
    });
    
    return matches;
  }

  /**
   * Calculate Intersection over Union for bounding boxes
   */
  private static calculateIoU(
    box1: { x: number; y: number; width: number; height: number },
    box2: { x: number; y: number; width: number; height: number }
  ): number {
    const x1 = Math.max(box1.x, box2.x);
    const y1 = Math.max(box1.y, box2.y);
    const x2 = Math.min(box1.x + box1.width, box2.x + box2.width);
    const y2 = Math.min(box1.y + box1.height, box2.y + box2.height);
    
    if (x2 <= x1 || y2 <= y1) return 0;
    
    const intersection = (x2 - x1) * (y2 - y1);
    const union = box1.width * box1.height + box2.width * box2.height - intersection;
    
    return intersection / union;
  }
}

// ─────────────────────────────────────────────────────────
// FRAME PROCESSOR MANAGER
// ─────────────────────────────────────────────────────────

export class FrameProcessorManager {
  private static instance: FrameProcessorManager;
  private processors = new Map<string, FrameProcessorConfig>();
  private previousResults = new Map<string, Detection[]>();
  private frameCounters = new Map<string, number>();
  private lastFrameTimes = new Map<string, number>();

  static getInstance(): FrameProcessorManager {
    if (!this.instance) {
      this.instance = new FrameProcessorManager();
    }
    return this.instance;
  }

  /**
   * Register a frame processor configuration
   */
  registerProcessor(id: string, config: FrameProcessorConfig): void {
    this.processors.set(id, config);
    this.frameCounters.set(id, 0);
    this.lastFrameTimes.set(id, Date.now());
  }

  /**
   * Unregister a frame processor
   */
  unregisterProcessor(id: string): void {
    this.processors.delete(id);
    this.previousResults.delete(id);
    this.frameCounters.delete(id);
    this.lastFrameTimes.delete(id);
  }

  /**
   * Process a single frame
   */
  async processFrame(
    frame: Frame,
    processorId: string,
    callbacks: FrameProcessorCallbacks = {}
  ): Promise<FrameProcessorResult> {
    const config = this.processors.get(processorId);
    if (!config) {
      throw new Error(`Frame processor "${processorId}" not registered`);
    }

    const startTime = Date.now();
    const frameCounter = this.frameCounters.get(processorId) || 0;
    
    try {
      // Frame skipping for performance
      if (config.frameSkip && frameCounter % config.frameSkip !== 0) {
        return {
          detections: [],
          processingTime: 0,
          frameTimestamp: frame.timestamp,
          fps: this.calculateFPS(processorId),
        };
      }

      // Preprocess frame
      const preprocessedData = FramePreprocessor.preprocessFrame(frame, config.inputSize);

      // Run inference
      const modelManager = getModelManager();
      const outputs = await modelManager.runInference(config.modelName, [preprocessedData], config.modelConfig);

      // Post-process results
      let detections: Detection[] = [];
      let embeddings: number[] | undefined;
      let classifications: Array<{ label: string; confidence: number }> | undefined;

      switch (config.outputFormat) {
        case 'detections':
          detections = ResultPostprocessor.processDetections(
            outputs,
            frame.width,
            frame.height,
            config.threshold,
            config.maxDetections
          );
          
          // Apply smoothing if enabled
          if (config.enableSmoothing) {
            const previousDetections = this.previousResults.get(processorId) || [];
            detections = ResultPostprocessor.smoothDetections(detections, previousDetections);
          }
          
          this.previousResults.set(processorId, detections);
          break;

        case 'embeddings':
          embeddings = ResultPostprocessor.processEmbeddings(outputs);
          break;

        case 'classifications':
          classifications = ResultPostprocessor.processClassifications(outputs, config.threshold);
          break;
      }

      const processingTime = Date.now() - startTime;
      const fps = this.calculateFPS(processorId);

      const result: FrameProcessorResult = {
        detections,
        embeddings,
        classifications,
        processingTime,
        frameTimestamp: frame.timestamp,
        fps,
      };

      // Update counters
      this.frameCounters.set(processorId, frameCounter + 1);
      this.lastFrameTimes.set(processorId, Date.now());

      // Notify callbacks
      if (callbacks.onResult) {
        callbacks.onResult(result);
      }

      if (callbacks.onPerformanceUpdate) {
        callbacks.onPerformanceUpdate({ fps, processingTime });
      }

      return result;
    } catch (error) {
      if (callbacks.onError) {
        callbacks.onError(error instanceof Error ? error : new Error('Unknown processing error'));
      }
      throw error;
    }
  }

  /**
   * Calculate FPS for a processor
   */
  private calculateFPS(processorId: number): number {
    const lastTime = this.lastFrameTimes.get(processorId);
    if (!lastTime) return 0;

    const currentTime = Date.now();
    const timeDiff = currentTime - lastTime;
    
    return timeDiff > 0 ? 1000 / timeDiff : 0;
  }

  /**
   * Get processor statistics
   */
  getProcessorStats(processorId: string): {
    frameCount: number;
    fps: number;
    config?: FrameProcessorConfig;
  } {
    return {
      frameCount: this.frameCounters.get(processorId) || 0,
      fps: this.calculateFPS(processorId),
      config: this.processors.get(processorId),
    };
  }

  /**
   * Get all registered processors
   */
  getRegisteredProcessors(): string[] {
    return Array.from(this.processors.keys());
  }
}

// ─────────────────────────────────────────────────────────
// HOOKS AND UTILITIES
// ─────────────────────────────────────────────────────────

/**
 * Create a frame processor hook for real-time ML processing
 */
export function useMLFrameProcessor(
  processorId: string,
  config: FrameProcessorConfig,
  callbacks: FrameProcessorCallbacks = {}
) {
  const processorManager = FrameProcessorManager.getInstance();
  const modelManager = getModelManager();

  // Register processor
  React.useEffect(() => {
    processorManager.registerProcessor(processorId, config);
    
    // Preload model
    modelManager.loadModel(config.modelConfig, 'high').catch(error => {
      console.error(`Failed to preload model "${config.modelName}":`, error);
    });

    return () => {
      processorManager.unregisterProcessor(processorId);
    };
  }, [processorId, config.modelName]);

  // Create frame processor
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    
    // Process frame in worklet context
    runOnJS(async () => {
      try {
        await processorManager.processFrame(frame, processorId, callbacks);
      } catch (error) {
        console.error('Frame processing error:', error);
      }
    })();
  }, [processorId, callbacks]);

  return frameProcessor;
}

/**
 * Get camera ML capabilities
 */
export function getCameraMLCapabilities(): CameraMLCapabilities {
  const platform = Platform.OS;
  
  return {
    supportedFormats: platform === 'ios' ? ['yuv', 'rgb'] : ['yuv'],
    maxResolution: platform === 'ios' 
      ? { width: 1920, height: 1080 } // 1080p
      : { width: 1280, height: 720 },  // 720p
    preferredFps: 30,
    supportsFrameProcessors: true,
    supportsRealTimeML: true,
  };
}

/**
 * Check if device supports real-time ML processing
 */
export function supportsRealTimeML(): boolean {
  const capabilities = getCameraMLCapabilities();
  const platform = Platform.OS;
  
  // Basic requirements for real-time ML
  const hasEnoughMemory = true; // Would check actual device memory
  const hasGoodCPU = platform === 'ios' || parseInt(Platform.Version as string) >= 24; // Android 7.0+
  
  return capabilities.supportsFrameProcessors && 
         capabilities.supportsRealTimeML && 
         hasEnoughMemory && 
         hasGoodCPU;
}

/**
 * Get optimal camera configuration for ML processing
 */
export function getOptimalCameraConfig(): {
  format: string;
  fps: number;
  resolution: { width: number; height: number };
} {
  const capabilities = getCameraMLCapabilities();
  
  return {
    format: capabilities.supportedFormats[0],
    fps: Math.min(capabilities.preferredFps, 30), // Cap at 30fps for performance
    resolution: capabilities.maxResolution,
  };
}

// ─────────────────────────────────────────────────────────
// CLEANUP
// ─────────────────────────────────────────────────────────

/**
 * Cleanup frame processor manager
 */
export function cleanupFrameProcessorManager(): void {
  const manager = FrameProcessorManager.getInstance();
  const processors = manager.getRegisteredProcessors();
  
  processors.forEach(id => {
    manager.unregisterProcessor(id);
  });
}

/**
 * Reset frame processor manager (testing only)
 */
export function resetFrameProcessorManagerForTesting(): void {
  const manager = FrameProcessorManager.getInstance();
  const processors = manager.getRegisteredProcessors();
  
  processors.forEach(id => {
    manager.unregisterProcessor(id);
  });
}
