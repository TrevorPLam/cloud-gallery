// AI-META-BEGIN
// AI-META: PostgreSQL search index creation and management for full-text search
// OWNERSHIP: server/services (search indexing)
// ENTRYPOINTS: server/search-routes.ts, database migrations
// DEPENDENCIES: drizzle-orm, PostgreSQL full-text search capabilities
// DANGER: Database schema changes; index creation performance impact
// CHANGE-SAFETY: Risky - affects database performance and storage; test with production data volumes
// TESTS: server/services/search-index.test.ts (index creation and search validation)
// AI-META-END

import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { photos } from "@shared/schema";

export class SearchIndexService {
  constructor(private db: PostgresJsDatabase) {}

  /**
   * Create full-text search indexes for photos table
   * This enables efficient natural language search across multiple fields
   */
  async createSearchIndexes(): Promise<void> {
    try {
      // Create GIN index for ML labels array search
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_ml_labels_gin 
        ON photos USING GIN (ml_labels)
      `);

      // Create GIN index for tags array search
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_tags_gin 
        ON photos USING GIN (tags)
      `);

      // Create GIN index for location JSONB search
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_location_gin 
        ON photos USING GIN (location)
      `);

      // Create GIN index for camera JSONB search
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_camera_gin 
        ON photos USING GIN (camera)
      `);

