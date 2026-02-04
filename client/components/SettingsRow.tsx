// AI-META-BEGIN
// AI-META: Settings row component with icon, text, optional switch/chevron, and haptics
// OWNERSHIP: client/components (settings UI)
// ENTRYPOINTS: Used in ProfileScreen for all settings options
// DEPENDENCIES: expo-haptics, theme system
// DANGER: Haptics web incompatible; switch/press modes mutually exclusive
// CHANGE-SAFETY: Safe to modify styles; ensure switch/press handling doesn't overlap
// TESTS: Test both switch and press modes, verify haptics, check destructive styling
// AI-META-END

import React from "react";
import { StyleSheet, Pressable, View, Switch, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";

interface SettingsRowProps {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showChevron?: boolean;
  isSwitch?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
  isDestructive?: boolean;
}

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  showChevron = true,
  isSwitch = false,
  switchValue = false,
  onSwitchChange,
  isDestructive = false,
}: SettingsRowProps) {
  const { theme, isDark } = useTheme();

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync();
    }
    onPress?.();
  };

  const handleSwitchChange = (value: boolean) => {
    // AI-NOTE: Light haptic for switch toggle; different from selection/press feedback
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onSwitchChange?.(value);
  };

  const iconColor = isDestructive ? theme.error : theme.textSecondary;
  const textColor = isDestructive ? theme.error : theme.text;

  return (
    <Pressable
      onPress={isSwitch ? undefined : handlePress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: pressed && !isSwitch ? theme.backgroundSecondary : "transparent" },
      ]}
      disabled={isSwitch}
    >
      <View style={[styles.iconContainer, { backgroundColor: theme.backgroundTertiary }]}>
        <Feather name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.content}>
        <ThemedText type="body" style={[styles.title, { color: textColor }]}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText type="small" style={[styles.subtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {isSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={handleSwitchChange}
          trackColor={{ false: theme.border, true: Colors.light.accent }}
          thumbColor="#FFFFFF"
        />
      ) : showChevron ? (
        <Feather name="chevron-right" size={20} color={theme.textSecondary} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    marginBottom: 2,
  },
  subtitle: {
    opacity: 0.7,
  },
});
