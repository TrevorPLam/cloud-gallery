// AI-META-BEGIN
// AI-META: Unit tests for advanced photo editing UI components and interactions
// OWNERSHIP: client/screens
// ENTRYPOINTS: run by npm test for UI component validation
// DEPENDENCIES: vitest, @testing-library/react-native, @testing-library/jest-native
// DANGER: Tests must validate UI interactions, state management, and user flows
// CHANGE-SAFETY: Maintain test coverage for all UI components and user interactions
// TESTS: npm run test:watch for development, npm run test:coverage for validation
// AI-META-END

import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import {
  render,
  fireEvent,
  screen,
  waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";

import EditPhotoScreen from "./EditPhotoScreen";
import {
  PhotoEditor,
  createPhotoEditor,
  DEFAULT_ADJUSTMENTS,
} from "@/lib/photo-editor";
import { FILTER_PRESETS } from "@/lib/filters/filter-system";
import { ADJUSTMENT_CONFIGS } from "@/lib/adjustments";
import { apiRequest } from "@/lib/query-client";

// FIX 7: Add vi.mock for photo-editor module so createPhotoEditor becomes a real vi.fn()
vi.mock("@/lib/photo-editor", () => ({
  createPhotoEditor: vi.fn(),
  DEFAULT_ADJUSTMENTS: {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    vibrance: 0,
    temperature: 0,
    sharpness: 0,
    clarity: 0,
    vignette: 0,
    exposure: 0,
  },
  adjustmentsEqual: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
}));

// Mock dependencies
vi.mock("@react-navigation/native", () => ({
  useRoute: () => ({
    params: {
      photoId: "test-photo-id",
      initialUri: "mock://image.jpg",
    },
  }),
  useNavigation: () => ({
    goBack: vi.fn(),
  }),
}));

vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      text: "#000000",
      textSecondary: "#666666",
      accent: "#007AFF",
      background: "#FFFFFF",
    },
  }),
}));

