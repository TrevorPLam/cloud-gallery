// AI-META-BEGIN
// AI-META: Image preprocessing utilities for ML models with expo-image-manipulator integration
// OWNERSHIP: client/lib/ml
// ENTRYPOINTS: imported by photo-analyzer.ts for ML preprocessing
// DEPENDENCIES: expo-image-manipulator, expo-file-system
// DANGER: Image processing requires proper memory management and error handling
// CHANGE-SAFETY: Add new preprocessing functions by extending the PreprocessingResult interface
// TESTS: client/lib/ml/image-preprocessing.test.ts
// AI-META-END

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface PreprocessingResult {
  tensor: Float32Array;
  width: number;
  height: number;
  channels: number;
  processingTime: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  size: number;
}

// ─────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────

// MobileNet normalization parameters
export const MOBILENET_NORMALIZATION = {
  MEAN: [127.5, 127.5, 127.5], // For [-1, 1] normalization
  SCALE: 127.5, // For [-1, 1] normalization
} as const;

// Supported model input sizes
export const MODEL_INPUT_SIZES = {
  MOBILENET_V3_SMALL: 192,
  MOBILENET_V3_LARGE: 224,
  MOBILENET_V2: 224,
} as const;

// ─────────────────────────────────────────────────────────
// MAIN PREPROCESSING FUNCTIONS
// ─────────────────────────────────────────────────────────

/**
 * Preprocess image for MobileNet models using expo-image-manipulator
 * Resizes image and converts to normalized RGB Float32Array tensor
 * 
 * @param uri - Image URI (file://, base64:, or content://)
 * @param targetSize - Target size for resizing (width=height)
 * @param normalization - Normalization method ('[-1,1]' or '[0,1]')
 * @returns PreprocessingResult with tensor data and metadata
 */
