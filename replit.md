<!--
AI-META-BEGIN
AI-META: Replit-specific project documentation for Photo Vault app architecture and setup
OWNERSHIP: documentation/project
ENTRYPOINTS: read by developers for project understanding and onboarding
DEPENDENCIES: none (reference document)
DANGER: navigation structure must match actual implementation; storage keys are hardcoded in client/lib/storage.ts
CHANGE-SAFETY: safe to update feature list and architecture; storage keys and data models must stay in sync with code
TESTS: verify documentation accuracy against implementation when making changes
AI-META-END
-->

# Photo Vault - A Google Photos Competitor

## Overview
Photo Vault is a premium photo storage and organization mobile app built with React Native (Expo) and Express.js. It provides a gallery-quality presentation for photos with elegant design and smooth interactions.

## Project Architecture

### Frontend (client/)
- **React Native with Expo** - Cross-platform mobile development
- **React Navigation** - Native stack and bottom tab navigation
- **@tanstack/react-query** - Data fetching and caching
- **AsyncStorage** - Local data persistence
- **expo-image-picker** - Photo selection from device
- **expo-media-library** - Device media access
- **@shopify/flash-list** - High-performance lists
- **react-native-reanimated** - Smooth animations
- **expo-haptics** - Tactile feedback

### Backend (server/)
- **Express.js** - HTTP server
- Currently minimal - the app uses local storage for MVP

### Navigation Structure
```
RootStackNavigator
├── MainTabNavigator
│   ├── PhotosTab (PhotosStackNavigator)
│   │   └── PhotosScreen - Photo timeline grid
│   ├── AlbumsTab (AlbumsStackNavigator)
│   │   └── AlbumsScreen - Album list
│   ├── SearchTab (SearchStackNavigator)
│   │   └── SearchScreen - Photo search
│   └── ProfileTab (ProfileStackNavigator)
│       └── ProfileScreen - Settings & account
├── PhotoDetailScreen - Full-screen photo viewer (modal)
└── AlbumDetailScreen - Album contents
```

### Key Features
1. **Photos Screen** - Timeline grid with date grouping
2. **Albums Screen** - Create and manage photo collections
3. **Search Screen** - Find photos by name or browse favorites
4. **Profile Screen** - Storage info, settings, and data management
5. **Photo Detail** - Full-screen viewing with share, favorite, delete
6. **Album Detail** - View and manage photos in albums

### Data Models (client/types/index.ts)
- **Photo** - id, uri, dimensions, timestamps, filename, isFavorite, albumIds
- **Album** - id, title, coverPhotoUri, photoIds, timestamps
- **StorageInfo** - usage statistics

### Storage (client/lib/storage.ts)
All data persisted to AsyncStorage with keys:
- `@photo_vault_photos` - Photo array
- `@photo_vault_albums` - Album array
- `@photo_vault_user` - User profile

### Design System (client/constants/theme.ts)
- **Colors** - Charcoal blue primary, muted gold accent
- **Typography** - System fonts with hierarchical scale
- **Spacing** - Consistent spacing tokens
- **Shadows** - Subtle elevation effects

### Running the App
- Frontend: `npm run expo:dev` (port 8081)
- Backend: `npm run server:dev` (port 5000)

### User Preferences
- Premium, gallery-quality aesthetic
- Generous whitespace and breathing room for photos
- Subtle animations and haptic feedback
- iOS-first design language
