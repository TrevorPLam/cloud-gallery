// AI-META-BEGIN
// AI-META: Root stack navigator with tab navigator and modal screens
// OWNERSHIP: client/navigation (app root)
// ENTRYPOINTS: Rendered by App root component
// DEPENDENCIES: @react-navigation/native-stack, MainTabNavigator, detail screens
// DANGER: PhotoDetail uses fullScreenModal; param types must match route usage
// CHANGE-SAFETY: Safe to add screens; param list critical for type safety
// TESTS: Test navigation between tabs and modals, verify modal presentations
// AI-META-END

import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import PhotoDetailScreen from "@/screens/PhotoDetailScreen";
import AlbumDetailScreen from "@/screens/AlbumDetailScreen";
import EditPhotoScreen from "@/screens/EditPhotoScreen";
import DuplicatesScreen from "@/screens/DuplicatesScreen";
import TrashScreen from "@/screens/TrashScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RootStackParamList = {
  Main: undefined;
  PhotoDetail: { photoId: string; initialIndex: number };
  AlbumDetail: { albumId: string; albumTitle: string };
  EditPhoto: { photoId: string; initialUri: string };
  Duplicates: undefined;
  Trash: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Main"
        component={MainTabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PhotoDetail"
        component={PhotoDetailScreen}
        options={{
          headerShown: false,
          // AI-NOTE: Full screen modal for immersive photo viewing experience
          presentation: "fullScreenModal",
          animation: "fade",
        }}
      />
      <Stack.Screen
        name="AlbumDetail"
        component={AlbumDetailScreen}
        options={{
          headerTitle: "Album",
        }}
      />
      <Stack.Screen
        name="EditPhoto"
        component={EditPhotoScreen}
        options={{
          headerShown: false,
          presentation: "modal", // Full screen modal for editing
        }}
      />
      <Stack.Screen
        name="Duplicates"
        component={DuplicatesScreen}
        options={{
          headerTitle: "Duplicates",
        }}
      />
      <Stack.Screen
        name="Trash"
        component={TrashScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}
