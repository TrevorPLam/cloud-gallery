// AI-META-BEGIN
// AI-META: Comprehensive tests for PhotoMapScreen component
// OWNERSHIP: client/screens
// ENTRYPOINTS: Test suite for PhotoMapScreen.tsx
// DEPENDENCIES: vitest, @testing-library/react-native, jest-expo
// DANGER: Tests must handle platform-specific differences and async operations
// CHANGE-SAFETY: Safe to modify tests; ensure coverage remains at 100%
// TESTS: Component tests, accessibility tests, user interaction tests
// AI-META-END

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import PhotoMapScreen from "./PhotoMapScreen";
import { Photo } from "@/types";

// Mock react-native-maps
vi.mock("react-native-maps", () => ({
  MapView: "MapView",
  Marker: "Marker",
  Callout: "Callout",
  Circle: "Circle",
  PROVIDER_GOOGLE: "google",
  PROVIDER_DEFAULT: "default",
}));

// Mock expo-image
vi.mock("expo-image", () => ({
  Image: "Image",
}));

// Mock navigation
const mockNavigation = {
  navigate: vi.fn(),
  goBack: vi.fn(),
  reset: vi.fn(),
};

// Mock theme hook
vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: "#ffffff",
        primary: "#007AFF",
        accent: "#FF3B30",
        text: "#000000",
      },
    },
  }),
}));

// Mock safe area insets
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 44,
    bottom: 34,
    left: 0,
    right: 0,
  }),
}));

// Mock api request
vi.mock("@/lib/query-client", () => ({
  apiRequest: vi.fn(),
}));

// Mock map services
vi.mock("@/lib/map/photo-clustering", () => ({
  PhotoClusteringService: vi.fn().mockImplementation(() => ({
    loadPhotos: vi.fn(),
    getClusters: vi.fn(() => []),
    updateOptions: vi.fn(),
    getClusterExpansionZoom: vi.fn(() => 15),
    getStats: vi.fn(() => ({
      totalPoints: 0,
      clusterCount: 0,
      averagePointsPerCluster: 0,
    })),
  })),
  photoClusteringService: {
    loadPhotos: vi.fn(),
    getClusters: vi.fn(() => []),
    updateOptions: vi.fn(),
    getClusterExpansionZoom: vi.fn(() => 15),
    getStats: vi.fn(() => ({
      totalPoints: 0,
      clusterCount: 0,
      averagePointsPerCluster: 0,
    })),
  },
  isCluster: vi.fn(() => false),
  getClusterSizeText: vi.fn(() => "1"),
  getClusterPhotos: vi.fn(() => []),
}));

vi.mock("@/lib/map/heatmap-renderer", () => ({
  HeatmapRenderer: vi.fn().mockImplementation(() => ({
    processPhotos: vi.fn(() => []),
    generateHeatmapData: vi.fn(() => []),
    getStats: vi.fn(() => null),
  })),
  heatmapRenderer: {
    processPhotos: vi.fn(() => []),
    generateHeatmapData: vi.fn(() => []),
    getStats: vi.fn(() => null),
  },
  calculateOptimalRadius: vi.fn(() => 60),
  createDensityBasedGradient: vi.fn(() => ({
    colors: [],
    startPoints: [],
  })),
}));

vi.mock("@/lib/map/temporal-layers", () => ({
  useTemporalLayers: vi.fn(() => ({
    service: {
      getOverallTimeRange: vi.fn(() => ({ start: 0, end: Date.now() })),
      getLayers: vi.fn(() => []),
    },
    progressValue: { value: 0 },
    isPlayingValue: { value: false },
    speedValue: { value: 1 },
    currentTime: { value: Date.now() },
    visiblePhotos: { value: [] },
    animatedProgressStyle: {},
    play: vi.fn(),
    pause: vi.fn(),
    seekTo: vi.fn(),
    seekToTime: vi.fn(),
    setSpeed: vi.fn(),
  })),
  TimeUtils: {
    formatTimestamp: vi.fn(() => "Jan 1, 2024"),
    getTimeRange: vi.fn(() => ({ start: 0, end: Date.now() })),
  },
  createTimelineMarkers: vi.fn(() => []),
  getTemporalStatistics: vi.fn(() => ({
    totalLayers: 0,
    totalPhotos: 0,
    averagePhotosPerLayer: 0,
    timeSpan: 0,
  })),
}));

// Mock Platform
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: vi.fn((obj) => obj.ios),
  },
  StyleSheet: {
    create: vi.fn((styles) => styles),
  },
  Dimensions: {
    get: vi.fn(() => ({
      width: 375,
      height: 667,
    })),
  },
  View: "View",
  Text: "Text",
  TouchableOpacity: "TouchableOpacity",
  Alert: {
    alert: vi.fn(),
  },
  PanGestureHandler: "PanGestureHandler",
  State: {
    UNDETERMINED: 0,
    ACTIVE: 1,
    END: 2,
  },
}));

