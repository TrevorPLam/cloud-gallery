// AI-META-BEGIN
// AI-META: Multi-level timeline navigation service for hierarchical photo browsing
// OWNERSHIP: client/lib/gallery (gallery navigation)
// ENTRYPOINTS: Used by GalleryScreen for zoomable timeline navigation
// DEPENDENCIES: @/types, @/lib/storage, date-fns for date manipulation
// DANGER: Performance-sensitive with large photo libraries; memory usage with caching
// CHANGE-SAFETY: Safe to modify grouping logic; risky to change core navigation structure
// TESTS: Test with 10k+ photos, verify navigation performance, validate memory usage
// AI-META-END

import { Photo } from "@/types";
import { 
  startOfYear, 
  startOfMonth, 
  startOfDay, 
  isAfter, 
  isBefore, 
  isEqual,
  format,
  getYear,
  getMonth,
  getDate
} from "date-fns";

export type TimelineLevel = "year" | "month" | "day" | "photo";

export interface TimelineNode {
  id: string;
  level: TimelineLevel;
  title: string;
  subtitle?: string;
  count: number;
  date: Date;
  children?: TimelineNode[];
  photos?: Photo[];
  thumbnail?: Photo; // Representative photo for this node
}

export interface TimelinePath {
  level: TimelineLevel;
  nodeId: string;
  title: string;
}

export interface ZoomLevel {
  level: TimelineLevel;
  columns: number;
  itemHeight: number;
  threshold: number; // Pinch scale threshold to trigger this level
}

export const DEFAULT_ZOOM_LEVELS: ZoomLevel[] = [
  { level: "year", columns: 1, itemHeight: 80, threshold: 0.25 },
  { level: "month", columns: 2, itemHeight: 120, threshold: 0.5 },
  { level: "day", columns: 3, itemHeight: 160, threshold: 0.75 },
  { level: "photo", columns: 4, itemHeight: 200, threshold: 1.0 },
];

/**
 * Creates a hierarchical timeline structure from photos
 * Year → Month → Day → Photo
 */
export function createTimelineHierarchy(photos: Photo[]): TimelineNode[] {
  if (photos.length === 0) return [];

  // Sort photos by creation date (newest first)
  const sortedPhotos = [...photos].sort((a, b) => b.createdAt - a.createdAt);
  
  // Group by year
  const yearGroups = new Map<number, Photo[]>();
  
  sortedPhotos.forEach(photo => {
    const year = getYear(new Date(photo.createdAt));
    if (!yearGroups.has(year)) {
      yearGroups.set(year, []);
    }
    yearGroups.get(year)!.push(photo);
  });

  // Build timeline hierarchy
  const timeline: TimelineNode[] = [];
  
  for (const [year, yearPhotos] of yearGroups.entries()) {
    const yearNode: TimelineNode = {
      id: `year-${year}`,
      level: "year",
      title: year.toString(),
      count: yearPhotos.length,
      date: startOfYear(new Date(year, 0, 1)),
      children: [],
      thumbnail: yearPhotos[0], // Most recent photo as thumbnail
    };

    // Group by month within the year
    const monthGroups = new Map<number, Photo[]>();
    
    yearPhotos.forEach(photo => {
      const month = getMonth(new Date(photo.createdAt));
      if (!monthGroups.has(month)) {
        monthGroups.set(month, []);
      }
      monthGroups.get(month)!.push(photo);
    });

    // Build month nodes
    for (const [month, monthPhotos] of monthGroups.entries()) {
      const monthDate = new Date(year, month, 1);
      const monthNode: TimelineNode = {
        id: `month-${year}-${month}`,
        level: "month",
        title: format(monthDate, "MMMM yyyy"),
        count: monthPhotos.length,
        date: startOfMonth(monthDate),
        children: [],
        thumbnail: monthPhotos[0],
      };

      // Group by day within the month
      const dayGroups = new Map<number, Photo[]>();
      
      monthPhotos.forEach(photo => {
        const day = getDate(new Date(photo.createdAt));
        if (!dayGroups.has(day)) {
          dayGroups.set(day, []);
        }
        dayGroups.get(day)!.push(photo);
      });

      // Build day nodes
      for (const [day, dayPhotos] of dayGroups.entries()) {
        const dayDate = new Date(year, month, day);
        const dayNode: TimelineNode = {
          id: `day-${year}-${month}-${day}`,
          level: "day",
          title: format(dayDate, "EEEE, MMMM d, yyyy"),
          subtitle: `${dayPhotos.length} photos`,
          count: dayPhotos.length,
          date: startOfDay(dayDate),
          photos: dayPhotos,
          thumbnail: dayPhotos[0],
        };

        monthNode.children!.push(dayNode);
      }

      // Sort days chronologically (newest first)
      monthNode.children!.sort((a, b) => b.date.getTime() - a.date.getTime());
      yearNode.children!.push(monthNode);
    }

    // Sort months chronologically (newest first)
    yearNode.children!.sort((a, b) => b.date.getTime() - a.date.getTime());
    timeline.push(yearNode);
  }

  // Sort years chronologically (newest first)
  timeline.sort((a, b) => b.date.getTime() - a.date.getTime());
  
  return timeline;
}

