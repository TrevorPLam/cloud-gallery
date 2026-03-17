/**
 * Property Testing Framework Validation Tests
 * 
 * Purpose: Validate that the standardized property testing utilities work correctly
 * and provide proper constraint handling across all arbitraries.
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  nonEmptyString,
  positiveInteger,
  nonNegativeInteger,
  validTimestamp,
  photoId,
  webUri,
  filename,
  albumId,
  photo,
  uniquePhotoArray,
  boundingBox,
  normalizedBoundingBox,
  detectionOutputs,
  frameDimensions,
  standardProperty,
  standardAsyncProperty,
  runPropertyTest,
  runAsyncPropertyTest,
  standardConfig,
  lightConfig,
  heavyConfig,
  validDimensions,
  validBoundingBox,
  uniqueIds,
  validTimestamps,
} from "./property-testing";

describe("Property Testing Framework", () => {
  describe("Constraint Helpers", () => {
    it("should generate non-empty strings", () => {
      const property = standardProperty(
        nonEmptyString(),
        (str) => {
          expect(str.length).toBeGreaterThan(0);
          expect(typeof str).toBe("string");
        }
      );
      runPropertyTest(property, lightConfig);
    });

    it("should generate positive integers", () => {
      const property = standardProperty(
        positiveInteger(100),
        (num) => {
          expect(num).toBeGreaterThan(0);
          expect(num).toBeLessThanOrEqual(100);
          expect(Number.isInteger(num)).toBe(true);
        }
      );
      runPropertyTest(property, lightConfig);
    });

    it("should generate non-negative integers", () => {
      const property = standardProperty(
        nonNegativeInteger(100),
        (num) => {
          expect(num).toBeGreaterThanOrEqual(0);
          expect(num).toBeLessThanOrEqual(100);
          expect(Number.isInteger(num)).toBe(true);
        }
      );
      runPropertyTest(property, lightConfig);
    });

    it("should generate valid timestamps", () => {
      const property = standardProperty(
        validTimestamp(),
        (timestamp) => {
          expect(timestamp instanceof Date).toBe(true);
          expect(timestamp.getTime()).toBeGreaterThan(0);
          expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now() * 2);
        }
      );
      runPropertyTest(property, lightConfig);
    });

    it("should generate valid photo IDs", () => {
      const property = standardProperty(
        photoId(),
        (id) => {
          expect(typeof id).toBe("string");
          expect(id.length).toBeGreaterThan(0);
          expect(id.length).toBeLessThanOrEqual(100);
        }
      );
      runPropertyTest(property, lightConfig);
    });

    it("should generate valid web URIs", () => {
      const property = standardProperty(
        webUri(),
        (uri) => {
          expect(typeof uri).toBe("string");
          expect(uri.length).toBeGreaterThan(0);
          expect(uri.length).toBeLessThanOrEqual(2048);
          expect(uri).toMatch(/^https?:\/\//);
        }
      );
      runPropertyTest(property, lightConfig);
    });

    it("should generate valid filenames", () => {
      const property = standardProperty(
        filename(),
        (filename) => {
          expect(typeof filename).toBe("string");
          expect(filename.length).toBeGreaterThan(0);
          expect(filename.length).toBeLessThanOrEqual(255);
          expect(filename).not.toContain("/");
        }
      );
      runPropertyTest(property, lightConfig);
    });

    it("should generate valid album IDs", () => {
      const property = standardProperty(
        albumId(),
        (id) => {
          expect(typeof id).toBe("string");
          expect(id.length).toBeGreaterThan(0);
          expect(id.length).toBeLessThanOrEqual(100);
        }
      );
      runPropertyTest(property, lightConfig);
    });
  });

  describe("Photo Arbitraries", () => {
    it("should generate valid photos", () => {
      const property = standardProperty(
        photo(),
        (photoObj) => {
          expect(typeof photoObj.id).toBe("string");
          expect(typeof photoObj.uri).toBe("string");
          expect(typeof photoObj.width).toBe("number");
          expect(typeof photoObj.height).toBe("number");
          expect(typeof photoObj.filename).toBe("string");
          expect(typeof photoObj.isFavorite).toBe("boolean");
          expect(Array.isArray(photoObj.albumIds)).toBe(true);

          expect(photoObj.id.length).toBeGreaterThan(0);
          expect(photoObj.uri.length).toBeGreaterThan(0);
          expect(photoObj.width).toBeGreaterThan(0);
          expect(photoObj.height).toBeGreaterThan(0);
          expect(photoObj.filename.length).toBeGreaterThan(0);
          expect(photoObj.createdAt instanceof Date).toBe(true);
          expect(photoObj.modifiedAt instanceof Date).toBe(true);
        }
      );
      runPropertyTest(property, lightConfig);
    });

    it("should generate unique photo arrays", () => {
      const property = standardProperty(
        uniquePhotoArray(3, 10),
        (photos) => {
          expect(Array.isArray(photos)).toBe(true);
          expect(photos.length).toBeGreaterThanOrEqual(3);
          expect(photos.length).toBeLessThanOrEqual(10);

          // Check uniqueness
          const ids = photos.map(p => p.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
        }
      );
      runPropertyTest(property, lightConfig);
    });
  });

  describe("Bounding Box Arbitraries", () => {
    it("should generate valid bounding boxes", () => {
      const property = standardProperty(
        boundingBox(1000, 800),
        (bbox) => {
          expect(bbox.width).toBeGreaterThan(0);
          expect(bbox.height).toBeGreaterThan(0);
          expect(bbox.x).toBeGreaterThanOrEqual(0);
          expect(bbox.y).toBeGreaterThanOrEqual(0);
          expect(bbox.x + bbox.width).toBeLessThanOrEqual(1000);
          expect(bbox.y + bbox.height).toBeLessThanOrEqual(800);
        }
      );
      runPropertyTest(property, lightConfig);
    });

    it("should generate normalized bounding boxes", () => {
      const property = standardProperty(
        normalizedBoundingBox(),
        (bbox) => {
          expect(bbox.x).toBeGreaterThanOrEqual(0);
          expect(bbox.x).toBeLessThanOrEqual(1);
          expect(bbox.y).toBeGreaterThanOrEqual(0);
          expect(bbox.y).toBeLessThanOrEqual(1);
          expect(bbox.width).toBeGreaterThanOrEqual(0);
          expect(bbox.width).toBeLessThanOrEqual(1);
          expect(bbox.height).toBeGreaterThanOrEqual(0);
          expect(bbox.height).toBeLessThanOrEqual(1);
        }
      );
      runPropertyTest(property, lightConfig);
    });
  });

  describe("ML/Detection Arbitraries", () => {
    it("should generate valid detection outputs", () => {
      const property = standardProperty(
        detectionOutputs(),
        ([bboxValues, scores, classes]) => {
          expect(Array.isArray(bboxValues)).toBe(true);
          expect(Array.isArray(scores)).toBe(true);
          expect(Array.isArray(classes)).toBe(true);

          expect(bboxValues.length).toBeGreaterThan(0);
          expect(scores.length).toBeGreaterThan(0);
          expect(classes.length).toBeGreaterThan(0);

          expect(bboxValues.length % 4).toBe(0); // Multiple of 4 for bbox coords
          expect(scores.length).toBe(classes.length);
          expect(bboxValues.length / 4).toBe(scores.length);
        }
      );
      runPropertyTest(property, lightConfig);
    });

    it("should generate valid frame dimensions", () => {
      const property = standardProperty(
        frameDimensions(),
        ([width, height]) => {
          expect(typeof width).toBe("number");
          expect(typeof height).toBe("number");
          expect(width).toBeGreaterThan(0);
          expect(height).toBeGreaterThan(0);
          expect(width * height * 3).toBeLessThanOrEqual(Number.MAX_SAFE_INTEGER);
        }
      );
      runPropertyTest(property, lightConfig);
    });
  });

  describe("Precondition Helpers", () => {
    it("should validate dimensions correctly", () => {
      expect(validDimensions(1920, 1080)).toBe(true);
      expect(validDimensions(0, 1080)).toBe(false);
      expect(validDimensions(1920, 0)).toBe(false);
      expect(validDimensions(-1, 1080)).toBe(false);
      expect(validDimensions(1920, -1)).toBe(false);
    });

    it("should validate bounding boxes correctly", () => {
      const validBbox = { x: 10, y: 20, width: 100, height: 80 };
      const invalidBbox1 = { x: -10, y: 20, width: 100, height: 80 };
      const invalidBbox2 = { x: 10, y: 20, width: 0, height: 80 };
      const invalidBbox3 = { x: 900, y: 20, width: 200, height: 80 }; // Exceeds frame width

      expect(validBoundingBox(validBbox, 1000, 800)).toBe(true);
      expect(validBoundingBox(invalidBbox1, 1000, 800)).toBe(false);
      expect(validBoundingBox(invalidBbox2, 1000, 800)).toBe(false);
      expect(validBoundingBox(invalidBbox3, 1000, 800)).toBe(false);
    });

    it("should validate unique IDs correctly", () => {
      const uniqueItems = [
        { id: "1", name: "Item 1" },
        { id: "2", name: "Item 2" },
        { id: "3", name: "Item 3" },
      ];
      const duplicateItems = [
        { id: "1", name: "Item 1" },
        { id: "1", name: "Item 2" }, // Duplicate ID
        { id: "3", name: "Item 3" },
      ];

      expect(uniqueIds(uniqueItems)).toBe(true);
      expect(uniqueIds(duplicateItems)).toBe(false);
    });

    it("should validate timestamps correctly", () => {
      expect(validTimestamps(1000, 2000, 3000)).toBe(true);
      expect(validTimestamps(1000, -1, 3000)).toBe(false);
      expect(validTimestamps(0, 2000, 3000)).toBe(false);
      expect(validTimestamps(1000, Date.now() * 3, 3000)).toBe(false);
    });
  });

  describe("Property Test Helpers", () => {
    it("should run standard property tests successfully", () => {
      const property = standardProperty(
        fc.integer({ min: 1, max: 100 }),
        (num) => {
          expect(num).toBeGreaterThan(0);
          expect(num).toBeLessThanOrEqual(100);
        }
      );
      
      expect(() => runPropertyTest(property, lightConfig)).not.toThrow();
    });

    it("should run async property tests successfully", async () => {
      const property = standardAsyncProperty(
        fc.integer({ min: 1, max: 100 }),
        async (num) => {
          expect(num).toBeGreaterThan(0);
          expect(num).toBeLessThanOrEqual(100);
          // Simulate async work
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      );
      
      await expect(runAsyncPropertyTest(property, lightConfig)).resolves.toBeUndefined();
    });

    it("should handle different configurations", () => {
      const lightProperty = standardProperty(
        fc.boolean(),
        (bool) => {
          expect(typeof bool).toBe("boolean");
        }
      );
      
      const heavyProperty = standardProperty(
        fc.boolean(),
        (bool) => {
          expect(typeof bool).toBe("boolean");
        }
      );

      expect(() => runPropertyTest(lightProperty, lightConfig)).not.toThrow();
      expect(() => runPropertyTest(heavyProperty, heavyConfig)).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle property test failures gracefully", () => {
      const failingProperty = standardProperty(
        fc.integer({ min: 1, max: 100 }),
        (num) => {
          expect(num).toBeGreaterThan(50); // This will fail for numbers <= 50
        }
      );

      // This should throw an error due to failing property
      expect(() => runPropertyTest(failingProperty, lightConfig)).toThrow();
    });

    it("should handle async property test failures gracefully", async () => {
      const failingProperty = standardAsyncProperty(
        fc.integer({ min: 1, max: 100 }),
        async (num) => {
          expect(num).toBeGreaterThan(50); // This will fail for numbers <= 50
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      );

      // This should throw an error due to failing property
      await expect(runAsyncPropertyTest(failingProperty, lightConfig)).rejects.toThrow();
    });
  });
});
