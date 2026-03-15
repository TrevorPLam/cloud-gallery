# Cloud Gallery Client

<div align="center">

![React Native Logo](https://img.shields.io/badge/React%20Native-0.81.5-blue?logo=react)
![Expo Logo](https://img.shields.io/badge/Expo%20SDK-54-000000?logo=expo)
![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20Android%20%7C%20Web-green)

</div>

React Native client application for Cloud Gallery with premium photo management features and enterprise-grade security.

## 🎯 Client Architecture

### 📱 Component Structure
```
client/
├── 📱 App.tsx                    # Root component with providers
├── 🧭 navigation/                # Navigation configuration
│   ├── RootStackNavigator.tsx   # Main navigation stack
│   ├── MainTabNavigator.tsx      # Bottom tab navigation
│   └── [Stack]Navigators.tsx     # Feature-specific stacks
├── 🖼️ screens/                   # Main application screens
│   ├── PhotosScreen.tsx          # Photo gallery view
│   ├── AlbumsScreen.tsx          # Album management
│   ├── PhotoDetailScreen.tsx     # Full-screen photo viewer
│   ├── EditPhotoScreen.tsx       # Photo metadata editor
│   └── [Feature]Screen.tsx       # Additional features
├── 🧩 components/                # Reusable UI components
│   ├── PhotoGrid.tsx             # Gallery photo grid
│   ├── AlbumCard.tsx             # Album display card
│   ├── Button.tsx                # Custom button component
│   └── [UI]Component.tsx        # Other UI components
├── 🎣 hooks/                     # Custom React hooks
│   ├── useScreenOptions.tsx      # Screen configuration
│   ├── usePhotos.ts              # Photo data management
│   └── [Feature]Hook.ts          # Feature-specific hooks
├── 📚 lib/                       # Core utilities and services
│   ├── storage.ts                # AsyncStorage operations
│   ├── query-client.ts           # React Query configuration
│   ├── secure-storage.ts         # Encrypted storage
│   └── [utility].ts              # Helper functions
├── 🎨 constants/                 # App constants and themes
│   ├── colors.ts                 # Color palette
│   ├── typography.ts             # Font configurations
│   └── layout.ts                 # Layout constants
└── 📝 types/                     # TypeScript type definitions
    └── index.ts                  # Core type definitions
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g @expo/cli`
- iOS: Xcode 14+ (for physical device testing)
- Android: Android Studio with Android SDK

### Installation

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Start development server
npm start

# Or use Expo CLI directly
expo start
```

### Development Workflow

```bash
# Start development server
expo start

# Open on specific platform
expo start --ios          # iOS Simulator
expo start --android     # Android Emulator
expo start --web         # Web browser

# Build for production
expo build:ios           # iOS build
expo build:android       # Android build
expo build:web           # Web build
```

## 🧭 Navigation Architecture

### Navigation Stack
```typescript
RootStackNavigator
├── MainTabNavigator
│   ├── PhotosStackNavigator
│   │   └── PhotosScreen
│   ├── AlbumsStackNavigator
│   │   └── AlbumsScreen
│   ├── SearchStackNavigator
│   │   └── SearchScreen
│   └── ProfileStackNavigator
│       └── ProfileScreen
├── PhotoDetailScreen (Modal)
├── AlbumDetailScreen (Modal)
├── EditPhotoScreen (Modal)
└── TrashScreen (Modal)
```

### Navigation Types
```typescript
export type RootStackParamList = {
  Main: undefined;
  PhotoDetail: { photoId: string; initialIndex: number };
  AlbumDetail: { albumId: string; albumTitle: string };
  EditPhoto: { photoId: string; initialUri: string };
  Trash: undefined;
};
```

## 🗄️ Data Management

### Local Storage Strategy
```typescript
// AsyncStorage keys
const PHOTOS_KEY = "@photo_vault_photos";
const ALBUMS_KEY = "@photo_vault_albums";
const USER_KEY = "@photo_vault_user";

// Bidirectional relationships
interface Photo {
  id: string;
  albumIds: string[];  // Photos know their albums
  // ... other properties
}

interface Album {
  id: string;
  photoIds: string[];  // Albums know their photos
  // ... other properties
}
```

### React Query Configuration
```typescript
// Query client setup
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 3,
    },
  },
});
```

## 🎨 UI Components

### Core Components

#### PhotoGrid
```typescript
interface PhotoGridProps {
  photos: Photo[];
  onPhotoPress: (photo: Photo, index: number) => void;
  onPhotoLongPress?: (photo: Photo) => void;
  selectionMode?: boolean;
  selectedPhotos?: string[];
  columns?: number;
}
```

#### AlbumCard
```typescript
interface AlbumCardProps {
  album: Album;
  onPress: (album: Album) => void;
  onLongPress?: (album: Album) => void;
  showPhotoCount?: boolean;
  cardSize?: 'small' | 'medium' | 'large';
}
```

#### Custom Button
```typescript
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}
```

### Theme System
```typescript
// Color palette
export const colors = {
  primary: '#007AFF',
  secondary: '#5856D6',
  background: '#F2F2F7',
  surface: '#FFFFFF',
  text: '#000000',
  textSecondary: '#8E8E93',
  border: '#C6C6C8',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
};

