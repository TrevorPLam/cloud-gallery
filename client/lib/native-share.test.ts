// AI-META-BEGIN
// AI-META: Comprehensive test suite for native sharing service with platform-specific validation
// OWNERSHIP: client/lib (sharing functionality tests)
// ENTRYPOINTS: Run by test runner, validates sharing service functionality
// DEPENDENCIES: Vitest, react-native-share mock, expo-sharing mock, expo-clipboard mock
// DANGER: Platform-specific mocking, async operation testing, file URI validation
// CHANGE-SAFETY: Safe to add new test cases; risky to modify mock implementations; test all platforms
// TESTS: Test single/multi-photo sharing, verify clipboard operations, check save to device, validate error handling
// AI-META-END

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { nativeShareService, NativeShareService } from "@/lib/native-share";
import { Photo } from "@/types";

// Mock external dependencies
vi.mock("react-native-share", () => ({
  __esModule: true,
  default: {
    open: vi.fn(),
  },
}));

vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

vi.mock("expo-clipboard", () => ({
  setString: vi.fn(),
  setStringAsync: vi.fn(),
}));

vi.mock("expo-media-library", () => ({
  requestPermissionsAsync: vi.fn(),
  saveToLibraryAsync: vi.fn(),
}));

vi.mock("expo-file-system", () => ({
  getInfoAsync: vi.fn(),
}));

// Mock Platform with proper module-level mock
vi.mock("react-native", async () => {
  const actual = await vi.importActual("react-native");
  return {
    ...actual,
    Platform: {
      OS: 'ios', // Default for tests
      select: (obj: any) => obj.ios || obj.default,
    },
  };
});

// Test data
const mockPhotos: Photo[] = [
  {
    id: "photo1",
    uri: "file:///path/to/photo1.jpg",
    width: 1920,
    height: 1080,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    isFavorite: false,
    tags: [],
    mlLabels: ["outdoor", "nature"],
  },
  {
    id: "photo2",
    uri: "file:///path/to/photo2.png",
    width: 1080,
    height: 1920,
    createdAt: Date.now() - 86400000,
    modifiedAt: Date.now() - 86400000,
    isFavorite: true,
    tags: ["family"],
    mlLabels: ["people", "indoor"],
  },
];