export async function preprocessImageForModel(
  uri: string,
  targetSize: number = MODEL_INPUT_SIZES.MOBILENET_V3_SMALL,
  normalization: '[-1,1]' | '[0,1]' = '[-1,1]'
): Promise<PreprocessingResult> {
  const startTime = Date.now();

  try {
    // Step 1: Get image metadata
    const metadata = await getImageMetadata(uri);
    
    // Step 2: Resize image to target size
    const resizedImage = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: targetSize, height: targetSize } }],
      {
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
        compress: 0.9, // High quality for ML processing
      }
    );

    if (!resizedImage.base64) {
      throw new Error('Failed to get base64 image data from ImageManipulator');
    }

    // Step 3: Convert base64 to Uint8Array
    const imageBytes = base64ToUint8Array(resizedImage.base64);
    
    // Step 4: Convert to Float32Array tensor with normalization
    const tensor = convertImageBytesToTensor(
      imageBytes,
      targetSize,
      targetSize,
      normalization
    );

    const processingTime = Date.now() - startTime;

    return {
      tensor,
      width: targetSize,
      height: targetSize,
      channels: 3,
      processingTime,
    };
  } catch (error) {
    console.error('Image preprocessing failed:', error);
    throw new Error(`Image preprocessing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get image metadata without loading full image
 * Useful for validation and optimization
 */
export async function getImageMetadata(uri: string): Promise<ImageMetadata> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    
    if (!info.exists) {
      throw new Error(`Image file does not exist: ${uri}`);
    }

    return {
      width: 0, // Will be determined after manipulation
      height: 0, // Will be determined after manipulation
      format: uri.split('.').pop()?.toLowerCase() || 'unknown',
      size: info.size || 0,
    };
  } catch (error) {
    throw new Error(`Failed to get image metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convert image bytes to normalized Float32Array tensor
 * Handles both [-1, 1] and [0, 1] normalization schemes
 */
function convertImageBytesToTensor(
  imageBytes: Uint8Array,
  width: number,
  height: number,
  normalization: '[-1,1]' | '[0,1]'
): Float32Array {
  const tensorSize = width * height * 3;
  const tensor = new Float32Array(tensorSize);

  // Convert RGB bytes to normalized float values
  for (let i = 0, j = 0; i < imageBytes.length && j < tensorSize; i += 4, j += 3) {
    // Extract RGB values (skip alpha channel if present)
    const r = imageBytes[i] || 0;
    const g = imageBytes[i + 1] || 0;
    const b = imageBytes[i + 2] || 0;

    if (normalization === '[-1,1]') {
      // MobileNet-style normalization: (pixel - 127.5) / 127.5
      tensor[j] = (r - MOBILENET_NORMALIZATION.MEAN[0]) / MOBILENET_NORMALIZATION.SCALE;
      tensor[j + 1] = (g - MOBILENET_NORMALIZATION.MEAN[1]) / MOBILENET_NORMALIZATION.SCALE;
      tensor[j + 2] = (b - MOBILENET_NORMALIZATION.MEAN[2]) / MOBILENET_NORMALIZATION.SCALE;
    } else {
      // Standard [0, 1] normalization
      tensor[j] = r / 255.0;
      tensor[j + 1] = g / 255.0;
      tensor[j + 2] = b / 255.0;
    }
  }

  return tensor;
}

/**
 * Convert base64 string to Uint8Array
 * Handles both regular and URL-safe base64 variants
 */
function base64ToUint8Array(base64: string): Uint8Array {
  // Remove data URL prefix if present
  const cleanBase64 = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  
  // Pad base64 string if necessary
  const paddedBase64 = cleanBase64.padEnd(Math.ceil(cleanBase64.length / 4) * 4, '=');
  
  try {
    const binaryString = atob(paddedBase64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  } catch (error) {
    throw new Error(`Failed to decode base64 image data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// ─────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────

/**
 * Validate tensor dimensions and values
 * Useful for debugging and testing
 */
export function validateTensor(
  tensor: Float32Array,
  expectedSize: number,
  channels: number = 3
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check tensor size
  const expectedTensorSize = expectedSize * expectedSize * channels;
  if (tensor.length !== expectedTensorSize) {
    errors.push(`Tensor size mismatch: expected ${expectedTensorSize}, got ${tensor.length}`);
  }
  
  // Check for NaN or Infinity values
  for (let i = 0; i < Math.min(tensor.length, 100); i++) {
    const value = tensor[i];
    if (!isFinite(value)) {
      errors.push(`Invalid tensor value at index ${i}: ${value}`);
      break;
    }
  }
  
  // Check value ranges based on normalization
  const minVal = Math.min(...tensor);
  const maxVal = Math.max(...tensor);
  
  if (minVal < -1.1 || maxVal > 1.1) {
    errors.push(`Tensor values outside expected range [-1, 1]: min=${minVal}, max=${maxVal}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get tensor statistics for debugging
 */
export function getTensorStats(tensor: Float32Array): {
  min: number;
  max: number;
  mean: number;
  std: number;
  size: number;
} {
  const size = tensor.length;
  let sum = 0;
  let sumSquares = 0;
  let min = Infinity;
  let max = -Infinity;
  
  for (let i = 0; i < size; i++) {
    const value = tensor[i];
    sum += value;
    sumSquares += value * value;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  
  const mean = sum / size;
  const variance = (sumSquares / size) - (mean * mean);
  const std = Math.sqrt(Math.max(0, variance));
  
  return { min, max, mean, std, size };
}

/**
 * Batch preprocessing for multiple images
 * Optimized for performance with parallel processing
 */
export async function batchPreprocessImages(
  uris: string[],
  targetSize: number = MODEL_INPUT_SIZES.MOBILENET_V3_SMALL,
  normalization: '[-1,1]' | '[0,1]' = '[-1,1]'
): Promise<PreprocessingResult[]> {
  const batchSize = Math.min(uris.length, 5); // Process up to 5 images in parallel
  const results: PreprocessingResult[] = [];
  
  for (let i = 0; i < uris.length; i += batchSize) {
    const batch = uris.slice(i, i + batchSize);
    const batchPromises = batch.map(uri => 
      preprocessImageForModel(uri, targetSize, normalization)
    );
    
    try {
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    } catch (error) {
      console.error(`Batch preprocessing failed at index ${i}:`, error);
      throw error;
    }
  }
  
  return results;
}

// ─────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────

export default {
  preprocessImageForModel,
  getImageMetadata,
  validateTensor,
  getTensorStats,
  batchPreprocessImages,
  MOBILENET_NORMALIZATION,
  MODEL_INPUT_SIZES,
};
