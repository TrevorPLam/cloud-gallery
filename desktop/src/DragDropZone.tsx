import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { listen } from "@tauri-apps/api/event";
import { DesktopFileService } from "./file-service";

interface DroppedFile {
  path: string;
  name: string;
  size?: number;
  type: string;
}

interface DragDropZoneProps {
  onFilesDropped: (files: DroppedFile[]) => void;
  children: React.ReactNode;
  style?: any;
}

const DragDropZone: React.FC<DragDropZoneProps> = ({
  onFilesDropped,
  children,
  style,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<DroppedFile[]>([]);
  const fileService = DesktopFileService.getInstance();

  useEffect(() => {
    const setupDragDrop = async () => {
      try {
        // Listen for file drop events from Tauri
        const unlisten = await listen("files-dropped", (event) => {
          const paths = event.payload as string[];
          const files: DroppedFile[] = paths.map((path) => ({
            path,
            name: fileService.getFileName(path),
            type: fileService.getFileExtension(path),
          }));

          setDroppedFiles(files);
          onFilesDropped(files);

          // Show notification
          fileService.showNotification(
            "Files Dropped",
            `${files.length} files ready for import`,
          );
        });

        return () => {
          unlisten();
        };
      } catch (error) {
        console.error("Failed to setup drag drop:", error);
      }
    };

    const cleanup = setupDragDrop();
    return cleanup;
  }, [onFilesDropped, fileService]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const clearDroppedFiles = useCallback(() => {
    setDroppedFiles([]);
  }, []);

  return (
    <View style={[styles.container, style]}>
      <View
        style={[styles.dropZone, isDragging && styles.dropZoneActive]}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {children}

        {isDragging && (
          <View style={styles.dragOverlay}>
            <Text style={styles.dragText}>Drop files here to import</Text>
            <Text style={styles.dragSubtext}>
              Photos and videos will be added to your gallery
            </Text>
          </View>
        )}
      </View>

      {droppedFiles.length > 0 && (
        <View style={styles.droppedFilesContainer}>
          <View style={styles.droppedFilesHeader}>
            <Text style={styles.droppedFilesTitle}>
              Dropped Files ({droppedFiles.length})
            </Text>
            <TouchableOpacity onPress={clearDroppedFiles}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.droppedFilesList} horizontal>
            {droppedFiles.map((file, index) => (
              <View key={index} style={styles.fileItem}>
                <View style={[styles.fileIcon, styles[file.type]]}>
                  <Text style={styles.fileIconText}>
                    {file.type.toUpperCase().slice(0, 3)}
                  </Text>
                </View>
                <Text style={styles.fileName} numberOfLines={1}>
                  {file.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  dropZone: {
    position: "relative",
    minHeight: 200,
  },
  dropZoneActive: {
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    borderWidth: 2,
    borderColor: "#007AFF",
    borderRadius: 8,
  },
  dragOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 122, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    zIndex: 1000,
  },
  dragText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  dragSubtext: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  droppedFilesContainer: {
    marginTop: 15,
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  droppedFilesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  droppedFilesTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  clearButton: {
    fontSize: 14,
    color: "#007AFF",
    fontWeight: "600",
  },
  droppedFilesList: {
    maxHeight: 80,
  },
  fileItem: {
    alignItems: "center",
    marginRight: 15,
    minWidth: 80,
  },
  fileIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  jpg: {
    backgroundColor: "#FFE5E5",
  },
  jpeg: {
    backgroundColor: "#FFE5E5",
  },
  png: {
    backgroundColor: "#E5F5FF",
  },
  gif: {
    backgroundColor: "#FFF3E5",
  },
  bmp: {
    backgroundColor: "#F0E5FF",
  },
  tiff: {
    backgroundColor: "#E5FFE5",
  },
  heic: {
    backgroundColor: "#FFE5F0",
  },
  webp: {
    backgroundColor: "#F0FFE5",
  },
  fileIconText: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#333",
  },
  fileName: {
    fontSize: 10,
    color: "#666",
    textAlign: "center",
  },
});

export default DragDropZone;
