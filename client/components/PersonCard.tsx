// AI-META-BEGIN
// AI-META: Person card component with avatar, management actions, and privacy controls
// OWNERSHIP: client/components (face recognition)
// ENTRYPOINTS: imported by PeopleScreen and person management interfaces
// DEPENDENCIES: expo-image, react-native-gesture-handler, @tanstack/react-query
// DANGER: Biometric data display - requires privacy controls and user consent indicators
// CHANGE-SAFETY: Maintain card layout structure, ensure proper accessibility
// TESTS: client/components/PersonCard.test.tsx
// AI-META-END

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  apiRequest,
  AuthenticationError,
  ValidationError,
  NetworkError,
  ServerError,
} from '@/lib/query-client';
import { useTheme } from '@/hooks/useTheme';
import { Spacing } from '@/constants/theme';

// Types
interface Person {
  id: string;
  name: string | null;
  faceCount: number;
  clusterQuality: number;
  isPinned: boolean;
  isHidden: boolean;
  sampleEmbeddings: number[][];
  createdAt: number;
  updatedAt: number;
}

interface PersonCardProps {
  person: Person;
  onPress?: (person: Person) => void;
  onRename?: (personId: string, newName: string) => void;
  onTogglePin?: (personId: string, isPinned: boolean) => void;
  onToggleHide?: (personId: string, isHidden: boolean) => void;
  onDelete?: (personId: string) => void;
  onMerge?: (sourcePersonId: string, targetPersonId: string) => void;
  showActions?: boolean;
  compact?: boolean;
}

