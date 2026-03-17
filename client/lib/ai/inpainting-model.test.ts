// AI-META-BEGIN
// AI-META: Comprehensive tests for generative inpainting model service
// OWNERSHIP: client/lib/ai
// ENTRYPOINTS: run by vitest during testing
// DEPENDENCIES: vitest, tflite.ts, inpainting-model.ts, fast-check
// DANGER: Tests validate generative AI infrastructure correctness and privacy
// CHANGE-SAFETY: Add new tests for additional model types and quality metrics
// TESTS: npm run test:watch
// AI-META-END

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fc from "fast-check";
import {
  InpaintingModelService,
  getInpaintingModelService,
  cleanupInpaintingModelService,
  resetInpaintingModelServiceForTesting,
  InpaintingRequest,
  InpaintingMask,
  InpaintingConfig,
} from "./inpainting-model";

// Mock react-native-fast-tflite
vi.mock("react-native-fast-tflite", () => ({
  loadTensorflowModel: vi.fn(),
  TensorflowModel: vi.fn(),
}));

// Mock Platform
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    Version: "15.0",
  },
  InteractionManager: {
    runAfterInteractions: vi.fn((callback) => callback()),
  },
}));

describe("InpaintingModelService", () => {
  let service: InpaintingModelService;

  beforeEach(() => {
    resetInpaintingModelServiceForTesting();
    service = getInpaintingModelService();
  });

  afterEach(async () => {
    await cleanupInpaintingModelService();
  });

  describe("Initialization", () => {
    it("should create service instance", () => {
      expect(service).toBeDefined();
    });

    it("should initialize with default configuration", () => {
      const config = service.getConfig();
      expect(config.maxImageSize).toBe(512);
      expect(config.minMaskSize).toBe(16);
      expect(config.inferencePasses).toBe(1);
      expect(config.useContextAware).toBe(true);
    });

    it("should accept custom configuration", () => {
      resetInpaintingModelServiceForTesting();
      const customService = getInpaintingModelService({
        maxImageSize: 256,
        minMaskSize: 8,
        inferencePasses: 2,
      });

      const config = customService.getConfig();
      expect(config.maxImageSize).toBe(256);
      expect(config.minMaskSize).toBe(8);
      expect(config.inferencePasses).toBe(2);
    });

    it("should get performance statistics", () => {
      const stats = service.getStats();
      expect(stats).toHaveProperty("totalInpaintings");
      expect(stats).toHaveProperty("averageProcessingTime");
      expect(stats).toHaveProperty("averageQuality");
      expect(stats).toHaveProperty("modelLoadTime");
      expect(stats).toHaveProperty("memoryUsageMB");
    });
  });

  describe("Request Validation", () => {
    const createValidRequest = (): InpaintingRequest => ({
      imageData: new Uint8Array(100 * 100 * 3),
      imageWidth: 100,
      imageHeight: 100,
      mask: {
        mask: new Uint8Array(100 * 100),
        width: 100,
        height: 100,
        boundingBox: { x: 10, y: 10, width: 20, height: 20 },
      },
      quality: "balanced",
    });

    it("should accept valid inpainting request", async () => {
      const request = createValidRequest();

      // Mock successful model loading
      vi.mocked(
        require("react-native-fast-tflite").loadTensorflowModel,
      ).mockResolvedValue({} as any);

      await expect(service.inpaint(request)).resolves.toBeDefined();
    });

    it("should reject request with invalid image data", async () => {
      const request = {
        ...createValidRequest(),
        imageData: new Uint8Array(0),
      };

      await expect(service.inpaint(request)).rejects.toThrow(
        "Invalid image data",
      );
    });

    it("should reject request with invalid image dimensions", async () => {
      const request = {
        ...createValidRequest(),
        imageWidth: 0,
        imageHeight: 100,
      };

      await expect(service.inpaint(request)).rejects.toThrow(
        "Invalid image dimensions",
      );
    });

    it("should reject request with invalid mask data", async () => {
      const request = {
        ...createValidRequest(),
        mask: {
          mask: new Uint8Array(0),
          width: 100,
          height: 100,
          boundingBox: { x: 10, y: 10, width: 20, height: 20 },
        },
      };

      await expect(service.inpaint(request)).rejects.toThrow(
        "Invalid mask data",
      );
    });

    it("should reject request with mismatched image data size", async () => {
      const request = {
        ...createValidRequest(),
        imageData: new Uint8Array(50 * 100 * 3), // Wrong size
      };

      await expect(service.inpaint(request)).rejects.toThrow(
        "Image data size mismatch",
      );
    });

    it("should reject request with mismatched mask data size", async () => {
      const request = {
        ...createValidRequest(),
        mask: {
          mask: new Uint8Array(50 * 100), // Wrong size
          width: 100,
          height: 100,
          boundingBox: { x: 10, y: 10, width: 20, height: 20 },
        },
      };

      await expect(service.inpaint(request)).rejects.toThrow(
        "Mask data size mismatch",
      );
    });

    it("should reject request with mask too small", async () => {
      const request = {
        ...createValidRequest(),
        mask: {
          mask: new Uint8Array(100 * 100),
          width: 100,
          height: 100,
          boundingBox: { x: 10, y: 10, width: 8, height: 8 }, // Too small
        },
      };

      await expect(service.inpaint(request)).rejects.toThrow("Mask too small");
    });
  });

  describe("Inpainting Processing", () => {
    const createValidRequest = (): InpaintingRequest => ({
      imageData: new Uint8Array(100 * 100 * 3).fill(128),
      imageWidth: 100,
      imageHeight: 100,
      mask: {
        mask: new Uint8Array(100 * 100).fill(0),
        width: 100,
        height: 100,
        boundingBox: { x: 10, y: 10, width: 20, height: 20 },
      },
      quality: "balanced",
    });

    beforeEach(() => {
      // Set some mask pixels to indicate inpainting region
      const request = createValidRequest();
      for (let y = 10; y < 30; y++) {
        for (let x = 10; x < 30; x++) {
          request.mask.mask[y * 100 + x] = 255;
        }
      }
    });

    it("should perform inpainting with mock model", async () => {
      const request = createValidRequest();

      // Set some mask pixels
      for (let y = 10; y < 30; y++) {
        for (let x = 10; x < 30; x++) {
          request.mask.mask[y * 100 + x] = 255;
        }
      }

      const result = await service.inpaint(request);

      expect(result).toBeDefined();
      expect(result.imageData).toBeInstanceOf(Uint8Array);
      expect(result.width).toBeGreaterThan(0);
      expect(result.height).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.quality).toBeDefined();
      expect(result.quality.coherence).toBeGreaterThanOrEqual(0);
      expect(result.quality.realism).toBeGreaterThanOrEqual(0);
      expect(result.quality.seamlessness).toBeGreaterThanOrEqual(0);
    });

    it("should handle different quality settings", async () => {
      const request = createValidRequest();

      // Set some mask pixels
      for (let y = 10; y < 30; y++) {
        for (let x = 10; x < 30; x++) {
          request.mask.mask[y * 100 + x] = 255;
        }
      }

      const qualities: ('fast' | 'balanced' | 'high')[] = ['fast', 'balanced', 'high'];

      for (const quality of qualities) {
        const qualityRequest = { ...request, quality };
        const result = await service.inpaint(qualityRequest);

        expect(result).toBeDefined();
        expect(result.confidence).toBeGreaterThanOrEqual(0);
      }
    });

    it("should handle context prompts", async () => {
      const request = {
        ...createValidRequest(),
        contextPrompt: "remove person from background",
      };

      // Set some mask pixels
      for (let y = 10; y < 30; y++) {
        for (let x = 10; x < 30; x++) {
          request.mask.mask[y * 100 + x] = 255;
        }
      }

      const result = await service.inpaint(request);

      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it("should update statistics after processing", async () => {
      const initialStats = service.getStats();

      const request = createValidRequest();

      // Set some mask pixels
      for (let y = 10; y < 30; y++) {
        for (let x = 10; x < 30; x++) {
          request.mask.mask[y * 100 + x] = 255;
        }
      }

      await service.inpaint(request);

      const finalStats = service.getStats();
      expect(finalStats.totalInpaintings).toBe(
        initialStats.totalInpaintings + 1,
      );
      expect(finalStats.averageProcessingTime).toBeGreaterThanOrEqual(0);
      expect(finalStats.averageQuality).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Quality Metrics", () => {
    it("should calculate coherence metrics correctly", async () => {
      const request: InpaintingRequest = {
        imageData: new Uint8Array(50 * 50 * 3).fill(128), // Uniform image
        imageWidth: 50,
        imageHeight: 50,
        mask: {
          mask: new Uint8Array(50 * 50).fill(255), // Full mask
          width: 50,
          height: 50,
          boundingBox: { x: 0, y: 0, width: 50, height: 50 },
        },
        quality: "high",
      };

      const result = await service.inpaint(request);

      expect(result.quality.coherence).toBeGreaterThanOrEqual(0);
      expect(result.quality.coherence).toBeLessThanOrEqual(1);
    });

    it("should calculate realism metrics correctly", async () => {
      const request: InpaintingRequest = {
        imageData: new Uint8Array(50 * 50 * 3).fill(128),
        imageWidth: 50,
        imageHeight: 50,
        mask: {
          mask: new Uint8Array(50 * 50).fill(255),
          width: 50,
          height: 50,
          boundingBox: { x: 0, y: 0, width: 50, height: 50 },
        },
        quality: "high",
      };

      const result = await service.inpaint(request);

      expect(result.quality.realism).toBeGreaterThanOrEqual(0);
      expect(result.quality.realism).toBeLessThanOrEqual(1);
    });

    it("should calculate seamlessness metrics correctly", async () => {
      const request: InpaintingRequest = {
        imageData: new Uint8Array(50 * 50 * 3).fill(128),
        imageWidth: 50,
        imageHeight: 50,
        mask: {
          mask: new Uint8Array(50 * 50).fill(0), // Start with no mask
          width: 50,
          height: 50,
          boundingBox: { x: 10, y: 10, width: 10, height: 10 },
        },
        quality: "high",
      };

      // Create a mask with clear boundaries
      for (let y = 15; y < 25; y++) {
        for (let x = 15; x < 25; x++) {
          request.mask.mask[y * 50 + x] = 255;
        }
      }

      const result = await service.inpaint(request);

      expect(result.quality.seamlessness).toBeGreaterThanOrEqual(0);
      expect(result.quality.seamlessness).toBeLessThanOrEqual(1);
    });
  });

  describe("Image Processing", () => {
    it("should handle image resizing correctly", async () => {
      const request: InpaintingRequest = {
        imageData: new Uint8Array(200 * 200 * 3).fill(128),
        imageWidth: 200,
        imageHeight: 200,
        mask: {
          mask: new Uint8Array(200 * 200).fill(255),
          width: 200,
          height: 200,
          boundingBox: { x: 0, y: 0, width: 200, height: 200 },
        },
        quality: "balanced",
      };

      const result = await service.inpaint(request);

      // Result should be resized to maxImageSize (512) or smaller
      expect(result.width).toBeLessThanOrEqual(512);
      expect(result.height).toBeLessThanOrEqual(512);
      expect(result.imageData.length).toBe(result.width * result.height * 3);
    });

    it("should handle different aspect ratios", async () => {
      const requests: InpaintingRequest[] = [
        {
          imageData: new Uint8Array(100 * 50 * 3).fill(128),
          imageWidth: 100,
          imageHeight: 50,
          mask: {
            mask: new Uint8Array(100 * 50).fill(255),
            width: 100,
            height: 50,
            boundingBox: { x: 0, y: 0, width: 100, height: 50 },
          },
          quality: "balanced",
        },
        {
          imageData: new Uint8Array(50 * 100 * 3).fill(128),
          imageWidth: 50,
          imageHeight: 100,
          mask: {
            mask: new Uint8Array(50 * 100).fill(255),
            width: 50,
            height: 100,
            boundingBox: { x: 0, y: 0, width: 50, height: 100 },
          },
          quality: "balanced",
        },
      ];

      for (const request of requests) {
        const result = await service.inpaint(request);
        expect(result).toBeDefined();
        expect(result.width).toBeGreaterThan(0);
        expect(result.height).toBeGreaterThan(0);
      }
    });
  });

  describe("Configuration Management", () => {
    it("should update configuration", () => {
      const newConfig: Partial<InpaintingConfig> = {
        maxImageSize: 256,
        minMaskSize: 8,
        inferencePasses: 3,
        useContextAware: false,
      };

      service.updateConfig(newConfig);

      const config = service.getConfig();
      expect(config.maxImageSize).toBe(256);
      expect(config.minMaskSize).toBe(8);
      expect(config.inferencePasses).toBe(3);
      expect(config.useContextAware).toBe(false);
    });

    it("should preserve unspecified configuration values", () => {
      const originalConfig = service.getConfig();

      service.updateConfig({ maxImageSize: 256 });

      const newConfig = service.getConfig();
      expect(newConfig.maxImageSize).toBe(256);
      expect(newConfig.minMaskSize).toBe(originalConfig.minMaskSize);
      expect(newConfig.inferencePasses).toBe(originalConfig.inferencePasses);
      expect(newConfig.useContextAware).toBe(originalConfig.useContextAware);
    });
  });

  describe("Property Tests", () => {
    it("Property 1: Configuration consistency - updated config should be reflected in getter", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(
            fc.record({
              maxImageSize: fc.integer({ min: 64, max: 1024 }),
              minMaskSize: fc.integer({ min: 4, max: 64 }),
              inferencePasses: fc.integer({ min: 1, max: 5 }),
              useContextAware: fc.boolean(),
            }),
            async (configUpdate) => {
              service.updateConfig(configUpdate);
              const currentConfig = service.getConfig();

              Object.entries(configUpdate).forEach(([key, value]) => {
                expect(currentConfig[key as keyof InpaintingConfig]).toBe(
                  value,
                );
              });
            },
          ),
          { numRuns: 10 },
        ),
      ).resolves.toBeUndefined();
    });

    it("Property 2: Statistics bounds - all statistics should remain within valid ranges", async () => {
      await expect(
        fc.assert(
          fc.asyncProperty(fc.constant(null), async () => {
            const stats = service.getStats();

            expect(stats.totalInpaintings).toBeGreaterThanOrEqual(0);
            expect(stats.averageProcessingTime).toBeGreaterThanOrEqual(0);
            expect(stats.averageQuality).toBeGreaterThanOrEqual(0);
            expect(stats.averageQuality).toBeLessThanOrEqual(1);
            expect(stats.modelLoadTime).toBeGreaterThanOrEqual(0);
            expect(stats.memoryUsageMB).toBeGreaterThanOrEqual(0);
            expect(stats.contextAwareUsage).toBeGreaterThanOrEqual(0);
          }),
          { numRuns: 5 },
        ),
      ).resolves.toBeUndefined();
    });

    it("Property 3: Result format consistency - all results should have valid structure", async () => {
      const validRequestGenerator = fc
        .record({
          imageData: fc.uint8Array({ minLength: 100, maxLength: 1000 }),
          imageWidth: fc.integer({ min: 10, max: 100 }),
          imageHeight: fc.integer({ min: 10, max: 100 }),
          quality: fc.constantFrom("fast", "balanced", "high"),
        })
        .chain(({ imageData, imageWidth, imageHeight, quality }) => {
          // Ensure image data size matches dimensions
          const expectedSize = imageWidth * imageHeight * 3;
          const sizedImageData =
            imageData.length >= expectedSize
              ? imageData.slice(0, expectedSize)
              : new Uint8Array(expectedSize).fill(128);

          return fc.constant({
            imageData: sizedImageData,
            imageWidth,
            imageHeight,
            quality,
            mask: {
              mask: new Uint8Array(imageWidth * imageHeight).fill(0),
              width: imageWidth,
              height: imageHeight,
              boundingBox: { x: 5, y: 5, width: 10, height: 10 },
            },
          });
        });

      await expect(
        fc.assert(
          fc.asyncProperty(validRequestGenerator, async (request) => {
            const result = await service.inpaint(request);

            expect(result.imageData).toBeInstanceOf(Uint8Array);
            expect(result.width).toBeGreaterThan(0);
            expect(result.height).toBeGreaterThan(0);
            expect(result.confidence).toBeGreaterThanOrEqual(0);
            expect(result.confidence).toBeLessThanOrEqual(1);
            expect(result.processingTime).toBeGreaterThanOrEqual(0);
            expect(result.timestamp).toBeGreaterThan(0);

            expect(result.quality.coherence).toBeGreaterThanOrEqual(0);
            expect(result.quality.coherence).toBeLessThanOrEqual(1);
            expect(result.quality.realism).toBeGreaterThanOrEqual(0);
            expect(result.quality.realism).toBeLessThanOrEqual(1);
            expect(result.quality.seamlessness).toBeGreaterThanOrEqual(0);
            expect(result.quality.seamlessness).toBeLessThanOrEqual(1);
          }),
          { numRuns: 5 },
        ),
      ).resolves.toBeUndefined();
    });
  });
});

