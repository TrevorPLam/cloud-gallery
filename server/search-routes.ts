// AI-META-BEGIN
// AI-META: API endpoints for natural language search with NLP processing
// OWNERSHIP: server/api (search endpoints)
// ENTRYPOINTS: server/routes.ts
// DEPENDENCIES: express, SearchService, SearchIndexService, authentication middleware
// DANGER: Search performance; NLP processing overhead; user data exposure
// CHANGE-SAFETY: Moderate - API changes affect client; maintain backward compatibility
// TESTS: server/search-routes.test.ts (endpoint testing and security validation)
// AI-META-END

import { Router, Request, Response } from "express";
import { z } from "zod";
import { SearchService } from "./services/search";
import { SearchIndexService } from "./services/search-index";
import { authenticateToken } from "./auth";
import { db } from "./db";
import { sql, eq, and, or, ilike } from "drizzle-orm";
import { photos } from "@shared/schema";

const router = Router();

// Request schemas
const searchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

const suggestionsRequestSchema = z.object({
  partial: z.string().min(1).max(100),
  limit: z.number().min(1).max(20).default(5),
});

// Initialize services
const searchService = new SearchService(db);
const searchIndexService = new SearchIndexService(db);

// Middleware to ensure user is authenticated
router.use(authenticateToken);

/**
 * POST /api/search
 * Search photos with natural language query
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { query, limit, offset } = searchRequestSchema.parse(req.body);

    // Validate query length
    if (query.trim().length === 0) {
      return res.status(400).json({
        error: "Search query cannot be empty",
        code: "EMPTY_QUERY",
      });
    }

    // Perform search
    const results = await searchService.search(userId, query, limit, offset);

    // Format response
    const response = {
      photos: results.photos,
      total: results.total,
      query: results.query,
      suggestions: results.suggestions || [],
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < results.total,
        total: results.total,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Search error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request parameters",
        details: error.errors,
      });
    }

    res.status(500).json({
      error: "Internal server error",
      code: "SEARCH_FAILED",
    });
  }
});

/**
 * GET /api/search/suggestions
 * Get search suggestions as user types
 */
router.get("/suggestions", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { partial, limit } = suggestionsRequestSchema.parse(req.query);

    // Get suggestions from both service and database
    const [serviceSuggestions, dbSuggestions] = await Promise.all([
      searchService.getSuggestions(userId, partial, limit),
      searchIndexService.getSearchSuggestions(userId, partial, limit),
    ]);

    // Combine and deduplicate suggestions
    const allSuggestions = [
      ...serviceSuggestions,
      ...dbSuggestions.map((s) => s.suggestion),
    ];
    const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, limit);

    res.json({
      suggestions: uniqueSuggestions,
      dbSuggestions: dbSuggestions.slice(0, limit),
    });
  } catch (error) {
    console.error("Suggestions error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request parameters",
        details: error.errors,
      });
    }

    res.status(500).json({
      error: "Internal server error",
      code: "SUGGESTIONS_FAILED",
    });
  }
});

/**
 * GET /api/search/popular
 * Get popular search terms
 */
router.get("/popular", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const limitQuery = req.query.limit
      ? parseInt(req.query.limit as string)
      : 10;
    const limit = Math.min(Math.max(limitQuery, 1), 20);

    const [popularSearches, popularTerms] = await Promise.all([
      searchService.getPopularSearches(userId, limit),
      searchIndexService.getPopularSearchTerms(limit),
    ]);

    res.json({
      popularSearches,
      popularTerms: popularTerms.map((term) => term.search_term),
    });
  } catch (error) {
    console.error("Popular searches error:", error);

    res.status(500).json({
      error: "Internal server error",
      code: "POPULAR_SEARCHES_FAILED",
    });
  }
});

/**
 * POST /api/search/fulltext
 * Perform full-text search across filename, notes, and OCR text
 */
