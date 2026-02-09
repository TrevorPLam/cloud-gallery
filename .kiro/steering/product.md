# Product Overview

**Photo Vault** (also known as Cloud Gallery) is a premium mobile photo storage and organization application that competes with Google Photos through superior design and emotional connection to content.

## Core Value Proposition

- Gallery-quality presentation with museum-like spacing and elegance
- Strong security and encryption foundations
- Cross-platform support (iOS, Android, Web) via React Native
- User-owned photo organization with albums and favorites

## Target Users

Mobile users who want premium, elegant photo management with strong security and privacy controls.

## Key Features

### Current Implementation
- **Authentication**: User registration/login with JWT
- **Photo Management**: Upload, view (grid), delete (soft delete → trash → permanent), restore, favorites
- **Albums**: Full CRUD operations, add/remove photos, custom ordering
- **Search**: Client-side filtering by filename and favorites (limited)
- **Editing**: Basic rotate (90°) and flip horizontal with undo
- **Security**: Encryption foundations, user data isolation, audit logging

### Known Limitations
- No AI/ML features (object/face/scene recognition)
- Limited search capabilities (filename-only)
- Basic editing tools (no crop, filters, lighting adjustments)
- No sharing features (shared albums, public links)
- No background sync or incremental backup

## Design Philosophy

**Aesthetic**: Luxurious/refined with organic warmth
- Let photos be the star - generous whitespace, confident spacing
- Gallery-quality presentation (museum, not warehouse)
- Smooth, delightful micro-interactions
- Restrained elegance with soft, natural materiality

**Brand Colors**:
- Primary: #2D3748 (Charcoal Blue)
- Accent: #D4AF37 (Muted Gold) for favorites and CTAs
- Background: #FAFBFC (Cool White)

## Architecture Approach

- **API-first**: Client communicates via RESTful API
- **User isolation**: Strictly enforced at database query level
- **Local-first capable**: Client can operate with local storage (AsyncStorage)
- **Security-focused**: Encryption, authorization middleware, audit trails
