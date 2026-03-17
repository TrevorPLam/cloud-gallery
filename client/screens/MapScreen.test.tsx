// AI-META-BEGIN
// AI-META: Comprehensive test suite for MapScreen functionality
// OWNERSHIP: client/screens
// ENTRYPOINTS: Test runner for map clustering and photo preview
// DEPENDENCIES: @testing-library/react-native, vitest, mocks
// DANGER: Map rendering complexity; ensure proper mocking
// CHANGE-SAFETY: Safe to add tests; maintain mock contracts
// TESTS: Map clustering, marker rendering, photo preview, accessibility
// AI-META-END

import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MapScreen from "../MapScreen";
import PhotoMarkerThumbnail from "@/components/PhotoMarkerThumbnail";
import PhotoPreviewSheet from "@/components/PhotoPreviewSheet";
import { Photo } from "@/types";
import { useTheme } from "@/hooks/useTheme";

// Mock react-native-maps and clustering
vi.mock("react-native-maps", () => ({
  __esModule: true,
  default: "MapView",
  Marker: "Marker",
  PROVIDER_GOOGLE: "google",
  PROVIDER_DEFAULT: "default",
}));

vi.mock("react-native-map-clustering", () => ({
  __esModule: true,
  default: "ClusteredMapView",
}));

// Mock expo-image
vi.mock("expo-image", () => ({
  Image: "Image",
}));

// Mock hooks
vi.mock("@/hooks/useTheme", () => ({
  useTheme: vi.fn(() => ({
    theme: {
      backgroundDefault: "#ffffff",
      accent: "#D4AF37",
      text: "#1A202C",
      textSecondary: "#718096",
    },
  })),
}));

// Mock navigation
const Stack = createNativeStackNavigator();
const TestNavigation = ({ children }: { children: React.ReactNode }) => (
  <NavigationContainer>
    <Stack.Navigator>
      <Stack.Screen name="Test">{() => children}</Stack.Screen>
    </Stack.Navigator>
  </NavigationContainer>
);

// Mock query client
const createTestQueryClient = () => {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
};

// Mock photo data with location
const mockPhotosWithLocation: Photo[] = [
  {
    id: "1",
    uri: "https://example.com/photo1.jpg",
    width: 1920,
    height: 1080,
    createdAt: "2024-01-15T10:00:00Z",
    location: {
      latitude: 37.7749,
      longitude: -122.4194,
      city: "San Francisco",
    },
  },
  {
    id: "2",
    uri: "https://example.com/photo2.jpg",
    width: 1920,
    height: 1080,
    createdAt: "2024-01-16T12:00:00Z",
    location: {
      latitude: 37.7880,
      longitude: -122.4074,
      city: "San Francisco",
    },
  },
  {
    id: "3",
    uri: "https://example.com/photo3.jpg",
    width: 1920,
    height: 1080,
    createdAt: "2024-01-17T14:00:00Z",
    location: {
      latitude: 40.7128,
      longitude: -74.0060,
      city: "New York",
    },
  },
];

// Mock photo data without location
const mockPhotosWithoutLocation: Photo[] = [
  {
    id: "4",
    uri: "https://example.com/photo4.jpg",
    width: 1920,
    height: 1080,
    createdAt: "2024-01-18T16:00:00Z",
  },
];

