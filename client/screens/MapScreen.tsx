// AI-META-BEGIN
// AI-META: Screen for viewing photos on a map
// OWNERSHIP: client/screens
// ENTRYPOINTS: Accessed via MapTab in MainTabNavigator
// DEPENDENCIES: react-native-maps, expo-image, Photos query
// DANGER: Large number of markers might affect performance (consider clustering later)
// CHANGE-SAFETY: Safe to add; ensure location data is valid
// TESTS: Verify map loads, markers appear, navigation to detail works
// AI-META-END

import React, { useMemo, useState, useEffect } from "react";
import { StyleSheet, View, Platform, Text } from "react-native";
import MapView, { Marker, Callout, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
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
import * as Location from 'expo-location';

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
    const [permissionResponse, requestPermission] = Location.useForegroundPermissions();

    const { data: photos = [] } = useQuery<Photo[]>({
        queryKey: ['photos'],
        queryFn: async () => {
            const res = await apiRequest('GET', '/api/photos');
            const data = await res.json();
            return data.photos;
        },
    });

    const photosWithLocation = useMemo(() => {
        return photos.filter(p => {
            const loc = p.location as LocationData | null;
            return loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number';
        });
    }, [photos]);

    const initialRegion = useMemo(() => {
        if (photosWithLocation.length > 0) {
            const loc = (photosWithLocation[0].location as LocationData);
            return {
                latitude: loc.latitude,
                longitude: loc.longitude,
                latitudeDelta: 10,
                longitudeDelta: 10,
            };
        }
        return {
            latitude: 37.78825,
            longitude: -122.4324,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
        };
    }, [photosWithLocation]);

    useEffect(() => {
        if (!permissionResponse) {
            requestPermission();
        }
    }, [permissionResponse, requestPermission]);

    if (Platform.OS === 'web') {
        return (
            <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }]}>
                <ThemedText>Map view is not fully supported on web without API keys.</ThemedText>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                initialRegion={initialRegion}
                showsUserLocation={!!permissionResponse?.granted}
                provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
            >
                {photosWithLocation.map((photo, index) => {
                    const loc = photo.location as LocationData;
                    return (
                        <Marker
                            key={photo.id}
                            coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                            title={loc.city || "Photo"}
                            onCalloutPress={() => {
                                // Find index in original photos array for proper paging
                                const originalIndex = photos.findIndex(p => p.id === photo.id);
                                navigation.navigate("PhotoDetail", { photoId: photo.id, initialIndex: originalIndex !== -1 ? originalIndex : 0 });
                            }}
                        >
                            <View style={styles.markerContainer}>
                                <Image
                                    source={{ uri: photo.uri }}
                                    style={styles.markerImage}
                                    contentFit="cover"
                                />
                            </View>
                            <Callout tooltip>
                                <View style={styles.calloutContainer}>
                                    <Image
                                        source={{ uri: photo.uri }}
                                        style={styles.calloutImage}
                                    />
                                    <Text style={styles.calloutText}>{loc.city || "View Photo"}</Text>
                                </View>
                            </Callout>
                        </Marker>
                    );
                })}
            </MapView>

            <View style={[styles.header, { top: insets.top + Spacing.md }]}>
                <ThemedText type="h3" style={styles.headerTitle}>Places</ThemedText>
                <ThemedText type="small" style={styles.headerSubtitle}>{photosWithLocation.length} photos</ThemedText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    map: {
        width: '100%',
        height: '100%',
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
    markerContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: "#fff",
        overflow: "hidden",
        backgroundColor: "#ccc",
    },
    markerImage: {
        width: "100%",
        height: "100%",
    },
    calloutContainer: {
        width: 150,
        backgroundColor: "#fff",
        borderRadius: BorderRadius.md,
        padding: Spacing.xs,
        alignItems: "center",
        shadowColor: "#000",
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
        fontSize: 12,
        fontWeight: "600",
        color: "#000",
    },
});
