// AI-META-BEGIN
// AI-META: Stack navigator for Search tab with hidden header
// OWNERSHIP: client/navigation (search flow)
// ENTRYPOINTS: Rendered by MainTabNavigator SearchTab
// DEPENDENCIES: @react-navigation/native-stack, useScreenOptions hook
// DANGER: None - simple single-screen stack
// CHANGE-SAFETY: Safe to modify; header hidden as search has custom top bar
// TESTS: Verify navigation renders, check header correctly hidden
// AI-META-END

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SearchScreen from "@/screens/SearchScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type SearchStackParamList = {
  Search: undefined;
};

const Stack = createNativeStackNavigator<SearchStackParamList>();

export default function SearchStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
