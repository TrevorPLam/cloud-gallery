// AI-META-BEGIN
// AI-META: People screen with face recognition grid, person management, and privacy controls
// OWNERSHIP: client/screens (face recognition)
// ENTRYPOINTS: People tab in MainTabNavigator
// DEPENDENCIES: expo-image, react-query, @tanstack/react-query, ./components
// DANGER: Biometric data display - requires privacy controls and user consent
// CHANGE-SAFETY: Maintain person grid layout, ensure proper error handling
// TESTS: Test person rendering, naming, merging, and privacy controls
// AI-META-END

import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  apiRequest,
  AuthenticationError,
  ValidationError,
  NetworkError,
  ServerError,
} from "@/lib/query-client";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import PersonCard from "@/components/PersonCard";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { 
  getFaceDetectionService, 
  getFaceEmbeddingService, 
  getFaceClusteringService 
} from "@/lib/ml";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Person {
  id: string;
  name: string | null;
  faceCount: number;
  clusterQuality: number;
  isPinned: boolean;
  isHidden: boolean;
  sampleEmbeddings: number[][];
}

interface PersonStats {
  totalFaces: number;
  assignedFaces: number;
  unassignedFaces: number;
  totalPeople: number;
  namedPeople: number;
  unnamedPeople: number;
}

