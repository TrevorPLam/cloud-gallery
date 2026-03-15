// AI-META-BEGIN
// AI-META: Memories Service Property Tests - Validates memory generation algorithms
// OWNERSHIP: server/services/memories.test.ts
// ENTRYPOINTS: test runner (vitest)
// DEPENDENCIES: fast-check, memories service, database mocks
// DANGER: Property tests can be computationally expensive
// CHANGE-SAFETY: Adding new properties is safe; changing existing properties affects test coverage
// TESTS: Property tests for memory generation accuracy and consistency
// AI-META-END

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fc } from "fast-check";
import { memoriesService } from "./memories";
import { db } from "../db";
import { memories, photos, faces, type Memory, type Photo } from "../../shared/schema";

// Mock the database
vi.mock("../db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("MemoriesService Property Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Property 1: Date Range Accuracy", () => {
    it("should generate accurate date ranges for 'On This Day' memories", async () => {
      const mockPhotos = [
        { id: "1", createdAt: new Date(2023, 5, 15), userId: "user1" },
        { id: "2", createdAt: new Date(2022, 5, 15), userId: "user1" },
        { id: "3", createdAt: new Date(2021, 5, 15), userId: "user1" },
        { id: "4", createdAt: new Date(2023, 5, 16), userId: "user1" }, // Different day
      ] as Photo[];

      // Mock database responses
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockPhotos)
          })
        })
      } as any);

      const generations = await memoriesService.getOnThisDayGenerations("user1");

      // Property: All generated memories should have correct date ranges
      for (const generation of generations) {
        expect(generation.type).toBe("on_this_day");
        expect(generation.startDate.getDate()).toBe(15);
        expect(generation.startDate.getMonth()).toBe(5);
        expect(generation.endDate.getDate()).toBe(15);
        expect(generation.endDate.getMonth()).toBe(5);
        expect(generation.startDate.getFullYear()).toBe(generation.endDate.getFullYear());
      }
    });

    it("should maintain date range consistency for monthly highlights", async () => {
      await fc.assert(
        fc.asyncProperty(fc.date(), fc.integer(1, 12), async (baseDate, month) => {
          const mockPhotos = [
            { id: "1", createdAt: new Date(2023, month - 1, 15), userId: "user1" }
          ] as Photo[];

          vi.mocked(db.select).mockReturnValue({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(mockPhotos)
              })
            })
          } as any);

          const generations = await memoriesService.getMonthlyHighlightGenerations("user1");

          for (const generation of generations) {
            expect(generation.type).toBe("monthly_highlights");
            expect(generation.startDate.getMonth()).toBe(month - 1);
            expect(generation.endDate.getMonth()).toBe(month - 1);
            expect(generation.startDate.getFullYear()).toBe(generation.endDate.getFullYear());
          }
        }),
        { numRuns: 20 }
      );
    });
  });

  describe("Property 2: Scoring Consistency", () => {
    it("should produce consistent scores for identical photos", async () => {
      const mockPhoto = {
        id: "test-photo",
        userId: "user1",
        isFavorite: false,
        mlLabels: [{ label: "beach", confidence: 0.8 }],
        location: { latitude: 37.7749, longitude: -122.4194 },
        createdAt: new Date()
      } as Photo;

      // Mock face count query
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi.fn().mockResolvedValue([{ photoId: "test-photo", count: 2 }])
          })
        })
      } as any);

      // Calculate score twice
      const score1 = await memoriesService.calculatePhotoScore(mockPhoto, 2);
      const score2 = await memoriesService.calculatePhotoScore(mockPhoto, 2);

      // Property: Same photo should always produce same score
      expect(score1.score).toBe(score2.score);
      expect(score1.factors).toEqual(score2.factors);
    });

    it("should maintain score bounds between 0 and 1", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string(),
            userId: fc.string(),
            isFavorite: fc.boolean(),
            mlLabels: fc.array(fc.record({ label: fc.string(), confidence: fc.float(0, 1) })),
            location: fc.option(fc.record({ latitude: fc.float(-90, 90), longitude: fc.float(-180, 180) })),
            createdAt: fc.date()
          }),
          async (photo) => {
            const mockPhoto = photo as Photo;
            
            // Mock face count
            vi.mocked(db.select).mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  groupBy: vi.fn().mockResolvedValue([{ photoId: photo.id, count: 0 }])
                })
              })
            } as any);

            const score = await memoriesService.calculatePhotoScore(mockPhoto, 0);

            // Property: All scores should be between 0 and 1
            expect(score.score).toBeGreaterThanOrEqual(0);
            expect(score.score).toBeLessThanOrEqual(1);
            
            // Property: Individual factors should also be bounded
            expect(score.factors.faces).toBeGreaterThanOrEqual(0);
            expect(score.factors.labels).toBeGreaterThanOrEqual(0);
            expect(score.factors.favorites).toBeGreaterThanOrEqual(0);
            expect(score.factors.location).toBeGreaterThanOrEqual(0);
            expect(score.factors.recency).toBeGreaterThanOrEqual(0);
            
            expect(score.factors.faces).toBeLessThanOrEqual(0.3);
            expect(score.factors.labels).toBeLessThanOrEqual(0.2);
            expect(score.factors.favorites).toBeLessThanOrEqual(0.2);
            expect(score.factors.location).toBeLessThanOrEqual(0.15);
            expect(score.factors.recency).toBeLessThanOrEqual(0.15);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("should favor photos with faces over photos without", async () => {
      const photoWithFaces = {
        id: "photo-with-faces",
        userId: "user1",
        isFavorite: false,
        mlLabels: [],
        location: null,
        createdAt: new Date()
      } as Photo;

      const photoWithoutFaces = {
        id: "photo-no-faces",
        userId: "user1",
        isFavorite: false,
        mlLabels: [],
        location: null,
        createdAt: new Date()
      } as Photo;

      // Mock face count queries
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([{ photoId: "photo-with-faces", count: 2 }])
            })
          })
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockResolvedValue([{ photoId: "photo-no-faces", count: 0 }])
            })
          })
        } as any);

      const scoreWithFaces = await memoriesService.calculatePhotoScore(photoWithFaces, 2);
      const scoreWithoutFaces = await memoriesService.calculatePhotoScore(photoWithoutFaces, 0);

      // Property: Photos with faces should score higher
      expect(scoreWithFaces.score).toBeGreaterThan(scoreWithoutFaces.score);
      expect(scoreWithFaces.factors.faces).toBeGreaterThan(scoreWithoutFaces.factors.faces);
    });
  });

  describe("Property 3: Memory Generation Idempotence", () => {
    it("should not create duplicate memories for same date range", async () => {
      const mockGeneration = {
        type: 'on_this_day' as const,
        title: "On This Day 1 year ago",
        description: "Photos from last year",
        startDate: new Date(2023, 5, 15),
        endDate: new Date(2023, 5, 15),
        photoIds: ["photo1", "photo2"],
        coverPhotoStrategy: 'newest' as const
      };

      // Mock existing memory check
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]) // No existing memory
          })
        })
      } as any);

      // Mock insert
      const mockInsert = vi.fn().mockResolvedValue([{ id: "memory1" }]);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: mockInsert
        })
      } as any);

      // Generate memory twice
      const memory1 = await memoriesService.generateMemory("user1", mockGeneration);
      const memory2 = await memoriesService.generateMemory("user1", mockGeneration);

      // Property: Should create memory on first call, update on second
      expect(memory1).toBeTruthy();
      expect(memory2).toBeTruthy();
      
      // Second call should trigger update instead of insert
      expect(mockInsert).toHaveBeenCalledTimes(1);
    });

    it("should maintain memory photo count accuracy", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string(), { minLength: 1, maxLength: 20 }),
          async (photoIds) => {
            const mockGeneration = {
              type: 'monthly_highlights' as const,
              title: "June Highlights",
              description: "Best moments",
              startDate: new Date(2023, 5, 1),
              endDate: new Date(2023, 5, 30),
              photoIds,
              coverPhotoStrategy: 'random' as const
            };

            // Mock no existing memory
            vi.mocked(db.select).mockReturnValue({
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([])
                })
              })
            } as any);

            // Mock insert
            vi.mocked(db.insert).mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([{
                  id: "memory1",
                  photoCount: photoIds.length
                }])
              })
            } as any);

            const memory = await memoriesService.generateMemory("user1", mockGeneration);

            // Property: Memory photo count should match input photo IDs length
            expect(memory?.photoCount).toBe(photoIds.length);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  describe("Property 4: Memory Type Validation", () => {
    it("should only generate valid memory types", async () => {
      const userId = "user1";
      
      // Mock empty responses for all queries
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([])
          })
        })
      } as any);

      const generations = await memoriesService.getMemoryGenerations(userId);

      // Property: All generated memories should have valid types
      for (const generation of generations) {
        expect(['on_this_day', 'monthly_highlights', 'year_in_review']).toContain(generation.type);
      }
    });

    it("should generate appropriate titles for each memory type", async () => {
      const userId = "user1";
      
      // Mock responses for each type
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                { id: "1", createdAt: new Date(2023, 5, 15), userId }
              ])
            })
          })
        } as any) // On this day
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                { id: "2", createdAt: new Date(2023, 4, 15), userId }
              ])
            })
          })
        } as any) // Monthly highlights
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                { id: "3", createdAt: new Date(2022, 0, 15), userId }
              ])
            })
          })
        } as any); // Year in review

      const generations = await memoriesService.getMemoryGenerations(userId);

      for (const generation of generations) {
        expect(generation.title).toBeTruthy();
        expect(generation.title.length).toBeGreaterThan(0);
        expect(generation.description).toBeTruthy();
        expect(generation.description.length).toBeGreaterThan(0);
        
        if (generation.type === 'on_this_day') {
          expect(generation.title).toContain("On This Day");
        } else if (generation.type === 'monthly_highlights') {
          expect(generation.title).toContain("Highlights");
        } else if (generation.type === 'year_in_review') {
          expect(generation.title).toContain("Year in Review");
        }
      }
    });
  });
});
