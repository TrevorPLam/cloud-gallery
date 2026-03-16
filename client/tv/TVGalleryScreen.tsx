// AI-META-BEGIN
// AI-META: TV-optimized gallery screen with 10-foot UI and focus management
// OWNERSHIP: client/tv/screens
// DEPENDENCIES: react-native-tvos, TVFocusGuideView, streaming-service, voice-search
// DANGER: TV navigation requires proper focus management; ensure accessibility compliance
// CHANGE-SAFETY: safe to add new TV features; maintain focus navigation patterns
// TESTS: test with D-pad navigation; verify focus indicators and accessibility
// AI-META-END

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  Platform,
  TouchableOpacity,
  Text,
  Image,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { TVFocusGuideView } from 'react-native-tvos';
import { Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

import { tvStreamingService, StreamConfig, StreamingState } from '../streaming-service';
import { tvVoiceSearchService, VoiceCommand, VoiceSearchState } from '../voice-search';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// TV-specific constants for 10-foot UI
const TV_CONSTANTS = {
  MIN_TOUCH_TARGET: 48, // dp
  FOCUS_BORDER_WIDTH: 4,
  GRID_SPACING: 16,
  CARD_BORDER_RADIUS: 12,
  ANIMATION_DURATION: 200,
  PREVIEW_ASPECT_RATIO: 16 / 9,
} as const;

interface PhotoItem {
  id: string;
  uri: string;
  thumbnail: string;
  title: string;
  duration?: number;
  isVideo: boolean;
  resolution?: {
    width: number;
    height: number;
  };
}

interface TVGalleryScreenProps {
  navigation: any;
  route: {
    params?: {
      albumId?: string;
      initialQuery?: string;
    };
  };
}

export const TVGalleryScreen: React.FC<TVGalleryScreenProps> = ({
  navigation,
  route,
}) => {
  // State management
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState(route.params?.initialQuery || '');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showVoiceHelp, setShowVoiceHelp] = useState(false);
  const [gridColumns, setGridColumns] = useState(4);

  // Refs for TV navigation
  const videoRef = useRef<Video>(null);
  const flatListRef = useRef<FlatList>(null);
  const searchInputRef = useRef<TextInput>(null);
  const focusGuideRefs = useRef<(View | null)[]>([]);

  // Streaming and voice states
  const [streamingState, setStreamingState] = useState<StreamingState | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceSearchState | null>(null);

  // Initialize services and TV-specific setup
  useEffect(() => {
    setupTVServices();
    loadPhotos();
    setupTVNavigation();

    return () => {
      cleanup();
    };
  }, []);

  // Handle route params and voice search
  useEffect(() => {
    if (route.params?.initialQuery) {
      handleSearch(route.params.initialQuery);
    }
  }, [route.params]);

  /**
   * Setup TV-specific services
   */
  const setupTVServices = async () => {
    try {
      // Setup streaming service
      if (selectedPhoto?.isVideo) {
        const streamConfig = createStreamConfig(selectedPhoto);
        await tvStreamingService.initialize(streamConfig);
        tvStreamingService.setVideoRef(videoRef.current || undefined);
      }

      // Subscribe to streaming state changes
      const unsubscribeStreaming = tvStreamingService.subscribe(setStreamingState);

      // Setup voice search
      const unsubscribeVoice = tvVoiceSearchService.subscribe(setVoiceState);
      tvVoiceSearchService.onCommand(handleVoiceCommand);

      return () => {
        unsubscribeStreaming();
        unsubscribeVoice();
      };
    } catch (error) {
      console.error('Failed to setup TV services:', error);
    }
  };

  /**
   * Setup TV navigation and focus management
   */
  const setupTVNavigation = () => {
    // Calculate optimal grid columns for screen size
    const columns = Math.floor(screenWidth / 200); // 200dp per column minimum
    setGridColumns(Math.max(3, Math.min(6, columns)));

    // Set up focus guide refs
    focusGuideRefs.current = new Array(gridColumns).fill(null);
  };

  /**
   * Load photos for gallery
   */
  const loadPhotos = async () => {
    try {
      // Mock data - in real implementation, this would fetch from API
      const mockPhotos: PhotoItem[] = Array.from({ length: 20 }, (_, index) => ({
        id: `photo-${index}`,
        uri: `https://picsum.photos/400/300?random=${index}`,
        thumbnail: `https://picsum.photos/200/150?random=${index}`,
        title: `Photo ${index + 1}`,
        isVideo: index % 5 === 0, // Every 5th item is a video
        duration: index % 5 === 0 ? Math.floor(Math.random() * 300) + 30 : undefined,
        resolution: {
          width: 1920,
          height: 1080,
        },
      }));

      setPhotos(mockPhotos);
    } catch (error) {
      console.error('Failed to load photos:', error);
      Alert.alert('Error', 'Failed to load photos');
    }
  };

  /**
   * Handle photo selection for TV navigation
   */
  const handlePhotoSelect = useCallback((photo: PhotoItem, index: number) => {
    setSelectedPhoto(photo);
    setFocusedIndex(index);

    if (photo.isVideo) {
      // Setup video streaming
      setupVideoPlayback(photo);
    } else {
      // Show photo preview
      showPhotoPreview(photo);
    }
  }, []);

  /**
   * Setup video playback for TV
   */
  const setupVideoPlayback = async (photo: PhotoItem) => {
    try {
      const streamConfig = createStreamConfig(photo);
      await tvStreamingService.initialize(streamConfig);
      tvStreamingService.setVideoRef(videoRef.current || undefined);
      await tvStreamingService.play();
      setIsPlaying(true);
    } catch (error) {
      console.error('Failed to setup video playback:', error);
      Alert.alert('Error', 'Failed to play video');
    }
  };

  /**
   * Show photo preview
   */
  const showPhotoPreview = (photo: PhotoItem) => {
    // In a real implementation, this would show a full-screen preview
    navigation.navigate('PhotoPreview', { photoId: photo.id });
  };

  /**
   * Handle voice commands
   */
  const handleVoiceCommand = useCallback((command: VoiceCommand) => {
    switch (command.intent) {
      case 'search':
        handleSearch(command.parameters.query);
        break;
      case 'navigate':
        handleNavigation(command.parameters.destination);
        break;
      case 'play':
        if (selectedPhoto?.isVideo) {
          tvStreamingService.play();
          setIsPlaying(true);
        }
        break;
    }
  }, [selectedPhoto]);

  /**
   * Handle search functionality
   */
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    // In real implementation, this would filter photos
    console.log('Searching for:', query);
  }, []);

  /**
   * Handle navigation commands
   */
  const handleNavigation = useCallback((destination: string) => {
    switch (destination) {
      case 'albums':
        navigation.navigate('Albums');
        break;
      case 'recent':
        navigation.navigate('Recent');
        break;
      case 'favorites':
        navigation.navigate('Favorites');
        break;
      case 'settings':
        navigation.navigate('Settings');
        break;
      default:
        console.log('Unknown destination:', destination);
    }
  }, [navigation]);

  /**
   * Start voice search
   */
  const startVoiceSearch = async () => {
    try {
      await tvVoiceSearchService.startListening();
    } catch (error) {
      console.error('Failed to start voice search:', error);
      Alert.alert('Error', 'Failed to start voice search');
    }
  };

  /**
   * Create stream configuration for video
   */
  const createStreamConfig = (photo: PhotoItem): StreamConfig => {
    return {
      url: photo.uri,
      format: 'hls',
      qualities: [
        { bitrate: 2000, resolution: { width: 1920, height: 1080 }, label: '1080p' },
        { bitrate: 1000, resolution: { width: 1280, height: 720 }, label: '720p' },
        { bitrate: 500, resolution: { width: 854, height: 480 }, label: '480p' },
      ],
      fallbackQuality: { bitrate: 500, resolution: { width: 854, height: 480 }, label: '480p' },
    };
  };

  /**
   * Render photo grid item with TV focus
   */
  const renderPhotoItem = ({ item, index }: { item: PhotoItem; index: number }) => {
    const isFocused = focusedIndex === index;
    
    return (
      <TVFocusGuideView
        key={item.id}
        style={styles.photoItemContainer}
        autoFocus={index === 0}
      >
        <TouchableOpacity
          style={[
            styles.photoItem,
            isFocused && styles.photoItemFocused,
          ]}
          onPress={() => handlePhotoSelect(item, index)}
          onFocus={() => setFocusedIndex(index)}
          activeOpacity={0.8}
        >
          <Image
            source={{ uri: item.thumbnail }}
            style={styles.photoThumbnail}
            resizeMode="cover"
          />
          
          {/* Video indicator */}
          {item.isVideo && (
            <View style={styles.videoIndicator}>
              <Ionicons name="play-circle" size={24} color="white" />
              <Text style={styles.videoDuration}>
                {formatDuration(item.duration || 0)}
              </Text>
            </View>
          )}

          {/* Focus indicator */}
          {isFocused && (
            <View style={styles.focusIndicator} />
          )}

          <Text style={styles.photoTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </TouchableOpacity>
      </TVFocusGuideView>
    );
  };

  /**
   * Render search bar with voice integration
   */
  const renderSearchBar = () => (
    <View style={styles.searchBarContainer}>
      <View style={styles.searchInputContainer}>
        <Ionicons name="search" size={24} color="#666" style={styles.searchIcon} />
        <TextInput
          ref={searchInputRef}
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={() => handleSearch(searchQuery)}
          placeholder="Search photos..."
          placeholderTextColor="#666"
          clearButtonMode="while-editing"
        />
      </View>
      
      <TouchableOpacity
        style={[
          styles.voiceButton,
          voiceState?.isListening && styles.voiceButtonActive,
        ]}
        onPress={startVoiceSearch}
        onFocus={() => setShowVoiceHelp(true)}
        onBlur={() => setShowVoiceHelp(false)}
      >
        <Ionicons 
          name="mic" 
          size={24} 
          color={voiceState?.isListening ? "#fff" : "#666"} 
        />
      </TouchableOpacity>

      {/* Voice help tooltip */}
      {showVoiceHelp && (
        <View style={styles.voiceHelp}>
          <Text style={styles.voiceHelpText}>
            Say "Search for [photos]" or "Go to [screen]"
          </Text>
        </View>
      )}
    </View>
  );

  /**
   * Render video player for TV
   */
  const renderVideoPlayer = () => {
    if (!selectedPhoto?.isVideo) return null;

    return (
      <View style={styles.videoPlayerContainer}>
        <Video
          ref={videoRef}
          source={{ uri: selectedPhoto.uri }}
          style={styles.videoPlayer}
          useNativeControls
          resizeMode="contain"
          shouldPlay={isPlaying}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlaying(false);
            }
          }}
        />
        
        {/* Streaming quality indicator */}
        {streamingState?.currentQuality && (
          <View style={styles.qualityIndicator}>
            <Text style={styles.qualityText}>
              {streamingState.currentQuality.label}
            </Text>
          </View>
        )}

        {/* Voice search status */}
        {voiceState?.isListening && (
          <View style={styles.voiceStatus}>
            <Ionicons name="mic" size={20} color="red" />
            <Text style={styles.voiceStatusText}>Listening...</Text>
          </View>
        )}
      </View>
    );
  };

  /**
   * Format duration for video display
   */
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  /**
   * Cleanup resources
   */
  const cleanup = () => {
    tvStreamingService.cleanup();
    tvVoiceSearchService.cleanup();
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      {renderSearchBar()}

      {/* Main content area */}
      <View style={styles.contentContainer}>
        {/* Photo grid */}
        <FlatList
          ref={flatListRef}
          data={photos}
          renderItem={renderPhotoItem}
          keyExtractor={(item) => item.id}
          numColumns={gridColumns}
          contentContainerStyle={styles.photoGrid}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={6}
          windowSize={10}
        />

        {/* Video player overlay */}
        {renderVideoPlayer()}
      </View>

      {/* Status indicators */}
      <View style={styles.statusBar}>
        {streamingState?.isLoading && (
          <Text style={styles.statusText}>Loading stream...</Text>
        )}
        {streamingState?.error && (
          <Text style={[styles.statusText, styles.errorText]}>
            {streamingState.error}
          </Text>
        )}
        {voiceState?.error && (
          <Text style={[styles.statusText, styles.errorText]}>
            {voiceState.error}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: TV_CONSTANTS.GRID_SPACING,
    backgroundColor: '#2a2a2a',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3a3a3a',
    borderRadius: TV_CONSTANTS.CARD_BORDER_RADIUS,
    paddingHorizontal: TV_CONSTANTS.GRID_SPACING,
    marginRight: TV_CONSTANTS.GRID_SPACING,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: TV_CONSTANTS.MIN_TOUCH_TARGET,
    color: '#fff',
    fontSize: 16,
  },
  voiceButton: {
    width: TV_CONSTANTS.MIN_TOUCH_TARGET,
    height: TV_CONSTANTS.MIN_TOUCH_TARGET,
    borderRadius: TV_CONSTANTS.MIN_TOUCH_TARGET / 2,
    backgroundColor: '#3a3a3a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonActive: {
    backgroundColor: '#e74c3c',
  },
  voiceHelp: {
    position: 'absolute',
    top: TV_CONSTANTS.MIN_TOUCH_TARGET + 8,
    right: 0,
    backgroundColor: '#333',
    padding: 8,
    borderRadius: 8,
    minWidth: 200,
  },
  voiceHelpText: {
    color: '#fff',
    fontSize: 14,
  },
  contentContainer: {
    flex: 1,
  },
  photoGrid: {
    padding: TV_CONSTANTS.GRID_SPACING,
  },
  photoItemContainer: {
    flex: 1,
    margin: TV_CONSTANTS.GRID_SPACING / 2,
  },
  photoItem: {
    backgroundColor: '#2a2a2a',
    borderRadius: TV_CONSTANTS.CARD_BORDER_RADIUS,
    overflow: 'hidden',
    position: 'relative',
  },
  photoItemFocused: {
    borderWidth: TV_CONSTANTS.FOCUS_BORDER_WIDTH,
    borderColor: '#3498db',
    shadowColor: '#3498db',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 8,
  },
  photoThumbnail: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#333',
  },
  videoIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 4,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  videoDuration: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  focusIndicator: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderWidth: 2,
    borderColor: '#3498db',
    borderRadius: TV_CONSTANTS.CARD_BORDER_RADIUS + 2,
    pointerEvents: 'none',
  },
  photoTitle: {
    color: '#fff',
    fontSize: 14,
    padding: 8,
    textAlign: 'center',
  },
  videoPlayerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlayer: {
    width: screenWidth,
    aspectRatio: TV_CONSTANTS.PREVIEW_ASPECT_RATIO,
  },
  qualityIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  qualityText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  voiceStatus: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  voiceStatusText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
  },
  statusBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#2a2a2a',
    paddingVertical: 8,
    paddingHorizontal: TV_CONSTANTS.GRID_SPACING,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#e74c3c',
  },
});

export default TVGalleryScreen;