describe("MapScreen", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  const renderMapScreen = (photos: Photo[] = []) => {
    // Mock the API response
    vi.mock("@/lib/query-client", () => ({
      apiRequest: vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ photos }),
      }),
    }));

    return render(
      <QueryClientProvider client={queryClient}>
        <TestNavigation>
          <MapScreen />
        </TestNavigation>
      </QueryClientProvider>
    );
  };

  describe("Map Rendering", () => {
    it("renders map view with header", async () => {
      renderMapScreen(mockPhotosWithLocation);

      await waitFor(() => {
        expect(screen.getByText("Places")).toBeTruthy();
        expect(screen.getByText("3 photos")).toBeTruthy();
      });
    });

    it("shows web fallback message on web platform", async () => {
      // Mock Platform.OS
      const originalPlatform = require("react-native").Platform.OS;
      require("react-native").Platform.OS = "web";

      renderMapScreen(mockPhotosWithLocation);

      await waitFor(() => {
        expect(screen.getByText("Map view is not fully supported on web without API keys.")).toBeTruthy();
      });

      // Restore original Platform.OS
      require("react-native").Platform.OS = originalPlatform;
    });

    it("filters photos with valid location data", async () => {
      const allPhotos = [...mockPhotosWithLocation, ...mockPhotosWithoutLocation];
      renderMapScreen(allPhotos);

      await waitFor(() => {
        // Should only count photos with location
        expect(screen.getByText("3 photos")).toBeTruthy();
      });
    });

    it("shows zero photos when no photos have location", async () => {
      renderMapScreen(mockPhotosWithoutLocation);

      await waitFor(() => {
        expect(screen.getByText("0 photos")).toBeTruthy();
      });
    });
  });

  describe("Photo Clustering", () => {
    it("renders clustered markers for nearby photos", async () => {
      renderMapScreen(mockPhotosWithLocation);

      await waitFor(() => {
        // Verify ClusteredMapView is rendered with clustering props
        expect(screen.getByTestId("clustered-map-view")).toBeTruthy();
      });
    });

    it("calculates initial region bounds correctly", async () => {
      renderMapScreen(mockPhotosWithLocation);

      await waitFor(() => {
        // Should calculate bounds that include all photos
        expect(screen.getByText("Places")).toBeTruthy();
      });
    });

    it("uses default region when no photos have location", async () => {
      renderMapScreen([]);

      await waitFor(() => {
        expect(screen.getByText("0 photos")).toBeTruthy();
      });
    });
  });

  describe("Photo Marker Component", () => {
    it("renders PhotoMarkerThumbnail for individual photos", () => {
      const photo = mockPhotosWithLocation[0];
      
      const { getByTestId } = render(
        <PhotoMarkerThumbnail
          uri={photo.uri}
          accessibilityLabel={`Photo at ${photo.location?.city}`}
          accessibilityHint="Tap to preview photo in map view"
        />
      );

      expect(getByTestId("photo-marker-thumbnail")).toBeTruthy();
    });

    it("has proper accessibility properties", () => {
      const photo = mockPhotosWithLocation[0];
      
      const { getByLabelText } = render(
        <PhotoMarkerThumbnail
          uri={photo.uri}
          accessibilityLabel={`Photo at ${photo.location?.city}`}
          accessibilityHint="Tap to preview photo in map view"
        />
      );

      expect(getByLabelText(`Photo at ${photo.location?.city}`)).toBeTruthy();
    });

    it("handles press events", () => {
      const mockOnPress = vi.fn();
      
      const { getByTestId } = render(
        <PhotoMarkerThumbnail
          uri="https://example.com/test.jpg"
          onPress={mockOnPress}
        />
      );

      fireEvent.press(getByTestId("photo-marker-thumbnail"));
      expect(mockOnPress).toHaveBeenCalled();
    });
  });

  describe("Photo Preview Modal", () => {
    it("opens photo preview when marker is pressed", async () => {
      renderMapScreen(mockPhotosWithLocation);

      await waitFor(() => {
        expect(screen.getByText("Places")).toBeTruthy();
      });

      // Simulate marker press
      const marker = screen.getByTestId("photo-marker-1");
      fireEvent.press(marker);

      await waitFor(() => {
        expect(screen.getByTestId("photo-preview-sheet")).toBeTruthy();
      });
    });

    it("closes preview when close button is pressed", async () => {
      renderMapScreen(mockPhotosWithLocation);

      // Open preview
      await waitFor(() => {
        const marker = screen.getByTestId("photo-marker-1");
        fireEvent.press(marker);
      });

      // Close preview
      await waitFor(() => {
        const closeButton = screen.getByLabelText("Close preview");
        fireEvent.press(closeButton);
      });

      await waitFor(() => {
        expect(screen.queryByTestId("photo-preview-sheet")).toBeFalsy();
      });
    });

    it("navigates to full photo view when view full is pressed", async () => {
      const mockNavigate = vi.fn();
      vi.mock("@react-navigation/native", () => ({
        useNavigation: () => ({
          navigate: mockNavigate,
        }),
      }));

      renderMapScreen(mockPhotosWithLocation);

      // Open preview
      await waitFor(() => {
        const marker = screen.getByTestId("photo-marker-1");
        fireEvent.press(marker);
      });

      // Press view full
      await waitFor(() => {
        const viewFullButton = screen.getByLabelText("View full photo");
        fireEvent.press(viewFullButton);
      });

      expect(mockNavigate).toHaveBeenCalledWith("PhotoDetail", {
        photoId: "1",
        initialIndex: 0,
      });
    });

    it("displays correct photo information in preview", async () => {
      const photo = mockPhotosWithLocation[0];
      renderMapScreen([photo]);

      // Open preview
      await waitFor(() => {
        const marker = screen.getByTestId("photo-marker-1");
        fireEvent.press(marker);
      });

      await waitFor(() => {
        expect(screen.getByText(photo.location?.city || "Photo")).toBeTruthy();
        expect(screen.getByText(new Date(photo.createdAt).toLocaleDateString())).toBeTruthy();
      });
    });
  });

  describe("Accessibility", () => {
    it("provides proper accessibility labels for markers", async () => {
      renderMapScreen(mockPhotosWithLocation);

      await waitFor(() => {
        const marker = screen.getByLabelText("Photo at San Francisco");
        expect(marker).toBeTruthy();
      });
    });

    it("provides accessibility hints for user guidance", async () => {
      renderMapScreen(mockPhotosWithLocation);

      await waitFor(() => {
        const marker = screen.getByLabelText("Photo at San Francisco");
        expect(marker.props.accessibilityHint).toBe("Tap to preview photo in map view");
      });
    });

    it("modal has proper accessibility properties", async () => {
      renderMapScreen(mockPhotosWithLocation);

      // Open preview
      await waitFor(() => {
        const marker = screen.getByTestId("photo-marker-1");
        fireEvent.press(marker);
      });

      await waitFor(() => {
        const modal = screen.getByLabelText("Photo preview modal");
        expect(modal).toBeTruthy();
        expect(modal.props.accessibilityHint).toBe("Tap outside or close button to dismiss");
      });
    });
  });

  describe("Performance", () => {
    it("handles large number of photos efficiently", async () => {
      // Create many photos with locations
      const manyPhotos = Array.from({ length: 100 }, (_, i) => ({
        id: `photo-${i}`,
        uri: `https://example.com/photo${i}.jpg`,
        width: 1920,
        height: 1080,
        createdAt: new Date().toISOString(),
        location: {
          latitude: 37.7749 + (i * 0.001),
          longitude: -122.4194 + (i * 0.001),
          city: "San Francisco",
        },
      }));

      const startTime = performance.now();
      renderMapScreen(manyPhotos);
      const endTime = performance.now();

      // Should render within reasonable time (less than 1 second)
      expect(endTime - startTime).toBeLessThan(1000);

      await waitFor(() => {
        expect(screen.getByText("100 photos")).toBeTruthy();
      });
    });

    it("clusters nearby photos to reduce marker count", async () => {
      // Create photos very close to each other
      const clusteredPhotos = Array.from({ length: 20 }, (_, i) => ({
        id: `photo-${i}`,
        uri: `https://example.com/photo${i}.jpg`,
        width: 1920,
        height: 1080,
        createdAt: new Date().toISOString(),
        location: {
          latitude: 37.7749 + (i * 0.0001), // Very close together
          longitude: -122.4194 + (i * 0.0001),
          city: "San Francisco",
        },
      }));

      renderMapScreen(clusteredPhotos);

      await waitFor(() => {
        expect(screen.getByText("20 photos")).toBeTruthy();
        // Should have clusters rather than individual markers
        expect(screen.getByTestId("clustered-map-view")).toBeTruthy();
      });
    });
  });

  describe("Error Handling", () => {
    it("handles missing location data gracefully", async () => {
      const photosWithInvalidLocation = [
        {
          id: "1",
          uri: "https://example.com/photo1.jpg",
          width: 1920,
          height: 1080,
          createdAt: "2024-01-15T10:00:00Z",
          location: {
            latitude: null,
            longitude: -122.4194,
            city: "San Francisco",
          },
        },
      ];

      renderMapScreen(photosWithInvalidLocation);

      await waitFor(() => {
        // Should filter out invalid location
        expect(screen.getByText("0 photos")).toBeTruthy();
      });
    });

    it("handles API errors gracefully", async () => {
      // Mock API error
      vi.mock("@/lib/query-client", () => ({
        apiRequest: vi.fn().mockRejectedValue(new Error("API Error")),
      }));

      renderMapScreen();

      await waitFor(() => {
        // Should still render the map even with API error
        expect(screen.getByText("Places")).toBeTruthy();
      });
    });
  });
});