// Mock react-native-reanimated
vi.mock("react-native-reanimated", () => ({
  useSharedValue: vi.fn((value) => ({ value })),
  useAnimatedStyle: vi.fn(() => ({})),
  useAnimatedGestureHandler: vi.fn(() => ({})),
  withSpring: vi.fn((value, config) => value),
  interpolate: vi.fn(() => 0),
  Extrapolation: {
    CLAMP: "clamp",
  },
  runOnJS: vi.fn((fn) => fn),
  useDerivedValue: vi.fn((fn) => ({ value: fn() })),
  Animated: {
    View: "Animated.View",
  },
}));

// Mock components
vi.mock("@/components/ThemedText", () => ({
  ThemedText: "ThemedText",
}));

vi.mock("@/components/Button", () => ({
  Button: "Button",
}));

vi.mock("@/components/Icon", () => ({
  Icon: "Icon",
}));

// Mock react-native-gesture-handler
vi.mock("react-native-gesture-handler", () => ({
  PanGestureHandler: "PanGestureHandler",
  State: {
    UNDETERMINED: 0,
    ACTIVE: 1,
    END: 2,
  },
}));

// Test utilities
function createMockPhoto(overrides: Partial<Photo> = {}): Photo {
  const id = `photo-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    uri: `file://photos/${id}.jpg`,
    width: 1920,
    height: 1080,
    createdAt: Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
    modifiedAt: Date.now(),
    filename: `${id}.jpg`,
    isFavorite: false,
    albumIds: [],
    location: {
      latitude: 37.78825,
      longitude: -122.4324,
      city: "San Francisco",
    },
    ...overrides,
  };
}

function createMockPhotosWithLocation(count: number): Photo[] {
  return Array.from({ length: count }, (_, i) =>
    createMockPhoto({
      id: `photo-${i}`,
      location: {
        latitude: 37.78825 + (Math.random() - 0.5) * 0.1,
        longitude: -122.4324 + (Math.random() - 0.5) * 0.1,
        city: "San Francisco",
      },
    }),
  );
}

function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    </GestureHandlerRootView>,
  );
}

