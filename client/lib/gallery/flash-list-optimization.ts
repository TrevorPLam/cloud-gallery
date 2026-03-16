// AI-META-BEGIN
// AI-META: FlashList optimization service with dynamic item heights and lazy loading
// OWNERSHIP: client/lib/gallery (list optimization)
// ENTRYPOINTS: Used by GalleryScreen for high-performance list rendering
// DEPENDENCIES: @shopify/flash-list, react-native-reanimated, performance monitoring
// DANGER: Performance-sensitive; memory usage with large datasets; layout calculations
// CHANGE-SAFETY: Safe to modify performance thresholds; risky to change core layout logic
// TESTS: Test with 10k+ items, verify memory usage, validate scroll performance
// AI-META-END

import { useMemo, useCallback, useRef, useEffect } from "react";
import { FlashList, FlashListProps } from "@shopify/flash-list";
import { useWindowDimensions } from "react-native";
import { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Photo } from "@/types";
import { TimelineNode, ZoomLevel, DEFAULT_ZOOM_LEVELS } from "./timeline-navigation";

export interface ListItem {
  id: string;
  type: "header" | "year" | "month" | "day" | "photo";
  data: any;
  height: number;
  estimatedHeight?: number;
}

export interface ListLayoutConfig {
  itemHeight: number;
  columns: number;
  gap: number;
  containerWidth: number;
  itemWidth: number;
  estimatedItemSize: number;
}

export interface PerformanceMetrics {
  renderTime: number;
  scrollFPS: number;
  memoryUsage: number;
  visibleItems: number;
  totalItems: number;
}

export interface LazyLoadingConfig {
  batchSize: number;
  threshold: number; // Distance from bottom to trigger loading
  enabled: boolean;
}

export const DEFAULT_LAZY_LOADING: LazyLoadingConfig = {
  batchSize: 50,
  threshold: 0.8, // Load when 80% scrolled
  enabled: true,
};

/**
 * Calculates optimal layout configuration for given zoom level and container
 */
export function calculateLayoutConfig(
  zoomLevel: ZoomLevel,
  containerWidth: number,
  gap: number = 4
): ListLayoutConfig {
  const columns = zoomLevel.columns;
  const itemWidth = (containerWidth - gap * (columns - 1)) / columns;
  const itemHeight = zoomLevel.itemHeight;
  
  return {
    itemHeight,
    columns,
    gap,
    containerWidth,
    itemWidth,
    estimatedItemSize: itemHeight + gap,
  };
}

/**
 * Converts timeline data to optimized FlashList data
 */
export function timelineToOptimizedListData(
  nodes: TimelineNode[],
  config: ListLayoutConfig,
  showHeaders: boolean = true
): ListItem[] {
  const items: ListItem[] = [];
  
  nodes.forEach(node => {
    // Add header if needed
    if (showHeaders && node.level !== "photo") {
      items.push({
        id: `header-${node.id}`,
        type: "header",
        data: { title: node.title, subtitle: node.subtitle },
        height: 48, // Fixed header height
        estimatedHeight: 48,
      });
    }
    
    // Add node item
    const itemHeight = node.level === "photo" 
      ? config.itemHeight 
      : config.itemHeight;
      
    items.push({
      id: node.id,
      type: node.level,
      data: node,
      height: itemHeight,
      estimatedHeight: itemHeight,
    });
  });
  
  return items;
}

/**
 * Performance monitoring hook
 */
export function usePerformanceMonitor() {
  const metrics = useRef<PerformanceMetrics>({
    renderTime: 0,
    scrollFPS: 60,
    memoryUsage: 0,
    visibleItems: 0,
    totalItems: 0,
  });
  
  const frameCount = useRef(0);
  const lastFrameTime = useRef(Date.now());
  
  const startRenderTiming = useCallback(() => {
    return performance.now();
  }, []);
  
  const endRenderTiming = useCallback((startTime: number) => {
    const renderTime = performance.now() - startTime;
    metrics.current.renderTime = renderTime;
    return renderTime;
  }, []);
  
  const updateScrollMetrics = useCallback(() => {
    const now = Date.now();
    frameCount.current++;
    
    if (now - lastFrameTime.current >= 1000) {
      metrics.current.scrollFPS = frameCount.current;
      frameCount.current = 0;
      lastFrameTime.current = now;
    }
  }, []);
  
  const updateMemoryUsage = useCallback(() => {
    if (performance.memory) {
      metrics.current.memoryUsage = performance.memory.usedJSHeapSize;
    }
  }, []);
  
  const getMetrics = useCallback(() => {
    return { ...metrics.current };
  }, []);
  
  return {
    startRenderTiming,
    endRenderTiming,
    updateScrollMetrics,
    updateMemoryUsage,
    getMetrics,
  };
}

/**
 * Lazy loading hook for FlashList
 */
