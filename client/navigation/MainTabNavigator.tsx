// AI-META-BEGIN
// AI-META: Bottom tab navigator with blur effect and platform-specific styling
// OWNERSHIP: client/navigation (main tabs)
// ENTRYPOINTS: Rendered by RootStackNavigator Main screen
// DEPENDENCIES: @react-navigation/bottom-tabs, expo-blur, stack navigators
// DANGER: iOS blur requires transparency; Android/web need solid backgrounds
// CHANGE-SAFETY: Safe to add tabs; platform styles critical for proper rendering
// TESTS: Test tab switching, verify blur on iOS, check solid backgrounds on Android/web
// AI-META-END

import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";
import PhotosStackNavigator from "@/navigation/PhotosStackNavigator";
import AlbumsStackNavigator from "@/navigation/AlbumsStackNavigator";
import SearchStackNavigator from "@/navigation/SearchStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { Colors } from "@/constants/theme";

export type MainTabParamList = {
  PhotosTab: undefined;
  AlbumsTab: undefined;
  SearchTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="PhotosTab"
      screenOptions={{
        tabBarActiveTintColor: Colors.light.accent,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          // AI-NOTE: iOS uses transparent tab bar with blur; Android/web need solid color
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          // AI-NOTE: BlurView only renders on iOS; null on Android/web
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="PhotosTab"
        component={PhotosStackNavigator}
        options={{
          title: "Photos",
          tabBarIcon: ({ color, size }) => (
            <Feather name="image" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AlbumsTab"
        component={AlbumsStackNavigator}
        options={{
          title: "Albums",
          tabBarIcon: ({ color, size }) => (
            <Feather name="folder" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="SearchTab"
        component={SearchStackNavigator}
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => (
            <Feather name="search" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