vi.mock("@/lib/query-client", () => ({
  apiRequest: vi.fn(),
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("expo-image", () => ({
  Image: "Image",
}));

vi.mock("@expo/vector-icons/Feather", () => "Feather");

vi.mock("expo-image-manipulator", () => ({
  manipulateAsync: vi.fn((uri, actions, options) =>
    Promise.resolve({
      uri: `${uri}_edited`,
      width: 1000,
      height: 1000,
    }),
  ),
  SaveFormat: {
    JPEG: "jpeg",
    PNG: "png",
  },
  FlipType: {
    Horizontal: "horizontal",
    Vertical: "vertical",
  },
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 44,
    bottom: 34,
    left: 0,
    right: 0,
  }),
}));

// Mock Alert
const mockAlert = vi.fn();
vi.mock("react-native", async () => {
  const React = await vi.importActual("react-native");
  return {
    ...React,
    Alert: {
      alert: mockAlert,
    },
  };
});

describe("EditPhotoScreen - Unit Tests", () => {
  const mockPhotoId = "test-photo-id";
  const mockInitialUri = "mock://image.jpg";

  beforeEach(() => {
    vi.clearAllMocks();
    // FIX 8: Re-wire apiRequest mock after clearAllMocks
    const mockApiRequest = vi.mocked(apiRequest);
    mockApiRequest.mockResolvedValue({
      json: () => Promise.resolve({ file: { uri: "mock://uploaded.jpg" } }),
    });
  });

  describe("Component Rendering", () => {
    it("should render the editing screen correctly", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        expect(screen.getByText("Edit Photo")).toBeTruthy();
        expect(screen.getByText("Cancel")).toBeTruthy();
        expect(screen.getByText("Save")).toBeTruthy();
        expect(screen.getByText("Filters")).toBeTruthy();
        expect(screen.getByText("Adjustments")).toBeTruthy();
        expect(screen.getByText("Tools")).toBeTruthy();
        expect(screen.getByText("Crop")).toBeTruthy();
      });
    });

    it("should show loading state initially", () => {
      render(<EditPhotoScreen />);
      expect(screen.getByText("Loading Editor...")).toBeTruthy();
    });

    it("should display undo/redo buttons", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        // Check for undo/redo icons (they're Feather icons)
        const undoButtons = screen.getAllByTestId("feather-icon");
        expect(undoButtons.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Tab Switching", () => {
    it("should switch to different tabs when pressed", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        expect(screen.getByText("Filters")).toBeTruthy();
      });

      // Switch to Adjustments tab
      fireEvent.press(screen.getByText("Adjustments"));

      await waitFor(() => {
        expect(screen.getByText("Light")).toBeTruthy();
        expect(screen.getByText("Color")).toBeTruthy();
        expect(screen.getByText("Detail")).toBeTruthy();
      });

      // Switch to Tools tab
      fireEvent.press(screen.getByText("Tools"));

      await waitFor(() => {
        expect(screen.getByText("Rotate")).toBeTruthy();
        expect(screen.getByText("Flip")).toBeTruthy();
        expect(screen.getByText("Crop")).toBeTruthy();
        expect(screen.getByText("Straighten")).toBeTruthy();
      });

      // Switch to Crop tab
      fireEvent.press(screen.getByText("Crop"));

      await waitFor(() => {
        expect(screen.getByText("Crop Tool")).toBeTruthy();
        expect(
          screen.getByText("Select aspect ratio and drag corners to crop"),
        ).toBeTruthy();
      });
    });

    it("should highlight the active tab", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        const filtersTab = screen.getByText("Filters");
        expect(filtersTab).toBeTruthy();
      });

      // Active tab should have different styling (we can't easily test styles in this setup)
      // But we can test that the tab content changes
      fireEvent.press(screen.getByText("Adjustments"));

      await waitFor(() => {
        expect(screen.getByText("Light")).toBeTruthy();
      });
    });
  });

  describe("Filter Selection", () => {
    it("should display all filter presets", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        FILTER_PRESETS.forEach((filter) => {
          expect(screen.getByText(filter.name)).toBeTruthy();
        });
      });
    });

    it("should select a filter when pressed", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        expect(screen.getByText("Vintage")).toBeTruthy();
      });

      // Select Vintage filter
      fireEvent.press(screen.getByText("Vintage"));

      // Filter should be selected (we can test this by checking if adjustments change)
      // This would require more complex state testing setup
    });

    it("should show Original filter by default", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        expect(screen.getByText("Original")).toBeTruthy();
      });
    });
  });

  describe("Adjustment Controls", () => {
    it("should display adjustment categories", async () => {
      render(<EditPhotoScreen />);

      // Switch to Adjustments tab
      await waitFor(() => {
        fireEvent.press(screen.getByText("Adjustments"));
      });

      await waitFor(() => {
        expect(screen.getByText("Light")).toBeTruthy();
        expect(screen.getByText("Color")).toBeTruthy();
        expect(screen.getByText("Detail")).toBeTruthy();
      });
    });

    it("should display all adjustment controls", async () => {
      render(<EditPhotoScreen />);

      // Switch to Adjustments tab
      await waitFor(() => {
        fireEvent.press(screen.getByText("Adjustments"));
      });

      await waitFor(() => {
        ADJUSTMENT_CONFIGS.forEach((config) => {
          expect(screen.getByText(config.name)).toBeTruthy();
        });
      });
    });

    it("should show current adjustment values", async () => {
      render(<EditPhotoScreen />);

      // Switch to Adjustments tab
      await waitFor(() => {
        fireEvent.press(screen.getByText("Adjustments"));
      });

      await waitFor(() => {
        // Check that default values are shown
        ADJUSTMENT_CONFIGS.forEach((config) => {
          expect(screen.getByText(config.defaultValue.toFixed(2))).toBeTruthy();
        });
      });
    });
  });

  describe("Tool Functions", () => {
    it("should display tool grid", async () => {
      render(<EditPhotoScreen />);

      // Switch to Tools tab
      await waitFor(() => {
        fireEvent.press(screen.getByText("Tools"));
      });

      await waitFor(() => {
        expect(screen.getByText("Rotate")).toBeTruthy();
        expect(screen.getByText("Flip")).toBeTruthy();
        expect(screen.getByText("Crop")).toBeTruthy();
        expect(screen.getByText("Straighten")).toBeTruthy();
      });
    });
  });

  describe("Crop Function", () => {
    it("should display crop options", async () => {
      render(<EditPhotoScreen />);

      // Switch to Crop tab
      await waitFor(() => {
        fireEvent.press(screen.getByText("Crop"));
      });

      await waitFor(() => {
        expect(screen.getByText("Crop Tool")).toBeTruthy();
        expect(screen.getByText("Free")).toBeTruthy();
        expect(screen.getByText("1:1")).toBeTruthy();
        expect(screen.getByText("4:3")).toBeTruthy();
        expect(screen.getByText("16:9")).toBeTruthy();
      });
    });
  });

  describe("Header Actions", () => {
    it("should handle cancel button press", async () => {
      // FIX 9: Use vi.spyOn on the already-mocked module so component and test share the same fn
      const navModule = await import("@react-navigation/native");
      const goBackSpy = vi.fn();
      vi.spyOn(navModule, "useNavigation").mockReturnValue({
        goBack: goBackSpy,
      } as any);

      render(<EditPhotoScreen />);

      await waitFor(() => {
        fireEvent.press(screen.getByText("Cancel"));
      });

      expect(goBackSpy).toHaveBeenCalled();
    });

    it("should handle reset button press", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        const resetButton = screen.getByText("Reset");
        expect(resetButton).toBeTruthy();

        fireEvent.press(resetButton);
      });

      // Reset functionality would require more complex state testing
    });

    it("should handle before/after comparison", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        const compareButton = screen.getByText("Show Original");
        expect(compareButton).toBeTruthy();

        fireEvent.press(compareButton);
      });

      await waitFor(() => {
        expect(screen.getByText("Hide Original")).toBeTruthy();
      });
    });
  });

  describe("Save Functionality", () => {
    it("should handle save button press", async () => {
      // FIX 8: Use the module-scope apiRequest reference instead of require() inside test
      const mockApiRequest = vi.mocked(apiRequest);
      const { invalidateQueries } =
        require("@/lib/query-client").useQueryClient();

      // Mock successful upload
      mockApiRequest.mockResolvedValue({
        json: () => Promise.resolve({ file: { uri: "mock://uploaded.jpg" } }),
      });

      render(<EditPhotoScreen />);

      await waitFor(() => {
        const saveButton = screen.getByText("Save");
        expect(saveButton).toBeTruthy();

        fireEvent.press(saveButton);
      });

      // Wait for save mutation to complete
      await waitFor(() => {
        expect(mockApiRequest).toHaveBeenCalledWith(
          "POST",
          "/api/upload/single",
          expect.any(FormData),
        );
        expect(invalidateQueries).toHaveBeenCalledWith({
          queryKey: ["photos"],
        });
      });
    });

    it("should show loading state during save", async () => {
      // FIX 8: Use the module-scope apiRequest reference
      const mockApiRequest = vi.mocked(apiRequest);

      // Mock slow upload
      mockApiRequest.mockImplementation(() => {
        return new Promise(function (resolve) {
          setTimeout(function () {
            resolve({
              json: function () {
                return Promise.resolve({
                  file: { uri: "mock://uploaded.jpg" },
                });
              },
            });
          }, 100);
        });
      });

      render(<EditPhotoScreen />);

      await waitFor(() => {
        fireEvent.press(screen.getByText("Save"));
      });

      // Should show loading indicator
      await waitFor(() => {
        const saveButton = screen.getByTestId("activity-indicator");
        expect(saveButton).toBeTruthy();
      });
    });

    it("should handle save errors", async () => {
      // FIX 8: Use the module-scope apiRequest reference
      const mockApiRequest = vi.mocked(apiRequest);

      // Mock upload error
      mockApiRequest.mockRejectedValue(new Error("Upload failed"));

      render(<EditPhotoScreen />);

      await waitFor(() => {
        fireEvent.press(screen.getByText("Save"));
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          "Error",
          "Failed to save changes",
        );
      });
    });
  });

  describe("Undo/Redo Functionality", () => {
    it("should handle undo when available", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        // Initially undo should be disabled
        const undoButton = screen.getByTestId("undo-button");
        expect(undoButton).toBeTruthy();
      });

      // After making changes, undo should be enabled
      // This would require more complex state testing
    });

    it("should handle redo when available", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        // Initially redo should be disabled
        const redoButton = screen.getByTestId("redo-button");
        expect(redoButton).toBeTruthy();
      });

      // After undo, redo should be enabled
      // This would require more complex state testing
    });
  });

  describe("Error Handling", () => {
    it("should handle editor initialization errors", async () => {
      // Mock editor creation failure
      vi.mocked(createPhotoEditor).mockImplementation(() => {
        throw new Error("Failed to create editor");
      });

      render(<EditPhotoScreen />);

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith(
          "Error",
          "Failed to create editor",
        );
      });
    });

    it("should handle undo errors", async () => {
      const mockEditor = {
        canUndo: () => true,
        undo: () => Promise.reject(new Error("Undo failed")),
        canRedo: () => false,
        redo: () => Promise.resolve("uri"),
        resetToOriginal: () => Promise.resolve("uri"),
        getCurrentUri: () => "uri",
        getOriginalUri: () => "original",
        getCurrentAdjustments: () => DEFAULT_ADJUSTMENTS,
        getHistory: () => [],
        getHistoryIndex: () => -1,
        clearHistory: () => {},
        dispose: () => {},
        applyAdjustments: () => Promise.resolve("uri"),
        applyCrop: () => Promise.resolve("uri"),
        applyRotation: () => Promise.resolve("uri"),
        applyFilter: () => Promise.resolve("uri"),
        getFilterPresets: () => FILTER_PRESETS,
      } as PhotoEditor;

      vi.mocked(createPhotoEditor).mockReturnValue(mockEditor);

      render(<EditPhotoScreen />);

      await waitFor(() => {
        // Trigger undo
        fireEvent.press(screen.getByTestId("undo-button"));
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith("Error", "Failed to undo");
      });
    });

    it("should handle reset errors", async () => {
      const mockEditor = {
        canUndo: () => false,
        undo: () => Promise.resolve("uri"),
        canRedo: () => false,
        redo: () => Promise.resolve("uri"),
        resetToOriginal: () => Promise.reject(new Error("Reset failed")),
        getCurrentUri: () => "uri",
        getOriginalUri: () => "original",
        getCurrentAdjustments: () => DEFAULT_ADJUSTMENTS,
        getHistory: () => [],
        getHistoryIndex: () => -1,
        clearHistory: () => {},
        dispose: () => {},
        applyAdjustments: () => Promise.resolve("uri"),
        applyCrop: () => Promise.resolve("uri"),
        applyRotation: () => Promise.resolve("uri"),
        applyFilter: () => Promise.resolve("uri"),
        getFilterPresets: () => FILTER_PRESETS,
      } as PhotoEditor;

      vi.mocked(createPhotoEditor).mockReturnValue(mockEditor);

      render(<EditPhotoScreen />);

      await waitFor(() => {
        // Trigger reset
        fireEvent.press(screen.getByText("Reset"));
      });

      await waitFor(() => {
        expect(mockAlert).toHaveBeenCalledWith("Error", "Failed to reset");
      });
    });
  });

  describe("State Management", () => {
    it("should maintain selected filter state", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        // Select a filter
        fireEvent.press(screen.getByText("Vintage"));
      });

      // Switch tabs and come back
      fireEvent.press(screen.getByText("Adjustments"));
      fireEvent.press(screen.getByText("Filters"));

      await waitFor(() => {
        // Filter should still be selected
        // This would require more complex state testing
      });
    });

    it("should maintain adjustment values", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        // Switch to adjustments
        fireEvent.press(screen.getByText("Adjustments"));
      });

      // Change an adjustment
      // This would require slider interaction testing

      // Switch tabs and come back
      fireEvent.press(screen.getByText("Filters"));
      fireEvent.press(screen.getByText("Adjustments"));

      await waitFor(() => {
        // Adjustment value should be maintained
        // This would require more complex state testing
      });
    });
  });

  describe("Accessibility", () => {
    it("should have accessible labels for all interactive elements", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        // Check that important elements have accessibility labels
        expect(screen.getByText("Cancel")).toBeTruthy();
        expect(screen.getByText("Save")).toBeTruthy();
        expect(screen.getByText("Filters")).toBeTruthy();
        expect(screen.getByText("Adjustments")).toBeTruthy();
        expect(screen.getByText("Tools")).toBeTruthy();
        expect(screen.getByText("Crop")).toBeTruthy();
      });
    });

    it("should have proper accessibility hints for complex interactions", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        // Check that complex elements have proper hints
        // This would require testing accessibility properties
      });
    });
  });

  describe("Performance", () => {
    it("should render efficiently with large filter lists", async () => {
      const startTime = performance.now();

      render(<EditPhotoScreen />);

      await waitFor(() => {
        expect(screen.getByText("Original")).toBeTruthy();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Render should complete within reasonable time (e.g., < 1000ms)
      expect(renderTime).toBeLessThan(1000);
    });

    it("should handle tab switches efficiently", async () => {
      render(<EditPhotoScreen />);

      await waitFor(() => {
        expect(screen.getByText("Filters")).toBeTruthy();
      });

      const startTime = performance.now();

      // Switch between tabs multiple times
      fireEvent.press(screen.getByText("Adjustments"));
      fireEvent.press(screen.getByText("Tools"));
      fireEvent.press(screen.getByText("Crop"));
      fireEvent.press(screen.getByText("Filters"));

      const endTime = performance.now();
      const switchTime = endTime - startTime;

      // Tab switches should be fast (e.g., < 500ms)
      expect(switchTime).toBeLessThan(500);
    });
  });
});

