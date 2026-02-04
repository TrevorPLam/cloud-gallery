import React, { useState, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Dimensions,
  ScrollView,
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
import { Photo } from "@/types";
import { getPhotos } from "@/lib/storage";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const NUM_COLUMNS = 3;
const GAP = Spacing.photoGap;
const PHOTO_SIZE = (SCREEN_WIDTH - GAP * (NUM_COLUMNS - 1) - Spacing.lg * 2) / NUM_COLUMNS;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SuggestionChipProps {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
}

function SuggestionChip({ icon, label, onPress }: SuggestionChipProps) {
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
        styles.chip,
        { backgroundColor: theme.backgroundDefault },
        animatedStyle,
      ]}
    >
      <Feather name={icon} size={18} color={Colors.light.accent} />
      <ThemedText type="body" style={styles.chipLabel}>
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
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [filteredPhotos, setFilteredPhotos] = useState<Photo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const loadPhotos = useCallback(async () => {
    const data = await getPhotos();
    setPhotos(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPhotos();
    }, [loadPhotos])
  );

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPhotos([]);
      setHasSearched(false);
      return;
    }

    const query = searchQuery.toLowerCase();
    const results = photos.filter((photo) => {
      const filename = photo.filename.toLowerCase();
      return filename.includes(query);
    });
    setFilteredPhotos(results);
    setHasSearched(true);
  }, [searchQuery, photos]);

  const handlePhotoPress = (photo: Photo, index: number) => {
    const photoIndex = photos.findIndex((p) => p.id === photo.id);
    navigation.navigate("PhotoDetail", { photoId: photo.id, initialIndex: photoIndex });
  };

  const handleSuggestion = (type: string) => {
    if (type === "favorites") {
      const favorites = photos.filter((p) => p.isFavorite);
      setFilteredPhotos(favorites);
      setSearchQuery("Favorites");
      setHasSearched(true);
    } else if (type === "recent") {
      const recent = photos.slice(0, 20);
      setFilteredPhotos(recent);
      setSearchQuery("Recent");
      setHasSearched(true);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.searchContainer, { paddingTop: insets.top + Spacing.lg }]}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
          ]}
        >
          <Feather name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search photos..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Feather name="x" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>
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
            Suggestions
          </ThemedText>
          <View style={styles.chipsContainer}>
            <SuggestionChip
              icon="heart"
              label="Favorites"
              onPress={() => handleSuggestion("favorites")}
            />
            <SuggestionChip
              icon="clock"
              label="Recent"
              onPress={() => handleSuggestion("recent")}
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
          <ThemedText type="small" style={[styles.resultCount, { color: theme.textSecondary }]}>
            {filteredPhotos.length} {filteredPhotos.length === 1 ? "result" : "results"}
          </ThemedText>
          <View style={styles.resultsGrid}>
            {filteredPhotos.map((photo, index) => (
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
              </Pressable>
            ))}
          </View>
          {filteredPhotos.length === 0 ? (
            <View style={styles.noResults}>
              <Feather name="search" size={48} color={theme.textSecondary} />
              <ThemedText
                type="body"
                style={[styles.noResultsText, { color: theme.textSecondary }]}
              >
                No photos found
              </ThemedText>
            </View>
          ) : null}
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
});
