// AI-META-BEGIN
// AI-META: Context-aware editing service for intelligent object removal and scene understanding
// OWNERSHIP: client/lib/ai
// ENTRYPOINTS: imported by MagicEditorScreen for enhanced inpainting
// DEPENDENCIES: tflite.ts, model-manager.ts, face-detection.ts, Platform
// DANGER: Advanced AI analysis - requires additional privacy considerations
// CHANGE-SAFETY: Maintain scene understanding accuracy, preserve context detection
// TESTS: client/lib/ai/context-aware.test.ts
// AI-META-END

import { Platform } from "react-native";
import {
  getTensorFlowLiteManager,
  ModelConfig,
  GPUDelegateType,
} from "../ml/tflite";
import { getFaceDetectionService, FaceDetection } from "../ml/face-detection";

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export enum SceneCategory {
  INDOOR = "indoor",
  OUTDOOR = "outdoor",
  NATURE = "nature",
  URBAN = "urban",
  PORTRAIT = "portrait",
  FOOD = "food",
  DOCUMENT = "document",
  SCREENSHOT = "screenshot",
  UNKNOWN = "unknown",
}

export enum ObjectCategory {
  PERSON = "person",
  VEHICLE = "vehicle",
  ANIMAL = "animal",
  FOOD = "food",
  ELECTRONICS = "electronics",
  FURNITURE = "furniture",
  CLOTHING = "clothing",
  TEXT = "text",
  BUILDING = "building",
  PLANT = "plant",
  SKY = "sky",
  GROUND = "ground",
  WATER = "water",
  UNKNOWN = "unknown",
}

export interface SceneContext {
  /** Primary scene category */
  category: SceneCategory;
  /** Confidence score for scene classification */
  confidence: number;
  /** Detected objects in the scene */
  objects: DetectedObject[];
  /** Detected faces */
  faces: FaceDetection[];
  /** Image characteristics */
  characteristics: {
    brightness: number;
    contrast: number;
    saturation: number;
    sharpness: number;
    colorPalette: string[];
    dominantColors: { color: string; percentage: number }[];
  };
  /** Spatial layout information */
  layout: {
    hasForeground: boolean;
    hasBackground: boolean;
    hasSky: boolean;
    hasGround: boolean;
    hasHorizon: boolean;
    perspective: "eye-level" | "high-angle" | "low-angle" | "flat";
  };
  /** Contextual suggestions for editing */
  suggestions: EditingSuggestion[];
}

export interface DetectedObject {
  /** Object category */
  category: ObjectCategory;
  /** Confidence score */
  confidence: number;
  /** Bounding box (normalized 0-1) */
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Segmentation mask (optional) */
  mask?: Uint8Array;
  /** Object attributes */
  attributes: {
    size: "small" | "medium" | "large";
    position: "foreground" | "middle-ground" | "background";
    importance: "primary" | "secondary" | "background";
  };
}

export interface EditingSuggestion {
  /** Type of suggestion */
  type: "remove" | "enhance" | "replace" | "adjust";
  /** Target object or region */
  target: {
    category: ObjectCategory;
    boundingBox: { x: number; y: number; width: number; height: number };
  };
  /** Suggested action */
  action: string;
  /** Confidence in suggestion */
  confidence: number;
  /** Reason for suggestion */
  reason: string;
}

export interface ContextAwareConfig {
  /** Whether to enable face detection */
  enableFaceDetection: boolean;
  /** Whether to enable object detection */
  enableObjectDetection: boolean;
  /** Whether to enable scene classification */
  enableSceneClassification: boolean;
  /** Minimum confidence thresholds */
  confidenceThresholds: {
    face: number;
    object: number;
    scene: number;
  };
  /** GPU delegate preference */
  gpuDelegate: GPUDelegateType;
}

// ─────────────────────────────────────────────────────────
// CONTEXT-AWARE EDITING SERVICE
// ─────────────────────────────────────────────────────────

export class ContextAwareEditingService {
  private modelManager = getTensorFlowLiteManager();
  private faceDetectionService = getFaceDetectionService();
  private config: ContextAwareConfig;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  // Model names
  private sceneClassifierModel = "scene-classifier";
  private objectDetectorModel = "object-detector";

