// AI-META-BEGIN
// AI-META: Mock database factory for server tests to eliminate DATABASE_URL warnings
// OWNERSHIP: server/__mocks__
// ENTRYPOINTS: Imported by server test files
// DEPENDENCIES: vitest, drizzle-orm types
// DANGER: Must match real database interface exactly
// CHANGE-SAFETY: Update when database schema changes
// TESTS: Used throughout server test suite
// AI-META-END

import { vi } from 'vitest';

// Mock database interface matching Drizzle ORM
export interface MockDatabase {
  select: any;
  insert: any;
  update: any;
  delete: any;
  query: any;
  transaction: any;
}

// Mock data storage
const mockData = {
  users: [] as any[],
  albums: [] as any[],
  photos: [] as any[],
  albumPhotos: [] as any[],
  faces: [] as any[],
  people: [] as any[],
  backups: [] as any[],
  syncDevices: [] as any[],
  sharingLinks: [] as any[],
};

// Create mock database with proper chain methods
export const createMockDatabase = (): MockDatabase => {
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          and: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockReturnValue(Promise.resolve([])),
            }),
            offset: vi.fn().mockReturnValue(Promise.resolve([])),
            execute: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
          offset: vi.fn().mockReturnValue(Promise.resolve([])),
          execute: vi.fn().mockReturnValue(Promise.resolve([])),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
          offset: vi.fn().mockReturnValue(Promise.resolve([])),
          execute: vi.fn().mockReturnValue(Promise.resolve([])),
          groupBy: vi.fn().mockReturnValue({
            having: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue(Promise.resolve([])),
              execute: vi.fn().mockReturnValue(Promise.resolve([])),
            }),
            limit: vi.fn().mockReturnValue(Promise.resolve([])),
            execute: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
          having: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(Promise.resolve([])),
            execute: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
          distinct: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue(Promise.resolve([])),
            execute: vi.fn().mockReturnValue(Promise.resolve([])),
          }),
        }),
        limit: vi.fn().mockReturnValue(Promise.resolve([])),
        offset: vi.fn().mockReturnValue(Promise.resolve([])),
        execute: vi.fn().mockReturnValue(Promise.resolve([])),
      }),
      execute: vi.fn().mockReturnValue(Promise.resolve([])),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation((fields) => {
          const newItem = { 
            id: `mock-${Date.now()}-${Math.random()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...fields
          };
          return Promise.resolve([newItem]);
        }),
        execute: vi.fn().mockImplementation((data) => {
          const newItem = { 
            id: `mock-${Date.now()}-${Math.random()}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...data
          };
          return Promise.resolve([newItem]);
        }),
      }),
      execute: vi.fn().mockReturnValue(Promise.resolve([{ id: 'mock-id' }])),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockReturnValue(Promise.resolve([])),
          execute: vi.fn().mockReturnValue(Promise.resolve({})),
        }),
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockReturnValue(Promise.resolve([])),
        execute: vi.fn().mockReturnValue(Promise.resolve({})),
      }),
    }),
    query: {
      usersTable: {
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'mock-user' }),
      },
    },
    transaction: vi.fn().mockImplementation((callback) => {
      return callback(mockDb);
    }),
  };

  return mockDb;
};

// Factory function for consistent mock creation
export const getMockDatabase = () => {
  const mockDb = createMockDatabase();
  
  // Reset mock data for each test
  Object.keys(mockData).forEach(key => {
    mockData[key as keyof typeof mockData] = [];
  });

  return mockDb;
};

// Helper to setup mock database with test data
export const setupMockDatabase = (data: Partial<typeof mockData> = {}) => {
  Object.assign(mockData, data);
  return createMockDatabase();
};
