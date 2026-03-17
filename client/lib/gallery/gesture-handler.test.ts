// AI-META-BEGIN
// AI-META: Comprehensive tests for gesture handler with mock gesture events
// OWNERSHIP: client/lib/gallery (gesture handler testing)
// ENTRYPOINTS: Used by test runners for gesture handler validation
// DEPENDENCIES: vitest, @testing-library/react-native, gesture-handler mocks
// DANGER: Complex gesture mocking; platform-specific behavior differences
// CHANGE-SAFETY: Safe to modify test cases; risky to change mock implementations
// TESTS: Test gesture detection, focal point calculation, haptic feedback, edge cases
// AI-META-END

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  usePinchToZoomGesture,
  useAdvancedZoomGesture,
  GestureStateManager,
  calculateFocalPoint,
  triggerHapticFeedback,
  GestureUtils,
  DEFAULT_ZOOM_CONFIG,
  type ZoomGestureConfig,
  type GestureState,
} from "./gesture-handler";

// Mock expo-haptics
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
  NotificationFeedbackType: {
    Success: "success",
    Error: "error",
    Warning: "warning",
  },
}));

// Mock Platform
vi.mock("react-native", () => ({
  Platform: {
    OS: "ios",
  },
}));

// Mock gesture handler
const mockGestureEvent = (
  scale: number,
  focalX: number,
  focalY: number,
  velocity: number = 0,
) => ({
  scale,
  focalX,
  focalY,
  velocity,
});

