// Family sharing interface for managing encrypted family libraries.
// Provides UI for member management, activity tracking, and permission controls.

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

// Import sharing services
import { sharingKeyManager, SharingKeyType, SharingPermission } from "../../lib/sharing/key-management";
import { permissionManager, PermissionAction, getAvailableRoles } from "../../lib/sharing/permissions";
import { 
  initializeDeviceSync, 
  getSharingSyncStatus, 
  queueSharingOperation,
  SyncOperationType 
} from "../../lib/sharing/device-sync";

// Types
interface Partner {
  id: string;
  name: string;
  email: string;
  status: "active" | "pending" | "inactive";
  role: string;
  joinedAt: string;
  lastActive: string;
}

interface SharingKey {
  id: string;
  name: string;
  type: SharingKeyType;
  permissions: SharingPermission;
  memberCount: number;
  createdAt: string;
  isActive: boolean;
}

interface ActivityItem {
  id: string;
  type: "member_added" | "member_removed" | "permission_changed" | "key_rotated" | "photo_shared";
  description: string;
  userId: string;
  userName: string;
  timestamp: string;
  metadata?: any;
}

interface SharingStats {
  totalPartners: number;
  activePartners: number;
  photosShared: number;
  photosReceived: number;
  autoShareRules: number;
}

// Props
interface SharingScreenProps {
  navigation: any;
  route: any;
  userId: string;
}

