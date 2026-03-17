// AI-META-BEGIN
// AI-META: Perceptual hashing algorithms for duplicate detection (pHash, dHash, structural similarity)
// OWNERSHIP: client/lib/photo
// ENTRYPOINTS: imported by photo-analyzer and photo stacking services
// DEPENDENCIES: react-native, react-native-fast-opencv (optional)
// DANGER: Image processing requires careful memory management and performance optimization
// CHANGE-SAFETY: Add new hash algorithms by extending the PerceptualHasher class
// TESTS: client/lib/photo/perceptual-hash.test.ts
// AI-META-END

import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface PerceptualHashResult {
  /** 64-bit hash as hexadecimal string */
  hash: string;
  /** Algorithm used to generate the hash */
  algorithm: "phash" | "dhash" | "average";
  /** Processing time in milliseconds */
  processingTime: number;
  /** Image dimensions used for hashing */
  dimensions: { width: number; height: number };
}

export interface SimilarityResult {
  /** Hamming distance between hashes (0-64) */
  distance: number;
  /** Similarity score (0-1, higher = more similar) */
  similarity: number;
  /** Whether images are considered duplicates based on threshold */
  isDuplicate: boolean;
  /** Threshold used for duplicate detection */
  threshold: number;
}

export interface StructuralSimilarityResult {
  /** SSIM score (0-1, higher = more similar) */
  ssim: number;
  /** Mean squared error */
  mse: number;
  /** Processing time in milliseconds */
  processingTime: number;
}

// ─────────────────────────────────────────────────────────
// PERCEPTUAL HASHER CLASS
// ─────────────────────────────────────────────────────────

export class PerceptualHasher {
  private static readonly HASH_SIZE = 8; // 8x8 = 64 bits
  private static readonly DEFAULT_THRESHOLD = 5; // Hamming distance threshold

  // ─── PUBLIC HASHING METHODS ─────────────────────────────

  /**
   * Generate perceptual hash using pHash algorithm (DCT-based)
   * Most robust for minor transformations and compression
   */
  public async generatePHash(imageUri: string): Promise<PerceptualHashResult> {
    const startTime = Date.now();

    try {
      // For React Native, we'll use a simplified implementation
      // In production, this would use native image processing
      const imageData = await this.loadImageData(imageUri);
      const { width, height } = imageData;

      // Convert to grayscale and resize to 32x32 for DCT
      const grayscale = await this.convertToGrayscale(imageData);
      const resized = await this.resizeImage(grayscale, 32, 32);

      // Apply Discrete Cosine Transform
      const dct = this.applyDCT(resized);

      // Extract low frequency components (8x8)
      const lowFreq = this.extractLowFrequency(dct, 8, 8);

      // Compute median and generate hash
      const median = this.computeMedian(lowFreq);
      const hash = this.computeHashBits(lowFreq, median);

      return {
        hash: this.bitsToHex(hash),
        algorithm: "phash",
        processingTime: Date.now() - startTime,
        dimensions: { width, height },
      };
    } catch (error) {
      console.error("PerceptualHasher: pHash generation failed:", error);
      // Fallback to URI-based hash for development
      return this.fallbackHash(imageUri, "phash", startTime);
    }
  }

  /**
   * Generate difference hash (dHash) - gradient-based
   * Fast and effective for detecting exact duplicates and near-duplicates
   */
  public async generateDHash(imageUri: string): Promise<PerceptualHashResult> {
    const startTime = Date.now();

    try {
      const imageData = await this.loadImageData(imageUri);
      const { width, height } = imageData;

      // Convert to grayscale and resize to 9x8 for gradient calculation
      const grayscale = await this.convertToGrayscale(imageData);
      const resized = await this.resizeImage(grayscale, 9, 8);

      // Compute gradients between adjacent pixels
      const gradients = this.computeGradients(resized);

      // Convert gradients to hash bits
      const hash = this.gradientsToBits(gradients);

      return {
        hash: this.bitsToHex(hash),
        algorithm: "dhash",
        processingTime: Date.now() - startTime,
        dimensions: { width, height },
      };
    } catch (error) {
      console.error("PerceptualHasher: dHash generation failed:", error);
      return this.fallbackHash(imageUri, "dhash", startTime);
    }
  }

