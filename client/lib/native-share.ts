// AI-META-BEGIN
// AI-META: Native sharing service with multi-photo support and platform-specific optimizations
// OWNERSHIP: client/lib (sharing functionality)
// ENTRYPOINTS: Used by ShareSheet component and PhotoDetailScreen
// DEPENDENCIES: react-native-share, expo-sharing, expo-clipboard, expo-media-library, expo-file-system
// DANGER: File URI handling, platform-specific sharing APIs, permission requirements
// CHANGE-SAFETY: Safe to modify share options; risky to change file handling logic; test platform differences
// TESTS: Test multi-photo sharing, verify clipboard operations, check save to device, validate error handling
// AI-META-END

import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import * as MediaLibrary from "expo-media-library";
import * as FileSystem from "expo-file-system";
import Share from "react-native-share";
import { Photo } from "@/types";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { PhotoMetadataEditor } from "@/components/PhotoMetadataEditor";

export interface ShareOptions {
  title?: string;
  message?: string;
  url?: string | string[];
  type?: "url" | "text" | "image" | "video";
  subject?: string;
}

export interface ShareResult {
  success: boolean;
  action?: string;
  completed?: boolean;
  error?: string;
}

export type ShareMethod = "file" | "link" | "clipboard" | "device";

/**
 * NativeShareService - Handles sharing functionality with platform-specific optimizations
 *
 * Features:
 * - Single and multi-photo sharing
 * - Platform-specific share sheet customization
 * - Clipboard integration for links
 * - Save to device functionality
 * - Comprehensive error handling
 */
export class NativeShareService {
  private static instance: NativeShareService;

  public static getInstance(): NativeShareService {
    if (!NativeShareService.instance) {
      NativeShareService.instance = new NativeShareService();
    }
    return NativeShareService.instance;
  }

  /**
   * Check if sharing is available on the current platform
   */
  async isSharingAvailable(): Promise<boolean> {
    try {
      if (Platform.OS === "web") {
        return true; // Web has basic sharing via download
      }
      const { isAvailableAsync } = await import("expo-sharing");
      return await isAvailableAsync();
    } catch (error) {
      console.warn("Error checking sharing availability:", error);
      return false;
    }
  }

  /**
   * Share photos using native share sheet
   * Supports both single and multiple photos
   */
  async sharePhotos(
    photos: Photo[],
    options: ShareOptions = {},
  ): Promise<ShareResult> {
    try {
      if (photos.length === 0) {
        return { success: false, error: "No photos to share" };
      }

      const isAvailable = await this.isSharingAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: "Sharing not available on this device",
        };
      }

      // Use react-native-share for multiple photos and advanced features
      if (photos.length > 1 || Platform.OS !== "web") {
        return await this.shareWithReactNativeShare(photos, options);
      }

