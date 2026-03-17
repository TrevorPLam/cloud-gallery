// React Native mock for Vitest tests
// This file replaces the actual react-native package to avoid Flow syntax errors

export const Platform = {
  OS: "ios",
  select: (obj: any) => obj.ios || obj.default,
  Version: 15,
};

export const StyleSheet = {
  create: (styles: any) => styles,
  absoluteFill: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  hairlineWidth: 1,
};

export const Dimensions = {
  get: (dim: string) => ({ width: 375, height: 812 }),
  addEventListener: () => ({ remove: () => {} }),
  removeEventListener: () => {},
};

export const PixelRatio = {
  get: () => 2,
  getFontScale: () => 1,
  getPixelSizeForLayoutSize: (size: number) => size,
  roundToNearestPixel: (size: number) => Math.round(size),
};

export const AppRegistry = {
  registerComponent: () => {},
  registerAppConfig: () => {},
  runApplication: () => {},
};

// Mock components
export const View = "View";
export const Text = "Text";
export const Image = "Image";
export const ScrollView = "ScrollView";
export const FlatList = "FlatList";
export const TouchableOpacity = "TouchableOpacity";
export const TouchableHighlight = "TouchableHighlight";
export const TextInput = "TextInput";
export const Button = "Button";
export const ActivityIndicator = "ActivityIndicator";
export const Modal = "Modal";
export const SafeAreaView = "SafeAreaView";
export const StatusBar = "StatusBar";

// Mock APIs
export const Animated = {
  Value: class {
    constructor(value: number) {}
    setValue(value: number) {}
    interpolate(config: any) { return this; }
  },
  View,
  Text,
  Image,
  ScrollView,
  timing: () => ({ start: () => {} }),
  spring: () => ({ start: () => {} }),
  sequence: () => ({ start: () => {} }),
  parallel: () => ({ start: () => {} }),
};

export default {
  Platform,
  StyleSheet,
  Dimensions,
  PixelRatio,
  AppRegistry,
  View,
  Text,
  Image,
  ScrollView,
  FlatList,
  TouchableOpacity,
  TouchableHighlight,
  TextInput,
  Button,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  StatusBar,
  Animated,
};