  constructor(config: Partial<ContextAwareConfig> = {}) {
    this.config = {
      enableFaceDetection: true,
      enableObjectDetection: true,
      enableSceneClassification: true,
      confidenceThresholds: {
        face: 0.5,
        object: 0.3,
        scene: 0.6,
      },
      gpuDelegate: Platform.OS === "ios" ? "core-ml" : "android-gpu",
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
      // Load scene classification model
      if (this.config.enableSceneClassification) {
        await this.loadSceneClassifier();
      }

      // Load object detection model
      if (this.config.enableObjectDetection) {
        await this.loadObjectDetector();
      }

      // Initialize face detection service
      if (this.config.enableFaceDetection) {
        // Face detection service auto-initializes
      }

      this.isInitialized = true;
      console.log("ContextAwareEditingService: Initialized successfully");
    } catch (error) {
      console.error(
        "ContextAwareEditingService: Initialization failed:",
        error,
      );
      throw error;
    }
  }

  /**
   * Load scene classification model
   */
  private async loadSceneClassifier(): Promise<void> {
    try {
      let modelPath;
      try {
        modelPath = require("../../assets/models/scene-classifier.tflite");
      } catch (error) {
        console.warn(
          "ContextAwareEditingService: Scene classifier model not found",
        );
        return;
      }

      const modelConfig: ModelConfig = {
        name: this.sceneClassifierModel,
        path: modelPath,
        inputSize: 224,
        outputSize: 8, // Number of scene categories
        quantized: true,
        delegate: this.config.gpuDelegate,
      };

      await this.modelManager.loadModel(modelConfig, "medium");
    } catch (error) {
      console.warn(
        "ContextAwareEditingService: Failed to load scene classifier:",
        error,
      );
    }
  }

  /**
   * Load object detection model
   */
  private async loadObjectDetector(): Promise<void> {
    try {
      let modelPath;
      try {
        modelPath = require("../../assets/models/object-detector.tflite");
      } catch (error) {
        console.warn(
          "ContextAwareEditingService: Object detector model not found",
        );
        return;
      }

      const modelConfig: ModelConfig = {
        name: this.objectDetectorModel,
        path: modelPath,
        inputSize: 300,
        outputSize: 100, // Maximum objects
        quantized: true,
        delegate: this.config.gpuDelegate,
      };

      await this.modelManager.loadModel(modelConfig, "medium");
    } catch (error) {
      console.warn(
        "ContextAwareEditingService: Failed to load object detector:",
        error,
      );
    }
  }

  // ─── CONTEXT ANALYSIS ───────────────────────────────────

  /**
   * Analyze image context for intelligent editing suggestions
   */
  async analyzeContext(
    imageData: Uint8Array,
    imageWidth: number,
    imageHeight: number,
  ): Promise<SceneContext> {
    await this.initialize();

    if (!this.isInitialized) {
      throw new Error("ContextAwareEditingService not initialized");
    }

    try {
      // Analyze image characteristics
      const characteristics = await this.analyzeImageCharacteristics(
        imageData,
        imageWidth,
        imageHeight,
      );

      // Detect faces
      let faces: FaceDetection[] = [];
      if (this.config.enableFaceDetection) {
        faces = await this.faceDetectionService.detectFaces(
          imageData,
          imageWidth,
          imageHeight,
        );
        faces = faces.filter(
          (face) => face.confidence >= this.config.confidenceThresholds.face,
        );
      }

      // Detect objects
      let objects: DetectedObject[] = [];
      if (this.config.enableObjectDetection) {
        objects = await this.detectObjects(imageData, imageWidth, imageHeight);
        objects = objects.filter(
          (obj) => obj.confidence >= this.config.confidenceThresholds.object,
        );
      }

      // Classify scene
      let sceneCategory = SceneCategory.UNKNOWN;
      let sceneConfidence = 0;
      if (this.config.enableSceneClassification) {
        const classification = await this.classifyScene(
          imageData,
          imageWidth,
          imageHeight,
        );
        sceneCategory = classification.category;
        sceneConfidence = classification.confidence;
      }

      // Analyze spatial layout
      const layout = this.analyzeSpatialLayout(objects, faces, characteristics);

      // Generate editing suggestions
      const suggestions = this.generateEditingSuggestions(
        objects,
        faces,
        sceneCategory,
        layout,
      );

      return {
        category: sceneCategory,
        confidence: sceneConfidence,
        objects,
        faces,
        characteristics,
        layout,
        suggestions,
      };
    } catch (error) {
      console.error(
        "ContextAwareEditingService: Context analysis failed:",
        error,
      );
      throw error;
    }
  }

  /**
   * Analyze image characteristics (brightness, contrast, etc.)
   */
  private async analyzeImageCharacteristics(
    imageData: Uint8Array,
    width: number,
    height: number,
  ): Promise<SceneContext["characteristics"]> {
    let totalR = 0,
      totalG = 0,
      totalB = 0;
    let minBrightness = 255,
      maxBrightness = 0;
    const histogram = new Array(256).fill(0);

    // Calculate basic statistics
    for (let i = 0; i < imageData.length; i += 3) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];