export default function PersonCard({
  person,
  onPress,
  onRename,
  onTogglePin,
  onToggleHide,
  onDelete,
  onMerge,
  showActions = true,
  compact = false,
}: PersonCardProps) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  // State for modals and interactions
  const [renameModalVisible, setRenameModalVisible] = useState(false);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [newName, setNewName] = useState(person.name || '');
  const [targetPersonId, setTargetPersonId] = useState('');

  // ═══════════════════════════════════════════════════════════
  // MUTATIONS
  // ═══════════════════════════════════════════════════════════

  const renameMutation = useMutation({
    mutationFn: async (data: { personId: string; name: string }) => {
      const response = await apiRequest(`/api/faces/people/${data.personId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: data.name }),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setRenameModalVisible(false);
      onRename?.(variables.personId, variables.name);
    },
    onError: (error) => {
      console.error('PersonCard: Rename failed:', error);
      Alert.alert('Error', getErrorMessage(error));
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async (data: { personId: string; isPinned: boolean }) => {
      const response = await apiRequest(`/api/faces/people/${data.personId}`, {
        method: 'PUT',
        body: JSON.stringify({ isPinned: data.isPinned }),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      onTogglePin?.(variables.personId, variables.isPinned);
    },
    onError: (error) => {
      console.error('PersonCard: Toggle pin failed:', error);
      Alert.alert('Error', getErrorMessage(error));
    },
  });

  const toggleHideMutation = useMutation({
    mutationFn: async (data: { personId: string; isHidden: boolean }) => {
      const response = await apiRequest(`/api/faces/people/${data.personId}`, {
        method: 'PUT',
        body: JSON.stringify({ isHidden: data.isHidden }),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      onToggleHide?.(variables.personId, variables.isHidden);
    },
    onError: (error) => {
      console.error('PersonCard: Toggle hide failed:', error);
      Alert.alert('Error', getErrorMessage(error));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (personId: string) => {
      const response = await apiRequest(`/api/faces/people/${personId}`, {
        method: 'DELETE',
      });
      return response;
    },
    onSuccess: (_, personId) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      onDelete?.(personId);
    },
    onError: (error) => {
      console.error('PersonCard: Delete failed:', error);
      Alert.alert('Error', getErrorMessage(error));
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async (data: { sourcePersonId: string; targetPersonId: string }) => {
      const response = await apiRequest(`/api/faces/people/${data.sourcePersonId}/merge`, {
        method: 'PUT',
        body: JSON.stringify({ targetPersonId: data.targetPersonId }),
      });
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      setMergeModalVisible(false);
      onMerge?.(variables.sourcePersonId, variables.targetPersonId);
    },
    onError: (error) => {
      console.error('PersonCard: Merge failed:', error);
      Alert.alert('Error', getErrorMessage(error));
    },
  });

  // ═══════════════════════════════════════════════════════════
  // ERROR HANDLING
  // ═══════════════════════════════════════════════════════════

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof AuthenticationError) {
      return 'Session expired. Please log in again.';
    }
    if (error instanceof NetworkError) {
      return 'No internet connection. Please try again.';
    }
    if (error instanceof ServerError) {
      return 'Server error. Please try again later.';
    }
    if (error instanceof ValidationError) {
      return `Validation error: ${error.validationDetails.map((d) => d.message).join(', ')}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'An unknown error occurred.';
  };

  // ═══════════════════════════════════════════════════════════
  // EVENT HANDLERS
  // ═══════════════════════════════════════════════════════════

  const handlePress = () => {
    onPress?.(person);
  };

  const handleRename = () => {
    setRenameModalVisible(true);
  };

  const handleRenameSubmit = () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Please enter a valid name.');
      return;
    }

    renameMutation.mutate({
      personId: person.id,
      name: newName.trim(),
    });
  };

  const handleTogglePin = () => {
    togglePinMutation.mutate({
      personId: person.id,
      isPinned: !person.isPinned,
    });
  };

  const handleToggleHide = () => {
    toggleHideMutation.mutate({
      personId: person.id,
      isHidden: !person.isHidden,
    });
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Person',
      `Are you sure you want to delete "${person.name || 'this person'}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMutation.mutate(person.id),
        },
      ]
    );
  };

  const handleMerge = () => {
    setMergeModalVisible(true);
  };

  const handleMergeSubmit = () => {
    if (!targetPersonId.trim() || targetPersonId === person.id) {
      Alert.alert('Error', 'Please select a valid person to merge with.');
      return;
    }

    mergeMutation.mutate({
      sourcePersonId: person.id,
      targetPersonId: targetPersonId.trim(),
    });
  };

  const showActionMenu = () => {
    const options = [
      person.name ? 'Rename' : 'Name',
      person.isPinned ? 'Unpin' : 'Pin',
      person.isHidden ? 'Show' : 'Hide',
      'Merge with...',
      'Delete',
      'Cancel',
    ];

    Alert.alert(
      person.name || 'Unnamed Person',
      `${person.faceCount} photos • Quality: ${Math.round(person.clusterQuality * 100)}%`,
      options.map((option, index) => ({
        text: option,
        style: option === 'Delete' ? 'destructive' : 'default',
        onPress: () => {
          switch (option) {
            case person.name ? 'Rename' : 'Name':
              handleRename();
              break;
            case person.isPinned ? 'Unpin' : 'Pin':
              handleTogglePin();
              break;
            case person.isHidden ? 'Show' : 'Hide':
              handleToggleHide();
              break;
            case 'Merge with...':
              handleMerge();
              break;
            case 'Delete':
              handleDelete();
              break;
            // Cancel does nothing
          }
        },
      }))
    );
  };

  // ═══════════════════════════════════════════════════════════
  // RENDER METHODS
  // ═══════════════════════════════════════════════════════════

  const renderAvatar = () => {
    // In a real implementation, this would show a composite of face images
    // For now, we'll show a placeholder with initials
    const initials = person.name
      ? person.name
          .split(' ')
          .map(word => word[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)
      : '?';

    return (
      <View style={[styles.avatar, { backgroundColor: theme.colors.primary }]}>
        <Text style={[styles.avatarText, { color: theme.colors.background }]}>
          {initials}
        </Text>
      </View>
    );
  };

  const renderContent = () => {
    if (compact) {
      return (
        <View style={styles.compactContent}>
          <Text
            style={[
              styles.compactName,
              { color: theme.colors.text },
              person.isPinned && styles.pinnedText,
            ]}
            numberOfLines={1}
          >
            {person.name || 'Unnamed'}
          </Text>
          <Text style={[styles.compactCount, { color: theme.colors.textSecondary }]}>
            {person.faceCount} photos
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.content}>
        <View style={styles.header}>
          <Text
            style={[
              styles.name,
              { color: theme.colors.text },
              person.isPinned && styles.pinnedText,
            ]}
            numberOfLines={1}
          >
            {person.name || 'Unnamed'}
          </Text>
          {person.isPinned && (
            <Feather name="pin" size={16} color={theme.colors.primary} />
          )}
        </View>
        
        <Text style={[styles.count, { color: theme.colors.textSecondary }]}>
          {person.faceCount} photos
        </Text>
        
        <View style={styles.qualityBar}>
          <View style={styles.qualityBarBackground}>
            <View
              style={[
                styles.qualityBarFill,
                {
                  width: `${person.clusterQuality * 100}%`,
                  backgroundColor: person.clusterQuality > 0.8 
                    ? theme.colors.success 
                    : person.clusterQuality > 0.6 
                    ? theme.colors.warning 
                    : theme.colors.error,
                },
              ]}
            />
          </View>
          <Text style={[styles.qualityText, { color: theme.colors.textSecondary }]}>
            {Math.round(person.clusterQuality * 100)}%
          </Text>
        </View>
      </View>
    );
  };

  const renderActions = () => {
    if (!showActions || compact) return null;

    return (
      <TouchableOpacity
        style={[styles.actionsButton, { borderColor: theme.colors.border }]}
        onPress={showActionMenu}
      >
        <Feather name="more-vertical" size={20} color={theme.colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <TouchableOpacity
      style={[
        styles.container,
        compact && styles.compactContainer,
        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
        person.isHidden && styles.hiddenContainer,
      ]}
      onPress={handlePress}
      disabled={person.isHidden}
    >
      {renderAvatar()}
      {renderContent()}
      {renderActions()}

      {/* Rename Modal */}
      <Modal
        visible={renameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setRenameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Rename Person
            </Text>
            
            <TextInput
              style={[
                styles.textInput,
                { 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Enter name"
              placeholderTextColor={theme.colors.textSecondary}
              autoFocus
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setRenameModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  { backgroundColor: theme.colors.primary },
                ]}
                onPress={handleRenameSubmit}
                disabled={renameMutation.isPending}
              >
                {renameMutation.isPending ? (
                  <ActivityIndicator size="small" color={theme.colors.background} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: theme.colors.background }]}>
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
          <View style={[styles.modalContent, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
              Merge Person
            </Text>
            
            <Text style={[styles.modalDescription, { color: theme.colors.textSecondary }]}>
              Merge "{person.name || 'this person'}" with another person. The source person will be removed.
            </Text>
            
            <TextInput
              style={[
                styles.textInput,
                { 
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.border,
                  color: theme.colors.text,
                },
              ]}
              value={targetPersonId}
              onChangeText={setTargetPersonId}
              placeholder="Enter target person ID"
              placeholderTextColor={theme.colors.textSecondary}
              autoFocus
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setMergeModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: theme.colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.confirmButton,
                  { backgroundColor: theme.colors.warning },
                ]}
                onPress={handleMergeSubmit}
                disabled={mergeMutation.isPending}
              >
                {mergeMutation.isPending ? (
                  <ActivityIndicator size="small" color={theme.colors.background} />
                ) : (
                  <Text style={[styles.modalButtonText, { color: theme.colors.background }]}>
                    Merge
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </TouchableOpacity>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.sm,
    marginVertical: Spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
  },
  compactContainer: {
    padding: Spacing.sm,
    marginHorizontal: Spacing.xs,
    marginVertical: 2,
  },
  hiddenContainer: {
    opacity: 0.6,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  compactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: Spacing.sm,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  compactContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  compactName: {
    fontSize: 14,
    fontWeight: '600',
  },
  pinnedText: {
    fontStyle: 'italic',
  },
  count: {
    fontSize: 14,
    marginBottom: 8,
  },
  compactCount: {
    fontSize: 12,
  },
  qualityBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  qualityBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    marginRight: 8,
  },
  qualityBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  qualityText: {
    fontSize: 12,
    minWidth: 35,
    textAlign: 'right',
  },
  actionsButton: {
    padding: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    borderRadius: 12,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  modalDescription: {
    fontSize: 14,
    marginBottom: Spacing.lg,
    textAlign: 'center',
    lineHeight: 20,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: Spacing.md,
    fontSize: 16,
    marginBottom: Spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  modalButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  confirmButton: {
    borderRadius: 8,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
