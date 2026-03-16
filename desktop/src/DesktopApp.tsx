import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { useDesktopFileWatcher } from './use-file-watcher';
import { DesktopFileService } from './file-service';
import DesktopFileWatcherScreen from './DesktopFileWatcherScreen';
import DragDropZone from './DragDropZone';
import SystemTrayControls from './SystemTrayControls';

interface DroppedFile {
  path: string;
  name: string;
  size?: number;
  type: string;
}

type TabType = 'file-watcher' | 'drag-drop' | 'system-tray' | 'settings';

const DesktopApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('file-watcher');
  const [droppedFiles, setDroppedFiles] = useState<DroppedFile[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const fileService = DesktopFileService.getInstance();

  useEffect(() => {
    const initializeApp = async () => {
      try {
        await fileService.initialize();
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize desktop app:', error);
      }
    };

    initializeApp();
  }, []);

  const handleFilesDropped = (files: DroppedFile[]) => {
    setDroppedFiles(files);
    // Auto-switch to drag-drop tab when files are dropped
    setActiveTab('drag-drop');
  };

  const handleSync = () => {
    // Trigger photo sync
    fileService.showNotification('Sync Started', 'Photo synchronization has begun');
  };

  const handleSettings = () => {
    setActiveTab('settings');
  };

  const renderTabButton = (tab: TabType, title: string, icon: string) => (
    <TouchableOpacity
      style={[
        styles.tabButton,
        activeTab === tab && styles.tabButtonActive
      ]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[
        styles.tabButtonText,
        activeTab === tab && styles.tabButtonTextActive
      ]}>
        {icon} {title}
      </Text>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (!isInitialized) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Initializing Cloud Gallery Desktop...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'file-watcher':
        return <DesktopFileWatcherScreen />;
      case 'drag-drop':
        return (
          <DragDropZone onFilesDropped={handleFilesDropped}>
            <View style={styles.dragDropContent}>
              <Text style={styles.dragDropTitle}>Drag & Drop Photos</Text>
              <Text style={styles.dragDropSubtitle}>
                Drop photos and videos here to import them into your gallery
              </Text>
              <View style={styles.dragDropFeatures}>
                <Text style={styles.featureText}>✓ All common photo formats supported</Text>
                <Text style={styles.featureText}>✓ Automatic duplicate detection</Text>
                <Text style={styles.featureText}>✓ Preserve original quality</Text>
                <Text style={styles.featureText}>✓ Zero-knowledge encryption</Text>
              </View>
            </View>
          </DragDropZone>
        );
      case 'system-tray':
        return <SystemTrayControls onSync={handleSync} onSettings={handleSettings} />;
      case 'settings':
        return (
          <View style={styles.settingsContainer}>
            <Text style={styles.settingsTitle}>Desktop Settings</Text>
            
            <View style={styles.settingSection}>
              <Text style={styles.settingSectionTitle}>File Watching</Text>
              <Text style={styles.settingDescription}>
                Monitor folders for automatic photo sync
              </Text>
            </View>

            <View style={styles.settingSection}>
              <Text style={styles.settingSectionTitle}>System Tray</Text>
              <Text style={styles.settingDescription}>
                Run in background with system tray integration
              </Text>
            </View>

            <View style={styles.settingSection}>
              <Text style={styles.settingSectionTitle}>Notifications</Text>
              <Text style={styles.settingDescription}>
                Get notified about sync events and completed operations
              </Text>
            </View>

            <View style={styles.settingSection}>
              <Text style={styles.settingSectionTitle}>Keyboard Shortcuts</Text>
              <Text style={styles.settingDescription}>
                Global shortcuts for quick access to common actions
              </Text>
            </View>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.appTitle}>Cloud Gallery</Text>
          <Text style={styles.appSubtitle}>Desktop Application</Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={handleSync}>
            <Text style={styles.headerButtonText}>Sync</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerButton} onPress={handleSettings}>
            <Text style={styles.headerButtonText}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {renderTabButton('file-watcher', 'File Watcher', '📁')}
          {renderTabButton('drag-drop', 'Drag & Drop', '📤')}
          {renderTabButton('system-tray', 'System Tray', '🔔')}
          {renderTabButton('settings', 'Settings', '⚙️')}
        </ScrollView>
      </View>

      {/* Content */}
      <View style={styles.contentContainer}>
        {renderContent()}
      </View>

      {/* Status Bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusText}>
          {isInitialized ? '✅ Connected' : '🔄 Initializing...'}
        </Text>
        {droppedFiles.length > 0 && (
          <Text style={styles.statusText}>
            📁 {droppedFiles.length} files ready
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerContent: {
    flex: 1,
  },
  appTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  appSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  headerButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tabContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tabButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#007AFF',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  tabButtonTextActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  dragDropContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  dragDropTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  dragDropSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  dragDropFeatures: {
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#333',
  },
  settingsContainer: {
    flex: 1,
    padding: 20,
  },
  settingsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 20,
  },
  settingSection: {
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  settingSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
  },
  statusBar: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingHorizontal: 20,
    paddingVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
  },
});

export default DesktopApp;
