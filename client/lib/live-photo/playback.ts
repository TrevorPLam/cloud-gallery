// AI-META-BEGIN
// AI-META: Live Photo video playback engine with synchronized still-to-motion transitions
// OWNERSHIP: client/lib/live-photo (Live Photo playback)
// ENTRYPOINTS: Imported by LivePhotoViewer component for motion video playback
// DEPENDENCIES: expo-video, React Native Animated, React hooks
// DANGER: Video playback synchronization and memory management
// CHANGE-SAFETY: Safe to add new playback features; risky to change timing logic
// TESTS: Test playback synchronization, memory cleanup, and error handling
// AI-META-END

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';

export interface LivePhotoPlaybackOptions {
  autoPlay?: boolean;
  loop?: boolean;
  presentationTimestampUs?: number;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: Error) => void;
}

export interface LivePhotoPlaybackState {
  isPlaying: boolean;
  isLoaded: boolean;
  duration: number;
  currentTime: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Live Photo Playback Hook
 * 
 * Manages synchronized playback of Live Photo motion video with smooth
 * transitions from still image to motion and back.
 */
export function useLivePhotoPlayback(
  videoUri: string,
  options: LivePhotoPlaybackOptions = {}
) {
  const {
    autoPlay = false,
    loop = true,
    presentationTimestampUs,
    onPlaybackStart,
    onPlaybackEnd,
    onError,
  } = options;

  // Video player setup
  const player = useVideoPlayer(videoUri, (player) => {
    player.loop = loop;
    player.volume = 0; // Live Photos are typically silent
    
    if (presentationTimestampUs) {
      // Convert microseconds to seconds for video player
      const seekTime = presentationTimestampUs / 1_000_000;
      player.seekTo(seekTime);
    }
  });

  // Playback state
  const [playbackState, setPlaybackState] = useState<LivePhotoPlaybackState>({
    isPlaying: false,
    isLoaded: false,
    duration: 0,
    currentTime: 0,
    isLoading: true,
    error: null,
  });

  // Animation values
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const isTransitioning = useSharedValue(false);

  // Refs for cleanup
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isMountedRef = useRef(true);

  // Animated styles for smooth transitions
  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  // Handle player state changes
  useEffect(() => {
    const unsubscribeLoaded = player.addListener('loadedForSource', () => {
      if (!isMountedRef.current) return;
      
      setPlaybackState(prev => ({
        ...prev,
        isLoaded: true,
        duration: player.duration || 0,
        isLoading: false,
        error: null,
      }));

      if (autoPlay) {
        startPlayback();
      }
    });

    const unsubscribePlaybackChange = player.addListener('playingChange', (isPlaying) => {
      if (!isMountedRef.current) return;
      
      setPlaybackState(prev => ({
        ...prev,
        isPlaying: isPlaying.playing,
        currentTime: player.currentTime || 0,
      }));

      if (isPlaying.playing && onPlaybackStart) {
        onPlaybackStart();
      } else if (!isPlaying.playing && onPlaybackEnd) {
        onPlaybackEnd();
      }
    });

    const unsubscribeTimeUpdate = player.addListener('timeUpdate', (time) => {
      if (!isMountedRef.current) return;
      
      setPlaybackState(prev => ({
        ...prev,
        currentTime: time.currentTime || 0,
      }));
    });

    const unsubscribeError = player.addListener('error', (error) => {
      if (!isMountedRef.current) return;
      
      const errorMessage = error?.error?.message || 'Unknown playback error';
      setPlaybackState(prev => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));

      if (onError) {
        onError(new Error(errorMessage));
      }
    });

    return () => {
      unsubscribeLoaded?.();
      unsubscribePlaybackChange?.();
      unsubscribeTimeUpdate?.();
      unsubscribeError?.();
    };
  }, [player, autoPlay, onPlaybackStart, onPlaybackEnd, onError]);

  // Start playback with smooth transition
  const startPlayback = useCallback(() => {
    if (!playbackState.isLoaded || playbackState.isPlaying) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Start transition animation
    isTransitioning.value = true;
    opacity.value = withTiming(0.8, { duration: 150 }, () => {
      runOnJS(() => {
        player.play();
        // Smooth scale transition during motion
        scale.value = withSpring(1.02, { damping: 20, stiffness: 300 });
        opacity.value = withSpring(1, { damping: 20, stiffness: 300 });
        isTransitioning.value = false;
      })();
    });
  }, [playbackState.isLoaded, playbackState.isPlaying, player, opacity, scale, isTransitioning]);

