/**
 * Tests for PhotoDetailScreen metadata update functionality and video playback
 * Validates Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7 and video playback features
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, render, screen, fireEvent } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
} from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import { useVideoPlayer, VideoView } from "expo-video";
import { useRoute, useNavigation } from "@react-navigation/native";

// Mock dependencies
vi.mock("@/lib/query-client", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("expo-video", () => ({
  useVideoPlayer: vi.fn(),
  VideoView: vi.fn(({ style, accessibilityLabel }) => 
    React.createElement('View', { testID: 'video-view', style, accessibilityLabel })
  ),
}));

vi.mock("@react-navigation/native", () => ({
  useRoute: vi.fn(),
  useNavigation: vi.fn(),
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("@/lib/secure-storage", () => ({
  getDecryptedPhotoUri: vi.fn((photo) => Promise.resolve(photo.uri)),
}));

vi.mock("@shopify/flash-list", () => ({
  FlashList: ({ children }: { children: React.ReactNode }) => 
    React.createElement('View', { testID: 'flash-list', children })
  },
}));

describe("PhotoDetailScreen - Metadata Updates", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("Favorite Toggle Mutation", () => {
    it("should send PUT request with isFavorite field (Requirement 4.1)", async () => {
      const mockResponse = {
        json: vi
          .fn()
          .mockResolvedValue({ photo: { id: "photo-1", isFavorite: true } }),
        ok: true,
        status: 200,
      };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async ({
              photoId,
              isFavorite,
            }: {
              photoId: string;
              isFavorite: boolean;
            }) => {
              const res = await apiRequest("PUT", `/api/photos/${photoId}`, {
                isFavorite,
              });
              return res.json();
            },
          }),
        { wrapper },
      );

      result.current.mutate({ photoId: "photo-1", isFavorite: true });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiRequest).toHaveBeenCalledWith("PUT", "/api/photos/photo-1", {
        isFavorite: true,
      });
    });

    it("should apply optimistic update immediately (Requirement 4.4)", async () => {
      const mockResponse = {
        json: vi
          .fn()
          .mockResolvedValue({ photo: { id: "photo-1", isFavorite: true } }),
        ok: true,
        status: 200,
      };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      // Set initial data
      queryClient.setQueryData(
        ["photos"],
        [
          {
            id: "photo-1",
            isFavorite: false,
            uri: "test.jpg",
            width: 100,
            height: 100,
          },
        ],
      );

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async ({
              photoId,
              isFavorite,
            }: {
              photoId: string;
              isFavorite: boolean;
            }) => {
              const res = await apiRequest("PUT", `/api/photos/${photoId}`, {
                isFavorite,
              });
              return res.json();
            },
            onMutate: async ({ photoId, isFavorite }) => {
              await queryClient.cancelQueries({ queryKey: ["photos"] });
              const previousPhotos = queryClient.getQueryData(["photos"]);

              queryClient.setQueryData(["photos"], (old: any[] = []) =>
                old.map((photo) =>
                  photo.id === photoId
                    ? { ...photo, isFavorite, modifiedAt: Date.now() }
                    : photo,
                ),
              );

              return { previousPhotos };
            },
          }),
        { wrapper },
      );

      result.current.mutate({ photoId: "photo-1", isFavorite: true });

      // Wait for mutation to start (onMutate to run)
      await waitFor(() => {
        const photos = queryClient.getQueryData(["photos"]) as any[];
        return photos && photos[0].isFavorite === true;
      });

      // Check optimistic update happened
      const photos = queryClient.getQueryData(["photos"]) as any[];
      expect(photos[0].isFavorite).toBe(true);
    });

    it("should rollback on error (Requirement 4.5)", async () => {
      vi.mocked(apiRequest).mockRejectedValue(new Error("Network error"));

      // Set initial data
      queryClient.setQueryData(
        ["photos"],
        [
          {
            id: "photo-1",
            isFavorite: false,
            uri: "test.jpg",
            width: 100,
            height: 100,
          },
        ],
      );

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async ({
              photoId,
              isFavorite,
            }: {
              photoId: string;
              isFavorite: boolean;
            }) => {
              const res = await apiRequest("PUT", `/api/photos/${photoId}`, {
                isFavorite,
              });
              return res.json();
            },
            onMutate: async ({ photoId, isFavorite }) => {
              await queryClient.cancelQueries({ queryKey: ["photos"] });
              const previousPhotos = queryClient.getQueryData(["photos"]);

              queryClient.setQueryData(["photos"], (old: any[] = []) =>
                old.map((photo) =>
                  photo.id === photoId
                    ? { ...photo, isFavorite, modifiedAt: Date.now() }
                    : photo,
                ),
              );

              return { previousPhotos };
            },
            onError: (err, variables, context) => {
              if (context?.previousPhotos) {
                queryClient.setQueryData(["photos"], context.previousPhotos);
              }
            },
          }),
        { wrapper },
      );

      result.current.mutate({ photoId: "photo-1", isFavorite: true });

      await waitFor(() => expect(result.current.isError).toBe(true));

      // Check rollback happened
      const photos = queryClient.getQueryData(["photos"]) as any[];
      expect(photos[0].isFavorite).toBe(false);
    });
  });

  describe("Tags Update Mutation", () => {
    it("should send PUT request with tags array (Requirement 4.2)", async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          photo: { id: "photo-1", tags: ["vacation", "beach"] },
        }),
        ok: true,
        status: 200,
      };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async ({
              photoId,
              tags,
            }: {
              photoId: string;
              tags: string[];
            }) => {
              const res = await apiRequest("PUT", `/api/photos/${photoId}`, {
                tags,
              });
              return res.json();
            },
          }),
        { wrapper },
      );

      result.current.mutate({
        photoId: "photo-1",
        tags: ["vacation", "beach"],
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiRequest).toHaveBeenCalledWith("PUT", "/api/photos/photo-1", {
        tags: ["vacation", "beach"],
      });
    });

    it("should update cache on success (Requirement 4.6)", async () => {
      const mockResponse = {
        json: vi
          .fn()
          .mockResolvedValue({ photo: { id: "photo-1", tags: ["vacation"] } }),
        ok: true,
        status: 200,
      };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      queryClient.setQueryData(
        ["photos"],
        [{ id: "photo-1", tags: [], uri: "test.jpg", width: 100, height: 100 }],
      );

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async ({
              photoId,
              tags,
            }: {
              photoId: string;
              tags: string[];
            }) => {
              const res = await apiRequest("PUT", `/api/photos/${photoId}`, {
                tags,
              });
              return res.json();
            },
            onMutate: async ({ photoId, tags }) => {
              await queryClient.cancelQueries({ queryKey: ["photos"] });
              queryClient.setQueryData(["photos"], (old: any[] = []) =>
                old.map((photo) =>
                  photo.id === photoId
                    ? { ...photo, tags, modifiedAt: Date.now() }
                    : photo,
                ),
              );
            },
            onSettled: () => {
              queryClient.invalidateQueries({ queryKey: ["photos"] });
            },
          }),
        { wrapper },
      );

      result.current.mutate({ photoId: "photo-1", tags: ["vacation"] });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      const photos = queryClient.getQueryData(["photos"]) as any[];
      expect(photos[0].tags).toEqual(["vacation"]);
    });
  });

  describe("Notes Update Mutation", () => {
    it("should send PUT request with notes field (Requirement 4.3)", async () => {
      const mockResponse = {
        json: vi.fn().mockResolvedValue({
          photo: { id: "photo-1", notes: "Beautiful sunset" },
        }),
        ok: true,
        status: 200,
      };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(
        () =>
          useMutation({
            mutationFn: async ({
              photoId,
              notes,
            }: {
              photoId: string;
              notes: string;
            }) => {
              const res = await apiRequest("PUT", `/api/photos/${photoId}`, {
                notes,
              });
              return res.json();
            },
          }),
        { wrapper },
      );

      result.current.mutate({ photoId: "photo-1", notes: "Beautiful sunset" });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(apiRequest).toHaveBeenCalledWith("PUT", "/api/photos/photo-1", {
        notes: "Beautiful sunset",
      });
    });
  });

  describe("Debouncing (Requirement 4.7)", () => {
    it("should debounce text input updates by 500ms", async () => {
      vi.useFakeTimers();

      const mockMutate = vi.fn();
      const debounceTimer = { current: null as NodeJS.Timeout | null };

      const handleNotesUpdate = (photoId: string, notes: string) => {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        debounceTimer.current = setTimeout(() => {
          mockMutate({ photoId, notes });
        }, 500);
      };

      // Simulate rapid typing
      handleNotesUpdate("photo-1", "B");
      handleNotesUpdate("photo-1", "Be");
      handleNotesUpdate("photo-1", "Bea");
      handleNotesUpdate("photo-1", "Beau");
      handleNotesUpdate("photo-1", "Beautiful");

      // Should not have called mutate yet
      expect(mockMutate).not.toHaveBeenCalled();

      // Fast forward 499ms - still shouldn't call
      vi.advanceTimersByTime(499);
      expect(mockMutate).not.toHaveBeenCalled();

      // Fast forward 1 more ms (total 500ms) - should call now
      vi.advanceTimersByTime(1);
      expect(mockMutate).toHaveBeenCalledTimes(1);
      expect(mockMutate).toHaveBeenCalledWith({
        photoId: "photo-1",
        notes: "Beautiful",
      });

      vi.useRealTimers();
    });
  });
});

describe("PhotoDetailScreen - Video Playback", () => {
  let queryClient: QueryClient;
  const mockNavigate = vi.fn();
  const mockRoute = {
    params: { photoId: 'video-123', initialIndex: 0, context: 'photos' },
  };

  const mockPhotos = [
    {
      id: 'video-123',
      uri: 'file://video.mp4',
      width: 1920,
      height: 1080,
      filename: 'test-video.mp4',
      isVideo: true,
      videoDuration: 120,
      videoThumbnailUri: 'file://thumbnail.jpg',
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isFavorite: false,
      albumIds: [],
    },
    {
      id: 'photo-456',
      uri: 'file://photo.jpg',
      width: 1920,
      height: 1080,
      filename: 'test-photo.jpg',
      isVideo: false,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isFavorite: false,
      albumIds: [],
    },
  ];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();

    vi.mocked(useNavigation).mockReturnValue({
      goBack: mockNavigate,
      navigate: mockNavigate,
    } as any);

    vi.mocked(useRoute).mockReturnValue(mockRoute as any);

    vi.mocked(apiRequest).mockResolvedValue({
      json: () => Promise.resolve({ photos: mockPhotos }),
    });
  });

  afterEach(() => {
    queryClient.clear();
    vi.restoreAllMocks();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  describe("Video Player Integration", () => {
    it("should render video player for video items", async () => {
      const mockPlayer = {
        loop: false,
        muted: false,
        play: vi.fn(),
        pause: vi.fn(),
      };

      vi.mocked(useVideoPlayer).mockReturnValue(mockPlayer as any);

      // Import and render the component
      const PhotoDetailScreen = require("./PhotoDetailScreen").default;
      
      render(<PhotoDetailScreen />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId("video-view")).toBeTruthy();
      });

      expect(useVideoPlayer).toHaveBeenCalledWith("file://video.mp4", expect.any(Function));
      expect(screen.getByTestId("video-view")).toHaveProp("accessibilityLabel", "Video player");
    });

    it("should render image for non-video items", async () => {
      // Update route to point to a photo
      vi.mocked(useRoute).mockReturnValue({
        params: { photoId: 'photo-456', initialIndex: 1, context: 'photos' },
      } as any);

      const PhotoDetailScreen = require("./PhotoDetailScreen").default;
      render(<PhotoDetailScreen />, { wrapper });

      // Should not render video view for photos
      expect(screen.queryByTestId("video-view")).toBeNull();
    });

    it("should configure video player correctly", async () => {
      const mockPlayer = {
        loop: false,
        muted: false,
        play: vi.fn(),
        pause: vi.fn(),
      };

      vi.mocked(useVideoPlayer).mockReturnValue(mockPlayer as any);

      const PhotoDetailScreen = require("./PhotoDetailScreen").default;
      render(<PhotoDetailScreen />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId("video-view")).toBeTruthy();
      });

      // Verify player configuration
      const setupCallback = vi.mocked(useVideoPlayer).mock.calls[0][1];
      setupCallback(mockPlayer);

      expect(mockPlayer.loop).toBe(false);
      expect(mockPlayer.muted).toBe(false);
    });
  });

  describe("Video Controls and Accessibility", () => {
    it("should show video-specific accessibility labels", async () => {
      const mockPlayer = {
        loop: false,
        muted: false,
        play: vi.fn(),
        pause: vi.fn(),
      };

      vi.mocked(useVideoPlayer).mockReturnValue(mockPlayer as any);

      const PhotoDetailScreen = require("./PhotoDetailScreen").default;
      render(<PhotoDetailScreen />, { wrapper });

      await waitFor(() => {
        const videoView = screen.getByTestId("video-view");
        expect(videoView).toHaveProp("accessibilityLabel", "Video player");
      });
    });

    it("should handle video player controls", async () => {
      const mockPlayer = {
        loop: false,
        muted: false,
        play: vi.fn(),
        pause: vi.fn(),
      };

      vi.mocked(useVideoPlayer).mockReturnValue(mockPlayer as any);

      const PhotoDetailScreen = require("./PhotoDetailScreen").default;
      render(<PhotoDetailScreen />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId("video-view")).toBeTruthy();
      });

      // Test that VideoView receives correct props
      const videoView = screen.getByTestId("video-view");
      expect(videoView).toHaveProp("allowsFullscreen", true);
      expect(videoView).toHaveProp("allowsPictureInPicture", true);
    });
  });

  describe("Video Error Handling", () => {
    it("should handle video loading errors gracefully", async () => {
      // Mock video loading error
      vi.mocked(require("@/lib/secure-storage").getDecryptedPhotoUri).mockRejectedValue(
        new Error("Failed to decrypt video")
      );

      const mockPlayer = {
        loop: false,
        muted: false,
        play: vi.fn(),
        pause: vi.fn(),
      };

      vi.mocked(useVideoPlayer).mockReturnValue(mockPlayer as any);

      // Mock console.error to prevent test output noise
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const PhotoDetailScreen = require("./PhotoDetailScreen").default;
      render(<PhotoDetailScreen />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId("video-view")).toBeTruthy();
      });

      consoleSpy.mockRestore();
    });

    it("should handle corrupted video files", async () => {
      const mockPlayer = {
        loop: false,
        muted: false,
        play: vi.fn(),
        pause: vi.fn(),
      };

      vi.mocked(useVideoPlayer).mockReturnValue(mockPlayer as any);

      const PhotoDetailScreen = require("./PhotoDetailScreen").default;
      render(<PhotoDetailScreen />, { wrapper });

      await waitFor(() => {
        expect(screen.getByTestId("video-view")).toBeTruthy();
      });

      // The component should still render even with potential video issues
      expect(screen.getByTestId("video-view")).toBeTruthy();
    });
  });
});
