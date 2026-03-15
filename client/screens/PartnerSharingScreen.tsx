// AI-META-BEGIN
// AI-META: Partner sharing screen with invitation flow, auto-share rules, and privacy controls
// OWNERSHIP: client/screens (partner sharing management)
// ENTRYPOINTS: Accessed via navigation from main app or settings
// DEPENDENCIES: React Query, partner sharing API, components, theme system
// DANGER: Partner invitation exposure; privacy settings bypass; auto-share rule manipulation
// CHANGE-SAFETY: Safe to modify UI; maintain permission checks; test sharing flows
// TESTS: Test invitation creation, rule management, privacy controls, shared library access
// AI-META-END

import React, { useState } from "react";
import {
  StyleSheet,
  View,
  Pressable,
  ScrollView,
  Alert,
  Platform,
  TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import {
  PartnerRelationship,
  PartnerInvitation,
  AutoShareRule,
  PartnerSharedPhoto,
  PartnerSharingStats,
} from "@/types";
import { apiRequest } from "@/lib/query-client";
import { EmptyState } from "@/components/EmptyState";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Shadows, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PartnerSharingScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // State for modals and forms
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [selectedPartnership, setSelectedPartnership] = useState<string | null>(null);
  const [autoShareRules, setAutoShareRules] = useState<any[]>([]);
  const [showCreateRuleForm, setShowCreateRuleForm] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    ruleType: "all_photos" as const,
    criteria: {
      favoritesOnly: false,
      excludeTags: [],
      minQuality: 50,
    },
    priority: 0,
  });

  // ═══════════════════════════════════════════════════════════
  // FETCH PARTNER SHARING DATA (React Query)
  // ═══════════════════════════════════════════════════════════

  const {
    data: partnerships,
    isLoading: partnershipsLoading,
    error: partnershipsError,
  } = useQuery({
    queryKey: ["partner-sharing", "partnerships"],
    queryFn: async () => {
      const response = await apiRequest("/api/partner-sharing/partnerships");
      return response.data as {
        active: PartnerRelationship[];
        pending: PartnerRelationship[];
      };
    },
  });

  const {
    data: stats,
    isLoading: statsLoading,
  } = useQuery({
    queryKey: ["partner-sharing", "stats"],
    queryFn: async () => {
      const response = await apiRequest("/api/partner-sharing/stats");
      return response.data as PartnerSharingStats;
    },
  });

  const {
    data: rulesData,
    refetch: refetchRules,
  } = useQuery({
    queryKey: ["partner-sharing", "rules", selectedPartnership],
    queryFn: async () => {
      if (!selectedPartnership) return { rules: [] };
      const response = await apiRequest(`/api/partner-sharing/rules/${selectedPartnership}`);
      return response.data as { rules: any[] };
    },
    enabled: !!selectedPartnership,
  });

  // ═══════════════════════════════════════════════════════════
  // MUTATIONS
  // ═══════════════════════════════════════════════════════════

  const createInvitationMutation = useMutation({
    mutationFn: async (data: { inviteeEmail: string; message?: string }) => {
      const response = await apiRequest("/api/partner-sharing/invitations", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response.data as PartnerInvitation;
    },
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteMessage("");
      Alert.alert(
        "Invitation Sent",
        `Invitation sent to ${data.inviteeEmail || "your partner"}. They can accept it using the invitation token.`,
      );
      queryClient.invalidateQueries({ queryKey: ["partner-sharing"] });
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to send invitation",
      );
    },
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async (invitationToken: string) => {
      const response = await apiRequest("/api/partner-sharing/invitations/accept", {
        method: "POST",
        body: JSON.stringify({ invitationToken }),
      });
      return response.data;
    },
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        "Partnership Created",
        `You are now partnered with ${data.partnerName}!`,
      );
      queryClient.invalidateQueries({ queryKey: ["partner-sharing"] });
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to accept invitation",
      );
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: async (rule: any) => {
      const response = await apiRequest("/api/partner-sharing/rules", {
        method: "POST",
        body: JSON.stringify(rule),
      });
      return response.data;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowCreateRuleForm(false);
      setNewRule({
        name: "",
        ruleType: "all_photos",
        criteria: {
          favoritesOnly: false,
          excludeTags: [],
          minQuality: 50,
        },
        priority: 0,
      });
      refetchRules();
      Alert.alert("Success", "Auto-share rule created successfully.");
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to create rule",
      );
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: async ({ ruleId, updates }: { ruleId: string; updates: any }) => {
      const response = await apiRequest(`/api/partner-sharing/rules/${ruleId}`, {
        method: "PUT",
        body: JSON.stringify(updates),
      });
      return response.data;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchRules();
      Alert.alert("Success", "Auto-share rule updated successfully.");
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to update rule",
      );
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const response = await apiRequest(`/api/partner-sharing/rules/${ruleId}`, {
        method: "DELETE",
      });
      return response.data;
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchRules();
      Alert.alert("Success", "Auto-share rule deleted successfully.");
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        "Error",
        error.response?.data?.error || "Failed to delete rule",
      );
    },
  });

  // ═══════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════

  const handleCreateInvitation = () => {
    if (!inviteEmail.trim()) {
      Alert.alert("Error", "Please enter an email address");
      return;
    }

    createInvitationMutation.mutate({
      inviteeEmail: inviteEmail.trim(),
      message: inviteMessage.trim() || undefined,
    });
  };

  const handleAcceptInvitation = () => {
    Alert.prompt(
      "Accept Invitation",
      "Enter the invitation token you received:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: (token) => {
            if (token && token.trim()) {
              acceptInvitationMutation.mutate(token.trim());
            }
          },
        },
      ],
      "plain-text",
    );
  };

  const handleViewSharedLibrary = (partnership: PartnerRelationship) => {
    navigation.navigate("PartnerSharedLibrary", {
      partnershipId: partnership.id,
      partnerName: partnership.partnerName,
    });
  };

  const handleManageRules = (partnership: PartnerRelationship) => {
    setSelectedPartnership(partnership.id);
    setShowRuleModal(true);
    refetchRules();
  };

  const handleCreateRule = () => {
    if (!newRule.name.trim()) {
      Alert.alert("Error", "Please enter a rule name");
      return;
    }

    createRuleMutation.mutate({
      partnershipId: selectedPartnership,
      name: newRule.name,
      ruleType: newRule.ruleType,
      criteria: newRule.criteria,
      priority: newRule.priority,
    });
  };

  const handleToggleRule = (rule: any) => {
    updateRuleMutation.mutate({
      ruleId: rule.id,
      updates: { isActive: !rule.isActive },
    });
  };

  const handleDeleteRule = (rule: any) => {
    Alert.alert(
      "Delete Rule",
      `Are you sure you want to delete "${rule.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          onPress: () => deleteRuleMutation.mutate(rule.id),
          style: "destructive",
        },
      ]
    );
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER HELPERS
  // ═══════════════════════════════════════════════════════════

  const renderPartnershipCard = (partnership: PartnerRelationship) => (
    <Card key={partnership.id} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.partnerInfo}>
          <ThemedText style={styles.partnerName}>
            {partnership.partnerName}
          </ThemedText>
          <ThemedText
            style={[
              styles.status,
              {
                color:
                  partnership.status === "accepted"
                    ? theme.success
                    : theme.warning,
              },
            ]}
          >
            {partnership.status === "accepted" ? "Active" : "Pending"}
          </ThemedText>
        </View>
        <Feather
          name="users"
          size={24}
          color={theme.textSecondary}
          style={styles.partnerIcon}
        />
      </View>

      {partnership.status === "accepted" && (
        <View style={styles.cardActions}>
          <Button
            variant="outline"
            size="small"
            onPress={() => handleViewSharedLibrary(partnership)}
            style={styles.actionButton}
          >
            <Feather name="image" size={16} color={theme.primary} />
            <ThemedText style={styles.actionText}>View Library</ThemedText>
          </Button>
          <Button
            variant="outline"
            size="small"
            onPress={() => handleManageRules(partnership)}
            style={styles.actionButton}
          >
            <Feather name="settings" size={16} color={theme.primary} />
            <ThemedText style={styles.actionText}>Rules</ThemedText>
          </Button>
        </View>
      )}

      {partnership.acceptedAt && (
        <ThemedText style={styles.acceptedDate}>
          Partner since {new Date(partnership.acceptedAt).toLocaleDateString()}
        </ThemedText>
      )}
    </Card>
  );

  const renderStatsCard = () => {
    if (!stats) return null;

    return (
      <Card style={styles.statsCard}>
        <ThemedText style={styles.statsTitle}>Partner Sharing Stats</ThemedText>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>
              {stats.activePartnerships}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Active Partners</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>
              {stats.sharedPhotos}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Shared Photos</ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={styles.statValue}>
              {stats.autoShareRules}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Auto-Share Rules</ThemedText>
          </View>
        </View>
      </Card>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════

  if (partnershipsLoading) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight }]}>
        <ThemedText>Loading partnerships...</ThemedText>
      </View>
    );
  }

  if (partnershipsError) {
    return (
      <View style={[styles.container, { paddingTop: headerHeight }]}>
        <EmptyState
          icon="alert-circle"
          title="Error Loading Partnerships"
          message="Please check your connection and try again."
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: headerHeight }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText style={styles.title}>Partner Sharing</ThemedText>
          <ThemedText style={styles.subtitle}>
            Share photos automatically with your partner
          </ThemedText>
        </View>

        {/* Stats Card */}
        {renderStatsCard()}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            onPress={() => setShowInviteModal(true)}
            style={styles.actionCard}
          >
            <Feather name="user-plus" size={20} color="white" />
            <ThemedText style={styles.actionCardTitle}>Invite Partner</ThemedText>
            <ThemedText style={styles.actionCardSubtitle}>
              Send an invitation to share photos
            </ThemedText>
          </Button>

          <Button
            variant="outline"
            onPress={handleAcceptInvitation}
            style={[styles.actionCard, styles.actionCardOutline]}
          >
            <Feather name="check-circle" size={20} color={theme.primary} />
            <ThemedText style={[styles.actionCardTitle, { color: theme.primary }]}>
              Accept Invitation
            </ThemedText>
            <ThemedText style={styles.actionCardSubtitle}>
              Enter invitation token to join
            </ThemedText>
          </Button>
        </View>

        {/* Active Partnerships */}
        {partnerships?.active && partnerships.active.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Active Partners</ThemedText>
            {partnerships.active.map(renderPartnershipCard)}
          </View>
        )}

        {/* Pending Partnerships */}
        {partnerships?.pending && partnerships.pending.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Pending Partners</ThemedText>
            {partnerships.pending.map(renderPartnershipCard)}
          </View>
        )}

        {/* Empty State */}
        {(!partnerships?.active || partnerships.active.length === 0) &&
          (!partnerships?.pending || partnerships.pending.length === 0) && (
            <EmptyState
              icon="users"
              title="No Partners Yet"
              message="Invite a partner to start sharing photos automatically."
            />
          )}
      </ScrollView>

      {/* Invite Modal */}
      {showInviteModal && (
        <View style={styles.modalOverlay}>
          <Card style={styles.modal}>
            <ThemedText style={styles.modalTitle}>Invite Partner</ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              Enter your partner's email address
            </ThemedText>

            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              placeholder="partner@example.com"
              placeholderTextColor={theme.textSecondary}
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={[
                styles.input,
                styles.textArea,
                { color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Optional message..."
              placeholderTextColor={theme.textSecondary}
              value={inviteMessage}
              onChangeText={setInviteMessage}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <Button
                variant="outline"
                onPress={() => {
                  setShowInviteModal(false);
                  setInviteEmail("");
                  setInviteMessage("");
                }}
                style={styles.modalButton}
              >
                <ThemedText>Cancel</ThemedText>
              </Button>
              <Button
                onPress={handleCreateInvitation}
                disabled={createInvitationMutation.isPending}
                style={styles.modalButton}
              >
                <ThemedText>
                  {createInvitationMutation.isPending ? "Sending..." : "Send"}
                </ThemedText>
              </Button>
            </View>
          </Card>
        </View>
      )}

      {/* Rule Management Modal */}
      {showRuleModal && (
        <View style={styles.modalOverlay}>
          <Card style={styles.modal}>
            <ThemedText style={styles.modalTitle}>Auto-Share Rules</ThemedText>
            <ThemedText style={styles.modalSubtitle}>
              Manage automatic photo sharing rules
            </ThemedText>

            {/* Existing Rules */}
            {rulesData?.rules && rulesData.rules.length > 0 && (
              <View style={styles.rulesList}>
                {rulesData.rules.map((rule) => (
                  <View key={rule.id} style={styles.ruleItem}>
                    <View style={styles.ruleHeader}>
                      <ThemedText style={styles.ruleName}>{rule.name}</ThemedText>
                      <View style={styles.ruleToggle}>
                        <Button
                          variant={rule.isActive ? "primary" : "outline"}
                          size="small"
                          onPress={() => handleToggleRule(rule)}
                          style={styles.toggleButton}
                        >
                          <ThemedText style={styles.toggleText}>
                            {rule.isActive ? "Active" : "Inactive"}
                          </ThemedText>
                        </Button>
                      </View>
                    </View>
                    <ThemedText style={styles.ruleType}>
                      Type: {rule.ruleType.replace("_", " ")}
                    </ThemedText>
                    <ThemedText style={styles.ruleCreator}>
                      Created by {rule.createdBy}
                    </ThemedText>
                    <Button
                      variant="outline"
                      size="small"
                      onPress={() => handleDeleteRule(rule)}
                      style={styles.deleteButton}
                    >
                      <Feather name="trash-2" size={14} color={theme.error} />
                      <ThemedText style={[styles.deleteText, { color: theme.error }]}>
                        Delete
                      </ThemedText>
                    </Button>
                  </View>
                ))}
              </View>
            )}

            {/* Create New Rule */}
            <View style={styles.createRuleSection}>
              <ThemedText style={styles.sectionTitle}>Create New Rule</ThemedText>
              
              {!showCreateRuleForm ? (
                <Button
                  variant="outline"
                  onPress={() => setShowCreateRuleForm(true)}
                  style={styles.createRuleButton}
                >
                  <Feather name="plus" size={16} color={theme.primary} />
                  <ThemedText style={styles.createRuleText}>
                    Create New Rule
                  </ThemedText>
                </Button>
              ) : (
                <View style={styles.createRuleForm}>
                  <TextInput
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    placeholder="Rule name"
                    placeholderTextColor={theme.textSecondary}
                    value={newRule.name}
                    onChangeText={(text) => setNewRule({ ...newRule, name: text })}
                  />

                  <View style={styles.ruleTypeSelector}>
                    <ThemedText style={styles.label}>Rule Type:</ThemedText>
                    <View style={styles.ruleTypeButtons}>
                      {["all_photos", "favorites_only", "date_range", "people"].map((type) => (
                        <Button
                          key={type}
                          variant={newRule.ruleType === type ? "primary" : "outline"}
                          size="small"
                          onPress={() => setNewRule({ ...newRule, ruleType: type as any })}
                          style={styles.ruleTypeButton}
                        >
                          <ThemedText style={styles.ruleTypeButtonText}>
                            {type.replace("_", " ")}
                          </ThemedText>
                        </Button>
                      ))}
                    </View>
                  </View>

                  <View style={styles.modalActions}>
                    <Button
                      variant="outline"
                      onPress={() => {
                        setShowCreateRuleForm(false);
                        setNewRule({
                          name: "",
                          ruleType: "all_photos",
                          criteria: {
                            favoritesOnly: false,
                            excludeTags: [],
                            minQuality: 50,
                          },
                          priority: 0,
                        });
                      }}
                      style={styles.modalButton}
                    >
                      <ThemedText>Cancel</ThemedText>
                    </Button>
                    <Button
                      onPress={handleCreateRule}
                      disabled={createRuleMutation.isPending}
                      style={styles.modalButton}
                    >
                      <ThemedText>
                        {createRuleMutation.isPending ? "Creating..." : "Create"}
                      </ThemedText>
                    </Button>
                  </View>
                </View>
              )}
            </View>

            {/* Close Modal */}
            <View style={styles.modalActions}>
              <Button
                variant="outline"
                onPress={() => {
                  setShowRuleModal(false);
                  setShowCreateRuleForm(false);
                  setSelectedPartnership(null);
                }}
                style={styles.modalButton}
              >
                <ThemedText>Close</ThemedText>
              </Button>
            </View>
          </Card>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  statsCard: {
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
  },
  quickActions: {
    marginBottom: Spacing.xl,
  },
  actionCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    alignItems: "flex-start",
  },
  actionCardOutline: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  actionCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "white",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  actionCardSubtitle: {
    fontSize: 14,
    opacity: 0.8,
    color: "white",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  card: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  status: {
    fontSize: 12,
    fontWeight: "500",
  },
  partnerIcon: {
    marginLeft: Spacing.md,
  },
  cardActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
  },
  actionText: {
    fontSize: 12,
    marginLeft: Spacing.xs,
  },
  acceptedDate: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: Spacing.sm,
  },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modal: {
    width: "100%",
    maxWidth: 400,
    padding: Spacing.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  modalSubtitle: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.md,
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  modalButton: {
    flex: 1,
  },
  // Rule Management Styles
  rulesList: {
    maxHeight: 200,
    marginBottom: Spacing.lg,
  },
  ruleItem: {
    backgroundColor: "#f8f9fa",
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  ruleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  ruleName: {
    fontSize: 16,
    fontWeight: "600",
    flex: 1,
  },
  ruleToggle: {
    marginLeft: Spacing.sm,
  },
  toggleButton: {
    paddingHorizontal: Spacing.sm,
  },
  toggleText: {
    fontSize: 12,
  },
  ruleType: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: Spacing.xs,
  },
  ruleCreator: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: Spacing.sm,
  },
  deleteButton: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
  },
  deleteText: {
    fontSize: 12,
    marginLeft: Spacing.xs,
  },
  createRuleSection: {
    borderTopWidth: 1,
    borderTopColor: "#e5e5e5",
    paddingTop: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  createRuleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  createRuleText: {
    fontSize: 14,
    marginLeft: Spacing.sm,
  },
  createRuleForm: {
    gap: Spacing.md,
  },
  ruleTypeSelector: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
  },
  ruleTypeButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  ruleTypeButton: {
    paddingHorizontal: Spacing.sm,
  },
  ruleTypeButtonText: {
    fontSize: 12,
  },
});
