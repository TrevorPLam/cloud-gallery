// AI-META-BEGIN
// AI-META: Mobile keyboard navigation hook for accessibility compliance
// OWNERSHIP: client/hooks (accessibility)
// ENTRYPOINTS: Used by PhotoGrid, LoginScreen, RegisterScreen, and form components
// DEPENDENCIES: React Native Platform, BackHandler, Keyboard
// DANGER: Platform-specific keyboard behavior; must not break TV navigation
// CHANGE-SAFETY: Safe to modify keyboard event handling; risky to change focus management logic
// TESTS: Test tab navigation, arrow keys, escape handling, and platform differences
// AI-META-END

import { useEffect, useRef, useCallback } from 'react';
import { Platform, BackHandler, Keyboard } from 'react-native';

export interface KeyboardNavigationOptions {
  /** Enable keyboard navigation (default: true on mobile, false on web) */
  enabled?: boolean;
  /** Handle tab key navigation */
  onTab?: (direction: 'forward' | 'backward') => void;
  /** Handle arrow key navigation */
  onArrow?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  /** Handle enter/space key activation */
  onActivate?: () => void;
  /** Handle escape key */
  onEscape?: () => void;
  /** Custom focusable elements selector */
  focusableSelector?: string;
}

/**
 * Hook for implementing mobile keyboard navigation
 * Provides tab, arrow, enter/space, and escape key handling
 * Maintains compatibility with TV navigation (D-pad)
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const {
    enabled = Platform.OS !== 'web',
    onTab,
    onArrow,
    onActivate,
    onEscape,
    focusableSelector = '[accessible=true]'
  } = options;

  const focusableElementsRef = useRef<any[]>([]);
  const currentFocusIndexRef = useRef<number>(-1);

  /**
   * Get all focusable elements in the current screen
   */
  const getFocusableElements = useCallback(() => {
    // This is a placeholder - in React Native, we need to track focusable elements manually
    // since we don't have DOM querySelector like on web
    return focusableElementsRef.current;
  }, []);

  /**
   * Move focus to the next/previous element
   */
  const moveFocus = useCallback((direction: 'forward' | 'backward') => {
    const elements = getFocusableElements();
    if (elements.length === 0) return;

    const currentIndex = currentFocusIndexRef.current;
    let nextIndex: number;

    if (direction === 'forward') {
      nextIndex = (currentIndex + 1) % elements.length;
    } else {
      nextIndex = currentIndex <= 0 ? elements.length - 1 : currentIndex - 1;
    }

    // Focus the next element if it exists and is focusable
    const nextElement = elements[nextIndex];
    if (nextElement && typeof nextElement.focus === 'function') {
      nextElement.focus();
      currentFocusIndexRef.current = nextIndex;
    }

    // Call custom tab handler
    onTab?.(direction);
  }, [getFocusableElements, onTab]);

  /**
   * Handle arrow key navigation within groups
   */
  const handleArrowKey = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    onArrow?.(direction);
  }, [onArrow]);

  /**
   * Handle enter/space key activation
   */
  const handleActivate = useCallback(() => {
    onActivate?.();
  }, [onActivate]);

  /**
   * Handle escape key
   */
  const handleEscape = useCallback(() => {
    onEscape?.();
  }, [onEscape]);

  /**
   * Register a focusable element
   */
  const registerFocusableElement = useCallback((element: any, index?: number) => {
    if (index !== undefined) {
      focusableElementsRef.current[index] = element;
    } else {
      focusableElementsRef.current.push(element);
    }
  }, []);

  /**
   * Unregister a focusable element
   */
  const unregisterFocusableElement = useCallback((index: number) => {
    focusableElementsRef.current.splice(index, 1);
    if (currentFocusIndexRef.current >= index) {
      currentFocusIndexRef.current = Math.max(0, currentFocusIndexRef.current - 1);
    }
  }, []);

  /**
   * Set current focus index
   */
  const setFocusIndex = useCallback((index: number) => {
    const elements = getFocusableElements();
    if (index >= 0 && index < elements.length) {
      currentFocusIndexRef.current = index;
    }
  }, [getFocusableElements]);

  // Keyboard event handling for mobile platforms
  useEffect(() => {
    if (!enabled) return;

    // For React Native, we need to handle keyboard events differently than web
    // React Native doesn't have a global keyboard event system like the web
    
    // On Android, we can use BackHandler for escape functionality
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleEscape();
      return true; // Prevent default behavior
    });

    // For keyboard support, we need to rely on the built-in React Native
    // focus management system and accessibility properties
    
    return () => {
      backHandler.remove();
    };
  }, [enabled, handleEscape]);

  // Handle keyboard show/hide for mobile
  useEffect(() => {
    if (!enabled) return;

    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      // When keyboard appears, we might want to adjust focus behavior
      // This is platform-specific and may need customization
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      // When keyboard disappears, reset focus if needed
    });

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [enabled]);

  return {
    // Methods for components to use
    moveFocus,
    handleArrowKey,
    handleActivate,
    handleEscape,
    registerFocusableElement,
    unregisterFocusableElement,
    setFocusIndex,
    getCurrentFocusIndex: () => currentFocusIndexRef.current,
    getFocusableElements,
    
    // State
    enabled,
  };
}

/**
 * Hook for implementing grid navigation with arrow keys
 * Specifically designed for photo grids, lists, and other grid layouts
 */
export function useGridNavigation(options: {
  columns: number;
  itemCount: number;
  onNavigate?: (index: number) => void;
  onActivate?: (index: number) => void;
  enabled?: boolean;
}) {
  const { columns, itemCount, onNavigate, onActivate, enabled = true } = options;
  const currentIndexRef = useRef<number>(0);

  const navigateToIndex = useCallback((index: number) => {
    if (index >= 0 && index < itemCount) {
      currentIndexRef.current = index;
      onNavigate?.(index);
    }
  }, [itemCount, onNavigate]);

  const handleArrowKey = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!enabled) return;

    const currentIndex = currentIndexRef.current;
    const row = Math.floor(currentIndex / columns);
    const col = currentIndex % columns;
    let newIndex = currentIndex;

    switch (direction) {
      case 'up':
        newIndex = Math.max(0, (row - 1) * columns + col);
        break;
      case 'down':
        newIndex = Math.min(itemCount - 1, (row + 1) * columns + col);
        break;
      case 'left':
        newIndex = col > 0 ? currentIndex - 1 : currentIndex;
        break;
      case 'right':
        newIndex = col < columns - 1 && currentIndex < itemCount - 1 ? currentIndex + 1 : currentIndex;
        break;
    }

    if (newIndex !== currentIndex) {
      navigateToIndex(newIndex);
    }
  }, [enabled, columns, itemCount, navigateToIndex]);

  const handleActivate = useCallback(() => {
    if (enabled) {
      onActivate?.(currentIndexRef.current);
    }
  }, [enabled, onActivate]);

  return {
    currentIndex: currentIndexRef.current,
    navigateToIndex,
    handleArrowKey,
    handleActivate,
    setIndex: (index: number) => {
      currentIndexRef.current = index;
      navigateToIndex(index);
    },
  };
}
