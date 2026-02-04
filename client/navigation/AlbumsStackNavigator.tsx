// AI-META-BEGIN
// AI-META: Stack navigator for Albums tab with single screen
// OWNERSHIP: client/navigation (albums flow)
// ENTRYPOINTS: Rendered by MainTabNavigator AlbumsTab
// DEPENDENCIES: @react-navigation/native-stack, useScreenOptions hook
// DANGER: None - simple single-screen stack
// CHANGE-SAFETY: Safe to modify; adding screens requires param list update
// TESTS: Verify navigation renders, check header options apply correctly
// AI-META-END

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import AlbumsScreen from "@/screens/AlbumsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type AlbumsStackParamList = {
  Albums: undefined;
};

const Stack = createNativeStackNavigator<AlbumsStackParamList>();

export default function AlbumsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Albums"
        component={AlbumsScreen}
        options={{
          headerTitle: "Albums",
        }}
      />
    </Stack.Navigator>
  );
}
