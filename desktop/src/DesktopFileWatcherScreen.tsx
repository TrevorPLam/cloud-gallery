import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useDesktopFileWatcher } from "./use-file-watcher";
import { DesktopFileService } from "./file-service";

interface FileEvent {
  path: string;
  event_type: string;
  timestamp: number;
}

const DesktopFileWatcherScreen: React.FC = () => {
  const [watchPath, setWatchPath] = useState<string>("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const {
    isInitialized,
    isWatching,
    fileEvents,
    error,
    supportedExtensions,
    startWatching,
    stopWatching,
    clearEvents,
    getEventStats,
    isSupportedFile,
  } = useDesktopFileWatcher(watchPath);

  useEffect(() => {
    // Auto-detect common photo directories
    const detectPhotoDirectory = async () => {
      const fileService = DesktopFileService.getInstance();
      await fileService.initialize();

      // This would use Tauri APIs to detect common photo directories
      // For now, use a placeholder
      const commonPaths = [
        "/Users/[username]/Pictures", // macOS
        "C:\\Users\\[username]\\Pictures", // Windows
        "/home/[username]/Pictures", // Linux
      ];
      setWatchPath(commonPaths[0]); // Placeholder
    };

    detectPhotoDirectory();
  }, []);

  const handleSelectDirectory = async () => {
    const fileService = DesktopFileService.getInstance();
    try {
      const paths = await fileService.showOpenDialog({
        directory: true,
        multiple: false,
      });

      if (paths.length > 0) {
        setWatchPath(paths[0]);
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
    }
  };

  const handleToggleWatching = () => {
    if (isWatching && watchPath) {
      stopWatching(watchPath);
    } else if (watchPath) {
      startWatching(watchPath);
    }
  };

  const renderFileEvent = ({ item }: { item: FileEvent }) => {
    const fileName = item.path.split(/[\\/]/).pop() || "";
    const timestamp = new Date(item.timestamp * 1000).toLocaleTimeString();

    return (
      <View style={styles.eventItem}>
        <Text style={[styles.eventType, styles[item.event_type]]}>
          {item.event_type.toUpperCase()}
        </Text>
        <View style={styles.eventDetails}>
          <Text style={styles.eventPath} numberOfLines={2}>
            {fileName}
          </Text>
          <Text style={styles.eventTimestamp}>{timestamp}</Text>
        </View>
      </View>
    );
  };

  const renderExtensionBadge = (extension: string) => (
    <View key={extension} style={styles.extensionBadge}>
      <Text style={styles.extensionText}>{extension}</Text>
    </View>
  );

  const stats = getEventStats();

  if (!isInitialized) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>
            Initializing desktop file service...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Desktop File Sync</Text>
        <Text style={styles.subtitle}>
          Monitor folders for automatic photo sync
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Watch Directory</Text>
        <TouchableOpacity
          style={styles.directorySelector}
          onPress={handleSelectDirectory}
        >
          <Text style={styles.directoryPath}>
            {watchPath || "Select a directory to watch..."}
          </Text>
          <Text style={styles.browseButton}>Browse</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Supported Formats ({supportedExtensions.length})
        </Text>
        <View style={styles.extensionContainer}>
          {supportedExtensions.slice(0, 12).map(renderExtensionBadge)}
          {supportedExtensions.length > 12 && (
            <Text style={styles.moreExtensionsText}>
              +{supportedExtensions.length - 12} more
            </Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              isWatching ? styles.stopButton : styles.startButton,
            ]}
            onPress={handleToggleWatching}
            disabled={!watchPath}
          >
            <Text style={styles.toggleButtonText}>
              {isWatching ? "Stop Watching" : "Start Watching"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.clearButton} onPress={clearEvents}>
            <Text style={styles.clearButtonText}>Clear Events</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistics</Text>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Events</Text>
          </View>
          {Object.entries(stats.byType).map(([type, count]) => (
            <View key={type} style={styles.statItem}>
              <Text style={styles.statValue}>{count}</Text>
              <Text style={styles.statLabel}>{type}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Recent File Events ({fileEvents.length})
        </Text>
        <FlatList
          data={fileEvents.slice().reverse()}
          renderItem={renderFileEvent}
          keyExtractor={(item, index) =>
            `${item.path}-${item.timestamp}-${index}`
          }
          style={styles.eventsList}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {isWatching
                  ? "Waiting for file events..."
                  : "Start watching to see events"}
              </Text>
            </View>
          }
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
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
  directorySelector: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  directoryPath: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  browseButton: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  extensionContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  extensionBadge: {
    backgroundColor: "#e3f2fd",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  extensionText: {
    fontSize: 12,
    color: "#1976d2",
    fontWeight: "600",
  },
  moreExtensionsText: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    alignSelf: "center",
  },
  controlRow: {
    flexDirection: "row",
    gap: 12,
  },
  toggleButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
  },
  startButton: {
    backgroundColor: "#007AFF",
  },
  stopButton: {
    backgroundColor: "#FF3B30",
  },
  toggleButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  clearButton: {
    padding: 15,
    borderRadius: 8,
    backgroundColor: "#8E8E93",
    alignItems: "center",
  },
  clearButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorContainer: {
    backgroundColor: "#FFE5E5",
    padding: 12,
    borderRadius: 8,
    margin: 15,
  },
  errorText: {
    color: "#D70015",
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 15,
  },
  statItem: {
    alignItems: "center",
    minWidth: 60,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  eventsList: {
    maxHeight: 300,
  },
  eventItem: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 6,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  eventType: {
    fontSize: 10,
    fontWeight: "600",
    marginRight: 12,
    padding: 4,
    borderRadius: 4,
    minWidth: 50,
    textAlign: "center",
  },
  created: {
    backgroundColor: "#D4F4DD",
    color: "#34C759",
  },
  modified: {
    backgroundColor: "#FFF3CD",
    color: "#FF9500",
  },
  removed: {
    backgroundColor: "#FFE5E5",
    color: "#FF3B30",
  },
  eventDetails: {
    flex: 1,
  },
  eventPath: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  eventTimestamp: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 14,
    color: "#666",
    fontStyle: "italic",
  },
});

export default DesktopFileWatcherScreen;