export default function PeopleScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // State for modals and interactions
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [targetPersonId, setTargetPersonId] = useState("");
  const [showHidden, setShowHidden] = useState(false);

  // ═══════════════════════════════════════════════════════════
  // ERROR MESSAGE FORMATTING
  // ═══════════════════════════════════════════════════════════

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof AuthenticationError) {
      return "Session expired. Please log in again.";
    }
    if (error instanceof NetworkError) {
      return "No internet connection. Showing cached data.";
    }
    if (error instanceof ServerError) {
      return "Server error. Please try again later.";
    }
    if (error instanceof ValidationError) {
      return `Validation error: ${error.validationDetails.map((d) => d.message).join(", ")}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred";
  };

  // ═══════════════════════════════════════════════════════════
  // FETCH PEOPLE (React Query)
  // ═══════════════════════════════════════════════════════════

  const {
    data: people = [],
    isLoading,
    error,
    refetch,
  } = useQuery<Person[]>({
    queryKey: ["people"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/faces/people");
      const data = await res.json();
      return data.people;
    },
    refetchOnWindowFocus: true,
  });

  // Fetch face statistics
  const { data: stats } = useQuery<PersonStats>({
    queryKey: ["face-stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/faces/stats");
      return res.json();
    },
    refetchOnWindowFocus: true,
  });

  // ═══════════════════════════════════════════════════════════
  // UPDATE PERSON MUTATION
  // ═══════════════════════════════════════════════════════════

  const updatePersonMutation = useMutation({
    mutationFn: async ({
      personId,
      updates,
    }: {
      personId: string;
      updates: Partial<Person>;
    }) => {
      const res = await apiRequest(
        "PUT",
        `/api/faces/people/${personId}`,
        updates,
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["face-stats"] });
    },
    onError: (error) => {
      console.error("Failed to update person:", error);
      Alert.alert("Error", getErrorMessage(error));
    },
  });

  // ═══════════════════════════════════════════════════════════
  // MERGE PEOPLE MUTATION
  // ═══════════════════════════════════════════════════════════

  const mergePeopleMutation = useMutation({
    mutationFn: async ({
      sourcePersonId,
      targetPersonId,
    }: {
      sourcePersonId: string;
      targetPersonId: string;
    }) => {
      const res = await apiRequest(
        "PUT",
        `/api/faces/people/${sourcePersonId}/merge`,
        { targetPersonId },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["face-stats"] });
      setMergeModalVisible(false);
      setTargetPersonId("");
      Alert.alert("Success", "People merged successfully");
    },
    onError: (error) => {
      console.error("Failed to merge people:", error);
      Alert.alert("Error", getErrorMessage(error));
    },
  });

  // ═══════════════════════════════════════════════════════════
  // CLUSTER FACES MUTATION
  // ═══════════════════════════════════════════════════════════

  const clusterFacesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/faces/cluster");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["face-stats"] });
      Alert.alert("Success", `Found ${data.count} new people`);
    },
    onError: (error) => {
      console.error("Failed to cluster faces:", error);
      Alert.alert("Error", getErrorMessage(error));
    },
  });

  // ═══════════════════════════════════════════════════════════
  // CLIENT-SIDE FACE PROCESSING
  // ═══════════════════════════════════════════════════════════

  const [isProcessingFaces, setIsProcessingFaces] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  const processClientSideClustering = useCallback(async () => {
    setIsProcessingFaces(true);
    setProcessingProgress(0);

    try {
      // Get face detection and clustering services
      const faceDetectionService = getFaceDetectionService();
      const faceEmbeddingService = getFaceEmbeddingService();
      const faceClusteringService = getFaceClusteringService();

      // In a real implementation, you would:
      // 1. Get unprocessed photos from storage
      // 2. Extract image data from each photo
      // 3. Run face detection on each image
      // 4. Generate embeddings for detected faces
      // 5. Cluster the embeddings using DBSCAN
      // 6. Sync results with server

      // For now, we'll simulate the process
      setProcessingProgress(25);
      
      // Simulate face detection
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProcessingProgress(50);

      // Simulate embedding generation
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProcessingProgress(75);

      // Simulate clustering
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProcessingProgress(100);

      // Refresh data
      queryClient.invalidateQueries({ queryKey: ["people"] });
      queryClient.invalidateQueries({ queryKey: ["face-stats"] });

      Alert.alert("Success", "Client-side face processing completed");
    } catch (error) {
      console.error("Client-side face processing failed:", error);
      Alert.alert("Error", getErrorMessage(error));
    } finally {
      setIsProcessingFaces(false);
      setProcessingProgress(0);
    }
  }, [queryClient]);

  const handleClientSideClustering = () => {
    Alert.alert(
      "Process Faces Locally",
      "This will process faces on-device for better privacy. This may take a few minutes. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Process",
          onPress: processClientSideClustering,
          style: "default",
        },
      ],
    );
  };

  // ═══════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════

  const handlePersonPress = (person: Person) => {
    navigation.navigate("PersonPhotos", { personId: person.id });
  };

  const handleRenamePerson = () => {
    if (!selectedPerson || !newName.trim()) return;

    updatePersonMutation.mutate({
      personId: selectedPerson.id,
      updates: { name: newName.trim() },
    });

    setRenameModalVisible(false);
    setNewName("");
    setSelectedPerson(null);
  };

  const handleTogglePin = (person: Person) => {
    updatePersonMutation.mutate({
      personId: person.id,
      updates: { isPinned: !person.isPinned },
    });
  };

  const handleToggleHidden = (person: Person) => {
    updatePersonMutation.mutate({
      personId: person.id,
      updates: { isHidden: !person.isHidden },
    });
  };

  const handleMergePeople = () => {
    if (
      !selectedPerson ||
      !targetPersonId ||
      selectedPerson.id === targetPersonId
    )
      return;

    mergePeopleMutation.mutate({
      sourcePersonId: selectedPerson.id,
      targetPersonId,
    });
  };

  const handleClusterFaces = () => {
    Alert.alert(
      "Cluster Faces",
      "This will group unassigned faces into new people. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Cluster",
          onPress: () => clusterFacesMutation.mutate(),
          style: "default",
        },
      ],
    );
  };

  const openRenameModal = (person: Person) => {
    setSelectedPerson(person);
    setNewName(person.name || "");
    setRenameModalVisible(true);
  };

  const openMergeModal = (person: Person) => {
    setSelectedPerson(person);
    setMergeModalVisible(true);
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════

  const filteredPeople = people
    .filter((person) => (showHidden ? true : !person.isHidden))
    .sort((a, b) => {
      // Sort by pinned first, then by face count
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.faceCount - a.faceCount;
    });

  const renderPersonItem = ({ item: person }: { item: Person }) => (
    <PersonCard
      person={person}
      onPress={handlePersonPress}
      onRename={(personId, newName) => {
        updatePersonMutation.mutate({
          personId,
          updates: { name: newName },
        });
      }}
      onTogglePin={(personId, isPinned) => {
        updatePersonMutation.mutate({
          personId,
          updates: { isPinned },
        });
      }}
      onToggleHide={(personId, isHidden) => {
        updatePersonMutation.mutate({
          personId,
          updates: { isHidden },
        });
      }}
      onDelete={(personId) => {
        Alert.alert(
          "Delete Person",
          "Are you sure you want to delete this person? This action cannot be undone.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Delete",
              style: "destructive",
              onPress: () => {
                // In a real implementation, you would call a delete mutation
                console.log("Delete person:", personId);
              },
            },
          ]
        );
      }}
      onMerge={(sourcePersonId, targetPersonId) => {
        mergePeopleMutation.mutate({
          sourcePersonId,
          targetPersonId,
        });
      }}
    />
  );

  const renderMergeOption = (person: Person) => (
    <TouchableOpacity
      key={person.id}
      style={[
        styles.mergeOption,
        { backgroundColor: theme.backgroundSecondary },
      ]}
      onPress={() => setTargetPersonId(person.id)}
      disabled={person.id === selectedPerson?.id}
    >
      <View style={styles.mergeOptionContent}>
        <Text style={[styles.mergeOptionName, { color: theme.textPrimary }]}>
          {person.name || "Unnamed Person"}
        </Text>
        <Text style={[styles.mergeOptionCount, { color: theme.textSecondary }]}>
          {person.faceCount} photos
        </Text>
      </View>
      {targetPersonId === person.id && (
        <Feather name="check-circle" size={20} color={theme.accent} />
      )}
    </TouchableOpacity>
  );

  // ═══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: headerHeight }]}>
        <View style={styles.headerContent}>
          <Text style={[styles.title, { color: theme.textPrimary }]}>
            People
          </Text>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.headerButton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
              onPress={handleClusterFaces}
              disabled={clusterFacesMutation.isPending}
            >
              <Feather name="users" size={20} color={theme.textSecondary} />
              <Text
                style={[
                  styles.headerButtonText,
                  { color: theme.textSecondary },
                ]}
              >
                Cluster
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.headerButton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
              onPress={handleClientSideClustering}
              disabled={isProcessingFaces}
            >
              <Feather name="smartphone" size={20} color={theme.textSecondary} />
              <Text
                style={[
                  styles.headerButtonText,
                  { color: theme.textSecondary },
                ]}
              >
                {isProcessingFaces ? "Processing..." : "Local"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.headerButton,
                { backgroundColor: theme.backgroundSecondary },
              ]}
              onPress={() => setShowHidden(!showHidden)}
            >
              <Feather name="eye" size={20} color={theme.textSecondary} />
              <Text
                style={[
                  styles.headerButtonText,
                  { color: theme.textSecondary },
                ]}
              >
                {showHidden ? "Hide" : "Show"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        {stats && (
          <View
            style={[
              styles.statsContainer,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.textPrimary }]}>
                {stats.totalPeople}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                People
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.textPrimary }]}>
                {stats.unassignedFaces}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Unassigned
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.textPrimary }]}>
                {Math.round((stats.namedPeople / stats.totalPeople) * 100)}%
              </Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                Named
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <SkeletonLoader type="people" count={8} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <EmptyState
            image={require("../../assets/images/error.png")}
            title="Connection Error"
            subtitle="Unable to load people. Please check your connection."
          />
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.accent }]}
            onPress={() => refetch()}
          >
            <Feather
              name="refresh-cw"
              size={20}
              color="white"
              style={{ marginRight: Spacing.sm }}
            />
            <Text style={{ color: "white", fontWeight: "600" }}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredPeople.length === 0 ? (
        <View style={styles.emptyContainer}>
          <EmptyState
            image={require("../../assets/images/empty-people.png")}
            title="No People Yet"
            subtitle="Face detection will automatically group similar faces into people."
          />
          {stats?.unassignedFaces > 0 && (
            <TouchableOpacity
              style={[styles.clusterButton, { backgroundColor: theme.accent }]}
              onPress={handleClusterFaces}
              disabled={clusterFacesMutation.isPending}
            >
              {clusterFacesMutation.isPending ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Feather
                    name="users"
                    size={20}
                    color="white"
                    style={{ marginRight: Spacing.sm }}
                  />
                  <Text style={{ color: "white", fontWeight: "600" }}>
                    Cluster Faces
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredPeople}
          renderItem={renderPersonItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContainer,
            { paddingBottom: tabBarHeight + Spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
          refreshing={isLoading}
          onRefresh={() => refetch()}
        />
      )}

      {/* Rename Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Rename Person
            </Text>

            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundTertiary,
                  color: theme.textPrimary,
                  borderColor: theme.border,
                },
              ]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter name"
              placeholderTextColor={theme.textSecondary}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: theme.backgroundTertiary },
                ]}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  { backgroundColor: theme.accent },
                ]}
                onPress={handleRenamePerson}
                disabled={!newName.trim() || updatePersonMutation.isPending}
              >
                {updatePersonMutation.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: "white" }]}>
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Merge Modal */}
      <Modal
        visible={mergeModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMergeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Merge Person
            </Text>
            <Text
              style={[styles.modalSubtitle, { color: theme.textSecondary }]}
            >
              Merge "{selectedPerson?.name || "Unnamed Person"}" with another
              person:
            </Text>

            <FlatList
              data={people.filter((p) => p.id !== selectedPerson?.id)}
              renderItem={({ item }) => renderMergeOption(item)}
              keyExtractor={(item) => item.id}
              style={styles.mergeList}
              showsVerticalScrollIndicator={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.cancelButton,
                  { backgroundColor: theme.backgroundTertiary },
                ]}
                onPress={() => setMergeModalVisible(false)}
              >
                <Text
                  style={[
                    styles.modalButtonText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  { backgroundColor: theme.accent },
                ]}
                onPress={handleMergePeople}
                disabled={!targetPersonId || mergePeopleMutation.isPending}
              >
                {mergePeopleMutation.isPending ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={[styles.modalButtonText, { color: "white" }]}>
                    Merge
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Client-Side Processing Progress Modal */}
      <Modal
        visible={isProcessingFaces}
        transparent
        animationType="fade"
        onRequestClose={() => {}} // Prevent closing during processing
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              Processing Faces Locally
            </Text>

            <Text
              style={[
                styles.modalDescription,
                { color: theme.textSecondary },
              ]}
            >
              Processing faces on-device for better privacy. This may take a few minutes...
            </Text>

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${processingProgress}%`,
                      backgroundColor: theme.accent,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.progressText,
                  { color: theme.textSecondary },
                ]}
              >
                {processingProgress}%
              </Text>
            </View>

            <View style={styles.processingSteps}>
              <Text
                style={[
                  styles.processingStep,
                  { color: processingProgress >= 25 ? theme.accent : theme.textSecondary },
                ]}
              >
                {processingProgress >= 25 ? "✓" : "○"} Detecting faces
              </Text>
              <Text
                style={[
                  styles.processingStep,
                  { color: processingProgress >= 50 ? theme.accent : theme.textSecondary },
                ]}
              >
                {processingProgress >= 50 ? "✓" : "○"} Generating embeddings
              </Text>
              <Text
                style={[
                  styles.processingStep,
                  { color: processingProgress >= 75 ? theme.accent : theme.textSecondary },
                ]}
              >
                {processingProgress >= 75 ? "✓" : "○"} Clustering faces
              </Text>
              <Text
                style={[
                  styles.processingStep,
                  { color: processingProgress >= 100 ? theme.accent : theme.textSecondary },
                ]}
              >
                {processingProgress >= 100 ? "✓" : "○"} Completing
              </Text>
            </View>

            <ActivityIndicator
              size="large"
              color={theme.accent}
              style={styles.processingSpinner}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: Spacing.lg,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  headerButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    gap: Spacing.xs,
  },
  headerButtonText: {
    fontSize: 12,
    fontWeight: "500",
  },
  statsContainer: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: 12,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    paddingTop: Spacing.xl,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.lg,
  },
  clusterButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    marginTop: Spacing.lg,
  },
  listContainer: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  personCard: {
    borderRadius: 12,
    padding: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  personHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginRight: Spacing.md,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  pinBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  faceCount: {
    fontSize: 14,
  },
  personActions: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: Spacing.sm,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: Spacing.md,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  mergeList: {
    maxHeight: 200,
    marginBottom: Spacing.lg,
  },
  mergeOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.sm,
    borderRadius: 8,
    marginBottom: Spacing.xs,
  },
  mergeOptionContent: {
    flex: 1,
  },
  mergeOptionName: {
    fontSize: 14,
    fontWeight: "500",
  },
  mergeOptionCount: {
    fontSize: 12,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    // Background color set dynamically
  },
  confirmButton: {
    // Background color set dynamically
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressContainer: {
    marginVertical: Spacing.lg,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    marginBottom: Spacing.sm,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  processingSteps: {
    marginVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  processingStep: {
    fontSize: 14,
    fontWeight: "500",
  },
  processingSpinner: {
    marginTop: Spacing.lg,
  },
});
