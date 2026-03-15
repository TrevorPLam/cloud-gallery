// AI-META-BEGIN
// AI-META: Smart Albums Service - Auto-generated albums based on ML analysis and user data
// OWNERSHIP: server/services/smart-albums
// ENTRYPOINTS: server/smart-album-routes.ts
// DEPENDENCIES: drizzle-orm, database schema, face recognition service
// DANGER: Smart album generation can be expensive for large photo libraries
// CHANGE-SAFETY: Adding new album types is safe; changing criteria logic requires careful testing
// TESTS: server/services/smart-albums.test.ts (property tests)
// AI-META-END

import { db, eq, and, desc, count, sql, gt, isNull, or } from "drizzle-orm";
import { 
  photos, 
  people, 
  faces, 
  smartAlbums, 
  type SmartAlbum, 
  type Photo,
  type Person
} from "../../shared/schema";
import { z } from "zod";

// Types for smart album generation
export interface SmartAlbumCriteria {
  labels?: string[];
  peopleIds?: string[];
  locationNames?: string[];
  dateRange?: { start: Date; end: Date };
  isVideo?: boolean;
  isFavorite?: boolean;
  minConfidence?: number;
}

export interface SmartAlbumGeneration {
  type: 'people' | 'places' | 'things' | 'special';
  title: string;
  description: string;
  criteria: SmartAlbumCriteria;
  coverPhotoStrategy: 'newest' | 'highest_quality' | 'random';
}

export class SmartAlbumsService {
  /**
   * Generate all smart albums for a user
   */
  async generateAllSmartAlbums(userId: string): Promise<SmartAlbum[]> {
    const generations = await this.getAlbumGenerations(userId);
    const albums: SmartAlbum[] = [];

    for (const generation of generations) {
      const album = await this.generateSmartAlbum(userId, generation);
      if (album) {
        albums.push(album);
      }
    }

    return albums;
  }

  /**
   * Get all possible album generations for a user
   */
  async getAlbumGenerations(userId: string): Promise<SmartAlbumGeneration[]> {
    const generations: SmartAlbumGeneration[] = [];

    // 1. People albums (one per person)
    const peopleAlbums = await this.getPeopleAlbumGenerations(userId);
    generations.push(...peopleAlbums);

    // 2. Places albums (by location clustering)
    const placesAlbums = await this.getPlacesAlbumGenerations(userId);
    generations.push(...placesAlbums);

    // 3. Things albums (Food, Pets, Nature, etc.)
    const thingsAlbums = await this.getThingsAlbumGenerations(userId);
    generations.push(...thingsAlbums);

    // 4. Special albums (Videos, Favorites, Screenshots)
    const specialAlbums = await this.getSpecialAlbumGenerations(userId);
    generations.push(...specialAlbums);

    return generations;
  }

  /**
   * Generate people albums (one per named person)
   */
  async getPeopleAlbumGenerations(userId: string): Promise<SmartAlbumGeneration[]> {
    // Get all named people for this user
    const userPeople = await db
      .select()
      .from(people)
      .where(
        and(
          eq(people.userId, userId),
          sql`${people.name} IS NOT NULL`,
          eq(people.isHidden, false)
        )
      );

    return userPeople.map(person => ({
      type: 'people' as const,
      title: person.name || 'Unknown Person',
      description: `Photos of ${person.name || 'this person'}`,
      criteria: {
        peopleIds: [person.id],
        minConfidence: 0.7
      },
      coverPhotoStrategy: 'highest_quality' as const
    }));
  }

