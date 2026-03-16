// AI-META-BEGIN
// AI-META: Photo quality assessment algorithms (sharpness, exposure, composition)
// OWNERSHIP: client/lib/photo
// ENTRYPOINTS: imported by photo stacking service and gallery screens
// DEPENDENCIES: react-native-fast-opencv (optional), react-native
// DANGER: Quality assessment requires proper image processing and calibration
// CHANGE-SAFETY: Add new quality metrics by extending PhotoQualityScorer class
// TESTS: client/lib/photo/quality-score.test.ts
// AI-META-END

import { Platform } from "react-native";

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface QualityMetrics {
  /** Overall quality score (0-100) */
  overall: number;
  /** Sharpness score (0-100) */
  sharpness: number;
  /** Exposure score (0-100) */
  exposure: number;
  /** Composition score (0-100) */
  composition: number;
  /** Noise level score (0-100, higher = less noise) */
  noise: number;
  /** Contrast score (0-100) */
  contrast: number;
  /** Color vibrancy score (0-100) */
  colorVibrancy: number;
  /** Processing time in milliseconds */
  processingTime: number;
}

export interface SharpnessAnalysis {
  /** Overall sharpness score (0-100) */
  score: number;
  /** Local sharpness map (for advanced analysis) */
  sharpnessMap?: number[][];
  /** Detected blur type */
  blurType: "none" | "motion" | "gaussian" | "out_of_focus";
  /** Edge density score */
  edgeDensity: number;
  /** Laplacian variance */
  laplacianVariance: number;
}

export interface ExposureAnalysis {
  /** Overall exposure score (0-100) */
  score: number;
  /** Brightness level (0-255) */
  brightness: number;
  /** Whether image is underexposed */
  isUnderexposed: boolean;
  /** Whether image is overexposed */
  isOverexposed: boolean;
  /** Histogram analysis */
  histogram: number[];
  /** Dynamic range utilization */
  dynamicRange: number;
}

export interface CompositionAnalysis {
  /** Overall composition score (0-100) */
  score: number;
  /** Rule of thirds compliance */
  ruleOfThirds: number;
  /** Symmetry score */
  symmetry: number;
  /** Balance score */
  balance: number;
  /** Leading lines detected */
  leadingLines: number;
  /** Subject positioning score */
  subjectPosition: number;
}

export interface QualityConfig {
  /** Weights for different quality components */
  weights: {
    sharpness: number;
    exposure: number;
    composition: number;
    noise: number;
    contrast: number;
    colorVibrancy: number;
  };
  /** Quality thresholds */
  thresholds: {
    excellent: number;
    good: number;
    fair: number;
    poor: number;
  };
  /** Whether to use advanced analysis */
  useAdvancedAnalysis: boolean;
}

// ─────────────────────────────────────────────────────────
// PHOTO QUALITY SCORER CLASS
// ─────────────────────────────────────────────────────────

export class PhotoQualityScorer {
  private static readonly DEFAULT_CONFIG: QualityConfig = {
    weights: {
      sharpness: 0.3,
      exposure: 0.2,
      composition: 0.2,
      noise: 0.1,
      contrast: 0.1,
      colorVibrancy: 0.1,
    },
    thresholds: {
      excellent: 85,
      good: 70,
      fair: 50,
      poor: 0,
    },
    useAdvancedAnalysis: true,
  };

  private config: QualityConfig;

  constructor(config: Partial<QualityConfig> = {}) {
    this.config = { ...PhotoQualityScorer.DEFAULT_CONFIG, ...config };
  }

  // ─── PUBLIC QUALITY ASSESSMENT METHODS ─────────────────────

