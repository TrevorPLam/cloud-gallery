/**
 * Reusable Drizzle-style DB mock for server tests.
 * Supports select().from().where().orderBy().limit(),
 * insert().values().returning(), update().set().where(), delete().where().
 */
import { vi } from "vitest";

export function createSelectChain(resolved: unknown[] = []) {
  const limitFn = vi.fn(() => Promise.resolve(resolved));
  const orderByFn = vi.fn(() =>
    Object.assign(Promise.resolve(resolved), { limit: limitFn }),
  );
  const groupByFn = vi.fn(() => Promise.resolve(resolved));
  const whereReturn = Object.assign(Promise.resolve(resolved), {
    limit: limitFn,
    orderBy: orderByFn,
    groupBy: groupByFn,
  });
  const innerJoinWhereReturn = Object.assign(Promise.resolve(resolved), {
    orderBy: orderByFn,
    limit: limitFn,
  });
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => whereReturn),
      innerJoin: vi.fn(() => ({
        where: vi.fn(() => innerJoinWhereReturn),
      })),
    })),
  };
}

export function createInsertChain(returning: unknown[] = []) {
  return {
    values: vi.fn(() => ({
      returning: vi.fn(() => Promise.resolve(returning)),
    })),
  };
}

export function createUpdateChain() {
  return {
    set: vi.fn(() => ({
      where: vi.fn(() => Promise.resolve([])),
    })),
  };
}

export function createDeleteChain() {
  return {
    where: vi.fn(() => Promise.resolve([])),
  };
}

/**
 * Build a full mock db object. Use in vi.mock("../db", () => ({ db: createMockDb() }))
 * or in beforeEach: Object.assign(mockDb, createMockDb()) after clearing mocks.
 */
export function createMockDb(
  options: {
    selectResolved?: unknown[];
    insertReturning?: unknown[];
  } = {},
) {
  const { selectResolved = [], insertReturning = [] } = options;
  return {
    select: vi.fn(() => createSelectChain(selectResolved as unknown[])),
    insert: vi.fn(() => createInsertChain(insertReturning as unknown[])),
    update: vi.fn(() => createUpdateChain()),
    delete: vi.fn(() => createDeleteChain()),
  };
}
