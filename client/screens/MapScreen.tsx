// AI-META-BEGIN
// AI-META: Screen for viewing photos on a map with clustering
// OWNERSHIP: client/screens
// ENTRYPOINTS: Accessed via MapTab in MainTabNavigator
// DEPENDENCIES: react-native-map-clustering, expo-image, Photos query
// DANGER: Large number of markers handled by clustering; ensure performance
// CHANGE-SAFETY: Safe to add; ensure location data is valid
// TESTS: Verify map loads, clusters form, markers preview photos
// AI-META-END

import React, { useMemo, useState } from "react";
import { StyleSheet, View, Platform, Text } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
import ClusteredMapView from "react-native-map-clustering";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Photo } from "@/types";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { Spacing, BorderRadius } from "@/constants/theme";
import { ThemedText } from "@/components/ThemedText";
import PhotoMarkerThumbnail from "@/components/PhotoMarkerThumbnail";
import PhotoPreviewSheet from "@/components/PhotoPreviewSheet";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface LocationData {
  latitude: number;
  longitude: number;
  city?: string;
}

export default function MapScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  const { data: photos = [] } = useQuery<Photo[]>({
    queryKey: ["photos"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/photos");
      const data = await res.json();
      return data.photos;
    },
  });

  const photosWithLocation = useMemo(() => {
    return photos.filter((p) => {
      const loc = p.location as LocationData | null;
      return (
        loc &&
        typeof loc.latitude === "number" &&
        typeof loc.longitude === "number"
      );
    });
  }, [photos]);

  const initialRegion = useMemo(() => {
    if (photosWithLocation.length > 0) {
      // Calculate bounds for all photos
      const lats = photosWithLocation.map(p => p.location!.latitude);
      const lngs = photosWithLocation.map(p => p.location!.longitude);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      const latitude = (minLat + maxLat) / 2;
      const longitude = (minLng + maxLng) / 2;
      const latitudeDelta = (maxLat - minLat) * 1.5; // Add padding
      const longitudeDelta = (maxLng - minLng) * 1.5;
      
      return {
        latitude,
        longitude,
        latitudeDelta: Math.max(latitudeDelta, 0.01), // Minimum zoom
        longitudeDelta: Math.max(longitudeDelta, 0.01), // Minimum zoom
      };
    }
    return {
      latitude: 37.78825,
      longitude: -122.4324,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    };
  }, [photosWithLocation]);

  const renderMarker = (photo: Photo) => {
    const loc = photo.location as LocationData;
    return (
      <Marker
        key={photo.id}
        coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
        title={loc.city || "Photo"}
        onPress={() => setSelectedPhoto(photo)}
      >
        <PhotoMarkerThumbnail
          uri={photo.uri}
          accessibilityLabel={`Photo at ${loc.city || "unknown location"}`}
          accessibilityHint="Tap to preview photo in map view"
        />
      </Marker>
    );
  };

  const renderCluster = (cluster: any, onPress: () => void) => {
    const pointCount = cluster.properties.point_count;
    const coordinates = cluster.geometry.coordinates;
    
    return (
      <Marker
        key={`cluster-${cluster.properties.cluster_id}`}
        coordinate={{
          latitude: coordinates[1],
          longitude: coordinates[0],
        }}
        onPress={onPress}
      >
        <View style={[styles.clusterContainer, { backgroundColor: theme.accent }]}>
          <Text style={[styles.clusterText, { color: theme.backgroundDefault }]}>
            {pointCount}
          </Text>
        </View>
      </Marker>
    );
  };

  if (Platform.OS === "web") {
    return (
      <View
        style={[
          styles.container,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <ThemedText>
          Map view is not fully supported on web without API keys.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ClusteredMapView
        style={styles.map}
        initialRegion={initialRegion}
        provider={
          Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT
        }
        clusterColor={theme.accent}
        radius={60}
        maxZoom={15}
        minZoom={1}
        minPoints={4}
        renderCluster={renderCluster}
        testID="clustered-map-view"
      >
        {photosWithLocation.map(renderMarker)}
      </ClusteredMapView>

      <PhotoPreviewSheet
        photo={selectedPhoto}
        visible={!!selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        onViewFull={(photo) => {
          const originalIndex = photos.findIndex(
            (p) => p.id === photo.id,
          );
          navigation.navigate("PhotoDetail", {
            photoId: photo.id,
            initialIndex: originalIndex !== -1 ? originalIndex : 0,
          });
        }}
      />

      <View style={[styles.header, { top: insets.top + Spacing.md }]}>
        <ThemedText type="h3" style={styles.headerTitle}>
          Places
        </ThemedText>
        <ThemedText type="small" style={styles.headerSubtitle}>
          {photosWithLocation.length} photos
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    width: "100%",
    height: "100%",
  },
  header: {
    position: "absolute",
    left: Spacing.lg,
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    color: "#000",
  },
  headerSubtitle: {
    color: "#666",
  },
  clusterContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  clusterText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