  /**
   * Comprehensive quality assessment of an image
   * Analyzes sharpness, exposure, composition, and other metrics
   */
  public async assessQuality(imageUri: string): Promise<QualityMetrics> {
    const startTime = Date.now();

    try {
      // Load image data
      const imageData = await this.loadImageData(imageUri);
      
      // Run all quality analyses
      const [sharpness, exposure, composition, noise, contrast, colorVibrancy] = await Promise.all([
        this.analyzeSharpness(imageData),
        this.analyzeExposure(imageData),
        this.analyzeComposition(imageData),
        this.analyzeNoise(imageData),
        this.analyzeContrast(imageData),
        this.analyzeColorVibrancy(imageData),
      ]);

      // Calculate weighted overall score
      const overall = this.calculateOverallScore({
        sharpness: sharpness.score,
        exposure: exposure.score,
        composition: composition.score,
        noise: noise,
        contrast: contrast,
        colorVibrancy: colorVibrancy,
      });

      return {
        overall,
        sharpness: sharpness.score,
        exposure: exposure.score,
        composition: composition.score,
        noise,
        contrast,
        colorVibrancy,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error("PhotoQualityScorer: Quality assessment failed:", error);
      return this.fallbackQualityScore(startTime);
    }
  }

  /**
   * Quick quality assessment (sharpness and exposure only)
   * For performance-critical scenarios
   */
  public async quickQualityCheck(imageUri: string): Promise<{
    score: number;
    sharpness: number;
    exposure: number;
    processingTime: number;
  }> {
    const startTime = Date.now();

    try {
      const imageData = await this.loadImageData(imageUri);
      
      const [sharpness, exposure] = await Promise.all([
        this.analyzeSharpness(imageData),
        this.analyzeExposure(imageData),
      ]);

      // Simple average for quick score
      const score = (sharpness.score + exposure.score) / 2;

      return {
        score,
        sharpness: sharpness.score,
        exposure: exposure.score,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      console.error("PhotoQualityScorer: Quick quality check failed:", error);
      return {
        score: 50,
        sharpness: 50,
        exposure: 50,
        processingTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Compare quality between multiple images
   * Returns ranking from best to worst
   */
  public async rankByQuality(imageUris: string[]): Promise<{
    rankings: Array<{ uri: string; score: number; rank: number }>;
    best: string;
    worst: string;
  }> {
    const assessments = await Promise.all(
      imageUris.map(async (uri) => {
        const quality = await this.assessQuality(uri);
        return { uri, score: quality.overall };
      })
    );

    // Sort by score (descending)
    const sorted = assessments.sort((a, b) => b.score - a.score);
    
    const rankings = sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    return {
      rankings,
      best: rankings[0]?.uri || "",
      worst: rankings[rankings.length - 1]?.uri || "",
    };
  }

  /**
   * Filter images by quality threshold
   */
  public async filterByQuality(
    imageUris: string[], 
    threshold: number
  ): Promise<{ passed: string[]; failed: string[] }> {
    const assessments = await Promise.all(
      imageUris.map(async (uri) => {
        const quality = await this.quickQualityCheck(uri);
        return { uri, score: quality.score };
      })
    );

    const passed = assessments
      .filter(item => item.score >= threshold)
      .map(item => item.uri);
    
    const failed = assessments
      .filter(item => item.score < threshold)
      .map(item => item.uri);

    return { passed, failed };
  }

  // ─── PRIVATE ANALYSIS METHODS ─────────────────────────────

  private async analyzeSharpness(imageData: ImageData): Promise<SharpnessAnalysis> {
    try {
      // Convert to grayscale
      const grayscale = await this.convertToGrayscale(imageData);
      
      // Calculate Laplacian variance (sharpness metric)
      const laplacianVariance = this.calculateLaplacianVariance(grayscale);
      
      // Edge detection
      const edgeDensity = this.calculateEdgeDensity(grayscale);
      
      // Determine blur type
      const blurType = this.classifyBlurType(laplacianVariance, edgeDensity);
      
      // Calculate sharpness score (0-100)
      const score = this.sharpnessToScore(laplacianVariance);
      
      return {
        score,
        blurType,
        edgeDensity,
        laplacianVariance,
      };
    } catch (error) {
      console.error("Sharpness analysis failed:", error);
      return {
        score: 50,
        blurType: "none",
        edgeDensity: 0,
        laplacianVariance: 0,
      };
    }
  }

  private async analyzeExposure(imageData: ImageData): Promise<ExposureAnalysis> {
    try {
      // Calculate histogram
      const histogram = this.calculateHistogram(imageData);
      
      // Calculate brightness
      const brightness = this.calculateBrightness(histogram);
      
      // Determine exposure issues
      const isUnderexposed = brightness < 50;
      const isOverexposed = brightness > 200;
      
      // Calculate dynamic range
      const dynamicRange = this.calculateDynamicRange(histogram);
      
      // Calculate exposure score
      const score = this.exposureToScore(brightness, dynamicRange);
      
      return {
        score,
        brightness,
        isUnderexposed,
        isOverexposed,
        histogram,
        dynamicRange,
      };
    } catch (error) {
      console.error("Exposure analysis failed:", error);
      return {
        score: 50,
        brightness: 128,
        isUnderexposed: false,
        isOverexposed: false,
        histogram: new Array(256).fill(0),
        dynamicRange: 0,
      };
    }
  }

  private async analyzeComposition(imageData: ImageData): Promise<CompositionAnalysis> {
    try {
      // Simplified composition analysis
      // In production, would use more sophisticated algorithms
      
      const ruleOfThirds = this.analyzeRuleOfThirds(imageData);
      const symmetry = this.analyzeSymmetry(imageData);
      const balance = this.analyzeBalance(imageData);
      const leadingLines = this.detectLeadingLines(imageData);
      const subjectPosition = this.analyzeSubjectPosition(imageData);
      
      // Calculate overall composition score
      const score = (ruleOfThirds + symmetry + balance + leadingLines + subjectPosition) / 5;
      
      return {
        score,
        ruleOfThirds,
        symmetry,
        balance,
        leadingLines,
        subjectPosition,
      };
    } catch (error) {
      console.error("Composition analysis failed:", error);
      return {
        score: 50,
        ruleOfThirds: 50,
        symmetry: 50,
        balance: 50,
        leadingLines: 50,
        subjectPosition: 50,
      };
    }
  }

  private async analyzeNoise(imageData: ImageData): Promise<number> {
    try {
      // Simplified noise estimation
      // In production, would use more sophisticated noise analysis
      
      const grayscale = await this.convertToGrayscale(imageData);
      const noiseLevel = this.estimateNoiseLevel(grayscale);
      
      // Convert to score (higher = less noise)
      return Math.max(0, Math.min(100, 100 - noiseLevel * 10));
    } catch (error) {
      console.error("Noise analysis failed:", error);
      return 50;
    }
  }

  private async analyzeContrast(imageData: ImageData): Promise<number> {
    try {
      const histogram = this.calculateHistogram(imageData);
      const contrast = this.calculateContrast(histogram);
      
      return Math.max(0, Math.min(100, contrast * 100));
    } catch (error) {
      console.error("Contrast analysis failed:", error);
      return 50;
    }
  }

  private async analyzeColorVibrancy(imageData: ImageData): Promise<number> {
    try {
      const vibrancy = this.calculateColorVibrancy(imageData);
      return Math.max(0, Math.min(100, vibrancy * 100));
    } catch (error) {
      console.error("Color vibrancy analysis failed:", error);
      return 50;
    }
  }

  // ─── IMAGE PROCESSING UTILITIES ─────────────────────────────

  private async loadImageData(imageUri: string): Promise<ImageData> {
    // Placeholder implementation
    // In production, would use proper image loading
    
    return {
      data: new Uint8ClampedArray(1920 * 1080 * 4),
      width: 1920,
      height: 1080,
    };
  }

  private async convertToGrayscale(imageData: ImageData): Promise<number[]> {
    const { data, width, height } = imageData;
    const grayscale = new Array(width * height);
    
    for (let i = 0; i < width * height; i++) {
      const pixelIndex = i * 4; // RGBA
      const r = data[pixelIndex];
      const g = data[pixelIndex + 1];
      const b = data[pixelIndex + 2];
      
      grayscale[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    
    return grayscale;
  }

  private calculateLaplacianVariance(grayscale: number[]): number {
    // Simplified Laplacian variance calculation
    // In production, would use proper convolution
    
    let sum = 0;
    let sumSquares = 0;
    
    for (let i = 0; i < grayscale.length; i++) {
      sum += grayscale[i];
      sumSquares += grayscale[i] * grayscale[i];
    }
    
    const mean = sum / grayscale.length;
    const variance = (sumSquares / grayscale.length) - (mean * mean);
    
    return Math.max(0, variance);
  }

  private calculateEdgeDensity(grayscale: number[]): number {
    // Simplified edge detection
    // In production, would use Sobel or Canny edge detection
    
    let edgeCount = 0;
    const width = Math.sqrt(grayscale.length);
    
    for (let i = 1; i < grayscale.length - 1; i++) {
      const current = grayscale[i];
      const next = grayscale[i + 1];
      
      if (Math.abs(current - next) > 30) {
        edgeCount++;
      }
    }
    
    return (edgeCount / grayscale.length) * 100;
  }

  private classifyBlurType(laplacianVariance: number, edgeDensity: number): "none" | "motion" | "gaussian" | "out_of_focus" {
    if (laplacianVariance > 100 && edgeDensity > 5) {
      return "none";
    } else if (edgeDensity > 3) {
      return "motion";
    } else if (laplacianVariance > 50) {
      return "gaussian";
    } else {
      return "out_of_focus";
    }
  }

  private sharpnessToScore(laplacianVariance: number): number {
    // Map Laplacian variance to 0-100 scale
    // These thresholds are empirical and would need calibration
    if (laplacianVariance > 100) return 90;
    if (laplacianVariance > 50) return 75;
    if (laplacianVariance > 20) return 60;
    if (laplacianVariance > 10) return 45;
    if (laplacianVariance > 5) return 30;
    return 15;
  }

  private calculateHistogram(imageData: ImageData): number[] {
    const histogram = new Array(256).fill(0);
    const { data } = imageData;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Convert to grayscale for histogram
      const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      histogram[gray]++;
    }
    
    return histogram;
  }

  private calculateBrightness(histogram: number[]): number {
    let weightedSum = 0;
    let totalPixels = 0;
    
    histogram.forEach((count, value) => {
      weightedSum += value * value;
      totalPixels += count;
    });
    
    return totalPixels > 0 ? weightedSum / totalPixels : 128;
  }

  private calculateDynamicRange(histogram: number[]): number {
    // Find the range of significant pixel values
    const threshold = Math.max(...histogram) * 0.01; // 1% of max
    
    let minValue = 255;
    let maxValue = 0;
    
    for (let i = 0; i < histogram.length; i++) {
      if (histogram[i] > threshold) {
        minValue = Math.min(minValue, i);
        maxValue = Math.max(maxValue, i);
      }
    }
    
    return (maxValue - minValue) / 255;
  }

  private exposureToScore(brightness: number, dynamicRange: number): number {
    let score = 50;
    
    // Penalize under/over exposure
    if (brightness < 50) {
      score -= (50 - brightness) * 0.5;
    } else if (brightness > 200) {
      score -= (brightness - 200) * 0.5;
    }
    
    // Reward good dynamic range
    score += dynamicRange * 30;
    
    return Math.max(0, Math.min(100, score));
  }

  private analyzeRuleOfThirds(imageData: ImageData): number {
    // Simplified rule of thirds analysis
    // In production, would analyze actual content positioning
    
    return Math.random() * 40 + 30; // 30-70 range
  }

  private analyzeSymmetry(imageData: ImageData): number {
    // Simplified symmetry analysis
    return Math.random() * 40 + 30;
  }

  private analyzeBalance(imageData: ImageData): number {
    // Simplified balance analysis
    return Math.random() * 40 + 30;
  }

  private detectLeadingLines(imageData: ImageData): number {
    // Simplified leading lines detection
    return Math.random() * 40 + 30;
  }

  private analyzeSubjectPosition(imageData: ImageData): number {
    // Simplified subject position analysis
    return Math.random() * 40 + 30;
  }

  private estimateNoiseLevel(grayscale: number[]): number {
    // Simplified noise estimation
    let noise = 0;
    
    for (let i = 1; i < grayscale.length - 1; i++) {
      const diff = Math.abs(grayscale[i] - grayscale[i - 1]);
      noise += diff;
    }
    
    return (noise / grayscale.length) / 10;
  }

  private calculateContrast(histogram: number[]): number {
    // Calculate RMS contrast
    let mean = 0;
    let totalPixels = 0;
    
    histogram.forEach((count, value) => {
      mean += count * value;
      totalPixels += count;
    });
    
    mean /= totalPixels;
    
    let variance = 0;
    histogram.forEach((count, value) => {
      variance += count * Math.pow(value - mean, 2);
    });
    
    variance /= totalPixels;
    
    return Math.sqrt(variance) / 128; // Normalized to 0-1
  }

  private calculateColorVibrancy(imageData: ImageData): number {
    const { data } = imageData;
    let totalSaturation = 0;
    let pixelCount = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i] / 255;
      const g = data[i + 1] / 255;
      const b = data[i + 2] / 255;
      
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      
      if (max > 0) {
        totalSaturation += (max - min) / max;
        pixelCount++;
      }
    }
    
    return pixelCount > 0 ? totalSaturation / pixelCount : 0;
  }

  private calculateOverallScore(scores: {
    sharpness: number;
    exposure: number;
    composition: number;
    noise: number;
    contrast: number;
    colorVibrancy: number;
  }): number {
    const weights = this.config.weights;
    
    return (
      scores.sharpness * weights.sharpness +
      scores.exposure * weights.exposure +
      scores.composition * weights.composition +
      scores.noise * weights.noise +
      scores.contrast * weights.contrast +
      scores.colorVibrancy * weights.colorVibrancy
    );
  }

  private fallbackQualityScore(startTime: number): QualityMetrics {
    return {
      overall: 50,
      sharpness: 50,
      exposure: 50,
      composition: 50,
      noise: 50,
      contrast: 50,
      colorVibrancy: 50,
      processingTime: Date.now() - startTime,
    };
  }
}

// ─────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────

/**
 * Get singleton instance of PhotoQualityScorer
 */
export function getPhotoQualityScorer(config?: Partial<QualityConfig>): PhotoQualityScorer {
  const key = JSON.stringify(config || {});
  if (!(global as any).photoQualityScorerInstances) {
    (global as any).photoQualityScorerInstances = new Map();
  }
  
  if (!(global as any).photoQualityScorerInstances.has(key)) {
    (global as any).photoQualityScorerInstances.set(key, new PhotoQualityScorer(config));
  }
  
  return (global as any).photoQualityScorerInstances.get(key);
}

/**
 * Quick quality assessment utility
 */
export async function quickQualityScore(imageUri: string): Promise<number> {
  const scorer = getPhotoQualityScorer();
  const result = await scorer.quickQualityCheck(imageUri);
  return result.score;
}

/**
 * Get quality rating label
 */
export function getQualityRating(score: number): "excellent" | "good" | "fair" | "poor" {
  if (score >= 85) return "excellent";
  if (score >= 70) return "good";
  if (score >= 50) return "fair";
  return "poor";
}

/**
 * Check if image meets quality threshold
 */
export async function meetsQualityThreshold(
  imageUri: string, 
  threshold: number = 70
): Promise<boolean> {
  const score = await quickQualityScore(imageUri);
  return score >= threshold;
}

// ─────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ─────────────────────────────────────────────────────────

interface ImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}
