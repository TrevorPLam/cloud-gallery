// AI-META-BEGIN
// AI-META: Memories Service - Auto-generated memories based on photo analysis and temporal patterns
// OWNERSHIP: server/services/memories
// ENTRYPOINTS: server/memory-routes.ts
// DEPENDENCIES: drizzle-orm, database schema, ML analysis data
// DANGER: Memory generation can be expensive for large photo libraries
// CHANGE-SAFETY: Adding new memory types is safe; changing scoring logic requires careful testing
// TESTS: server/services/memories.test.ts (property tests)
// AI-META-END

import { db } from "../db";
import {
  eq,
  and,
  desc,
  count,
  sql,
  gt,
  isNull,
  or,
  lt,
  gte,
  lte,
} from "drizzle-orm";
import {
  photos,
  people,
  faces,
  memories,
  type Memory,
  type Photo,
} from "../../shared/schema";
import { z } from "zod";

// Types for memory generation
export interface MemoryGeneration {
  type: "on_this_day" | "monthly_highlights" | "year_in_review";
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  photoIds: string[];
  coverPhotoStrategy: "newest" | "highest_score" | "random";
}

export interface PhotoScore {
  photoId: string;
  score: number;
  factors: {
    faces: number;
    labels: number;
    favorites: number;
    location: number;
    recency: number;
  };
}

export class MemoriesService {
  /**
   * Generate all memories for a user
   */
  async generateAllMemories(userId: string): Promise<Memory[]> {
    const generations = await this.getMemoryGenerations(userId);
    const memories: Memory[] = [];

    for (const generation of generations) {
      const memory = await this.generateMemory(userId, generation);
      if (memory) {
        memories.push(memory);
      }
    }

    return memories;
  }

  /**
   * Get all possible memory generations for a user
   */
  async getMemoryGenerations(userId: string): Promise<MemoryGeneration[]> {
    const generations: MemoryGeneration[] = [];

    // 1. "On This Day" memories
    const onThisDay = await this.getOnThisDayGenerations(userId);
    generations.push(...onThisDay);

    // 2. Monthly highlights
    const monthlyHighlights = await this.getMonthlyHighlightGenerations(userId);
    generations.push(...monthlyHighlights);

    // 3. Year in review
    const yearInReview = await this.getYearInReviewGenerations(userId);
    generations.push(...yearInReview);

    return generations;
  }