export function useLazyLoading(
  data: ListItem[],
  config: LazyLoadingConfig = DEFAULT_LAZY_LOADING
) {
  const loadedCount = useRef(config.batchSize);
  const isLoading = useRef(false);
  
  const visibleData = useMemo(() => {
    if (!config.enabled) return data;
    return data.slice(0, loadedCount.current);
  }, [data, config.enabled]);
  
  const loadMore = useCallback(() => {
    if (isLoading.current || loadedCount.current >= data.length) {
      return false;
    }
    
    isLoading.current = true;
    const newCount = Math.min(loadedCount.current + config.batchSize, data.length);
    loadedCount.current = newCount;
    isLoading.current = false;
    
    return true;
  }, [data, config.batchSize]);
  
  const shouldLoadMore = useCallback((scrollOffset: number, contentHeight: number, containerHeight: number) => {
    if (!config.enabled || isLoading.current) return false;
    
    const scrollRatio = (scrollOffset + containerHeight) / contentHeight;
    return scrollRatio >= config.threshold;
  }, [config.enabled, config.threshold]);
  
  const reset = useCallback(() => {
    loadedCount.current = config.batchSize;
    isLoading.current = false;
  }, [config.batchSize]);
  
  return {
    visibleData,
    loadMore,
    shouldLoadMore,
    isLoading: isLoading.current,
    reset,
  };
}

/**
 * Dynamic item height calculation hook
 */
export function useDynamicItemHeights(
  data: ListItem[],
  config: ListLayoutConfig
) {
  const heightCache = useRef<Map<string, number>>(new Map());
  const measuredHeights = useRef<Map<string, number>>(new Map());
  
  // Initialize height cache with estimated heights
  useEffect(() => {
    heightCache.current.clear();
    data.forEach(item => {
      heightCache.current.set(item.id, item.estimatedHeight || item.height);
    });
  }, [data]);
  
  const updateItemHeight = useCallback((itemId: string, height: number) => {
    measuredHeights.current.set(itemId, height);
    heightCache.current.set(itemId, height);
  }, []);
  
  const getItemHeight = useCallback((itemId: string): number => {
    return heightCache.current.get(itemId) || config.estimatedItemSize;
  }, [config.estimatedItemSize]);
  
  const overrideItemLayout = useCallback((layout: any, item: any) => {
    const height = getItemHeight(item.id);
    layout.size = height;
    
    // Set span for headers
    if (item.type === "header") {
      layout.span = config.columns;
    }
  }, [config.columns, getItemHeight]);
  
  const getItemType = useCallback((item: any): string => {
    return item.type;
  }, []);
  
  return {
    updateItemHeight,
    getItemHeight,
    overrideItemLayout,
    getItemType,
    heightCache: heightCache.current,
    measuredHeights: measuredHeights.current,
  };
}

/**
 * Optimized FlashList props hook
 */
export function useOptimizedFlashListProps(
  data: ListItem[],
  config: ListLayoutConfig,
  additionalProps: Partial<FlashListProps<any>> = {}
) {
  const { width: containerWidth } = useWindowDimensions();
  const performanceMonitor = usePerformanceMonitor();
  const lazyLoading = useLazyLoading(data);
  const dynamicHeights = useDynamicItemHeights(data, config);
  
  // Recalculate layout when container size changes
  useEffect(() => {
    if (containerWidth !== config.containerWidth) {
      // Layout has changed, trigger recalculation
      performanceMonitor.updateMemoryUsage();
    }
  }, [containerWidth, config.containerWidth, performanceMonitor]);
  
  const renderItem = useCallback((info: any) => {
    const startTime = performanceMonitor.startRenderTiming();
    
    const item = info.item as ListItem;
    
    // Render based on item type
    let content;
    switch (item.type) {
      case "header":
        content = renderHeaderItem(item.data);
        break;
      case "year":
        content = renderYearItem(item.data, config);
        break;
      case "month":
        content = renderMonthItem(item.data, config);
        break;
      case "day":
        content = renderDayItem(item.data, config);
        break;
      case "photo":
        content = renderPhotoItem(item.data, config);
        break;
      default:
        content = null;
    }
    
    performanceMonitor.endRenderTiming(startTime);
    
    return content;
  }, [config, performanceMonitor]);
  
  const onEndReached = useCallback(() => {
    if (lazyLoading.shouldLoadMore(0, 0, 0)) {
      lazyLoading.loadMore();
    }
  }, [lazyLoading]);
  
  const onScroll = useCallback((event: any) => {
    const scrollOffset = event.nativeEvent.contentOffset.y;
    const contentHeight = event.nativeEvent.contentSize.height;
    const containerHeight = event.nativeEvent.layoutMeasurement.height;
    
    performanceMonitor.updateScrollMetrics();
    
    if (lazyLoading.shouldLoadMore(scrollOffset, contentHeight, containerHeight)) {
      lazyLoading.loadMore();
    }
  }, [lazyLoading, performanceMonitor]);
  
  const keyExtractor = useCallback((item: ListItem) => item.id, []);
  
  const flashListProps: FlashListProps<ListItem> = useMemo(() => ({
    data: lazyLoading.visibleData,
    numColumns: config.columns,
    estimatedItemSize: config.estimatedItemSize,
    renderItem,
    keyExtractor,
    getItemType: dynamicHeights.getItemType,
    overrideItemLayout: dynamicHeights.overrideItemLayout,
    onEndReached,
    onScroll,
    // Performance optimizations
    removeClippedSubviews: true,
    maxToRenderPerBatch: 10,
    updateCellsBatchingPeriod: 50,
    initialNumToRender: 15,
    windowSize: 10,
    ...additionalProps,
  }), [
    lazyLoading.visibleData,
    config,
    renderItem,
    keyExtractor,
    dynamicHeights,
    onEndReached,
    onScroll,
    additionalProps,
  ]);
  
  return {
    flashListProps,
    performanceMonitor,
    lazyLoading,
    dynamicHeights,
  };
}

