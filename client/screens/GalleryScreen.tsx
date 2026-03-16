// AI-META-BEGIN
// AI-META: Zoomable gallery interface with smooth transitions and haptic feedback
// OWNERSHIP: client/screens (gallery screen)
// ENTRYPOINTS: Main gallery screen accessible from navigation
// DEPENDENCIES: gesture-handler, flash-list-optimization, timeline-navigation, expo-haptics
// DANGER: Complex UI state management; performance-sensitive with large photo libraries
// CHANGE-SAFETY: Safe to modify visual styling; risky to change navigation logic
// TESTS: Test zoom transitions, haptic feedback, navigation performance, accessibility
// AI-META-END

import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  Animated,
  Dimensions,
  Platform,
  Pressable,
  Text,
} from "react-native";
import { GestureHandlerRootView, PinchGestureHandler } from "react-native-gesture-handler";
import { useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "@tanstack/react-query";

import { Photo } from "@/types";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { Image } from "expo-image";
import { ThemedText } from "@/components/ThemedText";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLoader } from "@/components/SkeletonLoader";

// Gallery-specific imports
import {
  createTimelineHierarchy,
  getZoomLevelForScale,
  timelineToFlashListData,
  type TimelineNode,
  type TimelineLevel,
  type ZoomLevel,
  DEFAULT_ZOOM_LEVELS,
} from "../lib/gallery/timeline-navigation";
import {
  usePinchToZoomGesture,
  GestureStateManager,
  type GestureState,
  DEFAULT_ZOOM_CONFIG,
} from "../lib/gallery/gesture-handler";
import {
  useOptimizedFlashListProps,
  calculateLayoutConfig,
  timelineToOptimizedListData,
  type ListLayoutConfig,
  type ListItem,
} from "../lib/gallery/flash-list-optimization";

interface GalleryScreenProps {
  // Navigation props will be injected by React Navigation
}

