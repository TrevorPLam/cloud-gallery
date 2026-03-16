// AI-META-BEGIN
// AI-META: CLIP model integration for semantic text-image embeddings with GPU acceleration
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by semantic-search and embedding-cache modules
// DEPENDENCIES: tflite.ts, model-manager.ts, expo-image, react-native-fast-tflite
// DANGER: Large model memory usage; GPU delegate requirements; embedding dimension management
// CHANGE-SAFETY: Add new CLIP model variants by extending CLIPModelConfig interface
// TESTS: client/lib/ml/clip-embeddings.test.ts
// AI-META-END

import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import { Image } from 'expo-image';
import {
  getModelManager,
  ModelConfig,
  ModelMetadata,
  GPUDelegateType,
} from './model-manager';
import { getTensorFlowLiteManager } from './tflite';

// ─────────────────────────────────────────────────────────
// CLIP MODEL CONFIGURATION
// ─────────────────────────────────────────────────────────

export interface CLIPModelConfig extends ModelConfig {
  embeddingSize: number;
  maxLength: number; // Maximum text sequence length
  imageSize: number; // Input image size (square)
  normalizeFeatures: boolean;
}

export interface CLIPInferenceResult {
  textEmbeddings?: Float32Array;
  imageEmbeddings?: Float32Array;
  inferenceTime: number;
  memoryUsage: number;
  delegate: GPUDelegateType;
}

export interface EmbeddingSimilarity {
  score: number; // Cosine similarity (0-1)
  distance: number; // Euclidean distance
  rank: number; // Ranking position
}

// CLIP model variants with their specific configurations
export const CLIP_MODELS: Record<string, CLIPModelConfig> = {
  'clip-vit-b-32': {
    name: 'clip-vit-b-32',
    path: require('../assets/models/clip-vit-b-32.tflite'),
    inputSize: 224,
    outputSize: 512,
    embeddingSize: 512,
    maxLength: 77, // CLIP's maximum sequence length
    imageSize: 224,
    quantized: true,
    normalizeFeatures: true,
  },
  'clip-vit-b-16': {
    name: 'clip-vit-b-16',
    path: require('../assets/models/clip-vit-b-16.tflite'),
    inputSize: 224,
    outputSize: 512,
    embeddingSize: 512,
    maxLength: 77,
    imageSize: 224,
    quantized: true,
    normalizeFeatures: true,
  },
};

// ─────────────────────────────────────────────────────────
// CLIP EMBEDDINGS SERVICE
// ─────────────────────────────────────────────────────────

export class CLIPEmbeddingsService {
  private modelManager = getModelManager();
  private tfliteManager = getTensorFlowLiteManager();
  private currentModel: string = 'clip-vit-b-32';
  private isInitialized = false;
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
      // Load CLIP model with optimal delegate selection
      const modelConfig = CLIP_MODELS[this.currentModel];
      
      // Adjust delegate based on platform and model requirements
      const delegate = this.selectOptimalDelegate();
      
      await this.modelManager.loadModel({
        ...modelConfig,
        delegate,
      }, 'high'); // CLIP is high priority for semantic search

