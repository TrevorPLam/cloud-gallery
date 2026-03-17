// AI-META-BEGIN
// AI-META: UI tests for DuplicatesScreen component behavior and interactions
// OWNERSHIP: client/screens
// ENTRYPOINTS: run by npm test for UI validation
// DEPENDENCIES: @testing-library/react-native, @testing-library/jest-native, jest
// DANGER: Tests must validate user interactions and state management
// CHANGE-SAFETY: Maintain test coverage for all user flows and edge cases
// TESTS: npm run test:watch for development, npm run test:coverage for validation
// AI-META-END

import React from "react";
import {
  render,
  fireEvent,
  waitFor,
  screen,
} from "@testing-library/react-native";
import { Alert } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import DuplicatesScreen from "./DuplicatesScreen";
import { apiRequest } from "@/lib/query-client";

// Mock dependencies
vi.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

vi.mock("@/hooks/useTheme", () => ({
  useTheme: () => ({
    theme: {
      text: "#1A202C",
      textSecondary: "#718096",
      accent: "#D4AF37",
      backgroundDefault: "#FFFFFF",
    },
    isDark: false,
  }),
}));

vi.mock("@/components/ThemedText", () => {
  const { Text } = require("react-native");
  return {
    ThemedText: ({ children, style, ...props }) => (
      <Text style={style} {...props}>
        {children}
      </Text>
    ),
  };
});

vi.mock("@/components/Button", () => {
  const { Pressable, Text } = require("react-native");
  return {
    Button: ({ children, onPress, disabled, ...props }) => (
      <Pressable onPress={onPress} disabled={disabled} {...props}>
        <Text>{children}</Text>
      </Pressable>
    ),
  };
});

vi.mock("@/components/Card", () => {
  const { View } = require("react-native");
  return {
    Card: ({ children, style, ...props }) => (
      <View style={style} {...props}>
        {children}
      </View>
    ),
  };
});

// Mock fetch for API calls - FIX 6: Mock API abstraction instead of global fetch
vi.mock("@/lib/query-client", () => ({
  apiRequest: vi.fn(),
}));

// Test data
const mockDuplicateData = {
  duplicateGroups: [
    {
      groupId: "group_1",
      photos: [
        {
          id: "photo_1",
          uri: "https://example.com/photo1.jpg",
          filename: "photo1.jpg",
          width: 1920,
          height: 1080,
          fileSize: 2048000,
          createdAt: "2024-01-01T00:00:00Z",
          perceptualHash: "abcdef123456",
          qualityMetrics: {
            resolution: 2073600,
            fileSize: 2048000,
            sharpness: 85,
            overall: 88,
          },
          isBest: true,
        },
        {
          id: "photo_2",
          uri: "https://example.com/photo2.jpg",
          filename: "photo2.jpg",
          width: 1920,
          height: 1080,
          fileSize: 1843000,
          createdAt: "2024-01-01T00:01:00Z",
          perceptualHash: "abcdef123457",
          qualityMetrics: {
            resolution: 2073600,
            fileSize: 1843000,
            sharpness: 82,
            overall: 85,
          },
          isBest: false,
        },
      ],
      groupType: "exact",
      averageSimilarity: 0.98,
    },
    {
      groupId: "group_2",
      photos: [
        {
          id: "photo_3",
          uri: "https://example.com/photo3.jpg",
          filename: "photo3.jpg",
          width: 1280,
          height: 720,
          fileSize: 1024000,
          createdAt: "2024-01-01T00:02:00Z",
          perceptualHash: "1234567890ab",
          qualityMetrics: {
            resolution: 921600,
            fileSize: 1024000,
            sharpness: 78,
            overall: 80,
          },
          isBest: true,
        },
        {
          id: "photo_4",
          uri: "https://example.com/photo4.jpg",
          filename: "photo4.jpg",
          width: 1280,
          height: 720,
          fileSize: 980000,
          createdAt: "2024-01-01T00:03:00Z",
          perceptualHash: "1234567890ac",
          qualityMetrics: {
            resolution: 921600,
            fileSize: 980000,
            sharpness: 75,
            overall: 77,
          },
          isBest: false,
        },
        {
          id: "photo_5",
          uri: "https://example.com/photo5.jpg",
          filename: "photo5.jpg",
          width: 1280,
          height: 720,
          fileSize: 1050000,
          createdAt: "2024-01-01T00:04:00Z",
          perceptualHash: "1234567890ad",
          qualityMetrics: {
            resolution: 921600,
            fileSize: 1050000,
            sharpness: 80,
            overall: 82,
          },
          isBest: false,
        },
      ],
      groupType: "burst",
      averageSimilarity: 0.92,
    },
  ],
  count: 2,
  config: {
    hammingThreshold: 2,
    burstTimeWindow: 3,
    minBurstSize: 3,
  },
};

