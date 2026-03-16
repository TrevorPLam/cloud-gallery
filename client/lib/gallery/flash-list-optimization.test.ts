// AI-META-BEGIN
// AI-META: Comprehensive tests for FlashList optimization with performance validation
// OWNERSHIP: client/lib/gallery (flash-list optimization testing)
// ENTRYPOINTS: Used by test runners for optimization validation
// DEPENDENCIES: vitest, @testing-library/react-hooks, performance mocks
// DANGER: Complex performance testing; memory measurement accuracy varies by environment
// CHANGE-SAFETY: Safe to modify test thresholds; risky to change performance measurement logic
// TESTS: Test layout calculation, lazy loading, memory management, performance metrics
// AI-META-END

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  calculateLayoutConfig,
  timelineToOptimizedListData,
  usePerformanceMonitor,
  useLazyLoading,
  useDynamicItemHeights,
  useOptimizedFlashListProps,
  MemoryManager,
  PerformanceUtils,
  memoryManager,
  DEFAULT_LAZY_LOADING,
  type ListLayoutConfig,
  type ListItem,
  type TimelineNode,
  type ZoomLevel,
} from "./flash-list-optimization";

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1024 * 1024 * 50, // 50MB
  },
};

// Mock navigator
const mockNavigator = {
  deviceMemory: 8,
  hardwareConcurrency: 4,
};

// Mock window dimensions
const mockWindowDimensions = {
  width: 375,
  height: 667,
};

// Replace global objects
Object.defineProperty(global, "performance", { value: mockPerformance });
Object.defineProperty(global, "navigator", { value: mockNavigator });

// Mock react-native useWindowDimensions
vi.mock("react-native", () => ({
  useWindowDimensions: () => mockWindowDimensions,
}));

// Mock @shopify/flash-list
vi.mock("@shopify/flash-list", () => ({
  FlashList: "FlashList",
}));

// Mock react-native-reanimated
vi.mock("react-native-reanimated", () => ({
  useSharedValue: (initial: any) => ({ value: initial }),
  useAnimatedStyle: (styleFn: any) => styleFn(),
  withSpring: (value: any, config?: any) => value,
}));

// Test data factories
function createMockTimelineNode(level: TimelineNode["level"], count: number = 1): TimelineNode {
  return {
    id: `${level}-${Math.random().toString(36).substr(2, 9)}`,
    level,
    title: `${level} Title`,
    count,
    date: new Date(),
    thumbnail: {
      id: `photo-${Math.random().toString(36).substr(2, 9)}`,
      uri: `file://photo.jpg`,
      width: 1920,
      height: 1080,
      filename: "photo.jpg",
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      isFavorite: false,
      isPrivate: false,
      albumIds: [],
    },
    ...(level === "day" && { photos: [] }),
    ...(level !== "photo" && { children: [] }),
  };
}

function createMockZoomLevel(columns: number, itemHeight: number): ZoomLevel {
  return {
    level: "year",
    columns,
    itemHeight,
    threshold: 0.5,
  };
}

