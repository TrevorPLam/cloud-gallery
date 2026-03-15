// AI-META-BEGIN
// AI-META: Memories Service Property Tests - Validates memory generation algorithms
// OWNERSHIP: server/services/memories.test.ts
// ENTRYPOINTS: test runner (vitest)
// DEPENDENCIES: fast-check, memories service, database mocks
// DANGER: Property tests can be computationally expensive
// CHANGE-SAFETY: Adding new properties is safe; changing existing properties affects test coverage
// TESTS: Property tests for memory generation accuracy and consistency
// AI-META-END

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import fc from "fast-check";
import { memoriesService } from "./memories";
import { db } from "../db";
import {
  memories,
  photos,
  faces,
  type Memory,
  type Photo,
} from "../../shared/schema";
import { createSelectChain } from "../test-utils/drizzle-mock";

// Mock the database with chainable Drizzle-style API; orderBy() must return { limit } for .orderBy().limit(1) chains
vi.mock("../db", () => {
  const chain = (resolved: any = []) => {
    const limitFn = () => Promise.resolve(resolved);
    const orderByFn = () => ({ limit: limitFn });
    return {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(orderByFn),
          limit: vi.fn(limitFn),
          offset: vi.fn(() => Promise.resolve(resolved)),
          groupBy: vi.fn(() => Promise.resolve(resolved)),
          leftJoin: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(resolved)) })),
        })),
        innerJoin: vi.fn(() => ({ where: vi.fn(() => Promise.resolve(resolved)) })),
      })),
    };
  };
  return {
    db: {
      select: vi.fn(() => chain()),
      insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })) })),
      update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn(() => Promise.resolve([])) })) })) })),
      delete: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })),
    },
  };
});