describe("InpaintingModelService Edge Cases", () => {
  let service: InpaintingModelService;

  beforeEach(() => {
    resetInpaintingModelServiceForTesting();
    service = getInpaintingModelService();
  });

  afterEach(async () => {
    await cleanupInpaintingModelService();
  });

  it("should handle concurrent inpainting requests", async () => {
    const requests: InpaintingRequest[] = [
      {
        imageData: new Uint8Array(50 * 50 * 3).fill(128),
        imageWidth: 50,
        imageHeight: 50,
        mask: {
          mask: new Uint8Array(50 * 50).fill(255),
          width: 50,
          height: 50,
          boundingBox: { x: 0, y: 0, width: 50, height: 50 },
        },
        quality: "fast",
      },
      {
        imageData: new Uint8Array(60 * 60 * 3).fill(100),
        imageWidth: 60,
        imageHeight: 60,
        mask: {
          mask: new Uint8Array(60 * 60).fill(255),
          width: 60,
          height: 60,
          boundingBox: { x: 0, y: 0, width: 60, height: 60 },
        },
        quality: "balanced",
      },
      {
        imageData: new Uint8Array(40 * 40 * 3).fill(150),
        imageWidth: 40,
        imageHeight: 40,
        mask: {
          mask: new Uint8Array(40 * 40).fill(255),
          width: 40,
          height: 40,
          boundingBox: { x: 0, y: 0, width: 40, height: 40 },
        },
        quality: "high",
      },
    ];

    // Process requests concurrently
    const promises = requests.map((request) => service.inpaint(request));
    const results = await Promise.all(promises);

    expect(results).toHaveLength(3);
    results.forEach((result) => {
      expect(result).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  it("should handle cleanup during processing", async () => {
    const request: InpaintingRequest = {
      imageData: new Uint8Array(100 * 100 * 3).fill(128),
      imageWidth: 100,
      imageHeight: 100,
      mask: {
        mask: new Uint8Array(100 * 100).fill(255),
        width: 100,
        height: 100,
        boundingBox: { x: 0, y: 0, width: 100, height: 100 },
      },
      quality: "high",
    };

    // Start processing
    const processingPromise = service.inpaint(request);

    // Cleanup while processing (should not affect ongoing processing)
    await service.cleanup();

    // Processing should complete without throwing
    await expect(processingPromise).resolves.toBeDefined();
  });

  it("should handle very large images gracefully", async () => {
    const request: InpaintingRequest = {
      imageData: new Uint8Array(1000 * 1000 * 3).fill(128),
      imageWidth: 1000,
      imageHeight: 1000,
      mask: {
        mask: new Uint8Array(1000 * 1000).fill(255),
        width: 1000,
        height: 1000,
        boundingBox: { x: 0, y: 0, width: 1000, height: 1000 },
      },
      quality: "fast",
    };

    const result = await service.inpaint(request);

    expect(result).toBeDefined();
    // Should be resized to maxImageSize
    expect(result.width).toBeLessThanOrEqual(512);
    expect(result.height).toBeLessThanOrEqual(512);
  });

  it("should handle very small images gracefully", async () => {
    const request: InpaintingRequest = {
      imageData: new Uint8Array(20 * 20 * 3).fill(128),
      imageWidth: 20,
      imageHeight: 20,
      mask: {
        mask: new Uint8Array(20 * 20).fill(255),
        width: 20,
        height: 20,
        boundingBox: { x: 0, y: 0, width: 20, height: 20 },
      },
      quality: "high",
    };

    const result = await service.inpaint(request);

    expect(result).toBeDefined();
    expect(result.width).toBe(20);
    expect(result.height).toBe(20);
  });
});
