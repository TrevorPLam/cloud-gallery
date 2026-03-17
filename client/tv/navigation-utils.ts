// AI-META-BEGIN
// AI-META: TV navigation utilities for D-pad navigation and focus management
// OWNERSHIP: client/tv/navigation
// DEPENDENCIES: react-native-tvos, TVFocusGuideView
// DANGER: focus management is critical for TV UX; ensure proper navigation flow
// CHANGE-SAFETY: safe to add new navigation patterns; maintain focus consistency
// TESTS: test D-pad navigation flows; verify focus trapping and escape
// AI-META-END

import { useRef, useState, useEffect, useCallback } from "react";
import { View } from "react-native";
import { TVFocusGuideView } from "react-native-tvos";

export interface FocusNode {
  id: string;
  ref: React.RefObject<View>;
  onFocus?: () => void;
  onBlur?: () => void;
  navigation: {
    up?: string;
    down?: string;
    left?: string;
    right?: string;
  };
}

export interface NavigationGrid {
  rows: number;
  columns: number;
  nodes: Map<string, FocusNode>;
  wrapAround?: boolean;
  trapFocus?: boolean;
}

/**
 * Hook for managing TV focus navigation
 */
export const useTVNavigation = (config: NavigationGrid) => {
  const focusedNodeRef = useRef<string | null>(null);
  const navigationGridRef = useRef<NavigationGrid>(config);

  /**
   * Find node by ID
   */
  const getNode = useCallback((id: string): FocusNode | null => {
    return navigationGridRef.current.nodes.get(id) || null;
  }, []);

  /**
   * Get next node in direction
   */
  const getNextNode = useCallback(
    (
      currentId: string,
      direction: "up" | "down" | "left" | "right",
    ): FocusNode | null => {
      const currentNode = getNode(currentId);
      if (!currentNode) return null;

      const nextNodeId = currentNode.navigation[direction];
      if (!nextNodeId) return null;

      return getNode(nextNodeId);
    },
    [getNode],
  );

  /**
   * Move focus in direction
   */
  const moveFocus = useCallback(
    (direction: "up" | "down" | "left" | "right"): boolean => {
      const currentId = focusedNodeRef.current;
      if (!currentId) return false;

      const nextNode = getNextNode(currentId, direction);
      if (!nextNode) return false;

      // Blur current node
      const currentNode = getNode(currentId);
      currentNode?.onBlur?.();

      // Focus next node
      focusedNodeRef.current = nextNode.id;
      nextNode.onFocus?.();

      return true;
    },
    [getNode, getNextNode],
  );

  /**
   * Set focus to specific node
   */
  const setFocus = useCallback(
    (nodeId: string): boolean => {
      const node = getNode(nodeId);
      if (!node) return false;

      // Blur current node
      if (focusedNodeRef.current) {
        const currentNode = getNode(focusedNodeRef.current);
        currentNode?.onBlur?.();
      }

      // Focus new node
      focusedNodeRef.current = nodeId;
      node.onFocus?.();

      return true;
    },
    [getNode],
  );

  /**
   * Handle D-pad navigation
   */
  const handleDPadNavigation = useCallback(
    (direction: "up" | "down" | "left" | "right"): boolean => {
      const { wrapAround, trapFocus } = navigationGridRef.current;

      // Try to move focus in direction
      if (moveFocus(direction)) {
        return true;
      }

      // Handle wrap around
      if (wrapAround) {
        const currentId = focusedNodeRef.current;
        if (!currentId) return false;

        const currentNode = getNode(currentId);
        if (!currentNode) return false;

        // Find edge node in opposite direction
        const oppositeDirection = getOppositeDirection(direction);
        let edgeNode = currentNode;

        // Navigate to edge
        while (edgeNode.navigation[oppositeDirection]) {
          edgeNode = getNode(edgeNode.navigation[oppositeDirection])!;
        }

        return setFocus(edgeNode.id);
      }

      return false;
    },
    [moveFocus, setFocus, getNode],
  );

  return {
    focusedNode: focusedNodeRef.current,
    setFocus,
    moveFocus,
    handleDPadNavigation,
  };
};

/**
 * Hook for creating TV focus guides
 */
export const useTVFocusGuide = (config: {
  destinations: string[];
  autoFocus?: boolean;
  trapFocus?: boolean;
}) => {
  const focusGuideRef = useRef<TVFocusGuideView>(null);

  useEffect(() => {
    if (focusGuideRef.current) {
      // Configure focus guide
      focusGuideRef.current.setDestinations(config.destinations);

      if (config.autoFocus && config.destinations.length > 0) {
        // Auto focus first destination
        const firstDestination = config.destinations[0];
        // In a real implementation, this would trigger focus on the first destination
      }
    }
  }, [config.destinations, config.autoFocus]);

  return focusGuideRef;
};

/**
 * Hook for managing grid-based TV navigation
 */
