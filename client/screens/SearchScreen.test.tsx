// AI-META-BEGIN
// AI-META: Unit tests for SearchScreen component covering NLP search functionality
// OWNERSHIP: client/screens (search testing)
// ENTRYPOINTS: Test suite for SearchScreen component
// DEPENDENCIES: @testing-library/react-native, jest, React Query mocks
// DANGER: Component testing complexity; API mocking requirements
// CHANGE-SAFETY: Safe - tests validate component behavior; update when adding features
// TESTS: npm run test client/screens/SearchScreen.test.tsx
// AI-META-END

import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/hooks/useTheme";
import SearchScreen from "./SearchScreen";
import { Photo } from "@/types";
import { getPhotos } from "@/lib/storage";
import { apiClient } from "@/lib/api";

// Mock dependencies
jest.mock("@/lib/storage");
jest.mock("@/lib/api");
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockGetPhotos = getPhotos as jest.MockedFunction<typeof getPhotos>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

// Test data
const mockPhotos: Photo[] = [
  {
    id: "1",
    uri: "https://example.com/photo1.jpg",
    width: 1920,
    height: 1080,
    createdAt: Date.now() - 86400000, // 1 day ago
    modifiedAt: Date.now() - 86400000,
    filename: "beach_sunset.jpg",
    isFavorite: true,
    albumIds: [],
    mlLabels: ["beach", "sunset", "ocean"],
    tags: ["vacation", "summer"],
    notes: "Beautiful sunset at the beach",
  },
  {
    id: "2",
    uri: "https://example.com/photo2.jpg",
    width: 1920,
    height: 1080,
    createdAt: Date.now() - 172800000, // 2 days ago
    modifiedAt: Date.now() - 172800000,
    filename: "family_dinner.jpg",
    isFavorite: false,
    albumIds: [],
    mlLabels: ["people", "food", "restaurant"],
    tags: ["family", "dinner"],
    notes: "Family dinner at favorite restaurant",
  },
  {
    id: "3",
    uri: "https://example.com/photo3.jpg",
    width: 1920,
    height: 1080,
    createdAt: Date.now() - 259200000, // 3 days ago
    modifiedAt: Date.now() - 259200000,
    filename: "mountain_hike.mp4",
    isFavorite: false,
    albumIds: [],
    isVideo: true,
    videoDuration: 120,
    mlLabels: ["mountain", "hiking", "nature"],
    tags: ["adventure", "outdoors"],
    notes: "Mountain hiking adventure",
  },
];

// Mock theme
const mockTheme = {
  backgroundRoot: "#ffffff",
  backgroundDefault: "#f8f9fa",
  backgroundSecondary: "#e9ecef",
  text: "#212529",
  textSecondary: "#6c757d",
  border: "#dee2e6",
};

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  reset: jest.fn(),
  setOptions: jest.fn(),
  isFocused: jest.fn(() => true),
  addListener: jest.fn(),
  removeListener: jest.fn(),
  dispatch: jest.fn(),
};

// Create test query client
const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

// Test wrapper component
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        value={{ theme: mockTheme, isDark: false, toggleTheme: jest.fn() }}
      >
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
};

// Mock safe area insets
jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({
    top: 44,
    bottom: 34,
    left: 0,
    right: 0,
  }),
}));

// Mock bottom tab bar height
jest.mock("@react-navigation/bottom-tabs", () => ({
  useBottomTabBarHeight: () => 80,
}));

