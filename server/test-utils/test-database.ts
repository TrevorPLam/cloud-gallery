import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../../shared/schema";
import { vi, beforeEach, afterEach } from "vitest";

// Test database instance
let testDb: PostgresJsDatabase;
let sql: postgres.Sql;

/**
 * Creates a test database connection for testing
 * Uses in-memory PostgreSQL-like structure with mocked responses
 */
export function createTestDatabase() {
  // Create a mock SQL client that behaves like postgres
  const mockResponses = new Map();
  
  sql = vi.fn().mockImplementation((query: string, params?: any[]) => {
    const key = query + JSON.stringify(params || []);
    
    if (mockResponses.has(key)) {
      return mockResponses.get(key);
    }
    
    // Default mock responses for common queries
    if (query.includes('SELECT')) {
      return Promise.resolve([]);
    }
    if (query.includes('INSERT')) {
      return Promise.resolve([{ id: `test-${Date.now()}` }]);
    }
    if (query.includes('UPDATE')) {
      return Promise.resolve([{ count: 1 }]);
    }
    if (query.includes('DELETE')) {
      return Promise.resolve([{ count: 1 }]);
    }
    
    return Promise.resolve([]);
  }) as any;
  
  // Create Drizzle instance with mock SQL client
  testDb = drizzle(sql, { schema });
  
  return testDb;
}

/**
 * Sets up the test database with basic schema
 */
export async function setupTestDatabase() {
  const db = createTestDatabase();
  
  // Set up basic mock responses for schema operations
  setupMockResponses(db);
  
  return db;
}

/**
 * Sets up mock responses for common database operations
 */
function setupMockResponses(db: PostgresJsDatabase) {
  // Mock user operations
  const mockUser = {
    id: "test-user-123",
    email: "test@example.com",
    username: "testuser",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$mock_hash",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  const mockPhoto = {
    id: "test-photo-123",
    userId: "test-user-123",
    uri: "/test/photo.jpg",
    filename: "photo.jpg",
    width: 1920,
    height: 1080,
    fileSize: 1024000,
    mimeType: "image/jpeg",
    isFavorite: false,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
  
  const mockAlbum = {
    id: "test-album-123",
    userId: "test-user-123",
    title: "Test Album",
    description: "A test album",
    coverPhotoUri: null,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
  };
  
  // Configure mock responses based on query patterns
  const originalSql = sql;
  vi.mocked(sql).mockImplementation((query: string, params?: any[]) => {
    // User queries
    if (query.includes('users') && query.includes('WHERE') && params?.[0]) {
      if (params[0] === mockUser.id || params[0] === mockUser.email) {
        return Promise.resolve([mockUser]);
      }
      return Promise.resolve([]);
    }
    
    // Photo queries
    if (query.includes('photos') && query.includes('WHERE') && params?.[0]) {
      if (params[0] === mockUser.id) {
        return Promise.resolve([mockPhoto]);
      }
      return Promise.resolve([]);
    }
    
    // Album queries
    if (query.includes('albums') && query.includes('WHERE') && params?.[0]) {
      if (params[0] === mockUser.id) {
        return Promise.resolve([mockAlbum]);
      }
      return Promise.resolve([]);
    }
    
    // Default responses
    return originalSql(query, params);
  });
}

/**
 * Cleans up the test database
 */
export function cleanupTestDatabase() {
  vi.clearAllMocks();
}

/**
 * Test database setup helper for Vitest
 */
export function setupTestDbHelper() {
  let db: PostgresJsDatabase;
  
  beforeEach(async () => {
    db = await setupTestDatabase();
  });
  
  afterEach(() => {
    cleanupTestDatabase();
  });
  
  return () => db;
}

/**
 * Mock the database module to use test database
 */
export function mockDatabaseWithTestDb() {
  vi.mock("../db", () => {
    let db: PostgresJsDatabase;
    
    return {
      db: new Proxy({}, {
        get(target, prop) {
          if (!db) {
            db = createTestDatabase();
          }
          return db[prop as keyof typeof db];
        }
      }),
      isDbConfigured: true,
    };
  });
}

// Export schema for test data creation
export { schema };