export const useTVGridNavigation = (config: {
  rows: number;
  columns: number;
  itemCount: number;
  wrapAround?: boolean;
  onIndexChange?: (index: number) => void;
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const {
    rows,
    columns,
    itemCount,
    wrapAround = false,
    onIndexChange,
  } = config;

  /**
   * Convert index to grid coordinates
   */
  const indexToCoords = useCallback(
    (index: number): { row: number; col: number } => {
      return {
        row: Math.floor(index / columns),
        col: index % columns,
      };
    },
    [columns],
  );

  /**
   * Convert grid coordinates to index
   */
  const coordsToIndex = useCallback(
    (row: number, col: number): number => {
      return row * columns + col;
    },
    [columns],
  );

  /**
   * Navigate in direction
   */
  const navigate = useCallback(
    (direction: "up" | "down" | "left" | "right"): number => {
      const { row, col } = indexToCoords(focusedIndex);
      let newRow = row;
      let newCol = col;

      switch (direction) {
        case "up":
          newRow = Math.max(0, row - 1);
          break;
        case "down":
          newRow = Math.min(rows - 1, row + 1);
          break;
        case "left":
          newCol = Math.max(0, col - 1);
          break;
        case "right":
          newCol = Math.min(columns - 1, col + 1);
          break;
      }

      // Handle wrap around
      if (wrapAround) {
        if (direction === "up" && newRow === 0 && row === rows - 1) {
          newRow = rows - 1;
        } else if (direction === "down" && newRow === rows - 1 && row === 0) {
          newRow = 0;
        } else if (
          direction === "left" &&
          newCol === 0 &&
          col === columns - 1
        ) {
          newCol = columns - 1;
        } else if (
          direction === "right" &&
          newCol === columns - 1 &&
          col === 0
        ) {
          newCol = 0;
        }
      }

      const newIndex = coordsToIndex(newRow, newCol);

      // Ensure index is within item count
      if (newIndex >= 0 && newIndex < itemCount) {
        setFocusedIndex(newIndex);
        onIndexChange?.(newIndex);
        return newIndex;
      }

      return focusedIndex;
    },
    [
      focusedIndex,
      rows,
      columns,
      itemCount,
      wrapAround,
      indexToCoords,
      coordsToIndex,
      onIndexChange,
    ],
  );

  /**
   * Set focus by index
   */
  const setFocusedIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < itemCount) {
        setFocusedIndex(index);
        onIndexChange?.(index);
      }
    },
    [itemCount, onIndexChange],
  );

  return {
    focusedIndex,
    setFocusedIndex,
    navigate,
    indexToCoords,
    coordsToIndex,
  };
};

/**
 * TV-specific accessibility utilities
 */
export const tvAccessibility = {
  /**
   * Check if component is properly accessible for TV
   */
  isTVAccessible: (component: any): boolean => {
    // Check for focusable elements
    const hasFocusableElements = component.props?.accessible !== false;

    // Check for proper labeling
    const hasAccessibilityLabel = !!component.props?.accessibilityLabel;

    // Check for role
    const hasRole = !!component.props?.accessibilityRole;

    return hasFocusableElements && (hasAccessibilityLabel || hasRole);
  },

  /**
   * Get TV-specific accessibility hints
   */
  getTVHint: (action: string): string => {
    const hints = {
      navigate: "Use arrow keys to navigate",
      select: "Press OK or center button to select",
      back: "Press back button to go back",
      search: "Press microphone button for voice search",
      play: "Press OK to play",
      pause: "Press OK to pause",
    };

    return (
      hints[action as keyof typeof hints] || "Use remote control to interact"
    );
  },

  /**
   * Create TV-friendly accessibility properties
   */
  createTVProps: (config: {
    label?: string;
    hint?: string;
    role?: string;
    isFocusable?: boolean;
  }) => {
    return {
      accessible: true,
      accessibilityLabel: config.label,
      accessibilityHint:
        config.hint || tvAccessibility.getTVHint(config.role || "navigate"),
      accessibilityRole: config.role || "button",
      focusable: config.isFocusable !== false,
      // TV-specific props
      isTVSelectable: config.isFocusable !== false,
      hasTVPreferredFocusArea: config.isFocusable !== false,
    };
  },
};

/**
 * TV design utilities for 10-foot UI
 */
export const tvDesign = {
  /**
   * Get minimum touch target size for TV
   */
  getMinTouchTarget: (): number => 48, // dp

  /**
   * Get focus border width
   */
  getFocusBorderWidth: (): number => 4,

  /**
   * Get grid spacing for TV
   */
  getGridSpacing: (): number => 16,

  /**
   * Get card border radius for TV
   */
  getCardBorderRadius: (): number => 12,

  /**
   * Get animation duration for TV
   */
  getAnimationDuration: (): number => 200,

  /**
   * Check if element is visible on TV screen
   */
  isTVVisible: (
    element: { x: number; y: number; width: number; height: number },
    screen: { width: number; height: number },
  ): boolean => {
    const { x, y, width, height } = element;
    const { width: screenWidth, height: screenHeight } = screen;

    // Check if element is within screen bounds with some margin
    const margin = 50;
    return (
      x + width > margin &&
      x < screenWidth - margin &&
      y + height > margin &&
      y < screenHeight - margin
    );
  },

  /**
   * Get TV-safe area insets
   */
  getTVSafeArea: () => ({
    top: 60, // Account for status bars and overscan
    bottom: 60, // Account for navigation and overscan
    left: 48, // Account for overscan
    right: 48, // Account for overscan
  }),
};

/**
 * Utility functions
 */
const getOppositeDirection = (
  direction: "up" | "down" | "left" | "right",
): "up" | "down" | "left" | "right" => {
  switch (direction) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
  }
};

/**
 * TV-specific constants
 */
export const TV_CONSTANTS = {
  MIN_TOUCH_TARGET: 48,
  FOCUS_BORDER_WIDTH: 4,
  GRID_SPACING: 16,
  CARD_BORDER_RADIUS: 12,
  ANIMATION_DURATION: 200,
  PREVIEW_ASPECT_RATIO: 16 / 9,
  SAFE_AREA: tvDesign.getTVSafeArea(),
} as const;

/**
 * Export all TV utilities
 */
export default {
  useTVNavigation,
  useTVFocusGuide,
  useTVGridNavigation,
  tvAccessibility,
  tvDesign,
  TV_CONSTANTS,
};
