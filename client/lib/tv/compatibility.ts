// AI-META-BEGIN
// AI-META: TV compatibility utilities for cross-platform support
// OWNERSHIP: client/lib/tv
// ENTRYPOINTS: Imported by TV-specific components
// DEPENDENCIES: react-native, typescript
// DANGER: Must gracefully handle missing TV APIs
// CHANGE-SAFETY: Add new TV features as they become available
// TESTS: Used by TV components and mobile fallback
// AI-META-END

// TV compatibility utilities
// Provides cross-platform support for TV-specific features

import React from 'react';
import { Platform } from 'react-native';
import type { 
  TVPlatformInfo, 
  TVNavigationOptions, 
  TVGestureHandlers,
  TVFocusGuideViewProps 
} from '../types/tv';

/**
 * Check if running on TV platform
 */
export const isTVPlatform = (): boolean => {
  return Platform.isTV || 
         Platform.OS === 'ios' && Platform.isPad && 
         // Additional TV detection logic
         false;
};

/**
 * Get TV platform information
 */
export const getTVPlatformInfo = (): TVPlatformInfo => {
  if (!isTVPlatform()) {
    return {
      isTV: false,
      platform: 'unknown',
      hasDpad: false,
      hasVoiceControl: false,
    };
  }

  // Platform-specific detection
  if (Platform.OS === 'ios') {
    return {
      isTV: true,
      platform: 'apple-tv',
      hasDpad: true,
      hasVoiceControl: true,
    };
  }

  if (Platform.OS === 'android') {
    return {
      isTV: true,
      platform: 'android-tv',
      hasDpad: true,
      hasVoiceControl: false,
    };
  }

  return {
    isTV: true,
    platform: 'unknown',
    hasDpad: false,
    hasVoiceControl: false,
  };
};

/**
 * TV-safe navigation hook
 */
export const useTVSafeNavigation = (options?: TVNavigationOptions) => {
  const tvInfo = getTVPlatformInfo();
  
  if (!tvInfo.isTV) {
    return {
      navigate: () => {},
      canNavigate: () => false,
      getCurrentFocus: () => null,
    };
  }

  // Real TV navigation implementation would go here
  return {
    navigate: (direction: 'up' | 'down' | 'left' | 'right') => {
      console.log(`TV navigation: ${direction}`);
    },
    canNavigate: (direction: 'up' | 'down' | 'left' | 'right') => true,
    getCurrentFocus: () => null,
  };
};

/**
 * TV-safe gesture handler hook
 */
export const useTVSafeGestures = (handlers: TVGestureHandlers) => {
  const tvInfo = getTVPlatformInfo();
  
  if (!tvInfo.isTV) {
    return {
      onArrowPress: () => {},
      onSelect: () => {},
      onBack: () => {},
      onMenu: () => {},
    };
  }

  return {
    onArrowPress: (direction: 'up' | 'down' | 'left' | 'right') => {
      handlers.onArrowPress?.(direction);
    },
    onSelect: () => {
      handlers.onSelect?.();
    },
    onBack: () => {
      handlers.onBack?.();
    },
    onMenu: () => {
      handlers.onMenu?.();
    },
  };
};

/**
 * TV-safe focus guide component
 */
export const TVSafeFocusGuide: React.FC<TVFocusGuideViewProps> = ({ 
  children, 
  focusable = true,
  ...props 
}) => {
  const tvInfo = getTVPlatformInfo();
  
  if (!tvInfo.isTV) {
    return React.createElement(React.Fragment, null, children);
  }

  // Real TVFocusGuideView implementation would go here
  return React.createElement('div', {
    'data-tv-focusable': focusable,
    'data-tv-focus-guide': true,
    ...props
  }, children);
};

/**
 * TV-safe styling utilities
 */
export const getTVSafeStyles = (focused?: boolean) => {
  const tvInfo = getTVPlatformInfo();
  
  if (!tvInfo.isTV) {
    return {};
  }

  return {
    transform: focused ? [{ scale: 1.05 }] : [{ scale: 1 }],
    opacity: focused ? 1 : 0.8,
    shadowColor: focused ? '#000' : 'transparent',
    shadowOffset: focused ? { width: 0, height: 2 } : { width: 0, height: 0 },
    shadowOpacity: focused ? 0.3 : 0,
    shadowRadius: focused ? 4 : 0,
  };
};

/**
 * TV-safe event handling
 */
export const useTVSafeEvents = () => {
  const tvInfo = getTVPlatformInfo();
  
  return {
    handleKeyDown: (event: KeyboardEvent) => {
      if (!tvInfo.isTV) return;

      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'ArrowLeft':
        case 'ArrowRight':
          // Handle DPAD navigation
          break;
        case 'Enter':
        case 'Space':
          // Handle selection
          break;
        case 'Escape':
          // Handle back
          break;
        default:
          break;
      }
    },
    
    handleTVEvent: (event: any) => {
      if (!tvInfo.isTV) return;
      
      console.log('TV event:', event);
    },
  };
};

/**
 * TV-safe accessibility
 */
export const getTVSafeAccessibilityProps = (focused?: boolean) => {
  const tvInfo = getTVPlatformInfo();
  
  if (!tvInfo.isTV) {
    return {
      accessibilityRole: 'none' as const,
    };
  }

  return {
    accessibilityRole: 'button' as const,
    accessibilityLabel: focused ? 'Focused' : undefined,
    accessibilityHint: 'Use arrow keys to navigate, Enter to select',
  };
};

// Export TV compatibility utilities
export const TVCompatibility = {
  isTVPlatform,
  getTVPlatformInfo,
  useTVSafeNavigation,
  useTVSafeGestures,
  TVSafeFocusGuide,
  getTVSafeStyles,
  useTVSafeEvents,
  getTVSafeAccessibilityProps,
};

export default TVCompatibility;
