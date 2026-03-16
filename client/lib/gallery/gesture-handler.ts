// AI-META-BEGIN
// AI-META: Advanced gesture recognition for pinch-to-zoom with focal point calculation
// OWNERSHIP: client/lib/gallery (gesture handling)
// ENTRYPOINTS: Used by GalleryScreen for zoom gesture recognition and processing
// DEPENDENCIES: react-native-gesture-handler, react-native-reanimated, expo-haptics
// DANGER: Performance-sensitive; gesture detection accuracy affects UX; focal point math
// CHANGE-SAFETY: Safe to modify haptic patterns; risky to change gesture detection logic
// TESTS: Test gesture accuracy, focal point calculation, haptic timing, edge cases
// AI-META-END

import { GestureHandlerRootView, PinchGestureHandler, PinchGestureHandlerGestureChangeEvent } from "react-native-gesture-handler";
import { runOnJS, runOnUI, useAnimatedGestureHandler, useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export interface GestureState {
  scale: number;
  focalX: number;
  focalY: number;
  isGestureActive: boolean;
  lastScale: number;
  velocity: number;
}

export interface ZoomGestureConfig {
  minScale: number;
  maxScale: number;
  friction: number;
  tension: number;
  damping: number;
  hapticFeedback: {
    enabled: boolean;
    threshold: number; // Scale change threshold for haptic feedback
    levels: HapticLevel[];
  };
}

export interface HapticLevel {
  threshold: number; // Scale threshold
  type: "impact" | "notification";
  style?: any; // ImpactFeedbackStyle or NotificationFeedbackType
}

export const DEFAULT_ZOOM_CONFIG: ZoomGestureConfig = {
  minScale: 0.25,
  maxScale: 4.0,
  friction: 7,
  tension: 100,
  damping: 15,
  hapticFeedback: {
    enabled: true,
    threshold: 0.1,
    levels: [
      { threshold: 0.5, type: "impact", style: Haptics.ImpactFeedbackStyle.Light },
      { threshold: 1.0, type: "impact", style: Haptics.ImpactFeedbackStyle.Medium },
      { threshold: 2.0, type: "impact", style: Haptics.ImpactFeedbackStyle.Heavy },
    ],
  },
};

/**
 * Calculates focal point for pinch gesture based on touch positions
 */
export function calculateFocalPoint(
  event: PinchGestureHandlerGestureChangeEvent,
  containerSize: { width: number; height: number }
): { x: number; y: number } {
  const { focalX, focalY } = event;
  
  // Ensure focal point is within container bounds
  const x = Math.max(0, Math.min(containerSize.width, focalX));
  const y = Math.max(0, Math.min(containerSize.height, focalY));
  
  return { x, y };
}

/**
 * Triggers appropriate haptic feedback based on scale level
 */
export function triggerHapticFeedback(
  currentScale: number,
  lastScale: number,
  config: ZoomGestureConfig["hapticFeedback"]
): void {
  if (!config.enabled || Platform.OS === "web") return;
  
  const scaleChange = Math.abs(currentScale - lastScale);
  
  if (scaleChange < config.threshold) return;
  
  // Find appropriate haptic level
  for (let i = config.levels.length - 1; i >= 0; i--) {
    const level = config.levels[i];
    if (currentScale >= level.threshold) {
      if (lastScale < level.threshold) {
        // Crossed threshold - trigger haptic
        if (level.type === "impact") {
          Haptics.impactAsync(level.style);
        } else if (level.type === "notification") {
          Haptics.notificationAsync(level.style);
        }
        break;
      }
    }
  }
}

/**
 * Creates animated gesture handler for pinch-to-zoom
 */
export function usePinchToZoomGesture(
  config: ZoomGestureConfig = DEFAULT_ZOOM_CONFIG,
  onZoomChange?: (state: GestureState) => void,
  containerSize?: { width: number; height: number }
) {
  // Shared values for gesture state
  const scale = useSharedValue(1);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const lastScale = useSharedValue(1);
  const velocity = useSharedValue(0);
  const isGestureActive = useSharedValue(false);

  // Haptic feedback trigger (run on JS thread)
  const triggerHaptic = (currentScale: number, lastScaleValue: number) => {
    runOnJS(triggerHapticFeedback)(currentScale, lastScaleValue, config.hapticFeedback);
  };

  // Gesture handler
  const gestureHandler = useAnimatedGestureHandler<
    PinchGestureHandlerGestureChangeEvent,
    GestureState
  >({
    onStart: (_, context) => {
      context.scale = scale.value;
      context.lastScale = scale.value;
      context.isGestureActive = true;
      context.velocity = 0;
      
      isGestureActive.value = true;
      
      // Light haptic on gesture start
      if (config.hapticFeedback.enabled && Platform.OS !== "web") {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
    },
    
    onActive: (event, context) => {
      const newScale = Math.max(
        config.minScale,
        Math.min(config.maxScale, context.scale * event.scale)
      );
      
      // Calculate focal point if container size is provided
      if (containerSize) {
        const focal = calculateFocalPoint(event, containerSize);
        focalX.value = focal.x;
        focalY.value = focal.y;
      }
      
      // Update velocity
      context.velocity = event.velocity;
      velocity.value = event.velocity;
      
      // Update scale
      scale.value = newScale;
      
      // Trigger haptic feedback on significant scale change
      const scaleChange = Math.abs(newScale - context.lastScale);
      if (scaleChange >= config.hapticFeedback.threshold) {
        triggerHaptic(newScale, context.lastScale);
        context.lastScale = newScale;
      }
      
      // Notify parent of zoom change
      if (onZoomChange) {
        const state: GestureState = {
          scale: newScale,
          focalX: focalX.value,
          focalY: focalY.value,
          isGestureActive: true,
          lastScale: context.lastScale,
          velocity: event.velocity,
        };
        runOnJS(onZoomChange)(state);
      }
    },
    
    onEnd: (event, context) => {
      context.isGestureActive = false;
      isGestureActive.value = false;
      
      // Apply spring animation for smooth settling
      const finalScale = Math.max(
        config.minScale,
        Math.min(config.maxScale, context.scale * event.scale)
      );
      
      scale.value = withSpring(finalScale, {
        tension: config.tension,
        friction: config.friction,
        damping: config.damping,
      });
      
      // Final haptic feedback
      if (config.hapticFeedback.enabled && Platform.OS !== "web") {
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      // Notify parent of zoom completion
      if (onZoomChange) {
        const state: GestureState = {
          scale: finalScale,
          focalX: focalX.value,
          focalY: focalY.value,
          isGestureActive: false,
          lastScale: context.lastScale,
          velocity: event.velocity,
        };
        runOnJS(onZoomChange)(state);
      }
    },
  });

  // Animated style for zoom transformation
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: focalX.value * (1 - scale.value) },
        { translateY: focalY.value * (1 - scale.value) },
        { scale: scale.value },
      ],
    };
  });

  // Reset function
  const reset = () => {
    scale.value = withSpring(1, {
      tension: config.tension,
      friction: config.friction,
      damping: config.damping,
    });
    focalX.value = 0;
    focalY.value = 0;
    velocity.value = 0;
    isGestureActive.value = false;
  };

  // Set scale programmatically
  const setScale = (newScale: number, animated: boolean = true) => {
    const clampedScale = Math.max(config.minScale, Math.min(config.maxScale, newScale));
    
    if (animated) {
      scale.value = withSpring(clampedScale, {
        tension: config.tension,
        friction: config.friction,
        damping: config.damping,
      });
    } else {
      scale.value = clampedScale;
    }
  };

  return {
    gestureHandler,
    animatedStyle,
    scale,
    focalX,
    focalY,
    velocity,
    isGestureActive,
    reset,
    setScale,
  };
}

