// AI-META-BEGIN
// AI-META: Header title component with app icon and branded text
// OWNERSHIP: client/components (navigation UI)
// ENTRYPOINTS: Used in PhotosStackNavigator header
// DEPENDENCIES: react-native, theme system, local assets
// DANGER: Asset path must be correct; Image source is require() not URI
// CHANGE-SAFETY: Safe to modify styles; asset path changes require validation
// TESTS: Verify header renders across all platforms, check icon loads correctly
// AI-META-END

import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, Colors } from "@/constants/theme";

interface HeaderTitleProps {
  title: string;
}

export function HeaderTitle({ title }: HeaderTitleProps) {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/icon.png")}
        style={styles.icon}
        resizeMode="contain"
      />
      <ThemedText style={styles.title}>{title}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  icon: {
    width: 28,
    height: 28,
    marginRight: Spacing.sm,
    borderRadius: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
});
