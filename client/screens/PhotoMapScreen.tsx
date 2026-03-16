// AI-META-BEGIN
// AI-META: Interactive photo map screen with clustering, heatmap, and temporal layers
// OWNERSHIP: client/screens
// ENTRYPOINTS: Accessed via MapTab in MainTabNavigator
// DEPENDENCIES: react-native-maps, clustering, heatmap, temporal services
// DANGER: Performance issues with large datasets; implement proper optimization
// CHANGE-SAFETY: Safe to modify UI layout and interaction patterns
// TESTS: Component tests for user interactions, accessibility tests
// AI-META-END

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, {
  Marker,
  Callout,
  Circle,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
  Region,
  Marker as MapMarker,
} from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedGestureHandler,
  withSpring,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { apiRequest } from '@/lib/query-client';
import { Photo } from '@/types';
import { RootStackParamList } from '@/navigation/RootStackNavigator';
import { Spacing, BorderRadius, Typography } from '@/constants/theme';
import { ThemedText } from '@/components/ThemedText';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';

// Import map services
import {
  PhotoClusteringService,
  photoClusteringService,
  isCluster,
  getClusterSizeText,
  getClusterPhotos,
  type ClusterPoint,
} from '@/lib/map/photo-clustering';
import {
  HeatmapRenderer,
  heatmapRenderer,
  calculateOptimalRadius,
  createDensityBasedGradient,
  type HeatmapPoint,
  type HeatmapRegion,
} from '@/lib/map/heatmap-renderer';
import {
  useTemporalLayers,
  TimeUtils,
  createTimelineMarkers,
  getTemporalStatistics,
  type TemporalLayer,
  type TimelineConfig,
} from '@/lib/map/temporal-layers';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MapMode {
  type: 'markers' | 'clusters' | 'heatmap' | 'temporal';
  label: string;
}

interface ViewState {
  region: Region;
  zoom: number;
  isMoving: boolean;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/**
 * Interactive Photo Map Screen
 * 
 * Features:
 * - Photo clustering with SuperCluster
 * - Heatmap visualization for photo density
 * - Temporal layers with timeline scrubbing
 * - Smooth gesture controls and animations
 * - Accessibility-first design
 */
export default function PhotoMapScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  // Map state
  const [currentMode, setCurrentMode] = useState<MapMode['type']>('clusters');
  const [viewState, setViewState] = useState<ViewState>({
    region: {
      latitude: 37.78825,
      longitude: -122.4324,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    },
    zoom: 12,
    isMoving: false,
  });

  // Animation values
  const gestureY = useSharedValue(0);
  const gestureState = useSharedValue(State.UNDETERMINED);
  const panelHeight = useSharedValue(screenHeight * 0.3);

  // Services
  const clusteringService = useRef<PhotoClusteringService>(photoClusteringService);
  const heatmapService = useRef<HeatmapRenderer>(heatmapRenderer);

  // Data fetching
  const { data: photos = [], isLoading, error } = useQuery<Photo[]>({
    queryKey: ['photos'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/photos');
      const data = await res.json();
      return data.photos;
    },
  });

  // Temporal layers hook
  const {
    service: temporalService,
    progressValue,
    isPlayingValue,
    speedValue,
    currentTime,
    visiblePhotos,
    animatedProgressStyle,
    play,
    pause,
    seekTo,
    seekToTime,
    setSpeed,
  } = useTemporalLayers(photos, {
    bucketSize: 'week',
    animationDuration: 300,
    paddingDays: 7,
  });

  // Filter photos with valid locations
  const photosWithLocation = useMemo(() => {
    return photos.filter(photo => 
      photo.location &&
      typeof photo.location.latitude === 'number' &&
      typeof photo.location.longitude === 'number' &&
      photo.location.latitude >= -90 &&
      photo.location.latitude <= 90 &&
      photo.location.longitude >= -180 &&
      photo.location.longitude <= 180
    );
  }, [photos]);

  // Initialize services when photos change
  useEffect(() => {
    if (photosWithLocation.length > 0) {
      clusteringService.current.loadPhotos(photosWithLocation);
      heatmapService.current.processPhotos(photosWithLocation);
    }
  }, [photosWithLocation]);

  // Map modes configuration
  const mapModes: MapMode[] = [
    { type: 'markers', label: 'Markers' },
    { type: 'clusters', label: 'Clusters' },
    { type: 'heatmap', label: 'Heatmap' },
    { type: 'temporal', label: 'Timeline' },
  ];

  // Calculate optimal clustering radius based on zoom
  const clusteringRadius = useMemo(() => {
    return calculateOptimalRadius(viewState.zoom, 60);
  }, [viewState.zoom]);

