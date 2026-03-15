# Cloud Gallery Client - AI Agent Instructions

<div align="center">

![React Native](https://img.shields.io/badge/React%20Native-0.81.5-blue?logo=react)
![Expo](https://img.shields.io/badge/Expo%20SDK-54-000000?logo=expo)
![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)

</div>

AI-optimized documentation for React Native client development in Cloud Gallery.

## 🎯 Client Overview

React Native client for Cloud Gallery with local-first storage, premium UI, and enterprise security. Uses Expo SDK 54 for cross-platform development.

**One-Liner**: React Native photo gallery app with AsyncStorage, React Query, and bidirectional album-photo relationships.

## 🏗️ Client Architecture

```
client/
├── App.tsx              # Root component with provider setup
├── navigation/           # React Navigation configuration
├── screens/             # Main application screens
├── components/          # Reusable UI components
├── hooks/               # Custom React hooks
├── lib/                 # Core utilities and storage
├── types/               # TypeScript definitions
└── constants/           # App constants
```

### Key Dependencies
- **React Native 0.81.5**: Cross-platform mobile framework
- **Expo SDK 54**: Development platform and workflow
- **React Query 5.90.7**: Server state management and caching
- **React Navigation 7.x**: Navigation and routing
- **AsyncStorage**: Local data persistence
- **Expo Image Picker**: Camera and photo library access

## 🚀 Development Commands

### Starting Development
```bash
# Start Expo development server
npm run expo:dev

# Start with specific platform
npm run expo:start --ios          # iOS Simulator
npm run expo:start --android     # Android Emulator
npm run expo:start --web         # Web browser

# Build for production
npm run expo:static:build
```

### Testing
```bash
# Run client tests
npm run test client/

# Run specific component tests
npm run test client/components/PhotoGrid.test.tsx

# Run tests in watch mode
npm run test:watch
```

### Code Quality
```bash
# Type checking
npm run check:types

# Linting
npm run lint

# Format code
npm run format
```

## 📱 React Native Guidelines

### Component Structure
```typescript
// Use functional components with hooks
const PhotoGrid: React.FC<PhotoGridProps> = ({ photos, onPhotoPress }) => {
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  
  // Implementation
};

// Use proper TypeScript for props
interface PhotoGridProps {
  photos: Photo[];
  onPhotoPress: (photo: Photo, index: number) => void;
  selectionMode?: boolean;
  columns?: number;
}
```

### Navigation Patterns
```typescript
// Use type-safe navigation
export type RootStackParamList = {
  Main: undefined;
  PhotoDetail: { photoId: string; initialIndex: number };
  AlbumDetail: { albumId: string; albumTitle: string };
};

// Navigate with type safety
navigation.navigate('PhotoDetail', { 
  photoId: photo.id, 
  initialIndex: index 
});
```

### State Management with React Query
```typescript
// Use React Query for server state
const { data: photos, isLoading, error } = useQuery({
  queryKey: ['photos'],
  queryFn: getPhotos,
  staleTime: 5 * 60 * 1000, // 5 minutes
});

// Mutations with optimistic updates
const addPhotoMutation = useMutation({
  mutationFn: addPhoto,
  onMutate: async (newPhoto) => {
    // Cancel any outgoing refetches
    await queryClient.cancelQueries({ queryKey: ['photos'] });
    
    // Snapshot the previous value
    const previousPhotos = queryClient.getQueryData(['photos']);
    
    // Optimistically update
    queryClient.setQueryData(['photos'], (old: Photo[]) => [newPhoto, ...old]);
    
    return { previousPhotos };
  },
  onError: (err, newPhoto, context) => {
    // Rollback on error
    queryClient.setQueryData(['photos'], context?.previousPhotos);
  },
});
```

## 🗄️ Storage Patterns

### AsyncStorage Usage
```typescript
// Use the centralized storage layer
import { addPhoto, getPhotos, createAlbum } from '@/lib/storage';

// All storage operations are async and handle errors
const photos = await getPhotos();
await addPhoto(newPhoto);
const album = await createAlbum('Vacation Photos');
```

### Bidirectional Relationships
```typescript
// Photos know which albums contain them
interface Photo {
  id: string;
  albumIds: string[];  // Critical for bidirectional relationship
  // ... other properties
}

// Albums know which photos they contain
interface Album {
  id: string;
  photoIds: string[];  // Critical for bidirectional relationship
  // ... other properties
}

// Always maintain both sides when updating
await addPhotosToAlbum(albumId, [photoId]); // Updates both photo.albumIds and album.photoIds
```

## 🎨 UI/UX Guidelines

### Component Design
```typescript
// Use themed components
import { ThemedText, ThemedView } from '@/components';

// Follow design system constants
import { colors, typography, spacing } from '@/constants/theme';

// Platform-specific styling
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.medium,
  },
});
```

### Performance Optimization
```typescript
// Use FlashList for large datasets
import { FlashList } from '@shopify/flash-list';

const PhotoGrid = ({ photos }: PhotoGridProps) => {
  const renderItem = useCallback(({ item }) => (
    <PhotoItem photo={item} />
  ), []);

  return (
    <FlashList
      data={photos}
      renderItem={renderItem}
      estimatedItemSize={200}
      numColumns={3}
      keyExtractor={(item) => item.id}
    />
  );
};
```

### Platform-Specific Code
```typescript
// Use file extensions for platform differences
// styles.ts (shared)
// styles.ios.ts (iOS only)
// styles.android.ts (Android only)
// styles.web.ts (Web only)

// Platform detection in components
import { Platform } from 'react-native';

if (Platform.OS === 'ios') {
  // iOS-specific code
}
```

## 🔒 Security Considerations

### Secure Storage
```typescript
// Use secure storage for sensitive data
import * as SecureStore from 'expo-secure-store';

export async function storeSecureToken(token: string) {
  await SecureStore.setItemAsync('auth_token', token, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}
```

### Biometric Authentication
```typescript
import * as LocalAuthentication from 'expo-local-authentication';

export async function authenticateWithBiometrics() {
  const hasHardware = await LocalAuthentication.hasHardwareAsync();
  const isEnrolled = await LocalAuthentication.isEnrolledAsync();
  
  if (hasHardware && isEnrolled) {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Authenticate to access Cloud Gallery',
      fallbackLabel: 'Use passcode',
    });
    return result.success;
  }
  return false;
}
```

### Input Validation
```typescript
// Validate user inputs with Zod
import { z } from 'zod';

const PhotoSchema = z.object({
  uri: z.string().url(),
  filename: z.string().min(1).max(255),
  width: z.number().positive(),
  height: z.number().positive(),
});

// Validate before processing
const validatedPhoto = PhotoSchema.parse(photoData);
```

## 📱 Expo Development

### Expo Configuration
```json
// app.json - Key settings
{
  "expo": {
    "name": "Photo Vault",
    "slug": "photo-vault",
    "newArchEnabled": true,
    "ios": {
      "bundleIdentifier": "com.photovault.app",
      "infoPlist": {
        "NSPhotoLibraryUsageDescription": "Photo Vault needs access to your photos"
      }
    },
    "android": {
      "package": "com.photovault.app",
      "permissions": ["CAMERA", "READ_EXTERNAL_STORAGE"]
    }
  }
}
```

### Asset Management
```typescript
// Use Expo's asset system
import { Image } from 'expo-image';

// Optimize image loading
<Image
  source={{ uri: photo.uri }}
  style={styles.image}
  contentFit="cover"
  placeholder={require('@/assets/images/placeholder.png')}
  transition={100}
/>
```

### Permissions
```typescript
// Request permissions properly
import * as ImagePicker from 'expo-image-picker';

const requestPermission = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Sorry, we need camera roll permissions to make this work!');
    return false;
  }
  return true;
};
```

## 🧪 Testing Patterns

### Component Testing
```typescript
// Test components with React Native Testing Library
import { render, fireEvent } from '@testing-library/react-native';
import { PhotoGrid } from '../PhotoGrid';

describe('PhotoGrid', () => {
  it('renders photos correctly', () => {
    const photos = [mockPhoto1, mockPhoto2];
    const { getByTestId } = render(
      <PhotoGrid photos={photos} onPhotoPress={jest.fn()} />
    );
    
    expect(getByTestId('photo-grid')).toBeTruthy();
  });

  it('handles photo press', () => {
    const onPhotoPress = jest.fn();
    const { getByTestId } = render(
      <PhotoGrid photos={[mockPhoto]} onPhotoPress={onPhotoPress} />
    );
    
    fireEvent.press(getByTestId('photo-0'));
    expect(onPhotoPress).toHaveBeenCalledWith(mockPhoto, 0);
  });
});
```

### Hook Testing
```typescript
// Test custom hooks
import { renderHook } from '@testing-library/react-hooks';
import { usePhotos } from '../hooks/usePhotos';

describe('usePhotos', () => {
  it('loads photos on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => usePhotos());
    
    expect(result.current.isLoading).toBe(true);
    
    await waitForNextUpdate();
    
    expect(result.current.photos).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });
});
```

### Storage Testing
```typescript
// Test storage operations with AsyncStorage mock
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPhotos, addPhoto } from '../lib/storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage');

describe('Storage', () => {
  beforeEach(() => {
    AsyncStorage.clear();
  });

  it('should add and retrieve photos', async () => {
    const photo = mockPhoto;
    await addPhoto(photo);
    
    const photos = await getPhotos();
    expect(photos).toContainEqual(photo);
  });
});
```

## 🔧 Development Tools

### Expo Development
```bash
# Clear cache and restart
expo start --clear

# Use tunnel for network access
expo start --tunnel

# Open in specific platform
expo start --ios
expo start --android
```

### Debugging
```bash
# Enable remote debugging
# Shake device in development mode
# Or press Cmd+D (iOS) / Cmd+M (Android)

# View logs
npx expo start --logs
```

### Performance Monitoring
```typescript
// Use Flipper for debugging
import { logger } from 'react-native-logs';

// Log performance metrics
logger.info('Photo grid rendered', {
  photoCount: photos.length,
  renderTime: performance.now() - startTime,
});
```

## 📋 Client-Specific Gotchas

### Platform Differences
- **iOS**: Requires explicit photo library permission description
- **Android**: Needs file permissions in app.json
- **Web**: Different storage behavior (localStorage vs AsyncStorage)

### Expo Limitations
- **Bundle Size**: Larger than native builds
- **Native Modules**: Must be Expo-compatible
- **Performance**: Slightly slower than pure React Native

### AsyncStorage Limits
- **Size**: ~6-10MB per app
- **Performance**: Degrades with large datasets
- **Sync**: No built-in sync across devices

### Navigation Gotchas
- **Type Safety**: Must maintain param list types
- **Deep Linking**: Requires proper configuration
- **Modal Presentation**: Different behavior per platform

## 🔍 External Dependencies

### Expo Services
- **Image Picker**: Camera and photo library access
- **Media Library**: Photo management
- **Location**: GPS data (optional)
- **Sharing**: Share functionality
- **Haptics**: Tactile feedback

### Third-Party Libraries
- **FlashList**: High-performance lists
- **React Query**: Server state management
- **React Navigation**: Navigation framework
- **React Native Reanimated**: Animations

## 📚 Documentation References

### Client Documentation
- `@client/types/index.ts` - TypeScript definitions
- `@client/lib/storage.ts` - Storage layer documentation
- `@client/navigation/` - Navigation setup
- `@docs/design_guidelines.md` - UI/UX specifications

### Shared Resources
- `@shared/schema.ts` - Database schema (for reference)
- `@shared/types/` - Shared type definitions

### Testing
- `@docs/testing/00_INDEX.md` - Testing strategy
- Component test examples in `client/components/`

## 🚨 Agent Behavior Guidelines

### What to Do
- Follow React Native best practices
- Use TypeScript strict mode
- Test components with React Native Testing Library
- Consider platform differences
- Follow the established navigation patterns

### What to Avoid
- Don't use `any` types
- Avoid hardcoded dimensions
- Don't skip error boundaries
- Avoid platform-specific code without extensions
- Don't break bidirectional relationships

### Verification Steps
1. Run `npm run check:types` - No TypeScript errors
2. Run `npm run lint` - No linting errors  
3. Run `npm run test client/` - All client tests pass
4. Test on multiple platforms if possible
5. Verify navigation flow works

---

*Last updated: March 2026 | Compatible with: AGENTS.md standard v1.0*
