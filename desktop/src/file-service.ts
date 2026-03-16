import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface FileEvent {
  path: string;
  event_type: string;
  timestamp: number;
}

export class DesktopFileService {
  private static instance: DesktopFileService;
  private eventListeners: Map<string, (event: FileEvent) => void> = new Map();
  private supportedExtensions: string[] = [];

  static getInstance(): DesktopFileService {
    if (!DesktopFileService.instance) {
      DesktopFileService.instance = new DesktopFileService();
    }
    return DesktopFileService.instance;
  }

  async initialize(): Promise<void> {
    try {
      this.supportedExtensions = await invoke<string[]>('get_supported_extensions');
    } catch (error) {
      console.error('Failed to get supported extensions:', error);
      this.supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff'];
    }
  }

  async startWatching(path: string): Promise<void> {
    try {
      await invoke('start_file_watch', { path });
      this.setupEventListeners();
    } catch (error) {
      console.error('Failed to start file watching:', error);
      throw error;
    }
  }

  async stopWatching(path: string): Promise<void> {
    try {
      await invoke('stop_file_watch', { path });
    } catch (error) {
      console.error('Failed to stop file watching:', error);
      throw error;
    }
  }

  private setupEventListeners(): void {
    listen('file-change', (event) => {
      this.notifyListeners(event.payload as FileEvent);
    });
  }

  onFileChange(id: string, callback: (event: FileEvent) => void): void {
    this.eventListeners.set(id, callback);
  }

  offFileChange(id: string): void {
    this.eventListeners.delete(id);
  }

  private notifyListeners(event: FileEvent): void {
    this.eventListeners.forEach(callback => callback(event));
  }

  getSupportedExtensions(): string[] {
    return this.supportedExtensions;
  }

  isSupportedFile(filename: string): boolean {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension ? this.supportedExtensions.includes(extension) : false;
  }

  // Desktop-specific file operations
  async showOpenDialog(options: {
    multiple?: boolean;
    directory?: boolean;
    filters?: Array<{
      name: string;
      extensions: string[];
    }>;
  }): Promise<string[]> {
    try {
      return await invoke<string[]>('show_file_dialog', { directory: !!options.directory });
    } catch (error) {
      console.error('Failed to show open dialog:', error);
      return [];
    }
  }

  async showSaveDialog(options: {
    defaultPath?: string;
    filters?: Array<{
      name: string;
      extensions: string[];
    }>;
  }): Promise<string | null> {
    // For now, use open dialog as placeholder
    const paths = await this.showOpenDialog({ directory: false });
    return paths.length > 0 ? paths[0] : null;
  }

  async showNotification(title: string, body: string): Promise<void> {
    try {
      await invoke('show_notification', { title, body });
    } catch (error) {
      console.error('Failed to show notification:', error);
    }
  }

  async minimizeToTray(): Promise<void> {
    try {
      await invoke('minimize_to_tray');
    } catch (error) {
      console.error('Failed to minimize to tray:', error);
    }
  }

  async restoreFromTray(): Promise<void> {
    try {
      await invoke('restore_from_tray');
    } catch (error) {
      console.error('Failed to restore from tray:', error);
    }
  }

  // Utility methods for file operations
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  getFileName(path: string): string {
    return path.split(/[\\/]/).pop() || '';
  }

  getFileDirectory(path: string): string {
    const parts = path.split(/[\\/]/);
    return parts.slice(0, -1).join('/') || '';
  }
}