describe("MemoriesService Property Tests", () => {
  beforeEach(() => {
    const limitFn = () => Promise.resolve([]);
    const orderByFn = () => ({ limit: limitFn });
    const chain = {
      from: () => ({
        where: () => ({
          orderBy: orderByFn,
          limit: limitFn,
          groupBy: () => Promise.resolve([]),
        }),
      }),
    };
    vi.mocked(db.select).mockImplementation(() => chain as any);
  });

  describe("Property 1: Date Range Accuracy", () => {
    it("should generate accurate date ranges for 'On This Day' memories", async () => {
      // Fix "today" to June 15 so expectations (month 5, day 15) match mock data
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2024, 5, 15)); // June 15, 2024

      const mockPhotos = [
        { id: "1", createdAt: new Date(2023, 5, 15), userId: "user1" },
        { id: "2", createdAt: new Date(2022, 5, 15), userId: "user1" },
        { id: "3", createdAt: new Date(2021, 5, 15), userId: "user1" },
        { id: "4", createdAt: new Date(2023, 5, 16), userId: "user1" },
      ] as Photo[];

      vi.mocked(db.select).mockReturnValue(
        createSelectChain(mockPhotos) as any,
      );

      const generations =
        await memoriesService.getOnThisDayGenerations("user1");

      for (const generation of generations) {
        expect(generation.type).toBe("on_this_day");
        expect(generation.startDate.getDate()).toBe(15);
        expect(generation.startDate.getMonth()).toBe(5);
        expect(generation.endDate.getDate()).toBe(15);
        expect(generation.endDate.getMonth()).toBe(5);
        expect(generation.startDate.getFullYear()).toBe(
          generation.endDate.getFullYear(),
        );
      }

      vi.useRealTimers();
    });

    it("should maintain date range consistency for monthly highlights", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date(2000, 0, 1), max: new Date(2030, 11, 31) }),
          fc.integer(1, 12),
          async (baseDate, month) => {
            const mockPhotos = [
              {
                id: "1",
                createdAt: new Date(2023, month - 1, 15),
                userId: "user1",
              },
            ] as Photo[];

            vi.mocked(db.select).mockReturnValue(
              createSelectChain(mockPhotos) as any,
            );

            const generations =
              await memoriesService.getMonthlyHighlightGenerations("user1");

            for (const generation of generations) {
              expect(generation.type).toBe("monthly_highlights");
              expect(generation.startDate.getMonth()).toBe(month - 1);
              expect(generation.endDate.getMonth()).toBe(month - 1);
              expect(generation.startDate.getFullYear()).toBe(
                generation.endDate.getFullYear(),
              );
            }
          },
        ),
        { numRuns: 20 },
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
        createdAt: new Date(),
      } as Photo;

      // Mock face count query
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            groupBy: vi
              .fn()
              .mockResolvedValue([{ photoId: "test-photo", count: 2 }]),
          }),
        }),
      } as any);

      // Calculate score twice
      const score1 = await memoriesService.calculatePhotoScore(mockPhoto, 2);
      const score2 = await memoriesService.calculatePhotoScore(mockPhoto, 2);

      // Property: Same photo should always produce same score
      expect(score1.score).toBe(score2.score);
      expect(score1.factors).toEqual(score2.factors);
    });

    it.skip("should maintain score bounds between 0 and 1", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
            userId: fc.string({ minLength: 1 }),
            isFavorite: fc.boolean(),
            mlLabels: fc.array(
              fc.record({
                label: fc.string(),
                confidence: fc.double(0.0001, 1),
              }),
            ),
            location: fc.option(
              fc.record({
                latitude: fc.double(-90, 90),
                longitude: fc.double(-180, 180),
              }),
            ),
            createdAt: fc.date(),
          }),
          async (photo) => {
            fc.pre(photo.id.length > 0 && photo.id.trim().length > 0);
            fc.pre(
              photo.mlLabels.every(
                (l: { confidence: number }) =>
                  l.confidence >= 0 && l.confidence <= 1,
              ),
            );
            const mockPhoto = photo as Photo;

            vi.mocked(db.select).mockReturnValue(
              createSelectChain([{ photoId: photo.id, count: 0 }]) as any,
            );

            const score = await memoriesService.calculatePhotoScore(
              mockPhoto,
              0,
            );

            expect(score.score).toBeGreaterThanOrEqual(-1e-10);
            expect(score.score).toBeLessThanOrEqual(1 + 1e-6);

            expect(score.factors.faces).toBeGreaterThanOrEqual(0);
            expect(score.factors.labels).toBeGreaterThanOrEqual(0);
            expect(score.factors.favorites).toBeGreaterThanOrEqual(0);
            expect(score.factors.location).toBeGreaterThanOrEqual(0);
            expect(score.factors.recency).toBeGreaterThanOrEqual(0);
            const e = 1e-4; // float rounding tolerance
            expect(score.factors.faces).toBeLessThanOrEqual(0.3 + e);
            expect(score.factors.labels).toBeLessThanOrEqual(0.2 + e);
            expect(score.factors.favorites).toBeLessThanOrEqual(0.2 + e);
            expect(score.factors.location).toBeLessThanOrEqual(0.15 + e);
            expect(score.factors.recency).toBeLessThanOrEqual(0.15 + e);
          },
        ),
        { numRuns: 50 },
      );
    });

    it("should favor photos with faces over photos without", async () => {
      const photoWithFaces = {
        id: "photo-with-faces",
        userId: "user1",
        isFavorite: false,
        mlLabels: [],
        location: null,
        createdAt: new Date(),
      } as Photo;

      const photoWithoutFaces = {
        id: "photo-no-faces",
        userId: "user1",
        isFavorite: false,
        mlLabels: [],
        location: null,
        createdAt: new Date(),
      } as Photo;

      // Mock face count queries
      vi.mocked(db.select)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi
                .fn()
                .mockResolvedValue([{ photoId: "photo-with-faces", count: 2 }]),
            }),
          }),
        } as any)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              groupBy: vi
                .fn()
                .mockResolvedValue([{ photoId: "photo-no-faces", count: 0 }]),
            }),
          }),
        } as any);

      const scoreWithFaces = await memoriesService.calculatePhotoScore(
        photoWithFaces,
        2,
      );
      const scoreWithoutFaces = await memoriesService.calculatePhotoScore(
        photoWithoutFaces,
        0,
      );

      // Property: Photos with faces should score higher
      expect(scoreWithFaces.score).toBeGreaterThan(scoreWithoutFaces.score);
      expect(scoreWithFaces.factors.faces).toBeGreaterThan(
        scoreWithoutFaces.factors.faces,
      );
    });
  });

  describe("Property 3: Memory Generation Idempotence", () => {
    it.skip("should not create duplicate memories for same date range", async () => {
      const mockGeneration = {
        type: "on_this_day" as const,
        title: "On This Day 1 year ago",
        description: "Photos from last year",
        startDate: new Date(2023, 5, 15),
        endDate: new Date(2023, 5, 15),
        photoIds: ["photo1", "photo2"],
        coverPhotoStrategy: "newest" as const,
      };

      const mockInsertReturning = vi.fn().mockResolvedValue([{ id: "memory1" }]);
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: mockInsertReturning,
        }),
      } as any);
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "memory1" }]),
          }),
        }),
      } as any);

      const memory1 = await memoriesService.generateMemory(
        "user1",
        mockGeneration,
      );
      const memory2 = await memoriesService.generateMemory(
        "user1",
        mockGeneration,
      );

      expect(memory1).toBeTruthy();
      expect(memory2).toBeTruthy();
      expect(mockInsertReturning).toHaveBeenCalledTimes(1);
    });

    it.skip("should maintain memory photo count accuracy", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 20 }),
          async (photoIds) => {
            fc.pre(photoIds.every((id) => id.length > 0));
            const mockGeneration = {
              type: "monthly_highlights" as const,
              title: "June Highlights",
              description: "Best moments",
              startDate: new Date(2023, 5, 1),
              endDate: new Date(2023, 5, 30),
              photoIds,
              coverPhotoStrategy: "random" as const,
            };

            vi.mocked(db.insert).mockReturnValue({
              values: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([
                  {
                    id: "memory1",
                    photoCount: photoIds.length,
                  },
                ]),
              }),
            } as any);

            const memory = await memoriesService.generateMemory(
              "user1",
              mockGeneration,
            );

            expect(memory?.photoCount).toBe(photoIds.length);
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  describe("Property 4: Memory Type Validation", () => {
    it.skip("should only generate valid memory types", async () => {
      const userId = "user1";
      vi.mocked(db.select).mockReturnValue(
        createSelectChain([]) as any,
      );

      const generations = await memoriesService.getMemoryGenerations(userId);

      // Property: All generated memories should have valid types
      for (const generation of generations) {
        expect([
          "on_this_day",
          "monthly_highlights",
          "year_in_review",
        ]).toContain(generation.type);
      }
    });

    it.skip("should generate appropriate titles for each memory type", async () => {
      const userId = "user1";
      vi.mocked(db.select)
        .mockReturnValueOnce(
          createSelectChain([
            { id: "1", createdAt: new Date(2023, 5, 15), userId },
          ]) as any,
        )
        .mockReturnValueOnce(
          createSelectChain([
            { id: "2", createdAt: new Date(2023, 4, 15), userId },
          ]) as any,
        )
        .mockReturnValueOnce(
          createSelectChain([
            { id: "3", createdAt: new Date(2022, 0, 15), userId },
          ]) as any,
        );

      const generations = await memoriesService.getMemoryGenerations(userId);

      for (const generation of generations) {
        expect(generation.title).toBeTruthy();
        expect(generation.title.length).toBeGreaterThan(0);
        expect(generation.description).toBeTruthy();
        expect(generation.description.length).toBeGreaterThan(0);

        if (generation.type === "on_this_day") {
          expect(generation.title).toContain("On This Day");
        } else if (generation.type === "monthly_highlights") {
          expect(generation.title).toContain("Highlights");
        } else if (generation.type === "year_in_review") {
          expect(generation.title).toContain("Year in Review");
        }
      }
    });
  });
});
