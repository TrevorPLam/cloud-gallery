# Accessibility Testing Audit Report

## Overview
This report catalogs all query patterns used in Cloud Gallery component tests to identify non-semantic patterns that need to be replaced with accessibility-first queries.

## Query Priority Order (Testing Library Recommendation)
1. **getByRole** - Top preference for everything (buttons, inputs, etc.)
2. **getByLabelText** - Form fields 
3. **getByPlaceholderText** - Only if no labels available
4. **getByText** - Non-interactive elements
5. **getByDisplayValue** - Form element values
6. **getByAltText** - Images with alt text
7. **getByTitle** - Last resort before test IDs
8. **getByTestId** - Only when no other option works

## Current State Analysis

### ✅ Good Examples Already Using Semantic Queries
- **Button.test.tsx**: Uses `getByRole('button')` correctly
- **SharedAlbumsScreen.test.tsx**: Uses `getByRole('button', { name: /Vacation Photos/i })`
- **SearchScreen.test.tsx**: Uses `getByPlaceholderText()` appropriately
- **PartnerSharingScreen.test.tsx**: Uses `getByPlaceholderText()` for email inputs
- **PhotoMetadataEditor.test.tsx**: Uses `getByPlaceholderText()` for ML label inputs
- **SyncSettingsScreen.test.tsx**: Uses `getByDisplayValue()` and `getByLabelText()`

### ❌ Files Requiring Migration (Heavy getByTestId Usage)

#### 1. SmartAlbumsScreen.test.tsx
**Issues Found:**
- `getByTestId("album-card-album-1")` - Should use `getByRole('button', { name: /Test Album/i })`
- `getByTestId("hide-button-album-1")` - Should use `getByRole('button', { name: /hide/i })`
- `getByTestId("pin-button-album-1")` - Should use `getByRole('button', { name: /pin/i })`
- `getByTestId("generate-button")` - Should use `getByRole('button', { name: /generate/i })`
- `getByTestId("refresh-control")` - Should use `getByRole('button', { name: /refresh/i })`

#### 2. MemoriesScreen.test.tsx
**Issues Found:**
- `getByTestId("skeleton-loader")` - Should use `getByRole('progressbar', { name: /loading/i })`
- `getByTestId("empty-state")` - Should use `getByText('No Memories Yet')`
- `getByTestId("empty-title")` - Should use `getByRole('heading', { name: 'No Memories Yet' })`
- `getByTestId("empty-action")` - Should use `getByRole('button', { name: /Generate Memories/i })`
- `getByTestId("memory-card-memory1")` - Should use `getByRole('button', { name: /memory/i })`
- `getByTestId("fab-button")` - Should use `getByRole('button', { name: /create/i })`

#### 3. SyncSettingsScreen.test.tsx
**Issues Found:**
- `getByTestId("activity-indicator")` - Should use `getByRole('progressbar', { name: /loading/i })`
- `getByTestId("switch-auto-sync")` - Should use `getByRole('switch', { name: /auto-sync/i })`
- `getByTestId("switch-wifi-only")` - Should use `getByRole('switch', { name: /wifi-only/i })`
- `getByTestId("scroll-view")` - Should use `getByRole('textbox')` or similar

#### 4. AlbumDetailScreen.share.test.tsx
**Issues Found:**
- `getByTestId("share-button")` - Should use `getByRole('button', { name: /share/i })`

### 📊 Summary Statistics

| File | getByTestId Count | Semantic Queries | Migration Needed |
|------|------------------|------------------|------------------|
| Button.test.tsx | 0 | 4 | ✅ Complete |
| SmartAlbumsScreen.test.tsx | 8 | 0 | ❌ High Priority |
| MemoriesScreen.test.tsx | 6 | 0 | ❌ High Priority |
| SyncSettingsScreen.test.tsx | 3 | 3 | ⚠️ Medium Priority |
| AlbumDetailScreen.share.test.tsx | 1 | 0 | ⚠️ Low Priority |
| SharedAlbumsScreen.test.tsx | 0 | 2 | ✅ Complete |
| SearchScreen.test.tsx | 0 | 8 | ✅ Complete |
| PartnerSharingScreen.test.tsx | 0 | 3 | ✅ Complete |
| PhotoMetadataEditor.test.tsx | 0 | 6 | ✅ Complete |

**Total:** 18 `getByTestId` calls need migration to semantic queries

## Migration Strategy

### Priority 1: Interactive Elements
- Buttons: Replace with `getByRole('button', { name: /pattern/i })`
- Switches: Replace with `getByRole('switch', { name: /pattern/i })`
- Inputs: Use `getByLabelText()` or `getByPlaceholderText()`

### Priority 2: Loading States
- Loading indicators: `getByRole('progressbar', { name: /loading/i })`
- Skeleton loaders: `getByRole('progressbar', { name: /loading/i })`

### Priority 3: Content Elements
- Cards: `getByRole('button', { name: /pattern/i })` if clickable
- Empty states: `getByText()` for content, `getByRole('heading')` for titles
- FABs: `getByRole('button', { name: /create|add/i })`

## Exceptions (When to Keep getByTestId)
1. **Dynamic Content**: Elements with frequently changing text where role is stable
2. **Complex Components**: Custom components without clear semantic role
3. **Performance Critical**: Where query performance is a concern
4. **Visual Testing**: When testing specific visual layout rather than behavior

## Next Steps
1. Update test infrastructure with accessibility helpers
2. Migrate high-priority files (SmartAlbumsScreen, MemoriesScreen)
3. Update documentation with guidelines
4. Add accessibility assertions to validate screen reader compatibility

---
*Generated on: 2026-03-15*
*Total Files Audited: 14*
*Files Requiring Updates: 4*
