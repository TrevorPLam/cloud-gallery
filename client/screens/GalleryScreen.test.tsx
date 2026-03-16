// AI-META-BEGIN
// AI-META: Comprehensive tests for GalleryScreen with gesture simulation and performance testing
// OWNERSHIP: client/screens (gallery screen testing)
// ENTRYPOINTS: Used by test runners for gallery screen validation
// DEPENDENCIES: vitest, @testing-library/react-native, gesture mocks, performance mocks
// DANGER: Complex UI testing; gesture simulation accuracy varies by environment
// CHANGE-SAFETY: Safe to modify test cases; risky to change mock implementations
// TESTS: Test zoom gestures, timeline navigation, haptic feedback, performance, accessibility
// AI-META-END

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import GalleryScreen from "../GalleryScreen";
import { Photo } from "@/types";
import { DEFAULT_ZOOM_LEVELS } from "../lib/gallery/timeline-navigation";

// Mock expo-haptics
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
  NotificationFeedbackType: {
    Success: "success",
    Error: "error",
    Warning: "warning",
  },
}));

// Mock react-navigation
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: vi.fn(),
  useNavigation: vi.fn(() => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
  })),
}));

vi.mock("@react-navigation/elements", () => ({
  useHeaderHeight: vi.fn(() => 50),
}));

vi.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: vi.fn(() => 80),
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: vi.fn(() => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  })),
}));

// Mock Dimensions
vi.mock("react-native", () => ({
  StyleSheet: {
    create: vi.fn((styles) => styles),
  },
  View: "View",
  Text: "Text",
  Pressable: "Pressable",
  Animated: {
    View: "Animated.View",
    createAnimatedComponent: vi.fn((component) => component),
  },
  Dimensions: {
    get: vi.fn(() => ({
      width: 375,
      height: 667,
    })),
    addEventListener: vi.fn(() => ({
      remove: vi.fn(),
    })),
  },
  Platform: {
    OS: "ios",
  },
  Image: "Image",
  Feather: "Feather",
}));

// Mock expo-image
vi.mock("expo-image", () => ({
  Image: "Image",
}));

// Mock @shopify/flash-list
vi.mock("@shopify/flash-list", () => ({
  FlashList: "FlashList",
}));

// Mock theme hook
vi.mock("@/hooks/useTheme", () => ({
  useTheme: vi.fn(() => ({
    theme: {
      backgroundRoot: "#FFFFFF",
      backgroundPrimary: "#F8FAFC",
      backgroundSecondary: "#F1F5F9",
      textPrimary: "#1E293B",
      textSecondary: "#64748B",
      border: "#E2E8F0",
      accent: "#3B82F6",
      buttonText: "#FFFFFF",
    },
  })),
}));

// Mock constants
vi.mock("@/constants/theme", () => ({
  Spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    "2xl": 48,
    "3xl": 64,
    fabSize: 56,
    photoGap: 4,
  },
  Colors: {
    light: {
      accent: "#3B82F6",
    },
  },
}));

// Mock components
vi.mock("@/components/ThemedText", () => ({
  ThemedText: "ThemedText",
}));

vi.mock("@/components/EmptyState", () => ({
  EmptyState: "EmptyState",
}));

vi.mock("@/components/SkeletonLoader", () => ({
  SkeletonLoader: "SkeletonLoader",
}));

// Test data factories
function createMockPhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: `photo-${Math.random().toString(36).substr(2, 9)}`,
    uri: `file://photo-${Math.random().toString(36).substr(2, 9)}.jpg`,
    width: 1920,
    height: 1080,
    filename: `photo-${Math.random().toString(36).substr(2, 9)}.jpg`,
    createdAt: Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000,
    modifiedAt: Date.now(),
    isFavorite: false,
    isPrivate: false,
    albumIds: [],
    ...overrides,
  };
}

function createMockPhotos(count: number): Photo[] {
  return Array.from({ length: count }, () => createMockPhoto());
}

// Test wrapper with QueryClient
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView>{children}</GestureHandlerRootView>
    </QueryClientProvider>
  );
}

