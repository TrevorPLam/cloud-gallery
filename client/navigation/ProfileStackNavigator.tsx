// AI-META-BEGIN
// AI-META: Stack navigator for Profile tab with single screen
// OWNERSHIP: client/navigation (profile flow)
// ENTRYPOINTS: Rendered by MainTabNavigator ProfileTab
// DEPENDENCIES: @react-navigation/native-stack, useScreenOptions hook
// DANGER: None - simple single-screen stack
// CHANGE-SAFETY: Safe to modify; adding screens requires param list update
// TESTS: Verify navigation renders, check header options apply correctly
// AI-META-END

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "@/screens/ProfileScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ProfileStackParamList = {
  Profile: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerTitle: "Profile",
        }}
      />
    </Stack.Navigator>
  );
}
