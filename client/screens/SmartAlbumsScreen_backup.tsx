// AI-META-BEGIN
// AI-META: Smart Albums Screen - React Native UI for smart album management
// OWNERSHIP: client/screens/SmartAlbumsScreen
// ENTRYPOINTS: App navigation
// DEPENDENCIES: react, react-native, react-query, react-navigation
// DANGER: UI components may require platform-specific styling
// CHANGE-SAFETY: Adding new UI elements is safe; changing layout affects user experience
// TESTS: client/screens/SmartAlbumsScreen.test.tsx
// AI-META-END

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

// Types
interface SmartAlbum {
  id: string;
  userId: string;
  albumType: 'people' | 'places' | 'things' | 'special';
  title: string;
  description: string;
  criteria: any;
  coverPhotoId?: string;
  coverPhotoUri?: string;
  photoCount: number;
  isPinned: boolean;
  isHidden: boolean;
  lastUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface SmartAlbumsResponse {
  albums: SmartAlbum[];
  total: number;
}

// API service
const smartAlbumsAPI = {
  getSmartAlbums: async (): Promise<SmartAlbumsResponse> => {
    const response = await fetch('/api/smart-albums');
    if (!response.ok) {
      throw new Error('Failed to fetch smart albums');
    }
    const data = await response.json();
    return data.data;
  },

  generateSmartAlbums: async (): Promise<SmartAlbumsResponse> => {
    const response = await fetch('/api/smart-albums/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to generate smart albums');
    }
    const data = await response.json();
    return data.data;
  },

  updateSmartAlbum: async (id: string, settings: { isPinned?: boolean; isHidden?: boolean }) => {
    const response = await fetch(`/api/smart-albums/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      throw new Error('Failed to update smart album');
    }
    const data = await response.json();
    return data.data.album;
  },

  hideSmartAlbum: async (id: string) => {
    const response = await fetch(`/api/smart-albums/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to hide smart album');
    }
    const data = await response.json();
    return data.data.album;
  },
};

// Album type icons
const getAlbumIcon = (type: string) => {
  switch (type) {
    case 'people':
      return 'people';
    case 'places':
      return 'location';
    case 'things':
      return 'pricetag';
    case 'special':
      return 'star';
    default:
      return 'folder';
  }
};

// Album type colors
const getAlbumColor = (type: string) => {
  switch (type) {
    case 'people':
      return '#FF6B6B';
    case 'places':
      return '#4ECDC4';
    case 'things':
      return '#45B7D1';
    case 'special':
      return '#FFA07A';
    default:
      return '#95A5A6';
  }
};

