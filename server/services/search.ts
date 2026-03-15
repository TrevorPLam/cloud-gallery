// AI-META-BEGIN
// AI-META: Natural Language Processing search service with query parsing and entity extraction
// OWNERSHIP: server/services (search logic)
// ENTRYPOINTS: server/search-routes.ts
// DEPENDENCIES: wink-nlp, chrono, drizzle-orm, database schema
// DANGER: Complex query parsing; performance impact on large datasets; NLP model loading
// CHANGE-SAFETY: Moderate - query parsing logic affects search results; test with various queries
// TESTS: server/services/search.test.ts (property tests for query parsing)
// AI-META-END

import { drizzle } from "drizzle-orm/postgres-js";
import {
  eq,
  and,
  or,
  ilike,
  inArray,
  between,
  sql,
  desc,
  asc,
} from "drizzle-orm";
import { winkNLP, model } from "wink-nlp";
import * as chrono from "chrono";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { photos, users } from "@shared/schema";
import type { Photo, User } from "@shared/schema";

// Initialize NLP model
const nlp = winkNLP(model);

// Search query types
export interface SearchQuery {
  text?: string;
  objects?: string[];
  scenes?: string[];
  people?: string[];
  locations?: string[];
  tags?: string[];
  startDate?: Date;
  endDate?: Date;
  favorites?: boolean;
  videos?: boolean;
  photos?: boolean;
  negated?: {
    text?: string;
    objects?: string[];
    scenes?: string[];
    locations?: string[];
    tags?: string[];
  };
}

export interface SearchResult {
  photos: Photo[];
  total: number;
  query: SearchQuery;
  suggestions?: string[];
}

export interface SearchFilters {
  dateRange?: { start: Date; end: Date };
  tags?: string[];
  favorites?: boolean;
  mediaType?: "photo" | "video" | "all";
  locations?: string[];
}

export class SearchService {
  constructor(private db: PostgresJsDatabase) {}

