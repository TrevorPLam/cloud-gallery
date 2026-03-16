// AI-META-BEGIN
// AI-META: Migration assistant interface with wizard UI for Google Takeout and iCloud migration
// OWNERSHIP: client/screens (user interface)
// ENTRYPOINTS: Navigable screen from app navigation
// DEPENDENCIES: React Native components, migration services, progress tracking
// DANGER: Large file processing, user experience during long operations
// CHANGE-SAFETY: Moderate - affects user migration workflow; maintain UX consistency
// TESTS: Test wizard navigation, progress display, error handling, cancellation
// AI-META-END

import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { googleTakeoutProcessor } from "@/lib/migration/google-takeout";
import { iCloudMigrationProcessor } from "@/lib/migration/icloud-migration";
import type {
  MigrationProgress,
  MigrationResult,
} from "@/lib/migration/google-takeout";

const { width } = Dimensions.get("window");

type MigrationType = "google-takeout" | "icloud" | null;
type MigrationStep =
  | "welcome"
  | "select-type"
  | "processing"
  | "complete"
  | "error";

interface MigrationState {
  step: MigrationStep;
  type: MigrationType;
  progress: MigrationProgress | null;
  result: MigrationResult | null;
  error: string | null;
}

export default function MigrationScreen() {
  const [migrationState, setMigrationState] = useState<MigrationState>({
    step: "welcome",
    type: null,
    progress: null,
    result: null,
    error: null,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Update migration state
  const updateMigrationState = useCallback(
    (updates: Partial<MigrationState>) => {
      setMigrationState((prev) => ({ ...prev, ...updates }));
    },
    [],
  );

  // Handle progress updates
  const handleProgress = useCallback(
    (progress: MigrationProgress) => {
      updateMigrationState({ progress });
    },
    [updateMigrationState],
  );

  // Start migration process
  const startMigration = useCallback(
    async (type: MigrationType) => {
      if (!type) return;

      setIsProcessing(true);
      updateMigrationState({
        step: "processing",
        type,
        progress: null,
        result: null,
        error: null,
      });

      try {
        let result: MigrationResult;

        if (type === "google-takeout") {
          result =
            await googleTakeoutProcessor.processTakeoutArchive(handleProgress);
        } else if (type === "icloud") {
          result =
            await iCloudMigrationProcessor.processICloudLibrary(handleProgress);
        } else {
          throw new Error("Invalid migration type");
        }

        updateMigrationState({
          step: result.success ? "complete" : "error",
          result,
          error: result.success ? null : result.errors.join("\n"),
        });
      } catch (error) {
        updateMigrationState({
          step: "error",
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [handleProgress, updateMigrationState],
  );

  // Cancel migration
  const cancelMigration = useCallback(() => {
    if (migrationState.type === "google-takeout") {
      googleTakeoutProcessor.cancel();
    } else if (migrationState.type === "icloud") {
      iCloudMigrationProcessor.cancel();
    }

    setIsProcessing(false);
    updateMigrationState({
      step: "welcome",
      type: null,
      progress: null,
      result: null,
      error: null,
    });
  }, [migrationState.type, updateMigrationState]);

  // Reset migration
  const resetMigration = useCallback(() => {
    updateMigrationState({
      step: "welcome",
      type: null,
      progress: null,
      result: null,
      error: null,
    });
  }, [updateMigrationState]);

  // Render welcome step
  const renderWelcome = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="cloud-upload-outline" size={80} color="#007AFF" />
      </View>

      <Text style={styles.title}>Welcome to Migration Assistant</Text>
      <Text style={styles.description}>
        Import your photos from Google Takeout or iCloud Photos with full
        metadata preservation.
      </Text>

      <View style={styles.featuresContainer}>
        <View style={styles.feature}>
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          <Text style={styles.featureText}>
            Preserve photo dates and locations
          </Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          <Text style={styles.featureText}>Restore camera metadata</Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          <Text style={styles.featureText}>Import descriptions and tags</Text>
        </View>
        <View style={styles.feature}>
          <Ionicons name="checkmark-circle" size={20} color="#34C759" />
          <Text style={styles.featureText}>Handle Live Photos</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => updateMigrationState({ step: "select-type" })}
      >
        <Text style={styles.primaryButtonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );

  // Render migration type selection
  const renderSelectType = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Choose Migration Source</Text>
      <Text style={styles.description}>
        Select where you want to import photos from.
      </Text>

      <View style={styles.optionsContainer}>
        <TouchableOpacity
          style={[styles.optionCard, styles.optionCardGoogle]}
          onPress={() => startMigration("google-takeout")}
          disabled={isProcessing}
        >
          <Ionicons name="logo-google" size={40} color="#4285F4" />
          <Text style={styles.optionTitle}>Google Takeout</Text>
          <Text style={styles.optionDescription}>
            Import from Google Photos export ZIP files
          </Text>
          <View style={styles.optionFeatures}>
            <Text style={styles.optionFeature}>• ZIP archive processing</Text>
            <Text style={styles.optionFeature}>
              • JSON metadata restoration
            </Text>
            <Text style={styles.optionFeature}>
              • GPS and date preservation
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.optionCard, styles.optionCardApple]}
          onPress={() => startMigration("icloud")}
          disabled={isProcessing}
        >
          <Ionicons name="logo-apple" size={40} color="#000000" />
          <Text style={styles.optionTitle}>iCloud Photos</Text>
          <Text style={styles.optionDescription}>
            Import directly from your iCloud library
          </Text>
          <View style={styles.optionFeatures}>
            <Text style={styles.optionFeature}>• Direct library access</Text>
            <Text style={styles.optionFeature}>• Live Photos support</Text>
            <Text style={styles.optionFeature}>• Full metadata transfer</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => updateMigrationState({ step: "welcome" })}
      >
        <Text style={styles.secondaryButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );

  // Render processing step
  const renderProcessing = () => (
    <View style={styles.stepContainer}>
      <View style={styles.processingHeader}>
        <Text style={styles.title}>Importing Photos</Text>
        <Text style={styles.description}>
          {migrationState.progress?.currentStep || "Preparing..."}
        </Text>
      </View>

      {migrationState.progress && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${migrationState.progress.percentage}%` },
              ]}
            />
          </View>

          <Text style={styles.progressText}>
            {migrationState.progress.processedFiles} /{" "}
            {migrationState.progress.totalFiles} files
          </Text>

          {migrationState.progress.currentFile && (
            <Text style={styles.currentFileText}>
              {migrationState.progress.currentFile}
            </Text>
          )}

          <ActivityIndicator
            size="large"
            color="#007AFF"
            style={styles.spinner}
          />
        </View>
      )}

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => setShowCancelModal(true)}
      >
        <Text style={styles.cancelButtonText}>Cancel Import</Text>
      </TouchableOpacity>
    </View>
  );

  // Render complete step
  const renderComplete = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="checkmark-circle" size={80} color="#34C759" />
      </View>

      <Text style={styles.title}>Import Complete!</Text>
      <Text style={styles.description}>
        Your photos have been successfully imported with full metadata.
      </Text>

      {migrationState.result && (
        <View style={styles.resultContainer}>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Photos Imported</Text>
            <Text style={styles.resultValue}>
              {migrationState.result.importedPhotos}
            </Text>
          </View>
          <View style={styles.resultItem}>
            <Text style={styles.resultLabel}>Duration</Text>
            <Text style={styles.resultValue}>
              {Math.round(migrationState.result.duration / 1000)}s
            </Text>
          </View>

          {migrationState.result.errors.length > 0 && (
            <View style={styles.errorsContainer}>
              <Text style={styles.errorsTitle}>Warnings</Text>
              {migrationState.result.errors.slice(0, 3).map((error, index) => (
                <Text key={index} style={styles.errorText}>
                  • {error}
                </Text>
              ))}
              {migrationState.result.errors.length > 3 && (
                <Text style={styles.errorText}>
                  ...and {migrationState.result.errors.length - 3} more
                </Text>
              )}
            </View>
          )}
        </View>
      )}

      <TouchableOpacity style={styles.primaryButton} onPress={resetMigration}>
        <Text style={styles.primaryButtonText}>Done</Text>
      </TouchableOpacity>
    </View>
  );

  // Render error step
  const renderError = () => (
    <View style={styles.stepContainer}>
      <View style={styles.iconContainer}>
        <Ionicons name="alert-circle" size={80} color="#FF3B30" />
      </View>

      <Text style={styles.title}>Import Failed</Text>
      <Text style={styles.description}>
        An error occurred while importing your photos.
      </Text>

      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{migrationState.error}</Text>
      </View>

      <View style={styles.errorActions}>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={resetMigration}
        >
          <Text style={styles.secondaryButtonText}>Try Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => updateMigrationState({ step: "select-type" })}
        >
          <Text style={styles.primaryButtonText}>Choose Different Source</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Render cancel confirmation modal
  const renderCancelModal = () => (
    <Modal
      visible={showCancelModal}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowCancelModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Cancel Import?</Text>
          <Text style={styles.modalDescription}>
            Are you sure you want to cancel the migration? Any progress will be
            lost.
          </Text>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowCancelModal(false)}
            >
              <Text style={styles.secondaryButtonText}>Continue</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, styles.dangerButton]}
              onPress={() => {
                setShowCancelModal(false);
                cancelMigration();
              }}
            >
              <Text style={styles.primaryButtonText}>Cancel Import</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Render current step
  const renderStep = () => {
    switch (migrationState.step) {
      case "welcome":
        return renderWelcome();
      case "select-type":
        return renderSelectType();
      case "processing":
        return renderProcessing();
      case "complete":
        return renderComplete();
      case "error":
        return renderError();
      default:
        return renderWelcome();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {renderStep()}
      </ScrollView>

      {renderCancelModal()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  scrollView: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
    alignItems: "center",
  },
  iconContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
    color: "#000000",
  },
  description: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#666666",
    lineHeight: 24,
  },
  featuresContainer: {
    width: "100%",
    marginBottom: 40,
  },
  feature: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  featureText: {
    fontSize: 16,
    marginLeft: 12,
    color: "#333333",
  },
  primaryButton: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: width * 0.8,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#007AFF",
    minWidth: width * 0.8,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#007AFF",
    fontSize: 18,
    fontWeight: "600",
  },
  cancelButton: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: width * 0.8,
    alignItems: "center",
    marginTop: 40,
  },
  cancelButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  optionsContainer: {
    width: "100%",
    marginBottom: 30,
  },
  optionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  optionCardGoogle: {
    borderTopWidth: 4,
    borderTopColor: "#4285F4",
  },
  optionCardApple: {
    borderTopWidth: 4,
    borderTopColor: "#000000",
  },
  optionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 8,
    color: "#000000",
  },
  optionDescription: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
    color: "#666666",
  },
  optionFeatures: {
    alignItems: "flex-start",
    width: "100%",
  },
  optionFeature: {
    fontSize: 12,
    marginBottom: 4,
    color: "#666666",
  },
  processingHeader: {
    alignItems: "center",
    marginBottom: 40,
  },
  progressContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: 40,
  },
  progressBar: {
    width: "100%",
    height: 8,
    backgroundColor: "#E5E5EA",
    borderRadius: 4,
    marginBottom: 16,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
    color: "#000000",
  },
  currentFileText: {
    fontSize: 14,
    color: "#666666",
    marginBottom: 20,
    textAlign: "center",
  },
  spinner: {
    marginTop: 20,
  },
  resultContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
  },
  resultItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  resultLabel: {
    fontSize: 16,
    color: "#666666",
  },
  resultValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000000",
  },
  errorsContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E5EA",
  },
  errorsTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#FF3B30",
  },
  errorText: {
    fontSize: 12,
    marginBottom: 4,
    color: "#666666",
  },
  errorContainer: {
    width: "100%",
    backgroundColor: "#FFF2F2",
    borderRadius: 12,
    padding: 16,
    marginBottom: 30,
  },
  errorActions: {
    width: "100%",
    gap: 12,
  },
  dangerButton: {
    backgroundColor: "#FF3B30",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    margin: 20,
    maxWidth: width * 0.9,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#000000",
  },
  modalDescription: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
    color: "#666666",
    lineHeight: 24,
  },
  modalActions: {
    gap: 12,
  },
});
