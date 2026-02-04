import React from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

interface StorageBarProps {
  usedBytes: number;
  totalBytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function StorageBar({ usedBytes, totalBytes }: StorageBarProps) {
  const { theme } = useTheme();
  const percentage = Math.min((usedBytes / totalBytes) * 100, 100);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={styles.header}>
        <ThemedText type="h4">Storage</ThemedText>
        <ThemedText type="small" style={{ color: theme.textSecondary }}>
          {formatBytes(usedBytes)} of {formatBytes(totalBytes)}
        </ThemedText>
      </View>
      <View style={[styles.barContainer, { backgroundColor: theme.backgroundTertiary }]}>
        <View
          style={[
            styles.barFill,
            {
              width: `${percentage}%`,
              backgroundColor: percentage > 90 ? theme.error : Colors.light.accent,
            },
          ]}
        />
      </View>
      <ThemedText type="small" style={[styles.percentText, { color: theme.textSecondary }]}>
        {percentage.toFixed(1)}% used
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  barContainer: {
    height: 8,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: BorderRadius.full,
  },
  percentText: {
    marginTop: Spacing.sm,
    textAlign: "right",
  },
});