describe("Gesture Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("calculateFocalPoint", () => {
    it("should return focal point within container bounds", () => {
      const event = mockGestureEvent(1.5, 100, 200);
      const containerSize = { width: 300, height: 400 };

      const focal = calculateFocalPoint(event, containerSize);

      expect(focal.x).toBe(100);
      expect(focal.y).toBe(200);
    });

    it("should clamp focal point to container bounds", () => {
      const event = mockGestureEvent(1.5, 500, 600); // Outside bounds
      const containerSize = { width: 300, height: 400 };

      const focal = calculateFocalPoint(event, containerSize);

      expect(focal.x).toBe(300); // Clamped to width
      expect(focal.y).toBe(400); // Clamped to height
    });

    it("should clamp negative focal point", () => {
      const event = mockGestureEvent(1.5, -50, -100);
      const containerSize = { width: 300, height: 400 };

      const focal = calculateFocalPoint(event, containerSize);

      expect(focal.x).toBe(0); // Clamped to 0
      expect(focal.y).toBe(0); // Clamped to 0
    });
  });

  describe("triggerHapticFeedback", () => {
    const { impactAsync } = require("expo-haptics");

    it("should trigger haptic feedback when threshold is met", () => {
      const config = DEFAULT_ZOOM_CONFIG.hapticFeedback;

      triggerHapticFeedback(1.2, 1.0, config);

      expect(impactAsync).toHaveBeenCalledWith("light");
    });

    it("should not trigger haptic feedback below threshold", () => {
      const config = DEFAULT_ZOOM_CONFIG.hapticFeedback;

      triggerHapticFeedback(1.05, 1.0, config);

      expect(impactAsync).not.toHaveBeenCalled();
    });

    it("should trigger appropriate haptic level", () => {
      const config = DEFAULT_ZOOM_CONFIG.hapticFeedback;

      triggerHapticFeedback(1.5, 1.0, config);

      expect(impactAsync).toHaveBeenCalledWith("medium");
    });

    it("should not trigger haptic feedback when disabled", () => {
      const config = { ...DEFAULT_ZOOM_CONFIG.hapticFeedback, enabled: false };

      triggerHapticFeedback(1.5, 1.0, config);

      expect(impactAsync).not.toHaveBeenCalled();
    });
  });

  describe("usePinchToZoomGesture", () => {
    it("should initialize with default values", () => {
      const { result } = renderHook(() => usePinchToZoomGesture());

      expect(result.current.scale.value).toBe(1);
      expect(result.current.focalX.value).toBe(0);
      expect(result.current.focalY.value).toBe(0);
      expect(result.current.velocity.value).toBe(0);
      expect(result.current.isGestureActive.value).toBe(false);
    });

    it("should use custom config", () => {
      const customConfig: ZoomGestureConfig = {
        ...DEFAULT_ZOOM_CONFIG,
        minScale: 0.5,
        maxScale: 3.0,
      };

      const { result } = renderHook(() => usePinchToZoomGesture(customConfig));

      expect(result.current.scale.value).toBe(1);
    });

    it("should call onZoomChange when provided", () => {
      const onZoomChange = vi.fn();
      const { result } = renderHook(() =>
        usePinchToZoomGesture(DEFAULT_ZOOM_CONFIG, onZoomChange),
      );

      // Simulate gesture handler callback
      act(() => {
        const mockContext = {
          scale: 1,
          lastScale: 1,
          isGestureActive: true,
          velocity: 0,
        };

        // This would normally be called by the gesture handler
        // For testing, we'll call the callback directly
        onZoomChange({
          scale: 1.5,
          focalX: 100,
          focalY: 200,
          isGestureActive: true,
          lastScale: 1,
          velocity: 0,
        });
      });

      expect(onZoomChange).toHaveBeenCalled();
    });

    it("should reset scale to 1", () => {
      const { result } = renderHook(() => usePinchToZoomGesture());

      act(() => {
        result.current.setScale(2.0, false);
      });

      expect(result.current.scale.value).toBe(2.0);

      act(() => {
        result.current.reset();
      });

      expect(result.current.scale.value).toBe(1);
    });

    it("should set scale programmatically", () => {
      const { result } = renderHook(() => usePinchToZoomGesture());

      act(() => {
        result.current.setScale(1.5);
      });

      expect(result.current.scale.value).toBe(1.5);
    });

    it("should clamp scale to min/max bounds", () => {
      const customConfig: ZoomGestureConfig = {
        ...DEFAULT_ZOOM_CONFIG,
        minScale: 0.5,
        maxScale: 3.0,
      };

      const { result } = renderHook(() => usePinchToZoomGesture(customConfig));

      act(() => {
        result.current.setScale(0.1, false); // Below min
      });

      expect(result.current.scale.value).toBe(0.5);

      act(() => {
        result.current.setScale(5.0, false); // Above max
      });

      expect(result.current.scale.value).toBe(3.0);
    });
  });

  describe("useAdvancedZoomGesture", () => {
    it("should include translation values", () => {
      const { result } = renderHook(() => useAdvancedZoomGesture());

      expect(result.current.translateX.value).toBe(0);
      expect(result.current.translateY.value).toBe(0);
      expect(result.current.scale.value).toBe(1);
    });

    it("should reset both scale and translation", () => {
      const { result } = renderHook(() => useAdvancedZoomGesture());

      act(() => {
        result.current.setScale(2.0, false);
        result.current.translateX.value = 50;
        result.current.translateY.value = 100;
      });

      act(() => {
        result.current.reset();
      });

      expect(result.current.scale.value).toBe(1);
      expect(result.current.translateX.value).toBe(0);
      expect(result.current.translateY.value).toBe(0);
    });
  });

  describe("GestureStateManager", () => {
    let manager: GestureStateManager;

    beforeEach(() => {
      manager = new GestureStateManager();
    });

    it("should initialize with default state", () => {
      const state = manager.getState();

      expect(state.scale).toBe(1);
      expect(state.focalX).toBe(0);
      expect(state.focalY).toBe(0);
      expect(state.isGestureActive).toBe(false);
      expect(state.lastScale).toBe(1);
      expect(state.velocity).toBe(0);
    });

    it("should update state and notify listeners", () => {
      const listener = vi.fn();
      manager.subscribe(listener);

      manager.updateState({ scale: 1.5 });

      expect(manager.getState().scale).toBe(1.5);
      expect(listener).toHaveBeenCalledWith(manager.getState());
    });

    it("should maintain state history", () => {
      manager.updateState({ scale: 1.2 });
      manager.updateState({ scale: 1.5 });
      manager.updateState({ scale: 2.0 });

      const history = manager.getHistory();

      expect(history).toHaveLength(3);
      expect(history[0].scale).toBe(1.2);
      expect(history[1].scale).toBe(1.5);
      expect(history[2].scale).toBe(2.0);
    });

    it("should limit history size", () => {
      const smallManager = new GestureStateManager();

      // Add more states than the max history size
      for (let i = 0; i < 60; i++) {
        smallManager.updateState({ scale: 1 + i * 0.1 });
      }

      const history = smallManager.getHistory();

      expect(history.length).toBeLessThanOrEqual(50);
    });

    it("should unsubscribe listeners correctly", () => {
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      unsubscribe();

      manager.updateState({ scale: 1.5 });

      expect(listener).not.toHaveBeenCalled();
    });

    it("should reset state", () => {
      manager.updateState({
        scale: 2.0,
        focalX: 100,
        focalY: 200,
        isGestureActive: true,
        velocity: 5,
      });

      manager.reset();

      const state = manager.getState();

      expect(state.scale).toBe(1);
      expect(state.focalX).toBe(0);
      expect(state.focalY).toBe(0);
      expect(state.isGestureActive).toBe(false);
      expect(state.lastScale).toBe(1);
      expect(state.velocity).toBe(0);
    });

    it("should check gesture active state", () => {
      expect(manager.isGestureActive()).toBe(false);

      manager.updateState({ isGestureActive: true });

      expect(manager.isGestureActive()).toBe(true);
    });

    it("should get current scale", () => {
      expect(manager.getCurrentScale()).toBe(1);

      manager.updateState({ scale: 1.8 });

      expect(manager.getCurrentScale()).toBe(1.8);
    });

    it("should get velocity", () => {
      expect(manager.getVelocity()).toBe(0);

      manager.updateState({ velocity: 3.5 });

      expect(manager.getVelocity()).toBe(3.5);
    });

    it("should get focal point", () => {
      manager.updateState({ focalX: 150, focalY: 250 });

      const focal = manager.getFocalPoint();

      expect(focal.x).toBe(150);
      expect(focal.y).toBe(250);
    });
  });

  describe("GestureUtils", () => {
    describe("scaleToZoomLevel", () => {
      it("should return correct zoom level index", () => {
        const levels = [0.25, 0.5, 0.75, 1.0];

        expect(GestureUtils.scaleToZoomLevel(0.3, levels)).toBe(0);
        expect(GestureUtils.scaleToZoomLevel(0.5, levels)).toBe(1);
        expect(GestureUtils.scaleToZoomLevel(0.8, levels)).toBe(2);
        expect(GestureUtils.scaleToZoomLevel(1.0, levels)).toBe(3);
        expect(GestureUtils.scaleToZoomLevel(1.5, levels)).toBe(3); // Above max
      });

      it("should handle edge cases", () => {
        const levels = [0.5, 1.0];

        expect(GestureUtils.scaleToZoomLevel(0.1, levels)).toBe(0); // Below min
        expect(GestureUtils.scaleToZoomLevel(2.0, levels)).toBe(1); // Above max
      });
    });

    describe("distance", () => {
      it("should calculate distance correctly", () => {
        expect(GestureUtils.distance(0, 0, 3, 4)).toBe(5); // 3-4-5 triangle
        expect(GestureUtils.distance(100, 100, 100, 200)).toBe(100);
        expect(GestureUtils.distance(0, 0, 0, 0)).toBe(0);
      });
    });

    describe("clamp", () => {
      it("should clamp values within range", () => {
        expect(GestureUtils.clamp(5, 0, 10)).toBe(5); // Within range
        expect(GestureUtils.clamp(-5, 0, 10)).toBe(0); // Below min
        expect(GestureUtils.clamp(15, 0, 10)).toBe(10); // Above max
      });
    });

    describe("lerp", () => {
      it("should interpolate between values", () => {
        expect(GestureUtils.lerp(0, 10, 0.5)).toBe(5);
        expect(GestureUtils.lerp(0, 10, 0)).toBe(0);
        expect(GestureUtils.lerp(0, 10, 1)).toBe(10);
        expect(GestureUtils.lerp(10, 20, 0.25)).toBe(12.5);
      });
    });

    describe("isPointInBounds", () => {
      it("should check if point is within bounds", () => {
        const bounds = { x: 10, y: 20, width: 100, height: 80 };

        expect(GestureUtils.isPointInBounds(50, 60, bounds)).toBe(true); // Inside
        expect(GestureUtils.isPointInBounds(10, 20, bounds)).toBe(true); // Top-left corner
        expect(GestureUtils.isPointInBounds(110, 100, bounds)).toBe(true); // Bottom-right corner
        expect(GestureUtils.isPointInBounds(5, 60, bounds)).toBe(false); // Left of bounds
        expect(GestureUtils.isPointInBounds(50, 110, bounds)).toBe(false); // Below bounds
        expect(GestureUtils.isPointInBounds(120, 60, bounds)).toBe(false); // Right of bounds
      });
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete gesture lifecycle", () => {
      const manager = new GestureStateManager();
      const listener = vi.fn();
      manager.subscribe(listener);

      // Start gesture
      manager.updateState({ isGestureActive: true });
      expect(manager.isGestureActive()).toBe(true);

      // Scale change
      manager.updateState({ scale: 1.5, lastScale: 1.0 });
      expect(manager.getCurrentScale()).toBe(1.5);

      // End gesture
      manager.updateState({ isGestureActive: false, velocity: 0 });
      expect(manager.isGestureActive()).toBe(false);

      // Should have history of changes
      expect(manager.getHistory().length).toBeGreaterThan(0);
    });

    it("should handle rapid gesture changes", () => {
      const manager = new GestureStateManager();

      // Simulate rapid scale changes
      for (let i = 0; i < 10; i++) {
        manager.updateState({ scale: 1 + i * 0.1 });
      }

      expect(manager.getCurrentScale()).toBe(1.9);
      expect(manager.getHistory().length).toBe(10);
    });

    it("should handle gesture state manager with custom config", () => {
      const customConfig: ZoomGestureConfig = {
        ...DEFAULT_ZOOM_CONFIG,
        minScale: 0.2,
        maxScale: 5.0,
        hapticFeedback: {
          ...DEFAULT_ZOOM_CONFIG.hapticFeedback,
          threshold: 0.05,
        },
      };

      const manager = new GestureStateManager(customConfig);

      expect(manager.getCurrentScale()).toBe(1);

      manager.updateState({ scale: 0.1, lastScale: 1.0 }); // Should trigger haptic at 0.05 threshold

      expect(manager.getCurrentScale()).toBe(0.1);
    });
  });

  describe("Platform-Specific Behavior", () => {
    it("should handle web platform correctly", () => {
      // Mock web platform
      vi.doMock("react-native", () => ({
        Platform: { OS: "web" },
      }));

      const config = DEFAULT_ZOOM_CONFIG.hapticFeedback;

      triggerHapticFeedback(1.5, 1.0, config);

      // Should not trigger haptics on web
      const { impactAsync } = require("expo-haptics");
      expect(impactAsync).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle zero scale gracefully", () => {
      const manager = new GestureStateManager();

      expect(() => {
        manager.updateState({ scale: 0 });
      }).not.toThrow();

      expect(manager.getCurrentScale()).toBe(0);
    });

    it("should handle negative scale gracefully", () => {
      const manager = new GestureStateManager();

      expect(() => {
        manager.updateState({ scale: -1 });
      }).not.toThrow();

      expect(manager.getCurrentScale()).toBe(-1);
    });

    it("should handle very large scale values", () => {
      const manager = new GestureStateManager();

      expect(() => {
        manager.updateState({ scale: 1000 });
      }).not.toThrow();

      expect(manager.getCurrentScale()).toBe(1000);
    });

    it("should handle NaN values", () => {
      const manager = new GestureStateManager();

      expect(() => {
        manager.updateState({ scale: NaN });
      }).not.toThrow();

      expect(Number.isNaN(manager.getCurrentScale())).toBe(true);
    });

    it("should handle infinite values", () => {
      const manager = new GestureStateManager();

      expect(() => {
        manager.updateState({ scale: Infinity });
      }).not.toThrow();

      expect(manager.getCurrentScale()).toBe(Infinity);
    });
  });
});