// Typography
export const typography = {
  largeTitle: { fontSize: 34, fontWeight: '700' },
  title1: { fontSize: 28, fontWeight: '700' },
  title2: { fontSize: 22, fontWeight: '700' },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17, fontWeight: '400' },
  callout: { fontSize: 16, fontWeight: '400' },
  subhead: { fontSize: 15, fontWeight: '400' },
  footnote: { fontSize: 13, fontWeight: '400' },
  caption1: { fontSize: 12, fontWeight: '400' },
  caption2: { fontSize: 11, fontWeight: '400' },
};
```

## 🔒 Security Features

### Secure Storage
```typescript
// Encrypted storage for sensitive data
import * as SecureStore from 'expo-secure-store';

export async function storeSecureData(key: string, value: string) {
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getSecureData(key: string) {
  return await SecureStore.getItemAsync(key);
}
```

### Biometric Authentication
```typescript
import * as LocalAuthentication from 'expo-local-authentication';

export async function authenticateWithBiometrics() {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;

  const enrolled = await LocalAuthentication.isEnrolledAsync();
  if (!enrolled) return false;

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Authenticate to access Cloud Gallery',
    fallbackLabel: 'Use passcode',
  });

  return result.success;
}
```

### Photo Encryption
```typescript
// Encrypt sensitive photo metadata
import CryptoJS from 'crypto-js';

export function encryptPhotoMetadata(metadata: PhotoMetadata, key: string) {
  const ciphertext = CryptoJS.AES.encrypt(
    JSON.stringify(metadata),
    key
  ).toString();
  return ciphertext;
}

export function decryptPhotoMetadata(ciphertext: string, key: string) {
  const bytes = CryptoJS.AES.decrypt(ciphertext, key);
  const decryptedData = bytes.toString(CryptoJS.enc.Utf8);
  return JSON.parse(decryptedData);
}
```

## 📸 Photo Management

### Photo Operations
```typescript
// Add photo with metadata
export async function addPhoto(
  uri: string,
  metadata?: Partial<PhotoMetadata>
): Promise<Photo> {
  const photo: Photo = {
    id: generateId(),
    uri,
    width: metadata?.width || 0,
    height: metadata?.height || 0,
    filename: metadata?.filename || 'Unknown',
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    isFavorite: false,
    albumIds: [],
    ...metadata,
  };

  await addPhoto(photo);
  return photo;
}

// Batch operations
export async function batchDeletePhotos(photoIds: string[]) {
  for (const id of photoIds) {
    await deletePhoto(id);
  }
}

export async function batchAddToAlbum(albumId: string, photoIds: string[]) {
  await addPhotosToAlbum(albumId, photoIds);
}
```

### Image Processing
```typescript
import * as ImageManipulator from 'expo-image-manipulator';

export async function generateThumbnail(uri: string): Promise<string> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 200, height: 200 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function extractImageMetadata(uri: string) {
  // Extract EXIF data, dimensions, file size
  // Implementation depends on platform capabilities
}
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
// Example component test
import { render, fireEvent } from '@testing-library/react-native';
import { PhotoGrid } from '../PhotoGrid';

describe('PhotoGrid', () => {
  it('renders photos correctly', () => {
    const photos = [mockPhoto1, mockPhoto2];
    const { getByTestId } = render(
      <PhotoGrid photos={photos} onPhotoPress={jest.fn()} />
    );
    
    expect(getByTestId('photo-grid')).toBeTruthy();
    expect(getByTestId('photo-0')).toBeTruthy();
    expect(getByTestId('photo-1')).toBeTruthy();
  });

  it('handles photo press', () => {
    const onPhotoPress = jest.fn();
    const photos = [mockPhoto1];
    const { getByTestId } = render(
      <PhotoGrid photos={photos} onPhotoPress={onPhotoPress} />
    );
    
    fireEvent.press(getByTestId('photo-0'));
    expect(onPhotoPress).toHaveBeenCalledWith(mockPhoto1, 0);
  });
});
```

### Integration Tests
```typescript
// Storage integration tests
describe('Storage Integration', () => {
  beforeEach(async () => {
    await clearAllData();
  });

  it('maintains photo-album relationships', async () => {
    const photo = await addPhoto(mockPhoto1);
    const album = await createAlbum('Test Album');
    
    await addPhotosToAlbum(album.id, [photo.id]);
    
    const updatedPhoto = await getPhoto(photo.id);
    const updatedAlbum = await getAlbum(album.id);
    
    expect(updatedPhoto.albumIds).toContain(album.id);
    expect(updatedAlbum.photoIds).toContain(photo.id);
  });
});
```

## 📱 Platform-Specific Features

### iOS Features
```typescript
// iOS-specific configurations
import { Platform } from 'react-native';

