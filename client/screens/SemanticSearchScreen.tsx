// AI-META-BEGIN
// AI-META: Semantic search interface with CLIP-powered natural language queries
// OWNERSHIP: client/screens
// ENTRYPOINTS: Accessed via SearchTab or dedicated semantic search navigation
// DEPENDENCIES: clip-embeddings.ts, embedding-cache.ts, React Query, expo-image
// DANGER: CLIP model memory usage; embedding generation latency; cache management
// CHANGE-SAFETY: Add new search modes by extending SearchMode interface
// TESTS: client/screens/SemanticSearchScreen.test.tsx
// AI-META-END

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  Dimensions,
  Keyboard,
  Alert,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";

import { Photo } from "@/types";
import { getPhotos } from "@/lib/storage";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

import {
  getCLIPEmbeddingsService,
  EmbeddingSimilarity,
} from "@/lib/ml/clip-embeddings";
import {
  getEmbeddingCache,
  GenerationProgress,
  CacheStats,
} from "@/lib/ml/embedding-cache";
import { getEmbeddingIndex, SemanticSearchQuery } from "@/lib/ml/embedding-index";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const GAP = Spacing.photoGap;
const PHOTO_SIZE =
  (SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1) - Spacing.lg * 2) / NUM_COLUMNS;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SemanticSearchResult {
  photo: Photo;
  similarity: EmbeddingSimilarity;
  embeddingGenerated: boolean;
}

interface SearchMode {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
}

const SEARCH_MODES: SearchMode[] = [
  {
    id: "text-to-image",
    label: "Text to Image",
    icon: "search",
    description: "Find photos using natural language descriptions",
  },
  {
    id: "image-to-image",
    label: "Similar Images",
    icon: "image",
    description: "Find visually similar photos",
  },
  {
    id: "text-to-text",
    label: "Similar Tags",
    icon: "tag",
    description: "Find photos with similar concepts",
  },
];

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function SearchModeCard({
  mode,
  onPress,
  isSelected,
}: {
  mode: SearchMode;
  onPress: () => void;
  isSelected: boolean;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }}
      style={[
        styles.modeCard,
        {
          backgroundColor: isSelected
            ? Colors.light.primary
            : theme.backgroundDefault,
          borderColor: isSelected ? Colors.light.primary : theme.border,
        },
        animatedStyle,
      ]}
    >
      <Feather
        name={mode.icon}
        size={24}
        color={isSelected ? "white" : theme.textSecondary}
      />
      <ThemedText
        type="subtitle"
        style={[
          styles.modeCardTitle,
          { color: isSelected ? "white" : theme.text },
        ]}
      >
        {mode.label}
      </ThemedText>
      <ThemedText
        type="small"
        style={[
          styles.modeCardDescription,
          { color: isSelected ? "rgba(255,255,255,0.8)" : theme.textSecondary },
        ]}
      >
        {mode.description}
      </ThemedText>
    </AnimatedPressable>
  );
}

function SearchProgressIndicator({
  progress,
  stage,
}: {
  progress: number;
  stage: string;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.progressContainer}>
      <ThemedText
        type="small"
        style={[styles.progressText, { color: theme.textSecondary }]}
      >
        {stage}
      </ThemedText>
      <View
        style={[
          styles.progressBar,
          { backgroundColor: theme.backgroundSecondary },
        ]}
      >
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: `${progress}%`,
              backgroundColor: Colors.light.primary,
            },
          ]}
        />
      </View>
      <ThemedText
        type="small"
        style={[styles.progressPercent, { color: theme.textSecondary }]}
      >
        {Math.round(progress)}%
      </ThemedText>
    </View>
  );
}

function SemanticResultCard({
  result,
  onPress,
  index,
}: {
  result: SemanticSearchResult;
  onPress: () => void;
  index: number;
}) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: withTiming(1, { duration: 300, delay: index * 50 }),
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.95, { damping: 15, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }}
      style={[styles.resultCard, animatedStyle]}
    >
      <Image
        source={{ uri: result.photo.uri }}
        style={styles.resultImage}
        contentFit="cover"
        transition={200}
      />

      {/* Similarity score overlay */}
      <View style={styles.similarityOverlay}>
        <ThemedText
          type="small"
          style={[styles.similarityText, { color: "white" }]}
        >
          {Math.round(result.similarity.score * 100)}%
        </ThemedText>
      </View>

      {/* Favorite indicator */}
      {result.photo.isFavorite && (
        <View style={styles.favoriteOverlay}>
          <Feather name="heart" size={12} color={Colors.light.error} />
        </View>
      )}

      {/* Video indicator */}
      {result.photo.isVideo && (
        <View style={styles.videoOverlay}>
          <Feather name="play" size={12} color="white" />
        </View>
      )}

      {/* Embedding generation indicator */}
      {!result.embeddingGenerated && (
        <View style={styles.generatingOverlay}>
          <Feather name="cpu" size={12} color={Colors.light.accent} />
        </View>
      )}
    </AnimatedPressable>
  );
}

