// AI-META-BEGIN
// AI-META: UI tests for SharedAlbumsScreen functionality and interactions
// OWNERSHIP: client/screens (shared album testing)
// ENTRYPOINTS: Run with npm test or test:watch
// DEPENDENCIES: React Native Testing Library, Jest, React Query test utils
// DANGER: Mock API responses; test coverage gaps; async operation timing
// CHANGE-SAFETY: Safe to modify tests; maintain API mocking; update when UI changes
// TESTS: Test share modal, collaborator list, activity feed, navigation flows
// AI-META-END

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import SharedAlbumsScreen from "./SharedAlbumsScreen";
import { apiRequest } from "@/lib/query-client";
import { SharedAlbum, CollaboratedAlbum } from "@/types";

// Mock the API request function
jest.mock("@/lib/query-client", () => ({
  apiRequest: jest.fn(),
}));

// Mock expo-haptics
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
}));

// Mock Alert
jest.mock("react-native/Libraries/Alert/Alert", () => ({
  alert: jest.fn(),
}));

const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

// Test data
const mockSharedAlbums: SharedAlbum[] = [
  {
    id: "1",
    albumId: "album-1",
    albumTitle: "Vacation Photos",
    shareToken: "abc123",
    permissions: "view",
    expiresAt: null,
    viewCount: 5,
    isActive: true,
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "2",
    albumId: "album-2",
    albumTitle: "Family Pictures",
    shareToken: "def456",
    permissions: "edit",
    expiresAt: "2024-12-31T23:59:59Z",
    viewCount: 12,
    isActive: true,
    createdAt: "2024-01-02T00:00:00Z",
  },
];

const mockCollaboratedAlbums: CollaboratedAlbum[] = [
  {
    id: "3",
    sharedAlbumId: "share-1",
    albumId: "album-3",
    albumTitle: "Work Projects",
    permissions: "view",
    invitedBy: "john.doe",
    acceptedAt: "2024-01-01T00:00:00Z",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "4",
    sharedAlbumId: "share-2",
    albumId: "album-4",
    albumTitle: "Event Planning",
    permissions: "admin",
    invitedBy: "jane.smith",
    acceptedAt: null,
    createdAt: "2024-01-02T00:00:00Z",
  },
];

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>{children}</NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
};