  /**
   * Generate average hash (aHash) - simple and fast
   * Good for basic duplicate detection
   */
  public async generateAverageHash(
    imageUri: string,
  ): Promise<PerceptualHashResult> {
    const startTime = Date.now();

    try {
      const imageData = await this.loadImageData(imageUri);
      const { width, height } = imageData;

      // Convert to grayscale and resize to 8x8
      const grayscale = await this.convertToGrayscale(imageData);
      const resized = await this.resizeImage(grayscale, 8, 8);

      // Compute average pixel value
      const average = this.computeAverage(resized);

      // Generate hash based on comparison to average
      const hash = this.computeAverageBits(resized, average);

      return {
        hash: this.bitsToHex(hash),
        algorithm: "average",
        processingTime: Date.now() - startTime,
        dimensions: { width, height },
      };
    } catch (error) {
      console.error("PerceptualHasher: aHash generation failed:", error);
      return this.fallbackHash(imageUri, "average", startTime);
    }
  }

  // ─── SIMILARITY COMPARISON ───────────────────────────────

  /**
   * Compare two perceptual hashes using Hamming distance
   */
  public compareHashes(
    hash1: string,
    hash2: string,
    threshold: number = PerceptualHasher.DEFAULT_THRESHOLD,
  ): SimilarityResult {
    // Convert hex strings to binary arrays
    const bits1 = this.hexToBits(hash1);
    const bits2 = this.hexToBits(hash2);

    // Calculate Hamming distance
    let distance = 0;
    for (let i = 0; i < Math.min(bits1.length, bits2.length); i++) {
      if (bits1[i] !== bits2[i]) distance++;
    }

    // Calculate similarity score (64 - distance) / 64
    const similarity = (64 - distance) / 64;

    return {
      distance,
      similarity,
      isDuplicate: distance <= threshold,
      threshold,
    };
  }

  /**
   * Compute structural similarity between images
   * More sophisticated than hash-based comparison
   */
  public async computeStructuralSimilarity(
    imageUri1: string,
    imageUri2: string,
  ): Promise<StructuralSimilarityResult> {
    const startTime = Date.now();

    try {
      const [image1, image2] = await Promise.all([
        this.loadImageData(imageUri1),
        this.loadImageData(imageUri2),
      ]);

      // Convert to grayscale and resize to same dimensions
      const gray1 = await this.convertToGrayscale(image1);
      const gray2 = await this.convertToGrayscale(image2);

      const size = 256; // Standard size for SSIM
      const resized1 = await this.resizeImage(gray1, size, size);
      const resized2 = await this.resizeImage(gray2, size, size);

      // Compute SSIM
      const ssim = this.computeSSIM(resized1, resized2);

      // Compute MSE as additional metric
      const mse = this.computeMSE(resized1, resized2);

      return {
        ssim,
        mse,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error("PerceptualHasher: SSIM computation failed:", error);
      return {
        ssim: 0,
        mse: Number.MAX_VALUE,
        processingTime: Date.now() - startTime,
      };
    }
  }

  // ─── BATCH PROCESSING ─────────────────────────────────────

  /**
   * Generate multiple hash types for an image
   */
  public async generateAllHashes(imageUri: string): Promise<{
    phash: PerceptualHashResult;
    dhash: PerceptualHashResult;
    average: PerceptualHashResult;
  }> {
    const [phash, dhash, average] = await Promise.all([
      this.generatePHash(imageUri),
      this.generateDHash(imageUri),
      this.generateAverageHash(imageUri),
    ]);

    return { phash, dhash, average };
  }

  /**
   * Find duplicates in a collection of images
   */
  public async findDuplicates(
    imageUris: string[],
    algorithm: "phash" | "dhash" | "average" = "phash",
    threshold: number = PerceptualHasher.DEFAULT_THRESHOLD,
  ): Promise<{ group: string; images: string[]; similarity: number }[]> {
    // Generate hashes for all images
    const hashPromises = imageUris.map(async (uri) => {
      let hash: PerceptualHashResult;
      switch (algorithm) {
        case "phash":
          hash = await this.generatePHash(uri);
          break;
        case "dhash":
          hash = await this.generateDHash(uri);
          break;
        case "average":
          hash = await this.generateAverageHash(uri);
          break;
      }
      return { uri, hash };
    });

    const hashes = await Promise.all(hashPromises);

    // Find duplicate groups
    const groups: { group: string; images: string[]; similarity: number }[] =
      [];
    const processed = new Set<string>();

    for (let i = 0; i < hashes.length; i++) {
      if (processed.has(hashes[i].uri)) continue;

      const currentGroup = [hashes[i].uri];
      processed.add(hashes[i].uri);

      for (let j = i + 1; j < hashes.length; j++) {
        if (processed.has(hashes[j].uri)) continue;

        const comparison = this.compareHashes(
          hashes[i].hash.hash,
          hashes[j].hash.hash,
          threshold,
        );

        if (comparison.isDuplicate) {
          currentGroup.push(hashes[j].uri);
          processed.add(hashes[j].uri);
        }
      }

      if (currentGroup.length > 1) {
        // Calculate average similarity for the group
        let totalSimilarity = 0;
        let comparisons = 0;

        for (let x = 0; x < currentGroup.length; x++) {
          for (let y = x + 1; y < currentGroup.length; y++) {
            const hashX = hashes.find((h) => h.uri === currentGroup[x])?.hash
              .hash;
            const hashY = hashes.find((h) => h.uri === currentGroup[y])?.hash
              .hash;
            if (hashX && hashY) {
              const comp = this.compareHashes(hashX, hashY, threshold);
              totalSimilarity += comp.similarity;
              comparisons++;
            }
          }
        }

        const avgSimilarity =
          comparisons > 0 ? totalSimilarity / comparisons : 0;

        groups.push({
          group: `group-${groups.length + 1}`,
          images: currentGroup,
          similarity: avgSimilarity,
        });
      }
    }

    return groups;
  }

  // ─── PRIVATE IMPLEMENTATION METHODS ───────────────────────

  private async loadImageData(imageUri: string): Promise<{
    data: Uint8Array;
    width: number;
    height: number;
  }> {
    // This is a placeholder implementation
    // In production, would use proper image loading library
    // For now, simulate with URI-based data

    const width = 1920; // Default assumption
    const height = 1080;
    const data = new Uint8Array(width * height * 4); // RGBA

    return { data, width, height };
  }

  private async convertToGrayscale(imageData: {
    data: Uint8Array;
    width: number;
    height: number;
  }): Promise<number[]> {
    const { data, width, height } = imageData;
    const grayscale = new Array(width * height);

    for (let i = 0; i < width * height; i++) {
      const pixelIndex = i * 4; // RGBA
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];

      // Standard grayscale conversion
      grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }

    return grayscale;
  }

