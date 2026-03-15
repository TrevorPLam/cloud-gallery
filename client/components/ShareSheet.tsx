// AI-META-BEGIN
// AI-META: Share sheet modal with multiple sharing options and platform-specific features
// OWNERSHIP: client/components (sharing UI)
// ENTRYPOINTS: Used by PhotoDetailScreen and other photo viewing screens
// DEPENDENCIES: native-share service, React Native modals, haptics, theme system
// DANGER: Modal visibility state, async sharing operations, platform-specific UI
// CHANGE-SAFETY: Safe to modify styling and options; risky to change sharing logic; test async operations
// TESTS: Test modal visibility, verify share options, check error handling, validate platform differences
// AI-META-END

import React, { useState, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Photo } from "@/types";
import {
  nativeShareService,
  ShareMethod,
  ShareResult,
} from "@/lib/native-share";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";

interface ShareSheetProps {
  visible: boolean;
  photos: Photo[];
  onClose: () => void;
  onComplete?: (result: ShareResult) => void;
}

interface ShareOption {
  id: ShareMethod;
  title: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  available: boolean;
  action: () => Promise<void>;
}

/**
 * ShareSheet - Modal component with multiple sharing options
 *
 * Features:
 * - Platform-specific sharing options
 * - Loading states and error handling
 * - Haptic feedback
 * - Accessible UI with proper labels
 * - Theme-aware styling
 */