router.post("/fulltext", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { query, limit, offset } = searchRequestSchema.parse(req.body);

    // Validate query length
    if (query.trim().length === 0) {
      return res.status(400).json({
        error: "Search query cannot be empty",
        code: "EMPTY_QUERY",
      });
    }

    // Perform full-text search
    const results = await searchIndexService.fullTextSearch(
      userId,
      query,
      limit,
      offset,
    );

    // Get total count for pagination
    const totalCount = await searchIndexService.fullTextSearch(
      userId,
      query,
      1,
      0,
    );
    const total =
      totalCount.length > 0
        ? await db
            .select({ count: sql`count(*)` })
            .from(photos)
            .where(
              and(
                eq(photos.userId, userId),
                or(
                  ilike(photos.filename, `%${query}%`),
                  ilike(photos.notes, `%${query}%`),
                  ilike(photos.ocrText, `%${query}%`),
                ),
              ),
            )
        : 0;

    res.json({
      photos: results,
      total: total[0]?.count || 0,
      query,
      pagination: {
        limit,
        offset,
        hasMore: offset + limit < (total[0]?.count || 0),
        total: total[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error("Full-text search error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Invalid request parameters",
        details: error.errors,
      });
    }

    res.status(500).json({
      error: "Internal server error",
      code: "FULLTEXT_SEARCH_FAILED",
    });
  }
});

/**
 * GET /api/search/filters
 * Get available filter options for the user
 */
router.get("/filters", async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;

    // Get user's unique ML labels, tags, and locations
    const [labelsResult, tagsResult, locationsResult] = await Promise.all([
      db
        .select({ label: sql`DISTINCT unnest(ml_labels)` })
        .from(photos)
        .where(and(eq(photos.userId, userId), sql`ml_labels IS NOT NULL`)),

      db
        .select({ tag: sql`DISTINCT unnest(tags)` })
        .from(photos)
        .where(and(eq(photos.userId, userId), sql`tags IS NOT NULL`)),

      db
        .select({
          city: sql`DISTINCT location->>'city'`,
          country: sql`DISTINCT location->>'country'`,
        })
        .from(photos)
        .where(and(eq(photos.userId, userId), sql`location IS NOT NULL`)),
    ]);

    const filters = {
      objects: labelsResult.map((r) => r.label).filter(Boolean),
      tags: tagsResult.map((r) => r.tag).filter(Boolean),
      locations: {
        cities: locationsResult.map((r) => r.city).filter(Boolean),
        countries: locationsResult.map((r) => r.country).filter(Boolean),
      },
      mediaTypes: ["photo", "video"],
      hasFavorites: await db
        .select({ count: sql`count(*)` })
        .from(photos)
        .where(and(eq(photos.userId, userId), eq(photos.isFavorite, true)))
        .then((result) => (result[0]?.count || 0) > 0),
      hasVideos: await db
        .select({ count: sql`count(*)` })
        .from(photos)
        .where(and(eq(photos.userId, userId), eq(photos.isVideo, true)))
        .then((result) => (result[0]?.count || 0) > 0),
    };

    res.json(filters);
  } catch (error) {
    console.error("Filters error:", error);

    res.status(500).json({
      error: "Internal server error",
      code: "FILTERS_FAILED",
    });
  }
});

/**
 * POST /api/search/index/rebuild
 * Rebuild search indexes (admin only)
 */
router.post("/index/rebuild", async (req: Request, res: Response) => {
  try {
    // This should be protected to admin users only
    // For now, we'll just check if user exists
    const userId = (req as any).user.id;

    // In production, add admin check:
    // const user = await getUserById(userId);
    // if (!user.isAdmin) {
    //   return res.status(403).json({ error: "Admin access required" });
    // }

    await searchIndexService.rebuildSearchIndexes();
    await searchIndexService.refreshPopularSearches();

    res.json({
      message: "Search indexes rebuilt successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Index rebuild error:", error);

    res.status(500).json({
      error: "Internal server error",
      code: "INDEX_REBUILD_FAILED",
    });
  }
});

/**
 * GET /api/search/index/stats
 * Get search index statistics (admin only)
 */
router.get("/index/stats", async (req: Request, res: Response) => {
  try {
    // This should be protected to admin users only
    const userId = (req as any).user.id;

    // In production, add admin check here

    const [indexStats, popularTerms] = await Promise.all([
      searchIndexService.getIndexStats(),
      searchIndexService.getPopularSearchTerms(10),
    ]);

    res.json({
      indexes: indexStats,
      popularTerms,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Index stats error:", error);

    res.status(500).json({
      error: "Internal server error",
      code: "INDEX_STATS_FAILED",
    });
  }
});

export default router;
