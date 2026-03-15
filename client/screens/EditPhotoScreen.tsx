// AI-META-BEGIN
// AI-META: Advanced photo editing screen with tabbed interface for filters, adjustments, and tools
// OWNERSHIP: client/screens
// ENTRYPOINTS: Navigated from PhotoDetailScreen
// DEPENDENCIES: expo-image-manipulator, expo-image, react-native-reanimated, photo-editor service
// DANGER: Complex state management; performance-critical for real-time preview
// CHANGE-SAFETY: Maintain navigation compatibility; preserve save functionality
// TESTS: Unit tests for tool switching, preview updates, save functionality
// AI-META-END

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Dimensions,
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
} from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { Photo } from "@/types";
import {
  PhotoEditor,
  createPhotoEditor,
  ImageAdjustments,
  DEFAULT_ADJUSTMENTS,
} from "@/lib/photo-editor";
import {
  FILTER_PRESETS,
  getFilterPreset,
  FilteredImage,
} from "@/lib/filters/filter-system";
import {
  ADJUSTMENT_CONFIGS,
  getAdjustmentsByCategory,
  resetAdjustmentsToDefault,
} from "@/lib/adjustments";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type EditPhotoRouteProps = RouteProp<RootStackParamList, "EditPhoto">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Tab types
type EditorTab = "filters" | "adjustments" | "tools" | "crop";