      // Create GIN index for EXIF JSONB search
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_exif_gin 
        ON photos USING GIN (exif)
      `);

      // Create composite index for common search patterns
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_search_composite 
        ON photos (user_id, created_at DESC, is_favorite)
      `);

      // Create index for filename search
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_filename_text 
        ON photos USING gin (to_tsvector('english', filename))
      `);

      // Create index for notes search
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_notes_text 
        ON photos USING gin (to_tsvector('english', notes))
      `);

      // Create index for OCR text search
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_ocr_text 
        ON photos USING gin (to_tsvector('english', ocr_text))
      `);

      // Create index for video filtering
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_is_video 
        ON photos (is_video)
      `);

      // Create index for favorite filtering
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_is_favorite 
        ON photos (is_favorite)
      `);

      // Create index for date range queries
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_photos_created_at 
        ON photos (created_at)
      `);

      console.log("Search indexes created successfully");
    } catch (error) {
      console.error("Error creating search indexes:", error);
      throw error;
    }
  }

  /**
   * Drop all search indexes (for cleanup or recreation)
   */
  async dropSearchIndexes(): Promise<void> {
    try {
      const indexes = [
        "idx_photos_ml_labels_gin",
        "idx_photos_tags_gin",
        "idx_photos_location_gin",
        "idx_photos_camera_gin",
        "idx_photos_exif_gin",
        "idx_photos_search_composite",
        "idx_photos_filename_text",
        "idx_photos_notes_text",
        "idx_photos_ocr_text",
        "idx_photos_is_video",
        "idx_photos_is_favorite",
        "idx_photos_created_at",
      ];

      for (const indexName of indexes) {
        await this.db.execute(
          sql`DROP INDEX IF EXISTS ${sql.identifier(indexName)}`,
        );
      }

      console.log("Search indexes dropped successfully");
    } catch (error) {
      console.error("Error dropping search indexes:", error);
      throw error;
    }
  }

  /**
   * Rebuild search indexes (drop and recreate)
   */
  async rebuildSearchIndexes(): Promise<void> {
    await this.dropSearchIndexes();
    await this.createSearchIndexes();
  }

  /**
   * Get search index statistics
   */
  async getIndexStats(): Promise<any> {
    try {
      const result = await this.db.execute(sql`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename = 'photos' 
        AND indexname LIKE 'idx_photos_%'
        ORDER BY indexname
      `);

      return result;
    } catch (error) {
      console.error("Error getting index stats:", error);
      throw error;
    }
  }

  /**
   * Analyze table to update index statistics
   */
  async analyzeTable(): Promise<void> {
    try {
      await this.db.execute(sql`ANALYZE photos`);
      console.log("Table analysis completed");
    } catch (error) {
      console.error("Error analyzing table:", error);
      throw error;
    }
  }

  /**
   * Create a materialized view for popular searches
   * This can be updated periodically for better performance
   */
  async createPopularSearchesView(): Promise<void> {
    try {
      await this.db.execute(sql`
        CREATE MATERIALIZED VIEW IF NOT EXISTS popular_searches AS
        SELECT 
          unnest(ml_labels) as search_term,
          COUNT(*) as photo_count,
          COUNT(DISTINCT user_id) as user_count,
          MAX(created_at) as last_seen
        FROM photos 
        WHERE ml_labels IS NOT NULL 
        AND array_length(ml_labels, 1) > 0
        GROUP BY unnest(ml_labels)
        HAVING COUNT(*) > 1
        ORDER BY photo_count DESC, user_count DESC
      `);

      // Create index on the materialized view
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_popular_searches_term 
        ON popular_searches (search_term)
      `);

      console.log("Popular searches view created successfully");
    } catch (error) {
      console.error("Error creating popular searches view:", error);
      throw error;
    }
  }

  /**
   * Refresh popular searches materialized view
   */
  async refreshPopularSearches(): Promise<void> {
    try {
      await this.db.execute(sql`REFRESH MATERIALIZED VIEW popular_searches`);
      console.log("Popular searches view refreshed");
    } catch (error) {
      console.error("Error refreshing popular searches view:", error);
      throw error;
    }
  }

  /**
   * Get popular search terms from the materialized view
   */
  async getPopularSearchTerms(
    limit = 20,
  ): Promise<
    { search_term: string; photo_count: number; user_count: number }[]
  > {
    try {
      const result = await this.db.execute(sql`
        SELECT search_term, photo_count, user_count
        FROM popular_searches
        ORDER BY photo_count DESC, user_count DESC
        LIMIT ${limit}
      `);

      return result as {
        search_term: string;
        photo_count: number;
        user_count: number;
      }[];
    } catch (error) {
      console.error("Error getting popular search terms:", error);
      return [];
    }
  }

  /**
   * Create a search suggestions function in PostgreSQL
   * This provides server-side autocomplete functionality
   */
  async createSearchSuggestionsFunction(): Promise<void> {
    try {
      await this.db.execute(sql`
        CREATE OR REPLACE FUNCTION search_suggestions(
          user_id_param VARCHAR,
          partial_query TEXT,
          limit_param INTEGER DEFAULT 5
        )
        RETURNS TABLE(
          suggestion TEXT,
          type VARCHAR,
          count BIGINT
        ) AS $$
        BEGIN
          RETURN QUERY
          -- ML label suggestions
          SELECT 
            unnest(ml_labels) as suggestion,
            'label' as type,
            COUNT(*) as count
          FROM photos 
          WHERE user_id = user_id_param
          AND ml_labels IS NOT NULL
          AND array_length(ml_labels, 1) > 0
          AND exists (SELECT 1 FROM unnest(ml_labels) label WHERE label ILIKE '%' || partial_query || '%')
          GROUP BY unnest(ml_labels)
          
          UNION ALL
          
          -- Tag suggestions
          SELECT 
            unnest(tags) as suggestion,
            'tag' as type,
            COUNT(*) as count
          FROM photos 
          WHERE user_id = user_id_param
          AND tags IS NOT NULL
          AND array_length(tags, 1) > 0
          AND exists (SELECT 1 FROM unnest(tags) tag WHERE tag ILIKE '%' || partial_query || '%')
          GROUP BY unnest(tags)
          
          UNION ALL
          
          -- Location suggestions (extract from JSON)
          SELECT 
            location->>'city' as suggestion,
            'location' as type,
            COUNT(*) as count
          FROM photos 
          WHERE user_id = user_id_param
          AND location IS NOT NULL
          AND location->>'city' IS NOT NULL
          AND location->>'city' ILIKE '%' || partial_query || '%'
          GROUP BY location->>'city'
          
          ORDER BY count DESC
          LIMIT limit_param;
        END;
        $$ LANGUAGE plpgsql;
      `);

      console.log("Search suggestions function created successfully");
    } catch (error) {
      console.error("Error creating search suggestions function:", error);
      throw error;
    }
  }

  /**
   * Get search suggestions using the PostgreSQL function
   */
  async getSearchSuggestions(
    userId: string,
    partialQuery: string,
    limit = 5,
  ): Promise<{ suggestion: string; type: string; count: number }[]> {
    try {
      const result = await this.db.execute(sql`
        SELECT * FROM search_suggestions(${userId}, ${partialQuery}, ${limit})
      `);

      return result as {
        suggestion: string;
        type: string;
        count: number;
      }[];
    } catch (error) {
      console.error("Error getting search suggestions:", error);
      return [];
    }
  }

  /**
   * Create a full-text search function that combines multiple fields
   */
  async createFullTextSearchFunction(): Promise<void> {
    try {
      await this.db.execute(sql`
        CREATE OR REPLACE FUNCTION full_text_search_photos(
          user_id_param VARCHAR,
          search_query TEXT,
          limit_param INTEGER DEFAULT 50,
          offset_param INTEGER DEFAULT 0
        )
        RETURNS TABLE(
          id VARCHAR,
          uri TEXT,
          filename TEXT,
          created_at TIMESTAMP,
          rank REAL
        ) AS $$
        BEGIN
          RETURN QUERY
          SELECT 
            p.id,
            p.uri,
            p.filename,
            p.created_at,
            ts_rank(
              to_tsvector('english', 
                COALESCE(p.filename, '') || ' ' ||
                COALESCE(p.notes, '') || ' ' ||
                COALESCE(p.ocr_text, '')
              ),
              plainto_tsquery('english', search_query)
            ) as rank
          FROM photos p
          WHERE p.user_id = user_id_param
          AND to_tsvector('english', 
            COALESCE(p.filename, '') || ' ' ||
            COALESCE(p.notes, '') || ' ' ||
            COALESCE(p.ocr_text, '')
          ) @@ plainto_tsquery('english', search_query)
          ORDER BY rank DESC, p.created_at DESC
          LIMIT limit_param
          OFFSET offset_param;
        END;
        $$ LANGUAGE plpgsql;
      `);

      console.log("Full-text search function created successfully");
    } catch (error) {
      console.error("Error creating full-text search function:", error);
      throw error;
    }
  }

  /**
   * Perform full-text search using the PostgreSQL function
   */
  async fullTextSearch(
    userId: string,
    query: string,
    limit = 50,
    offset = 0,
  ): Promise<
    {
      id: string;
      uri: string;
      filename: string;
      created_at: Date;
      rank: number;
    }[]
  > {
    try {
      const result = await this.db.execute(sql`
        SELECT * FROM full_text_search_photos(${userId}, ${query}, ${limit}, ${offset})
      `);

      return result as {
        id: string;
        uri: string;
        filename: string;
        created_at: Date;
        rank: number;
      }[];
    } catch (error) {
      console.error("Error performing full-text search:", error);
      return [];
    }
  }
}
