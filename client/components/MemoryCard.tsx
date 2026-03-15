// AI-META-BEGIN
// AI-META: Memory Card Component - Card component for displaying memory information
// OWNERSHIP: client/components/MemoryCard
// ENTRYPOINTS: MemoriesScreen, other memory-related screens
// DEPENDENCIES: react-native, image loading, theme system
// DANGER: Image loading can be expensive; implement proper caching
// CHANGE-SAFETY: Safe to modify UI layout; ensure data flow remains intact
// TESTS: client/components/MemoryCard.test.tsx (component tests)
// AI-META-END

import React, { useState } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  Dimensions,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { Image } from "expo-image";

const { width } = Dimensions.get("window");
const cardWidth = (width - Spacing.md * 3) / 1; // Single column layout

interface MemoryCardProps {
  memory: {
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
    score?: number;
  };
  onPress: () => void;
  onFavoriteToggle: () => void;
  onHideToggle: () => void;
  isLoading?: boolean;
}

export function MemoryCard({
  memory,
  onPress,
  onFavoriteToggle,
  onHideToggle,
  isLoading = false,
}: MemoryCardProps) {
  const { theme } = useTheme();
  const [imageLoaded, setImageLoaded] = useState(false);
  const animatedValue = React.useRef(new Animated.Value(1)).current;

  // Handle press animation
  const handlePressIn = () => {
    Animated.spring(animatedValue, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(animatedValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  // Format date range
  const formatDateRange = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start.toDateString() === end.toDateString()) {
      return start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } else if (start.getFullYear() === end.getFullYear()) {
      return `${start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} - ${end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    } else {
      return `${start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })} - ${end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    }
  };

  // Get memory type icon
  const getMemoryTypeIcon = (type: string) => {
    switch (type) {
      case "on_this_day":
        return "clock";
      case "monthly_highlights":
        return "star";
      case "year_in_review":
        return "calendar";
      default:
        return "image";
    }
  };

  // Get memory type color
  const getMemoryTypeColor = (type: string) => {
    switch (type) {
      case "on_this_day":
        return "#3B82F6"; // Blue
      case "monthly_highlights":
        return "#F59E0B"; // Amber
      case "year_in_review":
        return "#8B5CF6"; // Purple
      default:
        return theme.accent;
    }
  };

  // Construct cover photo URL
  const coverPhotoUrl = memory.coverPhotoId
    ? `/api/photos/${memory.coverPhotoId}/thumbnail`
    : null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ scale: animatedValue }] }]}
    >
      <TouchableOpacity
        style={[
          styles.card,
          {
            backgroundColor: theme.card,
            borderColor: theme.border,
            shadowColor: theme.shadow,
          },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isLoading}
      >
        {/* Cover Image */}
        <View style={styles.imageContainer}>
          {coverPhotoUrl ? (
            <Image
              source={{ uri: coverPhotoUrl }}
              style={styles.coverImage}
              contentFit="cover"
              onLoad={() => setImageLoaded(true)}
            />
          ) : (
            <View
              style={[
                styles.placeholderImage,
                { backgroundColor: theme.backgroundSecondary },
              ]}
            >
              <Feather
                name={getMemoryTypeIcon(memory.memoryType)}
                size={32}
                color={getMemoryTypeColor(memory.memoryType)}
              />
            </View>
          )}

          {/* Memory Type Badge */}
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: getMemoryTypeColor(memory.memoryType) },
            ]}
          >
            <Feather
              name={getMemoryTypeIcon(memory.memoryType)}
              size={12}
              color="white"
            />
          </View>

          {/* Photo Count Badge */}
          <View
            style={[
              styles.photoCountBadge,
              { backgroundColor: "rgba(0,0,0,0.7)" },
            ]}
          >
            <Feather name="image" size={10} color="white" />
            <Text style={styles.photoCountText}>{memory.photoCount}</Text>
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.header}>
            <Text
              style={[styles.title, { color: theme.text }]}
              numberOfLines={1}
            >
              {memory.title}
            </Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  memory.isFavorite && styles.favoriteButton,
                ]}
                onPress={onFavoriteToggle}
                disabled={isLoading}
              >
                <Feather
                  name={memory.isFavorite ? "heart" : "heart"}
                  size={16}
                  color={memory.isFavorite ? "#EF4444" : theme.textSecondary}
                  fill={memory.isFavorite ? "#EF4444" : "none"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  memory.isHidden && styles.hiddenButton,
                ]}
                onPress={onHideToggle}
                disabled={isLoading}
              >
                <Feather
                  name={memory.isHidden ? "eye-off" : "eye"}
                  size={16}
                  color={memory.isHidden ? "#6B7280" : theme.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </View>

          <Text
            style={[styles.description, { color: theme.textSecondary }]}
            numberOfLines={2}
          >
            {memory.description}
          </Text>

          <View style={styles.footer}>
            <Text style={[styles.dateRange, { color: theme.textTertiary }]}>
              {formatDateRange(memory.startDate, memory.endDate)}
            </Text>
            {memory.score && (
              <View style={styles.scoreContainer}>
                <Feather
                  name="trending-up"
                  size={10}
                  color={theme.textTertiary}
                />
                <Text style={[styles.scoreText, { color: theme.textTertiary }]}>
                  {Math.round(memory.score * 100)}%
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: "hidden",
  },
  imageContainer: {
    height: 200,
    position: "relative",
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  typeBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  photoCountBadge: {
    position: "absolute",
    bottom: Spacing.sm,
    right: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  photoCountText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
  content: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  actionButton: {
    padding: Spacing.xs,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  favoriteButton: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  hiddenButton: {
    backgroundColor: "rgba(107, 114, 128, 0.1)",
  },
  description: {
    fontSize: 14,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateRange: {
    fontSize: 12,
    fontWeight: "500",
  },
  scoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  scoreText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
