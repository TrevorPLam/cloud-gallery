# Photo Vault - Design Guidelines

## Brand Identity

**Purpose**: A premium photo storage and organization app that makes memories feel precious. Competes with Google Photos through superior design and emotional connection to content.

**Aesthetic Direction**: **Luxurious/refined with organic warmth**
- Gallery-quality presentation (think museum, not warehouse)
- Soft, natural materiality that respects the content
- Restrained elegance - let photos be the star
- Generous whitespace, confident spacing

**Memorable Element**: The way photos "breathe" on screen - never cramped, always given space to be appreciated. Smooth, delightful micro-interactions when organizing albums.

## Navigation Architecture

**Root Navigation**: Tab Bar (4 tabs + floating action button)

**Tabs**:
1. **Photos** - Timeline grid of all photos
2. **Albums** - User-created collections
3. **Search** - Visual search and filters
4. **Profile** - Settings, storage, account

**Floating Action Button**: Upload (camera icon) - positioned bottom-right, appears on Photos and Albums tabs only

**Authentication**: Required
- Apple Sign-In (primary for iOS)
- Google Sign-In (secondary)
- Mock auth in prototype with local persistence

## Screen Specifications

### 1. Photos Screen (Default Tab)
- **Purpose**: Browse all photos in reverse chronological grid
- **Header**: Transparent, title "Photos", right button (grid size toggle)
- **Layout**: 
  - Scrollable grid (3 columns)
  - Section headers by date (Today, Yesterday, Last Week, etc.)
  - Top inset: headerHeight + Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- **Empty State**: Show empty-photos.png illustration with "No photos yet" and "Tap + to upload"

### 2. Albums Screen
- **Purpose**: View and manage photo collections
- **Header**: Transparent, title "Albums", right button (+ New Album)
- **Layout**:
  - Scrollable list of album cards
  - Each card: cover photo, title, photo count
  - Top inset: headerHeight + Spacing.xl
  - Bottom inset: tabBarHeight + Spacing.xl
- **Empty State**: Show empty-albums.png with "Create your first album"

### 3. Album Detail Screen (Modal Stack)
- **Purpose**: View photos within an album
- **Header**: Custom transparent, back button, album title, right menu (share, edit, delete)
- **Layout**: Same grid as Photos screen
- **Actions**: Long-press photo for multi-select mode

### 4. Search Screen
- **Purpose**: Find photos by visual search, date, location
- **Header**: Search bar (large, always visible)
- **Layout**:
  - Recent searches (if any)
  - Suggested searches (People, Places, Things)
  - Results grid when searching
  - Top inset: Spacing.xl (no transparent header)
  - Bottom inset: tabBarHeight + Spacing.xl

### 5. Photo Detail Screen (Modal)
- **Purpose**: Full-screen photo viewing
- **Header**: None (overlay controls)
- **Layout**: 
  - Fullscreen photo (pinch to zoom)
  - Bottom toolbar: share, favorite, delete
  - Swipeable horizontally through photos

### 6. Profile Screen
- **Purpose**: Account, storage info, settings
- **Header**: Default, title "Profile"
- **Layout**:
  - Avatar and name at top
  - Storage usage bar
  - Scrollable settings list
  - Log out at bottom
- **Settings**: Theme, Backup Settings, Privacy, Account > Delete Account

### 7. Upload Flow (Modal)
- **Purpose**: Add photos from camera roll
- **Header**: "Select Photos", cancel (left), done (right)
- **Layout**: Photo grid with multi-select checkboxes

## Color Palette

**Primary**: #2D3748 (Charcoal Blue) - sophisticated, non-distracting
**Accent**: #D4AF37 (Muted Gold) - premium touch for favorites, CTAs
**Background**: #FAFBFC (Cool White) - gallery-like cleanliness
**Surface**: #FFFFFF (Pure White) - cards, modals
**Text Primary**: #1A202C (Near Black)
**Text Secondary**: #718096 (Warm Gray)
**Border**: #E2E8F0 (Soft Gray)
**Success**: #48BB78
**Error**: #F56565

## Typography

**Font**: SF Pro (system) - timeless, readable
**Type Scale**:
- Hero: 32px Bold (album titles in detail)
- H1: 28px Bold (screen titles)
- H2: 20px Semibold (section headers)
- Body: 16px Regular
- Caption: 14px Regular (dates, photo counts)
- Small: 12px Regular (metadata)

## Visual Design

- **Photo Cards**: No borders, subtle shadow on hover/press
- **Floating Upload Button**:
  - Background: Accent color (#D4AF37)
  - Size: 56x56px
  - Icon: White camera/plus
  - Shadow: shadowOffset {width: 0, height: 2}, opacity 0.10, radius 2
- **Grid Spacing**: 2px between photos (tight, gallery-style)
- **Corner Radius**: 12px for cards, 8px for buttons, 24px for modals
- **Icons**: Feather icons from @expo/vector-icons
- **Press States**: Reduce opacity to 0.7

## Assets to Generate

1. **icon.png** - App icon: Camera aperture in gold on charcoal gradient
2. **splash-icon.png** - Same as app icon
3. **empty-photos.png** - Minimal illustration of photo frame with soft shadows, WHERE USED: Photos screen empty state
4. **empty-albums.png** - Stack of photo albums, warm and inviting, WHERE USED: Albums screen empty state
5. **avatar-default.png** - Soft gradient circle, WHERE USED: Profile screen default avatar
6. **welcome-hero.png** - Elegant camera/gallery illustration, WHERE USED: Onboarding first screen