      // Fallback to expo-sharing for single photos
      return await this.shareWithExpoSharing(photos[0], options);
    } catch (error) {
      console.error("Error sharing photos:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown sharing error",
      };
    }
  }

  /**
   * Share using react-native-share (advanced features, multi-photo support)
   */
  private async shareWithReactNativeShare(
    photos: Photo[],
    options: ShareOptions = {},
  ): Promise<ShareResult> {
    try {
      const urls = photos.map((photo) => photo.uri);
      const shareOptions = this.buildShareOptions(photos, options);

      const result = await Share.open(shareOptions);

      return {
        success: true,
        action: (result as any).action || "shared",
        completed: (result as any).completed !== false,
      };
    } catch (error) {
      // User cancelled sharing
      if (error instanceof Error && error.message.includes("cancel")) {
        return { success: false, error: "Share cancelled by user" };
      }

      console.error("Error with react-native-share:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Share failed",
      };
    }
  }

  /**
   * Share using expo-sharing (fallback for single photos)
   */
  private async shareWithExpoSharing(
    photo: Photo,
    options: ShareOptions = {},
  ): Promise<ShareResult> {
    try {
      await Sharing.shareAsync(photo.uri, {
        dialogTitle: options.title || "Share Photo",
        mimeType: this.getMimeType(photo),
      });

      return { success: true, action: "shared", completed: true };
    } catch (error) {
      console.error("Error with expo-sharing:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Share failed",
      };
    }
  }

  /**
   * Build share options for react-native-share with platform-specific customization
   */
  private buildShareOptions(photos: Photo[], options: ShareOptions = {}): any {
    const urls = photos.map((photo) => photo.uri);
    const title =
      options.title ||
      (photos.length === 1 ? "Share Photo" : `Share ${photos.length} Photos`);
    const message =
      options.message || "Check out these photos from Photo Vault!";

    const baseOptions = {
      title,
      message,
      subject: options.subject || title,
      url: photos.length === 1 ? urls[0] : urls,
    };

    // iOS-specific customization with ActivityItemSources
    if (Platform.OS === "ios" && photos.length > 1) {
      return {
        ...baseOptions,
        activityItemSources: this.buildActivityItemSources(photos, message),
      };
    }

    return baseOptions;
  }

  /**
   * Build ActivityItemSources for iOS sharing customization
   */
  private buildActivityItemSources(photos: Photo[], message: string): any[] {
    return photos.map((photo, index) => ({
      placeholderItem: {
        type: "url",
        content: photo.uri,
      },
      item: {
        default: {
          type: "url",
          content: photo.uri,
        },
      },
      subject: {
        default: `Photo ${index + 1}`,
      },
      linkMetadata: {
        originalUrl: photo.uri,
        url: photo.uri,
        title: `Photo ${index + 1}`,
      },
    }));
  }

  /**
   * Copy photo URLs to clipboard
   */
  async copyToClipboard(photos: Photo[]): Promise<ShareResult> {
    try {
      if (photos.length === 0) {
        return { success: false, error: "No photos to copy" };
      }

      const urls = photos.map((photo) => photo.uri).join("\n");

      if (Platform.OS === "web") {
        await Clipboard.setStringAsync(urls);
      } else {
        await Clipboard.setString(urls);
      }

      return { success: true, action: "copied", completed: true };
    } catch (error) {
      console.error("Error copying to clipboard:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Copy failed",
      };
    }
  }

  /**
   * Save photos to device media library
   */
  async saveToDevice(photos: Photo[]): Promise<ShareResult> {
    try {
      if (photos.length === 0) {
        return { success: false, error: "No photos to save" };
      }

      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        return { success: false, error: "Media library permission denied" };
      }

      let savedCount = 0;
      const errors: string[] = [];

      for (const photo of photos) {
        try {
          await MediaLibrary.saveToLibraryAsync(photo.uri);
          savedCount++;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : "Save failed";
          errors.push(`Photo ${savedCount + 1}: ${errorMsg}`);
        }
      }

      if (savedCount === 0) {
        return {
          success: false,
          error: "No photos could be saved",
          action: "save_failed",
        };
      }

      const message =
        savedCount === photos.length
          ? `Saved ${savedCount} photo${savedCount > 1 ? "s" : ""} to device`
          : `Saved ${savedCount} of ${photos.length} photos to device`;

      return {
        success: true,
        action: "saved",
        completed: true,
        error: errors.length > 0 ? errors.join("; ") : undefined,
      };
    } catch (error) {
      console.error("Error saving to device:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Save failed",
      };
    }
  }

  /**
   * Generate shareable links for photos (placeholder for future implementation)
   */
  async generateShareLinks(photos: Photo[]): Promise<ShareResult> {
    try {
      if (photos.length === 0) {
        return { success: false, error: "No photos to share" };
      }

      // This is a placeholder implementation
      // In a real app, this would generate public URLs or share tokens
      const links = photos
        .map((photo, index) => `https://photovault.app/share/${photo.id}`)
        .join("\n");

      return {
        success: true,
        action: "links_generated",
        completed: true,
        error: undefined, // Store the generated links or return them
      };
    } catch (error) {
      console.error("Error generating share links:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Link generation failed",
      };
    }
  }

  /**
   * Get MIME type for a photo based on its URI
   */
  private getMimeType(photo: Photo): string {
    if (photo.uri.includes(".jpg") || photo.uri.includes(".jpeg")) {
      return "image/jpeg";
    }
    if (photo.uri.includes(".png")) {
      return "image/png";
    }
    if (photo.uri.includes(".gif")) {
      return "image/gif";
    }
    if (photo.uri.includes(".webp")) {
      return "image/webp";
    }
    // Default to JPEG for unknown formats
    return "image/jpeg";
  }

  /**
   * Validate photo URIs before sharing
   */
  private async validatePhotoUris(photos: Photo[]): Promise<Photo[]> {
    const validPhotos: Photo[] = [];

    for (const photo of photos) {
      try {
        const info = await FileSystem.getInfoAsync(photo.uri);
        if (info.exists && info.size && info.size > 0) {
          validPhotos.push(photo);
        }
      } catch (error) {
        console.warn(`Invalid photo URI: ${photo.uri}`, error);
      }
    }

    return validPhotos;
  }

  /**
   * Get available share methods for current platform
   */
  getAvailableShareMethods(): ShareMethod[] {
    const methods: ShareMethod[] = ["file", "clipboard"];

    if (Platform.OS !== "web") {
      methods.push("device");
    }

    // Add 'link' method when server sharing is implemented
    // methods.push('link');

    return methods;
  }

  /**
   * Get platform-specific share options
   */
  getPlatformSpecificOptions(): any {
    if (Platform.OS === "ios") {
      return {
        excludeActivityTypes: [
          "com.apple.mobilenotes.SharingExtension",
          "com.apple.reminders.RemindersSharingExtension",
        ],
      };
    }

    if (Platform.OS === "android") {
      return {
        subject: "Photos from Photo Vault",
      };
    }

    return {};
  }
}

// Export singleton instance
export const nativeShareService = NativeShareService.getInstance();
