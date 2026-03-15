// AI-META-BEGIN
// AI-META: Enhanced search screen with NLP processing, suggestions, and filter chips
// OWNERSHIP: client/screens (search)
// ENTRYPOINTS: Accessed via SearchTab in MainTabNavigator
// DEPENDENCIES: React Query for API calls, expo-image, react-native-reanimated
// DANGER: Live search API calls; NLP processing overhead; debouncing required
// CHANGE-SAFETY: Moderate - UI changes affect user experience; test search performance
// TESTS: Test search suggestions, verify filter chips, check empty results, validate navigation
// AI-META-END

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Dimensions,
  ScrollView,
  FlatList,
  Keyboard,
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
} from "react-native-reanimated";
import { useQuery } from "@tanstack/react-query";
import { debounce } from "lodash";
import { Photo } from "@/types";
import { getPhotos } from "@/lib/storage";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiClient } from "@/lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const GAP = Spacing.photoGap;
const PHOTO_SIZE =
  (SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1) - Spacing.lg * 2) / NUM_COLUMNS;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SuggestionChipProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  type?: "suggestion" | "filter" | "popular";
}

interface SearchSuggestion {
  suggestion: string;
  type: string;
  count?: number;
}

interface SearchResult {
  photos: Photo[];
  total: number;
  query: any;
  suggestions: string[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    total: number;
  };
}

