// AI-META-BEGIN
// AI-META: Live Photo viewer component with tap-to-play motion and controls
// OWNERSHIP: client/components (UI components)
// ENTRYPOINTS: Used by PhotoDetailScreen to display Live Photos
// DEPENDENCIES: expo-image, expo-video, React Native Animated, live-photo modules
// DANGER: Video playback synchronization and memory management
// CHANGE-SAFETY: Safe to modify UI; risky to change playback timing
// TESTS: Test tap-to-play, transitions, error handling, cleanup
// AI-META-END

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { ThemedText } from '@/components/ThemedText';
import { Spacing, Colors } from '@/constants/theme';
import { LivePhotoProcessor, ProcessedLivePhoto } from '@/lib/live-photo/processor';
import { LivePhotoVideo, useLivePhotoPlayback } from '@/lib/live-photo/playback';
import { livePhotoStorage } from '@/lib/live-photo/storage';
import { Photo } from '@/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LivePhotoViewerProps {
  photo: Photo;
  style?: any;
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
  onError?: (error: Error) => void;
  showControls?: boolean;
  autoPlay?: boolean;
}

export default function LivePhotoViewer({
  photo,
  style,
  onPlaybackStart,
  onPlaybackEnd,
  onError,
  showControls = true,
  autoPlay = false,
}: LivePhotoViewerProps) {
  const { theme } = useTheme();
  const [processedLivePhoto, setProcessedLivePhoto] = useState<ProcessedLivePhoto | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLiveIndicator, setShowLiveIndicator] = useState(true);
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Check if photo is a Live Photo and process it
  useEffect(() => {
    if (photo.isLivePhoto && photo.liveVideoUri) {
      // Already processed Live Photo
      setProcessedLivePhoto({
        stillImageUri: photo.uri,
        videoUri: photo.liveVideoUri,
        metadata: {
          isLivePhoto: true,
          format: photo.livePhotoFormat || 'apple',
          presentationTimestampUs: photo.livePresentationTimestampUs,
          videoDuration: photo.liveVideoDuration,
        },
      });
    } else if (photo.isLivePhoto) {
      // Need to process the photo to extract video
      processLivePhoto();
    }
  }, [photo]);

  const processLivePhoto = useCallback(async () => {
    if (!photo.isLivePhoto || isProcessing) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // First check cache
      const cached = await livePhotoStorage.getLivePhoto(photo.id);
      
      if (cached) {
        setProcessedLivePhoto({
          stillImageUri: cached.stillUri,
          videoUri: cached.videoUri,
          metadata: {
            isLivePhoto: true,
            format: cached.format,
          },
        });
        return;
      }

      // Process the photo
      const processed = await LivePhotoProcessor.processLivePhoto(photo.uri);
      
      if (processed) {
        // Store in cache
        await livePhotoStorage.storeLivePhoto(
          photo.id,
          processed.stillImageUri,
          processed.videoUri,
          processed.metadata.format || 'apple'
        );

        setProcessedLivePhoto(processed);
      } else {
        setError('Failed to process Live Photo');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      onError?.(new Error(errorMessage));
    } finally {
      setIsProcessing(false);
    }
  }, [photo, isProcessing, onError]);

  const handlePlaybackStart = useCallback(() => {
    setShowLiveIndicator(false);
    onPlaybackStart?.();
  }, [onPlaybackStart]);

  const handlePlaybackEnd = useCallback(() => {
    setShowLiveIndicator(true);
    onPlaybackEnd?.();
  }, [onPlaybackEnd]);

  const handleError = useCallback((err: Error) => {
    setError(err.message);
    onError?.(err);
  }, [onError]);

  const handlePress = useCallback(() => {
    // Trigger subtle animation on press
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim]);

  if (error) {
    return (
      <View style={[styles.container, style, styles.errorContainer]}>
        <Feather name="alert-circle" size={48} color={Colors.light.error} />
        <ThemedText style={styles.errorText}>Live Photo Error</ThemedText>
        <ThemedText style={styles.errorSubtext}>{error}</ThemedText>
      </View>
    );
  }

  if (isProcessing) {
    return (
      <View style={[styles.container, style, styles.loadingContainer]}>
        <Feather name="loader" size={48} color={Colors.light.text} />
        <ThemedText style={styles.loadingText}>Processing Live Photo...</ThemedText>
      </View>
    );
  }

  if (!processedLivePhoto) {
    // Show regular photo if not a Live Photo
    return (
      <View style={[styles.container, style]}>
        <Image
          source={{ uri: photo.uri }}
          style={[styles.image, style]}
          contentFit="contain"
          transition={200}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={[styles.imageContainer, { transform: [{ scale: scaleAnim }] }]}>
        {/* Still image (shown when video is not playing) */}
        <Image
          source={{ uri: processedLivePhoto.stillImageUri }}
          style={[styles.image, style]}
          contentFit="contain"
          transition={0}
        />
        
        {/* Motion video overlay */}
        <LivePhotoVideo
          videoUri={processedLivePhoto.videoUri}
          style={[styles.videoOverlay, style]}
          presentationTimestampUs={processedLivePhoto.metadata.presentationTimestampUs}
          autoPlay={autoPlay}
          loop={true}
          onPlaybackStart={handlePlaybackStart}
          onPlaybackEnd={handlePlaybackEnd}
          onError={handleError}
          onPress={handlePress}
        />
      </Animated.View>

      {/* Live Photo indicator */}
      {showControls && showLiveIndicator && (
        <View style={styles.liveIndicator}>
          <View style={styles.liveIcon}>
            <Feather name="aperture" size={16} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.liveText}>LIVE</ThemedText>
        </View>
      )}

      {/* Processing overlay */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <Feather name="loader" size={32} color="#FFFFFF" />
          <ThemedText style={styles.processingText}>Processing...</ThemedText>
        </View>
      )}
    </View>
  );
}

/**
 * Live Photo Grid Item Component
 * 
 * Optimized version for use in photo grids with smaller size
 */
export function LivePhotoGridItem({
  photo,
  size,
  onPress,
}: {
  photo: Photo;
  size: number;
  onPress: () => void;
}) {
  const [showIndicator, setShowIndicator] = useState(true);

  const handlePlaybackStart = useCallback(() => {
    setShowIndicator(false);
  }, []);

  const handlePlaybackEnd = useCallback(() => {
    setShowIndicator(true);
  }, []);

  if (!photo.isLivePhoto) {
    return (
      <Pressable onPress={onPress} style={[styles.gridItem, { width: size, height: size }]}>
        <Image
          source={{ uri: photo.uri }}
          style={[styles.gridImage, { width: size, height: size }]}
          contentFit="cover"
        />
      </Pressable>
    );
  }

  return (
    <View style={[styles.gridItem, { width: size, height: size }]}>
      <LivePhotoViewer
        photo={photo}
        style={{ width: size, height: size }}
        onPlaybackStart={handlePlaybackStart}
        onPlaybackEnd={handlePlaybackEnd}
        showControls={false}
        autoPlay={false}
      />
      
      {/* Grid indicator */}
      {showIndicator && (
        <View style={styles.gridIndicator}>
          <View style={styles.gridLiveIcon}>
            <Feather name="aperture" size={10} color="#FFFFFF" />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  liveIndicator: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 12,
  },
  liveIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.xs,
  },
  liveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.error,
  },
  errorSubtext: {
    fontSize: 14,
    color: Colors.light.textSecondary,
    textAlign: 'center',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.light.textSecondary,
  },
  processingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  // Grid styles
  gridItem: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
  },
  gridImage: {
    borderRadius: 8,
  },
  gridIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  gridLiveIcon: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