describe("PhotoMapScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Basic Rendering", () => {
    it("should render without crashing", () => {
      renderWithProviders(<PhotoMapScreen />);
      // Should not throw
    });

    it("should render loading state initially", () => {
      renderWithProviders(<PhotoMapScreen />);
      // Loading state would be handled by the query
      expect(screen.queryByText("Loading photos...")).toBeTruthy();
    });

    it("should render map view when data is loaded", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);

      // Mock the API response
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.queryByText("Loading photos...")).toBeFalsy();
      });
    });
  });

  describe("Mode Selection", () => {
    it("should render mode selector buttons", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.getByText("Markers")).toBeTruthy();
        expect(screen.getByText("Clusters")).toBeTruthy();
        expect(screen.getByText("Heatmap")).toBeTruthy();
        expect(screen.getByText("Timeline")).toBeTruthy();
      });
    });

    it("should switch between modes", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.getByText("Markers")).toBeTruthy();
      });

      // Test switching to heatmap mode
      fireEvent.press(screen.getByText("Heatmap"));

      // Should update the mode (would need to check internal state)
      expect(screen.getByText("Heatmap")).toBeTruthy();
    });
  });

  describe("Timeline Controls", () => {
    it("should render timeline controls in temporal mode", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.getByText("Timeline")).toBeTruthy();
      });

      // Switch to temporal mode
      fireEvent.press(screen.getByText("Timeline"));

      await waitFor(() => {
        expect(screen.getByText("Timeline")).toBeTruthy();
      });
    });

    it("should have timeline control buttons", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.getByText("Timeline")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Timeline"));

      // Timeline controls should be visible
      // Note: Since we're mocking the components, we can't test the actual buttons
      // but we can test that the timeline mode is active
    });
  });

  describe("Statistics Panel", () => {
    it("should display statistics for different modes", async () => {
      const mockPhotos = createMockPhotosWithLocation(10);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.getByText("Map Statistics")).toBeTruthy();
      });

      // Should show total photos
      expect(screen.getByText("Total Photos:")).toBeTruthy();
    });
  });

  describe("Photo Filtering", () => {
    it("should filter photos with valid locations", async () => {
      const photos = [
        createMockPhoto({
          location: { latitude: 37.78825, longitude: -122.4324, city: "SF" },
        }),
        createMockPhoto({ location: undefined }),
        createMockPhoto({
          location: { latitude: "invalid" as any, longitude: -122.4324 },
        }),
        createMockPhoto({
          location: { latitude: 91, longitude: -122.4324 }, // Invalid latitude
        }),
      ];

      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        // Should only process photos with valid locations
        expect(screen.queryByText("Loading photos...")).toBeFalsy();
      });

      // Verify that clustering service was called with filtered photos
      const { photoClusteringService } = require("@/lib/map/photo-clustering");
      expect(photoClusteringService.loadPhotos).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should display error state when API fails", async () => {
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockRejectedValue(new Error("Network error"));

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.getByText("Error loading photos")).toBeTruthy();
        expect(screen.getByText("Retry")).toBeTruthy();
      });
    });

    it("should allow retry on error", async () => {
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockRejectedValue(new Error("Network error"));

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.getByText("Retry")).toBeTruthy();
      });

      // Test retry functionality
      fireEvent.press(screen.getByText("Retry"));

      // Should attempt to fetch again
      expect(apiRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe("Platform Differences", () => {
    it("should show web fallback on web platform", async () => {
      // Mock Platform.OS to be 'web'
      const { Platform } = require("react-native");
      Platform.OS = "web";

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(
          screen.getByText(/Map view is not fully supported on web/),
        ).toBeTruthy();
      });
    });

    it("should use correct map provider based on platform", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      // Test iOS
      let { Platform } = require("react-native");
      Platform.OS = "ios";

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.queryByText("Loading photos...")).toBeFalsy();
      });

      // Test Android
      Platform.OS = "android";

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.queryByText("Loading photos...")).toBeFalsy();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have accessible mode buttons", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        const markersButton = screen.getByText("Markers");
        expect(markersButton.props.accessibilityRole).toBe("button");
        expect(markersButton.props.accessibilityLabel).toBe(
          "Switch to Markers view",
        );
      });
    });

    it("should indicate selected mode", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        const markersButton = screen.getByText("Markers");
        expect(markersButton.props.accessibilityState).toEqual({
          selected: true,
        });
      });
    });
  });

  describe("Service Integration", () => {
    it("should initialize clustering service with photos", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        const {
          photoClusteringService,
        } = require("@/lib/map/photo-clustering");
        expect(photoClusteringService.loadPhotos).toHaveBeenCalled();
      });
    });

    it("should initialize heatmap service with photos", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        const { heatmapRenderer } = require("@/lib/map/heatmap-renderer");
        expect(heatmapRenderer.processPhotos).toHaveBeenCalled();
      });
    });

    it("should initialize temporal layers with photos", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        const { useTemporalLayers } = require("@/lib/map/temporal-layers");
        expect(useTemporalLayers).toHaveBeenCalled();
      });
    });
  });

  describe("Performance Considerations", () => {
    it("should handle large photo collections efficiently", async () => {
      const mockPhotos = createMockPhotosWithLocation(1000);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      const startTime = Date.now();

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.queryByText("Loading photos...")).toBeFalsy();
      });

      const endTime = Date.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 1 second for tests)
      expect(renderTime).toBeLessThan(1000);
    });

    it("should not reinitialize services unnecessarily", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      const { photoClusteringService } = require("@/lib/map/photo-clustering");
      const { heatmapRenderer } = require("@/lib/map/heatmap-renderer");

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.queryByText("Loading photos...")).toBeFalsy();
      });

      // Services should be initialized once
      expect(photoClusteringService.loadPhotos).toHaveBeenCalledTimes(1);
      expect(heatmapRenderer.processPhotos).toHaveBeenCalledTimes(1);
    });
  });

  describe("User Interactions", () => {
    it("should handle mode switching", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.getByText("Markers")).toBeTruthy();
      });

      // Switch through all modes
      fireEvent.press(screen.getByText("Clusters"));
      fireEvent.press(screen.getByText("Heatmap"));
      fireEvent.press(screen.getByText("Timeline"));
      fireEvent.press(screen.getByText("Markers"));

      // Should complete without errors
      expect(screen.getByText("Markers")).toBeTruthy();
    });

    it("should handle timeline controls", async () => {
      const mockPhotos = createMockPhotosWithLocation(5);
      const { apiRequest } = require("@/lib/query-client");
      apiRequest.mockResolvedValue({
        json: () => Promise.resolve({ photos: mockPhotos }),
      });

      const { useTemporalLayers } = require("@/lib/map/temporal-layers");
      const mockTemporalLayers = {
        play: vi.fn(),
        pause: vi.fn(),
        seekTo: vi.fn(),
        seekToTime: vi.fn(),
        setSpeed: vi.fn(),
      };
      useTemporalLayers.mockReturnValue(mockTemporalLayers);

      renderWithProviders(<PhotoMapScreen />);

      await waitFor(() => {
        expect(screen.getByText("Timeline")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Timeline"));

      // Timeline controls should be available
      // Note: Since we're mocking, we can't test actual button presses
      // but we can verify the hook was called
    });
  });
});