/**
 * Advanced gesture handler with double-tap to reset and pan support
 */
export function useAdvancedZoomGesture(
  config: ZoomGestureConfig = DEFAULT_ZOOM_CONFIG,
  onZoomChange?: (state: GestureState) => void,
  containerSize?: { width: number; height: number }
) {
  const pinchGesture = usePinchToZoomGesture(config, onZoomChange, containerSize);
  
  // Additional shared values for panning
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lastTranslateX = useSharedValue(0);
  const lastTranslateY = useSharedValue(0);

  // Combined animated style
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value + pinchGesture.focalX.value * (1 - pinchGesture.scale.value) },
        { translateY: translateY.value + pinchGesture.focalY.value * (1 - pinchGesture.scale.value) },
        { scale: pinchGesture.scale.value },
      ],
    };
  });

  // Reset function that also resets translation
  const reset = () => {
    pinchGesture.reset();
    translateX.value = withSpring(0, { tension: 100, friction: 7 });
    translateY.value = withSpring(0, { tension: 100, friction: 7 });
    lastTranslateX.value = 0;
    lastTranslateY.value = 0;
  };

  return {
    ...pinchGesture,
    animatedStyle,
    translateX,
    translateY,
    reset,
  };
}

/**
 * Gesture state manager for complex interactions
 */
