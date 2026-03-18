import { vi, expect, afterEach, beforeEach } from "vitest";
// import "@testing-library/jest-dom";
import "vitest-axe/extend-expect";
import { setupTestIsolation, setupGlobalMocks } from "./tests/utils/test-isolation";

// Setup test isolation
setupTestIsolation();

// Only setup browser-dependent mocks (including mock fetch) in browser-like environments.
// Contract tests use // @vitest-environment node and need real HTTP fetch for Pact mock servers.
if (typeof window !== "undefined") {
  setupGlobalMocks();
}

// Use plain (non-encrypted) storage in tests so client/lib/storage.test.ts does not need SecureStore
if (typeof process !== "undefined") {
  process.env.EXPO_PUBLIC_USE_ENCRYPTED_STORAGE = "false";
  process.env.EXPO_PUBLIC_DOMAIN =
    process.env.EXPO_PUBLIC_DOMAIN ?? "test.example.com";
}

// Expo/React Native globals
(globalThis as unknown as { __DEV__?: boolean }).__DEV__ = false;

// Mock React Native modules with TV compatibility
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: (obj: any) => obj.ios || obj.default,
    isTV: false, // TV detection
    isPad: false, // iPad detection
    constants: {
      Version: "14.0",
      systemName: "iOS",
      model: "iPhone",
    },
  },
  StyleSheet: {
    create: (styles: any) => styles,
    flatten: (style: any) => style,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  PixelRatio: {
    get: () => 2,
    getFontScale: () => 1,
    getPixelSizeForLayoutSize: vi.fn((size) => size * 2),
  },
  AppRegistry: {
    registerComponent: vi.fn(),
    unregisterComponent: vi.fn(),
    runApplication: vi.fn(),
  },
  // TV-specific additions
  TVEventHandler: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
  NavigationExperimental: {
    StackNavigator: vi.fn(),
    TabNavigator: vi.fn(),
  },
}));

// Mock AsyncStorage
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    multiRemove: vi.fn(),
    clear: vi.fn(),
  },
}));

// Mock expo-secure-store (used by client/lib/secure-storage)
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
}));

// Mock expo-local-authentication (used by biometric auth)
vi.mock("expo-local-authentication", () => ({
  hasHardwareAsync: vi.fn(),
  isEnrolledAsync: vi.fn(),
  supportedAuthenticationTypesAsync: vi.fn(),
  authenticateAsync: vi.fn(),
  cancelAuthenticate: vi.fn(),
  getEnrolledLevelAsync: vi.fn(),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

// Mock Expo modules
vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      name: "Cloud Gallery",
    },
  },
}));

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
}));

vi.mock("expo-image", () => ({
  Image: "Image",
}));

// Mock Expo modules that are missing in test environment
vi.mock("expo-document-picker", () => ({
  getDocumentAsync: vi.fn(),
  pickDocument: vi.fn(),
}));

vi.mock("@lodev09/react-native-exify", () => ({
  default: {
    getExif: vi.fn(),
    getTags: vi.fn(),
  },
}));

vi.mock("react-native-zip-archive", () => ({
  unzip: vi.fn(),
  zip: vi.fn(),
}));

// Mock ML model files
vi.mock("../client/assets/models/clip-vit-b-32.tflite", () => ({
  default: "mock-model-path",
}));

vi.mock("../client/assets/models/blazeface.tflite", () => ({
  default: "mock-blazeface-path",
}));

// Mock @expo/vector-icons
vi.mock("@expo/vector-icons", () => ({
  Feather: ({ name, ...props }: any) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, props, name);
  },
  Ionicons: ({ name, ...props }: any) => {
    const React = require("react");
    const { Text } = require("react-native");
    return React.createElement(Text, props, name);
  },
}));

// Mock react-native-gesture-handler
vi.mock("react-native-gesture-handler", () => ({
  PanGestureHandler: ({ children }: any) => children,
  TapGestureHandler: ({ children }: any) => children,
  PinchGestureHandler: ({ children }: any) => children,
  GestureHandlerRootView: ({ children }: any) => children,
  State: {},
  Directions: {},
}));