interface GalleryState {
  currentZoomLevel: ZoomLevel;
  currentNodeId: string | null;
  timelinePath: { level: TimelineLevel; nodeId: string; title: string }[];
  scale: number;
  isZooming: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default function GalleryScreen({}: GalleryScreenProps) {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  
  // Gallery state
  const [galleryState, setGalleryState] = useState<GalleryState>({
    currentZoomLevel: DEFAULT_ZOOM_LEVELS[3], // Start at photo level
    currentNodeId: null,
    timelinePath: [],
    scale: 1.0,
    isZooming: false,
  });

  // Refs
  const flashListRef = useRef<FlashList<ListItem>>(null);
  const gestureStateManager = useRef(new GestureStateManager());
  const containerSize = useRef({
    width: screenWidth,
    height: screenHeight - headerHeight - tabBarHeight,
  });

  // Fetch photos
  const {
    data: photos = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Photo[]>({
    queryKey: ["photos"],
    queryFn: async () => {
      // This would be replaced with actual API call
      return [];
    },
    refetchOnWindowFocus: true,
  });

  // Create timeline hierarchy
  const timelineHierarchy = useMemo(() => {
    return createTimelineHierarchy(photos);
  }, [photos]);

  // Calculate layout config for current zoom level
  const layoutConfig = useMemo<ListLayoutConfig>(() => {
    return calculateLayoutConfig(
      galleryState.currentZoomLevel,
      containerSize.current.width
    );
  }, [galleryState.currentZoomLevel]);

  // Get data for current zoom level and node
  const currentTimelineData = useMemo(() => {
    if (galleryState.currentNodeId) {
      // Find specific node and get its children at current level
      const node = findNodeInHierarchy(timelineHierarchy, galleryState.currentNodeId);
      if (node && node.children) {
        return node.children.filter(child => child.level === galleryState.currentZoomLevel.level);
      }
    }
    
    // Return top-level nodes matching current zoom level
    return timelineHierarchy.filter(node => node.level === galleryState.currentZoomLevel.level);
  }, [timelineHierarchy, galleryState.currentNodeId, galleryState.currentZoomLevel]);

  // Convert to FlashList data
  const flashListData = useMemo(() => {
    const listData = timelineToOptimizedListData(
      currentTimelineData,
      layoutConfig,
      true // Show headers
    );
    return listData;
  }, [currentTimelineData, layoutConfig]);

  // Setup gesture handling
  const gestureHandler = usePinchToZoomGesture(
    DEFAULT_ZOOM_CONFIG,
    handleZoomChange,
    containerSize.current
  );

  // Get optimized FlashList props
  const { flashListProps, performanceMonitor, lazyLoading } = useOptimizedFlashListProps(
    flashListData,
    layoutConfig,
    {
      ref: flashListRef,
      contentContainerStyle: {
        paddingTop: Spacing.lg,
        paddingBottom: Spacing.fabSize + Spacing["3xl"],
        paddingHorizontal: Spacing.md,
      },
      scrollIndicatorInsets: { bottom: insets.bottom },
      ListEmptyComponent: (
        <View style={styles.emptyContainer}>
          <EmptyState
            image={require("../../assets/images/empty-photos.png")}
            title="No photos found"
            subtitle="Start by adding some photos to your gallery"
          />
        </View>
      ),
    }
  );

  // Handle zoom changes
  function handleZoomChange(gestureState: GestureState) {
    const newZoomLevel = getZoomLevelForScale(gestureState.scale);
    
    if (newZoomLevel.level !== galleryState.currentZoomLevel.level) {
      // Zoom level changed - update gallery state
      setGalleryState(prev => ({
        ...prev,
        currentZoomLevel: newZoomLevel,
        scale: gestureState.scale,
        isZooming: gestureState.isGestureActive,
      }));
      
      // Trigger haptic feedback for level change
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } else {
      // Just update scale within same level
      setGalleryState(prev => ({
        ...prev,
        scale: gestureState.scale,
        isZooming: gestureState.isGestureActive,
      }));
    }
  }

  // Handle timeline navigation
  const handleTimelinePress = useCallback((node: TimelineNode) => {
    // Trigger haptic feedback
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    
    // Navigate to node
    setGalleryState(prev => ({
      ...prev,
      currentNodeId: node.id,
      timelinePath: getTimelinePath(timelineHierarchy, node.id),
    }));
    
    // Animate to new zoom level
    const targetZoomLevel = DEFAULT_ZOOM_LEVELS.find(zl => zl.level === node.level);
    if (targetZoomLevel) {
      gestureHandler.setScale(targetZoomLevel.threshold);
    }
  }, [timelineHierarchy]);

  // Handle back navigation
  const handleBackPress = useCallback(() => {
    if (galleryState.timelinePath.length > 1) {
      // Navigate to parent
      const parentPath = galleryState.timelinePath.slice(0, -1);
      const parentNodeId = parentPath.length > 0 ? parentPath[parentPath.length - 1].nodeId : null;
      
      setGalleryState(prev => ({
        ...prev,
        currentNodeId: parentNodeId,
        timelinePath: parentPath,
      }));
      
      // Trigger haptic feedback
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      return true;
    }
    return false;
  }, [galleryState.timelinePath]);

  // Handle photo press
  const handlePhotoPress = useCallback((photo: Photo) => {
    // Trigger haptic feedback
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    
    // Navigate to photo detail
    // This would integrate with existing navigation
    console.log("Navigate to photo:", photo.id);
  }, []);

  // Reset zoom
  const handleResetZoom = useCallback(() => {
    gestureHandler.reset();
    setGalleryState(prev => ({
      ...prev,
      scale: 1.0,
      currentZoomLevel: DEFAULT_ZOOM_LEVELS[3], // Photo level
      currentNodeId: null,
      timelinePath: [],
    }));
    
    // Trigger haptic feedback
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
  }, []);

  // Render functions for different item types
  const renderItem = useCallback((info: any) => {
    const item = info.item as ListItem;
    
    switch (item.type) {
      case "header":
        return renderHeaderItem(item.data);
      case "year":
        return renderYearItem(item.data, layoutConfig);
      case "month":
        return renderMonthItem(item.data, layoutConfig);
      case "day":
        return renderDayItem(item.data, layoutConfig);
      case "photo":
        return renderPhotoItem(item.data, layoutConfig);
      default:
        return null;
    }
  }, [layoutConfig]);

  // Render header item
  const renderHeaderItem = (data: { title: string; subtitle?: string }) => (
    <View style={[styles.headerItem, { backgroundColor: theme.backgroundSecondary }]}>
      <ThemedText type="h4" style={{ color: theme.textPrimary }}>
        {data.title}
      </ThemedText>
      {data.subtitle && (
        <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          {data.subtitle}
        </ThemedText>
      )}
    </View>
  );

  // Render year item
  const renderYearItem = (node: TimelineNode, config: ListLayoutConfig) => (
    <Pressable
      style={[styles.timelineItem, { 
        width: config.itemWidth, 
        height: config.itemHeight,
        backgroundColor: theme.backgroundPrimary,
        borderColor: theme.border,
      }]}
      onPress={() => handleTimelinePress(node)}
    >
      <View style={styles.timelineItemContent}>
        <ThemedText type="h3" style={{ color: theme.textPrimary }}>
          {node.title}
        </ThemedText>
        <ThemedText style={[styles.timelineItemSubtitle, { color: theme.textSecondary }]}>
          {node.count} photos
        </ThemedText>
      </View>
      {node.thumbnail && (
        <Image
          source={{ uri: node.thumbnail.uri }}
          style={styles.timelineItemThumbnail}
          contentFit="cover"
        />
      )}
    </Pressable>
  );

  // Render month item
  const renderMonthItem = (node: TimelineNode, config: ListLayoutConfig) => (
    <Pressable
      style={[styles.timelineItem, { 
        width: config.itemWidth, 
        height: config.itemHeight,
        backgroundColor: theme.backgroundPrimary,
        borderColor: theme.border,
      }]}
      onPress={() => handleTimelinePress(node)}
    >
      <View style={styles.timelineItemContent}>
        <ThemedText type="h4" style={{ color: theme.textPrimary }}>
          {node.title}
        </ThemedText>
        <ThemedText style={[styles.timelineItemSubtitle, { color: theme.textSecondary }]}>
          {node.count} photos
        </ThemedText>
      </View>
      {node.thumbnail && (
        <Image
          source={{ uri: node.thumbnail.uri }}
          style={styles.timelineItemThumbnail}
          contentFit="cover"
        />
      )}
    </Pressable>
  );

  // Render day item
  const renderDayItem = (node: TimelineNode, config: ListLayoutConfig) => (
    <Pressable
      style={[styles.timelineItem, { 
        width: config.itemWidth, 
        height: config.itemHeight,
        backgroundColor: theme.backgroundPrimary,
        borderColor: theme.border,
      }]}
      onPress={() => handleTimelinePress(node)}
    >
      <View style={styles.timelineItemContent}>
        <ThemedText style={{ color: theme.textPrimary }}>
          {node.title}
        </ThemedText>
        <ThemedText style={[styles.timelineItemSubtitle, { color: theme.textSecondary }]}>
          {node.subtitle}
        </ThemedText>
      </View>
      {node.thumbnail && (
        <Image
          source={{ uri: node.thumbnail.uri }}
          style={styles.timelineItemThumbnail}
          contentFit="cover"
        />
      )}
    </Pressable>
  );

  // Render photo item
  const renderPhotoItem = (photo: Photo, config: ListLayoutConfig) => (
    <Pressable
      style={[styles.photoItem, { 
        width: config.itemWidth, 
        height: config.itemHeight,
      }]}
      onPress={() => handlePhotoPress(photo)}
    >
      <Image
        source={{ uri: photo.uri }}
        style={styles.photoImage}
        contentFit="cover"
        transition={200}
      />
      {photo.isFavorite && (
        <View style={styles.favoriteIcon}>
          <Feather name="heart" size={14} color={theme.accent} />
        </View>
      )}
    </Pressable>
  );

  // Update container size on layout change
  useEffect(() => {
    const updateContainerSize = () => {
      const { width, height } = Dimensions.get("window");
      containerSize.current = {
        width,
        height: height - headerHeight - tabBarHeight,
      };
    };

    const subscription = Dimensions.addEventListener("change", updateContainerSize);
    return () => subscription?.remove();
  }, [headerHeight, tabBarHeight]);

  // Focus effect to reset state when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // Reset to photo level when screen comes into focus
      setGalleryState({
        currentZoomLevel: DEFAULT_ZOOM_LEVELS[3],
        currentNodeId: null,
        timelinePath: [],
        scale: 1.0,
        isZooming: false,
      });
    }, [])
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={{ paddingTop: headerHeight + Spacing.xl }}>
          <SkeletonLoader type="photos" count={15} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.errorContainer}>
          <EmptyState
            image={require("../../assets/images/empty-photos.png")}
            title="Error loading photos"
            subtitle="Please check your connection and try again"
          />
          <Pressable
            style={[styles.retryButton, { backgroundColor: theme.accent }]}
            onPress={() => refetch()}
          >
            <Feather
              name="refresh-cw"
              size={20}
              color={theme.buttonText}
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={{ color: theme.buttonText, fontWeight: "600" }}>
              Retry
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={styles.header}>
        {/* Timeline breadcrumb */}
        {galleryState.timelinePath.length > 0 && (
          <View style={styles.breadcrumb}>
            <Pressable onPress={handleBackPress} style={styles.breadcrumbItem}>
              <Feather name="arrow-left" size={20} color={theme.textPrimary} />
            </Pressable>
            {galleryState.timelinePath.map((item, index) => (
              <View key={item.nodeId} style={styles.breadcrumbItem}>
                <ThemedText style={{ color: theme.textPrimary }}>
                  {item.title}
                </ThemedText>
                {index < galleryState.timelinePath.length - 1 && (
                  <Feather name="chevron-right" size={16} color={theme.textSecondary} />
                )}
              </View>
            ))}
          </View>
        )}
        
        {/* Zoom controls */}
        <View style={styles.zoomControls}>
          <Pressable
            style={[styles.zoomButton, { backgroundColor: theme.backgroundSecondary }]}
            onPress={handleResetZoom}
          >
            <Feather name="maximize-2" size={16} color={theme.textPrimary} />
          </Pressable>
          <ThemedText style={[styles.zoomLevel, { color: theme.textSecondary }]}>
            {galleryState.currentZoomLevel.level.toUpperCase()}
          </ThemedText>
        </View>
      </View>

      {/* Main content with gesture handling */}
      <PinchGestureHandler
        onGestureEvent={gestureHandler.gestureHandler}
        minPointers={2}
        maxPointers={2}
      >
        <Animated.View style={[styles.content, gestureHandler.animatedStyle]}>
          <FlashList
            ref={flashListRef}
            {...flashListProps}
            renderItem={renderItem}
            key={`gallery-${galleryState.currentZoomLevel.level}-${galleryState.currentNodeId}`}
          />
        </Animated.View>
      </PinchGestureHandler>
    </GestureHandlerRootView>
  );
}

