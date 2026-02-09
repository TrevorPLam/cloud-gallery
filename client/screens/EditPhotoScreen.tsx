// AI-META-BEGIN
// AI-META: Screen for editing photos (rotate, flip)
// OWNERSHIP: client/screens
// ENTRYPOINTS: Navigated from PhotoDetailScreen
// DEPENDENCIES: expo-image-manipulator, expo-image, react-native-reanimated
// DANGER: Overwrites original photo file on save (by uploading new one); high memory usage for large images
// CHANGE-SAFETY: Safe to add features; verify save logic
// TESTS: Manual test rotate, flip, save
// AI-META-END

import React, { useState } from "react";
import { StyleSheet, View, Dimensions, ActivityIndicator, Alert, Pressable } from "react-native";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import * as ImageManipulator from "expo-image-manipulator";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";
import { Photo } from "@/types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

type EditPhotoRouteProps = RouteProp<RootStackParamList, "EditPhoto">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function EditPhotoScreen() {
    const route = useRoute<EditPhotoRouteProps>();
    const navigation = useNavigation<NavigationProp>();
    const insets = useSafeAreaInsets();
    const { theme } = useTheme();
    const queryClient = useQueryClient();

    const { photoId, initialUri } = route.params;
    const [currentUri, setCurrentUri] = useState(initialUri);
    const [isSaving, setIsSaving] = useState(false);
    const [history, setHistory] = useState<string[]>([initialUri]);
    const [historyIndex, setHistoryIndex] = useState(0);

    // Helper to update URI and history
    const updateImage = (newUri: string) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newUri);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setCurrentUri(newUri);
    };

    const handleRotate = async () => {
        try {
            const result = await ImageManipulator.manipulateAsync(
                currentUri,
                [{ rotate: 90 }],
                { format: ImageManipulator.SaveFormat.JPEG }
            );
            updateImage(result.uri);
        } catch (error) {
            console.error("Rotate error:", error);
            Alert.alert("Error", "Failed to rotate image");
        }
    };

    const handleFlipHorizontal = async () => {
        try {
            const result = await ImageManipulator.manipulateAsync(
                currentUri,
                [{ flip: ImageManipulator.FlipType.Horizontal }],
                { format: ImageManipulator.SaveFormat.JPEG }
            );
            updateImage(result.uri);
        } catch (error) {
            console.error("Flip error:", error);
            Alert.alert("Error", "Failed to flip image");
        }
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            setHistoryIndex(historyIndex - 1);
            setCurrentUri(history[historyIndex - 1]);
        }
    };

    const saveMutation = useMutation({
        mutationFn: async (finalUri: string) => {
            // 1. Upload new image
            const formData = new FormData();
            // FileSystem fetch to get blob/file? 
            // React Native FormData accepts { uri, name, type }
            formData.append("file", {
                uri: finalUri,
                name: "edited_photo.jpg",
                type: "image/jpeg",
            } as any);

            const uploadRes = await apiRequest("POST", "/api/upload/single", formData);
            const uploadData = await uploadRes.json();
            const newServerUri = uploadData.file.uri;

            // 2. Update photo record
            const updateRes = await apiRequest("PUT", `/api/photos/${photoId}`, {
                uri: newServerUri,
            });
            return updateRes.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["photos"] });
            navigation.goBack();
        },
        onError: (error) => {
            console.error("Save error:", error);
            Alert.alert("Error", "Failed to save changes");
            setIsSaving(false);
        },
    });

    const handleSave = () => {
        setIsSaving(true);
        saveMutation.mutate(currentUri);
    };

    return (
        <ThemedView style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <ThemedText type="body" style={{ color: theme.textSecondary }}>Cancel</ThemedText>
                </Pressable>
                <ThemedText type="h4">Edit Photo</ThemedText>
                <Pressable onPress={handleSave} disabled={isSaving} style={styles.headerButton}>
                    {isSaving ? (
                        <ActivityIndicator size="small" color={theme.accent} />
                    ) : (
                        <ThemedText type="body" style={{ color: theme.accent, fontWeight: "600" }}>Save</ThemedText>
                    )}
                </Pressable>
            </View>

            {/* Image Preview */}
            <View style={styles.previewContainer}>
                <Image
                    source={{ uri: currentUri }}
                    style={styles.previewImage}
                    contentFit="contain"
                    cachePolicy="none" // Ensure we see updates
                />
            </View>

            {/* Toolbar */}
            <View style={[styles.toolbar, { paddingBottom: insets.bottom + Spacing.lg }]}>
                <Pressable onPress={handleRotate} style={styles.toolButton}>
                    <Feather name="rotate-cw" size={24} color={theme.text} />
                    <ThemedText type="small" style={{ marginTop: 4 }}>Rotate</ThemedText>
                </Pressable>

                <Pressable onPress={handleFlipHorizontal} style={styles.toolButton}>
                    <Feather name="columns" size={24} color={theme.text} />
                    {/* Using columns icon as proxy for flip/mirror if not available, or replace with better icon */}
                    <ThemedText type="small" style={{ marginTop: 4 }}>Flip</ThemedText>
                </Pressable>

                <Pressable onPress={handleUndo} disabled={historyIndex === 0} style={[styles.toolButton, { opacity: historyIndex === 0 ? 0.3 : 1 }]}>
                    <Feather name="rotate-ccw" size={24} color={theme.text} />
                    <ThemedText type="small" style={{ marginTop: 4 }}>Undo</ThemedText>
                </Pressable>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(0,0,0,0.1)",
    },
    headerButton: {
        padding: Spacing.sm,
        minWidth: 60,
        alignItems: "center",
    },
    previewContainer: {
        flex: 1,
        backgroundColor: "#000",
        justifyContent: "center",
        alignItems: "center",
    },
    previewImage: {
        width: "100%",
        height: "100%",
    },
    toolbar: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingTop: Spacing.lg,
        backgroundColor: "transparent", // Or theme background
    },
    toolButton: {
        alignItems: "center",
        justifyContent: "center",
        padding: Spacing.sm,
    },
});
