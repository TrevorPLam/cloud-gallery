// AI-META-BEGIN
// AI-META: Mock helper utilities for server route tests
// OWNERSHIP: tests/utils
// ENTRYPOINTS: Imported by server test files
// DEPENDENCIES: vitest, typescript
// DANGER: Must match real module interfaces exactly
// CHANGE-SAFETY: Update mocks when real interfaces change
// TESTS: Used throughout server test suite
// AI-META-END

// Mock helper utilities for server tests
// Provides consistent mocking patterns for database, auth, and other dependencies

import { vi } from 'vitest';

/**
 * Create mock database with proper chain structure
 */
export const createMockDb = () => {
  const mockData = {
    albums: [] as any[],
    albumPhotos: [] as any[],
    photos: [] as any[],
  };

  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  // Helper to rebuild mock chains
  const rewireMocks = () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue(Promise.resolve([...mockData.albums])),
          limit: vi.fn().mockReturnValue(Promise.resolve([...mockData.albums])),
          execute: vi.fn().mockReturnValue(Promise.resolve([...mockData.albums])),
        }),
        execute: vi.fn().mockReturnValue(Promise.resolve([...mockData.albums])),
      }),
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation((data) => {
          const newItem = { ...data, id: data.id || `new-${Date.now()}` };
          if (data.title) mockData.albums.push(newItem);
          return Promise.resolve([newItem]);
        }),
        execute: vi.fn().mockImplementation((data) => {
          const newItem = { ...data, id: data.id || `new-${Date.now()}` };
          if (data.title) mockData.albums.push(newItem);
          return Promise.resolve([{ id: newItem.id }]);
        }),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockReturnValue(Promise.resolve([])),
        }),
      }),
    });

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    });
  };

  rewireMocks();

  return {
    mockDb,
    mockData,
    rewireMocks,
    resetData: () => {
      mockData.albums.length = 0;
      mockData.albumPhotos.length = 0;
      mockData.photos.length = 0;
      vi.clearAllMocks();
      rewireMocks();
    },
  };
};

/**
 * Create mock authentication middleware
 */
export const createMockAuth = () => ({
  authenticateToken: vi.fn((req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token === "valid-token") {
      req.user = { id: "user123", email: "test@example.com" };
      next();
    } else if (token === "other-user-token") {
      req.user = { id: "user456", email: "other@example.com" };
      next();
    } else if (token && token.startsWith("mock_token_")) {
      try {
        const payload = JSON.parse(token.slice(11));
        req.user = payload;
        next();
      } catch {
        return res.status(401).json({
          error: "User not authenticated",
        });
      }
    } else {
      return res.status(401).json({
        error: "User not authenticated",
      });
    }
  }),
});

/**
 * Create mock JWT module
 */
export const createMockJWT = () => ({
  default: {
    sign: vi.fn((payload, secret) => `mock_token_${JSON.stringify(payload)}`),
    verify: vi.fn((token, secret) => {
      if (token.startsWith("mock_token_")) {
        return JSON.parse(token.slice(11));
      }
      if (token === "valid-token") {
        return { id: "user123", email: "test@example.com" };
      } else if (token === "other-user-token") {
        return { id: "user456", email: "other@example.com" };
      }
      return { id: "user123", email: "test@example.com" };
    }),
  },
});

/**
 * Create mock security module
 */
export const createMockSecurity = () => ({
  verifyAccessToken: vi.fn((token) => {
    if (token === "valid-token") {
      return { id: "user123", email: "test@example.com" };
    } else if (token === "other-user-token") {
      return { id: "user456", email: "other@example.com" };
    }
    return { id: "user123", email: "test@example.com" };
  }),
  generateAccessToken: vi.fn(() => "mock_access_token"),
  JWT_SECRET: "test_secret",
});

/**
 * Create mock schema
 */
export const createMockSchema = () => ({
  albums: {
    id: "id",
    userId: "userId",
    title: "title",
    description: "description",
    coverPhotoUri: "coverPhotoUri",
    createdAt: "createdAt",
    modifiedAt: "modifiedAt",
  },
  albumPhotos: {
    albumId: "albumId",
    photoId: "photoId",
    position: "position",
    addedAt: "addedAt",
  },
  photos: {
    id: "id",
    userId: "userId",
    uri: "uri",
  },
  insertAlbumSchema: {
    parse: vi.fn((data) => data),
    partial: vi.fn(() => ({
      parse: vi.fn((data) => data),
    })),
  },
});

/**
 * Mock factory for database module - safe for vi.mock
 */
export const mockDbFactory = () => {
  // Create fresh mocks inside the factory to avoid import issues
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  const mockData = {
    albums: [] as any[],
    albumPhotos: [] as any[],
    photos: [] as any[],
  };

  const rewireMocks = () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue(Promise.resolve([...mockData.albums])),
          limit: vi.fn().mockReturnValue(Promise.resolve([...mockData.albums])),
          execute: vi.fn().mockReturnValue(Promise.resolve([...mockData.albums])),
        }),
        execute: vi.fn().mockReturnValue(Promise.resolve([...mockData.albums])),
      }),
    });

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation((data) => {
          const newItem = { ...data, id: data.id || `new-${Date.now()}` };
          if (data.title) mockData.albums.push(newItem);
          return Promise.resolve([newItem]);
        }),
        execute: vi.fn().mockImplementation((data) => {
          const newItem = { ...data, id: data.id || `new-${Date.now()}` };
          if (data.title) mockData.albums.push(newItem);
          return Promise.resolve([{ id: newItem.id }]);
        }),
      }),
    });

    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue(undefined),
          returning: vi.fn().mockReturnValue(Promise.resolve([])),
        }),
      }),
    });

    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
      }),
    });
  };

  rewireMocks();

  // Expose the mock data for test manipulation
  (global as any).__mockDbData = mockData;
  (global as any).__rewireDbMocks = rewireMocks;

  return { db: mockDb };
};

/**
 * Mock factory for JWT module - safe for vi.mock
 */
export const mockJWTFactory = () => createMockJWT();

/**
 * Mock factory for security module - safe for vi.mock
 */
export const mockSecurityFactory = () => createMockSecurity();

/**
 * Mock factory for schema module - safe for vi.mock
 */
export const mockSchemaFactory = () => createMockSchema();

export default {
  createMockDb,
  createMockAuth,
  createMockJWT,
  createMockSecurity,
  createMockSchema,
  mockDbFactory,
  mockJWTFactory,
  mockSecurityFactory,
  mockSchemaFactory,
};
