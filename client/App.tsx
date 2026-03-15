// AI-META-BEGIN
// AI-META: Root React Native application component with provider setup
// OWNERSHIP: client/root
// ENTRYPOINTS: main entry point for React Native app via client/index.js
// DEPENDENCIES: react-navigation (navigation), react-query (data fetching), react-native-keyboard-controller, react-native-gesture-handler, ErrorBoundary
// DANGER: provider order matters (SafeAreaProvider must wrap GestureHandler); removing providers will break nested components
// CHANGE-SAFETY: safe to add new providers inside QueryClientProvider; do not reorder existing providers; StatusBar style can be changed
// TESTS: check:types, expo:dev for runtime validation
// AI-META-END

import React from "react";
import { StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import { AuthProvider } from "@/contexts/AuthContext";
import NavigatorSwitch from "@/navigation/NavigatorSwitch";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// AI-NOTE: Provider nesting order ensures gesture handlers and keyboard are available throughout navigation tree
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root}>
            <KeyboardProvider>
              <NavigationContainer>
                <AuthProvider>
                  <NavigatorSwitch />
                </AuthProvider>
              </NavigationContainer>
              <StatusBar style="auto" />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
