// AI-META-BEGIN
// AI-META: Crop overlay component with drag handles and aspect ratio selection
// OWNERSHIP: client/components
// ENTRYPOINTS: imported by EditPhotoScreen for crop functionality
// DEPENDENCIES: react-native-gesture-handler, react-native-reanimated
// DANGER: Complex gesture handling; performance-critical for large images
// CHANGE-SAFETY: Maintain interface compatibility; preserve gesture accuracy
// TESTS: Unit tests for gesture calculations, integration tests with EditPhotoScreen
// AI-META-END

import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  useAnimatedGestureHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import { Pressable, Dimensions } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { CropSettings, ASPECT_RATIOS, AspectRatioKey } from "@/lib/photo-editor-actions";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface CropOverlayProps {
  imageWidth: number;
  imageHeight: number;
  onCropChange: (cropSettings: CropSettings) => void;
  initialCrop?: CropSettings;
  aspectRatio?: number | null;
}

interface HandlePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

type HandleType = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top" | "right" | "bottom" | "left";

export default function CropOverlay({
  imageWidth,
  imageHeight,
  onCropChange,
  initialCrop,
  aspectRatio,
}: CropOverlayProps) {
  const { theme } = useTheme();
  
  // Crop area state
  const [cropArea, setCropArea] = useState<CropSettings>(
    initialCrop || {
      originX: imageWidth * 0.1,
      originY: imageHeight * 0.1,
      width: imageWidth * 0.8,
      height: imageHeight * 0.8,
    }
  );

  // Shared values for animation
  const cropX = useSharedValue(cropArea.originX);
  const cropY = useSharedValue(cropArea.originY);
  const cropWidth = useSharedValue(cropArea.width);
  const cropHeight = useSharedValue(cropArea.height);

  // Update shared values when crop area changes
  React.useEffect(() => {
    cropX.value = withSpring(cropArea.originX);
    cropY.value = withSpring(cropArea.originY);
    cropWidth.value = withSpring(cropArea.width);
    cropHeight.value = withSpring(cropArea.height);
  }, [cropArea]);

  // Handle crop change callback
  const updateCrop = useCallback((newCrop: CropSettings) => {
    setCropArea(newCrop);
    onCropChange(newCrop);
  }, [onCropChange]);

  // Handle gesture for corner and edge dragging
  const createGestureHandler = (handleType: HandleType) => {
    return useAnimatedGestureHandler<PanGestureHandlerGestureEvent>({
      onStart: (_, context) => {
        context.startX = cropX.value;
        context.startY = cropY.value;
        context.startWidth = cropWidth.value;
        context.startHeight = cropHeight.value;
      },
      onActive: (event, context) => {
        const { translationX, translationY } = event;
        let newX = context.startX;
        let newY = context.startY;
        let newWidth = context.startWidth;
        let newHeight = context.startHeight;

        switch (handleType) {
          case "top-left":
            newX = Math.max(0, context.startX + translationX);
            newY = Math.max(0, context.startY + translationY);
            newWidth = Math.max(50, context.startWidth - translationX);
            newHeight = Math.max(50, context.startHeight - translationY);
            break;
          case "top-right":
            newY = Math.max(0, context.startY + translationY);
            newWidth = Math.max(50, context.startWidth + translationX);
            newHeight = Math.max(50, context.startHeight - translationY);
            break;
          case "bottom-left":
            newX = Math.max(0, context.startX + translationX);
            newWidth = Math.max(50, context.startWidth - translationX);
            newHeight = Math.max(50, context.startHeight + translationY);
            break;
          case "bottom-right":
            newWidth = Math.max(50, context.startWidth + translationX);
            newHeight = Math.max(50, context.startHeight + translationY);
            break;
          case "top":
            newY = Math.max(0, context.startY + translationY);
            newHeight = Math.max(50, context.startHeight - translationY);
            break;
          case "right":
            newWidth = Math.max(50, context.startWidth + translationX);
            break;
          case "bottom":
            newHeight = Math.max(50, context.startHeight + translationY);
            break;
          case "left":
            newX = Math.max(0, context.startX + translationX);
            newWidth = Math.max(50, context.startWidth - translationX);
            break;
        }

        // Apply aspect ratio constraint if specified
        if (aspectRatio && aspectRatio > 0) {
          if (handleType.includes("right") || handleType.includes("left")) {
            newHeight = newWidth / aspectRatio;
          } else if (handleType.includes("top") || handleType.includes("bottom")) {
            newWidth = newHeight * aspectRatio;
          }
        }

        // Ensure crop stays within image bounds
        newX = Math.max(0, Math.min(newX, imageWidth - newWidth));
        newY = Math.max(0, Math.min(newY, imageHeight - newHeight));
        newWidth = Math.min(newWidth, imageWidth - newX);
        newHeight = Math.min(newHeight, imageHeight - newY);

        cropX.value = newX;
        cropY.value = newY;
        cropWidth.value = newWidth;
        cropHeight.value = newHeight;

        // Update crop area on JS thread
        runOnJS(updateCrop)({
          originX: newX,
          originY: newY,
          width: newWidth,
          height: newHeight,
        });
      },
    });
  };

  // Animated styles for crop area
  const cropAreaStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: cropX.value,
    top: cropY.value,
    width: cropWidth.value,
    height: cropHeight.value,
    borderWidth: 2,
    borderColor: theme.accent,
    backgroundColor: "transparent",
  }));

  // Handle styles
  const getHandleStyle = (handleType: HandleType) => {
    const baseStyle = {
      position: "absolute" as const,
      width: 20,
      height: 20,
      backgroundColor: theme.accent,
      borderRadius: 10,
    };

    switch (handleType) {
      case "top-left":
        return { ...baseStyle, left: -10, top: -10 };
      case "top-right":
        return { ...baseStyle, right: -10, top: -10 };
      case "bottom-left":
        return { ...baseStyle, left: -10, bottom: -10 };
      case "bottom-right":
        return { ...baseStyle, right: -10, bottom: -10 };
      case "top":
        return { ...baseStyle, left: "50%", top: -10, transform: [{ translateX: -10 }] };
      case "right":
        return { ...baseStyle, right: -10, top: "50%", transform: [{ translateY: -10 }] };
      case "bottom":
        return { ...baseStyle, left: "50%", bottom: -10, transform: [{ translateX: -10 }] };
      case "left":
        return { ...baseStyle, left: -10, top: "50%", transform: [{ translateY: -10 }] };
      default:
        return baseStyle;
    }
  };

  // Render crop handles
  const renderHandles = () => {
    const handles: HandleType[] = [
      "top-left", "top-right", "bottom-left", "bottom-right",
      "top", "right", "bottom", "left"
    ];

    return handles.map((handleType) => (
      <PanGestureHandler key={handleType} onGestureEvent={createGestureHandler(handleType)}>
        <Animated.View style={getHandleStyle(handleType)} />
      </PanGestureHandler>
    ));
  };

  // Render grid overlay
  const renderGrid = () => {
    const gridLines = [];
    const thirdWidth = cropArea.width / 3;
    const thirdHeight = cropArea.height / 3;

    // Vertical lines
    for (let i = 1; i < 3; i++) {
      gridLines.push(
        <View
          key={`v-${i}`}
          style={[
            styles.gridLine,
            {
              position: "absolute",
              left: thirdWidth * i,
              top: 0,
              bottom: 0,
              width: 1,
            },
          ]}
        />
      );
    }

    // Horizontal lines
    for (let i = 1; i < 3; i++) {
      gridLines.push(
        <View
          key={`h-${i}`}
          style={[
            styles.gridLine,
            {
              position: "absolute",
              top: thirdHeight * i,
              left: 0,
              right: 0,
              height: 1,
            },
          ]}
        />
      );
    }

    return gridLines;
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={[styles.overlay, { width: imageWidth, height: imageHeight }]}>
        {/* Dark overlay areas */}
        <View style={[styles.darkOverlay, { width: cropArea.originX, height: imageHeight }]} />
        <View style={[styles.darkOverlay, { left: cropArea.originX + cropArea.width, width: imageWidth - cropArea.originX - cropArea.width, height: imageHeight }]} />
        <View style={[styles.darkOverlay, { left: cropArea.originX, top: cropArea.originY, width: cropArea.width, height: cropArea.originY }]} />
        <View style={[styles.darkOverlay, { left: cropArea.originX, top: cropArea.originY + cropArea.height, width: cropArea.width, height: imageHeight - cropArea.originY - cropArea.height }]} />

        {/* Crop area */}
        <Animated.View style={cropAreaStyle}>
          {/* Grid overlay */}
          {renderGrid()}
          
          {/* Handles */}
          {renderHandles()}
        </Animated.View>
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: "relative",
  },
  darkOverlay: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  gridLine: {
    backgroundColor: "rgba(255, 255, 255, 0.5)",
  },
});
