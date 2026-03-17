import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { listen } from "@tauri-apps/api/event";
import { DesktopFileService } from "./file-service";

interface TrayEvent {
  action: string;
  data?: any;
}

interface SystemTrayControlsProps {
  onSync?: () => void;
  onSettings?: () => void;
  onMinimize?: () => void;
}

const SystemTrayControls: React.FC<SystemTrayControlsProps> = ({
  onSync,
  onSettings,
  onMinimize,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [lastTrayAction, setLastTrayAction] = useState<string>("");
  const fileService = DesktopFileService.getInstance();

  useEffect(() => {
    const setupTrayListeners = async () => {
      try {
        // Listen for tray events from Tauri
        const unlistenTriggers = await listen("trigger-sync", () => {
          setLastTrayAction("sync-triggered");
          onSync?.();
        });

        const unlistenNavigate = await listen("navigate-to", (event) => {
          const destination = event.payload as string;
          setLastTrayAction(`navigate-to-${destination}`);
          if (destination === "settings") {
            onSettings?.();
          }
        });

        const unlistenShortcuts = await listen("shortcut-save", () => {
          setLastTrayAction("shortcut-save");
        });

        const unlistenPreferences = await listen("shortcut-preferences", () => {
          setLastTrayAction("shortcut-preferences");
          onSettings?.();
        });

        const unlistenOpen = await listen("shortcut-open", () => {
          setLastTrayAction("shortcut-open");
        });

        return () => {
          unlistenTriggers();
          unlistenNavigate();
          unlistenShortcuts();
          unlistenPreferences();
          unlistenOpen();
        };
      } catch (error) {
        console.error("Failed to setup tray listeners:", error);
      }
    };

    const cleanup = setupTrayListeners();
    return cleanup;
  }, [onSync, onSettings]);

  const handleMinimizeToTray = async () => {
    try {
      await fileService.minimizeToTray();
      setIsMinimized(true);
      setLastTrayAction("minimize-to-tray");
    } catch (error) {
      console.error("Failed to minimize to tray:", error);
    }
  };

  const handleRestoreFromTray = async () => {
    try {
      await fileService.restoreFromTray();
      setIsMinimized(false);
      setLastTrayAction("restore-from-tray");
    } catch (error) {
      console.error("Failed to restore from tray:", error);
    }
  };

  const showTestNotification = async () => {
    await fileService.showNotification(
      "Test Notification",
      "This is a test notification from Cloud Gallery",
    );
    setLastTrayAction("test-notification");
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Tray Controls</Text>

        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[
              styles.button,
              isMinimized ? styles.restoreButton : styles.minimizeButton,
            ]}
            onPress={isMinimized ? handleRestoreFromTray : handleMinimizeToTray}
          >
            <Text style={styles.buttonText}>
              {isMinimized ? "Restore from Tray" : "Minimize to Tray"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <View style={styles.controlRow}>
          <TouchableOpacity style={styles.button} onPress={onSync}>
            <Text style={styles.buttonText}>Sync Photos</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={onSettings}>
            <Text style={styles.buttonText}>Settings</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.button} onPress={showTestNotification}>
          <Text style={styles.buttonText}>Test Notification</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Keyboard Shortcuts</Text>

        <View style={styles.shortcutList}>
          <View style={styles.shortcutItem}>
            <Text style={styles.shortcutKey}>Ctrl+S</Text>
            <Text style={styles.shortcutDesc}>Save current state</Text>
          </View>

          <View style={styles.shortcutItem}>
            <Text style={styles.shortcutKey}>Ctrl+,</Text>
            <Text style={styles.shortcutDesc}>Open preferences</Text>
          </View>

          <View style={styles.shortcutItem}>
            <Text style={styles.shortcutKey}>Ctrl+O</Text>
            <Text style={styles.shortcutDesc}>Open files</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Log</Text>

        {lastTrayAction ? (
          <View style={styles.activityItem}>
            <Text style={styles.activityText}>
              Last action: {lastTrayAction}
            </Text>
            <Text style={styles.activityTime}>
              {new Date().toLocaleTimeString()}
            </Text>
          </View>
        ) : (
          <Text style={styles.noActivity}>No recent activity</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>System Tray Features</Text>

        <View style={styles.featureList}>
          <Text style={styles.featureItem}>• Background operation</Text>
          <Text style={styles.featureItem}>• Quick access to sync</Text>
          <Text style={styles.featureItem}>• Global keyboard shortcuts</Text>
          <Text style={styles.featureItem}>• File drag & drop support</Text>
          <Text style={styles.featureItem}>• System notifications</Text>
          <Text style={styles.featureItem}>• Settings access</Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  section: {
    backgroundColor: "#fff",
    margin: 15,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  controlRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  button: {
    flex: 1,
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 6,
    alignItems: "center",
  },
  minimizeButton: {
    backgroundColor: "#8E8E93",
  },
  restoreButton: {
    backgroundColor: "#34C759",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  shortcutList: {
    gap: 8,
  },
  shortcutItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    backgroundColor: "#f8f9fa",
    borderRadius: 6,
  },
  shortcutKey: {
    fontSize: 12,
    fontWeight: "600",
    color: "#007AFF",
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 12,
    minWidth: 50,
    textAlign: "center",
  },
  shortcutDesc: {
    fontSize: 14,
    color: "#333",
  },
  activityItem: {
    backgroundColor: "#f8f9fa",
    padding: 10,
    borderRadius: 6,
  },
  activityText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  activityTime: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  noActivity: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
    padding: 20,
  },
  featureList: {
    gap: 6,
  },
  featureItem: {
    fontSize: 14,
    color: "#333",
    paddingVertical: 2,
  },
});

export default SystemTrayControls;