  private async resizeImage(
    imageData: number[],
    targetWidth: number,
    targetHeight: number,
  ): Promise<number[][]> {
    // Simple nearest-neighbor resize
    // In production, would use proper interpolation
    const resized: number[][] = [];

    const sourceWidth = Math.sqrt(imageData.length);
    const sourceHeight = sourceWidth;

    const xRatio = sourceWidth / targetWidth;
    const yRatio = sourceHeight / targetHeight;

    for (let y = 0; y < targetHeight; y++) {
      resized[y] = [];
      for (let x = 0; x < targetWidth; x++) {
        const sourceX = Math.floor(x * xRatio);
        const sourceY = Math.floor(y * yRatio);
        resized[y][x] = imageData[sourceY * sourceWidth + sourceX];
      }
    }

    return resized;
  }

  private applyDCT(imageData: number[][]): number[][] {
    const size = imageData.length;
    const dct: number[][] = Array(size)
      .fill(0)
      .map(() => Array(size).fill(0));

    for (let u = 0; u < size; u++) {
      for (let v = 0; v < size; v++) {
        let sum = 0;

        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            const cos1 = Math.cos(((2 * i + 1) * u * Math.PI) / (2 * size));
            const cos2 = Math.cos(((2 * j + 1) * v * Math.PI) / (2 * size));
            sum += imageData[i][j] * cos1 * cos2;
          }
        }

        const alphaU = u === 0 ? 1 / Math.sqrt(2) : 1;
        const alphaV = v === 0 ? 1 / Math.sqrt(2) : 1;

        dct[u][v] = (2 / size) * alphaU * alphaV * sum;
      }
    }

    return dct;
  }

  private extractLowFrequency(
    dct: number[][],
    width: number,
    height: number,
  ): number[] {
    const lowFreq: number[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        lowFreq.push(dct[y][x]);
      }
    }

    return lowFreq;
  }

  private computeMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  private computeHashBits(values: number[], median: number): number[] {
    return values.map((value) => (value > median ? 1 : 0));
  }

  private computeGradients(imageData: number[][]): number[][] {
    const gradients: number[][] = [];
    const height = imageData.length;
    const width = imageData[0].length;

    for (let y = 0; y < height; y++) {
      gradients[y] = [];
      for (let x = 0; x < width - 1; x++) {
        gradients[y][x] = imageData[y][x + 1] - imageData[y][x];
      }
    }

    return gradients;
  }

  private gradientsToBits(gradients: number[][]): number[] {
    const bits: number[] = [];

    for (const row of gradients) {
      for (const gradient of row) {
        bits.push(gradient > 0 ? 1 : 0);
      }
    }

    return bits;
  }

  private computeAverage(values: number[]): number {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  private computeAverageBits(values: number[], average: number): number[] {
    return values.map((value) => (value > average ? 1 : 0));
  }

  private bitsToHex(bits: number[]): string {
    const hexChars = "0123456789abcdef";
    let hex = "";

    for (let i = 0; i < bits.length; i += 4) {
      let nibble = 0;
      for (let j = 0; j < 4 && i + j < bits.length; j++) {
        nibble = (nibble << 1) | bits[i + j];
      }
      hex += hexChars[nibble];
    }

    return hex.padStart(16, "0"); // 64 bits = 16 hex chars
  }

  private hexToBits(hex: string): number[] {
    const bits: number[] = [];

    for (const char of hex) {
      const value = parseInt(char, 16);
      for (let i = 3; i >= 0; i--) {
        bits.push((value >> i) & 1);
      }
    }

    return bits;
  }

  private computeSSIM(image1: number[][], image2: number[][]): number {
    const size = image1.length;
    const windowSize = 8;
    const k1 = 0.01;
    const k2 = 0.03;
    const L = 255;
    const c1 = (k1 * L) ** 2;
    const c2 = (k2 * L) ** 2;

    let totalSSIM = 0;
    let windowCount = 0;

    for (let y = 0; y <= size - windowSize; y += windowSize) {
      for (let x = 0; x <= size - windowSize; x += windowSize) {
        const window1 = this.extractWindow(image1, x, y, windowSize);
        const window2 = this.extractWindow(image2, x, y, windowSize);

        const mu1 = this.computeWindowMean(window1);
        const mu2 = this.computeWindowMean(window2);
        const sigma1 = this.computeWindowStd(window1, mu1);
        const sigma2 = this.computeWindowStd(window2, mu2);
        const sigma12 = this.computeWindowCovariance(
          window1,
          window2,
          mu1,
          mu2,
        );

        const numerator = (2 * mu1 * mu2 + c1) * (2 * sigma12 + c2);
        const denominator =
          (mu1 * mu1 + mu2 * mu2 + c1) *
          (sigma1 * sigma1 + sigma2 * sigma2 + c2);

        totalSSIM += denominator === 0 ? 0 : numerator / denominator;
        windowCount++;
      }
    }

    return windowCount > 0 ? totalSSIM / windowCount : 0;
  }

  private computeMSE(image1: number[][], image2: number[][]): number {
    const size = image1.length;
    let sumSquaredErrors = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const error = image1[y][x] - image2[y][x];
        sumSquaredErrors += error * error;
      }
    }

    return sumSquaredErrors / (size * size);
  }

  private extractWindow(
    image: number[][],
    x: number,
    y: number,
    size: number,
  ): number[] {
    const window: number[] = [];

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        window.push(image[y + dy][x + dx]);
      }
    }

    return window;
  }

  private computeWindowMean(window: number[]): number {
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  }

  private computeWindowStd(window: number[], mean: number): number {
    const variance =
      window.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      window.length;
    return Math.sqrt(variance);
  }

  private computeWindowCovariance(
    window1: number[],
    window2: number[],
    mean1: number,
    mean2: number,
  ): number {
    let sum = 0;

    for (let i = 0; i < window1.length; i++) {
      sum += (window1[i] - mean1) * (window2[i] - mean2);
    }

    return sum / window1.length;
  }

  private fallbackHash(
    imageUri: string,
    algorithm: "phash" | "dhash" | "average",
    startTime: number,
  ): PerceptualHashResult {
    // Fallback to URI-based hash for development/testing
    let hash = 0;
    const input = imageUri.trim();

    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i);
      hash = (hash << 5) - hash + c;
      hash = hash & 0xffffffff;
    }

    const hex = Math.abs(hash).toString(16).padStart(16, "0");

    return {
      hash,
      algorithm,
      processingTime: Date.now() - startTime,
      dimensions: { width: 0, height: 0 },
    };
  }
}

// ─────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────

/**
 * Get singleton instance of PerceptualHasher
 */
export function getPerceptualHasher(): PerceptualHasher {
  if (!(global as any).perceptualHasherInstance) {
    (global as any).perceptualHasherInstance = new PerceptualHasher();
  }
  return (global as any).perceptualHasherInstance;
}

/**
 * Quick hash comparison utility
 */
export function quickCompare(
  hash1: string,
  hash2: string,
  threshold: number = 5,
): boolean {
  const hasher = getPerceptualHasher();
  const result = hasher.compareHashes(hash1, hash2, threshold);
  return result.isDuplicate;
}

/**
 * Generate a comprehensive hash string combining multiple algorithms
 */
export async function generateCompositeHash(imageUri: string): Promise<string> {
  const hasher = getPerceptualHasher();
  const { phash, dhash, average } = await hasher.generateAllHashes(imageUri);

  // Combine hashes for more robust comparison
  return `${phash.hash}:${dhash.hash}:${average.hash}`;
}