const SmartAlbumsScreen: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Fetch smart albums
  const {
    data: albumsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['smartAlbums'],
    queryFn: smartAlbumsAPI.getSmartAlbums,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Generate smart albums mutation
  const generateMutation = useMutation({
    mutationFn: smartAlbumsAPI.generateSmartAlbums,
    onSuccess: (data) => {
      queryClient.setQueryData(['smartAlbums'], data);
      Alert.alert('Success', `Generated ${data.total} smart albums`);
    },
    onError: (error) => {
      Alert.alert('Error', 'Failed to generate smart albums');
    },
  });

  // Update smart album mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, settings }: { id: string; settings: any }) =>
      smartAlbumsAPI.updateSmartAlbum(id, settings),
    onSuccess: () => {
      queryClient.invalidateQueries(['smartAlbums']);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to update smart album');
    },
  });

  // Hide smart album mutation
  const hideMutation = useMutation({
    mutationFn: smartAlbumsAPI.hideSmartAlbum,
    onSuccess: () => {
      queryClient.invalidateQueries(['smartAlbums']);
      setSelectedAlbum(null);
    },
    onError: () => {
      Alert.alert('Error', 'Failed to hide smart album');
    },
  });

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Handle generate albums
  const handleGenerateAlbums = useCallback(() => {
    Alert.alert(
      'Generate Smart Albums',
      'This will analyze your photos and create smart albums based on people, places, and things. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          style: 'default',
          onPress: () => generateMutation.mutate(),
        },
      ]
    );
  }, [generateMutation]);

  // Handle toggle pin
  const handleTogglePin = useCallback((album: SmartAlbum) => {
    updateMutation.mutate({
      id: album.id,
      settings: { isPinned: !album.isPinned },
    });
  }, [updateMutation]);

  // Handle hide album
  const handleHideAlbum = useCallback((album: SmartAlbum) => {
    Alert.alert(
      'Hide Smart Album',
      `Are you sure you want to hide "${album.title}"? You can unhide it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Hide',
          style: 'destructive',
          onPress: () => hideMutation.mutate(album.id),
        },
      ]
    );
  }, [hideMutation]);

  // Group albums by type
  const groupedAlbums = React.useMemo(() => {
    if (!albumsData?.albums) return {};
    
    return albumsData.albums.reduce((acc, album) => {
      if (!album.isHidden) {
        if (!acc[album.albumType]) {
          acc[album.albumType] = [];
        }
        acc[album.albumType].push(album);
      }
      return acc;
    }, {} as Record<string, SmartAlbum[]>);
  }, [albumsData]);

  // Sort albums within each group (pinned first, then by photo count)
  const sortedGroupedAlbums = React.useMemo(() => {
    const result: Record<string, SmartAlbum[]> = {};
    
    Object.entries(groupedAlbums).forEach(([type, albums]) => {
      result[type] = albums.sort((a, b) => {
        // Pinned albums first
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        // Then by photo count (descending)
        return b.photoCount - a.photoCount;
      });
    });
    
    return result;
  }, [groupedAlbums]);

  // Render album card
  const renderAlbumCard = useCallback((album: SmartAlbum) => {
    const isSelected = selectedAlbum === album.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.albumCard,
          isSelected && styles.selectedAlbumCard,
          album.isPinned && styles.pinnedAlbumCard,
        ]}
        onPress={() => setSelectedAlbum(isSelected ? null : album.id)}
        activeOpacity={0.7}
      >
        <View style={styles.albumCover}>
          {album.coverPhotoUri ? (
            <Image
              source={{ uri: album.coverPhotoUri }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.coverPlaceholder,
                { backgroundColor: getAlbumColor(album.albumType) },
              ]}
            >
              <Ionicons
                name={getAlbumIcon(album.albumType)}
                size={32}
                color="#FFFFFF"
              />
            </View>
          )}
          {album.isPinned && (
            <View style={styles.pinnedBadge}>
              <Ionicons name="pin" size={12} color="#FFFFFF" />
            </View>
          )}
        </View>
        
        <View style={styles.albumInfo}>
          <Text style={styles.albumTitle} numberOfLines={1}>
            {album.title}
          </Text>
          <Text style={styles.albumDescription} numberOfLines={2}>
            {album.description}
          </Text>
          <Text style={styles.photoCount}>
            {album.photoCount.toLocaleString()} photos
          </Text>
        </View>
        
        {isSelected && (
          <View style={styles.albumActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleTogglePin(album)}
            >
              <Ionicons
                name={album.isPinned ? 'pin-off' : 'pin'}
                size={20}
                color="#666666"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => handleHideAlbum(album)}
            >
              <Ionicons name="eye-off" size={20} color="#666666" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }, [selectedAlbum, handleTogglePin, handleHideAlbum]);

  // Render album section
  const renderAlbumSection = useCallback(([type, albums]: [string, SmartAlbum[]]) => {
    const typeTitles = {
      people: 'People',
      places: 'Places',
      things: 'Things',
      special: 'Special',
    };

    return (
      <View key={type} style={styles.albumSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleContainer}>
            <Ionicons
              name={getAlbumIcon(type)}
              size={20}
              color={getAlbumColor(type)}
            />
            <Text style={styles.sectionTitle}>{typeTitles[type as keyof typeof typeTitles]}</Text>
          </View>
          <Text style={styles.sectionCount}>{albums.length} albums</Text>
        </View>
        
        <FlatList
          data={albums}
          renderItem={({ item }) => renderAlbumCard(item)}
          keyExtractor={([type]) => type}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.horizontalList}
        />
      </View>
    );
  }, [renderAlbumCard]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading smart albums...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color="#FF3B30" />
        <Text style={styles.errorText}>Failed to load smart albums</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => refetch()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const albumSections = Object.entries(sortedGroupedAlbums);
  const hasAlbums = albumSections.length > 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Smart Albums</Text>
        <TouchableOpacity
          style={styles.generateButton}
          onPress={handleGenerateAlbums}
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="refresh" size={20} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {hasAlbums ? (
        <FlatList
          data={albumSections}
          renderItem={({ item }) => renderAlbumSection(item)}
          keyExtractor(([type]) => type}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open" size={64} color="#C7C7CC" />
          <Text style={styles.emptyTitle}>No Smart Albums</Text>
          <Text style={styles.emptyDescription}>
            Generate smart albums to automatically organize your photos by people, places, and things.
          </Text>
          <TouchableOpacity style={styles.generateEmptyButton} onPress={handleGenerateAlbums}>
            <Text style={styles.generateEmptyButtonText}>Generate Smart Albums</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000000',
  },
  generateButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingVertical: 8,
  },
  albumSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginLeft: 8,
  },
  sectionCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  horizontalList: {
    paddingLeft: 16,
    paddingRight: 8,
  },
  albumCard: {
    width: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginRight: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedAlbumCard: {
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  pinnedAlbumCard: {
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  albumCover: {
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinnedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFD700',
    borderRadius: 12,
    padding: 4,
  },
  albumInfo: {
    padding: 12,
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  albumDescription: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
  },
  photoCount: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  albumActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  actionButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
  },
  emptyDescription: {
    marginTop: 8,
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 22,
  },
  generateEmptyButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  generateEmptyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default SmartAlbumsScreen;

