import { vi } from "vitest";

export const db = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue(Promise.resolve([])),
        limit: vi.fn().mockReturnValue(Promise.resolve([])),
        execute: vi.fn().mockResolvedValue([]),
      }),
      execute: vi.fn().mockResolvedValue([]),
    }),
    execute: vi.fn().mockResolvedValue([]),
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue([{ id: "test-id" }]),
      }),
      execute: vi.fn().mockResolvedValue([{ id: "test-id" }]),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        execute: vi.fn().mockResolvedValue(undefined),
        returning: vi.fn().mockReturnValue({
          execute: vi.fn().mockResolvedValue([]),
        }),
      }),
      execute: vi.fn().mockResolvedValue(undefined),
    }),
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      execute: vi.fn().mockResolvedValue(undefined),
    }),
  }),
};