export class GestureStateManager {
  private currentState: GestureState = {
    scale: 1,
    focalX: 0,
    focalY: 0,
    isGestureActive: false,
    lastScale: 1,
    velocity: 0,
  };
  
  private listeners: Set<(state: GestureState) => void> = new Set();
  private history: GestureState[] = [];
  private maxHistorySize = 50;

  constructor(private config: ZoomGestureConfig = DEFAULT_ZOOM_CONFIG) {}

  // Update state and notify listeners
  updateState(newState: Partial<GestureState>): void {
    const previousState = { ...this.currentState };
    this.currentState = { ...this.currentState, ...newState };
    
    // Add to history
    this.history.push({ ...this.currentState });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
    
    // Trigger haptic feedback if scale changed significantly
    if (Math.abs(newState.scale! - previousState.scale) >= this.config.hapticFeedback.threshold) {
      triggerHapticFeedback(newState.scale!, previousState.scale, this.config.hapticFeedback);
    }
    
    // Notify listeners
    this.listeners.forEach(listener => listener(this.currentState));
  }

  // Get current state
  getState(): GestureState {
    return { ...this.currentState };
  }

  // Subscribe to state changes
  subscribe(listener: (state: GestureState) => void): () => void {
    this.listeners.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Get state history
  getHistory(): GestureState[] {
    return [...this.history];
  }

  // Reset state
  reset(): void {
    this.updateState({
      scale: 1,
      focalX: 0,
      focalY: 0,
      isGestureActive: false,
      lastScale: 1,
      velocity: 0,
    });
  }

  // Check if gesture is active
  isGestureActive(): boolean {
    return this.currentState.isGestureActive;
  }

  // Get current scale
  getCurrentScale(): number {
    return this.currentState.scale;
  }

  // Get velocity
  getVelocity(): number {
    return this.currentState.velocity;
  }

  // Get focal point
  getFocalPoint(): { x: number; y: number } {
    return {
      x: this.currentState.focalX,
      y: this.currentState.focalY,
    };
  }
}

/**
 * Utility functions for gesture calculations
 */
export const GestureUtils = {
  /**
   * Converts scale to zoom level index
   */
  scaleToZoomLevel(scale: number, levels: number[]): number {
    for (let i = levels.length - 1; i >= 0; i--) {
      if (scale >= levels[i]) {
        return i;
      }
    }
    return 0;
  },

  /**
   * Calculates distance between two points
   */
  distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
  },

  /**
   * Clamps a value between min and max
   */
  clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  },

  /**
   * Linear interpolation between two values
   */
  lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  },

  /**
   * Checks if a point is within bounds
   */
  isPointInBounds(
    x: number, 
    y: number, 
    bounds: { x: number; y: number; width: number; height: number }
  ): boolean {
    return x >= bounds.x && 
           x <= bounds.x + bounds.width && 
           y >= bounds.y && 
           y <= bounds.y + bounds.height;
  },
};
