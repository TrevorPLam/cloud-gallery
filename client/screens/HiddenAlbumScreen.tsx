// Hidden album: shows photos marked isPrivate, gated by unlock (PIN/button).
// Plan: biometric/PIN; for now we use a simple "Unlock" button for the session.

import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { Photo } from "@/types";
import { apiRequest } from "@/lib/query-client";
import { PhotoGrid } from "@/components/PhotoGrid";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";

export default function HiddenAlbumScreen() {
  const { theme, isDark } = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [unlocked, setUnlocked] = useState(false);
  const colors = isDark ? Colors.dark : Colors.light;

  useFocusEffect(
    useCallback(() => {
      return () => setUnlocked(false);
    }, []),
  );

  const { data: photos = [], isLoading } = useQuery<Photo[]>({
    queryKey: ["photos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/photos");
      const data = await res.json();
      return data.photos ?? [];
    },
    enabled: unlocked,
  });

  const hiddenPhotos = photos.filter((p) => p.isPrivate);
  const groupedData = hiddenPhotos.length
    ? [{ title: "Hidden", data: hiddenPhotos }]
    : [];

  const handleUnlock = () => {
    setUnlocked(true);
  };

  const handlePhotoPress = (photo: Photo, index: number) => {
    (navigation as any).navigate("PhotoDetail", {
      photoId: photo.id,
      initialIndex: index,
      context: "hidden",
    });
  };

  if (!unlocked) {
    return (
      <View
        style={[
          styles.gateContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <Feather name="lock" size={48} color={colors.textSecondary} />
        <ThemedText style={styles.gateTitle}>Hidden album</ThemedText>
        <ThemedText
          style={[styles.gateSubtitle, { color: colors.textSecondary }]}
        >
          Unlock to view your hidden photos
        </ThemedText>
        <Pressable
          style={[styles.unlockButton, { backgroundColor: colors.accent }]}
          onPress={handleUnlock}
        >
          <ThemedText style={styles.unlockButtonText}>Unlock</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View
        style={[
          styles.gateContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (hiddenPhotos.length === 0) {
    return (
      <View
        style={[
          styles.gateContainer,
          { backgroundColor: theme.backgroundRoot },
        ]}
      >
        <ThemedText style={styles.gateTitle}>No hidden photos</ThemedText>
        <ThemedText
          style={[styles.gateSubtitle, { color: colors.textSecondary }]}
        >
          Mark photos as hidden from the photo detail menu
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <PhotoGrid
        photos={hiddenPhotos}
        groupedData={groupedData}
        onPhotoPress={handlePhotoPress}
        showSectionHeaders={false}
        contentContainerStyle={{ padding: Spacing.lg }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gateContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  gateTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: Spacing.xl,
  },
  gateSubtitle: {
    fontSize: 16,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  unlockButton: {
    marginTop: Spacing["2xl"],
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing["2xl"],
    borderRadius: 8,
  },
  unlockButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
});
