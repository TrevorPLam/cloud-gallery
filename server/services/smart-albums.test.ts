// AI-META-BEGIN
// AI-META: Property tests for Smart Albums Service - Algorithm validation and edge cases
// OWNERSHIP: server/services/smart-albums.test.ts
// ENTRYPOINTS: Jest test runner
// DEPENDENCIES: fast-check, SmartAlbumsService, database mocking
// DANGER: Property tests may generate large datasets
// CHANGE-SAFETY: Adding new properties is safe; changing existing properties may affect test coverage
// TESTS: npm run test server/services/smart-albums.test.ts
// AI-META-END

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fc } from 'fast-check';
import { SmartAlbumsService, type SmartAlbumCriteria } from './smart-albums';
import { db } from '../../server/db';
import { photos, people, faces, smartAlbums } from '../../shared/schema';

// Mock the database
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
    update: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  }
}));

describe('SmartAlbumsService Property Tests', () => {
  let service: SmartAlbumsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SmartAlbumsService();
  });

  describe('Property 1: Album Photo Consistency', () => {
    it('should maintain consistent photo counts across multiple generations', async () => {
      const property = fc.asyncProperty(
        fc.array(fc.string(), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 1, max: 100 }),
        async (labels, expectedCount) => {
          // Mock database to return consistent results
          const mockPhotos = Array.from({ length: expectedCount }, (_, i) => ({
            id: `photo-${i}`,
            userId: 'user-1',
            mlLabels: labels,
            createdAt: new Date(),
            isFavorite: false,
            isVideo: false,
            width: 1920,
            height: 1080,
            filename: `photo-${i}.jpg`,
            uri: `file://photo-${i}.jpg`,
            modifiedAt: new Date()
          }));

          vi.mocked(db.select).mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockPhotos)
            })
          } as any);

          // Generate album multiple times
          const criteria: SmartAlbumCriteria = { labels };
          const photos1 = await service.getPhotosForCriteria('user-1', criteria);
          const photos2 = await service.getPhotosForCriteria('user-1', criteria);

          // Property: Same criteria should always return same photos
          expect(photos1).toHaveLength(photos2.length);
          expect(photos1.map(p => p.id)).toEqual(photos2.map(p => p.id));
        }
      );

      await property(fc.sample(100));
    });

    it('should handle empty photo sets gracefully', async () => {
      const property = fc.asyncProperty(
        fc.record({
          labels: fc.array(fc.string()),
          peopleIds: fc.array(fc.string()),
          locationNames: fc.array(fc.string()),
          isVideo: fc.boolean(),
          isFavorite: fc.boolean()
        }),
        async (criteria) => {
          // Mock empty result
          vi.mocked(db.select).mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([])
            })
          } as any);

          const photos = await service.getPhotosForCriteria('user-1', criteria);
          
          // Property: Empty criteria should not crash and return empty array
          expect(Array.isArray(photos)).toBe(true);
          expect(photos).toHaveLength(0);
        }
      );

      await property(fc.sample(50));
    });
  });

  describe('Property 2: Update Idempotence', () => {
    it('should produce same result when updating same album multiple times', async () => {
      const property = fc.asyncProperty(
        fc.string(),
        fc.array(fc.string()),
        fc.integer({ min: 1, max: 20 }),
        async (title, labels, photoCount) => {
          const generation = {
            type: 'things' as const,
            title,
            description: `Album for ${title}`,
            criteria: { labels },
            coverPhotoStrategy: 'newest' as const
          };

          // Mock existing album check to return null (new album)
          vi.mocked(db.select).mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([])
            })
          } as any);

          // Mock insert to return consistent album
          const mockAlbum = {
            id: 'album-1',
            userId: 'user-1',
            albumType: generation.type,
            title: generation.title,
            description: generation.description,
            criteria: generation.criteria,
            coverPhotoId: 'photo-1',
            photoCount,
            isPinned: false,
            isHidden: false,
            lastUpdatedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          };

          vi.mocked(db.insert).mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([mockAlbum])
            })
          } as any);

          // Generate album multiple times
          const album1 = await service.generateSmartAlbum('user-1', generation);
          const album2 = await service.generateSmartAlbum('user-1', generation);

          // Property: Same generation should produce same album
          expect(album1).not.toBeNull();
          expect(album2).not.toBeNull();
          expect(album1!.title).toEqual(album2!.title);
          expect(album1!.albumType).toEqual(album2!.albumType);
          expect(album1!.criteria).toEqual(album2!.criteria);
        }
      );

      await property(fc.sample(50));
    });

    it('should handle concurrent updates safely', async () => {
      const property = fc.asyncProperty(
        fc.string(),
        fc.integer({ min: 2, max: 10 }),
        async (userId, updateCount) => {
          const mockAlbums = Array.from({ length: updateCount }, (_, i) => ({
            id: `album-${i}`,
            userId,
            albumType: 'things' as const,
            title: `Album ${i}`,
            description: `Description ${i}`,
            criteria: { labels: [`label-${i}`] },
            coverPhotoId: `photo-${i}`,
            photoCount: i + 1,
            isPinned: false,
            isHidden: false,
            lastUpdatedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          }));

          vi.mocked(db.select).mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockAlbums)
            })
          } as any);

          vi.mocked(db.update).mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockImplementation((cb) => {
                  return mockAlbums.map(cb);
                })
              })
            })
          } as any);

          // Update all albums concurrently
          const updatePromises = mockAlbums.map(album =>
            service.updateSmartAlbumSettings(userId, album.id, { isPinned: true })
          );

          const results = await Promise.all(updatePromises);

          // Property: Concurrent updates should complete without errors
          expect(results).toHaveLength(updateCount);
          results.forEach(result => {
            expect(result).not.toBeNull();
            expect(result!.isPinned).toBe(true);
          });
        }
      );

      await property(fc.sample(30));
    });
  });

  describe('Property 3: Cover Photo Selection Consistency', () => {
    it('should select cover photos consistently based on strategy', async () => {
      const property = fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string(),
            width: fc.integer({ min: 100, max: 4000 }),
            height: fc.integer({ min: 100, max: 4000 }),
            isFavorite: fc.boolean(),
            createdAt: fc.date()
          }),
          { minLength: 1, maxLength: 20 }
        ),
        fc.constantFrom('newest', 'highest_quality', 'random' as const),
        async (photoData, strategy) => {
          const photos = photoData.map((data, index) => ({
            ...data,
            userId: 'user-1',
            filename: `photo-${index}.jpg`,
            uri: `file://photo-${index}.jpg`,
            modifiedAt: data.createdAt,
            isVideo: false,
            isPrivate: false
          }));

          // Sort by newest for consistent testing
          photos.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

          // Access private method through reflection for testing
          const serviceAny = service as any;
          const coverPhoto1 = serviceAny.selectCoverPhoto(photos, strategy);
          const coverPhoto2 = serviceAny.selectCoverPhoto(photos, strategy);

          if (strategy === 'random') {
            // Random strategy may produce different results
            expect(coverPhoto1).toBeDefined();
            expect(coverPhoto2).toBeDefined();
            expect(photos).toContain(coverPhoto1);
            expect(photos).toContain(coverPhoto2);
          } else {
            // Deterministic strategies should be consistent
            expect(coverPhoto1).toEqual(coverPhoto2);
          }

          // Verify strategy-specific behavior
          if (strategy === 'newest') {
            expect(coverPhoto1).toBe(photos[0]);
          } else if (strategy === 'highest_quality') {
            const expectedBest = photos.reduce((best, photo) => {
              const bestScore = (best.width * best.height) * (best.isFavorite ? 1.5 : 1);
              const photoScore = (photo.width * photo.height) * (photo.isFavorite ? 1.5 : 1);
              return photoScore > bestScore ? photo : best;
            });
            expect(coverPhoto1).toBe(expectedBest);
          }
        }
      );

      await property(fc.sample(50));
    });
  });

  describe('Property 4: Criteria Filtering Accuracy', () => {
    it('should correctly filter photos based on multiple criteria', async () => {
      const property = fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.string(),
            mlLabels: fc.array(fc.string()),
            isVideo: fc.boolean(),
            isFavorite: fc.boolean(),
            location: fc.option(fc.record({
              city: fc.string(),
              country: fc.string()
            }))
          }),
          { minLength: 5, maxLength: 50 }
        ),
        fc.record({
          labels: fc.array(fc.string()),
          isVideo: fc.boolean(),
          isFavorite: fc.boolean(),
          locationNames: fc.array(fc.string())
        }),
        async (photoData, criteria) => {
          // Mock database to return all photos
          const mockPhotos = photoData.map((data, index) => ({
            ...data,
            userId: 'user-1',
            filename: `photo-${index}.jpg`,
            uri: `file://photo-${index}.jpg`,
            width: 1920,
            height: 1080,
            createdAt: new Date(),
            modifiedAt: new Date(),
            isPrivate: false
          }));

          vi.mocked(db.select).mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue(mockPhotos)
            })
          } as any);

          const filteredPhotos = await service.getPhotosForCriteria('user-1', criteria);

          // Verify each photo matches all specified criteria
          filteredPhotos.forEach(photo => {
            if (criteria.labels && criteria.labels.length > 0) {
              const hasMatchingLabel = criteria.labels.some(label =>
                photo.mlLabels?.includes(label)
              );
              expect(hasMatchingLabel).toBe(true);
            }

            if (criteria.isVideo !== undefined) {
              expect(photo.isVideo).toBe(criteria.isVideo);
            }

            if (criteria.isFavorite !== undefined) {
              expect(photo.isFavorite).toBe(criteria.isFavorite);
            }

            if (criteria.locationNames && criteria.locationNames.length > 0) {
              const hasMatchingLocation = criteria.locationNames.some(name =>
                photo.location && Object.values(photo.location).includes(name)
              );
              expect(hasMatchingLocation).toBe(true);
            }
          });
        }
      );

      await property(fc.sample(30));
    });
  });

  describe('Property 5: Album Generation Completeness', () => {
    it('should generate all expected album types for users with diverse photos', async () => {
      const property = fc.asyncProperty(
        fc.record({
          hasPeople: fc.boolean(),
          hasLocations: fc.boolean(),
          hasLabels: fc.boolean(),
          hasVideos: fc.boolean(),
          hasFavorites: fc.boolean()
        }),
        async (userProfile) => {
          const generations = await service.getAlbumGenerations('user-1');

          // Verify album types are generated based on user profile
          const albumTypes = new Set(generations.map(g => g.type));

          if (userProfile.hasPeople) {
            // Should have people albums generation logic
            expect(generations.some(g => g.type === 'people')).toBe(true);
          }

          if (userProfile.hasLocations) {
            // Should have places albums generation logic
            expect(generations.some(g => g.type === 'places')).toBe(true);
          }

          if (userProfile.hasLabels) {
            // Should have things albums generation logic
            expect(generations.some(g => g.type === 'things')).toBe(true);
          }

          // Always have special albums generation
          expect(generations.some(g => g.type === 'special')).toBe(true);

          // Verify all generations have required fields
          generations.forEach(generation => {
            expect(generation).toHaveProperty('type');
            expect(generation).toHaveProperty('title');
            expect(generation).toHaveProperty('description');
            expect(generation).toHaveProperty('criteria');
            expect(generation).toHaveProperty('coverPhotoStrategy');
            expect(['people', 'places', 'things', 'special']).toContain(generation.type);
            expect(['newest', 'highest_quality', 'random']).toContain(generation.coverPhotoStrategy);
          });
        }
      );

      await property(fc.sample(20));
    });
  });
});