/**
 * Finds a specific node in the timeline hierarchy by its ID
 */
export function findTimelineNode(
  hierarchy: TimelineNode[], 
  nodeId: string
): TimelineNode | null {
  for (const node of hierarchy) {
    if (node.id === nodeId) return node;
    
    if (node.children) {
      const found = findTimelineNode(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Gets the navigation path to a specific node
 */
export function getTimelinePath(
  hierarchy: TimelineNode[], 
  targetNodeId: string
): TimelinePath[] {
  const path: TimelinePath[] = [];
  
  function searchPath(nodes: TimelineNode[], targetId: string, currentPath: TimelinePath[] = []): boolean {
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
  
  searchPath(hierarchy, targetNodeId);
  return path;
}

/**
 * Gets the parent node of a specific node
 */
export function getParentTimelineNode(
  hierarchy: TimelineNode[], 
  nodeId: string
): TimelineNode | null {
  for (const node of hierarchy) {
    if (node.children) {
      const found = node.children.find(child => child.id === nodeId);
      if (found) return node;
      
      const parentInChild = getParentTimelineNode(node.children, nodeId);
      if (parentInChild) return parentInChild;
    }
  }
  return null;
}

/**
 * Gets the siblings of a node (nodes at the same level with the same parent)
 */
export function getTimelineSiblings(
  hierarchy: TimelineNode[], 
  nodeId: string
): TimelineNode[] {
  const parent = getParentTimelineNode(hierarchy, nodeId);
  if (!parent) return hierarchy; // Root level nodes
  
  return parent.children || [];
}

/**
 * Calculates zoom level based on pinch scale factor
 */
export function getZoomLevelForScale(
  scale: number, 
  zoomLevels: ZoomLevel[] = DEFAULT_ZOOM_LEVELS
): ZoomLevel {
  // Find the highest threshold that's less than or equal to the scale
  for (let i = zoomLevels.length - 1; i >= 0; i--) {
    if (scale >= zoomLevels[i].threshold) {
      return zoomLevels[i];
    }
  }
  
  // Default to most zoomed out level
  return zoomLevels[0];
}

/**
 * Gets the data for a specific timeline level and node
 */
export function getTimelineDataForLevel(
  hierarchy: TimelineNode[],
  nodeId: string | null,
  level: TimelineLevel
): TimelineNode[] {
  if (!nodeId) {
    // Root level - return top-level nodes
    return hierarchy.filter(node => node.level === level);
  }
  
  const node = findTimelineNode(hierarchy, nodeId);
  if (!node) return [];
  
  if (node.level === level) {
    // Return siblings at the same level
    return getTimelineSiblings(hierarchy, nodeId);
  }
  
  // Return children at the requested level
  if (node.children) {
    return node.children.filter(child => child.level === level);
  }
  
  return [];
}

/**
 * Converts timeline nodes to flat data for FlashList
 */
export function timelineToFlashListData(
  nodes: TimelineNode[],
  showHeaders: boolean = true
): (TimelineNode | { type: "header"; title: string })[] {
  const flatData: (TimelineNode | { type: "header"; title: string })[] = [];
  
  nodes.forEach(node => {
    if (showHeaders && node.level !== "photo") {
      flatData.push({ type: "header", title: node.title });
    }
    flatData.push(node);
  });
  
  return flatData;
}

/**
 * Estimates the number of photos that will be visible at each zoom level
 */
export function estimateVisiblePhotos(
  hierarchy: TimelineNode[],
  level: TimelineLevel,
  containerHeight: number,
  itemHeight: number
): number {
  const visibleItems = Math.ceil(containerHeight / itemHeight) + 2; // +2 for buffer
  
  switch (level) {
    case "year":
      return hierarchy.length * 50; // Estimate 50 photos per year
    case "month":
      return hierarchy.reduce((sum, year) => sum + (year.children?.length || 0), 0) * 20;
    case "day":
      return hierarchy.reduce((sum, year) => {
        return sum + (year.children?.reduce((monthSum, month) => {
          return monthSum + (month.children?.length || 0);
        }, 0) || 0);
      }, 0) * 5;
    case "photo":
      return hierarchy.reduce((sum, node) => sum + node.count, 0);
    default:
      return 0;
  }
}

/**
 * Memory-efficient timeline caching
 */
export class TimelineCache {
  private cache = new Map<string, TimelineNode[]>();
  private maxSize = 10; // Maximum number of cached hierarchies
  
  set(key: string, hierarchy: TimelineNode[]): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (first in Map)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, hierarchy);
  }
  
  get(key: string): TimelineNode[] | undefined {
    return this.cache.get(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
  
  has(key: string): boolean {
    return this.cache.has(key);
  }
}

// Global cache instance
export const timelineCache = new TimelineCache();