  /**
   * Generate places albums by clustering locations
   */
  async getPlacesAlbumGenerations(userId: string): Promise<SmartAlbumGeneration[]> {
    // Get photos with location data
    const photosWithLocations = await db
      .select({
        location: photos.location,
        id: photos.id
      })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          sql`${photos.location} IS NOT NULL`,
          isNull(photos.deletedAt)
        )
      );

    // Extract unique location names
    const locationNames = new Set<string>();
    photosWithLocations.forEach(photo => {
      if (photo.location && typeof photo.location === 'object') {
        const loc = photo.location as any;
        if (loc.city) locationNames.add(loc.city);
        if (loc.country) locationNames.add(loc.country);
        if (loc.state) locationNames.add(loc.state);
      }
    });

    const generations: SmartAlbumGeneration[] = [];
    
    // Create albums for significant locations (5+ photos)
    for (const locationName of Array.from(locationNames)) {
      const photoCount = await this.getPhotoCountForLocation(userId, locationName);
      if (photoCount >= 5) {
        generations.push({
          type: 'places' as const,
          title: locationName,
          description: `Photos taken in ${locationName}`,
          criteria: {
            locationNames: [locationName]
          },
          coverPhotoStrategy: 'newest' as const
        });
      }
    }

    return generations;
  }

  /**
   * Generate things albums based on ML labels
   */
  async getThingsAlbumGenerations(userId: string): Promise<SmartAlbumGeneration[]> {
    // Common categories to create albums for
    const categories = [
      { label: 'food', title: 'Food & Drinks', description: 'Culinary moments and meals' },
      { label: 'pet', title: 'Pets', description: 'Animal companions and pets' },
      { label: 'nature', title: 'Nature', description: 'Landscapes and natural scenes' },
      { label: 'beach', title: 'Beach', description: 'Beach and ocean scenes' },
      { label: 'mountain', title: 'Mountains', description: 'Mountain landscapes' },
      { label: 'sunset', title: 'Sunsets', description: 'Sunset and golden hour' },
      { label: 'car', title: 'Cars & Vehicles', description: 'Automobiles and vehicles' },
      { label: 'flower', title: 'Flowers', description: 'Floral photography' },
      { label: 'architecture', title: 'Architecture', description: 'Buildings and structures' },
      { label: 'party', title: 'Celebrations', description: 'Parties and celebrations' }
    ];

    const generations: SmartAlbumGeneration[] = [];

    for (const category of categories) {
      const photoCount = await this.getPhotoCountForLabels(userId, [category.label]);
      if (photoCount >= 3) {
        generations.push({
          type: 'things' as const,
          title: category.title,
          description: category.description,
          criteria: {
            labels: [category.label],
            minConfidence: 0.6
          },
          coverPhotoStrategy: 'highest_quality' as const
        });
      }
    }

    return generations;
  }

  /**
   * Generate special albums for specific photo types
   */
  async getSpecialAlbumGenerations(userId: string): Promise<SmartAlbumGeneration[]> {
    const generations: SmartAlbumGeneration[] = [];

    // Videos album
    const videoCount = await this.getPhotoCountForVideos(userId);
    if (videoCount > 0) {
      generations.push({
        type: 'special' as const,
        title: 'Videos',
        description: 'All video files',
        criteria: {
          isVideo: true
        },
        coverPhotoStrategy: 'newest' as const
      });
    }

    // Favorites album
    const favoritesCount = await this.getPhotoCountForFavorites(userId);
    if (favoritesCount > 0) {
      generations.push({
        type: 'special' as const,
        title: 'Favorites',
        description: 'Favorite photos',
        criteria: {
          isFavorite: true
        },
        coverPhotoStrategy: 'highest_quality' as const
      });
    }

    // Screenshots album (OCR text indicates screenshots)
    const screenshotCount = await this.getPhotoCountForScreenshots(userId);
    if (screenshotCount >= 3) {
      generations.push({
        type: 'special' as const,
        title: 'Screenshots',
        description: 'Screen captures',
        criteria: {
          labels: ['screenshot', 'screen'],
          minConfidence: 0.8
        },
        coverPhotoStrategy: 'newest' as const
      });
    }

    return generations;
  }

  /**
   * Generate a single smart album
   */
  async generateSmartAlbum(
    userId: string, 
    generation: SmartAlbumGeneration
  ): Promise<SmartAlbum | null> {
    // Get photos matching criteria
    const matchingPhotos = await this.getPhotosForCriteria(userId, generation.criteria);
    
    if (matchingPhotos.length === 0) {
      return null;
    }

    // Select cover photo based on strategy
    const coverPhoto = this.selectCoverPhoto(matchingPhotos, generation.coverPhotoStrategy);

    // Check if smart album already exists
    const existingAlbum = await this.findExistingSmartAlbum(userId, generation.title, generation.type);
    
    if (existingAlbum) {
      // Update existing album
      const updatedAlbum = await db
        .update(smartAlbums)
        .set({
          criteria: generation.criteria,
          coverPhotoId: coverPhoto?.id,
          photoCount: matchingPhotos.length,
          lastUpdatedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(smartAlbums.id, existingAlbum.id))
        .returning();

      return updatedAlbum[0];
    } else {
      // Create new smart album
      const newAlbum = await db
        .insert(smartAlbums)
        .values({
          userId,
          albumType: generation.type,
          title: generation.title,
          description: generation.description,
          criteria: generation.criteria,
          coverPhotoId: coverPhoto?.id,
          photoCount: matchingPhotos.length,
          lastUpdatedAt: new Date()
        })
        .returning();

      return newAlbum[0];
    }
  }

  /**
   * Get photos matching smart album criteria
   */
  async getPhotosForCriteria(userId: string, criteria: SmartAlbumCriteria): Promise<Photo[]> {
    let query = db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          isNull(photos.deletedAt)
        )
      );

    // Apply label filters
    if (criteria.labels && criteria.labels.length > 0) {
      query = query.where(
        sql`${photos.mlLabels} && ${criteria.labels}`
      );
    }

    // Apply people filters
    if (criteria.peopleIds && criteria.peopleIds.length > 0) {
      query = query.where(
        sql`EXISTS (
          SELECT 1 FROM faces 
          WHERE faces.photo_id = photos.id 
          AND faces.person_id = ANY(${criteria.peopleIds})
          ${criteria.minConfidence ? `AND faces.confidence >= ${criteria.minConfidence}` : ''}
        )`
      );
    }

    // Apply location filters
    if (criteria.locationNames && criteria.locationNames.length > 0) {
      query = query.where(
        sql`EXISTS (
          SELECT 1 FROM jsonb_each_text(${photos.location}) as t(key, value)
          WHERE t.value = ANY(${criteria.locationNames})
        )`
      );
    }

    // Apply date range filters
    if (criteria.dateRange) {
      query = query.where(
        and(
          gt(photos.createdAt, criteria.dateRange.start),
          sql`${photos.createdAt} <= ${criteria.dateRange.end}`
        )
      );
    }

    // Apply boolean filters
    if (criteria.isVideo !== undefined) {
      query = query.where(eq(photos.isVideo, criteria.isVideo));
    }

    if (criteria.isFavorite !== undefined) {
      query = query.where(eq(photos.isFavorite, criteria.isFavorite));
    }

    // Order by creation date (newest first)
    query = query.orderBy(desc(photos.createdAt));

    return await query;
  }

  /**
   * Select cover photo based on strategy
   */
  private selectCoverPhoto(photos: Photo[], strategy: 'newest' | 'highest_quality' | 'random'): Photo | null {
    if (photos.length === 0) return null;

    switch (strategy) {
      case 'newest':
        return photos[0]; // Already ordered by newest
      case 'highest_quality':
        // Simple quality heuristic: larger dimensions and favorite status
        return photos.reduce((best, photo) => {
          const bestScore = (best.width * best.height) * (best.isFavorite ? 1.5 : 1);
          const photoScore = (photo.width * photo.height) * (photo.isFavorite ? 1.5 : 1);
          return photoScore > bestScore ? photo : best;
        });
      case 'random':
        return photos[Math.floor(Math.random() * photos.length)];
    }
  }

  /**
   * Find existing smart album
   */
  private async findExistingSmartAlbum(
    userId: string, 
    title: string, 
    type: string
  ): Promise<SmartAlbum | null> {
    const existing = await db
      .select()
      .from(smartAlbums)
      .where(
        and(
          eq(smartAlbums.userId, userId),
          eq(smartAlbums.title, title),
          eq(smartAlbums.albumType, type)
        )
      )
      .limit(1);

    return existing[0] || null;
  }

  /**
   * Helper methods for counting photos
   */
  private async getPhotoCountForLocation(userId: string, locationName: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          sql`EXISTS (
            SELECT 1 FROM jsonb_each_text(${photos.location}) as t(key, value)
            WHERE t.value = ${locationName}
          )`,
          isNull(photos.deletedAt)
        )
      );

    return result[0]?.count || 0;
  }

  private async getPhotoCountForLabels(userId: string, labels: string[]): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          sql`${photos.mlLabels} && ${labels}`,
          isNull(photos.deletedAt)
        )
      );

    return result[0]?.count || 0;
  }

  private async getPhotoCountForVideos(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          eq(photos.isVideo, true),
          isNull(photos.deletedAt)
        )
      );

    return result[0]?.count || 0;
  }

  private async getPhotoCountForFavorites(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          eq(photos.isFavorite, true),
          isNull(photos.deletedAt)
        )
      );

    return result[0]?.count || 0;
  }

  private async getPhotoCountForScreenshots(userId: string): Promise<number> {
    const result = await db
      .select({ count: count() })
      .from(photos)
      .where(
        and(
          eq(photos.userId, userId),
          or(
            sql`${photos.mlLabels} && ARRAY['screenshot', 'screen']`,
            sql`${photos.ocrText} IS NOT NULL AND LENGTH(${photos.ocrText}) > 50`
          ),
          isNull(photos.deletedAt)
        )
      );

    return result[0]?.count || 0;
  }

  /**
   * Update smart album when new photos are added
   */
  async updateSmartAlbumsForNewPhotos(userId: string, photoIds: string[]): Promise<void> {
    // Get all existing smart albums for user
    const userAlbums = await db
      .select()
      .from(smartAlbums)
      .where(eq(smartAlbums.userId, userId));

    // Update each smart album
    for (const album of userAlbums) {
      const criteria = album.criteria as SmartAlbumCriteria;
      const matchingPhotos = await this.getPhotosForCriteria(userId, criteria);
      
      await db
        .update(smartAlbums)
        .set({
          photoCount: matchingPhotos.length,
          lastUpdatedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(smartAlbums.id, album.id));
    }
  }

  /**
   * Get smart album photos with pagination
   */
  async getSmartAlbumPhotos(
    userId: string,
    albumId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Photo[]> {
    const album = await db
      .select()
      .from(smartAlbums)
      .where(
        and(
          eq(smartAlbums.id, albumId),
          eq(smartAlbums.userId, userId)
        )
      )
      .limit(1);

    if (!album[0]) {
      return [];
    }

    const criteria = album[0].criteria as SmartAlbumCriteria;
    const photos = await this.getPhotosForCriteria(userId, criteria);
    
    return photos.slice(offset, offset + limit);
  }

  /**
   * Pin or hide a smart album
   */
  async updateSmartAlbumSettings(
    userId: string,
    albumId: string,
    settings: { isPinned?: boolean; isHidden?: boolean }
  ): Promise<SmartAlbum | null> {
    const updated = await db
      .update(smartAlbums)
      .set({
        ...settings,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(smartAlbums.id, albumId),
          eq(smartAlbums.userId, userId)
        )
      )
      .returning();

    return updated[0] || null;
  }
}

// Export singleton instance
export const smartAlbumsService = new SmartAlbumsService();