export function ShareSheet({
  visible,
  photos,
  onClose,
  onComplete,
}: ShareSheetProps) {
  const { theme } = useTheme();
  const [loadingMethod, setLoadingMethod] = useState<ShareMethod | null>(null);
  const [processing, setProcessing] = useState(false);

  // Reset state when modal closes
  React.useEffect(() => {
    if (!visible) {
      setLoadingMethod(null);
      setProcessing(false);
    }
  }, [visible]);

  // Handle share completion
  const handleShareComplete = useCallback(
    (result: ShareResult, method: ShareMethod) => {
      setLoadingMethod(null);
      setProcessing(false);

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(
          result.success
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Error,
        );
      }

      if (result.success) {
        // Show success message
        const message = getSuccessMessage(method, photos.length);
        if (Platform.OS === "web") {
          alert(message);
        } else {
          // Could use a toast component here
          console.log(message);
        }
        onClose();
      } else {
        // Show error message
        if (Platform.OS === "web") {
          alert(`Share failed: ${result.error}`);
        } else {
          Alert.alert(
            "Share Failed",
            result.error || "An unknown error occurred",
          );
        }
      }

      onComplete?.(result);
    },
    [photos.length, onClose, onComplete],
  );

  // Get success message for different share methods
  const getSuccessMessage = (
    method: ShareMethod,
    photoCount: number,
  ): string => {
    const photoText = photoCount === 1 ? "photo" : "photos";

    switch (method) {
      case "file":
        return `Shared ${photoCount} ${photoText} successfully`;
      case "clipboard":
        return `Copied ${photoCount} ${photoText} to clipboard`;
      case "device":
        return `Saved ${photoCount} ${photoText} to device`;
      case "link":
        return `Generated share links for ${photoCount} ${photoText}`;
      default:
        return "Share completed successfully";
    }
  };

  // Handle share option selection
  const handleShareOption = useCallback(
    async (method: ShareMethod) => {
      if (processing) return;

      setProcessing(true);
      setLoadingMethod(method);

      try {
        let result: ShareResult;

        switch (method) {
          case "file":
            result = await nativeShareService.sharePhotos(photos, {
              title:
                photos.length === 1
                  ? "Share Photo"
                  : `Share ${photos.length} Photos`,
              message: `Check out these ${photos.length === 1 ? "photo" : "photos"} from Photo Vault!`,
            });
            break;

          case "clipboard":
            result = await nativeShareService.copyToClipboard(photos);
            break;

          case "device":
            result = await nativeShareService.saveToDevice(photos);
            break;

          case "link":
            result = await nativeShareService.generateShareLinks(photos);
            break;

          default:
            result = { success: false, error: "Unsupported share method" };
        }

        handleShareComplete(result, method);
      } catch (error) {
        console.error("Share option error:", error);
        handleShareComplete(
          {
            success: false,
            error: error instanceof Error ? error.message : "Share failed",
          },
          method,
        );
      }
    },
    [photos, processing, handleShareComplete],
  );

  // Get available share options
  const getShareOptions = useCallback((): ShareOption[] => {
    const availableMethods = nativeShareService.getAvailableShareMethods();

    const options: ShareOption[] = [
      {
        id: "file",
        title: "Share as File",
        description:
          photos.length === 1
            ? "Share photo with apps"
            : "Share photos with apps",
        icon: "share-2",
        available: availableMethods.includes("file"),
        action: () => handleShareOption("file"),
      },
      {
        id: "clipboard",
        title: "Copy to Clipboard",
        description:
          photos.length === 1 ? "Copy photo link" : "Copy photo links",
        icon: "copy",
        available: availableMethods.includes("clipboard"),
        action: () => handleShareOption("clipboard"),
      },
      {
        id: "device",
        title: "Save to Device",
        description:
          photos.length === 1
            ? "Save to photo library"
            : "Save to photo library",
        icon: "download",
        available: availableMethods.includes("device"),
        action: () => handleShareOption("device"),
      },
      {
        id: "link",
        title: "Share as Link",
        description:
          photos.length === 1
            ? "Create shareable link"
            : "Create shareable links",
        icon: "link",
        available: availableMethods.includes("link"),
        action: () => handleShareOption("link"),
      },
    ];

    return options.filter((option) => option.available);
  }, [photos.length, handleShareOption]);

  // Handle modal close with haptic feedback
  const handleClose = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onClose();
  }, [onClose]);

  const shareOptions = getShareOptions();
  const styles = createStyles(theme);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <ThemedText type="h3" style={styles.title}>
              Share {photos.length === 1 ? "Photo" : `${photos.length} Photos`}
            </ThemedText>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={processing}
              hitSlop={8}
            >
              <Feather
                name="x"
                size={24}
                color={theme === "dark" ? Colors.dark.text : Colors.light.text}
              />
            </TouchableOpacity>
          </View>

          {/* Share Options */}
          <View style={styles.optionsContainer}>
            {shareOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.option,
                  loadingMethod === option.id && styles.optionLoading,
                ]}
                onPress={option.action}
                disabled={processing || loadingMethod === option.id}
                accessible={true}
                accessibilityLabel={option.title}
                accessibilityHint={option.description}
              >
                <View style={styles.optionIcon}>
                  {loadingMethod === option.id ? (
                    <ActivityIndicator
                      size="small"
                      color={
                        theme === "dark"
                          ? Colors.dark.accent
                          : Colors.light.accent
                      }
                    />
                  ) : (
                    <Feather
                      name={option.icon}
                      size={24}
                      color={
                        theme === "dark" ? Colors.dark.text : Colors.light.text
                      }
                    />
                  )}
                </View>

                <View style={styles.optionContent}>
                  <ThemedText type="subtitle" style={styles.optionTitle}>
                    {option.title}
                  </ThemedText>
                  <ThemedText type="small" style={styles.optionDescription}>
                    {option.description}
                  </ThemedText>
                </View>

                <Feather
                  name="chevron-right"
                  size={20}
                  color={
                    theme === "dark"
                      ? Colors.dark.subtext
                      : Colors.light.subtext
                  }
                />
              </TouchableOpacity>
            ))}

            {/* Empty state if no options available */}
            {shareOptions.length === 0 && (
              <View style={styles.emptyState}>
                <Feather
                  name="share-2"
                  size={48}
                  color={
                    theme === "dark"
                      ? Colors.dark.subtext
                      : Colors.light.subtext
                  }
                />
                <ThemedText type="body" style={styles.emptyText}>
                  No sharing options available
                </ThemedText>
                <ThemedText type="small" style={styles.emptySubtext}>
                  Sharing may not be available on this device
                </ThemedText>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                processing && styles.cancelButtonDisabled,
              ]}
              onPress={handleClose}
              disabled={processing}
            >
              <ThemedText type="subtitle" style={styles.cancelButtonText}>
                Cancel
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: "dark" | "light") =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      justifyContent: "flex-end",
    },
    container: {
      backgroundColor:
        theme === "dark" ? Colors.dark.background : Colors.light.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: "80%",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor:
        theme === "dark" ? Colors.dark.border : Colors.light.border,
    },
    title: {
      flex: 1,
      textAlign: "center",
    },
    closeButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    optionsContainer: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    option: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      borderRadius: 12,
      marginBottom: Spacing.sm,
      backgroundColor: theme === "dark" ? Colors.dark.card : Colors.light.card,
    },
    optionLoading: {
      opacity: 0.6,
    },
    optionIcon: {
      width: 48,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      marginRight: Spacing.md,
    },
    optionContent: {
      flex: 1,
    },
    optionTitle: {
      marginBottom: 2,
    },
    optionDescription: {
      opacity: 0.7,
    },
    emptyState: {
      alignItems: "center",
      paddingVertical: Spacing["4xl"],
    },
    emptyText: {
      marginTop: Spacing.md,
      textAlign: "center",
    },
    emptySubtext: {
      marginTop: Spacing.sm,
      textAlign: "center",
      opacity: 0.7,
    },
    footer: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xl,
      paddingTop: Spacing.md,
    },
    cancelButton: {
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      borderRadius: 12,
      alignItems: "center",
      backgroundColor: theme === "dark" ? Colors.dark.card : Colors.light.card,
    },
    cancelButtonDisabled: {
      opacity: 0.5,
    },
    cancelButtonText: {
      color: theme === "dark" ? Colors.light.accent : Colors.dark.accent,
    },
  });
