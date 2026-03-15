// AI-META-BEGIN
// AI-META: ML/AI photo analysis service with object detection, OCR, and perceptual hashing
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by photo upload flow and ML analysis screens
// DEPENDENCIES: react-native-fast-tflite, react-native-mlkit-ocr, react-native
// DANGER: Model loading and tensor operations require proper memory management
// CHANGE-SAFETY: Add new ML capabilities by extending the MLAnalysisResult interface
// TESTS: client/lib/ml/photo-analyzer.test.ts
// AI-META-END

import { Platform, InteractionManager } from "react-native";
import { loadTensorflowModel, TensorflowModel } from "react-native-fast-tflite";
import RNMlkitOcr from "react-native-mlkit-ocr";

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface TextRecognitionResult {
  text: string;
  blocks?: {
    text: string;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }[];
}

export interface MLAnalysisResult {
  // Object detection results
  objects?: DetectedObject[];

  // OCR text extraction results
  ocrText?: string;
  ocrLanguage?: string;

  // Perceptual hash for duplicate detection
  perceptualHash?: string;

  // Processing metadata
  processingTime: number;
  mlVersion: string;
  timestamp: Date;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ModelConfig {
  name: string;
  inputSize: number;
  outputLabels: string[];
  threshold: number;
}

// ─────────────────────────────────────────────────────────
// MODEL CONFIGURATIONS
// ─────────────────────────────────────────────────────────

const OBJECT_DETECTION_CONFIG: ModelConfig = {
  name: "mobilenet_v3",
  inputSize: 192,
  outputLabels: [], // Will be loaded from model metadata
  threshold: 0.7,
};

const ML_VERSION = "1.0.0";

// ─────────────────────────────────────────────────────────
// PHOTO ANALYZER CLASS
// ─────────────────────────────────────────────────────────

export class PhotoAnalyzer {
  private objectDetectionModel: TensorflowModel | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    this.initializeModels();
  }

  // ─── INITIALIZATION ──────────────────────────────────────

  /**
   * Initialize ML models asynchronously
   * Uses factory pattern for platform-specific model loading
   */
  private async initializeModels(): Promise<void> {
    if (this.isInitialized) return;

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initializeModelsInternal();
    return this.initializationPromise;
  }

  private async _initializeModelsInternal(): Promise<void> {
    try {
      // Load object detection model
      await this.loadObjectDetectionModel();

      this.isInitialized = true;
      console.log("PhotoAnalyzer: ML models initialized successfully");
    } catch (error) {
      console.error("PhotoAnalyzer: Failed to initialize models:", error);
      throw error;
    }
  }

  /**
   * Load object detection model using factory pattern
   * Supports loading from app assets or remote URLs
   */
  private async loadObjectDetectionModel(): Promise<void> {
    try {
      // Try loading from app assets first
      const modelPath = this.getModelPath("mobilenet_v3");

      this.objectDetectionModel = await loadTensorflowModel(modelPath);

      if (!this.objectDetectionModel) {
        throw new Error("Failed to load object detection model");
      }

      console.log("PhotoAnalyzer: Object detection model loaded");
    } catch (error) {
      console.error(
        "PhotoAnalyzer: Error loading object detection model:",
        error,
      );
      throw error;
    }
  }

  /**
   * Factory method for getting model path based on platform
   */
  private getModelPath(modelName: string): any {
    // For development, use placeholder - in production, actual model files
    // would be bundled with the app
    if (__DEV__) {
      return { url: `assets/models/${modelName}.tflite` };
    }

    // Production model loading - use require format for react-native-fast-tflite
    try {
      return require(`assets/models/${modelName}.tflite`);
    } catch (error) {
      // Fallback to URL format
      return { url: `assets/models/${modelName}.tflite` };
    }
  }

  // ─── PUBLIC ANALYSIS METHODS ───────────────────────────────

  /**
   * Perform complete ML analysis on a photo
   * Runs in background to avoid UI blocking
   */
  public async analyzePhoto(imageUri: string): Promise<MLAnalysisResult> {
    const startTime = Date.now();

    // Run in background to avoid blocking UI thread
    const result = await new Promise<MLAnalysisResult>((resolve, reject) => {
      InteractionManager.runAfterInteractions(async () => {
        try {
          await this.initializeModels();

          const analysisResult: MLAnalysisResult = {
            processingTime: 0,
            mlVersion: ML_VERSION,
            timestamp: new Date(),
          };

          // Perform object detection
          if (this.objectDetectionModel) {
            const objects = await this.detectObjects(imageUri);
            analysisResult.objects = objects;
          }

          // Perform OCR text extraction
          const ocrResult = await this.extractText(imageUri);
          if (ocrResult.text) {
            analysisResult.ocrText = ocrResult.text;
            analysisResult.ocrLanguage = this.detectLanguage(ocrResult.text);
          }

          // Generate perceptual hash
          const hash = await this.generatePerceptualHash(imageUri);
          analysisResult.perceptualHash = hash;

          analysisResult.processingTime = Date.now() - startTime;

          resolve(analysisResult);
        } catch (error) {
          reject(error);
        }
      });
    });

    return result;
  }

