// AI-META-BEGIN
// AI-META: Stack navigator for Photos tab with branded header title
// OWNERSHIP: client/navigation (photos flow)
// ENTRYPOINTS: Rendered by MainTabNavigator PhotosTab
// DEPENDENCIES: @react-navigation/native-stack, useScreenOptions hook, HeaderTitle
// DANGER: None - simple single-screen stack
// CHANGE-SAFETY: Safe to modify; header title uses custom component
// TESTS: Verify navigation renders, check header title displays correctly
// AI-META-END

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import PhotosScreen from "@/screens/PhotosScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type PhotosStackParamList = {
  Photos: undefined;
};

const Stack = createNativeStackNavigator<PhotosStackParamList>();

export default function PhotosStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Photos"
        component={PhotosScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Photo Vault" />,
        }}
      />
    </Stack.Navigator>
  );
}