// Render functions for different item types
function renderHeaderItem(data: { title: string; subtitle?: string }) {
  // This would be implemented with actual components
  return {
    // Header component implementation
    type: "header",
    title: data.title,
    subtitle: data.subtitle,
  };
}

function renderYearItem(data: TimelineNode, config: ListLayoutConfig) {
  return {
    // Year item implementation
    type: "year",
    data,
    width: config.itemWidth,
    height: config.itemHeight,
  };
}

function renderMonthItem(data: TimelineNode, config: ListLayoutConfig) {
  return {
    // Month item implementation
    type: "month",
    data,
    width: config.itemWidth,
    height: config.itemHeight,
  };
}

function renderDayItem(data: TimelineNode, config: ListLayoutConfig) {
  return {
    // Day item implementation
    type: "day",
    data,
    width: config.itemWidth,
    height: config.itemHeight,
  };
}

function renderPhotoItem(data: Photo, config: ListLayoutConfig) {
  return {
    // Photo item implementation
    type: "photo",
    data,
    width: config.itemWidth,
    height: config.itemHeight,
  };
}

/**
 * Memory management utilities
 */
export class MemoryManager {
  private static instance: MemoryManager;
  private memoryPools = new Map<string, any[]>();
  private maxPoolSize = 100;
  
  static getInstance(): MemoryManager {
    if (!MemoryManager.instance) {
      MemoryManager.instance = new MemoryManager();
    }
    return MemoryManager.instance;
  }
  
  // Get item from pool or create new
  getFromPool<T>(poolName: string, factory: () => T): T {
    const pool = this.memoryPools.get(poolName) || [];
    
    if (pool.length > 0) {
      return pool.pop()!;
    }
    
    return factory();
  }
  
  // Return item to pool
  returnToPool<T>(poolName: string, item: T): void {
    const pool = this.memoryPools.get(poolName) || [];
    
    if (pool.length < this.maxPoolSize) {
      pool.push(item);
      this.memoryPools.set(poolName, pool);
    }
  }
  
  // Clear all pools
  clearPools(): void {
    this.memoryPools.clear();
  }
  
  // Get pool statistics
  getPoolStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    
    for (const [name, pool] of this.memoryPools.entries()) {
      stats[name] = pool.length;
    }
    
    return stats;
  }
}

/**
 * Performance optimization utilities
 */
export const PerformanceUtils = {
  /**
   * Debounces function calls
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },
  
  /**
   * Throttles function calls
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },
  
  /**
   * Measures function execution time
   */
  measure<T extends (...args: any[]) => any>(
    func: T,
    label?: string
  ): (...args: Parameters<T>) => ReturnType<T> {
    return (...args: Parameters<T>) => {
      const start = performance.now();
      const result = func(...args);
      const end = performance.now();
      
      if (label) {
        console.log(`${label}: ${end - start}ms`);
      }
      
      return result;
    };
  },
  
  /**
   * Checks if device is low-end
   */
  isLowEndDevice(): boolean {
    // Simple heuristic based on memory and cores
    const memory = (navigator as any).deviceMemory;
    const cores = (navigator as any).hardwareConcurrency;
    
    return (memory && memory < 4) || (cores && cores < 4);
  },
  
  /**
   * Gets performance settings based on device capabilities
   */
  getPerformanceSettings() {
    const isLowEnd = this.isLowEndDevice();
    
    return {
      batchSize: isLowEnd ? 25 : 50,
      maxToRenderPerBatch: isLowEnd ? 5 : 10,
      windowSize: isLowEnd ? 5 : 10,
      removeClippedSubviews: !isLowEnd,
      enableAnimations: !isLowEnd,
    };
  },
};

// Global memory manager instance
export const memoryManager = MemoryManager.getInstance();
