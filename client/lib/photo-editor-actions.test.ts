// AI-META-BEGIN
// AI-META: Comprehensive test suite for photo editor action utilities
// OWNERSHIP: client/lib
// ENTRYPOINTS: test runner for photo editing functionality
// DEPENDENCIES: vitest, expo-image-manipulator mocks
// DANGER: Critical for ensuring photo editing reliability
// CHANGE-SAFETY: Maintain test coverage with new features
// TESTS: Unit tests for all photo editor actions, edge cases, error handling
// AI-META-END

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  rotatePhoto,
  flipPhoto,
  cropPhoto,
  rotateAndFlipPhoto,
  getImageDimensions,
  validateCropSettings,
  calculateAspectRatioCrop,
  ASPECT_RATIOS,
  AspectRatioKey,
  CropSettings,
  FlipSettings,
} from "../photo-editor-actions";

// Mock expo-image-manipulator
vi.mock("expo-image-manipulator", () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: {
    JPEG: "jpeg",
    PNG: "png",
  },
  FlipType: {
    Horizontal: "horizontal",
    Vertical: "vertical",
  },
}));

// Mock InteractionManager
vi.mock("react-native", () => ({
  InteractionManager: {
    runAfterInteractions: vi.fn((callback) => callback()),
  },
}));

import * as ImageManipulator from "expo-image-manipulator";