  // Stop playback with smooth transition back to still
  const stopPlayback = useCallback(() => {
    if (!playbackState.isPlaying) {
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Start transition animation back to still
    isTransitioning.value = true;
    opacity.value = withTiming(0.8, { duration: 150 }, () => {
      runOnJS(() => {
        player.pause();
        // Reset scale and opacity
        scale.value = withSpring(1, { damping: 20, stiffness: 300 });
        opacity.value = withSpring(1, { damping: 20, stiffness: 300 });
        isTransitioning.value = false;
        
        // Seek back to presentation timestamp if available
        if (presentationTimestampUs) {
          const seekTime = presentationTimestampUs / 1_000_000;
          player.seekTo(seekTime);
        }
      })();
    });
  }, [playbackState.isPlaying, player, opacity, scale, isTransitioning, presentationTimestampUs]);

  // Toggle playback (for tap-to-play functionality)
  const togglePlayback = useCallback(() => {
    if (isTransitioning.value || playbackState.isLoading) {
      return;
    }

    if (playbackState.isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [playbackState.isPlaying, playbackState.isLoading, isTransitioning, startPlayback, stopPlayback]);

  // Auto-stop after typical Live Photo duration (3 seconds)
  useEffect(() => {
    if (playbackState.isPlaying && !loop) {
      timeoutRef.current = setTimeout(() => {
        stopPlayback();
      }, 3000); // 3 seconds typical Live Photo duration
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [playbackState.isPlaying, loop, stopPlayback]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      player.pause();
    };
  }, [player]);

  return {
    player,
    playbackState,
    animatedStyle,
    startPlayback,
    stopPlayback,
    togglePlayback,
    isTransitioning: isTransitioning.value,
  };
}

/**
 * Live Photo Playback Component
 * 
 * Renders the motion video component of a Live Photo with
 * synchronized playback and smooth transitions.
 */
export function LivePhotoVideo({
  videoUri,
  style,
  presentationTimestampUs,
  autoPlay = false,
  loop = true,
  onPlaybackStart,
  onPlaybackEnd,
  onError,
  onPress,
}: {
  videoUri: string;
  style?: any;
  presentationTimestampUs?: number;
  autoPlay?: boolean;
  loop?: boolean;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: Error) => void;
  onPress?: () => void;
}) {
  const {
    player,
    playbackState,
    animatedStyle,
    togglePlayback,
    isTransitioning,
  } = useLivePhotoPlayback(videoUri, {
    autoPlay,
    loop,
    presentationTimestampUs,
    onPlaybackStart,
    onPlaybackEnd,
    onError,
  });

  const handlePress = useCallback(() => {
    if (!isTransitioning && !playbackState.isLoading) {
      togglePlayback();
      onPress?.();
    }
  }, [togglePlayback, isTransitioning, playbackState.isLoading, onPress]);

  if (playbackState.error) {
    console.error('Live Photo playback error:', playbackState.error);
    return null;
  }

  return React.createElement(
    Animated.View,
    { style: [style, animatedStyle] },
    React.createElement(
      VideoView,
      {
        style: style,
        player: player,
        allowsFullscreen: false,
        allowsPictureInPicture: false,
        nativeControls: false,
        contentFit: 'cover',
        onTouchEnd: handlePress,
      }
    )
  );
}

/**
 * Live Photo Still Image Component
 * 
 * Renders the still image component of a Live Photo with
 * overlay indicators for motion capability.
 */
export function LivePhotoStill({
  imageUri,
  style,
  showLiveIndicator = true,
  onPress,
}: {
  imageUri: string;
  style?: any;
  showLiveIndicator?: boolean;
  onPress?: () => void;
}) {
  return React.createElement(
    Animated.View,
    { style: style },
    /* Still image would be rendered here using expo-image */
    /* This is a placeholder - actual implementation would use Image component */
    showLiveIndicator && React.createElement(LivePhotoIndicator, { style: styles.indicator })
  );
}

/**
 * Live Photo indicator component
 */
function LivePhotoIndicator({ style }: { style?: any }) {
  return React.createElement(
    Animated.View,
    { style: [styles.indicatorContainer, style] },
    /* Live Photo "LIVE" indicator */
    /* This would show the concentric circles icon */
  );
}

const styles = {
  indicatorContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    // Style for the Live Photo indicator icon
  },
};