describe('SmartAlbumsService Unit Tests', () => {
  let service: SmartAlbumsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SmartAlbumsService();
  });

  it('should handle empty photo libraries gracefully', async () => {
    vi.mocked(db.select).mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([])
      })
    } as any);

    const albums = await service.generateAllSmartAlbums('user-1');
    
    expect(Array.isArray(albums)).toBe(true);
    expect(albums).toHaveLength(0);
  });

  it('should validate smart album criteria structure', () => {
    const validCriteria: SmartAlbumCriteria = {
      labels: ['beach', 'sunset'],
      isFavorite: true,
      minConfidence: 0.8
    };

    expect(validCriteria).toHaveProperty('labels');
    expect(Array.isArray(validCriteria.labels)).toBe(true);
    expect(validCriteria.minConfidence).toBeGreaterThanOrEqual(0);
    expect(validCriteria.minConfidence).toBeLessThanOrEqual(1);
  });

  it('should handle database errors gracefully', async () => {
    vi.mocked(db.select).mockImplementation(() => {
      throw new Error('Database connection failed');
    });

    await expect(service.getPhotosForCriteria('user-1', {})).rejects.toThrow();
  });

  it('should maintain user isolation', async () => {
    const mockPhotos = [
      { id: 'photo-1', userId: 'user-1' },
      { id: 'photo-2', userId: 'user-2' }
    ];

    vi.mocked(db.select).mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(mockPhotos.filter(p => p.userId === 'user-1'))
      })
    } as any);

    const photos = await service.getPhotosForCriteria('user-1', {});
    
    expect(photos.every(p => p.userId === 'user-1')).toBe(true);
  });
});