export default function SemanticSearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  // State management
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMode, setSelectedMode] = useState<SearchMode>(SEARCH_MODES[0]);
  const [localPhotos, setLocalPhotos] = useState<Photo[]>([]);
  const [searchResults, setSearchResults] = useState<SemanticSearchResult[]>(
    [],
  );
  const [isSearching, setIsSearching] = useState(false);
  const [generationProgress, setGenerationProgress] =
    useState<GenerationProgress | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);

  // Services
  const clipService = getCLIPEmbeddingsService();
  const embeddingCache = getEmbeddingCache();
  const embeddingIndex = getEmbeddingIndex();

  // Refs
  const searchInputRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Load local photos
  const loadPhotos = useCallback(async () => {
    const data = await getPhotos();
    setLocalPhotos(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos]),
  );

  // Cache statistics query
  const { data: stats } = useQuery({
    queryKey: ["embedding-cache-stats"],
    queryFn: async () => {
      return await embeddingCache.getStats();
    },
    refetchInterval: 5000, // Update every 5 seconds
  });

  useEffect(() => {
    if (stats) {
      setCacheStats(stats);
    }
  }, [stats]);

  // Semantic search implementation using embedding index
  const performSemanticSearch = useCallback(async () => {
    if (!searchQuery.trim() || !clipService.isReady()) {
      return;
    }

    setIsSearching(true);
    setGenerationProgress(null);

    try {
      // Initialize embedding index if needed
      await embeddingIndex.initialize();

      // Create search query
      const searchQueryObj: SemanticSearchQuery = {
        text: searchQuery,
        limit: 50,
        threshold: 0.1,
      };

      // Perform semantic search using embedding index
      const results = await embeddingIndex.semanticSearch(searchQueryObj);

      // Convert to SemanticSearchResult format
      const semanticResults: SemanticSearchResult[] = results.map((result) => ({
        photo: {
          id: result.id,
          uri: result.metadata.uri,
          width: result.metadata.width,
          height: result.metadata.height,
          createdAt: result.metadata.createdAt,
          isFavorite: false, // Would need to fetch from storage
          isVideo: false, // Would need to fetch from storage
        } as Photo,
        similarity: result.similarity,
        embeddingGenerated: result.embeddingGenerated,
      }));

      setSearchResults(semanticResults);
    } catch (error) {
      console.error("Semantic search failed:", error);
      Alert.alert(
        "Search Error",
        "Failed to perform semantic search. Please try again.",
      );
    } finally {
      setIsSearching(false);
      setGenerationProgress(null);
    }
  }, [
    searchQuery,
    clipService,
    embeddingIndex,
  ]);

  // Debounced search
  const debouncedSearch = useCallback(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSemanticSearch();
    }, 500);
  }, [performSemanticSearch]);

  // Handle search input changes
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);

      if (text.trim()) {
        debouncedSearch();
      } else {
        setSearchResults([]);
      }
    },
    [debouncedSearch],
  );

  // Handle photo press
  const handlePhotoPress = (photo: Photo, index: number) => {
    const photoIndex = localPhotos.findIndex((p) => p.id === photo.id);
    navigation.navigate("PhotoDetail", {
      photoId: photo.id,
      initialIndex: photoIndex,
    });
  };

  // Handle search mode selection
  const handleModeSelect = (mode: SearchMode) => {
    setSelectedMode(mode);
    setSearchResults([]);
    setSearchQuery("");

    // Focus input after mode change
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.lg }]}>
        <ThemedText type="h3" style={[styles.title, { color: theme.text }]}>
          Semantic Search
        </ThemedText>

        {/* Cache stats */}
        {cacheStats && (
          <View style={styles.statsContainer}>
            <ThemedText
              type="small"
              style={[styles.statsText, { color: theme.textSecondary }]}
            >
              Cache: {cacheStats.memoryEntries} memory, {cacheStats.diskEntries}{" "}
              disk
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.statsText, { color: theme.textSecondary }]}
            >
              Hit rate: {Math.round(cacheStats.hitRate * 100)}%
            </ThemedText>
          </View>
        )}
      </View>

      {/* Search modes */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.modesContainer}
        contentContainerStyle={styles.modesContent}
      >
        {SEARCH_MODES.map((mode) => (
          <SearchModeCard
            key={mode.id}
            mode={mode}
            onPress={() => handleModeSelect(mode)}
            isSelected={selectedMode.id === mode.id}
          />
        ))}
      </ScrollView>

      {/* Search input */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
            },
          ]}
        >
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            ref={searchInputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder={getPlaceholderForMode(selectedMode.id)}
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              performSemanticSearch();
            }}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={handleClearSearch}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Progress indicator */}
      {generationProgress && (
        <View style={styles.progressSection}>
          <SearchProgressIndicator
            progress={generationProgress.progress}
            stage={generationProgress.stage}
          />
        </View>
      )}

      {/* Results */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
        }}
      >
        {isSearching ? (
          <View style={styles.loadingContainer}>
            <ThemedText
              type="body"
              style={[styles.loadingText, { color: theme.textSecondary }]}
            >
              Analyzing photos with AI...
            </ThemedText>
          </View>
        ) : searchResults.length > 0 ? (
          <>
            <ThemedText
              type="small"
              style={[styles.resultCount, { color: theme.textSecondary }]}
            >
              Found {searchResults.length} semantically similar photos
            </ThemedText>

            <View style={styles.resultsGrid}>
              {searchResults.map((result, index) => (
                <SemanticResultCard
                  key={result.photo.id}
                  result={result}
                  onPress={() => handlePhotoPress(result.photo, index)}
                  index={index}
                />
              ))}
            </View>
          </>
        ) : searchQuery ? (
          <View style={styles.noResults}>
            <Feather name="search" size={48} color={theme.textSecondary} />
            <ThemedText
              type="body"
              style={[styles.noResultsText, { color: theme.textSecondary }]}
            >
              No similar photos found
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.noResultsSubtext, { color: theme.textSecondary }]}
            >
              Try different keywords or descriptions
            </ThemedText>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="cpu" size={48} color={theme.textSecondary} />
            <ThemedText
              type="body"
              style={[styles.emptyStateText, { color: theme.textSecondary }]}
            >
              Start typing to search with AI
            </ThemedText>
            <ThemedText
              type="small"
              style={[styles.emptyStateSubtext, { color: theme.textSecondary }]}
            >
              Use natural language to find photos
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// Helper function
function getPlaceholderForMode(modeId: string): string {
  switch (modeId) {
    case "text-to-image":
      return "Describe what you're looking for...";
    case "image-to-image":
      return "Find similar images to...";
    case "text-to-text":
      return "Search for similar concepts...";
    default:
      return "Search photos with AI...";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  title: {
    marginBottom: Spacing.sm,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statsText: {
    opacity: 0.7,
  },
  modesContainer: {
    marginBottom: Spacing.lg,
  },
  modesContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  modeCard: {
    flex: 1,
    minWidth: 120,
    maxWidth: 160,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: "center",
    gap: Spacing.sm,
  },
  modeCardTitle: {
    fontWeight: "600",
    textAlign: "center",
  },
  modeCardDescription: {
    textAlign: "center",
    lineHeight: 16,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  progressSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  progressContainer: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressText: {
    textAlign: "center",
  },
  progressBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  progressPercent: {
    fontSize: 12,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  loadingText: {
    opacity: 0.7,
  },
  resultCount: {
    marginVertical: Spacing.md,
  },
  resultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  resultCard: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    marginRight: GAP,
    marginBottom: GAP,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    opacity: 0,
  },
  resultImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E2E8F0",
  },
  similarityOverlay: {
    position: "absolute",
    top: Spacing.xs,
    left: Spacing.xs,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  similarityText: {
    fontSize: 10,
    fontWeight: "600",
  },
  favoriteOverlay: {
    position: "absolute",
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: BorderRadius.full,
    padding: Spacing.xs,
  },
  videoOverlay: {
    position: "absolute",
    bottom: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: BorderRadius.full,
    padding: Spacing.xs,
  },
  generatingOverlay: {
    position: "absolute",
    bottom: Spacing.xs,
    left: Spacing.xs,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: BorderRadius.full,
    padding: Spacing.xs,
  },
  noResults: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.lg,
  },
  noResultsText: {
    opacity: 0.7,
  },
  noResultsSubtext: {
    opacity: 0.5,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.lg,
  },
  emptyStateText: {
    opacity: 0.7,
  },
  emptyStateSubtext: {
    opacity: 0.5,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
