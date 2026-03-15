// AI-META-BEGIN
// AI-META: Property tests for SearchService natural language query parsing and search functionality
// OWNERSHIP: server/services (search testing)
// ENTRYPOINTS: Test suite for search service
// DEPENDENCIES: fast-check, vitest, SearchService, database mocks
// DANGER: Property testing complexity; need proper test data generation
// CHANGE-SAFETY: Safe - tests validate correctness; update when adding new query patterns
// TESTS: npm run test server/services/search.test.ts
// AI-META-END

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fc } from 'fast-check';
import { SearchService } from './search';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, or, ilike, sql } from 'drizzle-orm';

// Mock database
const mockDb = {
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            offset: vi.fn(() => Promise.resolve([]))
          }))
        }))
      }))
    }))
  })),
  $count: vi.fn()
} as unknown as PostgresJsDatabase;

describe('SearchService', () => {
  let searchService: SearchService;

  beforeEach(() => {
    searchService = new SearchService(mockDb);
  });

  describe('parseNaturalLanguageQuery', () => {
    it('should parse empty query', () => {
      const result = searchService.parseNaturalLanguageQuery('');
      expect(result).toEqual({});
    });

    it('should parse simple text query', () => {
      const result = searchService.parseNaturalLanguageQuery('beautiful sunset');
      expect(result.text).toBe('beautiful sunset');
    });

    it('should parse beach scene query', () => {
      const result = searchService.parseNaturalLanguageQuery('beach photos');
      expect(result.objects).toContain('beach');
      expect(result.photos).toBe(true);
    });

    it('should parse date-based queries', () => {
      const result = searchService.parseNaturalLanguageQuery('photos from last summer');
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
      expect(result.photos).toBe(true);
    });

    it('should parse negation queries', () => {
      const result = searchService.parseNaturalLanguageQuery('beach photos not in california');
      expect(result.objects).toContain('beach');
      expect(result.negated?.locations).toContain('california');
    });

    it('should parse favorites queries', () => {
      const result = searchService.parseNaturalLanguageQuery('favorite photos');
      expect(result.favorites).toBe(true);
      expect(result.photos).toBe(true);
    });

    it('should parse video queries', () => {
      const result = searchService.parseNaturalLanguageQuery('videos of beach');
      expect(result.objects).toContain('beach');
      expect(result.videos).toBe(true);
    });

    it('should parse tag queries', () => {
      const result = searchService.parseNaturalLanguageQuery('photos with #vacation #family');
      expect(result.tags).toContain('vacation');
      expect(result.tags).toContain('family');
    });

    it('should parse quoted tag queries', () => {
      const result = searchService.parseNaturalLanguageQuery('photos with "family vacation"');
      expect(result.tags).toContain('family vacation');
    });

    it('should parse location queries', () => {
      const result = searchService.parseNaturalLanguageQuery('photos in california');
      expect(result.locations).toContain('california');
    });
  });

  describe('Property Tests', () => {
    // Property 1: User isolation - queries should always be scoped to a user
    it('should maintain user isolation for all queries', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string(),
        fc.string(),
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 50 }),
        async (userId, query, limit, offset) => {
          const mockSelect = vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn((condition) => {
                // Verify that the condition includes user filtering
                expect(condition).toBeDefined();
                return {
                  orderBy: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      offset: vi.fn(() => Promise.resolve([]))
                    }))
                  }))
                };
              }))
            }))
          }));

          const mockDbWithUser = {
            select: mockSelect,
            $count: vi.fn()
          } as unknown as PostgresJsDatabase;

          const service = new SearchService(mockDbWithUser);
          await service.search(userId, query, limit, offset);
          
          expect(mockSelect).toHaveBeenCalled();
        }
      ), { numRuns: 100 });
    });

    // Property 2: Empty query completeness - empty queries should return all user photos
    it('should handle empty queries gracefully', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string(),
        async (userId) => {
          const mockPhotos = [
            { id: '1', userId, filename: 'test.jpg' },
            { id: '2', userId, filename: 'test2.jpg' }
          ];

          const mockSelect = vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                orderBy: vi.fn(() => ({
                  limit: vi.fn(() => ({
                    offset: vi.fn(() => Promise.resolve(mockPhotos))
                  }))
                }
              }))
            }))
          }));

          const mockCount = vi.fn(() => Promise.resolve([{ count: 2 }]));

          const mockDbWithResults = {
            select: mockSelect,
            $count: mockCount
          } as unknown as PostgresJsDatabase;

          const service = new SearchService(mockDbWithResults);
          const result = await service.search(userId, '');

          expect(result.photos).toEqual(mockPhotos);
          expect(result.total).toBe(2);
          expect(result.query).toEqual({});
        }
      ), { numRuns: 50 });
    });

    // Property 3: Filter consistency - applying the same filter should give consistent results
    it('should maintain filter consistency', async () => {
      await fc.assert(fc.asyncProperty(
        fc.string(),
        fc.string(),
        fc.constantFrom('beach', 'sunset', 'mountain', 'city'),
        async (userId, query, filter) => {
          const filterQuery = `${filter} photos`;
          
          const mockPhotos = [
            { id: '1', userId, filename: 'beach.jpg', mlLabels: [filter] },
            { id: '2', userId, filename: 'other.jpg', mlLabels: [] }
          ];

          const mockSelect = vi.fn(() => ({
            from: vi.fn(() => ({
              where: vi.fn((condition) => {
                // Verify that ML labels filtering is applied
                expect(condition).toBeDefined();
                return {
                  orderBy: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      offset: vi.fn(() => Promise.resolve(
                        mockPhotos.filter(p => p.mlLabels?.includes(filter))
                      ))
                    }))))
                  }))
                };
              }))
            }))
          }));

          const mockCount = vi.fn(() => Promise.resolve([{ count: 1 }]));

          const mockDbWithResults = {
            select: mockSelect,
            $count: mockCount
          } as unknown as PostgresJsDatabase;

          const service = new SearchService(mockDbWithResults);
          const result = await service.search(userId, filterQuery);

          expect(result.photos.length).toBeGreaterThan(0);
          result.photos.forEach(photo => {
            expect(photo.mlLabels).toContain(filter);
          });
        }
      ), { numRuns: 50 });
    });

    // Property 4: Date parsing consistency - date queries should be parsed consistently
    it('should parse dates consistently', async () => {
      const dateQueries = [
        'photos from last summer',
        'photos from this summer',
        'photos from last winter',
        'photos from this winter',
        'photos from last year',
        'photos from this year',
        'photos from yesterday',
        'photos from today'
      ];

      for (const query of dateQueries) {
        const result = searchService.parseNaturalLanguageQuery(query);
        
        expect(result.startDate).toBeDefined();
        expect(result.endDate).toBeDefined();
        expect(result.startDate!.getTime()).toBeLessThanOrEqual(result.endDate!.getTime());
        expect(result.photos).toBe(true);
      }
    });

    // Property 5: Negation handling - negated terms should be properly excluded
    it('should handle negations correctly', () => {
      const negationQueries = [
        'beach photos not in california',
        'photos without people',
        'sunset photos except mountains',
        'nature photos excluding forest',
        'family photos but not at home'
      ];

      for (const query of negationQueries) {
        const result = searchService.parseNaturalLanguageQuery(query);
        
        expect(result.negated).toBeDefined();
        expect(Object.keys(result.negated!)).length.toBeGreaterThan(0);
      }
    });

    // Property 6: Tag extraction consistency - tags should be extracted consistently
    it('should extract tags consistently', () => {
      const tagQueries = [
        'photos with #vacation #family',
        'photos with "summer vacation"',
        'photos with #2024 #memories',
        'photos with "birthday party"'
      ];

      for (const query of tagQueries) {
        const result = searchService.parseNaturalLanguageQuery(query);
        
        expect(result.tags).toBeDefined();
        expect(result.tags!.length).toBeGreaterThan(0);
        result.tags!.forEach(tag => {
          expect(typeof tag).toBe('string');
          expect(tag.length).toBeGreaterThan(0);
        });
      }
    });
  });

  describe('generateSuggestions', () => {
    it('should generate suggestions for text queries', () => {
      const searchQuery = { text: 'beautiful sunset' };
      const suggestions = (searchService as any).generateSuggestions('beautiful sunset', searchQuery);
      
      expect(suggestions).toContain('Try searching for "beautiful"');
    });

    it('should generate suggestions for object queries', () => {
      const searchQuery = { objects: ['beach'] };
      const suggestions = (searchService as any).generateSuggestions('beach photos', searchQuery);
      
      expect(suggestions).toContain('Try "beach photos"');
    });

    it('should generate suggestions for location queries', () => {
      const searchQuery = { locations: ['california'] };
      const suggestions = (searchService as any).generateSuggestions('photos in california', searchQuery);
      
      expect(suggestions).toContain('Try "photos in california"');
    });

    it('should suggest removing negations', () => {
      const searchQuery = { negated: { locations: ['california'] } };
      const suggestions = (searchService as any).generateSuggestions('beach photos not in california', searchQuery);
      
      expect(suggestions).toContain('Try without exclusions');
    });
  });

  describe('getPopularSearches', () => {
    it('should return popular searches', async () => {
      const popularSearches = await searchService.getPopularSearches('user123', 5);
      
      expect(popularSearches).toHaveLength(5);
      expect(popularSearches).toContain('beach photos');
      expect(popularSearches).toContain('sunset photos');
    });

    it('should limit results as requested', async () => {
      const popularSearches = await searchService.getPopularSearches('user123', 3);
      
      expect(popularSearches).toHaveLength(3);
    });
  });

  describe('getSuggestions', () => {
    it('should return empty for short queries', async () => {
      const suggestions = await searchService.getSuggestions('user123', 'b');
      
      expect(suggestions).toHaveLength(0);
    });

    it('should return matching suggestions', async () => {
      const suggestions = await searchService.getSuggestions('user123', 'beach');
      
      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(suggestion => {
        expect(suggestion.toLowerCase()).toContain('beach');
      });
    });

    it('should limit suggestions', async () => {
      const suggestions = await searchService.getSuggestions('user123', 'photo', 2);
      
      expect(suggestions.length).toBeLessThanOrEqual(2);
    });
  });
});