  /**
   * Parse natural language query into structured search components
   * Examples:
   * - "beach photos from last summer" -> { scenes: ["beach"], startDate: Date, endDate: Date }
   * - "photos of john at the beach" -> { people: ["john"], scenes: ["beach"] }
   * - "sunset photos not in california" -> { scenes: ["sunset"], negated: { locations: ["california"] } }
   */
  parseNaturalLanguageQuery(query: string): SearchQuery {
    const normalizedQuery = query.toLowerCase().trim();
    const parsed: SearchQuery = {};

    // Extract dates using chrono
    const dates = chrono.parse(normalizedQuery);
    if (dates.length > 0) {
      const dateRange = this.extractDateRange(dates);
      if (dateRange) {
        parsed.startDate = dateRange.start;
        parsed.endDate = dateRange.end;
      }
    }

    // Process with NLP for entity extraction
    const doc = nlp.readDoc(normalizedQuery);

    // Extract entities and tokens
    const entities = doc.entities().out();
    const tokens = doc.tokens().out();

    // Photo/video detection
    if (
      normalizedQuery.includes("video") ||
      normalizedQuery.includes("videos")
    ) {
      parsed.videos = true;
    }
    if (
      normalizedQuery.includes("photo") ||
      normalizedQuery.includes("photos") ||
      normalizedQuery.includes("picture") ||
      normalizedQuery.includes("pictures")
    ) {
      parsed.photos = true;
    }

    // Favorites detection
    if (
      normalizedQuery.includes("favorite") ||
      normalizedQuery.includes("favorites") ||
      normalizedQuery.includes("liked")
    ) {
      parsed.favorites = true;
    }

    // Negation handling
    const negationWords = ["not", "without", "except", "but not", "excluding"];
    const hasNegation = negationWords.some((word) =>
      normalizedQuery.includes(word),
    );

    if (hasNegation) {
      parsed.negated = {};
    }

    // Common objects and scenes to look for
    const objectScenes = [
      "beach",
      "ocean",
      "sea",
      "mountain",
      "mountains",
      "forest",
      "tree",
      "trees",
      "city",
      "building",
      "buildings",
      "house",
      "houses",
      "car",
      "cars",
      "road",
      "sunset",
      "sunrise",
      "night",
      "day",
      "sky",
      "clouds",
      "rain",
      "snow",
      "food",
      "pizza",
      "burger",
      "coffee",
      "cake",
      "fruit",
      "vegetables",
      "dog",
      "dogs",
      "cat",
      "cats",
      "bird",
      "birds",
      "animal",
      "animals",
      "flower",
      "flowers",
      "plant",
      "plants",
      "garden",
      "nature",
      "phone",
      "computer",
      "laptop",
      "screen",
      "book",
      "books",
    ];

    // Common locations
    const locations = [
      "california",
      "new york",
      "florida",
      "texas",
      "hawaii",
      "alaska",
      "paris",
      "london",
      "tokyo",
      "rome",
      "barcelona",
      "amsterdam",
      "home",
      "work",
      "office",
      "school",
      "park",
      "beach",
      "mountain",
      "restaurant",
      "cafe",
      "shop",
      "store",
      "mall",
      "gym",
    ];

    // Extract objects/scenes
    const foundObjects = objectScenes.filter((obj) => tokens.includes(obj));
    if (foundObjects.length > 0) {
      if (hasNegation) {
        parsed.negated!.objects = foundObjects;
      } else {
        parsed.objects = foundObjects;
      }
    }

    // Extract locations
    const foundLocations = locations.filter((loc) =>
      normalizedQuery.includes(loc),
    );
    if (foundLocations.length > 0) {
      if (hasNegation) {
        parsed.negated!.locations = foundLocations;
      } else {
        parsed.locations = foundLocations;
      }
    }

    // Extract tags (words with # or in quotes)
    const tagMatches =
      normalizedQuery.match(/#\w+/g) || normalizedQuery.match(/"([^"]+)"/g);
    if (tagMatches) {
      const tags = tagMatches.map((tag) => tag.replace(/[#"]/g, ""));
      if (hasNegation) {
        parsed.negated!.tags = tags;
      } else {
        parsed.tags = tags;
      }
    }

    // Extract people names (simplified - capitalized words that aren't locations)
    const peopleTokens = tokens.filter(
      (token) =>
        /^[A-Z][a-z]+$/.test(token) &&
        !locations.some((loc) =>
          loc.toLowerCase().includes(token.toLowerCase()),
        ),
    );
    if (peopleTokens.length > 0) {
      parsed.people = peopleTokens;
    }

    // Store remaining text for full-text search
    const searchWords = tokens.filter(
      (token) =>
        !objectScenes.includes(token) &&
        !locations.includes(token) &&
        !peopleTokens.includes(token) &&
        !negationWords.some((word) => token.includes(word)) &&
        token.length > 2,
    );

    if (searchWords.length > 0) {
      if (hasNegation) {
        parsed.negated!.text = searchWords.join(" ");
      } else {
        parsed.text = searchWords.join(" ");
      }
    }

    return parsed;
  }

  /**
   * Extract date range from parsed chronology results
   */
  private extractDateRange(dates: any[]): { start: Date; end: Date } | null {
    if (dates.length === 0) return null;

    const now = new Date();
    let start: Date;
    let end: Date;

    // Handle relative dates like "last summer", "yesterday", "last week"
    const text = dates[0].text().toLowerCase();

    if (text.includes("last summer")) {
      const lastYear = now.getFullYear() - 1;
      start = new Date(lastYear, 5, 21); // June 21
      end = new Date(lastYear, 8, 23); // September 23
    } else if (text.includes("this summer")) {
      const thisYear = now.getFullYear();
      start = new Date(thisYear, 5, 21);
      end = new Date(thisYear, 8, 23);
    } else if (text.includes("last winter")) {
      const lastYear = now.getFullYear() - 1;
      start = new Date(lastYear, 11, 21); // December 21
      end = new Date(lastYear, 1, 20); // February 20 (next year)
    } else if (text.includes("this winter")) {
      const thisYear = now.getFullYear();
      if (now.getMonth() >= 11) {
        // We're in winter
        start = new Date(thisYear, 11, 21);
        end = new Date(thisYear + 1, 1, 20);
      } else {
        start = new Date(thisYear - 1, 11, 21);
        end = new Date(thisYear, 1, 20);
      }
    } else if (text.includes("last year")) {
      const lastYear = now.getFullYear() - 1;
      start = new Date(lastYear, 0, 1);
      end = new Date(lastYear, 11, 31);
    } else if (text.includes("this year")) {
      const thisYear = now.getFullYear();
      start = new Date(thisYear, 0, 1);
      end = new Date(thisYear, 11, 31);
    } else if (text.includes("yesterday")) {
      start = new Date(now);
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setHours(23, 59, 59, 999);
    } else if (text.includes("today")) {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      end = new Date(now);
      end.setHours(23, 59, 59, 999);
    } else {
      // Use the parsed date from chrono
      const parsedDate = dates[0].start();
      if (parsedDate) {
        start = new Date(parsedDate);
        start.setHours(0, 0, 0, 0);
        end = new Date(parsedDate);
        end.setHours(23, 59, 59, 999);
      } else {
        return null;
      }
    }

    return { start, end };
  }

  /**
   * Build database query from parsed search components
   */
  private buildSearchQuery(userId: string, searchQuery: SearchQuery) {
    const conditions = [eq(photos.userId, userId)];
    const negatedConditions = [];

    // Media type filtering
    if (searchQuery.videos && !searchQuery.photos) {
      conditions.push(eq(photos.isVideo, true));
    } else if (searchQuery.photos && !searchQuery.videos) {
      conditions.push(eq(photos.isVideo, false));
    }

    // Favorites filtering
    if (searchQuery.favorites) {
      conditions.push(eq(photos.isFavorite, true));
    }

    // Date range filtering
    if (searchQuery.startDate && searchQuery.endDate) {
      conditions.push(
        between(photos.createdAt, searchQuery.startDate, searchQuery.endDate),
      );
    }

    // ML labels filtering (objects and scenes)
    if (searchQuery.objects && searchQuery.objects.length > 0) {
      const objectConditions = searchQuery.objects.map(
        (obj) => sql`${photos.mlLabels} && ${[obj]}`, // PostgreSQL array contains operator
      );
      conditions.push(or(...objectConditions));
    }

    // Location filtering
    if (searchQuery.locations && searchQuery.locations.length > 0) {
      const locationConditions = searchQuery.locations.map((loc) =>
        ilike(photos.location, `%${loc}%`),
      );
      conditions.push(or(...locationConditions));
    }

    // Tags filtering
    if (searchQuery.tags && searchQuery.tags.length > 0) {
      const tagConditions = searchQuery.tags.map(
        (tag) => sql`${photos.tags} && ${[tag]}`, // PostgreSQL array contains operator
      );
      conditions.push(or(...tagConditions));
    }

    // Full-text search
    if (searchQuery.text) {
      conditions.push(
        or(
          ilike(photos.filename, `%${searchQuery.text}%`),
          ilike(photos.notes, `%${searchQuery.text}%`),
          ilike(photos.ocrText, `%${searchQuery.text}%`),
        ),
      );
    }

    // Handle negated conditions
    if (searchQuery.negated) {
      const negated = searchQuery.negated;

      if (negated.text) {
        negatedConditions.push(
          or(
            ilike(photos.filename, `%${negated.text}%`),
            ilike(photos.notes, `%${negated.text}%`),
            ilike(photos.ocrText, `%${negated.text}%`),
          ),
        );
      }

      if (negated.objects && negated.objects.length > 0) {
        const objectConditions = negated.objects.map(
          (obj) => sql`${photos.mlLabels} && ${[obj]}`,
        );
        negatedConditions.push(or(...objectConditions));
      }

      if (negated.locations && negated.locations.length > 0) {
        const locationConditions = negated.locations.map((loc) =>
          ilike(photos.location, `%${loc}%`),
        );
        negatedConditions.push(or(...locationConditions));
      }

      if (negated.tags && negated.tags.length > 0) {
        const tagConditions = negated.tags.map(
          (tag) => sql`${photos.tags} && ${[tag]}`,
        );
        negatedConditions.push(or(...tagConditions));
      }
    }

    // Combine all conditions
    let finalCondition = and(...conditions);

    if (negatedConditions.length > 0) {
      finalCondition = and(
        finalCondition,
        sql`NOT (${or(...negatedConditions)})`,
      );
    }

    return finalCondition;
  }

  /**
   * Execute search with natural language query
   */
  async search(
    userId: string,
    query: string,
    limit = 50,
    offset = 0,
  ): Promise<SearchResult> {
    const searchQuery = this.parseNaturalLanguageQuery(query);
    const whereCondition = this.buildSearchQuery(userId, searchQuery);

    // Get total count
    const countResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(photos)
      .where(whereCondition);

    const total = countResult[0]?.count || 0;

    // Get photos with pagination
    const results = await this.db
      .select()
      .from(photos)
      .where(whereCondition)
      .orderBy(desc(photos.createdAt))
      .limit(limit)
      .offset(offset);

    // Generate suggestions based on common searches
    const suggestions = this.generateSuggestions(query, searchQuery);

    return {
      photos: results,
      total,
      query: searchQuery,
      suggestions,
    };
  }

  /**
   * Generate search suggestions based on query and results
   */
  private generateSuggestions(
    originalQuery: string,
    searchQuery: SearchQuery,
  ): string[] {
    const suggestions: string[] = [];

    // If no results, suggest broader searches
    if (searchQuery.text && searchQuery.text.length > 0) {
      suggestions.push(`Try searching for "${searchQuery.text.split(" ")[0]}"`);
    }

    // Suggest related searches based on extracted entities
    if (searchQuery.objects && searchQuery.objects.length > 0) {
      suggestions.push(`Try "${searchQuery.objects[0]} photos"`);
    }

    if (searchQuery.locations && searchQuery.locations.length > 0) {
      suggestions.push(`Try "photos in ${searchQuery.locations[0]}"`);
    }

    // Suggest removing filters
    if (searchQuery.negated && Object.keys(searchQuery.negated).length > 0) {
      suggestions.push(`Try without exclusions`);
    }

    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }

  /**
   * Get popular search suggestions for user
   */
  async getPopularSearches(userId: string, limit = 10): Promise<string[]> {
    // This would typically be based on search history and analytics
    // For now, return common photo search patterns
    return [
      "beach photos",
      "sunset photos",
      "family photos",
      "vacation photos",
      "nature photos",
      "food photos",
      "pet photos",
      "home photos",
      "party photos",
      "favorite photos",
    ].slice(0, limit);
  }

  /**
   * Get search suggestions as user types
   */
  async getSuggestions(
    userId: string,
    partialQuery: string,
    limit = 5,
  ): Promise<string[]> {
    if (partialQuery.length < 2) {
      return [];
    }

    const popularSearches = await this.getPopularSearches(userId, 50);

    // Filter popular searches that match the partial query
    const matchingSuggestions = popularSearches.filter((search) =>
      search.toLowerCase().includes(partialQuery.toLowerCase()),
    );

    return matchingSuggestions.slice(0, limit);
  }
}
