// AI-META-BEGIN
// AI-META: Platform-aware keyboard scroll wrapper that falls back to ScrollView on web
// OWNERSHIP: client/components (platform compatibility)
// ENTRYPOINTS: Used in any screen with text input fields
// DEPENDENCIES: react-native-keyboard-controller (iOS/Android only)
// DANGER: Web lacks keyboard controller; must conditionally render correct component
// CHANGE-SAFETY: Safe to modify props; Platform check is critical for web builds
// TESTS: Test keyboard behavior on iOS/Android with inputs; verify web scrolling works
// AI-META-END

import { Platform, ScrollView, ScrollViewProps } from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

/**
 * AI-NOTE: Web doesn't support react-native-keyboard-controller library;
 * fallback to standard ScrollView prevents import errors on web platform.
 */
export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  ...props
}: Props) {
  if (Platform.OS === "web") {
    return (
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
