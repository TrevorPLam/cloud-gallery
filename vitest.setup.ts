import { vi } from "vitest";

// Mock React Native modules
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
    select: (obj: any) => obj.ios || obj.default,
  },
  StyleSheet: {
    create: (styles: any) => styles,
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
  PixelRatio: {
    get: () => 2,
  },
  AppRegistry: {
    registerComponent: vi.fn(),
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

// Mock React Query
global.fetch = vi.fn();