describe("SharedAlbumsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful API response
    mockApiRequest.mockResolvedValue({
      json: () =>
        Promise.resolve({
          owned: mockSharedAlbums,
          collaborated: mockCollaboratedAlbums,
        }),
    } as Response);
  });

  describe("Rendering", () => {
    it("renders loading state initially", () => {
      // Mock API to take longer to show loading state
      mockApiRequest.mockImplementation(() => new Promise(() => {}));

      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      expect(screen.getByText("Loading shared albums...")).toBeTruthy();
    });

    it("renders shared albums sections when data is loaded", async () => {
      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Shared by me")).toBeTruthy();
        expect(screen.getByText("Shared with me")).toBeTruthy();
      });

      // Check owned albums
      expect(screen.getByText("Vacation Photos")).toBeTruthy();
      expect(screen.getByText("Family Pictures")).toBeTruthy();
      expect(screen.getByText("5 views")).toBeTruthy();
      expect(screen.getByText("12 views")).toBeTruthy();

      // Check collaborated albums
      expect(screen.getByText("Work Projects")).toBeTruthy();
      expect(screen.getByText("Event Planning")).toBeTruthy();
      expect(screen.getByText("Invited by john.doe")).toBeTruthy();
      expect(screen.getByText("Invited by jane.smith")).toBeTruthy();
    });

    it("renders permission badges correctly", async () => {
      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("VIEW")).toBeTruthy();
        expect(screen.getByText("EDIT")).toBeTruthy();
        expect(screen.getByText("ADMIN")).toBeTruthy();
      });
    });

    it("renders empty state when no shared albums", async () => {
      mockApiRequest.mockResolvedValue({
        json: () =>
          Promise.resolve({
            owned: [],
            collaborated: [],
          }),
      } as Response);

      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("No shared albums")).toBeTruthy();
        expect(
          screen.getByText("Start sharing albums with others to collaborate"),
        ).toBeTruthy();
      });
    });

    it("renders error state when API fails", async () => {
      mockApiRequest.mockRejectedValue(new Error("Network error"));

      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Error loading shared albums")).toBeTruthy();
        expect(
          screen.getByText("Please check your connection and try again"),
        ).toBeTruthy();
        expect(screen.getByText("Retry")).toBeTruthy();
      });
    });
  });

  describe("Interactions", () => {
    it("navigates to album detail when shared album is pressed", async () => {
      const mockNavigate = jest.fn();

      // Mock navigation
      jest.mock("@react-navigation/native", () => ({
        useNavigation: () => ({
          navigate: mockNavigate,
          setOptions: jest.fn(),
        }),
        useRoute: () => ({
          params: {},
        }),
      }));

      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Vacation Photos")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Vacation Photos"));

      expect(mockNavigate).toHaveBeenCalledWith("AlbumDetail", {
        albumId: "album-1",
        albumTitle: "Vacation Photos",
      });
    });

    it("shows retry button when error occurs and refetches data", async () => {
      mockApiRequest.mockRejectedValueOnce(new Error("Network error"));
      mockApiRequest.mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            owned: mockSharedAlbums,
            collaborated: [],
          }),
      } as Response);

      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Retry")).toBeTruthy();
      });

      fireEvent.press(screen.getByText("Retry"));

      await waitFor(() => {
        expect(screen.getByText("Vacation Photos")).toBeTruthy();
      });
    });
  });

  describe("Data Display", () => {
    it("displays expiration date for albums with expiration", async () => {
      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Expires 12/31/2024")).toBeTruthy();
      });
    });

    it("displays correct view counts for owned albums", async () => {
      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("5 views")).toBeTruthy();
        expect(screen.getByText("12 views")).toBeTruthy();
      });
    });

    it("displays inviter information for collaborated albums", async () => {
      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Invited by john.doe")).toBeTruthy();
        expect(screen.getByText("Invited by jane.smith")).toBeTruthy();
      });
    });

    it("shows separate empty states for each section", async () => {
      mockApiRequest.mockResolvedValue({
        json: () =>
          Promise.resolve({
            owned: [],
            collaborated: mockCollaboratedAlbums,
          }),
      } as Response);

      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("No shared albums")).toBeTruthy();
        expect(screen.getByText("Share an album to see it here")).toBeTruthy();
      });

      // Should still show collaborated albums
      expect(screen.getByText("Work Projects")).toBeTruthy();
    });
  });

  describe("Accessibility", () => {
    it("has proper accessibility labels", async () => {
      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Shared by me")).toBeTruthy();
        expect(screen.getByText("Shared with me")).toBeTruthy();
      });

      // Check that important elements are reachable
      expect(
        screen.getByRole("button", { name: /Vacation Photos/i }),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: /Work Projects/i }),
      ).toBeTruthy();
    });
  });

  describe("Performance", () => {
    it("handles large number of albums efficiently", async () => {
      // Create many albums for performance testing
      const manyAlbums: SharedAlbum[] = Array.from({ length: 100 }, (_, i) => ({
        id: `album-${i}`,
        albumId: `album-${i}`,
        albumTitle: `Album ${i}`,
        shareToken: `token-${i}`,
        permissions: "view" as const,
        expiresAt: null,
        viewCount: i,
        isActive: true,
        createdAt: "2024-01-01T00:00:00Z",
      }));

      mockApiRequest.mockResolvedValue({
        json: () =>
          Promise.resolve({
            owned: manyAlbums,
            collaborated: [],
          }),
      } as Response);

      const startTime = performance.now();

      render(
        <TestWrapper>
          <SharedAlbumsScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Album 0")).toBeTruthy();
        expect(screen.getByText("Album 99")).toBeTruthy();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Should render within reasonable time (less than 1 second)
      expect(renderTime).toBeLessThan(1000);
    });
  });
});