function SuggestionChip({
  icon,
  label,
  onPress,
  type = "suggestion",
}: SuggestionChipProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getChipColor = () => {
    switch (type) {
      case "filter":
        return Colors.light.accent;
      case "popular":
        return Colors.light.primary;
      default:
        return Colors.light.accent;
    }
  };

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
        styles.chip,
        {
          backgroundColor:
            type === "filter"
              ? theme.backgroundDefault
              : theme.backgroundSecondary,
          borderColor: getChipColor(),
          borderWidth: type === "filter" ? 1 : 0,
        },
        animatedStyle,
      ]}
    >
      <Feather name={icon} size={18} color={getChipColor()} />
      <ThemedText
        type="body"
        style={[
          styles.chipLabel,
          { color: type === "filter" ? getChipColor() : theme.text },
        ]}
      >
        {label}
      </ThemedText>
    </AnimatedPressable>
  );
}

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  const [searchQuery, setSearchQuery] = useState("");
  const [localPhotos, setLocalPhotos] = useState<Photo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const searchInputRef = useRef<TextInput>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Load local photos for fallback
  const loadPhotos = useCallback(async () => {
    const data = await getPhotos();
    setLocalPhotos(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos]),
  );

  // API search with React Query
  const {
    data: searchResults,
    isLoading: searchLoading,
    error: searchError,
    refetch: performSearch,
  } = useQuery({
    queryKey: ["search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return null;

      try {
        const response = await apiClient.post("/api/search", {
          query: searchQuery,
          limit: 50,
          offset: 0,
        });
        return response.data as SearchResult;
      } catch (error) {
        console.error("Search API error:", error);
        // Fallback to local search
        return performLocalSearch(searchQuery);
      }
    },
    enabled: searchQuery.trim().length > 0,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Search suggestions query
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["search-suggestions", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim() || searchQuery.length < 2) return [];

      try {
        const response = await apiClient.get("/api/search/suggestions", {
          params: { partial: searchQuery, limit: 5 },
        });
        return response.data.suggestions as string[];
      } catch (error) {
        console.error("Suggestions API error:", error);
        return [];
      }
    },
    enabled: searchQuery.trim().length >= 2,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

  // Popular searches query
  const { data: popularSearches } = useQuery({
    queryKey: ["popular-searches"],
    queryFn: async () => {
      try {
        const response = await apiClient.get("/api/search/popular");
        return response.data.popularSearches as string[];
      } catch (error) {
        console.error("Popular searches API error:", error);
        return [
          "beach photos",
          "sunset photos",
          "family photos",
          "vacation photos",
          "nature photos",
          "food photos",
          "pet photos",
          "favorite photos",
        ];
      }
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      if (query.trim()) {
        performSearch();
        setHasSearched(true);
      }
    }, 300),
    [performSearch],
  );

  // Handle search input changes
  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchQuery(text);
      setShowSuggestions(text.length >= 2);

      // Clear existing timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Set new timeout for debounced search
      searchTimeoutRef.current = setTimeout(() => {
        debouncedSearch(text);
      }, 300);
    },
    [debouncedSearch],
  );

  // Fallback local search
  const performLocalSearch = useCallback(
    (query: string): SearchResult => {
      const normalizedQuery = query.toLowerCase();
      const results = localPhotos.filter((photo) => {
        const filename = photo.filename.toLowerCase();
        const notes = photo.notes?.toLowerCase() || "";
        const tags = photo.tags?.join(" ").toLowerCase() || "";
        const mlLabels = photo.mlLabels?.join(" ").toLowerCase() || "";

        return (
          filename.includes(normalizedQuery) ||
          notes.includes(normalizedQuery) ||
          tags.includes(normalizedQuery) ||
          mlLabels.includes(normalizedQuery)
        );
      });

      return {
        photos: results,
        total: results.length,
        query: { text: query },
        suggestions: [],
        pagination: {
          limit: 50,
          offset: 0,
          hasMore: false,
          total: results.length,
        },
      };
    },
    [localPhotos],
  );

  // Handle photo press
  const handlePhotoPress = (photo: Photo, index: number) => {
    const photoIndex = localPhotos.findIndex((p) => p.id === photo.id);
    navigation.navigate("PhotoDetail", {
      photoId: photo.id,
      initialIndex: photoIndex,
    });
  };

  // Handle suggestion press
  const handleSuggestionPress = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    Keyboard.dismiss();

    // Trigger search immediately
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    debouncedSearch(suggestion);
  };

  // Handle filter chip press
  const handleFilterPress = (filter: string) => {
    const newFilters = selectedFilters.includes(filter)
      ? selectedFilters.filter((f) => f !== filter)
      : [...selectedFilters, filter];

    setSelectedFilters(newFilters);

    // Update search query with filters
    const baseQuery = searchQuery.replace(
      /\s+(favorites|videos|photos)$/gi,
      "",
    );
    const filterQuery =
      newFilters.length > 0
        ? `${baseQuery} ${newFilters.join(" ")}`
        : baseQuery;
    setSearchQuery(filterQuery);
    debouncedSearch(filterQuery);
  };

  // Clear search
  const handleClearSearch = () => {
    setSearchQuery("");
    setHasSearched(false);
    setShowSuggestions(false);
    setSelectedFilters([]);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
  };

  // Get current results
  const currentResults =
    searchResults || (hasSearched ? performLocalSearch(searchQuery) : null);
  const currentPhotos = currentResults?.photos || [];
  const currentSuggestions = suggestions || [];
  const currentPopular = popularSearches || [];

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
      <View
        style={[
          styles.searchContainer,
          { paddingTop: insets.top + Spacing.lg },
        ]}
      >
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
            placeholder="Search photos with natural language..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => setShowSuggestions(searchQuery.length >= 2)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            returnKeyType="search"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              debouncedSearch(searchQuery);
            }}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={handleClearSearch}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        {/* Filter chips */}
        {hasSearched && (
          <View style={styles.filterChipsContainer}>
            <SuggestionChip
              icon="heart"
              label="Favorites"
              onPress={() => handleFilterPress("favorites")}
              type="filter"
            />
            <SuggestionChip
              icon="video"
              label="Videos"
              onPress={() => handleFilterPress("videos")}
              type="filter"
            />
            <SuggestionChip
              icon="image"
              label="Photos"
              onPress={() => handleFilterPress("photos")}
              type="filter"
            />
          </View>
        )}

        {/* Search suggestions dropdown */}
        {showSuggestions && currentSuggestions.length > 0 && (
          <View
            style={[
              styles.suggestionsDropdown,
              { backgroundColor: theme.backgroundDefault },
            ]}
          >
            <FlatList
              data={currentSuggestions}
              keyExtractor={(item, index) => `suggestion-${index}`}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.suggestionItem, { borderColor: theme.border }]}
                  onPress={() => handleSuggestionPress(item)}
                >
                  <Feather
                    name="search"
                    size={16}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    type="body"
                    style={[styles.suggestionText, { color: theme.text }]}
                  >
                    {item}
                  </ThemedText>
                </Pressable>
              )}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        )}
      </View>

      {!hasSearched ? (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
          }}
        >
          <ThemedText
            type="h4"
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            Popular Searches
          </ThemedText>
          <View style={styles.chipsContainer}>
            {currentPopular.slice(0, 8).map((search, index) => (
              <SuggestionChip
                key={`popular-${index}`}
                icon="trending-up"
                label={search}
                onPress={() => handleSuggestionPress(search)}
                type="popular"
              />
            ))}
          </View>

          <ThemedText
            type="h4"
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            Quick Filters
          </ThemedText>
          <View style={styles.chipsContainer}>
            <SuggestionChip
              icon="heart"
              label="Favorites"
              onPress={() => handleSuggestionPress("favorite photos")}
              type="filter"
            />
            <SuggestionChip
              icon="video"
              label="Videos"
              onPress={() => handleSuggestionPress("videos")}
              type="filter"
            />
            <SuggestionChip
              icon="calendar"
              label="Recent"
              onPress={() => handleSuggestionPress("photos from last week")}
              type="filter"
            />
            <SuggestionChip
              icon="map-pin"
              label="Beach"
              onPress={() => handleSuggestionPress("beach photos")}
              type="filter"
            />
            <SuggestionChip
              icon="sun"
              label="Sunset"
              onPress={() => handleSuggestionPress("sunset photos")}
              type="filter"
            />
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
          }}
        >
          {searchLoading ? (
            <View style={styles.loadingContainer}>
              <ThemedText
                type="body"
                style={[styles.loadingText, { color: theme.textSecondary }]}
              >
                Searching...
              </ThemedText>
            </View>
          ) : searchError ? (
            <View style={styles.errorContainer}>
              <Feather
                name="alert-circle"
                size={48}
                color={Colors.light.error}
              />
              <ThemedText
                type="body"
                style={[styles.errorText, { color: theme.textSecondary }]}
              >
                Search failed. Using local search.
              </ThemedText>
            </View>
          ) : (
            <>
              <ThemedText
                type="small"
                style={[styles.resultCount, { color: theme.textSecondary }]}
              >
                {currentResults?.total || 0}{" "}
                {(currentResults?.total || 0) === 1 ? "result" : "results"}
                {searchQuery && ` for "${searchQuery}"`}
              </ThemedText>

              {/* Search suggestions */}
              {currentResults?.suggestions &&
                currentResults.suggestions.length > 0 && (
                  <View style={styles.suggestionsContainer}>
                    <ThemedText
                      type="small"
                      style={[
                        styles.suggestionsTitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Suggestions
                    </ThemedText>
                    <View style={styles.suggestionsChipsContainer}>
                      {currentResults.suggestions.map((suggestion, index) => (
                        <SuggestionChip
                          key={`suggestion-${index}`}
                          icon="lightbulb"
                          label={suggestion}
                          onPress={() => handleSuggestionPress(suggestion)}
                          type="suggestion"
                        />
                      ))}
                    </View>
                  </View>
                )}

              {/* Results grid */}
              <View style={styles.resultsGrid}>
                {currentPhotos.map((photo, index) => (
                  <Pressable
                    key={photo.id}
                    onPress={() => handlePhotoPress(photo, index)}
                    style={styles.resultPhoto}
                  >
                    <Image
                      source={{ uri: photo.uri }}
                      style={styles.resultImage}
                      contentFit="cover"
                      transition={200}
                    />
                    {photo.isFavorite && (
                      <View style={styles.favoriteOverlay}>
                        <Feather
                          name="heart"
                          size={12}
                          color={Colors.light.error}
                        />
                      </View>
                    )}
                    {photo.isVideo && (
                      <View style={styles.videoOverlay}>
                        <Feather name="play" size={12} color="white" />
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>

              {currentPhotos.length === 0 ? (
                <View style={styles.noResults}>
                  <Feather
                    name="search"
                    size={48}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    type="body"
                    style={[
                      styles.noResultsText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    No photos found
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={[
                      styles.noResultsSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Try different keywords or filters
                  </ThemedText>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
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
  sectionTitle: {
    marginBottom: Spacing.lg,
    marginTop: Spacing.lg,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  chipLabel: {
    fontWeight: "500",
  },
  filterChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  suggestionsDropdown: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    maxHeight: 200,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  suggestionText: {
    flex: 1,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
  },
  loadingText: {
    opacity: 0.7,
  },
  errorContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.lg,
  },
  errorText: {
    opacity: 0.7,
    textAlign: "center",
  },
  suggestionsContainer: {
    marginBottom: Spacing.lg,
  },
  suggestionsTitle: {
    marginBottom: Spacing.md,
  },
  suggestionsChipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
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
  resultCount: {
    marginVertical: Spacing.md,
  },
  resultsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  resultPhoto: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    marginRight: GAP,
    marginBottom: GAP,
  },
  resultImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E2E8F0",
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
});
