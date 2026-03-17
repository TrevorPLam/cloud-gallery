// Async testing utilities for better TypeScript support
import { vi } from 'vitest';

// Export types for better TypeScript support
export type AsyncMock<T> = T & {
  [K in keyof T]: T[K] extends (...args: any[]) => any 
    ? vi.MockedFunction<T[K]>
    : T[K];
};

export type AsyncService<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any 
    ? vi.MockedFunction<any>
    : T[K];
};