      totalR += r;
      totalG += g;
      totalB += b;

      const brightness = (r + g + b) / 3;
      minBrightness = Math.min(minBrightness, brightness);
      maxBrightness = Math.max(maxBrightness, brightness);
      histogram[Math.round(brightness)]++;
    }

    const pixelCount = imageData.length / 3;
    const avgR = totalR / pixelCount;
    const avgG = totalG / pixelCount;
    const avgB = totalB / pixelCount;

    // Calculate metrics
    const brightness = (avgR + avgG + avgB) / 3 / 255;
    const contrast = (maxBrightness - minBrightness) / 255;

    // Calculate saturation (simplified)
    const saturation = this.calculateSaturation(imageData);

    // Calculate sharpness (simplified - edge detection)
    const sharpness = this.calculateSharpness(imageData, width, height);

    // Extract dominant colors
    const dominantColors = this.extractDominantColors(imageData, width, height);
    const colorPalette = dominantColors.map((dc) => dc.color);

    return {
      brightness,
      contrast,
      saturation,
      sharpness,
      colorPalette,
      dominantColors,
    };
  }

  /**
   * Detect objects in the image
   */
  private async detectObjects(
    imageData: Uint8Array,
    width: number,
    height: number,
  ): Promise<DetectedObject[]> {
    if (!this.modelManager.isModelLoaded(this.objectDetectorModel)) {
      return this.getMockObjectDetections(width, height);
    }

    try {
      // Prepare input tensor
      const inputSize = 300;
      const resizedImage = await this.resizeImage(
        imageData,
        width,
        height,
        inputSize,
        inputSize,
      );
      const inputTensor = this.prepareImageTensor(resizedImage);

      // Run inference
      const outputs = await this.modelManager.runInference(
        this.objectDetectorModel,
        [inputTensor],
      );

      // Process outputs
      return this.processObjectDetectionOutputs(outputs, width, height);
    } catch (error) {
      console.warn(
        "ContextAwareEditingService: Object detection failed, using mock:",
        error,
      );
      return this.getMockObjectDetections(width, height);
    }
  }

  /**
   * Classify scene category
   */
  private async classifyScene(
    imageData: Uint8Array,
    width: number,
    height: number,
  ): Promise<{ category: SceneCategory; confidence: number }> {
    if (!this.modelManager.isModelLoaded(this.sceneClassifierModel)) {
      return this.getMockSceneClassification();
    }

    try {
      // Prepare input tensor
      const inputSize = 224;
      const resizedImage = await this.resizeImage(
        imageData,
        width,
        height,
        inputSize,
        inputSize,
      );
      const inputTensor = this.prepareImageTensor(resizedImage);

      // Run inference
      const outputs = await this.modelManager.runInference(
        this.sceneClassifierModel,
        [inputTensor],
      );

      // Process outputs
      return this.processSceneClassificationOutputs(outputs);
    } catch (error) {
      console.warn(
        "ContextAwareEditingService: Scene classification failed, using mock:",
        error,
      );
      return this.getMockSceneClassification();
    }
  }

  /**
   * Analyze spatial layout
   */
  private analyzeSpatialLayout(
    objects: DetectedObject[],
    faces: FaceDetection[],
    characteristics: SceneContext["characteristics"],
  ): SceneContext["layout"] {
    const hasForeground = objects.some(
      (obj) => obj.attributes.position === "foreground",
    );
    const hasBackground = objects.some(
      (obj) => obj.attributes.position === "background",
    );
    const hasSky = objects.some((obj) => obj.category === ObjectCategory.SKY);
    const hasGround = objects.some(
      (obj) => obj.category === ObjectCategory.GROUND,
    );

    // Detect horizon line (simplified)
    const hasHorizon = this.detectHorizonLine(objects, characteristics);

    // Determine perspective (simplified)
    const perspective = this.determinePerspective(objects, faces);

    return {
      hasForeground,
      hasBackground,
      hasSky,
      hasGround,
      hasHorizon,
      perspective,
    };
  }

  /**
   * Generate intelligent editing suggestions
   */
  private generateEditingSuggestions(
    objects: DetectedObject[],
    faces: FaceDetection[],
    sceneCategory: SceneCategory,
    layout: SceneContext["layout"],
  ): EditingSuggestion[] {
    const suggestions: EditingSuggestion[] = [];

    // Suggest removing unwanted objects
    objects.forEach((obj) => {
      if (obj.attributes.importance === "background" && obj.confidence > 0.7) {
        suggestions.push({
          type: "remove",
          target: {
            category: obj.category,
            boundingBox: obj.boundingBox,
          },
          action: `Remove ${obj.category} from background`,
          confidence: obj.confidence * 0.8,
          reason: "Background object may clutter the scene",
        });
      }
    });

    // Suggest enhancing portraits
    if (faces.length > 0 && sceneCategory === SceneCategory.PORTRAIT) {
      faces.forEach((face, index) => {
        if (face.confidence > 0.8) {
          suggestions.push({
            type: "enhance",
            target: {
              category: ObjectCategory.PERSON,
              boundingBox: face.boundingBox,
            },
            action: "Enhance portrait quality",
            confidence: face.confidence * 0.9,
            reason: "High-quality portrait detected",
          });
        }
      });
    }

    // Suggest sky enhancement for outdoor scenes
    if (sceneCategory === SceneCategory.OUTDOOR && layout.hasSky) {
      suggestions.push({
        type: "enhance",
        target: {
          category: ObjectCategory.SKY,
          boundingBox: { x: 0, y: 0, width: 1, height: 0.3 },
        },
        action: "Enhance sky appearance",
        confidence: 0.7,
        reason: "Outdoor scene with sky detected",
      });
    }

    // Sort by confidence
    return suggestions.sort((a, b) => b.confidence - a.confidence).slice(0, 5); // Top 5 suggestions
  }

  // ─── UTILITY METHODS ─────────────────────────────────────

  /**
   * Calculate image saturation
   */
  private calculateSaturation(imageData: Uint8Array): number {
    let totalSaturation = 0;
    let pixelCount = 0;

    for (let i = 0; i < imageData.length; i += 3) {
      const r = imageData[i];
      const g = imageData[i + 1];
      const b = imageData[i + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;

      totalSaturation += saturation;
      pixelCount++;
    }

    return totalSaturation / pixelCount;
  }

  /**
   * Calculate image sharpness (simplified edge detection)
   */
  private calculateSharpness(
    imageData: Uint8Array,
    width: number,
    height: number,
  ): number {
    let edgeCount = 0;
    let totalEdges = 0;

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 3;

        // Simple Sobel edge detection
        const centerGray =
          (imageData[idx] + imageData[idx + 1] + imageData[idx + 2]) / 3;

        const leftIdx = (y * width + (x - 1)) * 3;
        const leftGray =
          (imageData[leftIdx] +
            imageData[leftIdx + 1] +
            imageData[leftIdx + 2]) /
          3;

        if (Math.abs(centerGray - leftGray) > 30) {
          edgeCount++;
        }
        totalEdges++;
      }
    }

    return totalEdges > 0 ? edgeCount / totalEdges : 0;
  }

  /**
   * Extract dominant colors from image
   */
  private extractDominantColors(
    imageData: Uint8Array,
    width: number,
    height: number,
  ): { color: string; percentage: number }[] {
    const colorMap = new Map<string, number>();
    const step = 10; // Sample every 10th pixel for performance

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const idx = (y * width + x) * 3;
        const r = imageData[idx];
        const g = imageData[idx + 1];
        const b = imageData[idx + 2];

        // Quantize colors to reduce variety
        const quantizedR = Math.round(r / 32) * 32;
        const quantizedG = Math.round(g / 32) * 32;
        const quantizedB = Math.round(b / 32) * 32;

        const colorKey = `rgb(${quantizedR},${quantizedG},${quantizedB})`;
        colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
      }
    }

    // Convert to sorted array
    const totalSamples = (width / step) * (height / step);
    const colors = Array.from(colorMap.entries())
      .map(([color, count]) => ({
        color,
        percentage: count / totalSamples,
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 5);

    return colors;
  }

  /**
   * Resize image to target dimensions
   */
  private async resizeImage(
    imageData: Uint8Array,
    srcWidth: number,
    srcHeight: number,
    dstWidth: number,
    dstHeight: number,
  ): Promise<Uint8Array> {
    return new Promise((resolve) => {
      const resized = new Uint8Array(dstWidth * dstHeight * 3);

      for (let y = 0; y < dstHeight; y++) {
        for (let x = 0; x < dstWidth; x++) {
          const srcX = Math.floor((x / dstWidth) * srcWidth);
          const srcY = Math.floor((y / dstHeight) * srcHeight);

          const srcIdx = (srcY * srcWidth + srcX) * 3;
          const dstIdx = (y * dstWidth + x) * 3;

          resized[dstIdx] = imageData[srcIdx];
          resized[dstIdx + 1] = imageData[srcIdx + 1];
          resized[dstIdx + 2] = imageData[srcIdx + 2];
        }
      }

      resolve(resized);
    });
  }

  /**
   * Prepare image tensor for model input
   */
  private prepareImageTensor(imageData: Uint8Array): Uint8Array {
    // Normalize to [0, 1] and convert to model format
    const tensor = new Uint8Array(imageData.length);
    for (let i = 0; i < imageData.length; i++) {
      tensor[i] = imageData[i]; // Already in 0-255 range
    }
    return tensor;
  }

  /**
   * Process object detection outputs
   */
  private processObjectDetectionOutputs(
    outputs: any[],
    imageWidth: number,
    imageHeight: number,
  ): DetectedObject[] {
    // Mock implementation - would process actual model outputs
    return this.getMockObjectDetections(imageWidth, imageHeight);
  }

  /**
   * Process scene classification outputs
   */
  private processSceneClassificationOutputs(outputs: any[]): {
    category: SceneCategory;
    confidence: number;
  } {
    // Mock implementation - would process actual model outputs
    return this.getMockSceneClassification();
  }

  /**
   * Detect horizon line (simplified)
   */
  private detectHorizonLine(
    objects: DetectedObject[],
    characteristics: SceneContext["characteristics"],
  ): boolean {
    // Simple heuristic: if we have sky and ground objects, likely has horizon
    const hasSky = objects.some((obj) => obj.category === ObjectCategory.SKY);
    const hasGround = objects.some(
      (obj) => obj.category === ObjectCategory.GROUND,
    );
    return hasSky && hasGround;
  }

  /**
   * Determine image perspective
   */
  private determinePerspective(
    objects: DetectedObject[],
    faces: FaceDetection[],
  ): "eye-level" | "high-angle" | "low-angle" | "flat" {
    // Simplified perspective detection based on face positions
    if (faces.length === 0) return "eye-level";

    const avgFaceY =
      faces.reduce((sum, face) => sum + face.boundingBox.y, 0) / faces.length;

    if (avgFaceY < 0.3) return "low-angle";
    if (avgFaceY > 0.7) return "high-angle";
    return "eye-level";
  }

  // ─── MOCK IMPLEMENTATIONS ───────────────────────────────

  /**
   * Get mock object detections for testing
   */
  private getMockObjectDetections(
    width: number,
    height: number,
  ): DetectedObject[] {
    return [
      {
        category: ObjectCategory.PERSON,
        confidence: 0.85,
        boundingBox: { x: 0.3, y: 0.2, width: 0.4, height: 0.6 },
        attributes: {
          size: "medium",
          position: "foreground",
          importance: "primary",
        },
      },
      {
        category: ObjectCategory.SKY,
        confidence: 0.9,
        boundingBox: { x: 0, y: 0, width: 1, height: 0.3 },
        attributes: {
          size: "large",
          position: "background",
          importance: "background",
        },
      },
      {
        category: ObjectCategory.GROUND,
        confidence: 0.8,
        boundingBox: { x: 0, y: 0.7, width: 1, height: 0.3 },
        attributes: {
          size: "large",
          position: "background",
          importance: "background",
        },
      },
    ];
  }

  /**
   * Get mock scene classification
   */
  private getMockSceneClassification(): {
    category: SceneCategory;
    confidence: number;
  } {
    return {
      category: SceneCategory.OUTDOOR,
      confidence: 0.75,
    };
  }

  // ─── PUBLIC API ───────────────────────────────────────────

  /**
   * Get current configuration
   */
  getConfig(): ContextAwareConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ContextAwareConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}

// ─────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────

let contextAwareInstance: ContextAwareEditingService | null = null;

/**
 * Get singleton instance of ContextAwareEditingService
 */
export function getContextAwareEditingService(
  config?: Partial<ContextAwareConfig>,
): ContextAwareEditingService {
  if (!contextAwareInstance) {
    contextAwareInstance = new ContextAwareEditingService(config);
  }
  return contextAwareInstance;
}

/**
 * Cleanup singleton instance
 */
export async function cleanupContextAwareEditingService(): Promise<void> {
  if (contextAwareInstance) {
    await contextAwareInstance.cleanup();
    contextAwareInstance = null;
  }
}

/**
 * Reset singleton instance (testing only)
 */
export function resetContextAwareEditingServiceForTesting(): void {
  contextAwareInstance = null;
}
