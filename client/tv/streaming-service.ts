// AI-META-BEGIN
// AI-META: Adaptive streaming service for TV platforms with HLS/DASH support
// OWNERSHIP: client/tv/streaming
// DEPENDENCIES: react-native-video, expo-av, network detection
// DANGER: streaming performance impacts user experience; handle network changes gracefully
// CHANGE-SAFETY: safe to add new streaming formats; ensure backward compatibility
// TESTS: test with various network conditions; verify adaptive bitrate switching
// AI-META-END

import { AppState, AppStateStatus, Platform } from 'react-native';
import { Audio, Video } from 'expo-av';
import * as Network from 'expo-network';

export interface StreamQuality {
  bitrate: number;
  resolution: {
    width: number;
    height: number;
  };
  label: string;
}

export interface StreamConfig {
  url: string;
  format: 'hls' | 'dash';
  qualities: StreamQuality[];
  fallbackQuality?: StreamQuality;
}

export interface StreamingState {
  isPlaying: boolean;
  isLoading: boolean;
  currentQuality: StreamQuality | null;
  bufferHealth: number;
  networkSpeed: number;
  error: string | null;
}

class TVStreamingService {
  private videoRef: Video | null = null;
  private audioRef: Audio | null = null;
  private networkMonitor: NodeJS.Timeout | null = null;
  private state: StreamingState;
  private config: StreamConfig | null = null;
  private listeners: ((state: StreamingState) => void)[] = [];

  constructor() {
    this.state = {
      isPlaying: false,
      isLoading: false,
      currentQuality: null,
      bufferHealth: 0,
      networkSpeed: 0,
      error: null,
    };

    // Monitor app state for proper resource management
    AppState.addEventListener('change', this.handleAppStateChange.bind(this));
    this.startNetworkMonitoring();
  }

  /**
   * Initialize streaming with configuration
   */
  async initialize(config: StreamConfig): Promise<void> {
    this.config = config;
    this.updateState({ isLoading: true });

    try {
      // Validate stream format support
      if (config.format === 'dash' && Platform.OS === 'ios') {
        throw new Error('DASH format not fully supported on iOS, use HLS instead');
      }

      // Set up video player with streaming optimizations
      await this.setupVideoPlayer();
      this.updateState({ isLoading: false });
    } catch (error) {
      this.updateState({ 
        error: error instanceof Error ? error.message : 'Failed to initialize streaming',
        isLoading: false 
      });
      throw error;
    }
  }