  // Get clusters for current viewport
  const clusters = useMemo(() => {
    if (currentMode !== 'clusters' || photosWithLocation.length === 0) return [];

    const bounds = {
      northeast: {
        latitude: viewState.region.latitude + viewState.region.latitudeDelta / 2,
        longitude: viewState.region.longitude + viewState.region.longitudeDelta / 2,
      },
      southwest: {
        latitude: viewState.region.latitude - viewState.region.latitudeDelta / 2,
        longitude: viewState.region.longitude - viewState.region.longitudeDelta / 2,
      },
    };

    clusteringService.current.updateOptions({ radius: clusteringRadius });
    return clusteringService.current.getClusters(bounds, viewState.zoom);
  }, [currentMode, viewState, photosWithLocation, clusteringRadius]);

  // Get heatmap data for current viewport
  const heatmapData = useMemo(() => {
    if (currentMode !== 'heatmap' || photosWithLocation.length === 0) return [];

    const region: HeatmapRegion = {
      longitude: viewState.region.longitude,
      latitude: viewState.region.latitude,
      longitudeDelta: viewState.region.longitudeDelta,
      latitudeDelta: viewState.region.latitudeDelta,
    };

    return heatmapService.current.generateHeatmapData(photosWithLocation, region);
  }, [currentMode, viewState, photosWithLocation]);

  // Get temporal photos for current time
  const temporalPhotos = useMemo(() => {
    if (currentMode !== 'temporal') return [];
    return visiblePhotos.value || [];
  }, [currentMode, visiblePhotos]);

