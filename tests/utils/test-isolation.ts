// AI-META-BEGIN
// AI-META: Test isolation utilities to prevent test interference
// OWNERSHIP: tests/utils
// ENTRYPOINTS: Imported by test setup and individual test files
// DEPENDENCIES: vitest, typescript
// DANGER: Must properly clean up state between tests
// CHANGE-SAFETY: Add new isolation utilities as needed
// TESTS: Used throughout test suite
// AI-META-END

// Test isolation utilities
// Provides utilities to ensure tests don't interfere with each other

import { vi, afterEach, beforeEach } from 'vitest';

// Global test state cleanup
interface TestState {
  mockCalls: Map<string, number>;
  timers: NodeJS.Timeout[];
  intervals: NodeJS.Timeout[];
  eventListeners: Map<string, EventListener[]>;
  consoleLogs: string[];
}

const testState: TestState = {
  mockCalls: new Map(),
  timers: [],
  intervals: [],
  eventListeners: new Map(),
  consoleLogs: [],
};

/**
 * Reset all test state before each test
 */
export const resetTestState = () => {
  // Clear all mocks
  vi.clearAllMocks();
  
  // Clear timers
  testState.timers.forEach(timer => clearTimeout(timer));
  testState.timers = [];
  
  testState.intervals.forEach(interval => clearInterval(interval));
  testState.intervals = [];
  
  // Clear event listeners
  testState.eventListeners.forEach((listeners, event) => {
    listeners.forEach(listener => {
      window.removeEventListener(event, listener);
    });
  });
  testState.eventListeners.clear();
  
  // Reset console
  testState.consoleLogs = [];
  
  // Reset mock call tracking
  testState.mockCalls.clear();
};

/**
 * Setup test isolation for a test file
 */
export const setupTestIsolation = () => {
  beforeEach(() => {
    resetTestState();
  });
  
  afterEach(() => {
    resetTestState();
  });
};

/**
 * Track mock calls for debugging
 */
export const trackMockCall = (mockName: string) => {
  const current = testState.mockCalls.get(mockName) || 0;
  testState.mockCalls.set(mockName, current + 1);
};

/**
 * Get mock call statistics
 */
export const getMockCallStats = () => {
  return Object.fromEntries(testState.mockCalls);
};

/**
 * Mock localStorage with isolation
 */
export const createMockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
      trackMockCall('localStorage.setItem');
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
      trackMockCall('localStorage.removeItem');
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
      trackMockCall('localStorage.clear');
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
};

/**
 * Mock sessionStorage with isolation
 */
export const createMockSessionStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
      trackMockCall('sessionStorage.setItem');
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
      trackMockCall('sessionStorage.removeItem');
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
      trackMockCall('sessionStorage.clear');
    }),
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
    get length() {
      return Object.keys(store).length;
    },
  };
};

/**
 * Mock fetch with isolation
 */
export const createMockFetch = () => {
  const responses: Map<string, any> = new Map();
  
  const mockFetch = vi.fn(async (url: string, options?: RequestInit) => {
    trackMockCall('fetch');
    
    const key = `${url}:${JSON.stringify(options || {})}`;
    const response = responses.get(key);
    
    if (response) {
      return new Response(JSON.stringify(response.body), {
        status: response.status || 200,
        headers: response.headers || {},
      });
    }
    
    // Default response
    return new Response(JSON.stringify({}), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  
  mockFetch.setResponse = (url: string, response: any, options?: RequestInit) => {
    const key = `${url}:${JSON.stringify(options || {})}`;
    responses.set(key, response);
  };
  
  mockFetch.clearResponses = () => {
    responses.clear();
  };
  
  return mockFetch;
};

/**
 * Mock console with isolation
 */
export const createMockConsole = () => {
  const logs: string[] = [];
  
  const mockConsole = {
    log: vi.fn((...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      logs.push(`[LOG] ${message}`);
      trackMockCall('console.log');
    }),
    error: vi.fn((...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      logs.push(`[ERROR] ${message}`);
      trackMockCall('console.error');
    }),
    warn: vi.fn((...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      logs.push(`[WARN] ${message}`);
      trackMockCall('console.warn');
    }),
    info: vi.fn((...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ');
      logs.push(`[INFO] ${message}`);
      trackMockCall('console.info');
    }),
    getLogs: () => logs.slice(),
    clearLogs: () => logs.length = 0,
  };
  
  return mockConsole;
};

/**
 * Setup global mocks with isolation
 */
export const setupGlobalMocks = () => {
  // Setup localStorage mock
  const localStorageMock = createMockLocalStorage();
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });
  
  // Setup sessionStorage mock
  const sessionStorageMock = createMockSessionStorage();
  Object.defineProperty(window, 'sessionStorage', {
    value: sessionStorageMock,
    writable: true,
  });
  
  // Setup fetch mock
  const fetchMock = createMockFetch();
  global.fetch = fetchMock;
  
  // Setup console mock
  const consoleMock = createMockConsole();
  global.console = { ...console, ...consoleMock };
  
  return {
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    fetch: fetchMock,
    console: consoleMock,
  };
};

/**
 * Clean up global mocks
 */
export const cleanupGlobalMocks = () => {
  // Restore original implementations
  if (typeof window !== 'undefined') {
    delete (window as any).localStorage;
    delete (window as any).sessionStorage;
  }
  
  delete (global as any).fetch;
  delete (global as any).console;
};

/**
 * Create isolated test context
 */
export const createTestContext = () => {
  const context = {
    mocks: new Map<string, any>(),
    state: new Map<string, any>(),
    cleanup: () => {
      // Clean up all mocks in context
      context.mocks.forEach((mock, name) => {
        if (mock.mockReset) {
          mock.mockReset();
        }
      });
      context.mocks.clear();
      context.state.clear();
    },
  };
  
  return context;
};

// Export test isolation utilities
export const TestIsolation = {
  resetTestState,
  setupTestIsolation,
  trackMockCall,
  getMockCallStats,
  createMockLocalStorage,
  createMockSessionStorage,
  createMockFetch,
  createMockConsole,
  setupGlobalMocks,
  cleanupGlobalMocks,
  createTestContext,
};

export default TestIsolation;