if (Platform.OS === 'ios') {
  // iOS-specific features
  - Face ID authentication
  - Live Photos support
  - iCloud Photos integration
  - ProRAW image support
  - Depth data processing
}
```

### Android Features
```typescript
if (Platform.OS === 'android') {
  // Android-specific features
  - Fingerprint authentication
  - HEIC image support
  - Google Photos integration
  - Storage access framework
  - Material Design 3 theming
}
```

### Web Features
```typescript
if (Platform.OS === 'web') {
  // Web-specific features
  - Drag-and-drop file upload
  - Progressive Web App (PWA)
  - Web Share API
  - IndexedDB for storage
  - Service Worker for caching
}
```

## 🔧 Development Tools

### Expo Development
```bash
# Development commands
expo start --clear          # Clear cache and start
expo start --tunnel         # Use tunnel for network access
expo start --dev-client     # Use development client
expo start --go             # Use Expo Go app

# Build commands
expo build:ios --type archive    # iOS archive
expo build:android --type apk    # Android APK
expo build:android --type aab    # Android App Bundle
expo build:web                    # Web build

# Publish updates
expo publish --release-channel production
```

### Performance Monitoring
```typescript
import { Performance } from 'expo-performance';

// Performance monitoring
export function trackScreenLoad(screenName: string) {
  const startTime = Date.now();
  
  return () => {
    const loadTime = Date.now() - startTime;
    Performance.mark(`${screenName}-load-complete`);
    Performance.measure(
      `${screenName}-load-time`,
      `${screenName}-load-start`,
      `${screenName}-load-complete`
    );
  };
}
```

### Error Handling
```typescript
// Global error boundary
class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error:', error, errorInfo);
    // Send to error reporting service
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
```

## 📊 Performance Optimization

### Image Optimization
```typescript
// Lazy loading for images
import { FastImage } from 'react-native-fast-image';

const OptimizedImage = ({ source, style }) => (
  <FastImage
    style={style}
    source={{
      uri: source.uri,
      priority: FastImage.priority.normal,
      cache: FastImage.cacheControl.immutable,
    }}
    resizeMode={FastImage.resizeMode.cover}
  />
);
```

### Memory Management
```typescript
// Memory optimization for large photo sets
import { useMemo, useCallback } from 'react';

const PhotoList = ({ photos }) => {
  const memoizedPhotos = useMemo(() => {
    return photos.slice(0, 100); // Limit initial render
  }, [photos]);

  const handlePhotoPress = useCallback((photo, index) => {
    // Handle photo press
  }, []);

  return (
    <FlatList
      data={memoizedPhotos}
      renderItem={renderPhoto}
      keyExtractor={(item) => item.id}
      getItemLayout={(data, index) => ({
        length: ITEM_HEIGHT,
        offset: ITEM_HEIGHT * index,
        index,
      })}
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      windowSize={10}
    />
  );
};
```

## 🔍 Debugging & Monitoring

### React Native Debugger
```bash
# Install React Native Debugger
# macOS: brew install --cask react-native-debugger
# Windows: Download from releases

# Enable remote debugging
# Shake device in development mode
# Or press Cmd+D (iOS) / Cmd+M (Android)
```

### Flipper Integration
```typescript
// flipper-plugin-react-native-debugger
import { logger } from 'react-native-debugger';

// Debug logging
logger.log('Photo loaded:', photo);
logger.error('Storage error:', error);
```

## 🚀 Deployment

### App Store Deployment
```bash
# iOS App Store
expo build:ios --type archive
# Upload to App Store Connect
expo upload:ios

# Android Play Store
expo build:android --type aab
# Upload to Google Play Console
expo upload:android
```

### Web Deployment
```bash
# Build for web
expo build:web

# Deploy to Vercel/Netlify
# Upload the dist/web folder
```

## 📚 API Reference

### Core Hooks
```typescript
// usePhotos - Photo data management
const { photos, loading, error, addPhoto, deletePhoto } = usePhotos();

// useAlbums - Album data management
const { albums, loading, error, createAlbum, deleteAlbum } = useAlbums();

// useAuth - Authentication state
const { user, isAuthenticated, login, logout } = useAuth();

// usePermissions - Device permissions
const { requestPermissions, hasPermissions } = usePermissions();
```

### Storage API
```typescript
// Photo operations
await addPhoto(photo: Photo): Promise<void>
await getPhotos(): Promise<Photo[]>
await deletePhoto(photoId: string): Promise<void>
await toggleFavorite(photoId: string): Promise<Photo | null>

// Album operations
await createAlbum(title: string): Promise<Album>
await getAlbums(): Promise<Album[]>
await deleteAlbum(albumId: string): Promise<void>
await addPhotosToAlbum(albumId: string, photoIds: string[]): Promise<void>
```

## 🔗 Related Documentation

- **[Main README](../README.md)** - Project overview
- **[Server Documentation](../server/README.md)** - Backend API
- **[Shared Types](../shared/README.md)** - Type definitions
- **[Architecture](../docs/architecture/00_INDEX.md)** - System design
- **[Security](../docs/security/README.md)** - Security documentation

---

<div align="center">

**Built with ❤️ using React Native & Expo**

[![React Native](https://img.shields.io/badge/React%20Native-61.0.0-blue?logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-54-000000?logo=expo)](https://expo.dev/)

</div>
