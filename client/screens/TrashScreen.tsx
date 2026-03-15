// AI-META-BEGIN
// AI-META: Screen for viewing and managing deleted photos
// OWNERSHIP: client/screens
// ENTRYPOINTS: Navigated from ProfileScreen
// DEPENDENCIES: PhotoDetailScreen (for viewing), storage/api
// DANGER: Permanent delete is irreversible
// CHANGE-SAFETY: Safe to add; verify restore logic
// TESTS: Restore photo, permanent delete, empty state
// AI-META-END

import React, { useCallback } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  Dimensions,
  RefreshControl,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Spacing, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { Photo } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Feather } from "@expo/vector-icons";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const IMAGE_SIZE = SCREEN_WIDTH / COLUMN_COUNT;

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TrashScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();

  const {
    data: photos = [],
    isLoading,
    refetch,
  } = useQuery<Photo[]>({
    queryKey: ["trash-photos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/photos/user/trash");
      const data = await res.json();
      return data.photos;
    },
  });

  const renderItem = useCallback(
    ({ item, index }: { item: Photo; index: number }) => {
      return (
        <Pressable
          onPress={() => {
            navigation.navigate("PhotoDetail", {
              photoId: item.id,
              initialIndex: index,
              // @ts-ignore - 'context' param needs to be added to RootStackParamList
              context: "trash",
            });
          }}
          style={{
            width: IMAGE_SIZE,
            height: IMAGE_SIZE,
            padding: 1,
          }}
        >
          <Image
            source={{ uri: item.uri }}
            style={{ flex: 1, backgroundColor: theme.backgroundDefault }}
            contentFit="cover"
            transition={200}
          />
        </Pressable>
      );
    },
    [navigation, theme],
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Feather name="trash-2" size={48} color={theme.textSecondary} />
      <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
        Trash is empty
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <ThemedText type="h4">Trash</ThemedText>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={photos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={COLUMN_COUNT}
        contentContainerStyle={{
          paddingBottom: insets.bottom,
          flexGrow: 1,
        }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        ListEmptyComponent={!isLoading ? renderEmpty : null}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 100,
  },
});