export default function EditPhotoScreen() {
  const route = useRoute<EditPhotoRouteProps>();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const { photoId, initialUri } = route.params;
  const [editor, setEditor] = useState<PhotoEditor | null>(null);
  const [currentUri, setCurrentUri] = useState(initialUri);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>("filters");
  const [selectedFilter, setSelectedFilter] = useState("original");
  const [adjustments, setAdjustments] =
    useState<ImageAdjustments>(DEFAULT_ADJUSTMENTS);
  const [showBeforeAfter, setShowBeforeAfter] = useState(false);

  // Initialize photo editor
  useEffect(() => {
    const photoEditor = createPhotoEditor(initialUri);
    setEditor(photoEditor);
  }, [initialUri]);

  // Apply filter when selected
  useEffect(() => {
    if (editor && selectedFilter !== "original") {
      const filter = getFilterPreset(selectedFilter);
      if (filter) {
        setAdjustments(filter.adjustments);
      }
    } else if (selectedFilter === "original") {
      setAdjustments(DEFAULT_ADJUSTMENTS);
    }
  }, [selectedFilter, editor]);

  // Handle adjustment changes
  const handleAdjustmentChange = useCallback(
    (key: keyof ImageAdjustments, value: number) => {
      setAdjustments((prev) => ({
        ...prev,
        [key]: value,
      }));
      setSelectedFilter("original"); // Reset filter when manually adjusting
    },
    [],
  );

  // Handle tab switching
  const handleTabChange = useCallback((tab: EditorTab) => {
    setActiveTab(tab);
  }, []);

  // Handle undo/redo
  const handleUndo = useCallback(async () => {
    if (editor && editor.canUndo()) {
      try {
        const newUri = await editor.undo();
        setCurrentUri(newUri);
      } catch (error) {
        console.error("Undo error:", error);
        Alert.alert("Error", "Failed to undo");
      }
    }
  }, [editor]);

  const handleRedo = useCallback(async () => {
    if (editor && editor.canRedo()) {
      try {
        const newUri = await editor.redo();
        setCurrentUri(newUri);
      } catch (error) {
        console.error("Redo error:", error);
        Alert.alert("Error", "Failed to redo");
      }
    }
  }, [editor]);

  // Handle reset
  const handleReset = useCallback(async () => {
    if (editor) {
      try {
        const newUri = await editor.resetToOriginal();
        setCurrentUri(newUri);
        setAdjustments(DEFAULT_ADJUSTMENTS);
        setSelectedFilter("original");
      } catch (error) {
        console.error("Reset error:", error);
        Alert.alert("Error", "Failed to reset");
      }
    }
  }, [editor]);

  // Handle save
  const saveMutation = useMutation({
    mutationFn: async (finalUri: string) => {
      // Apply final adjustments using expo-image-manipulator
      const manipulations = [];

      // Basic adjustments that expo-image-manipulator supports
      if (adjustments.brightness !== 0 || adjustments.contrast !== 0) {
        // Note: expo-image-manipulator has limited adjustment support
        // In a full implementation, we'd use a more sophisticated image processing library
      }

      if (manipulations.length > 0) {
        const result = await ImageManipulator.manipulateAsync(
          finalUri,
          manipulations,
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 },
        );
        finalUri = result.uri;
      }

      // Upload new image
      const formData = new FormData();
      formData.append("file", {
        uri: finalUri,
        name: "edited_photo.jpg",
        type: "image/jpeg",
      } as any);

      const uploadRes = await apiRequest(
        "POST",
        "/api/upload/single",
        formData,
      );
      const uploadData = await uploadRes.json();
      const newServerUri = uploadData.file.uri;

      // Update photo record
      const updateRes = await apiRequest("PUT", `/api/photos/${photoId}`, {
        uri: newServerUri,
      });
      return updateRes.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photos"] });
      navigation.goBack();
    },
    onError: (error) => {
      console.error("Save error:", error);
      Alert.alert("Error", "Failed to save changes");
      setIsSaving(false);
    },
  });

  const handleSave = useCallback(() => {
    setIsSaving(true);
    saveMutation.mutate(currentUri);
  }, [currentUri, saveMutation]);

  // Render tabs
  const renderTabs = useMemo(
    () => (
      <View style={styles.tabContainer}>
        {(["filters", "adjustments", "tools", "crop"] as EditorTab[]).map(
          (tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => handleTabChange(tab)}
            >
              <ThemedText
                type="small"
                style={[
                  styles.tabText,
                  activeTab === tab && { color: theme.accent },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </ThemedText>
            </Pressable>
          ),
        )}
      </View>
    ),
    [activeTab, handleTabChange, theme],
  );

  // Render filters tab
  const renderFiltersTab = useMemo(
    () => (
      <ScrollView
        style={styles.tabContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.filterGrid}>
          {FILTER_PRESETS.map((filter) => (
            <Pressable
              key={filter.id}
              style={[
                styles.filterItem,
                selectedFilter === filter.id && styles.filterItemSelected,
              ]}
              onPress={() => setSelectedFilter(filter.id)}
            >
              <View style={styles.filterPreview}>
                <FilteredImage
                  uri={initialUri}
                  adjustments={filter.adjustments}
                  width={80}
                  height={80}
                />
              </View>
              <ThemedText type="small" style={styles.filterName}>
                {filter.name}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    ),
    [selectedFilter, initialUri],
  );

  // Render adjustments tab
  const renderAdjustmentsTab = useMemo(
    () => (
      <ScrollView
        style={styles.tabContent}
        showsVerticalScrollIndicator={false}
      >
        {(["light", "color", "detail"] as const).map((category) => (
          <View key={category} style={styles.adjustmentCategory}>
            <ThemedText type="h6" style={styles.categoryTitle}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </ThemedText>
            {getAdjustmentsByCategory(category).map((config) => (
              <View key={config.id} style={styles.adjustmentRow}>
                <View style={styles.adjustmentHeader}>
                  <ThemedText type="body">{config.name}</ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    {adjustments[config.id].toFixed(2)}
                  </ThemedText>
                </View>
                <View style={styles.adjustmentSlider}>
                  {/* Slider placeholder - would implement actual slider component */}
                  <View style={styles.sliderTrack} />
                  <View
                    style={[
                      styles.sliderThumb,
                      {
                        left: `${((adjustments[config.id] - config.min) / (config.max - config.min)) * 100}%`,
                      },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    ),
    [adjustments, theme],
  );

  // Render tools tab
  const renderToolsTab = useMemo(
    () => (
      <View style={styles.tabContent}>
        <View style={styles.toolsGrid}>
          {[
            { id: "rotate", name: "Rotate", icon: "rotate-cw" },
            { id: "flip", name: "Flip", icon: "columns" },
            { id: "crop", name: "Crop", icon: "crop" },
            { id: "straighten", name: "Straighten", icon: "maximize-2" },
          ].map((tool) => (
            <Pressable key={tool.id} style={styles.toolItem}>
              <View style={styles.toolIcon}>
                <Feather name={tool.icon as any} size={24} color={theme.text} />
              </View>
              <ThemedText type="small">{tool.name}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>
    ),
    [theme],
  );

  // Render crop tab
  const renderCropTab = useMemo(
    () => (
      <View style={styles.tabContent}>
        <View style={styles.cropContainer}>
          <ThemedText type="h4">Crop Tool</ThemedText>
          <ThemedText type="body" style={styles.cropDescription}>
            Select aspect ratio and drag corners to crop
          </ThemedText>
          <View style={styles.aspectRatios}>
            {[
              { ratio: "Free", aspect: null },
              { ratio: "1:1", aspect: 1 },
              { ratio: "4:3", aspect: 4 / 3 },
              { ratio: "16:9", aspect: 16 / 9 },
            ].map((item) => (
              <Pressable key={item.ratio} style={styles.aspectRatioButton}>
                <ThemedText type="small">{item.ratio}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    ),
    [],
  );

  // Render tab content
  const renderTabContent = useMemo(() => {
    switch (activeTab) {
      case "filters":
        return renderFiltersTab;
      case "adjustments":
        return renderAdjustmentsTab;
      case "tools":
        return renderToolsTab;
      case "crop":
        return renderCropTab;
      default:
        return null;
    }
  }, [
    activeTab,
    renderFiltersTab,
    renderAdjustmentsTab,
    renderToolsTab,
    renderCropTab,
  ]);

  if (!editor) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <ThemedText type="h4">Loading Editor...</ThemedText>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.headerButton}
        >
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Cancel
          </ThemedText>
        </Pressable>
        <ThemedText type="h4">Edit Photo</ThemedText>
        <View style={styles.headerActions}>
          <Pressable
            onPress={handleUndo}
            disabled={!editor.canUndo()}
            style={styles.headerButton}
          >
            <Feather
              name="rotate-ccw"
              size={20}
              color={editor.canUndo() ? theme.text : theme.textSecondary}
            />
          </Pressable>
          <Pressable
            onPress={handleRedo}
            disabled={!editor.canRedo()}
            style={styles.headerButton}
          >
            <Feather
              name="rotate-cw"
              size={20}
              color={editor.canRedo() ? theme.text : theme.textSecondary}
            />
          </Pressable>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={styles.headerButton}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <ThemedText
                type="body"
                style={{ color: theme.accent, fontWeight: "600" }}
              >
                Save
              </ThemedText>
            )}
          </Pressable>
        </View>
      </View>

      {/* Image Preview */}
      <View style={styles.previewContainer}>
        <Pressable
          style={styles.previewWrapper}
          onPress={() => setShowBeforeAfter(!showBeforeAfter)}
        >
          <Image
            source={{ uri: showBeforeAfter ? initialUri : currentUri }}
            style={styles.previewImage}
            contentFit="contain"
            cachePolicy="none"
          />
          {showBeforeAfter && (
            <View style={styles.beforeAfterLabel}>
              <ThemedText type="small">Before</ThemedText>
            </View>
          )}
        </Pressable>
      </View>

      {/* Tabs */}
      {renderTabs}

      {/* Tab Content */}
      {renderTabContent}

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { paddingBottom: insets.bottom }]}>
        <Pressable onPress={handleReset} style={styles.resetButton}>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Reset
          </ThemedText>
        </Pressable>
        <Pressable
          onPress={() => setShowBeforeAfter(!showBeforeAfter)}
          style={styles.compareButton}
        >
          <ThemedText type="body" style={{ color: theme.accent }}>
            {showBeforeAfter ? "Hide" : "Show"} Original
          </ThemedText>
        </Pressable>
      </View>
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
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  headerButton: {
    padding: Spacing.sm,
    minWidth: 40,
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  previewContainer: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  previewWrapper: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  beforeAfterLabel: {
    position: "absolute",
    top: Spacing.md,
    left: Spacing.md,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  tabContainer: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "transparent",
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: "#007AFF",
  },
  tabText: {
    color: "#666",
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: Spacing.md,
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  filterItem: {
    width: (SCREEN_WIDTH - 3 * Spacing.md) / 4,
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  filterItemSelected: {
    backgroundColor: "rgba(0,122,255,0.1)",
    borderRadius: BorderRadius.md,
  },
  filterPreview: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    marginBottom: Spacing.xs,
  },
  filterName: {
    textAlign: "center",
  },
  adjustmentCategory: {
    marginBottom: Spacing.xl,
  },
  categoryTitle: {
    marginBottom: Spacing.md,
  },
  adjustmentRow: {
    marginBottom: Spacing.lg,
  },
  adjustmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  adjustmentSlider: {
    height: 40,
    position: "relative",
  },
  sliderTrack: {
    position: "absolute",
    top: 15,
    left: 0,
    right: 0,
    height: 10,
    backgroundColor: "#E5E5EA",
    borderRadius: 5,
  },
  sliderThumb: {
    position: "absolute",
    top: 5,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#007AFF",
    transform: [{ translateX: -15 }],
  },
  toolsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
  },
  toolItem: {
    width: (SCREEN_WIDTH - 3 * Spacing.md) / 4,
    alignItems: "center",
    paddingVertical: Spacing.lg,
  },
  toolIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  cropContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  cropDescription: {
    textAlign: "center",
    marginVertical: Spacing.lg,
  },
  aspectRatios: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  aspectRatioButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "#F2F2F7",
    borderRadius: BorderRadius.sm,
  },
  bottomActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  resetButton: {
    padding: Spacing.sm,
  },
  compareButton: {
    padding: Spacing.sm,
  },
});