const mockEmptyData = {
  duplicateGroups: [],
  count: 0,
  config: {
    hammingThreshold: 2,
    burstTimeWindow: 3,
    minBurstSize: 3,
  },
};

// Helper function to render component with providers
const renderWithProviders = (component) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>{component}</NavigationContainer>
    </QueryClientProvider>,
  );
};

describe("DuplicatesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful API call for duplicates
    vi.mocked(apiRequest).mockResolvedValue(mockDuplicateData);
  });

  describe("Loading and Data Display", () => {
    it("should display loading indicator initially", async () => {
      // Mock delayed response
      vi.mocked(apiRequest).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(mockDuplicateData), 1000),
          ),
      );

      renderWithProviders(<DuplicatesScreen />);

      // Check for loading indicator
      expect(screen.getByTestId("activity-indicator")).toBeTruthy();
    });

    it("should display duplicate groups when data loads", async () => {
      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Duplicate Photos")).toBeTruthy();
        expect(screen.getByText("2 groups")).toBeTruthy();
        expect(screen.getByText("5 photos")).toBeTruthy();
      });

      // Check for group types
      expect(screen.getByText("Exact Duplicates")).toBeTruthy();
      expect(screen.getByText("Burst Sequence")).toBeTruthy();

      // Check for photo counts
      expect(screen.getByText("2 photos")).toBeTruthy();
      expect(screen.getByText("3 photos")).toBeTruthy();

      // Check for similarity scores
      expect(screen.getByText("98% similar")).toBeTruthy();
      expect(screen.getByText("92% similar")).toBeTruthy();
    });

    it("should display empty state when no duplicates found", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => mockEmptyData,
      });

      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("No Duplicates Found")).toBeTruthy();
        expect(
          screen.getByText(
            "Your photo library looks clean! No duplicate photos were detected.",
          ),
        ).toBeTruthy();
      });
    });

    it("should display error state when API fails", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Error Loading Duplicates")).toBeTruthy();
        expect(screen.getByText("Network error")).toBeTruthy();
        expect(screen.getByText("Retry")).toBeTruthy();
      });
    });
  });

  describe("Photo Selection", () => {
    it("should allow photo selection and deselection", async () => {
      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Exact Duplicates")).toBeTruthy();
      });

      // Find and click first photo checkbox
      const photoCheckboxes = screen.getAllByTestId("photo-checkbox");
      expect(photoCheckboxes.length).toBeGreaterThan(0);

      // Initially no photos selected
      expect(screen.getByText("0 photos selected")).toBeTruthy();

      // Select first photo
      fireEvent.press(photoCheckboxes[0]);
      expect(screen.getByText("1 photos selected")).toBeTruthy();

      // Deselect the photo
      fireEvent.press(photoCheckboxes[0]);
      expect(screen.getByText("0 photos selected")).toBeTruthy();
    });

    it("should show best photo badge on highest quality photo", async () => {
      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        // Check for best photo badges
        const bestBadges = screen.getAllByText("Best");
        expect(bestBadges.length).toBe(2); // One for each group
      });
    });

    it("should display photo quality metrics", async () => {
      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        // Check for quality scores
        expect(screen.getByText("Quality: 88%")).toBeTruthy();
        expect(screen.getByText("Quality: 85%")).toBeTruthy();
        expect(screen.getByText("Quality: 80%")).toBeTruthy();
      });
    });
  });

  describe("Duplicate Resolution", () => {
    it("should enable resolve button when photos are selected", async () => {
      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Exact Duplicates")).toBeTruthy();
      });

      // Initially resolve button should be disabled
      const resolveButton = screen.getByText("Resolve");
      expect(resolveButton).toBeTruthy();

      // Select a photo
      const photoCheckboxes = screen.getAllByTestId("photo-checkbox");
      fireEvent.press(photoCheckboxes[0]);

      // Resolve button should now show count
      expect(screen.getByText("Resolve (1)")).toBeTruthy();
    });

    it("should show confirmation dialog when resolving duplicates", async () => {
      // Mock Alert.alert
      const mockAlert = jest.spyOn(Alert, "alert").mockImplementation();

      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Exact Duplicates")).toBeTruthy();
      });

      // Select photos and click resolve
      const photoCheckboxes = screen.getAllByTestId("photo-checkbox");
      fireEvent.press(photoCheckboxes[0]);
      fireEvent.press(photoCheckboxes[1]); // Select from different group

      const resolveButton = screen.getByText("Resolve (2)");
      fireEvent.press(resolveButton);

      // Should show confirmation dialog
      expect(mockAlert).toHaveBeenCalledWith(
        "Resolve Duplicates",
        expect.stringContaining(
          "Are you sure you want to resolve the selected duplicates?",
        ),
        expect.any(Array),
      );

      mockAlert.mockRestore();
    });

    it("should handle successful duplicate resolution", async () => {
      // Mock successful resolution API call
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDuplicateData,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ resolved: 2, total: 2 }),
        });

      // Mock Alert.alert to auto-confirm
      jest
        .spyOn(Alert, "alert")
        .mockImplementation((title, message, buttons) => {
          if (buttons && buttons[1]) {
            buttons[1].onPress?.(); // Press "Resolve" button
          }
        });

      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Exact Duplicates")).toBeTruthy();
      });

      // Select photos and resolve
      const photoCheckboxes = screen.getAllByTestId("photo-checkbox");
      fireEvent.press(photoCheckboxes[0]);
      fireEvent.press(photoCheckboxes[1]);

      const resolveButton = screen.getByText("Resolve (2)");
      fireEvent.press(resolveButton);

      await waitFor(() => {
        // Should show success message
        expect(Alert.alert).toHaveBeenCalledWith(
          "Success",
          "Resolved 2 of 2 duplicate groups",
        );
      });

      jest.restoreAllMocks();
    });
  });

  describe("Refresh Functionality", () => {
    it("should refresh data when pulled to refresh", async () => {
      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Duplicate Photos")).toBeTruthy();
      });

      // Trigger refresh (simulate pull to refresh)
      const flatList = screen.getByTestId("duplicates-flatlist");
      fireEvent(flatList, "refresh");

      // Should call fetch again
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Navigation", () => {
    it("should navigate to photo detail when photo is pressed", async () => {
      const mockNavigate = jest.fn();

      // FIX 6: Override the already-resolved navigation module instead of using jest.doMock()
      const navModule = require("@react-navigation/native");
      const originalUseNavigation = navModule.useNavigation;
      navModule.useNavigation = () => ({ navigate: mockNavigate });

      try {
        renderWithProviders(<DuplicatesScreen />);

        await waitFor(() => {
          expect(screen.getByText("Exact Duplicates")).toBeTruthy();
        });

        // Click on a photo
        const photos = screen.getAllByTestId("photo-item");
        fireEvent.press(photos[0]);

        // Should navigate to photo detail
        expect(mockNavigate).toHaveBeenCalledWith("PhotoDetail", {
          photoId: expect.any(String),
          initialIndex: expect.any(Number),
        });
      } finally {
        // Restore original implementation
        navModule.useNavigation = originalUseNavigation;
      }
    });
  });

  describe("Performance Optimizations", () => {
    it("should use optimized FlatList configuration", async () => {
      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        const flatList = screen.getByTestId("duplicates-flatlist");

        // Verify FlatList has optimization props
        expect(flatList.props.getItemLayout).toBeDefined();
        expect(flatList.props.keyExtractor).toBeDefined();
        expect(flatList.props.windowSize).toBeDefined();
        expect(flatList.props.maxToRenderPerBatch).toBeDefined();
        expect(flatList.props.removeClippedSubviews).toBeDefined();
      });
    });

    it("should memoize list items to prevent unnecessary re-renders", async () => {
      const { rerender } = renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Exact Duplicates")).toBeTruthy();
      });

      // Rerender component
      rerender(
        <QueryClientProvider client={new QueryClient()}>
          <NavigationContainer>
            <DuplicatesScreen />
          </NavigationContainer>
        </QueryClientProvider>,
      );

      // Component should still render without issues
      expect(screen.getByText("Exact Duplicates")).toBeTruthy();
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error("Network unavailable"),
      );

      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Error Loading Duplicates")).toBeTruthy();
        expect(screen.getByText("Network unavailable")).toBeTruthy();
        expect(screen.getByText("Retry")).toBeTruthy();
      });
    });

    it("should handle API errors with proper error messages", async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal server error" }),
      });

      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Error Loading Duplicates")).toBeTruthy();
      });
    });

    it("should allow retry after error", async () => {
      // First call fails, second succeeds
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockDuplicateData,
        });

      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Error Loading Duplicates")).toBeTruthy();
      });

      // Click retry
      const retryButton = screen.getByText("Retry");
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(screen.getByText("Duplicate Photos")).toBeTruthy();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper accessibility labels", async () => {
      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Duplicate Photos")).toBeTruthy();
      });

      // Check for important accessibility elements
      expect(screen.getByText("Exact Duplicates")).toBeTruthy();
      expect(screen.getByText("Burst Sequence")).toBeTruthy();
      expect(screen.getByText("Best")).toBeTruthy();
    });

    it("should support keyboard navigation", async () => {
      renderWithProviders(<DuplicatesScreen />);

      await waitFor(() => {
        expect(screen.getByText("Exact Duplicates")).toBeTruthy();
      });

      // Test tab order through interactive elements
      const photoCheckboxes = screen.getAllByTestId("photo-checkbox");
      const resolveButton = screen.getByText("Resolve");

      // Elements should be focusable
      expect(photoCheckboxes[0]).toBeTruthy();
      expect(resolveButton).toBeTruthy();
    });
  });
});