describe("Photo Editor Actions", () => {
  const mockUri = "file://test-image.jpg";
  const mockResult = { uri: "file://rotated-image.jpg" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ImageManipulator.manipulateAsync).mockResolvedValue(mockResult);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("rotatePhoto", () => {
    it("should rotate photo by 90 degrees", async () => {
      vi.mocked(ImageManipulator.manipulateAsync).mockResolvedValue(mockResult);
      
      const result = await rotatePhoto(mockUri, 90);
      
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockUri,
        [{ rotate: 90 }],
        { compress: 0.95, format: "jpeg" }
      );
      expect(result).toBe(mockResult.uri);
    });

    it("should rotate photo by 180 degrees", async () => {
      await rotatePhoto(mockUri, 180);
      
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockUri,
        [{ rotate: 180 }],
        { compress: 0.95, format: "jpeg" }
      );
    });

    it("should rotate photo by 270 degrees", async () => {
      await rotatePhoto(mockUri, 270);
      
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockUri,
        [{ rotate: 270 }],
        { compress: 0.95, format: "jpeg" }
      );
    });

    it("should handle rotation errors gracefully", async () => {
      const error = new Error("Rotation failed");
      vi.mocked(ImageManipulator.manipulateAsync).mockRejectedValue(error);
      
      await expect(rotatePhoto(mockUri, 90)).rejects.toThrow("Failed to rotate photo: Rotation failed");
    });
  });

  describe("flipPhoto", () => {
    it("should flip photo horizontally", async () => {
      const flipSettings: FlipSettings = { horizontal: true, vertical: false };
      
      await flipPhoto(mockUri, flipSettings);
      
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockUri,
        [{ flip: "horizontal" }],
        { compress: 0.95, format: "jpeg" }
      );
    });

    it("should flip photo vertically", async () => {
      const flipSettings: FlipSettings = { horizontal: false, vertical: true };
      
      await flipPhoto(mockUri, flipSettings);
      
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockUri,
        [{ flip: "vertical" }],
        { compress: 0.95, format: "jpeg" }
      );
    });

    it("should flip photo both horizontally and vertically", async () => {
      const flipSettings: FlipSettings = { horizontal: true, vertical: true };
      
      await flipPhoto(mockUri, flipSettings);
      
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockUri,
        [
          { flip: "horizontal" },
          { flip: "vertical" },
        ],
        { compress: 0.95, format: "jpeg" }
      );
    });

    it("should return original URI if no flip operations", async () => {
      const flipSettings: FlipSettings = { horizontal: false, vertical: false };
      
      const result = await flipPhoto(mockUri, flipSettings);
      
      expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
      expect(result).toBe(mockUri);
    });

    it("should handle flip errors gracefully", async () => {
      const error = new Error("Flip failed");
      vi.mocked(ImageManipulator.manipulateAsync).mockRejectedValue(error);
      
      await expect(flipPhoto(mockUri, { horizontal: true, vertical: false }))
        .rejects.toThrow("Failed to flip photo: Flip failed");
    });
  });

  describe("cropPhoto", () => {
    const validCropSettings: CropSettings = {
      originX: 100,
      originY: 100,
      width: 800,
      height: 600,
    };

    it("should crop photo with valid settings", async () => {
      await cropPhoto(mockUri, validCropSettings);
      
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockUri,
        [{ crop: validCropSettings }],
        { compress: 0.95, format: "jpeg" }
      );
    });

    it("should reject invalid crop settings with negative dimensions", async () => {
      const invalidCropSettings: CropSettings = {
        originX: 100,
        originY: 100,
        width: -100,
        height: 600,
      };
      
      await expect(cropPhoto(mockUri, invalidCropSettings))
        .rejects.toThrow("Invalid crop settings: dimensions must be positive and origin must be non-negative");
    });

    it("should reject invalid crop settings with negative origin", async () => {
      const invalidCropSettings: CropSettings = {
        originX: -10,
        originY: 100,
        width: 800,
        height: 600,
      };
      
      await expect(cropPhoto(mockUri, invalidCropSettings))
        .rejects.toThrow("Invalid crop settings: dimensions must be positive and origin must be non-negative");
    });

    it("should handle crop errors gracefully", async () => {
      const error = new Error("Crop failed");
      vi.mocked(ImageManipulator.manipulateAsync).mockRejectedValue(error);
      
      await expect(cropPhoto(mockUri, validCropSettings))
        .rejects.toThrow("Failed to crop photo: Crop failed");
    });
  });

  describe("rotateAndFlipPhoto", () => {
    it("should apply both rotation and flip", async () => {
      const settings = {
        degrees: 90,
        flipHorizontal: true,
        flipVertical: false,
      };
      
      await rotateAndFlipPhoto(mockUri, settings);
      
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockUri,
        [
          { rotate: 90 },
          { flip: "horizontal" },
        ],
        { compress: 0.95, format: "jpeg" }
      );
    });

    it("should return original URI if no operations", async () => {
      const settings = {
        degrees: 0,
        flipHorizontal: false,
        flipVertical: false,
      };
      
      const result = await rotateAndFlipPhoto(mockUri, settings);
      
      expect(ImageManipulator.manipulateAsync).not.toHaveBeenCalled();
      expect(result).toBe(mockUri);
    });
  });

  describe("getImageDimensions", () => {
    it("should return placeholder dimensions", async () => {
      const result = await getImageDimensions(mockUri);
      
      expect(result).toEqual({ width: 1000, height: 1000 });
      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
        mockUri,
        [],
        { format: "jpeg" }
      );
    });

    it("should handle dimension errors gracefully", async () => {
      const error = new Error("Failed to get dimensions");
      vi.mocked(ImageManipulator.manipulateAsync).mockRejectedValue(error);
      
      await expect(getImageDimensions(mockUri))
        .rejects.toThrow("Failed to get image dimensions: Failed to get dimensions");
    });
  });

  describe("validateCropSettings", () => {
    const imageDimensions = { width: 1000, height: 800 };

    it("should validate correct crop settings", () => {
      const validCrop: CropSettings = {
        originX: 100,
        originY: 100,
        width: 800,
        height: 600,
      };
      
      expect(validateCropSettings(validCrop, imageDimensions)).toBe(true);
    });

    it("should reject crop outside image bounds", () => {
      const invalidCrop: CropSettings = {
        originX: 900,
        originY: 100,
        width: 200,
        height: 600,
      };
      
      expect(validateCropSettings(invalidCrop, imageDimensions)).toBe(false);
    });

    it("should reject crop with negative origin", () => {
      const invalidCrop: CropSettings = {
        originX: -10,
        originY: 100,
        width: 800,
        height: 600,
      };
      
      expect(validateCropSettings(invalidCrop, imageDimensions)).toBe(false);
    });

    it("should reject crop with zero dimensions", () => {
      const invalidCrop: CropSettings = {
        originX: 100,
        originY: 100,
        width: 0,
        height: 600,
      };
      
      expect(validateCropSettings(invalidCrop, imageDimensions)).toBe(false);
    });

    it("should reject crop with dimensions too small", () => {
      const invalidCrop: CropSettings = {
        originX: 100,
        originY: 100,
        width: 30,
        height: 600,
      };
      
      expect(validateCropSettings(invalidCrop, imageDimensions)).toBe(false);
    });
  });

  describe("calculateAspectRatioCrop", () => {
    const imageDimensions = { width: 1000, height: 800 };

    it("should calculate freeform crop", () => {
      const result = calculateAspectRatioCrop(null, imageDimensions);
      
      expect(result.originX).toBe(100);
      expect(result.originY).toBe(80);
      expect(result.width).toBe(800);
      expect(result.height).toBe(640);
    });

    it("should calculate square aspect ratio", () => {
      const result = calculateAspectRatioCrop(1, imageDimensions);
      
      expect(result.width).toBe(640);
      expect(result.height).toBe(640);
      expect(result.originX).toBe(180);
      expect(result.originY).toBe(80);
    });

    it("should calculate 4:3 aspect ratio", () => {
      const result = calculateAspectRatioCrop(4 / 3, imageDimensions);
      
      expect(Math.round(result.width)).toBe(800);
      expect(Math.round(result.height)).toBe(600);
    });

    it("should calculate 16:9 aspect ratio", () => {
      const result = calculateAspectRatioCrop(16 / 9, imageDimensions);
      
      expect(Math.round(result.width)).toBe(800);
      expect(Math.round(result.height)).toBe(450);
    });

    it("should handle portrait images correctly", () => {
      const portraitImage = { width: 800, height: 1000 };
      const result = calculateAspectRatioCrop(1, portraitImage);
      
      expect(result.width).toBe(640);
      expect(result.height).toBe(640);
      expect(result.originX).toBe(80);
      expect(result.originY).toBe(180);
    });
  });

  describe("ASPECT_RATIOS constants", () => {
    it("should contain all expected aspect ratios", () => {
      expect(ASPECT_RATIOS).toHaveProperty("FREE", null);
      expect(ASPECT_RATIOS).toHaveProperty("SQUARE", 1);
      expect(ASPECT_RATIOS).toHaveProperty("FOUR_THREE", 4 / 3);
      expect(ASPECT_RATIOS).toHaveProperty("SIXTEEN_NINE", 16 / 9);
      expect(ASPECT_RATIOS).toHaveProperty("THREE_TWO", 3 / 2);
      expect(ASPECT_RATIOS).toHaveProperty("FIVE_FOUR", 5 / 4);
    });

    it("should have correct aspect ratio values", () => {
      expect(ASPECT_RATIOS.SQUARE).toBe(1);
      expect(ASPECT_RATIOS.FOUR_THREE).toBeCloseTo(1.333);
      expect(ASPECT_RATIOS.SIXTEEN_NINE).toBeCloseTo(1.778);
      expect(ASPECT_RATIOS.THREE_TWO).toBe(1.5);
      expect(ASPECT_RATIOS.FIVE_FOUR).toBe(1.25);
    });
  });

  describe("Integration Tests", () => {
    it("should handle complex edit sequence", async () => {
      // Simulate a typical editing workflow
      const cropSettings: CropSettings = {
        originX: 100,
        originY: 100,
        width: 800,
        height: 600,
      };

      // Step 1: Crop
      const croppedUri = await cropPhoto(mockUri, cropSettings);
      expect(croppedUri).toBe(mockResult.uri);

      // Step 2: Rotate
      const rotatedUri = await rotatePhoto(croppedUri, 90);
      expect(rotatedUri).toBe(mockResult.uri);

      // Step 3: Flip
      const flipSettings: FlipSettings = { horizontal: true, vertical: false };
      const finalUri = await flipPhoto(rotatedUri, flipSettings);
      expect(finalUri).toBe(mockResult.uri);

      expect(ImageManipulator.manipulateAsync).toHaveBeenCalledTimes(3);
    });

    it("should handle error recovery", async () => {
      // Simulate a failed operation followed by a successful one
      vi.mocked(ImageManipulator.manipulateAsync)
        .mockRejectedValueOnce(new Error("First operation failed"))
        .mockResolvedValueOnce(mockResult);

      // First operation fails
      await expect(rotatePhoto(mockUri, 90)).rejects.toThrow();

      // Second operation succeeds
      const result = await flipPhoto(mockUri, { horizontal: true, vertical: false });
      expect(result).toBe(mockResult.uri);
    });
  });

  describe("Performance Tests", () => {
    it("should handle large crop operations efficiently", async () => {
      const largeCrop: CropSettings = {
        originX: 0,
        originY: 0,
        width: 4000,
        height: 3000,
      };

      const startTime = performance.now();
      await cropPhoto(mockUri, largeCrop);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it("should handle multiple operations in sequence", async () => {
      const operations = [
        () => rotatePhoto(mockUri, 90),
        () => flipPhoto(mockUri, { horizontal: true, vertical: false }),
        () => cropPhoto(mockUri, { originX: 100, originY: 100, width: 800, height: 600 }),
      ];

      const startTime = performance.now();
      await Promise.all(operations.map(op => op()));
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });
});
