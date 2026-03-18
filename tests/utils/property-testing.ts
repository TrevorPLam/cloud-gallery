/**
 * Unified Property Testing Utilities
 * 
 * Purpose: Provide standardized property testing patterns with proper constraints
 * and edge case handling for fast-check based tests across the Cloud Gallery codebase.
 * 
 * Usage: Import these utilities instead of using raw fast-check to ensure
 * consistent constraints and error handling across all property tests.
 */

import * as fc from 'fast-check';
import { expect } from 'vitest';

// ─────────────────────────────────────────────────────────
// CONSTRAINT HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Creates a constrained string arbitrary that ensures non-empty strings
 */
export const nonEmptyString = () => 
  fc.string().filter(s => s.length > 0);

/**
 * Creates a constrained integer arbitrary with positive values
 */
export const positiveInteger = (max: number = 1000) => 
  fc.integer({ min: 1, max });

/**
 * Creates a constrained integer arbitrary with non-negative values
 */
export const nonNegativeInteger = (max: number = 1000) => 
  fc.integer({ min: 0, max });

/**
 * Creates a constrained timestamp arbitrary (positive timestamps)
 */
export const validTimestamp = () => 
  fc.integer({ min: 1, max: Date.now() * 2 }).map(ts => new Date(ts));

/**
 * Creates a constrained photo ID arbitrary
 */
export const photoId = () => 
  fc.string().filter(s => s.length > 0 && s.length <= 100);

/**
 * Creates a constrained URI arbitrary for web URLs
 */
export const webUri = () => 
  fc.webUrl().filter(uri => uri.length > 0 && uri.length <= 2048);

/**
 * Creates a constrained filename arbitrary
 */
export const filename = () => 
  fc.string().filter(s => s.length > 0 && s.length <= 255 && !s.includes('/'));

/**
 * Creates a constrained album ID arbitrary
 */
export const albumId = () => 
  fc.string().filter(s => s.length > 0 && s.length <= 100);

// ─────────────────────────────────────────────────────────
// PHOTO ARBITRARIES
// ─────────────────────────────────────────────────────────

/**
 * Creates a Photo object arbitrary with proper constraints
 */
export const photo = () => 
  fc.record({
    id: photoId(),
    uri: webUri(),
    width: fc.integer({ min: 100, max: 4000 }),
    height: fc.integer({ min: 100, max: 4000 }),
    createdAt: validTimestamp(),
    modifiedAt: validTimestamp(),
    filename: filename(),
    isFavorite: fc.boolean(),
    albumIds: fc.array(albumId()),
  }).filter(photo => 
    photo.id.length > 0 && 
    photo.uri.length > 0 && 
    photo.width > 0 && 
    photo.height > 0 &&
    photo.filename.length > 0 &&
    photo.createdAt > 0 &&
    photo.modifiedAt > 0
  );

/**
 * Creates an array of unique photos
 */
export const uniquePhotoArray = (minLength: number = 1, maxLength: number = 20) =>
  fc.array(photo(), { minLength, maxLength }).filter(photos => {
    const ids = photos.map(p => p.id);
    return new Set(ids).size === ids.length; // Ensure unique IDs
  });

// ─────────────────────────────────────────────────────────
// BOUNDING BOX ARBITRARIES
// ─────────────────────────────────────────────────────────

/**
 * Creates a bounding box arbitrary with proper constraints
 */
export const boundingBox = (maxWidth: number = 2000, maxHeight: number = 2000) =>
  fc.record({
    x: fc.integer({ min: 0, max: maxWidth - 1 }),
    y: fc.integer({ min: 0, max: maxHeight - 1 }),
    width: fc.integer({ min: 1, max: maxWidth }),
    height: fc.integer({ min: 1, max: maxHeight }),
  }).filter(bbox => 
    bbox.width > 0 && 
    bbox.height > 0 &&
    bbox.x + bbox.width <= maxWidth &&
    bbox.y + bbox.height <= maxHeight
  );

/**
 * Creates a normalized bounding box arbitrary (coordinates in [0,1])
 */
export const normalizedBoundingBox = () =>
  fc.record({
    x: fc.float({ min: 0, max: 1 }),
    y: fc.float({ min: 0, max: 1 }),
    width: fc.float({ min: 0, max: 1 }),
    height: fc.float({ min: 0, max: 1 }),
  }).filter(bbox => 
    bbox.x >= 0 && bbox.x <= 1 &&
    bbox.y >= 0 && bbox.y <= 1 &&
    bbox.width >= 0 && bbox.width <= 1 &&
    bbox.height >= 0 && bbox.height <= 1
  );

