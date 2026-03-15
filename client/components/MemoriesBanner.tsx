// AI-META-BEGIN
// AI-META: Memories Banner Component - Banner for displaying "On This Day" memories
// OWNERSHIP: client/components/MemoriesBanner
// ENTRYPOINTS: PhotosScreen, other screens
// DEPENDENCIES: react-native, memories API, theme system
// DANGER: Memory loading can be expensive; implement proper caching
// CHANGE-SAFETY: Safe to modify UI layout; ensure data flow remains intact
// TESTS: client/components/MemoriesBanner.test.tsx (component tests)
// AI-META-END

import React, { useCallback } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  FlatList,
  Dimensions,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/api";
import { Image } from "expo-image";

const { width } = Dimensions.get("window");

interface Memory {
  id: string;
  memoryType: "on_this_day" | "monthly_highlights" | "year_in_review";
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  coverPhotoId?: string;
  photoCount: number;
  isFavorite: boolean;
  isHidden: boolean;
}

interface MemoriesBannerProps {
  onPress: (memory: Memory) => void;
  onDismiss?: () => void;
}

export function MemoriesBanner({ onPress, onDismiss }: MemoriesBannerProps) {
  const { theme } = useTheme();

  // Fetch "On This Day" memories
  const {
    data: memoriesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["on-this-day-memories"],
    queryFn: async () => {
      const response = await apiRequest("/api/memories?type=on_this_day&limit=5");
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: true, // Always try to show memories
  });

  // Filter to only show "On This Day" memories that aren't hidden
  const onThisDayMemories = memoriesData?.memories?.filter(
    (memory: Memory) => memory.memoryType === "on_this_day" && !memory.isHidden
  ) || [];

  // Don't render if loading, error, or no memories
  if (isLoading || error || onThisDayMemories.length === 0) {
    return null;
  }

  // Handle memory press
  const handleMemoryPress = useCallback((memory: Memory) => {
    onPress(memory);
  }, [onPress]);

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    onDismiss?.();
  }, [onDismiss]);

  // Render memory item
  const renderMemoryItem = useCallback(
    ({ item: memory }: { item: Memory }) => {
      const coverPhotoUrl = memory.coverPhotoId
        ? `/api/photos/${memory.coverPhotoId}/thumbnail`
        : null;

      return (
        <TouchableOpacity
          style={[styles.memoryItem, { backgroundColor: theme.card }]}
          onPress={() => handleMemoryPress(memory)}
          activeOpacity={0.8}
        >
          <View style={styles.memoryImageContainer}>
            {coverPhotoUrl ? (
              <Image
                source={{ uri: coverPhotoUrl }}
                style={styles.memoryImage}
                contentFit="cover"
              />
            ) : (
              <View
                style={[
                  styles.memoryImagePlaceholder,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Feather name="clock" size={20} color={theme.textSecondary} />
              </View>
            )}
            <View style={styles.photoCountBadge}>
              <Feather name="image" size={8} color="white" />
              <Text style={styles.photoCountText}>{memory.photoCount}</Text>
            </View>
          </View>
          <View style={styles.memoryContent}>
            <Text
              style={[styles.memoryTitle, { color: theme.text }]}
              numberOfLines={1}
            >
              {memory.title}
            </Text>
            <Text
              style={[styles.memoryDescription, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {memory.description}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [theme, handleMemoryPress]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Feather name="clock" size={16} color={theme.accent} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            On This Day
          </Text>
        </View>
        <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
          <Feather name="x" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={onThisDayMemories}
        renderItem={renderMemoryItem}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.memoriesList}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  dismissButton: {
    padding: Spacing.xs,
    borderRadius: 12,
  },
  memoriesList: {
    paddingRight: Spacing.sm,
  },
  separator: {
    width: Spacing.sm,
  },
  memoryItem: {
    width: 120,
    borderRadius: 8,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  memoryImageContainer: {
    height: 80,
    position: "relative",
  },
  memoryImage: {
    width: "100%",
    height: "100%",
  },
  memoryImagePlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  photoCountBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  photoCountText: {
    color: "white",
    fontSize: 8,
    fontWeight: "600",
  },
  memoryContent: {
    padding: Spacing.xs,
  },
  memoryTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  memoryDescription: {
    fontSize: 10,
    lineHeight: 12,
  },
});