  /**
   * Generate "On This Day" memories
   */
  async getOnThisDayGenerations(userId: string): Promise<MemoryGeneration[]> {
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth();

    const generations: MemoryGeneration[] = [];

    // Get photos from today's date in previous years
    const photosFromThisDay = await db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          sql`EXTRACT(MONTH FROM ${photos.createdAt}) = ${currentMonth + 1}`,
          sql`EXTRACT(DAY FROM ${photos.createdAt}) = ${currentDay}`,
          lt(photos.createdAt, today), // Not including today
        ),
      )
      .orderBy(desc(photos.createdAt));

    if (photosFromThisDay.length > 0) {
      // Group by year
      const photosByYear = new Map<number, typeof photosFromThisDay>();

      for (const photo of photosFromThisDay) {
        const year = photo.createdAt.getFullYear();
        if (!photosByYear.has(year)) {
          photosByYear.set(year, []);
        }
        photosByYear.get(year)!.push(photo);
      }

      // Create a memory for each year that has photos
      for (const [year, yearPhotos] of photosByYear) {
        if (yearPhotos.length > 0) {
          const yearsAgo = today.getFullYear() - year;
          const yearText =
            yearsAgo === 1 ? "1 year ago" : `${yearsAgo} years ago`;

          generations.push({
            type: "on_this_day",
            title: `On This Day ${yearText}`,
            description: `Photos from ${year} taken on this day`,
            startDate: new Date(year, currentMonth, currentDay),
            endDate: new Date(year, currentMonth, currentDay),
            photoIds: yearPhotos.map((p) => p.id),
            coverPhotoStrategy: "highest_score",
          });
        }
      }
    }

    return generations;
  }

  /**
   * Generate monthly highlights
   */
  async getMonthlyHighlightGenerations(
    userId: string,
  ): Promise<MemoryGeneration[]> {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    const generations: MemoryGeneration[] = [];

    // Get top scored photos from last month
    const lastMonthPhotos = await db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          gte(photos.createdAt, lastMonth),
          lt(photos.createdAt, today),
        ),
      )
      .orderBy(desc(photos.createdAt));

    if (lastMonthPhotos.length > 0) {
      // Score photos and get top highlights
      const scoredPhotos = await this.scorePhotos(userId, lastMonthPhotos);
      const highlights = scoredPhotos
        .filter((p) => p.score > 0.5) // Only include good photos
        .slice(0, Math.min(20, scoredPhotos.length)); // Limit to 20 best photos

      if (highlights.length > 0) {
        const monthName = lastMonth.toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });

        generations.push({
          type: "monthly_highlights",
          title: `${monthName} Highlights`,
          description: `Best moments from ${monthName}`,
          startDate: lastMonth,
          endDate: endOfLastMonth,
          photoIds: highlights.map((h) => h.photoId),
          coverPhotoStrategy: "highest_score",
        });
      }
    }

    return generations;
  }

  /**
   * Generate year in review memories
   */
  async getYearInReviewGenerations(
    userId: string,
  ): Promise<MemoryGeneration[]> {
    const today = new Date();
    const lastYear = today.getFullYear() - 1;
    const startOfYear = new Date(lastYear, 0, 1);
    const endOfYear = new Date(lastYear, 11, 31);

    const generations: MemoryGeneration[] = [];

    // Get photos from last year
    const yearPhotos = await db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          gte(photos.createdAt, startOfYear),
          lt(photos.createdAt, new Date(lastYear + 1, 0, 1)),
        ),
      )
      .orderBy(desc(photos.createdAt));

    if (yearPhotos.length > 0) {
      // Score photos and get best of the year
      const scoredPhotos = await this.scorePhotos(userId, yearPhotos);
      const bestPhotos = scoredPhotos
        .filter((p) => p.score > 0.6) // Higher threshold for year in review
        .slice(0, Math.min(50, scoredPhotos.length)); // Limit to 50 best photos

      if (bestPhotos.length > 0) {
        generations.push({
          type: "year_in_review",
          title: `${lastYear} Year in Review`,
          description: `Best moments from ${lastYear}`,
          startDate: startOfYear,
          endDate: endOfYear,
          photoIds: bestPhotos.map((b) => b.photoId),
          coverPhotoStrategy: "highest_score",
        });
      }
    }

    return generations;
  }

  /**
   * Score photos based on various factors
   */
  async scorePhotos(userId: string, photos: Photo[]): Promise<PhotoScore[]> {
    const scoredPhotos: PhotoScore[] = [];

    // Get face counts for each photo
    const photoIds = photos.map((p) => p.id);
    const faceCounts = await db
      .select({
        photoId: faces.photoId,
        count: count(faces.id),
      })
      .from(faces)
      .where(
        and(
          eq(faces.userId, userId),
          sql`${faces.photoId} IN ${sql.join(
            photoIds.map((id) => sql`${id}`),
            sql`, `,
          )}`,
        ),
      )
      .groupBy(faces.photoId);

    const faceCountMap = new Map(
      faceCounts.map((fc) => [fc.photoId, fc.count]),
    );

    for (const photo of photos) {
      const score = await this.calculatePhotoScore(
        photo,
        faceCountMap.get(photo.id) || 0,
      );
      scoredPhotos.push(score);
    }

    return scoredPhotos.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate individual photo score
   */
  private async calculatePhotoScore(
    photo: Photo,
    faceCount: number,
  ): Promise<PhotoScore> {
    const factors = {
      faces: 0,
      labels: 0,
      favorites: 0,
      location: 0,
      recency: 0,
    };

    // Face detection factor (30% weight)
    if (faceCount > 0) {
      factors.faces = Math.min(faceCount * 0.1, 0.3);
    }

    // ML labels factor (20% weight)
    if (photo.mlLabels && photo.mlLabels.length > 0) {
      const avgConfidence =
        photo.mlLabels.reduce(
          (sum: number, label: any) => sum + (label.confidence || 0),
          0,
        ) / photo.mlLabels.length;
      factors.labels = Math.min(avgConfidence * 0.2, 0.2);
    }

    // Favorite status factor (20% weight)
    if (photo.isFavorite) {
      factors.favorites = 0.2;
    }

    // Location factor (15% weight)
    if (
      photo.location &&
      (photo.location as any).latitude &&
      (photo.location as any).longitude
    ) {
      factors.location = 0.15;
    }

    // Recency factor (15% weight) - newer photos get higher scores
    const daysSinceCreated =
      (Date.now() - photo.createdAt.getTime()) / (1000 * 60 * 60 * 24);
    factors.recency = Math.max(0, 0.15 - (daysSinceCreated / 365) * 0.15);

    const totalScore =
      factors.faces +
      factors.labels +
      factors.favorites +
      factors.location +
      factors.recency;

    return {
      photoId: photo.id,
      score: Math.min(totalScore, 1.0),
      factors,
    };
  }

  /**
   * Generate a single memory
   */
  async generateMemory(
    userId: string,
    generation: MemoryGeneration,
  ): Promise<Memory | null> {
    if (generation.photoIds.length === 0) {
      return null;
    }

    // Select cover photo based on strategy
    let coverPhotoId: string | undefined;

    if (generation.coverPhotoStrategy === "highest_score") {
      const scoredPhotos = await this.scorePhotos(
        userId,
        generation.photoIds.map((id) => ({ id }) as Photo),
      );
      coverPhotoId = scoredPhotos[0]?.photoId;
    } else if (generation.coverPhotoStrategy === "newest") {
      const newestPhoto = await db
        .select()
        .from(photos)
        .where(
          and(
            eq(photos.userId, userId),
            sql`${photos.id} IN ${sql.join(
              generation.photoIds.map((id) => sql`${id}`),
              sql`, `,
            )}`,
          ),
        )
        .orderBy(desc(photos.createdAt))
        .limit(1);

      coverPhotoId = newestPhoto[0]?.id;
    } else if (generation.coverPhotoStrategy === "random") {
      coverPhotoId =
        generation.photoIds[
          Math.floor(Math.random() * generation.photoIds.length)
        ];
    }

    // Check if memory already exists
    const existingMemory = await db
      .select()
      .from(memories)
      .where(
        and(
          eq(memories.userId, userId),
          eq(memories.memoryType, generation.type),
          eq(memories.startDate, generation.startDate),
        ),
      )
      .limit(1);

    if (existingMemory.length > 0) {
      // Update existing memory
      const updatedMemory = await db
        .update(memories)
        .set({
          title: generation.title,
          description: generation.description,
          endDate: generation.endDate,
          coverPhotoId,
          photoCount: generation.photoIds.length,
          updatedAt: new Date(),
        })
        .where(eq(memories.id, existingMemory[0].id))
        .returning();

      return updatedMemory[0];
    } else {
      // Create new memory
      const newMemory = await db
        .insert(memories)
        .values({
          userId,
          memoryType: generation.type,
          title: generation.title,
          description: generation.description,
          startDate: generation.startDate,
          endDate: generation.endDate,
          coverPhotoId,
          photoCount: generation.photoIds.length,
          score: 0.8, // Default score for memories
        })
        .returning();

      return newMemory[0];
    }
  }

  /**
   * Get memories for a user with pagination
   */
  async getUserMemories(
    userId: string,
    limit = 50,
    offset = 0,
  ): Promise<Memory[]> {
    return db
      .select()
      .from(memories)
      .where(and(eq(memories.userId, userId), eq(memories.isHidden, false)))
      .orderBy(desc(memories.startDate))
      .limit(limit)
      .offset(offset);
  }

  /**
   * Favorite or hide a memory
   */
  async updateMemory(
    userId: string,
    memoryId: string,
    updates: { isFavorite?: boolean; isHidden?: boolean },
  ): Promise<Memory | null> {
    const memory = await db
      .select()
      .from(memories)
      .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
      .limit(1);

    if (memory.length === 0) {
      return null;
    }

    const updatedMemory = await db
      .update(memories)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(memories.id, memoryId))
      .returning();

    return updatedMemory[0];
  }

  /**
   * Get photos in a memory
   */
  async getMemoryPhotos(
    userId: string,
    memoryId: string,
    limit = 50,
    offset = 0,
  ): Promise<Photo[]> {
    const memory = await db
      .select()
      .from(memories)
      .where(and(eq(memories.id, memoryId), eq(memories.userId, userId)))
      .limit(1);

    if (memory.length === 0) {
      return [];
    }

    // Get photos within the memory's date range
    return db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          gte(photos.createdAt, memory[0].startDate),
          lte(photos.createdAt, memory[0].endDate),
        ),
      )
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset);
  }
}

// Export singleton instance
export const memoriesService = new MemoriesService();