  /**
   * Set up video player with TV-specific optimizations
   */
  private async setupVideoPlayer(): Promise<void> {
    if (!this.config) throw new Error('Stream configuration not set');

    // Configure video for TV playback
    await Video.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });

    // Set initial quality based on network speed
    const initialQuality = this.selectOptimalQuality(this.state.networkSpeed);
    this.updateState({ currentQuality: initialQuality });
  }

  /**
   * Start playback with adaptive streaming
   */
  async play(): Promise<void> {
    if (!this.config || !this.videoRef) {
      throw new Error('Streaming not properly initialized');
    }

    try {
      this.updateState({ isLoading: true });

      await this.videoRef.playAsync();
      this.updateState({ 
        isPlaying: true, 
        isLoading: false,
        error: null 
      });

      // Start adaptive quality monitoring
      this.startAdaptiveMonitoring();
    } catch (error) {
      this.updateState({ 
        error: error instanceof Error ? error.message : 'Failed to start playback',
        isLoading: false 
      });
      throw error;
    }
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (!this.videoRef) return;

    try {
      await this.videoRef.pauseAsync();
      this.updateState({ isPlaying: false });
    } catch (error) {
      console.error('Failed to pause playback:', error);
    }
  }

  /**
   * Stop playback and clean up resources
   */
  async stop(): Promise<void> {
    if (!this.videoRef) return;

    try {
      await this.videoRef.stopAsync();
      this.updateState({ 
        isPlaying: false, 
        currentQuality: null,
        error: null 
      });
    } catch (error) {
      console.error('Failed to stop playback:', error);
    }
  }

  /**
   * Set video reference for control
   */
  setVideoRef(videoRef: Video): void {
    this.videoRef = videoRef;
  }

  /**
   * Set audio reference for control
   */
  setAudioRef(audioRef: Audio): void {
    this.audioRef = audioRef;
  }

  /**
   * Get current streaming state
   */
  getState(): StreamingState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: StreamingState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Start network speed monitoring
   */
  private startNetworkMonitoring(): void {
    this.networkMonitor = setInterval(async () => {
      try {
        const networkState = await Network.getNetworkStateAsync();
        let networkSpeed = 0;

        // Estimate network speed based on connection type
        if (networkState.isConnected && networkState.type) {
          switch (networkState.type) {
            case Network.NetworkStateType.WIFI:
              networkSpeed = 20000; // 20 Mbps estimate
              break;
            case Network.NetworkStateType.CELLULAR:
              networkSpeed = 5000; // 5 Mbps estimate
              break;
            default:
              networkSpeed = 1000; // 1 Mbps fallback
          }
        }

        if (networkSpeed !== this.state.networkSpeed) {
          this.updateState({ networkSpeed });
          this.adaptQuality(networkSpeed);
        }
      } catch (error) {
        console.error('Network monitoring error:', error);
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Start adaptive quality monitoring during playback
   */
  private startAdaptiveMonitoring(): void {
    if (!this.videoRef) return;

    const monitor = setInterval(async () => {
      if (!this.state.isPlaying) {
        clearInterval(monitor);
        return;
      }

      try {
        const status = await this.videoRef.getStatusAsync();
        
        if (status.isLoaded && 'playableDuration' in status && 'position' in status) {
          const bufferHealth = (status.playableDuration || 0) - (status.position || 0);
          this.updateState({ bufferHealth });

          // Adapt quality based on buffer health and network speed
          if (bufferHealth < 2) { // Less than 2 seconds buffered
            this.adaptQuality(this.state.networkSpeed, true); // Prefer lower quality
          } else if (bufferHealth > 10) { // More than 10 seconds buffered
            this.adaptQuality(this.state.networkSpeed, false); // Can try higher quality
          }
        }
      } catch (error) {
        console.error('Adaptive monitoring error:', error);
      }
    }, 2000); // Check every 2 seconds during playback
  }

  /**
   * Adapt streaming quality based on network conditions
   */
  private adaptQuality(networkSpeed: number, preferLower: boolean = false): void {
    if (!this.config) return;

    const optimalQuality = this.selectOptimalQuality(networkSpeed, preferLower);
    
    if (optimalQuality !== this.state.currentQuality) {
      this.updateState({ currentQuality: optimalQuality });
      
      // In a real implementation, this would switch the actual stream
      console.log(`Adapted quality to: ${optimalQuality.label} (${optimalQuality.bitrate} kbps)`);
    }
  }

  /**
   * Select optimal quality based on network speed
   */
  private selectOptimalQuality(networkSpeed: number, preferLower: boolean = false): StreamQuality {
    if (!this.config) {
      throw new Error('Stream configuration not set');
    }

    const sortedQualities = [...this.config.qualities].sort((a, b) => {
      if (preferLower) {
        return a.bitrate - b.bitrate; // Ascending for lower quality preference
      }
      return b.bitrate - a.bitrate; // Descending for higher quality preference
    });

    // Find the best quality for current network speed
    for (const quality of sortedQualities) {
      if (quality.bitrate <= networkSpeed * 0.8) { // Use 80% of available bandwidth
        return quality;
      }
    }

    // Fallback to lowest quality if none fit
    return this.config.fallbackQuality || sortedQualities[sortedQualities.length - 1];
  }

  /**
   * Handle app state changes for resource management
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    if (nextAppState === 'background' && this.state.isPlaying) {
      // Pause playback when app goes to background
      this.pause();
    } else if (nextAppState === 'active' && this.config) {
      // Resume monitoring when app comes to foreground
      this.startNetworkMonitoring();
    }
  }

  /**
   * Update internal state and notify listeners
   */
  private updateState(updates: Partial<StreamingState>): void {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(listener => listener(this.state));
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.networkMonitor) {
      clearInterval(this.networkMonitor);
      this.networkMonitor = null;
    }

    this.stop();
    this.listeners = [];
  }
}

// Singleton instance
export const tvStreamingService = new TVStreamingService();

// Export utilities
export const createStreamConfig = (
  baseUrl: string,
  videoId: string,
  format: 'hls' | 'dash' = 'hls'
): StreamConfig => {
  const qualities: StreamQuality[] = [
    { bitrate: 2000, resolution: { width: 1920, height: 1080 }, label: '1080p' },
    { bitrate: 1000, resolution: { width: 1280, height: 720 }, label: '720p' },
    { bitrate: 500, resolution: { width: 854, height: 480 }, label: '480p' },
    { bitrate: 300, resolution: { width: 640, height: 360 }, label: '360p' },
  ];

  const fallbackQuality = qualities[qualities.length - 1]; // 360p fallback

  let url: string;
  if (format === 'hls') {
    url = `${baseUrl}/streams/${videoId}/playlist.m3u8`;
  } else {
    url = `${baseUrl}/streams/${videoId}/manifest.mpd`;
  }

  return {
    url,
    format,
    qualities,
    fallbackQuality,
  };
};