// ─────────────────────────────────────────────────────────
// ML/DETECTION ARBITRARIES
// ─────────────────────────────────────────────────────────

/**
 * Creates detection output arrays with proper constraints
 */
export const detectionOutputs = () =>
  fc.tuple(
    fc.array(fc.float({ min: 0, max: 1 }), { minLength: 4, maxLength: 20 })
      .filter(values => values.length % 4 === 0), // Bbox values must be multiple of 4
    fc.array(fc.float({ min: 0, max: 1 }), { minLength: 1, maxLength: 5 }),
    fc.array(fc.float({ min: 0, max: 10 }), { minLength: 1, maxLength: 5 })
  ).filter(([bboxValues, scores, classes]) => {
    // Ensure consistent array sizes
    return bboxValues.length > 0 && 
           scores.length > 0 && 
           classes.length > 0 &&
           scores.length === classes.length &&
           bboxValues.length / 4 === scores.length;
  });

/**
 * Creates frame dimensions with proper constraints
 */
export const frameDimensions = () =>
  fc.tuple(
    fc.integer({ min: 640, max: 3840 }), // width
    fc.integer({ min: 480, max: 2160 })  // height
  ).filter(([width, height]) => 
    width > 0 && 
    height > 0 && 
    width * height * 3 <= Number.MAX_SAFE_INTEGER
  );

// ─────────────────────────────────────────────────────────
// PROPERTY TESTING HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Standard property test configuration
 */
export const standardConfig = {
  numRuns: 100,
  timeout: 10000,
};

/**
 * Lightweight property test configuration for performance-sensitive tests
 */
export const lightConfig = {
  numRuns: 20,
  timeout: 5000,
};

/**
 * Heavy property test configuration for comprehensive testing
 */
export const heavyConfig = {
  numRuns: 1000,
  timeout: 30000,
};

/**
 * Creates a property test with standard configuration and error handling
 */
export const standardProperty = <T>(
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => boolean | void,
  config: Partial<typeof standardConfig> = {}
) => {
  const finalConfig = { ...standardConfig, ...config };
  return fc.property(arbitrary, predicate);
};

/**
 * Creates an async property test with standard configuration and error handling
 */
export const standardAsyncProperty = <T>(
  arbitrary: fc.Arbitrary<T>,
  predicate: (value: T) => Promise<boolean | void>,
  config: Partial<typeof standardConfig> = {}
) => {
  const finalConfig = { ...standardConfig, ...config };
  return fc.asyncProperty(arbitrary, predicate);
};

/**
 * Runs a property test with proper error reporting
 */
export const runPropertyTest = async <T>(
  property: fc.Property<T>,
  config: Partial<typeof standardConfig> = {}
): Promise<void> => {
  const finalConfig = { ...standardConfig, ...config };
  await fc.assert(property, finalConfig);
};

/**
 * Runs an async property test with proper error reporting
 */
export const runAsyncPropertyTest = async <T>(
  property: fc.AsyncProperty<T>,
  config: Partial<typeof standardConfig> = {}
): Promise<void> => {
  const finalConfig = { ...standardConfig, ...config };
  await fc.assert(property, finalConfig);
};

// ─────────────────────────────────────────────────────────
// COMMON PRECONDITIONS
// ─────────────────────────────────────────────────────────

/**
 * Precondition helper for valid dimensions
 */
export const validDimensions = (width: number, height: number): boolean => 
  width > 0 && height > 0 && width * height <= Number.MAX_SAFE_INTEGER / 3;

/**
 * Precondition helper for valid bounding boxes
 */
export const validBoundingBox = (bbox: { x: number, y: number, width: number, height: number }, frameWidth: number, frameHeight: number): boolean =>
  bbox.width > 0 && 
  bbox.height > 0 && 
  bbox.x >= 0 && 
  bbox.y >= 0 && 
  bbox.x + bbox.width <= frameWidth && 
  bbox.y + bbox.height <= frameHeight;

/**
 * Precondition helper for unique array elements
 */
export const uniqueIds = <T extends { id: string }>(items: T[]): boolean => {
  const ids = items.map(item => item.id);
  return new Set(ids).size === ids.length;
};

/**
 * Precondition helper for valid timestamps
 */
export const validTimestamps = (...timestamps: number[]): boolean =>
  timestamps.every(ts => ts > 0 && ts <= Date.now() * 2);

// ─────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────

export * from 'fast-check';

// Re-export commonly used fast-check arbitraries for convenience
export {
  integer,
  float,
  float32,
  string,
  boolean,
  array,
  record,
  tuple,
  oneof,
  option,
  constant,
  lorem,
  uuid,
} from 'fast-check';
