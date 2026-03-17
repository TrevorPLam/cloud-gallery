/**
 * Async Testing Utilities
 * 
 * Purpose: Provide standardized async testing patterns for consistent test execution
 * Inputs: Test functions, assertions, timeout values
 * Outputs: Reliable async test utilities with proper error handling
 * Invariants: All utilities handle timeouts and cleanup properly
 */

import { vi, waitFor } from 'vitest';
import { act } from '@testing-library/react';

/**
 * Wait for an async assertion to complete with proper timeout handling
 * @param assertion - Async assertion function
 * @param timeout - Maximum time to wait (default 5000ms)
 * @returns Promise that resolves when assertion passes
 */
export const waitForAsync = async <T>(
  assertion: () => Promise<T>,
  timeout: number = 5000
): Promise<T> => {
  try {
    return await waitFor(assertion, { timeout });
  } catch (error) {
    // Enhance error message with timeout information
    const enhancedError = new Error(
      `Async assertion timed out after ${timeout}ms: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
    enhancedError.cause = error;
    throw enhancedError;
  }
};

/**
 * Execute a test function with fake timers enabled
 * @param testFn - Test function to execute with fake timers
 * @returns Promise that resolves when test completes
 */
export const withFakeTimers = async <T>(testFn: () => Promise<T>): Promise<T> => {
  // Use vi.useFakeTimers() for Vitest compatibility
  vi.useFakeTimers();
  
  try {
    const result = await testFn();
    
    // Advance timers to resolve any pending promises
    await act(async () => {
      vi.runAllTimersAsync();
    });
    
    return result;
  } finally {
    // Always restore real timers
    vi.useRealTimers();
  }
};

/**
 * Create an async mock with proper Promise handling
 * @param implementation - Mock implementation
 * @returns Enhanced async mock with proper Promise handling
 */
export const createAsyncMock = <T extends Record<string, any>>(
  implementation: Partial<T> = {}
): T => {
  const mock = {} as T;
  
  for (const [key, value] of Object.entries(implementation)) {
    if (typeof value === 'function') {
      // Wrap functions to return Promises if they don't already
      mock[key as keyof T] = ((...args: any[]) => {
        const result = value(...args);
        return result instanceof Promise ? result : Promise.resolve(result);
      }) as T[keyof T];
    } else {
      mock[key as keyof T] = value;
    }
  }
  
  return mock;
};

/**
 * Wait for multiple async operations to complete
 * @param operations - Array of async operations
 * @param timeout - Maximum time to wait for all operations (default 5000ms)
 * @returns Promise that resolves when all operations complete
 */
export const waitForAllAsync = async <T>(
  operations: Array<() => Promise<T>>,
  timeout: number = 5000
): Promise<T[]> => {
  return waitForAsync(
    async () => Promise.all(operations.map(op => op())),
    timeout
  );
};

/**
 * Create a mock database operation with proper async handling
 * @param data - Mock data to return
 * @param delay - Optional delay in milliseconds (default 0)
 * @returns Mock database operation function
 */
export const createMockDbOperation = <T>(
  data: T,
  delay: number = 0
): (() => Promise<T>) => {
  return async () => {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    return data;
  };
};

/**
 * Execute an operation with retry logic for flaky async operations
 * @param operation - Async operation to retry
 * @param maxRetries - Maximum number of retries (default 3)
 * @param delay - Delay between retries in milliseconds (default 100)
 * @returns Promise that resolves when operation succeeds or retries exhausted
 */
export const withRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 100
): Promise<T> => {
  let lastError: Error | unknown;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw new Error(
          `Operation failed after ${maxRetries} attempts. Last error: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError;
};

/**
 * Create a mock async service with consistent behavior
 * @param methods - Service methods to mock
 * @returns Mock service with async methods
 */
export const createMockAsyncService = <T extends Record<string, any>>(
  methods: {
    [K in keyof T]: T[K] extends (...args: any[]) => any 
      ? (...args: Parameters<T[K]>) => Promise<Awaited<ReturnType<T[K]>>>
      : T[K];
  }
): T => {
  const mock = {} as T;
  
  for (const [key, value] of Object.entries(methods)) {
    if (typeof value === 'function') {
      mock[key as keyof T] = vi.fn().mockImplementation(value) as T[keyof T];
    } else {
      mock[key as keyof T] = value;
    }
  }
  
  return mock;
};

/**
 * Utility to test that an async operation rejects with expected error
 * @param operation - Async operation that should reject
 * @param expectedError - Expected error message or error instance
 * @returns Promise that resolves if rejection matches expectation
 */
export const expectAsyncRejection = async (
  operation: () => Promise<any>,
  expectedError: string | Error | RegExp
): Promise<void> => {
  try {
    await operation();
    throw new Error('Expected operation to reject, but it resolved');
  } catch (error) {
    if (error instanceof Error) {
      if (expectedError instanceof Error) {
        if (error.message !== expectedError.message) {
          throw new Error(`Expected error message "${expectedError.message}", got "${error.message}"`);
        }
      } else if (typeof expectedError === 'string') {
        if (!error.message.includes(expectedError)) {
          throw new Error(`Expected error message to include "${expectedError}", got "${error.message}"`);
        }
      } else if (expectedError instanceof RegExp) {
        if (!expectedError.test(error.message)) {
          throw new Error(`Expected error message to match ${expectedError}, got "${error.message}"`);
        }
      }
    } else {
      throw new Error(`Expected Error instance, got ${typeof error}`);
    }
  }
};

// Export types for better TypeScript support
export type AsyncMock<T> = T & {
  [K in keyof T]: T[K] extends (...args: any[]) => any 
    ? vi.MockedFunction<T[K]>
    : T[K];
};

export type AsyncService<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends (...args: any[]) => any 
    ? vi.MockedFunction<(...args: Parameters<T[K]>) => Promise<Awaited<ReturnType<T[K]>>>
    : T[K];
};
