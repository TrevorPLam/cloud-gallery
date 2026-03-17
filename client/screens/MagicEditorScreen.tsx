// AI-META-BEGIN
// AI-META: Magic Editor Screen with generative AI object removal and brush tools
// OWNERSHIP: client/screens
// ENTRYPOINTS: navigated from PhotoDetailScreen and Gallery
// DEPENDENCIES: React Native, React Native Skia, inpainting-model.ts, privacy-processing.ts
// DANGER: Generative AI editing - requires GDPR consent and privacy controls
// CHANGE-SAFETY: Maintain React Navigation patterns, preserve Skia canvas compatibility
// TESTS: client/screens/MagicEditorScreen.test.tsx
// AI-META-END

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  Modal,
  Image,
  PanResponder,
} from "react-native";
import {
  getInpaintingModelService,
  InpaintingRequest,
  InpaintingMask,
} from "../lib/ai/inpainting-model";
import {
  getPrivacyProcessingService,
  DataCategory,
} from "../lib/ai/privacy-processing";
import { StackNavigationProp } from "@react-navigation/stack";

// ─────────────────────────────────────────────────────────
// TYPES AND INTERFACES
// ─────────────────────────────────────────────────────────

export interface MagicEditorRouteParams {
  photoUri: string;
  photoId: string;
  imageData?: Uint8Array;
  imageWidth?: number;
  imageHeight?: number;
}

export type MagicEditorNavigationProp = StackNavigationProp<any, "MagicEditor">;

interface BrushStroke {
  id: string;
  points: { x: number; y: number }[];
  size: number;
  opacity: number;
  timestamp: number;
}

interface EditingState {
  isDrawing: boolean;
  currentStroke: BrushStroke | null;
  strokes: BrushStroke[];
  brushSize: number;
  brushOpacity: number;
  previewMode: "original" | "mask" | "result";
  isProcessing: boolean;
  processingProgress: number;
  resultImage: Uint8Array | null;
}

// ─────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────

