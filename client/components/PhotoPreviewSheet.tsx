// AI-META-BEGIN
// AI-META: Modal sheet component for photo preview in map view
// OWNERSHIP: client/components
// ENTRYPOINTS: Used by MapScreen for in-map photo preview
// DEPENDENCIES: expo-image, theme system, accessibility
// DANGER: Modal presentation performance; ensure proper cleanup
// CHANGE-SAFETY: Safe to modify styling; maintain modal behavior
// TESTS: Verify modal presentation, photo loading, accessibility
// AI-META-END

import React from "react";
import { Modal, View, StyleSheet, TouchableOpacity } from "react-native";
import { Image } from "expo-image";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Spacing, BorderRadius } from "@/constants/theme";
import { Photo } from "@/types";

interface PhotoPreviewSheetProps {
  photo: Photo | null;
  visible: boolean;
  onClose: () => void;
  onViewFull: (photo: Photo) => void;
}

export default function PhotoPreviewSheet({
  photo,
  visible,
  onClose,
  onViewFull,
}: PhotoPreviewSheetProps) {
  const { theme } = useTheme();

  if (!photo) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      accessibilityLabel="Photo preview modal"
      accessibilityHint="Tap outside or close button to dismiss"
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        testID="preview-overlay"
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
          onPress={(e) => e.stopPropagation()}
          testID="preview-container"
        >
          <Image
            source={{ uri: photo.uri }}
            style={styles.image}
            contentFit="contain"
            accessible={true}
            accessibilityLabel={`Photo preview: ${photo.location?.city || "Unknown location"}`}
            testID="photo-image"
          />
          
          <View style={styles.info}>
            <ThemedText style={styles.title}>
              {photo.location?.city || "Photo"}
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              {new Date(photo.createdAt).toLocaleDateString()}
            </ThemedText>
          </View>
          
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.accent }]}
              onPress={() => onViewFull(photo)}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="View full photo"
              accessibilityHint="Opens photo in full screen view"
              testID="view-full-button"
            >
              <ThemedText style={[styles.buttonText, { color: theme.backgroundDefault }]}>
                View Full
              </ThemedText>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.button, { backgroundColor: theme.backgroundSecondary }]}
              onPress={onClose}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Close preview"
              accessibilityHint="Closes photo preview and returns to map"
              testID="close-button"
            >
              <ThemedText style={[styles.buttonText, { color: theme.text }]}>
                Close
              </ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  container: {
    width: "90%",
    maxWidth: 400,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  image: {
    width: "100%",
    height: 300,
  },
  info: {
    padding: Spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  button: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    minWidth: 80,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