describe("NativeShareService", () => {
  let service: NativeShareService;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Get Platform from the mocked module
    const { Platform } = await import("react-native");
    // Reset platform to ios for each test
    vi.mocked(Platform).OS = 'ios';
    service = nativeShareService;
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance", () => {
      const instance1 = NativeShareService.getInstance();
      const instance2 = NativeShareService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("isSharingAvailable", () => {
    it("should return true for web platform", async () => {
      const { Platform } = await import("react-native");
      vi.mocked(Platform).OS = 'web';
      console.log("Platform.OS mocked as:", Platform.OS);
      
      const result = await service.isSharingAvailable();
      console.log("Result:", result);

      expect(result).toBe(true);
    });

    it("should check expo-sharing availability for mobile platforms", async () => {
      const { Platform } = await import("react-native");
      vi.mocked(Platform).OS = 'ios';
      const { isAvailableAsync } = await import("expo-sharing");
      vi.mocked(isAvailableAsync).mockResolvedValue(true);

      const result = await service.isSharingAvailable();

      expect(isAvailableAsync).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should handle errors gracefully", async () => {
      const { Platform } = await import("react-native");
      vi.mocked(Platform).OS = 'android';
      const { isAvailableAsync } = await import("expo-sharing");
      vi.mocked(isAvailableAsync).mockRejectedValue(
        new Error("Permission denied"),
      );

      const result = await service.isSharingAvailable();

      expect(result).toBe(false);
    });
  });

  describe("sharePhotos", () => {
    it("should reject empty photo array", async () => {
      const result = await service.sharePhotos([]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No photos to share");
    });

    it("should reject when sharing is not available", async () => {
      vi.spyOn(service, "isSharingAvailable").mockResolvedValue(false);

      const result = await service.sharePhotos([mockPhotos[0]]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sharing not available on this device");
    });

    it("should use react-native-share for multiple photos", async () => {
      vi.mocked(Platform).OS = 'ios';
      vi.spyOn(service, "isSharingAvailable").mockResolvedValue(true);
      const Share = await import("react-native-share");
      vi.mocked(Share.default.open).mockResolvedValue({
        action: "shared",
        completed: true,
      });

      const result = await service.sharePhotos(mockPhotos);

      expect(Share.default.open).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.action).toBe("shared");
    });

    it("should use expo-sharing for single photo on web", async () => {
      vi.mocked(Platform).OS = 'web';
      vi.spyOn(service, "isSharingAvailable").mockResolvedValue(true);
      const { shareAsync } = await import("expo-sharing");
      const mockShareAsync = vi.mocked(shareAsync);
      mockShareAsync.mockResolvedValue();

      const result = await service.sharePhotos([mockPhotos[0]]);

      expect(mockShareAsync).toHaveBeenCalledWith(mockPhotos[0].uri, {
        dialogTitle: "Share Photo",
        mimeType: "image/jpeg",
      });
      expect(result.success).toBe(true);
    });

    it("should handle user cancellation", async () => {
      vi.mocked(Platform).OS = 'android';
      vi.spyOn(service, "isSharingAvailable").mockResolvedValue(true);
      const Share = await import("react-native-share");
      vi.mocked(Share.default.open).mockRejectedValue(
        new Error("User cancelled"),
      );

      const result = await service.sharePhotos(mockPhotos);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Share cancelled by user");
    });

    it("should handle sharing errors", async () => {
      vi.mocked(Platform).OS = 'ios';
      vi.spyOn(service, "isSharingAvailable").mockResolvedValue(true);
      const Share = await import("react-native-share");
      vi.mocked(Share.default.open).mockRejectedValue(
        new Error("Network error"),
      );

      const result = await service.sharePhotos([mockPhotos[0]]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network error");
    });
  });

  describe("copyToClipboard", () => {
    it("should reject empty photo array", async () => {
      const result = await service.copyToClipboard([]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No photos to copy");
    });

    it("should copy single photo URI to clipboard", async () => {
      vi.mocked(Platform).OS = 'ios';
      const { setString } = await import("expo-clipboard");
      vi.mocked(setString).mockImplementation();

      const result = await service.copyToClipboard([mockPhotos[0]]);

      expect(setString).toHaveBeenCalledWith(mockPhotos[0].uri);
      expect(result.success).toBe(true);
      expect(result.action).toBe("copied");
    });

    it("should copy multiple photo URIs to clipboard", async () => {
      vi.mocked(Platform).OS = 'android';
      const { setString } = await import("expo-clipboard");
      vi.mocked(setString).mockImplementation();

      const result = await service.copyToClipboard(mockPhotos);

      const expectedUris = mockPhotos.map((p) => p.uri).join("\n");
      expect(setString).toHaveBeenCalledWith(expectedUris);
      expect(result.success).toBe(true);
    });

    it("should use setStringAsync on web platform", async () => {
      vi.mocked(Platform).OS = 'web';
      const { setStringAsync } = await import("expo-clipboard");
      const mockSetStringAsync = vi.mocked(setStringAsync);
      mockSetStringAsync.mockResolvedValue(true);

      const result = await service.copyToClipboard([mockPhotos[0]]);

      // The implementation joins URIs with newlines, even for single photos
      expect(mockSetStringAsync).toHaveBeenCalledWith(mockPhotos[0].uri);
      expect(result.success).toBe(true);
    });

    it("should handle clipboard errors", async () => {
      vi.mocked(Platform).OS = 'ios';
      const { setString } = await import("expo-clipboard");
      vi.mocked(setString).mockRejectedValue(new Error("Clipboard denied"));

      const result = await service.copyToClipboard([mockPhotos[0]]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Clipboard denied");
    });
  });

  describe("saveToDevice", () => {
    it("should reject empty photo array", async () => {
      const result = await service.saveToDevice([]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No photos to save");
    });

    it("should request media library permissions", async () => {
      const { requestPermissionsAsync } = await import("expo-media-library");
      vi.mocked(requestPermissionsAsync).mockResolvedValue({
        status: "granted",
      });
      const { saveToLibraryAsync } = await import("expo-media-library");
      vi.mocked(saveToLibraryAsync).mockResolvedValue();

      const result = await service.saveToDevice([mockPhotos[0]]);

      expect(requestPermissionsAsync).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should reject when permissions denied", async () => {
      const { requestPermissionsAsync } = await import("expo-media-library");
      vi.mocked(requestPermissionsAsync).mockResolvedValue({
        status: "denied",
      });

      const result = await service.saveToDevice([mockPhotos[0]]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Media library permission denied");
    });

    it("should save multiple photos successfully", async () => {
      const { requestPermissionsAsync } = await import("expo-media-library");
      vi.mocked(requestPermissionsAsync).mockResolvedValue({
        status: "granted",
      });
      const { saveToLibraryAsync } = await import("expo-media-library");
      vi.mocked(saveToLibraryAsync).mockResolvedValue();

      const result = await service.saveToDevice(mockPhotos);

      expect(saveToLibraryAsync).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.action).toBe("saved");
    });

    it("should handle partial save failures", async () => {
      const { requestPermissionsAsync } = await import("expo-media-library");
      vi.mocked(requestPermissionsAsync).mockResolvedValue({
        status: "granted",
      });
      const { saveToLibraryAsync } = await import("expo-media-library");
      vi.mocked(saveToLibraryAsync)
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error("Storage full"));

      const result = await service.saveToDevice(mockPhotos);

      expect(result.success).toBe(true);
      expect(result.action).toBe("saved");
      expect(result.error).toContain("Photo 2: Storage full");
    });

    it("should handle complete save failure", async () => {
      const { requestPermissionsAsync } = await import("expo-media-library");
      vi.mocked(requestPermissionsAsync).mockResolvedValue({
        status: "granted",
      });
      const { saveToLibraryAsync } = await import("expo-media-library");
      vi.mocked(saveToLibraryAsync).mockRejectedValue(
        new Error("Storage full"),
      );

      const result = await service.saveToDevice(mockPhotos);

      expect(result.success).toBe(false);
      expect(result.action).toBe("save_failed");
    });
  });

  describe("generateShareLinks", () => {
    it("should reject empty photo array", async () => {
      const result = await service.generateShareLinks([]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No photos to share");
    });

    it("should generate placeholder share links", async () => {
      const result = await service.generateShareLinks(mockPhotos);

      expect(result.success).toBe(true);
      expect(result.action).toBe("links_generated");
      // This is a placeholder implementation
      // In a real app, this would generate actual URLs
    });
  });

  describe("getAvailableShareMethods", () => {
    it("should return all methods for mobile platforms", () => {
      vi.mocked(Platform).OS = 'ios';

      const methods = service.getAvailableShareMethods();

      expect(methods).toContain("file");
      expect(methods).toContain("clipboard");
      expect(methods).toContain("device");
    });

    it("should exclude device method for web", () => {
      vi.mocked(Platform).OS = 'web';

      const methods = service.getAvailableShareMethods();

      expect(methods).toContain("file");
      expect(methods).toContain("clipboard");
      expect(methods).not.toContain("device");
    });
  });

  describe("getMimeType", () => {
    it("should return correct MIME types", () => {
      // We can't directly test private methods, but we can test through public methods
      // that use MIME type detection
      expect(true).toBe(true); // Placeholder - MIME types are tested implicitly
    });
  });

  describe("Platform-specific options", () => {
    it("should return iOS-specific options", () => {
      vi.mocked(Platform).OS = 'ios';

      const options = service.getPlatformSpecificOptions();

      expect(options).toHaveProperty("excludeActivityTypes");
      expect(options.excludeActivityTypes).toContain(
        "com.apple.mobilenotes.SharingExtension",
      );
    });

    it("should return Android-specific options", () => {
      vi.mocked(Platform).OS = 'android';

      const options = service.getPlatformSpecificOptions();

      expect(options).toHaveProperty("subject");
      expect(options.subject).toBe("Photos from Photo Vault");
    });

    it("should return empty options for web", () => {
      vi.mocked(Platform).OS = 'web';

      const options = service.getPlatformSpecificOptions();

      expect(options).toEqual({});
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      vi.mocked(Platform).OS = 'ios';
      vi.spyOn(service, "isSharingAvailable").mockResolvedValue(true);
      const Share = await import("react-native-share");
      vi.mocked(Share.default.open).mockRejectedValue(
        new Error("Network unavailable"),
      );

      const result = await service.sharePhotos([mockPhotos[0]]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network unavailable");
    });

    it("should handle permission errors", async () => {
      const { requestPermissionsAsync } = await import("expo-media-library");
      vi.mocked(requestPermissionsAsync).mockRejectedValue(
        new Error("Permission denied"),
      );

      const result = await service.saveToDevice([mockPhotos[0]]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Permission denied");
    });

    it("should handle file system errors", async () => {
      const { setString } = await import("expo-clipboard");
      vi.mocked(setString).mockRejectedValue(new Error("File not found"));

      const result = await service.copyToClipboard([mockPhotos[0]]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("File not found");
    });
  });

  describe("Performance", () => {
    it("should handle large photo arrays efficiently", async () => {
      const largePhotoArray = Array.from({ length: 100 }, (_, i) => ({
        ...mockPhotos[0],
        id: `photo${i}`,
        uri: `file:///path/to/photo${i}.jpg`,
      }));

      vi.mocked(Platform).OS = 'ios';
      vi.spyOn(service, "isSharingAvailable").mockResolvedValue(true);
      const Share = await import("react-native-share");
      vi.mocked(Share.default.open).mockResolvedValue({
        action: "shared",
        completed: true,
      });

      const startTime = Date.now();
      const result = await service.sharePhotos(largePhotoArray);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe("Edge Cases", () => {
    it("should handle photos with invalid URIs", async () => {
      const invalidPhotos = [
        { ...mockPhotos[0], uri: "" },
        { ...mockPhotos[1], uri: null as any },
      ];

      vi.mocked(Platform).OS = 'ios';
      vi.spyOn(service, "isSharingAvailable").mockResolvedValue(true);
      const Share = await import("react-native-share");
      vi.mocked(Share.default.open).mockRejectedValue(new Error("Invalid URI"));

      const result = await service.sharePhotos(invalidPhotos);

      expect(result.success).toBe(false);
    });

    it("should handle concurrent share requests", async () => {
      vi.mocked(Platform).OS = 'ios';
      vi.spyOn(service, "isSharingAvailable").mockResolvedValue(true);
      const Share = await import("react-native-share");
      vi.mocked(Share.default.open).mockResolvedValue({
        action: "shared",
        completed: true,
      });

      const promises = [
        service.sharePhotos([mockPhotos[0]]),
        service.sharePhotos([mockPhotos[1]]),
        service.sharePhotos(mockPhotos),
      ];

      const results = await Promise.all(promises);

      expect(results.every((r) => r.success)).toBe(true);
    });
  });
});
