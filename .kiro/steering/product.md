# Cloud Gallery - Product Overview

## What It Is

Cloud Gallery is a cross-platform photo management application with cloud sync capabilities. It provides users with a secure, privacy-first way to organize, backup, and access their photos across multiple devices.

## Key Features

- **Cross-Platform**: Runs on iOS, Android, and Web from a single React Native codebase
- **Cloud Sync**: Automatic backup and multi-device synchronization
- **Smart Albums**: Organize photos into collections with metadata support
- **Privacy-First**: End-to-end encryption, local-first architecture with offline support
- **Rich Metadata**: EXIF data, GPS location, tags, and user notes
- **Dark Mode**: Beautiful light and dark themes

## Target Users

- Individuals who want reliable photo backup across devices
- Users who value privacy and data ownership
- People managing large photo libraries (1000+ photos)

## Current Development Phase

**Foundation Repair Phase** - Addressing core architectural issues before feature development:
- Connecting client to server API (currently using local storage only)
- Implementing proper data validation and UUID generation
- Adding React Query for server state management
- Improving type safety and error handling

## Architecture

- **Client**: React Native mobile app (Expo)
- **Server**: Express.js REST API
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based with secure password hashing (Argon2id)