export const SharingScreen: React.FC<SharingScreenProps> = ({
  navigation,
  userId,
}) => {
  // State
  const [activeTab, setActiveTab] = useState<"partners" | "libraries" | "activity" | "settings">("partners");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [sharingKeys, setSharingKeys] = useState<SharingKey[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [stats, setStats] = useState<SharingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(getSharingSyncStatus());

  // Modal states
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateLibraryModal, setShowCreateLibraryModal] = useState(false);
  const [showMemberDetailsModal, setShowMemberDetailsModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [selectedKey, setSelectedKey] = useState<SharingKey | null>(null);

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [libraryName, setLibraryName] = useState("");
  const [libraryType, setLibraryType] = useState<SharingKeyType>(SharingKeyType.FAMILY_LIBRARY);
  const [libraryPermissions, setLibraryPermissions] = useState<SharingPermission>(SharingPermission.VIEW);

  // Initialize sync on mount
  useEffect(() => {
    initializeDeviceSync(`device_${userId}_${Date.now()}`);
  }, [userId]);

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  // Update sync status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncStatus(getSharingSyncStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPartners(),
        loadSharingKeys(),
        loadActivities(),
        loadStats(),
      ]);
    } catch (error) {
      console.error("Failed to load sharing data:", error);
      Alert.alert("Error", "Failed to load sharing data");
    } finally {
      setLoading(false);
    }
  };

  const loadPartners = async () => {
    // This would call the family sharing API
    // For now, use mock data
    const mockPartners: Partner[] = [
      {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        status: "active",
        role: "admin",
        joinedAt: "2024-01-15T10:00:00Z",
        lastActive: "2024-03-16T14:30:00Z",
      },
      {
        id: "2",
        name: "Jane Smith",
        email: "jane@example.com",
        status: "active",
        role: "contributor",
        joinedAt: "2024-02-01T12:00:00Z",
        lastActive: "2024-03-16T09:15:00Z",
      },
    ];
    setPartners(mockPartners);
  };

  const loadSharingKeys = async () => {
    const userKeys = await sharingKeyManager.getUserSharingKeys(userId);
    const keys: SharingKey[] = userKeys.map(metadata => ({
      id: metadata.id,
      name: metadata.name,
      type: metadata.type,
      permissions: metadata.permissions,
      memberCount: metadata.memberIds.length,
      createdAt: new Date(metadata.createdAt).toISOString(),
      isActive: metadata.isActive,
    }));
    setSharingKeys(keys);
  };

  const loadActivities = async () => {
    // Mock activity data
    const mockActivities: ActivityItem[] = [
      {
        id: "1",
        type: "member_added",
        description: "Jane Smith joined the family library",
        userId: "2",
        userName: "Jane Smith",
        timestamp: "2024-03-16T10:30:00Z",
      },
      {
        id: "2",
        type: "photo_shared",
        description: "John shared 5 new photos",
        userId: "1",
        userName: "John Doe",
        timestamp: "2024-03-16T09:15:00Z",
        metadata: { photoCount: 5 },
      },
    ];
    setActivities(mockActivities);
  };

  const loadStats = async () => {
    // Mock stats
    const mockStats: SharingStats = {
      totalPartners: 3,
      activePartners: 2,
      photosShared: 156,
      photosReceived: 89,
      autoShareRules: 4,
    };
    setStats(mockStats);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleInvitePartner = async () => {
    if (!inviteEmail) {
      Alert.alert("Error", "Please enter an email address");
      return;
    }

    try {
      // This would call the family sharing API
      console.log("Inviting partner:", { email: inviteEmail, message: inviteMessage });
      
      // Queue sync operation
      await queueSharingOperation(
        SyncOperationType.ADD_MEMBER,
        "family_library_main",
        userId,
        { email: inviteEmail, message: inviteMessage }
      );

      setShowInviteModal(false);
      setInviteEmail("");
      setInviteMessage("");
      
      Alert.alert("Success", "Invitation sent successfully");
      await loadPartners();
    } catch (error) {
      console.error("Failed to invite partner:", error);
      Alert.alert("Error", "Failed to send invitation");
    }
  };

  const handleCreateLibrary = async () => {
    if (!libraryName) {
      Alert.alert("Error", "Please enter a library name");
      return;
    }

    try {
      const result = await sharingKeyManager.createSharingKey(
        libraryType,
        libraryName,
        userId,
        {
          permissions: libraryPermissions,
          description: `Family library: ${libraryName}`,
        }
      );

      // Queue sync operation
      await queueSharingOperation(
        SyncOperationType.CREATE,
        result.keyId,
        userId,
        { name: libraryName, type: libraryType, permissions: libraryPermissions }
      );

      setShowCreateLibraryModal(false);
      setLibraryName("");
      setLibraryType(SharingKeyType.FAMILY_LIBRARY);
      setLibraryPermissions(SharingPermission.VIEW);

      Alert.alert("Success", "Library created successfully");
      await loadSharingKeys();
    } catch (error) {
      console.error("Failed to create library:", error);
      Alert.alert("Error", "Failed to create library");
    }
  };

  const handleRemovePartner = (partner: Partner) => {
    Alert.alert(
      "Remove Partner",
      `Are you sure you want to remove ${partner.name} from the family library?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              // This would call the family sharing API
              console.log("Removing partner:", partner.id);
              
              // Queue sync operation
              await queueSharingOperation(
                SyncOperationType.REMOVE_MEMBER,
                "family_library_main",
                userId,
                { memberId: partner.id }
              );

              Alert.alert("Success", "Partner removed successfully");
              await loadPartners();
            } catch (error) {
              console.error("Failed to remove partner:", error);
              Alert.alert("Error", "Failed to remove partner");
            }
          },
        },
      ]
    );
  };

  const handleUpdatePermissions = async (partner: Partner, newRole: string) => {
    try {
      // This would call the permission management API
      console.log("Updating permissions:", { partnerId: partner.id, newRole });
      
      // Queue sync operation
      await queueSharingOperation(
        SyncOperationType.UPDATE_PERMISSIONS,
        "family_library_main",
        userId,
        { userId: partner.id, newRole }
      );

      Alert.alert("Success", "Permissions updated successfully");
      await loadPartners();
    } catch (error) {
      console.error("Failed to update permissions:", error);
      Alert.alert("Error", "Failed to update permissions");
    }
  };

  const renderPartnerItem = ({ item }: { item: Partner }) => (
    <View style={styles.partnerItem}>
      <View style={styles.partnerInfo}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name.split(" ").map(n => n[0]).join("").toUpperCase()}
          </Text>
        </View>
        <View style={styles.partnerDetails}>
          <Text style={styles.partnerName}>{item.name}</Text>
          <Text style={styles.partnerEmail}>{item.email}</Text>
          <Text style={styles.partnerRole}>{item.role}</Text>
        </View>
      </View>
      <View style={styles.partnerActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedPartner(item);
            setShowMemberDetailsModal(true);
          }}
        >
          <Ionicons name="information-circle-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleRemovePartner(item)}
        >
          <Ionicons name="person-remove-outline" size={24} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLibraryItem = ({ item }: { item: SharingKey }) => (
    <View style={styles.libraryItem}>
      <View style={styles.libraryInfo}>
        <Ionicons 
          name={item.type === SharingKeyType.FAMILY_LIBRARY ? "people" : "folder"} 
          size={32} 
          color="#007AFF" 
        />
        <View style={styles.libraryDetails}>
          <Text style={styles.libraryName}>{item.name}</Text>
          <Text style={styles.libraryType}>{item.type}</Text>
          <Text style={styles.libraryMembers}>{item.memberCount} members</Text>
        </View>
      </View>
      <View style={styles.libraryActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => {
            setSelectedKey(item);
            // Show library details or settings
          }}
        >
          <Ionicons name="settings-outline" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderActivityItem = ({ item }: { item: ActivityItem }) => (
    <View style={styles.activityItem}>
      <View style={styles.activityIcon}>
        <Ionicons
          name={
            item.type === "member_added"
              ? "person-add"
              : item.type === "member_removed"
              ? "person-remove"
              : item.type === "permission_changed"
              ? "key"
              : item.type === "key_rotated"
              ? "refresh"
              : "image"
          }
          size={20}
          color="#007AFF"
        />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityDescription}>{item.description}</Text>
        <Text style={styles.activityTime}>
          {new Date(item.timestamp).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading sharing data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Family Sharing</Text>
        <View style={styles.syncStatus}>
          <Ionicons
            name={syncStatus.isOnline ? "wifi" : "wifi-off"}
            size={16}
            color={syncStatus.isOnline ? "#34C759" : "#FF3B30"}
          />
          <Text style={styles.syncText}>
            {syncStatus.isOnline ? "Synced" : "Offline"}
          </Text>
        </View>
      </View>

      {/* Stats */}
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.totalPartners}</Text>
            <Text style={styles.statLabel}>Partners</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.photosShared}</Text>
            <Text style={styles.statLabel}>Shared</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.photosReceived}</Text>
            <Text style={styles.statLabel}>Received</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stats.autoShareRules}</Text>
            <Text style={styles.statLabel}>Rules</Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {["partners", "libraries", "activity", "settings"].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[
              styles.tab,
              activeTab === tab && styles.activeTab,
            ]}
            onPress={() => setActiveTab(tab as any)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab && styles.activeTabText,
              ]}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === "partners" && (
          <View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowInviteModal(true)}
            >
              <Ionicons name="person-add" size={20} color="white" />
              <Text style={styles.addButtonText}>Invite Partner</Text>
            </TouchableOpacity>
            <FlatList
              data={partners}
              renderItem={renderPartnerItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {activeTab === "libraries" && (
          <View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowCreateLibraryModal(true)}
            >
              <Ionicons name="add" size={20} color="white" />
              <Text style={styles.addButtonText}>Create Library</Text>
            </TouchableOpacity>
            <FlatList
              data={sharingKeys}
              renderItem={renderLibraryItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {activeTab === "activity" && (
          <FlatList
            data={activities}
            renderItem={renderActivityItem}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
          />
        )}

        {activeTab === "settings" && (
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>Sharing Settings</Text>
            {/* Add settings options here */}
          </View>
        )}
      </ScrollView>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Invite Partner</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="Enter email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.inputLabel}>Message (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={inviteMessage}
              onChangeText={setInviteMessage}
              placeholder="Add a personal message"
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={handleInvitePartner}>
              <Text style={styles.primaryButtonText}>Send Invitation</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create Library Modal */}
      <Modal
        visible={showCreateLibraryModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateLibraryModal(false)}>
              <Ionicons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Create Library</Text>
            <View style={{ width: 24 }} />
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.inputLabel}>Library Name</Text>
            <TextInput
              style={styles.input}
              value={libraryName}
              onChangeText={setLibraryName}
              placeholder="Enter library name"
            />
            <Text style={styles.inputLabel}>Library Type</Text>
            <View style={styles.pickerContainer}>
              {Object.values(SharingKeyType).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.pickerOption,
                    libraryType === type && styles.selectedPickerOption,
                  ]}
                  onPress={() => setLibraryType(type)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      libraryType === type && styles.selectedPickerOptionText,
                    ]}
                  >
                    {type.replace("_", " ").toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.primaryButton} onPress={handleCreateLibrary}>
              <Text style={styles.primaryButtonText}>Create Library</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#000",
  },
  syncStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  syncText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007AFF",
  },
  statLabel: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: "#007AFF",
  },
  tabText: {
    fontSize: 14,
    color: "#666",
  },
  activeTabText: {
    color: "#007AFF",
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  addButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  partnerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  partnerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  partnerDetails: {
    flex: 1,
  },
  partnerName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  partnerEmail: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  partnerRole: {
    fontSize: 12,
    color: "#007AFF",
    marginTop: 2,
  },
  partnerActions: {
    flexDirection: "row",
  },
  actionButton: {
    padding: 8,
    marginLeft: 8,
  },
  libraryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  libraryInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  libraryDetails: {
    marginLeft: 12,
    flex: 1,
  },
  libraryName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  libraryType: {
    fontSize: 14,
    color: "#666",
    marginTop: 2,
  },
  libraryMembers: {
    fontSize: 12,
    color: "#007AFF",
    marginTop: 2,
  },
  libraryActions: {
    flexDirection: "row",
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityDescription: {
    fontSize: 14,
    color: "#000",
  },
  activityTime: {
    fontSize: 12,
    color: "#666",
    marginTop: 2,
  },
  settingsContainer: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    marginBottom: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "white",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E5EA",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#000",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  pickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginVertical: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    marginRight: 8,
    marginBottom: 8,
  },
  selectedPickerOption: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
  },
  pickerOptionText: {
    fontSize: 14,
    color: "#666",
  },
  selectedPickerOptionText: {
    color: "white",
  },
  primaryButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 24,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default SharingScreen;
