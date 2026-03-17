// AI-META-BEGIN
// AI-META: Type definitions for React Native TV compatibility
// OWNERSHIP: client/types
// ENTRYPOINTS: Imported by components using TV-specific features
// DEPENDENCIES: typescript
// DANGER: Type definitions must match actual TV API
// CHANGE-SAFETY: Update types when TV API changes
// TESTS: Used by TV components and tests
// AI-META-END

// Type definitions for React Native TV
// Provides compatibility layer for TV-specific APIs and features

declare global {
  namespace ReactNativeTV {
    interface TVFocusGuideViewProps {
      children: React.ReactNode;
      style?: any;
      focusable?: boolean;
    }

    interface TVNavigationDirection {
      up?: React.ReactNode;
      down?: React.ReactNode;
      left?: React.ReactNode;
      right?: React.ReactNode;
    }

    interface TVMenuController {
      open: () => void;
      close: () => void;
      isOpen: () => boolean;
    }

    interface TVEvent {
      eventType: 'focus' | 'blur' | 'select' | 'back' | 'menu';
      target: any;
      timestamp: number;
    }
  }
}

// TV-specific component props
export interface TVFocusGuideViewProps {
  children: React.ReactNode;
  style?: any;
  focusable?: boolean;
  autoFocus?: boolean;
  nextFocusDown?: string;
  nextFocusUp?: string;
  nextFocusLeft?: string;
  nextFocusRight?: string;
}

// TV navigation utilities
export interface TVNavigationOptions {
  wrap?: boolean;
  enableSoundEffects?: boolean;
  focusAnimationDuration?: number;
}

// TV-specific gesture handlers
export interface TVGestureHandlers {
  onArrowPress?: (direction: 'up' | 'down' | 'left' | 'right') => void;
  onSelect?: () => void;
  onBack?: () => void;
  onMenu?: () => void;
}

// TV platform detection
export interface TVPlatformInfo {
  isTV: boolean;
  platform: 'apple-tv' | 'android-tv' | 'fire-tv' | 'unknown';
  hasDpad: boolean;
  hasVoiceControl: boolean;
}

// TV-specific styling
export interface TVStyleProps {
  focused?: boolean;
  scale?: number;
  opacity?: number;
  transform?: {
    scale?: number;
    translateX?: number;
    translateY?: number;
  };
}

// Mock implementations for non-TV platforms
export const TVFocusGuideView: React.FC<TVFocusGuideViewProps> = ({ children }) => {
  return React.createElement('div', { 'data-tv-focus-guide': true }, children);
};

export const useTVFocus = () => {
  return {
    focused: false,
    focusable: true,
    setFocusable: () => {},
    requestFocus: () => {},
    releaseFocus: () => {},
  };
};

export const useTVNavigation = (options?: TVNavigationOptions) => {
  return {
    navigate: (direction: 'up' | 'down' | 'left' | 'right') => {},
    canNavigate: (direction: 'up' | 'down' | 'left' | 'right') => false,
    getCurrentFocus: () => null,
  };
};

export const useTVGestureHandlers = (handlers: TVGestureHandlers) => {
  return {
    onArrowPress: handlers.onArrowPress || (() => {}),
    onSelect: handlers.onSelect || (() => {}),
    onBack: handlers.onBack || (() => {}),
    onMenu: handlers.onMenu || (() => {}),
  };
};

export const getTVPlatformInfo = (): TVPlatformInfo => {
  return {
    isTV: false,
    platform: 'unknown',
    hasDpad: false,
    hasVoiceControl: false,
  };
};

// TV-specific constants
export const TV_CONSTANTS = {
  FOCUS_SCALE: 1.05,
  FOCUS_ANIMATION_DURATION: 200,
  DPAD_REPEAT_DELAY: 500,
  VOICE_RECOGNITION_TIMEOUT: 5000,
} as const;

// Export types for use in components
export type {
  TVFocusGuideViewProps,
  TVNavigationOptions,
  TVGestureHandlers,
  TVPlatformInfo,
  TVStyleProps,
};