describe("FlashList Optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPerformance.now.mockReturnValue(Date.now());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    memoryManager.clearPools();
  });

  describe("calculateLayoutConfig", () => {
    it("should calculate layout config correctly", () => {
      const zoomLevel = createMockZoomLevel(3, 120);
      const containerWidth = 375;
      const gap = 4;
      
      const config = calculateLayoutConfig(zoomLevel, containerWidth, gap);
      
      expect(config.columns).toBe(3);
      expect(config.itemHeight).toBe(120);
      expect(config.containerWidth).toBe(375);
      expect(config.gap).toBe(4);
      
      // Calculate expected item width: (375 - 4 * (3-1)) / 3 = 122.33
      expect(config.itemWidth).toBeCloseTo(122.33, 1);
      expect(config.estimatedItemSize).toBe(124); // 120 + 4
    });

    it("should handle single column layout", () => {
      const zoomLevel = createMockZoomLevel(1, 80);
      const containerWidth = 375;
      
      const config = calculateLayoutConfig(zoomLevel, containerWidth);
      
      expect(config.columns).toBe(1);
      expect(config.itemWidth).toBe(375); // Full width for single column
    });

    it("should handle zero gap", () => {
      const zoomLevel = createMockZoomLevel(4, 160);
      const containerWidth = 400;
      
      const config = calculateLayoutConfig(zoomLevel, containerWidth, 0);
      
      expect(config.itemWidth).toBe(100); // 400 / 4
      expect(config.estimatedItemSize).toBe(160); // No gap
    });
  });

  describe("timelineToOptimizedListData", () => {
    it("should convert timeline nodes to list items with headers", () => {
      const nodes = [
        createMockTimelineNode("year"),
        createMockTimelineNode("month"),
        createMockTimelineNode("day"),
      ];
      
      const config: ListLayoutConfig = {
        itemHeight: 120,
        columns: 3,
        gap: 4,
        containerWidth: 375,
        itemWidth: 122,
        estimatedItemSize: 124,
      };
      
      const items = timelineToOptimizedListData(nodes, config, true);
      
      expect(items).toHaveLength(6); // 3 headers + 3 items
      
      // Check headers
      expect(items[0].type).toBe("header");
      expect(items[0].id).toBe("header-year-");
      expect(items[0].height).toBe(48);
      
      // Check photo items don't get headers
      const photoNode = createMockTimelineNode("photo");
      const photoItems = timelineToOptimizedListData([photoNode], config, true);
      expect(photoItems).toHaveLength(1); // No header for photo
      expect(photoItems[0].type).toBe("photo");
    });

    it("should convert timeline nodes without headers", () => {
      const nodes = [
        createMockTimelineNode("year"),
        createMockTimelineNode("month"),
      ];
      
      const config: ListLayoutConfig = {
        itemHeight: 120,
        columns: 3,
        gap: 4,
        containerWidth: 375,
        itemWidth: 122,
        estimatedItemSize: 124,
      };
      
      const items = timelineToOptimizedListData(nodes, config, false);
      
      expect(items).toHaveLength(2); // No headers
      expect(items[0].type).toBe("year");
      expect(items[1].type).toBe("month");
    });

    it("should set correct heights for different item types", () => {
      const nodes = [
        createMockTimelineNode("year"),
        createMockTimelineNode("photo"),
      ];
      
      const config: ListLayoutConfig = {
        itemHeight: 100,
        columns: 3,
        gap: 4,
        containerWidth: 375,
        itemWidth: 122,
        estimatedItemSize: 104,
      };
      
      const items = timelineToOptimizedListData(nodes, config, true);
      
      const yearItem = items.find(item => item.type === "year");
      const photoItem = items.find(item => item.type === "photo");
      
      expect(yearItem?.height).toBe(100);
      expect(photoItem?.height).toBe(100); // Photo uses itemHeight too
    });
  });

  describe("usePerformanceMonitor", () => {
    it("should initialize with default metrics", () => {
      const { result } = renderHook(() => usePerformanceMonitor());
      
      const metrics = result.current.getMetrics();
      
      expect(metrics.renderTime).toBe(0);
      expect(metrics.scrollFPS).toBe(60);
      expect(metrics.memoryUsage).toBe(0);
      expect(metrics.visibleItems).toBe(0);
      expect(metrics.totalItems).toBe(0);
    });

    it("should measure render timing", () => {
      const { result } = renderHook(() => usePerformanceMonitor());
      
      mockPerformance.now.mockReturnValue(100);
      const startTime = result.current.startRenderTiming();
      
      mockPerformance.now.mockReturnValue(150);
      const renderTime = result.current.endRenderTiming(startTime);
      
      expect(renderTime).toBe(50);
      expect(result.current.getMetrics().renderTime).toBe(50);
    });

    it("should update scroll metrics", () => {
      const { result } = renderHook(() => usePerformanceMonitor());
      
      // Simulate multiple frame updates
      for (let i = 0; i < 60; i++) {
        mockPerformance.now.mockReturnValue(Date.now() + i * 16); // ~60fps
        result.current.updateScrollMetrics();
      }
      
      // Wait for 1 second to pass
      mockPerformance.now.mockReturnValue(Date.now() + 1000);
      result.current.updateScrollMetrics();
      
      const metrics = result.current.getMetrics();
      expect(metrics.scrollFPS).toBe(60);
    });

    it("should update memory usage", () => {
      const { result } = renderHook(() => usePerformanceMonitor());
      
      result.current.updateMemoryUsage();
      
      const metrics = result.current.getMetrics();
      expect(metrics.memoryUsage).toBe(1024 * 1024 * 50); // 50MB
    });
  });

  describe("useLazyLoading", () => {
    const testData: ListItem[] = Array.from({ length: 100 }, (_, i) => ({
      id: `item-${i}`,
      type: "photo" as const,
      data: { id: i },
      height: 100,
      estimatedHeight: 100,
    }));

    it("should load initial batch", () => {
      const { result } = renderHook(() => useLazyLoading(testData));
      
      expect(result.current.visibleData).toHaveLength(50); // Default batch size
      expect(result.current.isLoading).toBe(false);
    });

    it("should load more data", () => {
      const { result } = renderHook(() => useLazyLoading(testData));
      
      act(() => {
        const loaded = result.current.loadMore();
        expect(loaded).toBe(true);
      });
      
      expect(result.current.visibleData).toHaveLength(100); // All data loaded
    });

    it("should not load more when all data is loaded", () => {
      const { result } = renderHook(() => useLazyLoading(testData.slice(0, 25))); // Less than batch size
      
      act(() => {
        const loaded = result.current.loadMore();
        expect(loaded).toBe(false);
      });
      
      expect(result.current.visibleData).toHaveLength(25);
    });

    it("should determine when to load more based on scroll ratio", () => {
      const { result } = renderHook(() => useLazyLoading(testData));
      
      const shouldLoad = result.current.shouldLoadMore(
        800, // scrollOffset
        1000, // contentHeight
        200   // containerHeight
      );
      
      expect(shouldLoad).toBe(true); // (800 + 200) / 1000 = 1.0 >= 0.8 threshold
    });

    it("should reset loaded data", () => {
      const { result } = renderHook(() => useLazyLoading(testData));
      
      act(() => {
        result.current.loadMore();
      });
      
      expect(result.current.visibleData).toHaveLength(100);
      
      act(() => {
        result.current.reset();
      });
      
      expect(result.current.visibleData).toHaveLength(50); // Back to initial batch
    });

    it("should handle disabled lazy loading", () => {
      const config = { ...DEFAULT_LAZY_LOADING, enabled: false };
      const { result } = renderHook(() => useLazyLoading(testData, config));
      
      expect(result.current.visibleData).toHaveLength(100); // All data visible
    });
  });

  describe("useDynamicItemHeights", () => {
    const testData: ListItem[] = [
      { id: "item-1", type: "photo", data: {}, height: 100, estimatedHeight: 100 },
      { id: "item-2", type: "header", data: {}, height: 48, estimatedHeight: 48 },
      { id: "item-3", type: "photo", data: {}, height: 120, estimatedHeight: 100 },
    ];

    const config: ListLayoutConfig = {
      itemHeight: 100,
      columns: 3,
      gap: 4,
      containerWidth: 375,
      itemWidth: 122,
      estimatedItemSize: 104,
    };

    it("should initialize height cache with estimated heights", () => {
      const { result } = renderHook(() => useDynamicItemHeights(testData, config));
      
      expect(result.current.getItemHeight("item-1")).toBe(100);
      expect(result.current.getItemHeight("item-2")).toBe(48);
      expect(result.current.getItemHeight("item-3")).toBe(100); // Estimated height
    });

    it("should update item height when measured", () => {
      const { result } = renderHook(() => useDynamicItemHeights(testData, config));
      
      act(() => {
        result.current.updateItemHeight("item-3", 130);
      });
      
      expect(result.current.getItemHeight("item-3")).toBe(130);
    });

    it("should override item layout correctly", () => {
      const { result } = renderHook(() => useDynamicItemHeights(testData, config));
      
      const layout: any = {};
      const headerItem = testData[1];
      
      result.current.overrideItemLayout(layout, headerItem);
      
      expect(layout.size).toBe(48);
      expect(layout.span).toBe(3); // Header spans all columns
    });

    it("should get correct item type", () => {
      const { result } = renderHook(() => useDynamicItemHeights(testData, config));
      
      expect(result.current.getItemType(testData[0])).toBe("photo");
      expect(result.current.getItemType(testData[1])).toBe("header");
    });

    it("should return default height for unknown items", () => {
      const { result } = renderHook(() => useDynamicItemHeights(testData, config));
      
      expect(result.current.getItemHeight("unknown-item")).toBe(104); // estimatedItemSize
    });
  });

  describe("MemoryManager", () => {
    let manager: MemoryManager;

    beforeEach(() => {
      manager = MemoryManager.getInstance();
      manager.clearPools();
    });

    it("should return singleton instance", () => {
      const manager1 = MemoryManager.getInstance();
      const manager2 = MemoryManager.getInstance();
      
      expect(manager1).toBe(manager2);
    });

    it("should create new item when pool is empty", () => {
      const factory = vi.fn(() => ({ id: "test" }));
      
      const item = manager.getFromPool("test-pool", factory);
      
      expect(factory).toHaveBeenCalledTimes(1);
      expect(item).toEqual({ id: "test" });
    });

    it("should reuse item from pool", () => {
      const factory = vi.fn(() => ({ id: "test" }));
      
      // Get first item
      const item1 = manager.getFromPool("test-pool", factory);
      expect(factory).toHaveBeenCalledTimes(1);
      
      // Return item to pool
      manager.returnToPool("test-pool", item1);
      
      // Get item again - should reuse
      const item2 = manager.getFromPool("test-pool", factory);
      expect(factory).toHaveBeenCalledTimes(1); // Still only called once
      expect(item2).toBe(item1);
    });

    it("should limit pool size", () => {
      const factory = vi.fn(() => ({ id: "test" }));
      
      // Add items beyond max pool size
      for (let i = 0; i < 110; i++) {
        const item = { id: `test-${i}` };
        manager.returnToPool("test-pool", item);
      }
      
      const stats = manager.getPoolStats();
      expect(stats["test-pool"]).toBeLessThanOrEqual(100);
    });

    it("should clear all pools", () => {
      manager.returnToPool("pool1", { id: "test1" });
      manager.returnToPool("pool2", { id: "test2" });
      
      expect(manager.getPoolStats()).toEqual({
        pool1: 1,
        pool2: 1,
      });
      
      manager.clearPools();
      
      expect(manager.getPoolStats()).toEqual({});
    });
  });

  describe("PerformanceUtils", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should debounce function calls", () => {
      const fn = vi.fn();
      const debouncedFn = PerformanceUtils.debounce(fn, 100);
      
      debouncedFn();
      debouncedFn();
      debouncedFn();
      
      expect(fn).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(100);
      
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should throttle function calls", () => {
      const fn = vi.fn();
      const throttledFn = PerformanceUtils.throttle(fn, 100);
      
      throttledFn();
      throttledFn();
      throttledFn();
      
      expect(fn).toHaveBeenCalledTimes(1);
      
      vi.advanceTimersByTime(100);
      
      throttledFn();
      
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("should measure function execution time", () => {
      const fn = vi.fn(() => "result");
      const measuredFn = PerformanceUtils.measure(fn, "test");
      
      const consoleSpy = vi.spyOn(console, "log").mockImplementation();
      
      const result = measuredFn();
      
      expect(result).toBe("result");
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("test:"));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("ms"));
      
      consoleSpy.mockRestore();
    });

    it("should detect low-end devices", () => {
      // Mock low-end device
      (navigator as any).deviceMemory = 2;
      (navigator as any).hardwareConcurrency = 2;
      
      expect(PerformanceUtils.isLowEndDevice()).toBe(true);
      
      // Mock high-end device
      (navigator as any).deviceMemory = 8;
      (navigator as any).hardwareConcurrency = 8;
      
      expect(PerformanceUtils.isLowEndDevice()).toBe(false);
    });

    it("should get performance settings based on device", () => {
      // Mock high-end device
      (navigator as any).deviceMemory = 8;
      (navigator as any).hardwareConcurrency = 8;
      
      const settings = PerformanceUtils.getPerformanceSettings();
      
      expect(settings.batchSize).toBe(50);
      expect(settings.maxToRenderPerBatch).toBe(10);
      expect(settings.removeClippedSubviews).toBe(true);
      
      // Mock low-end device
      (navigator as any).deviceMemory = 2;
      (navigator as any).hardwareConcurrency = 2;
      
      const lowEndSettings = PerformanceUtils.getPerformanceSettings();
      
      expect(lowEndSettings.batchSize).toBe(25);
      expect(lowEndSettings.maxToRenderPerBatch).toBe(5);
      expect(lowEndSettings.removeClippedSubviews).toBe(false);
    });
  });

  describe("Integration Tests", () => {
    it("should handle complete optimization workflow", () => {
      const nodes = Array.from({ length: 50 }, (_, i) => 
        createMockTimelineNode("photo", 1)
      );
      
      const zoomLevel = createMockZoomLevel(4, 200);
      const config = calculateLayoutConfig(zoomLevel, 375);
      const listData = timelineToOptimizedListData(nodes, config, false);
      
      expect(listData).toHaveLength(50);
      expect(listData[0].height).toBe(200);
      
      const { result } = renderHook(() => useLazyLoading(listData));
      
      expect(result.current.visibleData).toHaveLength(50); // Less than batch size
    });

    it("should handle performance monitoring with lazy loading", () => {
      const largeData = Array.from({ length: 200 }, (_, i) => ({
        id: `item-${i}`,
        type: "photo" as const,
        data: { id: i },
        height: 100,
        estimatedHeight: 100,
      }));
      
      const { result: lazyResult } = renderHook(() => useLazyLoading(largeData));
      const { result: perfResult } = renderHook(() => usePerformanceMonitor());
      
      // Simulate loading more data
      act(() => {
        lazyResult.current.loadMore();
      });
      
      expect(lazyResult.current.visibleData).toHaveLength(100);
      
      // Simulate performance monitoring
      const startTime = perfResult.current.startRenderTiming();
      mockPerformance.now.mockReturnValue(Date.now() + 50);
      perfResult.current.endRenderTiming(startTime);
      
      const metrics = perfResult.current.getMetrics();
      expect(metrics.renderTime).toBe(50);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty data array", () => {
      const { result } = renderHook(() => useLazyLoading([]));
      
      expect(result.current.visibleData).toHaveLength(0);
      expect(result.current.loadMore()).toBe(false);
    });

    it("should handle zero container width", () => {
      const zoomLevel = createMockZoomLevel(3, 120);
      
      expect(() => {
        calculateLayoutConfig(zoomLevel, 0);
      }).not.toThrow();
    });

    it("should handle negative gap", () => {
      const zoomLevel = createMockZoomLevel(2, 100);
      
      expect(() => {
        calculateLayoutConfig(zoomLevel, 375, -4);
      }).not.toThrow();
    });

    it("should handle very large batch sizes", () => {
      const largeConfig = { ...DEFAULT_LAZY_LOADING, batchSize: 1000 };
      const testData = Array.from({ length: 100 }, (_, i) => ({
        id: `item-${i}`,
        type: "photo" as const,
        data: { id: i },
        height: 100,
        estimatedHeight: 100,
      }));
      
      const { result } = renderHook(() => useLazyLoading(testData, largeConfig));
      
      expect(result.current.visibleData).toHaveLength(100); // All data loaded
    });
  });
});
