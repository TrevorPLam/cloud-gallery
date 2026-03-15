import { vi } from "vitest";
import "@testing-library/jest-dom";

// Use plain (non-encrypted) storage in tests so client/lib/storage.test.ts does not need SecureStore
if (typeof process !== "undefined") {
  process.env.EXPO_PUBLIC_USE_ENCRYPTED_STORAGE = "false";
  process.env.EXPO_PUBLIC_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN ?? "test.example.com";
}

// Expo/React Native globals
(globalThis as unknown as { __DEV__?: boolean }).__DEV__ = false;

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

// Mock expo-secure-store (used by client/lib/secure-storage)
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
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

// Mock expo-blur
vi.mock("expo-blur", () => ({
  BlurView: ({ children, ...props }: any) => {
    const React = require("react");
    const { View } = require("react-native");
    return React.createElement(View, props, children);
  },
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

// Mock react-native-reanimated (native code fails to parse in Node; provides no-op animations)
vi.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    default: {
      createAnimatedComponent: (Component: any) => Component,
      View,
      Text: View,
      ScrollView: View,
      FlatList: View,
      Image: View,
    },
    useAnimatedStyle: () => ({}),
    useSharedValue: (v: number) => ({ value: v }),
    withSpring: (v: number) => v,
    withTiming: (v: number) => v,
    WithSpringConfig: {},
    FadeIn: {},
    FadeOut: {},
    SlideInRight: {},
    SlideOutLeft: {},
    LinearTransition: {},
    Layout: {},
  };
});

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

// Mock chrono library for date parsing
vi.mock("chrono", () => ({
  parse: vi.fn(() => []),
}));

// Performance polyfill for tests
Object.defineProperty(global, 'performance', {
  writable: true,
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
  },
});
