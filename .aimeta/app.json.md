# AI-META: app.json

## Purpose
Expo app configuration with platform-specific settings and permissions

## Ownership
config/expo

## Entrypoints
- Used by Expo CLI for builds and configuration
- Metro bundler reads this for app metadata
- Native app builds (iOS/Android)

## Dependencies
- Expo SDK
- Plugins: expo-splash-screen, expo-image-picker, expo-media-library, expo-web-browser

## Danger Zones
- **Permissions** must match requested features (photos, camera, media library)
- **Bundle identifiers** must be unique (com.photovault.app)
- **React compiler** is experimental - may cause unexpected behavior
- **newArchEnabled** uses React Native's new architecture - compatibility issues with older libraries

## Change Safety
- ✅ Safe to update name, version, icon paths
- ⚠️ Icon/splash paths must exist in filesystem
- ⚠️ Permissions require app store review on changes
- ⚠️ Bundle identifier changes require new app submission
- ⚠️ newArchEnabled affects performance and compatibility

## Tests
- `npm run expo:dev` - Validate configuration
- Platform-specific builds to verify permissions work correctly

## Key Notes
- **newArchEnabled: true** uses React Native's new architecture for better performance
- **infoPlist strings** are shown to users when requesting permissions - be clear and non-intrusive
- **READ/WRITE_EXTERNAL_STORAGE** needed for photo access on older Android (API < 29)
- Newer Android versions use scoped storage automatically
- **React compiler** experimental feature enables automatic memoization - may cause re-rendering issues
- **isAccessMediaLocationEnabled: true** allows access to photo location metadata