  // Gesture handler for panel
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, context) => {
      context.startY = gestureY.value;
      gestureState.value = State.ACTIVE;
    },
    onActive: (event, context) => {
      gestureY.value = context.startY + event.translationY;
      
      // Limit panel movement
      const maxHeight = screenHeight * 0.7;
      const minHeight = screenHeight * 0.1;
      gestureY.value = Math.max(-maxHeight, Math.min(minHeight, gestureY.value));
    },
    onEnd: () => {
      gestureState.value = State.END;
      
      // Snap to nearest position
      const snapPoints = [
        0, // Closed
        -screenHeight * 0.3, // Half open
        -screenHeight * 0.6, // Fully open
      ];
      
      const closestSnap = snapPoints.reduce((prev, curr) => 
        Math.abs(curr - gestureY.value) < Math.abs(prev - gestureY.value) ? curr : prev
      );
      
      gestureY.value = withSpring(closestSnap, {
        damping: 20,
        stiffness: 300,
      });
    },
  });

  // Panel animated style
  const panelStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: gestureY.value }],
      height: interpolate(
        gestureY.value,
        [0, -screenHeight * 0.3, -screenHeight * 0.6],
        [screenHeight * 0.1, screenHeight * 0.4, screenHeight * 0.7],
        Extrapolation.CLAMP
      ),
    };
  });

  // Handle map region change
  const handleRegionChange = useCallback((region: Region) => {
    setViewState(prev => ({
      ...prev,
      region,
      zoom: Math.log2(360 / region.longitudeDelta),
    }));
  }, []);

  // Handle marker press
  const handleMarkerPress = useCallback((photo: Photo) => {
    const originalIndex = photos.findIndex(p => p.id === photo.id);
    navigation.navigate('PhotoDetail', {
      photoId: photo.id,
      initialIndex: originalIndex !== -1 ? originalIndex : 0,
    });
  }, [navigation, photos]);

  // Handle cluster press
  const handleClusterPress = useCallback((cluster: ClusterPoint) => {
    if (!isCluster(cluster)) return;

    const expansionZoom = clusteringService.current.getClusterExpansionZoom(
      cluster.properties.cluster_id!
    );

    setViewState(prev => ({
      ...prev,
      region: {
        latitude: cluster.geometry.coordinates[1],
        longitude: cluster.geometry.coordinates[0],
        latitudeDelta: 360 / Math.pow(2, expansionZoom),
        longitudeDelta: 360 / Math.pow(2, expansionZoom),
      },
      zoom: expansionZoom,
    }));
  }, []);

  // Render individual marker
  const renderMarker = useCallback((photo: Photo) => (
    <Marker
      key={photo.id}
      coordinate={{
        latitude: photo.location!.latitude,
        longitude: photo.location!.longitude,
      }}
      title={photo.location?.city || 'Photo'}
      onPress={() => handleMarkerPress(photo)}
    >
      <View style={[styles.markerContainer, { borderColor: theme.colors.background }]}>
        <Image
          source={{ uri: photo.uri }}
          style={styles.markerImage}
          contentFit="cover"
        />
      </View>
      <Callout tooltip>
        <View style={[styles.calloutContainer, { backgroundColor: theme.colors.background }]}>
          <Image
            source={{ uri: photo.uri }}
            style={styles.calloutImage}
          />
          <ThemedText style={styles.calloutText}>
            {photo.location?.city || 'View Photo'}
          </ThemedText>
        </View>
      </Callout>
    </Marker>
  ), [theme.colors.background, handleMarkerPress]);

  // Render cluster marker
  const renderCluster = useCallback((cluster: ClusterPoint) => (
    <Marker
      key={cluster.properties.cluster_id}
      coordinate={{
        latitude: cluster.geometry.coordinates[1],
        longitude: cluster.geometry.coordinates[0],
      }}
      onPress={() => handleClusterPress(cluster)}
    >
      <View style={[styles.clusterContainer, { backgroundColor: theme.colors.primary }]}>
        <ThemedText style={styles.clusterText}>
          {getClusterSizeText(cluster)}
        </ThemedText>
      </View>
      <Callout tooltip>
        <View style={[styles.calloutContainer, { backgroundColor: theme.colors.background }]}>
          <ThemedText style={styles.calloutText}>
            {getClusterSizeText(cluster)} photos
          </ThemedText>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => handleClusterPress(cluster)}
          >
            Zoom to cluster
          </Button>
        </View>
      </Callout>
    </Marker>
  ), [theme.colors.primary, theme.colors.background, handleClusterPress]);

  // Render temporal marker
  const renderTemporalMarker = useCallback((photo: Photo) => (
    <Marker
      key={`temporal-${photo.id}`}
      coordinate={{
        latitude: photo.location!.latitude,
        longitude: photo.location!.longitude,
      }}
      title={TimeUtils.formatTimestamp(photo.createdAt)}
      onPress={() => handleMarkerPress(photo)}
    >
      <View style={[styles.temporalMarkerContainer, { borderColor: theme.colors.accent }]}>
        <Image
          source={{ uri: photo.uri }}
          style={styles.temporalMarkerImage}
          contentFit="cover"
        />
        <View style={[styles.temporalIndicator, { backgroundColor: theme.colors.accent }]} />
      </View>
    </Marker>
  ), [theme.colors.accent, handleMarkerPress]);

  // Render mode selector
  const renderModeSelector = () => (
    <View style={[styles.modeSelector, { backgroundColor: theme.colors.background }]}>
      {mapModes.map((mode) => (
        <TouchableOpacity
          key={mode.type}
          style={[
            styles.modeButton,
            currentMode === mode.type && {
              backgroundColor: theme.colors.primary,
            },
          ]}
          onPress={() => setCurrentMode(mode.type)}
          accessibilityRole="button"
          accessibilityLabel={`Switch to ${mode.label} view`}
          accessibilityState={{ selected: currentMode === mode.type }}
        >
          <ThemedText
            style={[
              styles.modeButtonText,
              currentMode === mode.type && {
                color: theme.colors.background,
              },
            ]}
          >
            {mode.label}
          </ThemedText>
        </TouchableOpacity>
      ))}
    </View>
  );

  // render timeline controls
  const renderTimelineControls = () => {
    if (currentMode !== 'temporal') return null;

    const timeRange = temporalService.getOverallTimeRange();
    const stats = getTemporalStatistics(temporalService.getLayers());

    return (
      <View style={[styles.timelineControls, { backgroundColor: theme.colors.background }]}>
        <View style={styles.timelineHeader}>
          <ThemedText type="h4">Timeline</ThemedText>
          <ThemedText type="small">
            {stats.totalPhotos} photos over {Math.round(stats.timeSpan)} days
          </ThemedText>
        </View>

        <View style={styles.timelineInfo}>
          <ThemedText type="small">
            {TimeUtils.formatTimestamp(currentTime.value || Date.now(), 'medium')}
          </ThemedText>
          <ThemedText type="small">
            {temporalPhotos.length} photos visible
          </ThemedText>
        </View>

        <View style={styles.timelineButtons}>
          <Button
            variant="ghost"
            size="sm"
            onPress={isPlayingValue.value ? pause : play}
            accessibilityLabel={isPlayingValue.value ? 'Pause timeline' : 'Play timeline'}
          >
            <Icon name={isPlayingValue.value ? 'pause' : 'play'} size={16} />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onPress={() => seekTo(0)}
            accessibilityLabel="Go to start"
          >
            <Icon name="skip-back" size={16} />
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onPress={() => seekTo(1)}
            accessibilityLabel="Go to end"
          >
            <Icon name="skip-forward" size={16} />
          </Button>
        </View>
      </View>
    );
  };

  // Render stats panel
  const renderStatsPanel = () => {
    const clusteringStats = clusteringService.current.getStats();
    const heatmapStats = heatmapService.current.getStats();

    return (
      <View style={[styles.statsPanel, { backgroundColor: theme.colors.background }]}>
        <ThemedText type="h4" style={styles.statsTitle}>
          Map Statistics
        </ThemedText>
        
        <View style={styles.statsRow}>
          <ThemedText type="small">Total Photos:</ThemedText>
          <ThemedText type="small">{photosWithLocation.length}</ThemedText>
        </View>

        {currentMode === 'clusters' && (
          <>
            <View style={styles.statsRow}>
              <ThemedText type="small">Clusters:</ThemedText>
              <ThemedText type="small">{clusteringStats.clusterCount}</ThemedText>
            </View>
            <View style={styles.statsRow}>
              <ThemedText type="small">Avg Points/Cluster:</ThemedText>
              <ThemedText type="small">{clusteringStats.averagePointsPerCluster.toFixed(1)}</ThemedText>
            </View>
          </>
        )}

        {currentMode === 'heatmap' && heatmapStats && (
          <>
            <View style={styles.statsRow}>
              <ThemedText type="small">Max Intensity:</ThemedText>
              <ThemedText type="small">{heatmapStats.maxIntensity.toFixed(1)}</ThemedText>
            </View>
            <View style={styles.statsRow}>
              <ThemedText type="small">Density:</ThemedText>
              <ThemedText type="small">{heatmapStats.density.toFixed(2)}/km²</ThemedText>
            </View>
          </>
        )}

        {currentMode === 'temporal' && (
          <>
            <View style={styles.statsRow}>
              <ThemedText type="small">Time Layers:</ThemedText>
              <ThemedText type="small">{temporalService.getLayers().length}</ThemedText>
            </View>
            <View style={styles.statsRow}>
              <ThemedText type="small">Visible Photos:</ThemedText>
              <ThemedText type="small">{temporalPhotos.length}</ThemedText>
            </View>
          </>
        )}
      </View>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ThemedText>Loading photos...</ThemedText>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <ThemedText>Error loading photos</ThemedText>
        <Button onPress={() => window.location.reload()}>
          Retry
        </Button>
      </View>
    );
  }

  // Web platform fallback
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, styles.webFallback]}>
        <ThemedText>
          Map view is not fully supported on web without API keys.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Map View */}
      <MapView
        style={styles.map}
        initialRegion={viewState.region}
        onRegionChangeComplete={handleRegionChange}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        showsUserLocation
        showsMyLocationButton
      >
        {/* Render based on current mode */}
        {currentMode === 'markers' && photosWithLocation.map(renderMarker)}
        {currentMode === 'clusters' && clusters.map(renderCluster)}
        {currentMode === 'temporal' && temporalPhotos.map(renderTemporalMarker)}

        {/* Heatmap overlay */}
        {currentMode === 'heatmap' && heatmapData.length > 0 && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
            }}
          >
            {/* Heatmap component would be rendered here */}
            {/* Note: @cawfree/react-native-heat-map doesn't work directly as overlay */}
            {/* This is a placeholder for the heatmap implementation */}
          </View>
        )}
      </MapView>

      {/* Mode Selector */}
      <View style={[styles.modeSelectorContainer, { top: insets.top + Spacing.md }]}>
        {renderModeSelector()}
      </View>

      {/* Timeline Controls */}
      {renderTimelineControls()}

      {/* Gesture Handler for Bottom Panel */}
      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[styles.bottomPanel, panelStyle]}>
          {/* Stats Panel */}
          {renderStatsPanel()}
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  webFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  map: {
    flex: 1,
  },
  modeSelectorContainer: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  modeButton: {
    flex: 1,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  modeButtonText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  markerContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#ccc',
  },
  markerImage: {
    width: '100%',
    height: '100%',
  },
  clusterContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  clusterText: {
    color: '#fff',
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.bold,
  },
  temporalMarkerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    overflow: 'hidden',
    backgroundColor: '#ccc',
    position: 'relative',
  },
  temporalMarkerImage: {
    width: '100%',
    height: '100%',
  },
  temporalIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  calloutContainer: {
    width: 150,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  calloutImage: {
    width: 140,
    height: 100,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  calloutText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
    textAlign: 'center',
  },
  timelineControls: {
    position: 'absolute',
    top: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  timelineInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  timelineButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  statsPanel: {
    padding: Spacing.lg,
  },
  statsTitle: {
    marginBottom: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
});
