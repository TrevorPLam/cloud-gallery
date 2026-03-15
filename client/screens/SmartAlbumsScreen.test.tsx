// AI-META-BEGIN
// AI-META: Smart Albums Screen Unit Tests - React Native component testing
// OWNERSHIP: client/screens/SmartAlbumsScreen.test.tsx
// ENTRYPOINTS: Jest test runner
// DEPENDENCIES: @testing-library/react-native, react-query mocking
// DANGER: Component tests may require mock implementations
// CHANGE-SAFETY: Adding new tests is safe; changing existing tests may affect coverage
// TESTS: npm run test client/screens/SmartAlbumsScreen.test.tsx
// AI-META-END

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { migrationHelpers } from "../test-utils/accessibility";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Alert } from "react-native";
import SmartAlbumsScreen from "./SmartAlbumsScreen";

// Mock dependencies
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: jest.requireActual("@react-navigation/native").useFocusEffect,
}));

jest.mock("react-native-vector-icons/Ionicons", () => "Icon");

// Mock Alert
jest.mock("react-native", () => ({
  ...jest.requireActual("react-native"),
  Alert: {
    alert: jest.fn(),
  },
}));

// Mock fetch API
global.fetch = jest.fn();

// Test data
const mockAlbums = {
  albums: [
    {
      id: "album-1",
      userId: "user-1",
      albumType: "people",
      title: "John Doe",
      description: "Photos of John Doe",
      criteria: { peopleIds: ["person-1"] },
      coverPhotoId: "photo-1",
      coverPhotoUri: "https://example.com/photo1.jpg",
      photoCount: 25,
      isPinned: true,
      isHidden: false,
      lastUpdatedAt: "2024-01-15T10:00:00Z",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
    },
    {
      id: "album-2",
      userId: "user-1",
      albumType: "places",
      title: "Paris",
      description: "Photos taken in Paris",
      criteria: { locationNames: ["Paris"] },
      coverPhotoId: "photo-2",
      coverPhotoUri: "https://example.com/photo2.jpg",
      photoCount: 15,
      isPinned: false,
      isHidden: false,
      lastUpdatedAt: "2024-01-15T10:00:00Z",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
    },
    {
      id: "album-3",
      userId: "user-1",
      albumType: "things",
      title: "Food",
      description: "Culinary moments and meals",
      criteria: { labels: ["food"] },
      coverPhotoId: "photo-3",
      coverPhotoUri: "https://example.com/photo3.jpg",
      photoCount: 8,
      isPinned: false,
      isHidden: false,
      lastUpdatedAt: "2024-01-15T10:00:00Z",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
    },
    {
      id: "album-4",
      userId: "user-1",
      albumType: "special",
      title: "Videos",
      description: "All video files",
      criteria: { isVideo: true },
      coverPhotoId: "photo-4",
      coverPhotoUri: "https://example.com/photo4.jpg",
      photoCount: 3,
      isPinned: false,
      isHidden: false,
      lastUpdatedAt: "2024-01-15T10:00:00Z",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
    },
    {
      id: "album-5",
      userId: "user-1",
      albumType: "people",
      title: "Hidden Person",
      description: "This should be hidden",
      criteria: { peopleIds: ["person-2"] },
      coverPhotoId: "photo-5",
      coverPhotoUri: "https://example.com/photo5.jpg",
      photoCount: 5,
      isPinned: false,
      isHidden: true,
      lastUpdatedAt: "2024-01-15T10:00:00Z",
      createdAt: "2024-01-15T10:00:00Z",
      updatedAt: "2024-01-15T10:00:00Z",
    },
  ],
  total: 4, // Excluding hidden album
};

// Helper function to render component with QueryClient
const renderWithQueryClient = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>,
  );
};

