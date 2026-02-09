// AI-META-BEGIN
// AI-META: Modal component for editing photo metadata (tags, notes)
// OWNERSHIP: client/components
// ENTRYPOINTS: PhotoDetailScreen
// DEPENDENCIES: React, ReactNative, Theme, Icons
// DANGER: Modifies photo metadata; verify saving logic
// CHANGE-SAFETY: Safe to modify UI; logic depends on parent props
// TESTS: Manual test opening, editing, saving, cancelling
// AI-META-END

import React, { useState, useEffect } from "react";
import {
    Modal,
    StyleSheet,
    View,
    TextInput,
    Pressable,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface PhotoMetadataEditorProps {
    visible: boolean;
    onClose: () => void;
    onSave: (tags: string[], notes: string) => void;
    initialTags: string[];
    initialNotes: string | null;
}

export function PhotoMetadataEditor({
    visible,
    onClose,
    onSave,
    initialTags,
    initialNotes,
}: PhotoMetadataEditorProps) {
    const { theme, isDark } = useTheme();
    const [tags, setTags] = useState(initialTags.join(", "));
    const [notes, setNotes] = useState(initialNotes || "");

    // AI-NOTE: Reset state when modal opens to ensure fresh data
    useEffect(() => {
        if (visible) {
            setTags(initialTags.join(", "));
            setNotes(initialNotes || "");
        }
    }, [visible, initialTags, initialNotes]);

    const handleSave = () => {
        // Split tags by comma, trim whitespace, remove empty strings
        const tagArray = tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t.length > 0);
        onSave(tagArray, notes);
        onClose();
    };

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={styles.centeredView}>
                {/* Backdrop - Blur effect for premium feel */}
                <Pressable style={styles.backdrop} onPress={onClose}>
                    <BlurView
                        intensity={20}
                        tint={isDark ? "dark" : "light"}
                        style={StyleSheet.absoluteFill}
                    />
                </Pressable>

                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={styles.keyboardView}
                >
                    <ThemedView
                        style={[
                            styles.modalView,
                            {
                                backgroundColor: theme.backgroundSecondary,
                                borderColor: theme.border,
                                shadowColor: theme.text,
                            },
                        ]}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <ThemedText type="h3">Edit Info</ThemedText>
                            <Pressable onPress={onClose} hitSlop={8}>
                                <Feather name="x" size={24} color={theme.textSecondary} />
                            </Pressable>
                        </View>

                        <ScrollView contentContainerStyle={styles.content}>
                            {/* Tags Input */}
                            <View style={styles.inputGroup}>
                                <ThemedText type="body" style={styles.label}>
                                    Tags
                                </ThemedText>
                                <ThemedText type="small" style={{ color: theme.textSecondary, marginBottom: Spacing.sm }}>
                                    Comma separated (e.g. vacation, beach, family)
                                </ThemedText>
                                <TextInput
                                    style={[
                                        styles.input,
                                        {
                                            backgroundColor: theme.backgroundDefault,
                                            color: theme.text,
                                            borderColor: theme.border,
                                        },
                                    ]}
                                    value={tags}
                                    onChangeText={setTags}
                                    placeholder="Add tags..."
                                    placeholderTextColor={theme.textSecondary}
                                />
                            </View>

                            {/* Notes Input */}
                            <View style={styles.inputGroup}>
                                <ThemedText type="body" style={styles.label}>
                                    Notes
                                </ThemedText>
                                <TextInput
                                    style={[
                                        styles.input,
                                        styles.textArea,
                                        {
                                            backgroundColor: theme.backgroundDefault,
                                            color: theme.text,
                                            borderColor: theme.border,
                                        },
                                    ]}
                                    value={notes}
                                    onChangeText={setNotes}
                                    placeholder="Add notes..."
                                    placeholderTextColor={theme.textSecondary}
                                    multiline
                                    textAlignVertical="top"
                                />
                            </View>
                        </ScrollView>

                        {/* Footer Buttons */}
                        <View style={styles.footer}>
                            <Pressable
                                style={[styles.button, { backgroundColor: theme.backgroundTertiary }]}
                                onPress={onClose}
                            >
                                <ThemedText type="body" style={{ fontWeight: "600" }}>Cancel</ThemedText>
                            </Pressable>

                            <Pressable
                                style={[styles.button, { backgroundColor: theme.accent }]}
                                onPress={handleSave}
                            >
                                <ThemedText type="body" style={{ color: "#FFF", fontWeight: "600" }}>
                                    Save
                                </ThemedText>
                            </Pressable>
                        </View>
                    </ThemedView>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: "flex-end", // Bottom sheet style
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.4)",
    },
    keyboardView: {
        width: "100%",
    },
    modalView: {
        borderTopLeftRadius: BorderRadius.xl,
        borderTopRightRadius: BorderRadius.xl,
        padding: Spacing.xl,
        paddingBottom: Spacing["4xl"], // Extra padding for safe area
        width: "100%",
        maxHeight: "80%", // Don't take full screen
        borderWidth: 1,
        borderBottomWidth: 0,
        elevation: 5,
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: Spacing.lg,
    },
    content: {
        paddingBottom: Spacing.lg,
    },
    inputGroup: {
        marginBottom: Spacing.lg,
    },
    label: {
        marginBottom: Spacing.sm,
        fontWeight: "600",
    },
    input: {
        borderRadius: BorderRadius.md,
        borderWidth: 1,
        padding: Spacing.md,
        fontSize: 16,
    },
    textArea: {
        height: 120,
    },
    footer: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: Spacing.md,
        marginTop: Spacing.md,
    },
    button: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.xl,
        borderRadius: BorderRadius.full,
        minWidth: 100,
        alignItems: "center",
    },
});
