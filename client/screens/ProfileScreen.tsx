// AI-META-BEGIN
// AI-META: User profile screen with stats, settings, and storage info
// OWNERSHIP: client/screens (profile/settings)
// ENTRYPOINTS: Accessed via ProfileTab in MainTabNavigator
// DEPENDENCIES: storage lib, StorageBar, SettingsRow components, haptics
// DANGER: Clear all data is destructive with no confirmation; haptics web incompatible
// CHANGE-SAFETY: Safe to modify UI; clear data logic is critical; test destructive actions
// TESTS: Test data loading, verify clear all data, check storage calculations, validate haptics
// AI-META-END

import React, { useState, useCallback } from "react";
import { StyleSheet, View, ScrollView, Image, Pressable, Platform } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StorageInfo } from "@/types";
import {
  getStorageInfo,
  getUserProfile,
  UserProfile,
  clearAllData,
} from "@/lib/storage";
import { StorageBar } from "@/components/StorageBar";
import { SettingsRow } from "@/components/SettingsRow";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

export default function ProfileScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [autoBackup, setAutoBackup] = useState(false);

  const loadData = useCallback(async () => {
    const [profileData, storage] = await Promise.all([
      getUserProfile(),
      getStorageInfo(),
    ]);
    setProfile(profileData);
    setStorageInfo(storage);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleClearData = async () => {
    // AI-NOTE: Destructive action with no confirmation; warning haptic indicates severity
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
    await clearAllData();
    loadData();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.xl,
        paddingBottom: tabBarHeight + Spacing.xl,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.profileHeader}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundDefault }]}>
          {profile?.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
          ) : (
            <Image
              source={require("../../assets/images/avatar-default.png")}
              style={styles.avatar}
            />
          )}
        </View>
        <ThemedText type="h2" style={styles.name}>
          {profile?.name || "Guest User"}
        </ThemedText>
        <ThemedText type="small" style={[styles.email, { color: theme.textSecondary }]}>
          {profile?.email || "guest@example.com"}
        </ThemedText>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="image" size={24} color={Colors.light.accent} />
          <ThemedText type="h3" style={styles.statValue}>
            {storageInfo?.photoCount || 0}
          </ThemedText>
          <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
            Photos
          </ThemedText>
        </View>
        <View style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}>
          <Feather name="folder" size={24} color={Colors.light.accent} />
          <ThemedText type="h3" style={styles.statValue}>
            {storageInfo?.albumCount || 0}
          </ThemedText>
          <ThemedText type="small" style={[styles.statLabel, { color: theme.textSecondary }]}>
            Albums
          </ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        {storageInfo ? (
          <StorageBar
            usedBytes={storageInfo.usedBytes}
            totalBytes={storageInfo.totalBytes}
          />
        ) : null}
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText
          type="small"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          BACKUP
        </ThemedText>
        <SettingsRow
          icon="upload-cloud"
          title="Auto Backup"
          subtitle="Automatically backup new photos"
          isSwitch
          switchValue={autoBackup}
          onSwitchChange={setAutoBackup}
          showChevron={false}
        />
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText
          type="small"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          PREFERENCES
        </ThemedText>
        <SettingsRow
          icon={isDark ? "moon" : "sun"}
          title="Appearance"
          subtitle={isDark ? "Dark mode" : "Light mode"}
          onPress={() => {}}
        />
        <SettingsRow
          icon="bell"
          title="Notifications"
          subtitle="Manage notification settings"
          onPress={() => {}}
        />
        <SettingsRow
          icon="lock"
          title="Privacy"
          subtitle="Control your data and privacy"
          onPress={() => {}}
        />
      </View>

      <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
        <ThemedText
          type="small"
          style={[styles.sectionTitle, { color: theme.textSecondary }]}
        >
          DATA
        </ThemedText>
        <SettingsRow
          icon="trash-2"
          title="Clear All Data"
          subtitle="Delete all photos and albums"
          onPress={handleClearData}
          isDestructive
        />
      </View>

      <View style={styles.footer}>
        <ThemedText type="small" style={[styles.version, { color: theme.textSecondary }]}>
          Photo Vault v1.0.0
        </ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeader: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  name: {
    marginBottom: Spacing.xs,
  },
  email: {
    opacity: 0.7,
  },
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.xl,
    borderRadius: BorderRadius.sm,
  },
  statValue: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    opacity: 0.7,
  },
  section: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
  },
  sectionTitle: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    fontWeight: "600",
  },
  footer: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
  },
  version: {
    opacity: 0.5,
  },
});