describe("SmartAlbumsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful fetch for smart albums
    (fetch as jest.Mock).mockImplementation((url) => {
      if (url === "/api/smart-albums") {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: mockAlbums,
            }),
        });
      }
      return Promise.resolve({
        ok: false,
        status: 404,
      });
    });
  });

  describe("Album Display", () => {
    it("should display smart albums grouped by type", async () => {
      const { getByText, getByRole } = renderWithQueryClient(
        <SmartAlbumsScreen />,
      );

      await waitFor(() => {
        expect(getByText("Smart Albums")).toBeTruthy();
        expect(getByText("People")).toBeTruthy();
        expect(getByText("Places")).toBeTruthy();
        expect(getByText("Things")).toBeTruthy();
        expect(getByText("Special")).toBeTruthy();
      });

      // Check album titles are displayed
      expect(getByText("John Doe")).toBeTruthy();
      expect(getByText("Paris")).toBeTruthy();
      expect(getByText("Food")).toBeTruthy();
      expect(getByText("Videos")).toBeTruthy();

      // Check hidden album is not displayed
      expect(() => getByText("Hidden Person")).toThrow();
    });

    it("should display photo counts for each album", async () => {
      const { getByText } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        expect(getByText("25 photos")).toBeTruthy();
        expect(getByText("15 photos")).toBeTruthy();
        expect(getByText("8 photos")).toBeTruthy();
        expect(getByText("3 photos")).toBeTruthy();
      });
    });

    it("should display pinned badges for pinned albums", async () => {
      const { getByRole } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        // John Doe album should have pinned badge
        const pinnedAlbum = getByRole('button', { name: /John Doe/i });
        expect(pinnedAlbum).toHaveStyle({
          borderWidth: 1,
          borderColor: "#FFD700",
        });
      });
    });

    it("should sort albums correctly within each section", async () => {
      const { getAllByText } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        // In People section, John Doe (pinned) should appear before other people albums
        const peopleAlbums = getAllByText(/photos/).filter((text) =>
          text.props.children.includes("photos"),
        );

        // Pinned album should have higher priority
        expect(peopleAlbums[0].props.children).toBe("25 photos"); // John Doe (pinned)
      });
    });
  });

  describe("Album Interactions", () => {
    it("should show album actions when album is selected", async () => {
      const { getByText, getByRole } = renderWithQueryClient(
        <SmartAlbumsScreen />,
      );

      await waitFor(() => {
        expect(getByText("John Doe")).toBeTruthy();
      });

      // Tap on album to select it
      const albumCard = getByRole('button', { name: /John Doe/i });
      fireEvent.press(albumCard);

      // Actions should be visible (selected state)
      expect(albumCard).toHaveStyle({ borderWidth: 2, borderColor: "#007AFF" });
    });

    it("should deselect album when tapped again", async () => {
      const { getByRole } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        const albumCard = getByRole('button', { name: /John Doe/i });
        expect(albumCard).toBeTruthy();
      });

      const albumCard = getByRole('button', { name: /John Doe/i });

      // Select album
      fireEvent.press(albumCard);
      expect(albumCard).toHaveStyle({ borderWidth: 2, borderColor: "#007AFF" });

      // Deselect album
      fireEvent.press(albumCard);
      expect(albumCard).not.toHaveStyle({
        borderWidth: 2,
        borderColor: "#007AFF",
      });
    });

    it("should show confirmation dialog when hiding album", async () => {
      const { getByRole, getByText } = renderWithQueryClient(
        <SmartAlbumsScreen />,
      );

      await waitFor(() => {
        expect(getByText("John Doe")).toBeTruthy();
      });

      // Select album
      const albumCard = getByRole('button', { name: /John Doe/i });
      fireEvent.press(albumCard);

      // Tap hide button
      const hideButton = getByRole('button', { name: /hide/i });
      fireEvent.press(hideButton);

      // Alert should be shown
      expect(Alert.alert).toHaveBeenCalledWith(
        "Hide Smart Album",
        'Are you sure you want to hide "John Doe"? You can unhide it later.',
        expect.any(Array),
      );
    });

    it("should toggle pin status when pin button is pressed", async () => {
      // Mock update API call
      (fetch as jest.Mock).mockImplementation((url, options) => {
        if (url === "/api/smart-albums/album-1" && options?.method === "PUT") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  album: {
                    ...mockAlbums.albums[0],
                    isPinned: false,
                  },
                },
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockAlbums }),
        });
      });

      const { getByRole } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        const albumCard = getByRole('button', { name: /John Doe/i });
        expect(albumCard).toBeTruthy();
      });

      const albumCard = getByRole('button', { name: /John Doe/i });

      // Select album
      fireEvent.press(albumCard);

      // Tap pin button
      const pinButton = getByRole('button', { name: /pin/i });
      fireEvent.press(pinButton);

      // API call should be made
      expect(fetch).toHaveBeenCalledWith("/api/smart-albums/album-1", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: false }),
      });
    });
  });

  describe("Generate Albums", () => {
    it("should show confirmation dialog when generate button is pressed", async () => {
      const { getByRole } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        const generateButton = getByRole('button', { name: /generate/i });
        expect(generateButton).toBeTruthy();
      });

      const generateButton = getByRole('button', { name: /generate/i });
      fireEvent.press(generateButton);

      expect(Alert.alert).toHaveBeenCalledWith(
        "Generate Smart Albums",
        "This will analyze your photos and create smart albums based on people, places, and things. Continue?",
        expect.any(Array),
      );
    });

    it("should call generate API when confirmed", async () => {
      // Mock generate API call
      (fetch as jest.Mock).mockImplementation((url, options) => {
        if (
          url === "/api/smart-albums/generate" &&
          options?.method === "POST"
        ) {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                success: true,
                data: mockAlbums,
              }),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockAlbums }),
        });
      });

      const { getByRole } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        const generateButton = getByRole('button', { name: /generate/i });
        expect(generateButton).toBeTruthy();
      });

      const generateButton = getByRole('button', { name: /generate/i });
      fireEvent.press(generateButton);

      // Get the alert callback and call the "Generate" button
      const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
      const generateCallback = alertCall[2][1].onPress;

      generateCallback();

      // API call should be made
      expect(fetch).toHaveBeenCalledWith("/api/smart-albums/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading indicator while fetching albums", () => {
      // Mock slow response
      (fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: () =>
                    Promise.resolve({ success: true, data: mockAlbums }),
                }),
              100,
            ),
          ),
      );

      const { getByText } = renderWithQueryClient(<SmartAlbumsScreen />);

      expect(getByText("Loading smart albums...")).toBeTruthy();
    });
  });

  describe("Error States", () => {
    it("should show error message when fetch fails", async () => {
      // Mock failed response
      (fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      const { getByText } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        expect(getByText("Failed to load smart albums")).toBeTruthy();
        expect(getByText("Retry")).toBeTruthy();
      });
    });

    it("should retry when retry button is pressed", async () => {
      // Mock failed response then success
      let callCount = 0;
      (fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: true, data: mockAlbums }),
        });
      });

      const { getByText } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        expect(getByText("Failed to load smart albums")).toBeTruthy();
      });

      const retryButton = getByText("Retry");
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(getByText("John Doe")).toBeTruthy();
      });

      expect(callCount).toBe(2);
    });
  });

  describe("Empty States", () => {
    it("should show empty state when no albums exist", async () => {
      // Mock empty response
      (fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { albums: [], total: 0 },
            }),
        }),
      );

      const { getByText } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        expect(getByText("No Smart Albums")).toBeTruthy();
        expect(getByText("Generate Smart Albums")).toBeTruthy();
      });
    });

    it("should show generate button in empty state", async () => {
      // Mock empty response
      (fetch as jest.Mock).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              success: true,
              data: { albums: [], total: 0 },
            }),
        }),
      );

      const { getByText } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        const generateButton = getByText("Generate Smart Albums");
        expect(generateButton).toBeTruthy();

        fireEvent.press(generateButton);

        expect(Alert.alert).toHaveBeenCalledWith(
          "Generate Smart Albums",
          expect.any(String),
          expect.any(Array),
        );
      });
    });
  });

  describe("Refresh Functionality", () => {
    it("should refresh when pulled down", async () => {
      const { getByRole } = renderWithQueryClient(<SmartAlbumsScreen />);

      await waitFor(() => {
        // Trigger refresh
        const refreshControl = getByRole('button', { name: /refresh/i });
        fireEvent(refreshControl, "refresh");
      });

      // Should call fetch again
      expect(fetch).toHaveBeenCalledTimes(2); // Initial load + refresh
    });
  });

  describe("Album Grouping", () => {
    it("should group albums by type correctly", async () => {
      const { getByText, queryByText } = renderWithQueryClient(
        <SmartAlbumsScreen />,
      );

      await waitFor(() => {
        // Should have section headers
        expect(getByText("People")).toBeTruthy();
        expect(getByText("Places")).toBeTruthy();
        expect(getByText("Things")).toBeTruthy();
        expect(getByText("Special")).toBeTruthy();

        // Should show album counts
        expect(getByText("1 albums")).toBeTruthy(); // People section (excluding hidden)
        expect(getByText("1 albums")).toBeTruthy(); // Places section
        expect(getByText("1 albums")).toBeTruthy(); // Things section
        expect(getByText("1 albums")).toBeTruthy(); // Special section
      });

      // Hidden album should not be in any section
      expect(queryByText("Hidden Person")).toBeNull();
    });
  });
});
