// AI-META-BEGIN
// AI-META: Memories Screen - React Native screen for displaying auto-generated memories
// OWNERSHIP: client/screens/MemoriesScreen
// ENTRYPOINTS: Navigation stack
// DEPENDENCIES: react-query, memories API, memory card components
// DANGER: Memory generation can be expensive; implement proper loading states
// CHANGE-SAFETY: Safe to modify UI layout; ensure API integration remains intact
// TESTS: client/screens/MemoriesScreen.test.tsx (component tests)
// AI-META-END

import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { apiRequest } from "@/lib/api";
import { MemoryCard } from "@/components/MemoryCard";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { FabButton } from "@/components/FabButton";

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
  score?: number;
}

interface MemoriesScreenProps {
  navigation: any;
}

export default function MemoriesScreen({ navigation }: MemoriesScreenProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Fetch memories
  const {
    data: memoriesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["memories"],
    queryFn: async () => {
      const response = await apiRequest("/api/memories");
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Generate memories mutation
  const generateMemoriesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/memories/generate", {
        method: "POST",
      });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
      Alert.alert(
        "Memories Generated",
        `Successfully generated ${data.count} memories`,
      );
    },
    onError: (error) => {
      Alert.alert(
        "Generation Failed",
        "Failed to generate memories. Please try again.",
      );
      console.error("Memory generation error:", error);
    },
  });

  // Update memory mutation (favorite/hide)
  const updateMemoryMutation = useMutation({
    mutationFn: async ({
      memoryId,
      updates,
    }: {
      memoryId: string;
      updates: any;
    }) => {
      const response = await apiRequest(`/api/memories/${memoryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memories"] });
    },
    onError: (error) => {
      Alert.alert(
        "Update Failed",
        "Failed to update memory. Please try again.",
      );
      console.error("Memory update error:", error);
    },
  });

  // Refresh memories
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Focus effect to refresh memories when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  // Handle memory actions
  const handleMemoryPress = useCallback(
    (memory: Memory) => {
      navigation.navigate("MemoryDetailScreen", { memoryId: memory.id });
    },
    [navigation],
  );

  const handleFavoriteToggle = useCallback(
    (memory: Memory) => {
      updateMemoryMutation.mutate({
        memoryId: memory.id,
        updates: { isFavorite: !memory.isFavorite },
      });
    },
    [updateMemoryMutation],
  );

  const handleHideToggle = useCallback(
    (memory: Memory) => {
      updateMemoryMutation.mutate({
        memoryId: memory.id,
        updates: { isHidden: !memory.isHidden },
      });
    },
    [updateMemoryMutation],
  );

  const handleGenerateMemories = useCallback(() => {
    Alert.alert(
      "Generate Memories",
      "This will analyze your photos to create new memories. It may take a few moments.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate",
          onPress: () => generateMemoriesMutation.mutate(),
          style: "default",
        },
      ],
    );
  }, [generateMemoriesMutation]);

  // Render memory item
  const renderMemory = useCallback(
    ({ item: memory }: { item: Memory }) => (
      <MemoryCard
        memory={memory}
        onPress={() => handleMemoryPress(memory)}
        onFavoriteToggle={() => handleFavoriteToggle(memory)}
        onHideToggle={() => handleHideToggle(memory)}
        isLoading={updateMemoryMutation.isPending}
      />
    ),
    [
      handleMemoryPress,
      handleFavoriteToggle,
      handleHideToggle,
      updateMemoryMutation.isPending,
    ],
  );

  // Render empty state
  const renderEmptyState = useCallback(() => {
    if (isLoading) {
      return <SkeletonLoader type="memories" />;
    }

    return (
      <EmptyState
        icon="clock"
        title="No Memories Yet"
        description="Generate memories to see your best moments from past years, months, and highlights."
        action={{
          label: "Generate Memories",
          onPress: handleGenerateMemories,
        }}
      />
    );
  }, [isLoading, handleGenerateMemories]);

  // Render header
  const renderHeader = useCallback(() => {
    if (!memoriesData?.memories || memoriesData.memories.length === 0) {
      return null;
    }

    return (
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Your Memories
        </Text>
        <TouchableOpacity
          style={[styles.generateButton, { backgroundColor: theme.accent }]}
          onPress={handleGenerateMemories}
          disabled={generateMemoriesMutation.isPending}
        >
          <Feather
            name="refresh-cw"
            size={16}
            color="white"
            style={[
              styles.generateIcon,
              generateMemoriesMutation.isPending && styles.spinning,
            ]}
          />
          <Text style={styles.generateButtonText}>Generate</Text>
        </TouchableOpacity>
      </View>
    );
  }, [
    memoriesData,
    theme,
    handleGenerateMemories,
    generateMemoriesMutation.isPending,
  ]);

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="alert-circle"
          title="Error Loading Memories"
          description="There was a problem loading your memories. Please try again."
          action={{
            label: "Retry",
            onPress: onRefresh,
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={memoriesData?.memories || []}
        renderItem={renderMemory}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.text}
            colors={[theme.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
        numColumns={1}
        windowSize={10}
        initialNumToRender={5}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={100}
        removeClippedSubviews={true}
      />

      {/* Floating Action Button */}
      {memoriesData?.memories && memoriesData.memories.length > 0 && (
        <FabButton
          icon="refresh-cw"
          onPress={handleGenerateMemories}
          disabled={generateMemoriesMutation.isPending}
          style={[generateMemoriesMutation.isPending && styles.spinning]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  generateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 20,
  },
  generateIcon: {
    marginRight: 4,
  },
  generateButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  spinning: {
    transform: [{ rotate: "45deg" }],
  },
});