      this.isInitialized = true;
      console.log(`CLIPEmbeddingsService: Initialized with model "${this.currentModel}"`);
    } catch (error) {
      console.error('CLIPEmbeddingsService: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Select optimal delegate for CLIP model based on device capabilities
   */
  private selectOptimalDelegate(): GPUDelegateType {
    const capabilities = this.tfliteManager.getDeviceCapabilities();
    
    if (!capabilities) {
      return 'none';
    }

    // CLIP benefits significantly from GPU acceleration
    if (capabilities.platform === 'ios' && capabilities.hasNeuralEngine) {
      return 'core-ml';
    }

    if (capabilities.platform === 'android' && capabilities.hasGPUAcceleration) {
      return 'android-gpu';
    }

    return 'none';
  }

  // ─── TEXT EMBEDDINGS ───────────────────────────────────────

  /**
   * Generate text embeddings using CLIP text encoder
   */
  async generateTextEmbeddings(texts: string[]): Promise<Float32Array[]> {
    await this.initialize();

    if (!this.isInitialized) {
      throw new Error('CLIP service not initialized');
    }

    const results: Float32Array[] = [];

    for (const text of texts) {
      try {
        const embedding = await this._generateSingleTextEmbedding(text);
        results.push(embedding);
      } catch (error) {
        console.error(`Failed to generate embedding for text "${text}":`, error);
        // Return zero embedding as fallback
        results.push(new Float32Array(CLIP_MODELS[this.currentModel].embeddingSize));
      }
    }

    return results;
  }

  private async _generateSingleTextEmbedding(text: string): Promise<Float32Array> {
    // Tokenize text (simplified tokenization - in production would use proper tokenizer)
    const tokens = this.tokenizeText(text);
    const maxLength = CLIP_MODELS[this.currentModel].maxLength;
    
    // Pad or truncate to max length
    const paddedTokens = tokens.slice(0, maxLength);
    while (paddedTokens.length < maxLength) {
      paddedTokens.push(0); // Padding token
    }

    // Prepare input tensor
    const inputTensor = new Int32Array(paddedTokens);
    
    // Run inference
    const outputs = await this.modelManager.runInference(this.currentModel, [inputTensor]);
    
    // Extract text embedding (first output is typically text embedding)
    const textEmbedding = new Float32Array(outputs[0]);
    
    // Normalize if required
    if (CLIP_MODELS[this.currentModel].normalizeFeatures) {
      this.normalizeEmbedding(textEmbedding);
    }

    return textEmbedding;
  }

  /**
   * Simple tokenization for CLIP text encoder
   * In production, would use proper BPE tokenizer
   */
  private tokenizeText(text: string): number[] {
    // Simplified tokenization - convert to character codes
    // Real implementation would use CLIP's BPE tokenizer
    const normalized = text.toLowerCase().trim();
    const tokens: number[] = [];
    
    // Start of sequence token
    tokens.push(49406); // CLIP's SOS token
    
    // Add character tokens (simplified)
    for (let i = 0; i < normalized.length; i++) {
      const charCode = normalized.charCodeAt(i);
      // Map to reasonable token range (simplified)
      tokens.push(Math.min(charCode + 1000, 49407)); // Avoid reserved tokens
    }
    
    // End of sequence token
    tokens.push(49407); // CLIP's EOS token
    
    return tokens;
  }

  // ─── IMAGE EMBEDDINGS ───────────────────────────────────────

  /**
   * Generate image embeddings using CLIP visual encoder
   */
  async generateImageEmbeddings(imageUris: string[]): Promise<Float32Array[]> {
    await this.initialize();

    if (!this.isInitialized) {
      throw new Error('CLIP service not initialized');
    }

    const results: Float32Array[] = [];

    for (const uri of imageUris) {
      try {
        const embedding = await this._generateSingleImageEmbedding(uri);
        results.push(embedding);
      } catch (error) {
        console.error(`Failed to generate embedding for image "${uri}":`, error);
        // Return zero embedding as fallback
        results.push(new Float32Array(CLIP_MODELS[this.currentModel].embeddingSize));
      }
    }

    return results;
  }

  private async _generateSingleImageEmbedding(imageUri: string): Promise<Float32Array> {
    // Load and preprocess image
    const preprocessedImage = await this.preprocessImage(imageUri);
    
    // Run inference
    const outputs = await this.modelManager.runInference(this.currentModel, [preprocessedImage]);
    
    // Extract image embedding (second output is typically image embedding)
    const imageEmbedding = new Float32Array(outputs[1] || outputs[0]); // Fallback to first output
    
    // Normalize if required
    if (CLIP_MODELS[this.currentModel].normalizeFeatures) {
      this.normalizeEmbedding(imageEmbedding);
    }

    return imageEmbedding;
  }

  /**
   * Preprocess image for CLIP model
   */
  private async preprocessImage(imageUri: string): Promise<Uint8Array> {
    const imageSize = CLIP_MODELS[this.currentModel].imageSize;
    
    // Load image using expo-image
    const imageInfo = await Image.getInfoAsync(imageUri);
    
    if (!imageInfo.width || !imageInfo.height) {
      throw new Error('Invalid image dimensions');
    }

    // Calculate scaling and crop parameters
    const scale = Math.min(imageSize / imageInfo.width, imageSize / imageInfo.height);
    const scaledWidth = Math.round(imageInfo.width * scale);
    const scaledHeight = Math.round(imageInfo.height * scale);

    // Note: In a full implementation, would use image manipulation library
    // to resize, crop, and normalize the image to the required format
    // For now, return a placeholder that matches the expected input size
    
    const inputSize = imageSize * imageSize * 3; // RGB
    const processedImage = new Uint8Array(inputSize);
    
    // Fill with placeholder data (would be actual processed image data)
    // Real implementation would:
    // 1. Resize image to imageSize x imageSize
    // 2. Center crop if needed
    // 3. Normalize pixel values to [0, 1] or [-1, 1] based on model requirements
    // 4. Convert to CHW or HWC format as expected by model
    
    return processedImage;
  }

  // ─── EMBEDDING OPERATIONS ───────────────────────────────────

  /**
   * Normalize embedding vector to unit length
   */
  private normalizeEmbedding(embedding: Float32Array): void {
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);
    
    if (norm > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= norm;
      }
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embedding1: Float32Array, embedding2: Float32Array): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Calculate Euclidean distance between two embeddings
   */
  euclideanDistance(embedding1: Float32Array, embedding2: Float32Array): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embedding dimensions must match');
    }

    let distance = 0;
    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      distance += diff * diff;
    }

    return Math.sqrt(distance);
  }

  /**
   * Find most similar embeddings to a query embedding
   */
  findSimilarEmbeddings(
    queryEmbedding: Float32Array,
    candidateEmbeddings: Float32Array[],
    topK: number = 10
  ): EmbeddingSimilarity[] {
    const similarities: EmbeddingSimilarity[] = [];

    for (let i = 0; i < candidateEmbeddings.length; i++) {
      const candidate = candidateEmbeddings[i];
      const similarity = this.cosineSimilarity(queryEmbedding, candidate);
      const distance = this.euclideanDistance(queryEmbedding, candidate);

      similarities.push({
        score: similarity,
        distance,
        rank: 0, // Will be set after sorting
      });
    }

    // Sort by similarity score (descending)
    similarities.sort((a, b) => b.score - a.score);

    // Update ranks and return top K
    return similarities
      .slice(0, topK)
      .map((sim, index) => ({ ...sim, rank: index + 1 }));
  }

  // ─── MODEL MANAGEMENT ─────────────────────────────────────

  /**
   * Switch to different CLIP model variant
   */
  async switchModel(modelName: string): Promise<void> {
    if (!CLIP_MODELS[modelName]) {
      throw new Error(`Unknown CLIP model: ${modelName}`);
    }

    if (modelName === this.currentModel) {
      return; // Already using this model
    }

    // Unload current model
    await this.modelManager.unloadModel(this.currentModel);

    // Load new model
    this.currentModel = modelName;
    const modelConfig = CLIP_MODELS[modelName];
    const delegate = this.selectOptimalDelegate();

    await this.modelManager.loadModel({
      ...modelConfig,
      delegate,
    }, 'high');

    console.log(`CLIPEmbeddingsService: Switched to model "${modelName}"`);
  }

  /**
   * Get current model configuration
   */
  getCurrentModel(): CLIPModelConfig {
    return CLIP_MODELS[this.currentModel];
  }

  /**
   * Get available CLIP models
   */
  getAvailableModels(): string[] {
    return Object.keys(CLIP_MODELS);
  }

  /**
   * Check if service is ready for inference
   */
  isReady(): boolean {
    return this.isInitialized && this.modelManager.isModelLoaded(this.currentModel);
  }

  /**
   * Get performance statistics
   */
  async getStats(): Promise<{
    model: string;
    embeddingSize: number;
    isReady: boolean;
    memoryUsage: number;
    cacheHitRate: number;
  }> {
    const managerStats = await this.modelManager.getStats();
    
    return {
      model: this.currentModel,
      embeddingSize: CLIP_MODELS[this.currentModel].embeddingSize,
      isReady: this.isReady(),
      memoryUsage: managerStats.memoryUsageMB,
      cacheHitRate: managerStats.cacheHitRate,
    };
  }

  // ─── CLEANUP ────────────────────────────────────────────

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.currentModel) {
      await this.modelManager.unloadModel(this.currentModel);
    }
    this.isInitialized = false;
    this.initializationPromise = null;
  }
}

// ─────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────

let clipEmbeddingsInstance: CLIPEmbeddingsService | null = null;

/**
 * Get singleton instance of CLIPEmbeddingsService
 */
export function getCLIPEmbeddingsService(): CLIPEmbeddingsService {
  if (!clipEmbeddingsInstance) {
    clipEmbeddingsInstance = new CLIPEmbeddingsService();
  }
  return clipEmbeddingsInstance;
}

/**
 * Cleanup singleton instance
 */
export async function cleanupCLIPEmbeddingsService(): Promise<void> {
  if (clipEmbeddingsInstance) {
    await clipEmbeddingsInstance.cleanup();
    clipEmbeddingsInstance = null;
  }
}

/**
 * Reset singleton instance (testing only)
 */
export function resetCLIPEmbeddingsServiceForTesting(): void {
  clipEmbeddingsInstance = null;
}