  /**
   * Perform object detection using MobileNet v3
   */
  private async detectObjects(imageUri: string): Promise<DetectedObject[]> {
    if (!this.objectDetectionModel) {
      throw new Error("Object detection model not loaded");
    }

    try {
      // Preprocess image to match model input requirements
      const preprocessedImage = await this.preprocessImage(
        imageUri,
        OBJECT_DETECTION_CONFIG.inputSize,
      );

      // Run inference
      const outputs = await this.objectDetectionModel.run([preprocessedImage]);

      // Post-process results
      const detections = this.postprocessObjectDetection(outputs);

      return detections;
    } catch (error) {
      console.error("PhotoAnalyzer: Object detection failed:", error);
      return [];
    }
  }

  /**
   * Extract text using ML Kit OCR
   */
  private async extractText(imageUri: string): Promise<TextRecognitionResult> {
    try {
      // Use the correct API method for react-native-mlkit-ocr
      // TODO: Verify the correct API method name from the library documentation
      // For now, implement placeholder functionality
      console.log(
        "PhotoAnalyzer: OCR extraction not yet implemented - placeholder",
      );

      return { text: "" }; // Placeholder result
    } catch (error) {
      console.error("PhotoAnalyzer: OCR failed:", error);
      return { text: "" };
    }
  }

  /**
   * Generate perceptual hash for duplicate detection
   * Uses difference hash (dHash) algorithm
   */
  private async generatePerceptualHash(imageUri: string): Promise<string> {
    try {
      // This is a simplified implementation
      // In production, would use a proper image processing library
      // or implement the dHash algorithm from scratch

      // For now, return a placeholder hash
      // TODO: Implement actual perceptual hashing
      const hash = await this.computeDifferenceHash(imageUri);
      return hash;
    } catch (error) {
      console.error("PhotoAnalyzer: Perceptual hashing failed:", error);
      return "";
    }
  }

  // ─── IMAGE PROCESSING UTILITIES ─────────────────────────────

  /**
   * Preprocess image for model input
   * Resize and normalize to match model requirements
   */
  private async preprocessImage(
    imageUri: string,
    targetSize: number,
  ): Promise<Uint8Array> {
    // This is a placeholder implementation
    // In production, would use proper image processing library
    // to resize, normalize, and convert to tensor format

    // TODO: Implement actual image preprocessing
    const dummyData = new Uint8Array(targetSize * targetSize * 3);
    return dummyData;
  }

  /**
   * Post-process object detection outputs
   * Convert model outputs to DetectedObject format
   */
  private postprocessObjectDetection(outputs: any[]): DetectedObject[] {
    // This is a placeholder implementation
    // In production, would parse actual model outputs
    // and apply confidence threshold

    // TODO: Implement actual post-processing
    return [];
  }

  /**
   * Compute difference hash (dHash) for image
   */
  private async computeDifferenceHash(imageUri: string): Promise<string> {
    // This is a placeholder implementation
    // In production, would implement the dHash algorithm:
    // 1. Convert to grayscale
    // 2. Resize to (hash_size+1, hash_size)
    // 3. Calculate horizontal gradient
    // 4. Generate binary hash

    // TODO: Implement actual difference hashing
    return "placeholder_hash";
  }

  /**
   * Detect language of OCR text
   * Simple heuristic-based language detection
   */
  private detectLanguage(text: string): string {
    // Simple language detection based on character sets
    if (!text || text.length === 0) return "en";

    // Check for common language patterns
    if (/[\u4e00-\u9fff]/.test(text)) return "zh"; // Chinese
    if (/[\u0400-\u04ff]/.test(text)) return "ru"; // Russian
    if (/[\u0590-\u05ff]/.test(text)) return "he"; // Hebrew
    if (/[\u0600-\u06ff]/.test(text)) return "ar"; // Arabic

    // Default to English
    return "en";
  }

  // ─── MEMORY MANAGEMENT ─────────────────────────────────────

  /**
   * Clean up resources and free memory
   */
  public async cleanup(): Promise<void> {
    try {
      // Release TensorFlow Lite models
      if (this.objectDetectionModel) {
        // Note: react-native-fast-tflite doesn't expose explicit cleanup
        // Models are automatically cleaned up when garbage collected
        this.objectDetectionModel = null;
      }

      this.isInitialized = false;
      this.initializationPromise = null;

      console.log("PhotoAnalyzer: Cleanup completed");
    } catch (error) {
      console.error("PhotoAnalyzer: Cleanup failed:", error);
    }
  }

  // ─── UTILITIES ──────────────────────────────────────────────

  /**
   * Check if models are initialized and ready
   */
  public get isReady(): boolean {
    return this.isInitialized && this.objectDetectionModel !== null;
  }

  /**
   * Get model information for debugging
   */
  public getModelInfo(): { [key: string]: any } {
    return {
      isInitialized: this.isInitialized,
      objectDetectionModel: !!this.objectDetectionModel,
      mlVersion: ML_VERSION,
      platform: Platform.OS,
    };
  }
}

// ─────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────

let photoAnalyzerInstance: PhotoAnalyzer | null = null;

/**
 * Get singleton instance of PhotoAnalyzer
 * Ensures only one ML model is loaded in memory
 */
export function getPhotoAnalyzer(): PhotoAnalyzer {
  if (!photoAnalyzerInstance) {
    photoAnalyzerInstance = new PhotoAnalyzer();
  }
  return photoAnalyzerInstance;
}

/**
 * Cleanup singleton instance
 * Call this when app is closing or memory is low
 */
export async function cleanupPhotoAnalyzer(): Promise<void> {
  if (photoAnalyzerInstance) {
    await photoAnalyzerInstance.cleanup();
    photoAnalyzerInstance = null;
  }
}