// Mock ML modules with proper hoisted initialization
const mockTFLiteManager = vi.hoisted(() => {
  // Return a simple mock for now
  return {
    getDeviceCapabilities: vi.fn().mockResolvedValue({
      hasGPU: true,
      hasNPU: false,
      maxMemory: 1024 * 1024 * 1024
    }),
    loadModel: vi.fn().mockResolvedValue(true),
    runInference: vi.fn().mockResolvedValue([]),
    unloadModel: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("react-native-fast-tflite", () => ({
  createMockTFLiteManager: vi.fn().mockReturnValue(mockTFLiteManager),
  TFLiteManager: vi.fn().mockImplementation(() => mockTFLiteManager),
}));

// Mock database module to prevent DATABASE_URL warnings
// Inline the mock factory to avoid path resolution issues during hoisting
vi.mock("./server/db", async () => {
  // Import directly within the mock factory
  const { getMockDatabase } = await import("./server/__mocks__/database");
  return {
    db: getMockDatabase(),
  };
});

// But allow db.test.ts to import the real module by unmocking it in that specific test
vi.hoisted(() => {
  return {
    // This will be used in db.test.ts to bypass the mock
    __unmockDbForTest: false,
  };
});

// Mock face detection
vi.mock("../client/lib/ml/face-detection", () => ({
  detectFaces: vi.fn().mockResolvedValue([]),
  generateEmbedding: vi.fn().mockResolvedValue(new Array(128).fill(0)),
  compareFaces: vi.fn().mockResolvedValue({ similarity: 0.8 }),
}));

// Mock CLIP embeddings
vi.mock("../client/lib/ml/clip-embeddings", () => ({
  embedText: vi.fn().mockResolvedValue(new Array(512).fill(0)),
  embedImage: vi.fn().mockResolvedValue(new Array(512).fill(0)),
  calculateSimilarity: vi.fn().mockReturnValue(0.75),
}));

// Mock adaptive models
vi.mock("../client/lib/ml/adaptive-models", () => ({
  adaptModel: vi.fn().mockResolvedValue({ adaptedModelId: 'test' }),
  evaluateModel: vi.fn().mockResolvedValue({ accuracy: 0.9 }),
  optimizeModel: vi.fn().mockResolvedValue({ optimizedModelId: 'test' }),
}));

// Mock React Navigation
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: vi.fn(),
    goBack: vi.fn(),
    setOptions: vi.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: vi.fn(),
  NavigationContainer: ({ children }: any) => children,
}));

// Mock React Query (only in browser-like environments; contract tests need real fetch)
if (typeof window !== "undefined") {
  global.fetch = vi.fn();
}

// Mock chrono library for date parsing
vi.mock("chrono", () => ({
  parse: vi.fn(() => []),
}));

// Performance polyfill for tests
Object.defineProperty(global, "performance", {
  writable: true,
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
  },
});

// Global cleanup for test isolation
afterEach(() => {
  // Clear all mocks to prevent test interference
  vi.clearAllMocks();
  
  // Reset global state that might cause issues
  if (global.__tracer__) {
    delete global.__tracer__;
  }
  
  // Reset any global timers or intervals
  if (global.__setTimeout__) {
    clearTimeout(global.__setTimeout__);
    delete global.__setTimeout__;
  }
  
  // NOTE: vi.resetModules() intentionally removed from the global afterEach.
  // It clears the entire module registry after every test which forces
  // re-initialization of all 50+ mocks and is extremely slow at scale.
  // Files that need isolated module state (e.g. server/db.test.ts) call
  // vi.resetModules() in their own scoped afterEach / helper functions.
});

// Global setup for consistent test environment
beforeEach(() => {
  // Ensure consistent environment for each test
  process.env.NODE_ENV = "test";
  process.env.EXPO_PUBLIC_USE_ENCRYPTED_STORAGE = "false";
});