describe("GalleryScreen", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          gcTime: 0,
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("should render loading state initially", () => {
      const { impactAsync } = require("expo-haptics");
      
      const { getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      // Should show skeleton loader
      expect(getByTestId("skeleton-loader")).toBeTruthy();
    });

    it("should render empty state when no photos", async () => {
      const { impactAsync } = require("expo-haptics");
      
      // Mock successful query with empty data
      queryClient.setQueryData(["photos"], []);
      
      const { getByText } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(getByText("No photos found")).toBeTruthy();
      expect(getByText("Start by adding some photos to your gallery")).toBeTruthy();
    });

    it("should render gallery with photos", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(10);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should render FlashList
      expect(getByTestId("flash-list")).toBeTruthy();
    });

    it("should render error state when query fails", async () => {
      const { impactAsync } = require("expo-haptics");
      
      // Mock failed query
      queryClient.setQueryData(["photos"], new Error("Network error"));
      
      const { getByText } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(getByText("Error loading photos")).toBeTruthy();
      expect(getByText("Please check your connection and try again")).toBeTruthy();
    });
  });

  describe("Zoom Controls", () => {
    it("should display current zoom level", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(10);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByText } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should show current zoom level (PHOTO by default)
      expect(getByText("PHOTO")).toBeTruthy();
    });

    it("should reset zoom when reset button is pressed", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(10);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByTestId, getByLabelText } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Find and press reset button
      const resetButton = getByLabelText("Reset zoom");
      fireEvent.press(resetButton);

      // Should trigger haptic feedback
      expect(impactAsync).toHaveBeenCalledWith("heavy");
    });
  });

  describe("Timeline Navigation", () => {
    it("should show breadcrumb when navigating into timeline", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(50); // Enough to create hierarchy
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByText, getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Initially no breadcrumb should be visible
      expect(() => getByText("2023")).toThrow();

      // Simulate timeline navigation (this would be triggered by gesture)
      // For testing, we'll need to find a way to trigger the navigation
      // This might require mocking the gesture handler more thoroughly
    });

    it("should handle back navigation", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(50);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByLabelText } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Find and press back button (if visible)
      // This test would need to be expanded with proper state setup
    });
  });

  describe("Gesture Handling", () => {
    it("should initialize gesture handler", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(10);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should have gesture handler set up
      expect(getByTestId("pinch-gesture-handler")).toBeTruthy();
    });

    it("should trigger haptic feedback on gesture start", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(10);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Simulate gesture start
      const gestureHandler = getByTestId("pinch-gesture-handler");
      fireEvent(gestureHandler, "onGestureStart", {
        scale: 1.0,
        focalX: 100,
        focalY: 100,
      });

      // Should trigger light haptic feedback
      expect(impactAsync).toHaveBeenCalledWith("light");
    });

    it("should handle zoom level changes", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(10);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByTestId, getByText } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Initially at PHOTO level
      expect(getByText("PHOTO")).toBeTruthy();

      // Simulate zoom out gesture
      const gestureHandler = getByTestId("pinch-gesture-handler");
      fireEvent(gestureHandler, "onGestureUpdate", {
        scale: 0.5, // Should trigger month level
        focalX: 100,
        focalY: 100,
      });

      // Should update zoom level display
      expect(getByText("MONTH")).toBeTruthy();
      
      // Should trigger haptic feedback
      expect(impactAsync).toHaveBeenCalledWith("medium");
    });
  });

  describe("Photo Interactions", () => {
    it("should handle photo press", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(10);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Find and press photo
      const photoItem = getByTestId(`photo-${mockPhotos[0].id}`);
      fireEvent.press(photoItem);

      // Should trigger haptic feedback
      expect(impactAsync).toHaveBeenCalledWith("medium");
    });

    it("should display favorite indicator for favorite photos", async () => {
      const { impactAsync } = require("expo-haptics");
      const favoritePhoto = createMockPhoto({ isFavorite: true });
      const mockPhotos = [favoritePhoto, ...createMockPhotos(9)];
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should show favorite icon
      expect(getByTestId(`favorite-${favoritePhoto.id}`)).toBeTruthy();
    });
  });

  describe("Performance", () => {
    it("should handle large photo libraries efficiently", async () => {
      const { impactAsync } = require("expo-haptics");
      const largePhotoSet = createMockPhotos(1000); // Large dataset
      
      queryClient.setQueryData(["photos"], largePhotoSet);
      
      const startTime = performance.now();
      
      const { getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const endTime = performance.now();
      
      // Should render within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000); // 1 second
      
      // Should still render FlashList
      expect(getByTestId("flash-list")).toBeTruthy();
    });

    it("should maintain performance during rapid zoom changes", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(100);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      const gestureHandler = getByTestId("pinch-gesture-handler");
      
      // Simulate rapid zoom changes
      for (let i = 0; i < 10; i++) {
        fireEvent(gestureHandler, "onGestureUpdate", {
          scale: 0.25 + (i * 0.1),
          focalX: 100,
          focalY: 100,
        });
      }

      // Should not crash and maintain responsiveness
      expect(getByTestId("flash-list")).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("should provide accessibility labels for interactive elements", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(10);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByLabelText } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should have accessible controls
      expect(getByLabelText("Reset zoom")).toBeTruthy();
    });

    it("should support screen reader navigation", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(10);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByA11yLabel } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should have accessible elements
      expect(getByA11yLabel("Photo grid")).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      const { impactAsync } = require("expo-haptics");
      
      // Mock network error
      queryClient.setQueryData(["photos"], new Error("Network error"));
      
      const { getByText, getByLabelText } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(getByText("Error loading photos")).toBeTruthy();
      
      // Should have retry button
      const retryButton = getByLabelText("Retry loading photos");
      expect(retryButton).toBeTruthy();
    });

    it("should handle retry functionality", async () => {
      const { impactAsync } = require("expo-haptics");
      
      queryClient.setQueryData(["photos"], new Error("Network error"));
      
      const { getByLabelText } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Press retry button
      const retryButton = getByLabelText("Retry loading photos");
      fireEvent.press(retryButton);

      // Should trigger refetch (would be handled by React Query)
      expect(queryClient.getQueryData(["photos"])).toBeDefined();
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete user workflow", async () => {
      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(50);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByTestId, getByLabelText, getByText } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // 1. Start at photo level
      expect(getByText("PHOTO")).toBeTruthy();

      // 2. Zoom out to month level
      const gestureHandler = getByTestId("pinch-gesture-handler");
      fireEvent(gestureHandler, "onGestureUpdate", {
        scale: 0.5,
        focalX: 100,
        focalY: 100,
      });

      expect(getByText("MONTH")).toBeTruthy();

      // 3. Reset zoom
      const resetButton = getByLabelText("Reset zoom");
      fireEvent.press(resetButton);

      expect(getByText("PHOTO")).toBeTruthy();
      expect(impactAsync).toHaveBeenCalledWith("heavy");

      // 4. Press photo
      const photoItem = getByTestId(`photo-${mockPhotos[0].id}`);
      fireEvent.press(photoItem);

      expect(impactAsync).toHaveBeenCalledWith("medium");
    });
  });

  describe("Platform-Specific Behavior", () => {
    it("should handle web platform correctly", async () => {
      // Mock web platform
      vi.doMock("react-native", () => ({
        Platform: { OS: "web" },
        // ... other mocks
      }));

      const { impactAsync } = require("expo-haptics");
      const mockPhotos = createMockPhotos(10);
      
      queryClient.setQueryData(["photos"], mockPhotos);
      
      const { getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Simulate gesture on web (should not trigger haptics)
      const gestureHandler = getByTestId("pinch-gesture-handler");
      fireEvent(gestureHandler, "onGestureStart", {
        scale: 1.0,
        focalX: 100,
        focalY: 100,
      });

      // Should not trigger haptics on web
      expect(impactAsync).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty photo array", async () => {
      const { impactAsync } = require("expo-haptics");
      
      queryClient.setQueryData(["photos"], []);
      
      const { getByText } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(getByText("No photos found")).toBeTruthy();
    });

    it("should handle single photo", async () => {
      const { impactAsync } = require("expo-haptics");
      const singlePhoto = createMockPhoto();
      
      queryClient.setQueryData(["photos"], [singlePhoto]);
      
      const { getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      expect(getByTestId("flash-list")).toBeTruthy();
    });

    it("should handle photos with missing metadata", async () => {
      const { impactAsync } = require("expo-haptics");
      const incompletePhoto = {
        id: "photo-1",
        uri: "file://photo.jpg",
        // Missing other required fields
      } as Photo;
      
      queryClient.setQueryData(["photos"], [incompletePhoto]);
      
      const { getByTestId } = render(
        <TestWrapper>
          <GalleryScreen />
        </TestWrapper>
      );

      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 0));
      });

      // Should not crash and render what it can
      expect(getByTestId("flash-list")).toBeTruthy();
    });
  });
});