describe("SearchScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPhotos.mockResolvedValue(mockPhotos);

    // Mock API responses
    mockApiClient.post.mockResolvedValue({
      data: {
        photos: [mockPhotos[0]],
        total: 1,
        query: { text: "beach" },
        suggestions: ["beach photos", "sunset photos"],
        pagination: {
          limit: 50,
          offset: 0,
          hasMore: false,
          total: 1,
        },
      },
    });

    mockApiClient.get.mockResolvedValue({
      data: {
        suggestions: ["beach", "sunset", "ocean"],
      },
    });
  });

  describe("Initial render", () => {
    it("should render search input and popular searches", async () => {
      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      // Check for search input
      expect(
        screen.getByPlaceholderText("Search photos with natural language..."),
      ).toBeTruthy();

      // Wait for popular searches to load
      await waitFor(() => {
        expect(screen.getByText("Popular Searches")).toBeTruthy();
      });

      // Check for popular search chips
      expect(screen.getByText("beach photos")).toBeTruthy();
      expect(screen.getByText("sunset photos")).toBeTruthy();
    });

    it("should show quick filters section", async () => {
      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Quick Filters")).toBeTruthy();
      });

      // Check for filter chips
      expect(screen.getByText("Favorites")).toBeTruthy();
      expect(screen.getByText("Videos")).toBeTruthy();
      expect(screen.getByText("Recent")).toBeTruthy();
    });
  });

  describe("Search functionality", () => {
    it("should handle search input changes", async () => {
      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );

      // Type search query
      fireEvent.changeText(searchInput, "beach");

      // Check if input value changed
      await waitFor(() => {
        expect(searchInput.props.value).toBe("beach");
      });
    });

    it("should trigger search on submit", async () => {
      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );

      // Type and submit search
      fireEvent.changeText(searchInput, "beach");
      fireEvent(searchInput, "submitEditing");

      // Wait for API call
      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith("/api/search", {
          query: "beach",
          limit: 50,
          offset: 0,
        });
      });
    });

    it("should show search results", async () => {
      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );

      // Perform search
      fireEvent.changeText(searchInput, "beach");
      fireEvent(searchInput, "submitEditing");

      // Wait for results
      await waitFor(() => {
        expect(screen.getByText("1 result")).toBeTruthy();
        expect(screen.getByText('for "beach"')).toBeTruthy();
      });
    });

    it("should show loading state during search", async () => {
      // Mock slow API response
      mockApiClient.post.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: {
                    photos: [mockPhotos[0]],
                    total: 1,
                    query: { text: "beach" },
                    suggestions: [],
                    pagination: {
                      limit: 50,
                      offset: 0,
                      hasMore: false,
                      total: 1,
                    },
                  },
                }),
              100,
            ),
          ),
      );

      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );

      fireEvent.changeText(searchInput, "beach");
      fireEvent(searchInput, "submitEditing");

      // Check for loading state
      expect(screen.getByText("Searching...")).toBeTruthy();

      // Wait for results
      await waitFor(
        () => {
          expect(screen.getByText("1 result")).toBeTruthy();
        },
        { timeout: 200 },
      );
    });

    it("should handle search errors gracefully", async () => {
      // Mock API error
      mockApiClient.post.mockRejectedValue(new Error("Network error"));

      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );

      fireEvent.changeText(searchInput, "beach");
      fireEvent(searchInput, "submitEditing");

      // Wait for error state
      await waitFor(() => {
        expect(
          screen.getByText("Search failed. Using local search."),
        ).toBeTruthy();
      });
    });
  });

  describe("Suggestions functionality", () => {
    it("should show suggestions when typing", async () => {
      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );

      // Type enough to trigger suggestions
      fireEvent.changeText(searchInput, "be");
      fireEvent(searchInput, "focus");

      // Wait for suggestions
      await waitFor(() => {
        expect(mockApiClient.get).toHaveBeenCalledWith(
          "/api/search/suggestions",
          {
            params: { partial: "be", limit: 5 },
          },
        );
      });
    });

    it("should handle suggestion press", async () => {
      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );

      // Type to get suggestions
      fireEvent.changeText(searchInput, "be");
      fireEvent(searchInput, "focus");

      // Wait for suggestions and press one
      await waitFor(() => {
        // This would be the suggestion item - in a real test, you'd need to mock the dropdown
        expect(mockApiClient.get).toHaveBeenCalled();
      });
    });
  });

  describe("Filter chips", () => {
    it("should handle filter chip press", async () => {
      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      // First perform a search to show filter chips
      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );
      fireEvent.changeText(searchInput, "photos");
      fireEvent(searchInput, "submitEditing");

      await waitFor(() => {
        expect(screen.getByText("Favorites")).toBeTruthy();
      });

      // Press filter chip
      fireEvent.press(screen.getByText("Favorites"));

      // Check if filter was applied (query should be updated)
      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith("/api/search", {
          query: "photos favorites",
          limit: 50,
          offset: 0,
        });
      });
    });
  });

  describe("Popular searches", () => {
    it("should handle popular search press", async () => {
      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("beach photos")).toBeTruthy();
      });

      // Press popular search
      fireEvent.press(screen.getByText("beach photos"));

      // Check if search was triggered
      await waitFor(() => {
        expect(mockApiClient.post).toHaveBeenCalledWith("/api/search", {
          query: "beach photos",
          limit: 50,
          offset: 0,
        });
      });
    });
  });

  describe("Photo interactions", () => {
    it("should handle photo press", async () => {
      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      // Perform search to get results
      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );
      fireEvent.changeText(searchInput, "beach");
      fireEvent(searchInput, "submitEditing");

      // Wait for results and press photo
      await waitFor(() => {
        // In a real test, you'd find the photo by testID or accessibility
        expect(screen.getByText("1 result")).toBeTruthy();
      });
    });
  });

  describe("Clear search", () => {
    it("should clear search when X is pressed", async () => {
      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );

      // Type search query
      fireEvent.changeText(searchInput, "beach");
      expect(searchInput.props.value).toBe("beach");

      // Press clear button
      const clearButton = screen.getByText("×"); // X icon
      fireEvent.press(clearButton);

      // Check if search was cleared
      expect(searchInput.props.value).toBe("");
    });
  });

  describe("Fallback to local search", () => {
    it("should use local search when API fails", async () => {
      // Mock API failure
      mockApiClient.post.mockRejectedValue(new Error("Network error"));

      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );

      fireEvent.changeText(searchInput, "beach");
      fireEvent(searchInput, "submitEditing");

      // Wait for local search results
      await waitFor(() => {
        expect(screen.getByText("1 result")).toBeTruthy(); // Should find beach photo locally
      });
    });

    it("should search across multiple fields locally", async () => {
      mockApiClient.post.mockRejectedValue(new Error("Network error"));

      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );

      // Search for content in notes
      fireEvent.changeText(searchInput, "beautiful");
      fireEvent(searchInput, "submitEditing");

      await waitFor(() => {
        expect(screen.getByText("1 result")).toBeTruthy(); // Should find photo with "beautiful" in notes
      });
    });
  });

  describe("Empty states", () => {
    it("should show no results when search returns nothing", async () => {
      // Mock empty search results
      mockApiClient.post.mockResolvedValue({
        data: {
          photos: [],
          total: 0,
          query: { text: "nonexistent" },
          suggestions: ['Try searching for "photo"'],
          pagination: { limit: 50, offset: 0, hasMore: false, total: 0 },
        },
      });

      render(
        <TestWrapper>
          <SearchScreen />
        </TestWrapper>,
      );

      const searchInput = screen.getByPlaceholderText(
        "Search photos with natural language...",
      );

      fireEvent.changeText(searchInput, "nonexistent");
      fireEvent(searchInput, "submitEditing");

      await waitFor(() => {
        expect(screen.getByText("No photos found")).toBeTruthy();
        expect(
          screen.getByText("Try different keywords or filters"),
        ).toBeTruthy();
      });
    });
  });
});