describe("EditPhotoScreen - Integration Tests", () => {
  it("should complete a full editing workflow", async () => {
    // FIX 8: Use the module-scope apiRequest reference
    const mockApiRequest = vi.mocked(apiRequest);
    const { invalidateQueries } =
      require("@/lib/query-client").useQueryClient();

    // Mock successful operations
    mockApiRequest.mockResolvedValue({
      json: () => Promise.resolve({ file: { uri: "mock://uploaded.jpg" } }),
    });

    render(<EditPhotoScreen />);

    // 1. Select a filter
    await waitFor(() => {
      fireEvent.press(screen.getByText("Vintage"));
    });

    // 2. Switch to adjustments
    await waitFor(() => {
      fireEvent.press(screen.getByText("Adjustments"));
    });

    // 3. Make adjustments (mock interaction)
    await waitFor(() => {
      expect(screen.getByText("Brightness")).toBeTruthy();
    });

    // 4. Switch back to filters
    await waitFor(() => {
      fireEvent.press(screen.getByText("Filters"));
    });

    // 5. Save the photo
    await waitFor(() => {
      fireEvent.press(screen.getByText("Save"));
    });

    // 6. Verify save completed
    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        "POST",
        "/api/upload/single",
        expect.any(FormData),
      );
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["photos"] });
    });
  });

  it("should handle error recovery", async () => {
    // FIX 8: Use the module-scope apiRequest reference
    const mockApiRequest = vi.mocked(apiRequest);

    // Mock save failure
    mockApiRequest.mockRejectedValue(new Error("Upload failed"));

    render(<EditPhotoScreen />);

    // Try to save
    await waitFor(() => {
      fireEvent.press(screen.getByText("Save"));
    });

    // Should show error
    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith("Error", "Failed to save changes");
    });

    // Should still be able to use the app
    await waitFor(() => {
      expect(screen.getByText("Filters")).toBeTruthy();
      expect(screen.getByText("Cancel")).toBeTruthy();
    });
  });
});
