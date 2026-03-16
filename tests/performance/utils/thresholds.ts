/**
 * Performance thresholds and regression detection limits
 * These values define the acceptable performance boundaries for Cloud Gallery
 */

export interface PerformanceThresholds {
  /** Maximum time in milliseconds */
  maxTime: number;
  /** Maximum memory increase in bytes */
  maxMemoryIncrease?: number;
  /** Minimum throughput (operations per second) */
  minThroughput?: number;
  /** Regression detection sensitivity (percentage) */
  regressionSensitivity?: number;
}

/**
 * Server-side performance thresholds
 */
export const serverThresholds = {
  /** Photo processing operations */
  photoProcessing: {
    extractMetadata: { maxTime: 50 }, // 50ms per photo
    generateThumbnail: { maxTime: 200 }, // 200ms per photo
    processBatch: { maxTime: 1000, minThroughput: 10 }, // 1s for 10+ photos
  },
  
  /** Search operations */
  search: {
    indexPhoto: { maxTime: 10 }, // 10ms per photo
    searchQuery: { maxTime: 100 }, // 100ms per query
    complexSearch: { maxTime: 500 }, // 500ms for complex queries
    batchSearch: { maxTime: 200, minThroughput: 50 }, // 200ms for 50+ queries
  },
  
  /** Data operations */
  dataOperations: {
    databaseQuery: { maxTime: 50 }, // 50ms per query
    batchInsert: { maxTime: 500, minThroughput: 100 }, // 500ms for 100+ records
    dataExport: { maxTime: 2000, minThroughput: 1000 }, // 2s for 1000+ records
  },
  
  /** Authentication and security */
  security: {
    passwordHash: { maxTime: 100 }, // 100ms for Argon2
    tokenValidation: { maxTime: 10 }, // 10ms for JWT validation
    encryption: { maxTime: 50 }, // 50ms for data encryption
  },
} as const;

/**
 * Client-side performance thresholds
 */
export const clientThresholds = {
  /** Storage operations */
  storage: {
    savePhoto: { maxTime: 100 }, // 100ms per photo
    loadPhotos: { maxTime: 500, minThroughput: 100 }, // 500ms for 100+ photos
    searchLocal: { maxTime: 200 }, // 200ms for local search
  },
  
  /** UI rendering */
  ui: {
    componentRender: { maxTime: 16 }, // 16ms for 60fps
    listRender: { maxTime: 50, minThroughput: 100 }, // 50ms for 100+ items
    imageLoad: { maxTime: 300 }, // 300ms for image loading
  },
  
  /** Image processing */
  imageProcessing: {
    resize: { maxTime: 200 }, // 200ms for image resize
    compress: { maxTime: 500 }, // 500ms for image compression
    filter: { maxTime: 100 }, // 100ms for simple filters
  },
} as const;

/**
 * Shared performance thresholds
 */
export const sharedThresholds = {
  /** Data validation */
  validation: {
    validatePhoto: { maxTime: 5 }, // 5ms per photo validation
    validateAlbum: { maxTime: 10 }, // 10ms per album validation
    batchValidation: { maxTime: 100, minThroughput: 1000 }, // 100ms for 1000+ validations
  },
  
  /** Cryptographic operations */
  crypto: {
    hash: { maxTime: 50 }, // 50ms for hashing
    encrypt: { maxTime: 100 }, // 100ms for encryption
    decrypt: { maxTime: 100 }, // 100ms for decryption
  },
  
  /** Serialization */
  serialization: {
    jsonStringify: { maxTime: 10, minThroughput: 10000 }, // 10ms for 10000+ objects
    jsonParse: { maxTime: 10, minThroughput: 10000 }, // 10ms for 10000+ objects
  },
} as const;

/**
 * Regression detection configuration
 */
export const regressionDetection = {
  /** Percentage increase that triggers regression alert */
  timeRegressionThreshold: 0.15, // 15% increase
  memoryRegressionThreshold: 0.20, // 20% increase
  throughputRegressionThreshold: 0.10, // 10% decrease
  
  /** Minimum number of samples needed for regression detection */
  minSamples: 5,
  
  /** Statistical confidence level (0-1) */
  confidenceLevel: 0.95,
  
  /** Maximum variance allowed in measurements */
  maxVariance: 0.05, // 5%
} as const;

/**
 * Environment-specific adjustments
 */
export const environmentAdjustments = {
  /** CI/CD environments may have different performance characteristics */
  ci: {
    timeMultiplier: 1.5, // Allow 50% more time in CI
    memoryMultiplier: 2.0, // Allow 2x more memory in CI
  },
  
  /** Development environments */
  development: {
    timeMultiplier: 1.2, // Allow 20% more time in development
    memoryMultiplier: 1.5, // Allow 1.5x more memory in development
  },
  
  /** Production targets (stricter) */
  production: {
    timeMultiplier: 1.0, // No adjustment
    memoryMultiplier: 1.0, // No adjustment
  },
} as const;

/**
 * Get adjusted threshold for current environment
 */
export function getThreshold(
  baseThreshold: PerformanceThresholds,
  environment: 'ci' | 'development' | 'production' = 'production'
): PerformanceThresholds {
  const adjustment = environmentAdjustments[environment];
  
  return {
    maxTime: baseThreshold.maxTime * adjustment.timeMultiplier,
    maxMemoryIncrease: baseThreshold.maxMemoryIncrease 
      ? baseThreshold.maxMemoryIncrease * adjustment.memoryMultiplier 
      : undefined,
    minThroughput: baseThreshold.minThroughput 
      ? baseThreshold.minThroughput / adjustment.timeMultiplier 
      : undefined,
    regressionSensitivity: baseThreshold.regressionSensitivity,
  };
}

/**
 * Performance category classifications
 */
export const performanceCategories = {
  critical: {
    maxTime: 100, // Critical operations must be under 100ms
    description: 'Critical user-facing operations',
  },
  important: {
    maxTime: 500, // Important operations under 500ms
    description: 'Important but not blocking operations',
  },
  background: {
    maxTime: 5000, // Background operations under 5s
    description: 'Background processing and batch operations',
  },
  maintenance: {
    maxTime: 30000, // Maintenance operations under 30s
    description: 'Maintenance and cleanup operations',
  },
} as const;

/**
 * Default thresholds for uncategorized operations
 */
export const defaultThresholds: PerformanceThresholds = {
  maxTime: 1000, // 1 second default
  maxMemoryIncrease: 10 * 1024 * 1024, // 10MB default
  minThroughput: 100, // 100 ops/sec default
  regressionSensitivity: 0.15, // 15% regression sensitivity
};