const MagicEditorScreen: React.FC<{
  route: { params: MagicEditorRouteParams };
  navigation: MagicEditorNavigationProp;
}> = ({ route, navigation }) => {
  const { photoUri, photoId, imageData, imageWidth, imageHeight } =
    route.params;

  // Canvas and image refs
  const canvasRef = useRef<View>(null);
  const imageRef = useRef<Image>(null);

  // State management
  const [editingState, setEditingState] = useState<EditingState>({
    isDrawing: false,
    currentStroke: null,
    strokes: [],
    brushSize: 20,
    brushOpacity: 0.8,
    previewMode: "original",
    isProcessing: false,
    processingProgress: 0,
    resultImage: null,
  });

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [imageDimensions, setImageDimensions] = useState({
    width: 0,
    height: 0,
  });
  const [showSettings, setShowSettings] = useState(false);

  // Services
  const inpaintingService = getInpaintingModelService();
  const privacyService = getPrivacyProcessingService();

  // PanResponder for touch handling
  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => !editingState.isProcessing,
    onMoveShouldSetPanResponder: () => !editingState.isProcessing,
    onPanResponderGrant: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      handleTouchStart(locationX, locationY);
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      handleTouchMove(locationX, locationY);
    },
    onPanResponderRelease: () => {
      handleTouchEnd();
    },
  });

  // ─── INITIALIZATION ──────────────────────────────────────

  useEffect(() => {
    const { width: screenWidth, height: screenHeight } =
      Dimensions.get("window");
    setDimensions({ width: screenWidth, height: screenHeight });

    // Calculate image dimensions to fit screen
    if (imageWidth && imageHeight) {
      const aspectRatio = imageWidth / imageHeight;
      let displayWidth = screenWidth;
      let displayHeight = screenWidth / aspectRatio;

      if (displayHeight > screenHeight * 0.7) {
        displayHeight = screenHeight * 0.7;
        displayWidth = displayHeight * aspectRatio;
      }

      setImageDimensions({ width: displayWidth, height: displayHeight });
    }

    // Check privacy consent
    checkPrivacyConsent();
  }, [imageWidth, imageHeight]);

  // ─── PRIVACY CONSENT ───────────────────────────────────

  const checkPrivacyConsent = async () => {
    try {
      const hasConsent = await privacyService.requestConsent(
        DataCategory.IMAGE_DATA,
        "generative_ai_photo_editing",
      );

      if (!hasConsent) {
        Alert.alert(
          "Privacy Consent Required",
          "To use the Magic Editor, we need your consent to process images on your device. No data will leave your device.",
          [
            { text: "Cancel", onPress: () => navigation.goBack() },
            { text: "Grant Consent", onPress: () => {} },
          ],
        );
      }
    } catch (error) {
      console.error("Failed to check privacy consent:", error);
    }
  };

  // ─── BRUSH INTERACTION HANDLERS ─────────────────────────

  const handleTouchStart = useCallback(
    (x: number, y: number) => {
      if (editingState.isProcessing) return;

      const newStroke: BrushStroke = {
        id: `stroke_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        points: [{ x, y }],
        size: editingState.brushSize,
        opacity: editingState.brushOpacity,
        timestamp: Date.now(),
      };

      setEditingState((prev) => ({
        ...prev,
        isDrawing: true,
        currentStroke: newStroke,
      }));
    },
    [
      editingState.brushSize,
      editingState.brushOpacity,
      editingState.isProcessing,
    ],
  );

  const handleTouchMove = useCallback(
    (x: number, y: number) => {
      if (
        !editingState.isDrawing ||
        !editingState.currentStroke ||
        editingState.isProcessing
      )
        return;

      setEditingState((prev) => ({
        ...prev,
        currentStroke: prev.currentStroke
          ? {
              ...prev.currentStroke,
              points: [...prev.currentStroke.points, { x, y }],
            }
          : null,
      }));
    },
    [
      editingState.isDrawing,
      editingState.currentStroke,
      editingState.isProcessing,
    ],
  );

  const handleTouchEnd = useCallback(() => {
    if (
      !editingState.isDrawing ||
      !editingState.currentStroke ||
      editingState.isProcessing
    )
      return;

    setEditingState((prev) => ({
      ...prev,
      isDrawing: false,
      currentStroke: null,
      strokes: [...prev.strokes, prev.currentStroke!],
    }));
  }, [
    editingState.isDrawing,
    editingState.currentStroke,
    editingState.isProcessing,
  ]);

  // ─── MASK GENERATION ─────────────────────────────────────

  const generateMask = useCallback((): InpaintingMask | null => {
    if (editingState.strokes.length === 0) return null;

    const maskWidth = imageDimensions.width;
    const maskHeight = imageDimensions.height;
    const maskData = new Uint8Array(maskWidth * maskHeight).fill(0);

    // Find bounding box of all strokes
    let minX = maskWidth,
      maxX = 0,
      minY = maskHeight,
      maxY = 0;

    editingState.strokes.forEach((stroke) => {
      stroke.points.forEach((point) => {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      });
    });

    // Add padding to bounding box
    const padding = 10;
    minX = Math.max(0, minX - padding);
    maxX = Math.min(maskWidth, maxX + padding);
    minY = Math.max(0, minY - padding);
    maxY = Math.min(maskHeight, maxY + padding);

    // Fill mask based on brush strokes
    editingState.strokes.forEach((stroke) => {
      stroke.points.forEach((point) => {
        const brushRadius = stroke.size / 2;

        // Fill circular brush area
        for (let dy = -brushRadius; dy <= brushRadius; dy++) {
          for (let dx = -brushRadius; dx <= brushRadius; dx++) {
            const px = Math.round(point.x + dx);
            const py = Math.round(point.y + dy);

            if (px >= 0 && px < maskWidth && py >= 0 && py < maskHeight) {
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance <= brushRadius) {
                const maskIndex = py * maskWidth + px;
                const opacity = stroke.opacity * (1 - distance / brushRadius);
                maskData[maskIndex] = Math.max(
                  maskData[maskIndex],
                  Math.round(opacity * 255),
                );
              }
            }
          }
        }
      });
    });

    return {
      mask: maskData,
      width: maskWidth,
      height: maskHeight,
      boundingBox: {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      },
    };
  }, [editingState.strokes, imageDimensions]);

  // ─── AI PROCESSING ─────────────────────────────────────────

  const processInpainting = useCallback(async () => {
    const mask = generateMask();
    if (!mask || !imageData) {
      Alert.alert(
        "No Selection",
        "Please paint over the objects you want to remove.",
      );
      return;
    }

    try {
      setEditingState((prev) => ({
        ...prev,
        isProcessing: true,
        processingProgress: 0,
      }));

      // Protect image data with privacy service
      const { protectedData, recordId } = await privacyService.protectData(
        imageData,
        DataCategory.IMAGE_DATA,
        `inpainting_${photoId}`,
      );

      // Create inpainting request
      const request: InpaintingRequest = {
        imageData: protectedData,
        imageWidth: imageWidth!,
        imageHeight: imageHeight!,
        mask,
        contextPrompt: "remove selected objects naturally",
        quality: "balanced",
      };

      setEditingState((prev) => ({ ...prev, processingProgress: 25 }));

      // Process with AI model
      const result = await inpaintingService.inpaint(request);

      setEditingState((prev) => ({ ...prev, processingProgress: 75 }));

      // Unprotect result data
      const unprotectedResult = await privacyService.unprotectData(
        result.imageData,
        DataCategory.GENERATIVE_OUTPUT,
        recordId,
      );

      setEditingState((prev) => ({
        ...prev,
        resultImage: unprotectedResult,
        previewMode: "result",
        isProcessing: false,
        processingProgress: 100,
      }));

      // Clean up input data
      await privacyService.deleteData(recordId);
    } catch (error) {
      console.error("Inpainting failed:", error);
      setEditingState((prev) => ({ ...prev, isProcessing: false }));

      Alert.alert(
        "Processing Failed",
        "Failed to process the image. Please try again.",
        [{ text: "OK" }],
      );
    }
  }, [
    generateMask,
    imageData,
    imageWidth,
    imageHeight,
    photoId,
    inpaintingService,
    privacyService,
  ]);

  // ─── UNDO/REDO FUNCTIONALITY ─────────────────────────────

  const undoLastStroke = useCallback(() => {
    if (editingState.strokes.length > 0 && !editingState.isProcessing) {
      setEditingState((prev) => ({
        ...prev,
        strokes: prev.strokes.slice(0, -1),
      }));
    }
  }, [editingState.strokes, editingState.isProcessing]);

  const clearAllStrokes = useCallback(() => {
    if (!editingState.isProcessing) {
      setEditingState((prev) => ({
        ...prev,
        strokes: [],
        currentStroke: null,
        resultImage: null,
        previewMode: "original",
      }));
    }
  }, [editingState.isProcessing]);

  // ─── RENDER HELPERS ─────────────────────────────────────

  const renderBrushStrokes = () => {
    if (editingState.previewMode !== "mask") return null;

    return editingState.strokes.map((stroke) => (
      <View key={stroke.id} style={styles.brushStrokeContainer}>
        {stroke.points.map((point, index) => (
          <View
            key={index}
            style={[
              styles.brushPoint,
              {
                left: point.x - stroke.size / 2,
                top: point.y - stroke.size / 2,
                width: stroke.size,
                height: stroke.size,
                borderRadius: stroke.size / 2,
                backgroundColor: `rgba(255, 0, 0, ${editingState.brushOpacity * 0.5})`,
              },
            ]}
          />
        ))}
      </View>
    ));
  };

  const renderImage = () => {
    if (imageDimensions.width === 0) return null;

    let imageSource = photoUri;

    if (editingState.previewMode === "result" && editingState.resultImage) {
      // Convert result image data to display format
      // This would require additional implementation to convert Uint8Array to displayable image
      // For now, show original image
    }

    return (
      <Image
        ref={imageRef}
        source={{ uri: imageSource }}
        style={[
          styles.displayImage,
          { width: imageDimensions.width, height: imageDimensions.height },
        ]}
        resizeMode="contain"
      />
    );
  };

  // ─── MAIN RENDER ─────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.headerButton}>Cancel</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Magic Editor</Text>

        <TouchableOpacity onPress={() => setShowSettings(true)}>
          <Text style={styles.headerButton}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas Area */}
      <View style={styles.canvasContainer}>
        <View
          ref={canvasRef}
          style={[
            styles.canvas,
            { width: imageDimensions.width, height: imageDimensions.height },
          ]}
          {...panResponder.panHandlers}
        >
          {renderImage()}
          {renderBrushStrokes()}
        </View>
      </View>

      {/* Processing Overlay */}
      {editingState.isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.processingText}>
            Processing... {editingState.processingProgress}%
          </Text>
        </View>
      )}

      {/* Bottom Toolbar */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.toolButton} onPress={undoLastStroke}>
          <Text style={styles.toolButtonText}>↶ Undo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolButton} onPress={clearAllStrokes}>
          <Text style={styles.toolButtonText}>Clear</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toolButton,
            styles.primaryButton,
            editingState.strokes.length === 0 && styles.disabledButton,
          ]}
          onPress={processInpainting}
          disabled={
            editingState.strokes.length === 0 || editingState.isProcessing
          }
        >
          <Text style={styles.primaryButtonText}>
            {editingState.isProcessing ? "Processing..." : "Magic Erase"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Brush Settings</Text>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>
                Brush Size: {editingState.brushSize}
              </Text>
              <View style={styles.sliderContainer}>
                {/* Brush size slider would go here */}
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>
                Opacity: {Math.round(editingState.brushOpacity * 100)}%
              </Text>
              <View style={styles.sliderContainer}>
                {/* Opacity slider would go here */}
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Preview Mode</Text>
              <View style={styles.previewModeButtons}>
                {(["original", "mask", "result"] as const).map((mode) => (
                  <TouchableOpacity
                    key={mode}
                    style={[
                      styles.previewModeButton,
                      editingState.previewMode === mode &&
                        styles.activePreviewMode,
                    ]}
                    onPress={() =>
                      setEditingState((prev) => ({
                        ...prev,
                        previewMode: mode,
                      }))
                    }
                  >
                    <Text style={styles.previewModeButtonText}>
                      {mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    backgroundColor: "#1a1a1a",
  },
  headerButton: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  canvasContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  canvas: {
    position: "relative",
    backgroundColor: "#000",
  },
  displayImage: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  brushStrokeContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  brushPoint: {
    position: "absolute",
  },
  processingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  processingText: {
    color: "#fff",
    marginTop: 10,
    fontSize: 16,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#1a1a1a",
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  toolButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  toolButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    backgroundColor: "#007AFF",
  },
  disabledButton: {
    backgroundColor: "#333",
    opacity: 0.5,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 20,
    width: "80%",
    maxWidth: 300,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 20,
    textAlign: "center",
  },
  settingRow: {
    marginBottom: 20,
  },
  settingLabel: {
    color: "#fff",
    fontSize: 16,
    marginBottom: 10,
  },
  sliderContainer: {
    height: 40,
    justifyContent: "center",
  },
  previewModeButtons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  previewModeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "#333",
  },
  activePreviewMode: {
    backgroundColor: "#007AFF",
  },
  previewModeButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  closeButton: {
    marginTop: 20,
    paddingVertical: 12,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default MagicEditorScreen;