// Helper functions
function findNodeInHierarchy(hierarchy: TimelineNode[], nodeId: string): TimelineNode | null {
  for (const node of hierarchy) {
    if (node.id === nodeId) return node;
    if (node.children) {
      const found = findNodeInHierarchy(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

function getTimelinePath(hierarchy: TimelineNode[], nodeId: string): { level: TimelineLevel; nodeId: string; title: string }[] {
  const path: { level: TimelineLevel; nodeId: string; title: string }[] = [];
  
  function searchPath(nodes: TimelineNode[], targetId: string, currentPath: typeof path = []): boolean {
    for (const node of nodes) {
      const newPath = [...currentPath, { level: node.level, nodeId: node.id, title: node.title }];
      
      if (node.id === targetId) {
        path.push(...newPath);
        return true;
      }
      
      if (node.children && searchPath(node.children, targetId, newPath)) {
        return true;
      }
    }
    return false;
  }
  
  searchPath(hierarchy, nodeId);
  return path;
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
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  breadcrumb: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  breadcrumbItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  zoomControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  zoomButton: {
    padding: Spacing.xs,
    borderRadius: 6,
  },
  zoomLevel: {
    fontSize: 12,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  headerItem: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  timelineItem: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.sm,
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  timelineItemContent: {
    flex: 1,
  },
  timelineItemSubtitle: {
    fontSize: 12,
    marginTop: 4,
  },
  timelineItemThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 4,
    marginLeft: Spacing.sm,
  },
  photoItem: {
    marginRight: Spacing.sm,
    marginBottom: Spacing.sm,
    borderRadius: 4,
    overflow: "hidden",
  },
  photoImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#E2E8F0",
  },
  favoriteIcon: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    padding: 4,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 400,
    alignItems: "center",
    justifyContent: "center",
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  retryButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
});
