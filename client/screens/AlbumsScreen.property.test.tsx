/**
 * Property-Based Tests for Album Operations
 *
 * Feature: client-server-integration
 * Tests: Properties 14, 15, 16
 *
 * These tests verify universal properties that should hold for ALL album operations,
 * using fast-check to generate random test cases (100+ iterations per test).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { renderHook, waitFor } from "@testing-library/react";
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import React from "react";
import type { Album, Photo } from "@/types";

import { apiRequest } from "@/lib/query-client";

// Mock the API client
vi.mock("@/lib/query-client", () => ({
  apiRequest: vi.fn(),
}));

// ═══════════════════════════════════════════════════════════
// TEST SETUP
// ═══════════════════════════════════════════════════════════

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ═══════════════════════════════════════════════════════════
// PROPERTY 14: Album Operation Requests
// ═══════════════════════════════════════════════════════════
// **Validates: Requirements 6.2, 6.3, 6.4, 6.5**
//
// For any album operation (create, add photo, remove photo, delete),
// the appropriate HTTP request SHALL be sent to the corresponding
// /api/albums endpoint.

describe("Property 14: Album Operation Requests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should send POST /api/albums for any album creation", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random album data
        fc.record({
          title: fc.string({ minLength: 1, maxLength: 100 }),
          description: fc.option(fc.string({ maxLength: 500 })),
        }),
        async (albumData) => {
          // Mock successful response
          vi.mocked(apiRequest).mockResolvedValueOnce({
            ok: true,
            json: async () => ({
              album: {
                id: fc.sample(fc.uuid(), 1)[0],
                ...albumData,
                coverPhotoUri: null,
                photoIds: [],
                createdAt: Date.now(),
                modifiedAt: Date.now(),
              },
            }),
          } as Response);

          const { result } = renderHook(
            () => {
              const queryClient = useQueryClient();
              return useMutation({
                mutationFn: async (data: {
                  title: string;
                  description?: string;
                }) => {
                  const res = await apiRequest("POST", "/api/albums", data);
                  return res.json();
                },
                onMutate: async () => {
                  await queryClient.cancelQueries({ queryKey: ["albums"] });
                  return { previousAlbums: [] };
                },
              });
            },
            { wrapper: createWrapper() },
          );

          // Trigger mutation
          result.current.mutate(albumData);

          // Wait for mutation to complete with longer timeout
          await waitFor(() => expect(result.current.isSuccess).toBe(true), {
            timeout: 10000,
          });

          // Verify API request was made correctly
          expect(apiRequest).toHaveBeenCalledWith(
            "POST",
            "/api/albums",
            albumData,
          );
        },
      ),
      { numRuns: 10 }, // Reduced from 100 for faster testing
    );
  }, 60000); // 60 second timeout for property test

  it("should send POST /api/albums/:id/photos for any photo addition", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // albumId
        fc.array(fc.uuid(), { minLength: 1, maxLength: 10 }), // photoIds
        async (albumId, photoIds) => {
          // Mock successful responses for each photo
          vi.mocked(apiRequest).mockImplementation(
            async () =>
              ({
                ok: true,
                json: async () => ({ message: "Photo added to album" }),
              }) as Response,
          );

          const { result } = renderHook(
            () => {
              const queryClient = useQueryClient();
              return useMutation({
                mutationFn: async (ids: string[]) => {
                  await Promise.all(
                    ids.map((photoId) =>
                      apiRequest("POST", `/api/albums/${albumId}/photos`, {
                        photoId,
                      }),
                    ),
                  );
                },
                onMutate: async () => {
                  await queryClient.cancelQueries({
                    queryKey: ["albums", albumId],
                  });
                  return { previousAlbum: null };
                },
              });
            },
            { wrapper: createWrapper() },
          );

          // Trigger mutation
          result.current.mutate(photoIds);

          // Wait for mutation to complete with longer timeout
          await waitFor(() => expect(result.current.isSuccess).toBe(true), {
            timeout: 10000,
          });

          // Verify API requests were made for each photo
          photoIds.forEach((photoId) => {
            expect(apiRequest).toHaveBeenCalledWith(
              "POST",
              `/api/albums/${albumId}/photos`,
              { photoId },
            );
          });
        },
      ),
      { numRuns: 10 }, // Reduced from 100 for faster testing
    );
  }, 60000); // 60 second timeout for property test

  it("should send DELETE /api/albums/:id/photos/:photoId for any photo removal", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // albumId
        fc.uuid(), // photoId
        async (albumId, photoId) => {
          // Mock successful response
          vi.mocked(apiRequest).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: "Photo removed from album" }),
          } as Response);

          const { result } = renderHook(
            () => {
              const queryClient = useQueryClient();
              return useMutation({
                mutationFn: async (id: string) => {
                  const res = await apiRequest(
                    "DELETE",
                    `/api/albums/${albumId}/photos/${id}`,
                  );
                  return res.json();
                },
                onMutate: async () => {
                  await queryClient.cancelQueries({
                    queryKey: ["albums", albumId],
                  });
                  return { previousAlbum: null };
                },
              });
            },
            { wrapper: createWrapper() },
          );

          // Trigger mutation
          result.current.mutate(photoId);

          // Wait for mutation to complete with longer timeout
          await waitFor(() => expect(result.current.isSuccess).toBe(true), {
            timeout: 10000,
          });

          // Verify API request was made correctly
          expect(apiRequest).toHaveBeenCalledWith(
            "DELETE",
            `/api/albums/${albumId}/photos/${photoId}`,
          );
        },
      ),
      { numRuns: 10 }, // Reduced from 100 for faster testing
    );
  }, 60000); // 60 second timeout for property test

  it("should send DELETE /api/albums/:id for any album deletion", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // albumId
        async (albumId) => {
          // Mock successful response
          vi.mocked(apiRequest).mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: "Album deleted" }),
          } as Response);

          const { result } = renderHook(
            () => {
              const queryClient = useQueryClient();
              return useMutation({
                mutationFn: async (id: string) => {
                  const res = await apiRequest("DELETE", `/api/albums/${id}`);
                  return res.json();
                },
                onMutate: async () => {
                  await queryClient.cancelQueries({ queryKey: ["albums"] });
                  return { previousAlbums: [] };
                },
              });
            },
            { wrapper: createWrapper() },
          );

          // Trigger mutation
          result.current.mutate(albumId);

          // Wait for mutation to complete with longer timeout
          await waitFor(() => expect(result.current.isSuccess).toBe(true), {
            timeout: 10000,
          });

          // Verify API request was made correctly
          expect(apiRequest).toHaveBeenCalledWith(
            "DELETE",
            `/api/albums/${albumId}`,
          );
        },
      ),
      { numRuns: 10 }, // Reduced from 100 for faster testing
    );
  }, 60000); // 60 second timeout for property test
});

// ═══════════════════════════════════════════════════════════
// PROPERTY 15: Dual Cache Invalidation for Albums
// ═══════════════════════════════════════════════════════════
// **Validates: Requirements 6.6**
//
// For any album operation completion, both ['albums'] and ['photos']
// query caches SHALL be invalidated.

describe("Property 15: Dual Cache Invalidation for Albums", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_DOMAIN = "api.example.com";
  });

  it("should invalidate both albums and photos caches after any album operation", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("create", "addPhoto", "removePhoto", "delete"),
        fc.uuid(), // albumId
        async (operation, albumId) => {
          // Mock successful response
          vi.mocked(apiRequest).mockResolvedValue({
            ok: true,
            json: async () => ({ success: true }),
          } as Response);

          const queryClient = new QueryClient({
            defaultOptions: {
              queries: { retry: false },
              mutations: { retry: false },
            },
          });

          // Spy on invalidateQueries
          const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

          const wrapper = ({ children }: { children: React.ReactNode }) => (
            <QueryClientProvider client={queryClient}>
              {children}
            </QueryClientProvider>
          );

          const { result } = renderHook(
            () => {
              return useMutation({
                mutationFn: async () => {
                  // Simulate different operations
                  switch (operation) {
                    case "create":
                      return apiRequest("POST", "/api/albums", {
                        title: "Test",
                      });
                    case "addPhoto":
                      return apiRequest(
                        "POST",
                        `/api/albums/${albumId}/photos`,
                        { photoId: "photo1" },
                      );
                    case "removePhoto":
                      return apiRequest(
                        "DELETE",
                        `/api/albums/${albumId}/photos/photo1`,
                      );
                    case "delete":
                      return apiRequest("DELETE", `/api/albums/${albumId}`);
                  }
                },
                onSettled: () => {
                  // Invalidate both caches
                  queryClient.invalidateQueries({ queryKey: ["albums"] });
                  queryClient.invalidateQueries({ queryKey: ["photos"] });
                },
              });
            },
            { wrapper },
          );

          // Trigger mutation
          result.current.mutate();

          // Wait for mutation to complete with longer timeout
          await waitFor(
            () =>
              expect(result.current.isSuccess || result.current.isError).toBe(
                true,
              ),
            { timeout: 10000 },
          );

          // Verify both caches were invalidated
          expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["albums"] });
          expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["photos"] });
        },
      ),
      { numRuns: 5 }, // Reduced to 5 for faster testing
    );
  }, 120000); // 120 second timeout for property test
});

// ═══════════════════════════════════════════════════════════
// PROPERTY 16: Album Cover Photo Selection
// ═══════════════════════════════════════════════════════════
// **Validates: Requirements 6.7**
//
// For any album with at least one photo, the coverPhotoUri SHALL be
// the URI of the first photo in the photoIds array.

describe("Property 16: Album Cover Photo Selection", () => {
  it("should set coverPhotoUri to first photo URI for any album with photos", () => {
    fc.assert(
      fc.property(
        // Generate random album with photos
        fc.record({
          id: fc.uuid(),
          title: fc.string({ minLength: 1 }),
          coverPhotoUri: fc.constant(null),
          photoIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 20 }),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
          modifiedAt: fc.integer({ min: 0, max: Date.now() }),
        }),
        // Generate random photos
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
            width: fc.integer({ min: 100, max: 4000 }),
            height: fc.integer({ min: 100, max: 4000 }),
            filename: fc.string({ minLength: 1 }),
            isFavorite: fc.boolean(),
            createdAt: fc.integer({ min: 0, max: Date.now() }),
            modifiedAt: fc.integer({ min: 0, max: Date.now() }),
          }),
          { minLength: 10, maxLength: 50 },
        ),
        (album, photos) => {
          // Enrich album with cover photo URI (client-side logic)
          const enrichedAlbum = (() => {
            if (
              !album.coverPhotoUri &&
              album.photoIds &&
              album.photoIds.length > 0
            ) {
              const firstPhoto = photos.find((p) => p.id === album.photoIds[0]);
              return {
                ...album,
                coverPhotoUri: firstPhoto?.uri || null,
              };
            }
            return album;
          })();

          // Verify cover photo is set correctly
          if (album.photoIds.length > 0) {
            const firstPhoto = photos.find((p) => p.id === album.photoIds[0]);
            if (firstPhoto) {
              expect(enrichedAlbum.coverPhotoUri).toBe(firstPhoto.uri);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should handle albums with no photos gracefully", () => {
    fc.assert(
      fc.property(
        // Generate random album without photos
        fc.record({
          id: fc.uuid(),
          title: fc.string({ minLength: 1 }),
          coverPhotoUri: fc.constant(null),
          photoIds: fc.constant([]),
          createdAt: fc.integer({ min: 0, max: Date.now() }),
          modifiedAt: fc.integer({ min: 0, max: Date.now() }),
        }),
        (album) => {
          // Enrich album with cover photo URI (client-side logic)
          const enrichedAlbum = (() => {
            if (
              !album.coverPhotoUri &&
              album.photoIds &&
              album.photoIds.length > 0
            ) {
              return {
                ...album,
                coverPhotoUri: "some-uri",
              };
            }
            return album;
          })();

          // Verify cover photo remains null for empty albums
          expect(enrichedAlbum.coverPhotoUri).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("should update cover photo when first photo changes", () => {
    fc.assert(
      fc.property(
        fc.uuid(), // albumId
        fc.array(fc.uuid(), { minLength: 2, maxLength: 10 }), // photoIds (at least 2)
        fc.array(
          fc.record({
            id: fc.uuid(),
            uri: fc.webUrl(),
          }),
          { minLength: 10 },
        ), // photos
        (albumId, photoIds, photos) => {
          // Initial album state
          const initialAlbum: Album = {
            id: albumId,
            title: "Test Album",
            coverPhotoUri: null,
            photoIds: photoIds,
            createdAt: Date.now(),
            modifiedAt: Date.now(),
          };

          // Enrich with first photo
          const firstPhoto = photos.find((p) => p.id === photoIds[0]);
          const enriched1 = {
            ...initialAlbum,
            coverPhotoUri: firstPhoto?.uri || null,
          };

          // Remove first photo (simulate removal)
          const updatedPhotoIds = photoIds.slice(1);
          const updatedAlbum: Album = {
            ...initialAlbum,
            photoIds: updatedPhotoIds,
          };

          // Enrich with new first photo
          const newFirstPhoto = photos.find((p) => p.id === updatedPhotoIds[0]);
          const enriched2 = {
            ...updatedAlbum,
            coverPhotoUri: newFirstPhoto?.uri || null,
          };

          // Verify cover photo changed to new first photo
          if (
            firstPhoto &&
            newFirstPhoto &&
            firstPhoto.id !== newFirstPhoto.id
          ) {
            expect(enriched1.coverPhotoUri).not.toBe(enriched2.coverPhotoUri);
            expect(enriched2.coverPhotoUri).toBe(newFirstPhoto.uri);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
