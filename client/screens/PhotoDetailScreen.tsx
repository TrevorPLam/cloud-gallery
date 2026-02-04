import React, { useState, useCallback, useRef } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  Pressable,
  Platform,
  StatusBar,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import { Photo } from "@/types";
import { getPhotos, toggleFavorite, deletePhoto } from "@/lib/storage";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type PhotoDetailRouteProp = RouteProp<RootStackParamList, "PhotoDetail">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PhotoDetailScreen() {
  const route = useRoute<PhotoDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const { photoId, initialIndex } = route.params;
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);
  const listRef = useRef<FlashList<Photo>>(null);

  const loadPhotos = useCallback(async () => {
    const data = await getPhotos();
    setPhotos(data);
  }, []);

  React.useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const currentPhoto = photos[currentIndex];

  const handleToggleFavorite = async () => {
    if (!currentPhoto) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    await toggleFavorite(currentPhoto.id);
    loadPhotos();
  };

  const handleShare = async () => {
    if (!currentPhoto) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(currentPhoto.uri);
      }
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  const handleDelete = async () => {
    if (!currentPhoto) return;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    await deletePhoto(currentPhoto.id);
    if (photos.length === 1) {
      navigation.goBack();
    } else {
      const newIndex = currentIndex === photos.length - 1 ? currentIndex - 1 : currentIndex;
      setCurrentIndex(newIndex);
      loadPhotos();
    }
  };

  const toggleControls = () => {
    setShowControls(!showControls);
  };

  const renderPhoto = ({ item, index }: { item: Photo; index: number }) => {
    return (
      <Pressable onPress={toggleControls} style={styles.photoContainer}>
        <Image
          source={{ uri: item.uri }}
          style={styles.fullImage}
          contentFit="contain"
          transition={200}
        />
      </Pressable>
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <StatusBar barStyle="light-content" />

      <FlashList
        ref={listRef}
        data={photos}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        estimatedItemSize={SCREEN_WIDTH}
        initialScrollIndex={initialIndex}
        renderItem={renderPhoto}
        onMomentumScrollEnd={(event) => {
          const newIndex = Math.round(
            event.nativeEvent.contentOffset.x / SCREEN_WIDTH
          );
          setCurrentIndex(newIndex);
        }}
      />

      {showControls ? (
        <>
          <View style={[styles.header, { paddingTop: insets.top }]}>
            <Pressable
              onPress={() => navigation.goBack()}
              style={styles.headerButton}
              hitSlop={8}
            >
              <Feather name="x" size={24} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerCenter}>
              {currentPhoto ? (
                <ThemedText type="small" style={styles.dateText}>
                  {formatDate(currentPhoto.createdAt)}
                </ThemedText>
              ) : null}
            </View>
            <View style={styles.headerButton} />
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <Pressable onPress={handleShare} style={styles.footerButton}>
              <Feather name="share" size={24} color="#FFFFFF" />
            </Pressable>
            <Pressable onPress={handleToggleFavorite} style={styles.footerButton}>
              <Feather
                name={currentPhoto?.isFavorite ? "heart" : "heart"}
                size={24}
                color={currentPhoto?.isFavorite ? Colors.light.accent : "#FFFFFF"}
              />
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.footerButton}>
              <Feather name="trash-2" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.counter}>
            <ThemedText type="small" style={styles.counterText}>
              {currentIndex + 1} / {photos.length}
            </ThemedText>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  fullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  dateText: {
    color: "#FFFFFF",
    opacity: 0.9,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing["4xl"],
    paddingTop: Spacing.xl,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  footerButton: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  counter: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  counterText: {
    color: "#FFFFFF",
    opacity: 0.7,
  },
});
