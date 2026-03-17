# Cloud Gallery TODO

Based on WCAG 2.1 AA accessibility standards analysis and gap assessment, this document tracks implementation priorities to elevate the accessibility compliance from current state to WCAG AA compliant.

---

## [ ] A11Y-001: Add Accessibility Labels to Photo Grid Items

### Definition of Done
- [ ] All photo items in PhotoGrid have descriptive accessibilityLabel
- [ ] Labels include meaningful content description (date, location, or "Photo from [date]")
- [ ] Screen reader testing confirms proper announcement
- [ ] Accessibility testing suite passes for photo grid
- [ ] No performance impact on photo rendering

### Out of Scope
- Complex AI-generated image descriptions
- Face recognition-based descriptions
- Real-time content analysis
- User-customizable photo descriptions
- Multi-language support for descriptions

### Strict Rules to Follow
- Must use accessibilityLabel prop (not aria-label in React Native)
- Labels must be non-empty strings
- Cannot break existing photo grid performance
- Must maintain backward compatibility
- Labels should be concise but informative

### Existing Code Patterns
```typescript
// client/components/PhotoGrid.tsx:94-99
<Image
  source={{ uri: photo.uri }}
  style={styles.photo}
  contentFit="cover"
  transition={200}
/>
```

```typescript
// client/components/Button.tsx:69-90
<AnimatedPressable
  onPress={disabled ? undefined : onPress}
  onPressIn={handlePressIn}
  onPressOut={handlePressOut}
  disabled={disabled}
  style={[styles.button, { backgroundColor: theme.link, opacity: disabled ? 0.5 : 1 }, style, animatedStyle]}
>
```

### Advanced Code Patterns
```typescript
// Generate meaningful photo descriptions
const generatePhotoAccessibilityLabel = (photo: Photo): string => {
  const date = new Date(photo.createdAt).toLocaleDateString();
  const location = photo.metadata?.location;
  
  if (location) {
    return `Photo from ${date} taken in ${location}`;
  }
  return `Photo from ${date}`;
};

// Apply to photo items
<Image
  source={{ uri: photo.uri }}
  style={styles.photo}
  contentFit="cover"
  transition={200}
  accessibilityLabel={generatePhotoAccessibilityLabel(photo)}
/>
```

### Anti-Patterns
- ❌ Using generic labels like "Photo" or "Image"
- ❌ Leaving accessibilityLabel empty or undefined
- ❌ Adding accessibilityLabel to decorative images only
- ❌ Using overly complex or technical descriptions
- ❌ Hardcoding labels without considering photo metadata

---

## Subtasks

#### [ ] A11Y-001-1: Create Photo Description Utility Function
**Target Files**: `client/lib/photo-descriptions.ts`, `client/components/PhotoGrid.tsx`
**Related Files**: `client/types/index.ts`, `client/lib/storage.ts`

#### [ ] A11Y-001-2: Update PhotoGrid Component with Labels
**Target Files**: `client/components/PhotoGrid.tsx`
**Related Files**: `client/components/PhotoItem.tsx`, `client/types/index.ts`

#### [ ] A11Y-001-3: Add Accessibility Tests for Photo Grid
**Target Files**: `client/components/PhotoGrid.test.tsx`, `client/test-utils/accessibility.ts`
**Related Files**: `client/components/PhotoGrid.tsx`, `vitest.config.ts`

---

## [ ] A11Y-002: Add Form Accessibility Labels and Associations

### Definition of Done
- [ ] All form inputs have proper accessibilityLabel
- [ ] Form inputs have accessibilityHint for context
- [ ] Visible labels are properly associated with inputs
- [ ] Error messages are announced to screen readers
- [ ] Form validation provides accessible feedback

### Out of Scope
- Complete form redesign
- Advanced validation patterns
- Multi-step form wizards
- Custom form components
- Real-time validation feedback

### Strict Rules to Follow
- Must use accessibilityLabel for all TextInput elements
- Must maintain accessibility for both sighted and non-sighted users
- Cannot break existing form functionality
- Must support both light and dark themes
- Labels must match visible text when present

### Existing Code Patterns
```typescript
// client/screens/LoginScreen.tsx:53-77
<TextInput
  style={[styles.input, { backgroundColor: theme.backgroundDefault, color: colors.text }]}
  placeholder="Email"
  placeholderTextColor={colors.textSecondary}
  value={email}
  onChangeText={setEmail}
  autoCapitalize="none"
  keyboardType="email-address"
  editable={!submitting}
/>
```

### Advanced Code Patterns
```typescript
// Accessible form input with proper labeling
<TextInput
  style={[styles.input, { backgroundColor: theme.backgroundDefault, color: colors.text }]}
  placeholder="Email"
  placeholderTextColor={colors.textSecondary}
  value={email}
  onChangeText={setEmail}
  autoCapitalize="none"
  keyboardType="email-address"
  editable={!submitting}
  accessibilityLabel="Email address input"
  accessibilityHint="Enter your email address to sign in"
  accessibilityRole="textbox"
/>
```

### Anti-Patterns
- ❌ Using placeholder as the only accessibility label
- ❌ Adding accessibilityLabel that doesn't match visible labels
- ❌ Forgetting accessibilityRole for form inputs
- ❌ Not providing context through accessibilityHint
- ❌ Ignoring error message accessibility

---

## Subtasks

#### [ ] A11Y-002-1: Update LoginScreen Form Accessibility
**Target Files**: `client/screens/LoginScreen.tsx`
**Related Files**: `client/screens/RegisterScreen.tsx`, `client/screens/ForgotPasswordScreen.tsx`

#### [ ] A11Y-002-2: Add Accessibility to Registration Form
**Target Files**: `client/screens/RegisterScreen.tsx`
**Related Files**: `client/screens/LoginScreen.tsx`, `client/components/ThemedText.tsx`

#### [ ] A11Y-002-3: Create Accessible Form Component Library
**Target Files**: `client/components/AccessibleTextInput.tsx`, `client/components/AccessibleButton.tsx`
**Related Files**: `client/components/Button.tsx`, `client/test-utils/accessibility.ts`

---

## [ ] A11Y-003: Add Semantic Roles to Interactive Elements

### Definition of Done
- [ ] All Pressable elements have appropriate accessibilityRole
- [ ] Album cards use accessibilityRole="button"
- [ ] Interactive elements have proper accessibilityLabel
- [ ] Custom components follow semantic HTML patterns
- [ ] Screen reader navigation works correctly

### Out of Scope
- Complete component library rewrite
- Advanced gesture handling
- Custom accessibility roles
- Complex navigation patterns
- Voice control integration

### Strict Rules to Follow
- Must use accessibilityRole="button" for button-like Pressable elements
- Cannot break existing touch interactions
- Must maintain TV platform compatibility
- Labels must be descriptive and unique
- Cannot add unnecessary roles to decorative elements

### Existing Code Patterns
```typescript
// client/components/AlbumCard.tsx:59-101
<AnimatedPressable
  onPress={() => onPress(album)}
  onPressIn={handlePressIn}
  onPressOut={handlePressOut}
  onLongPress={handleLongPress}
  delayLongPress={300}
  style={[styles.container, { backgroundColor: theme.backgroundDefault }, animatedStyle]}
  testID={`album-card-${album.id}`}
>
```

### Advanced Code Patterns
```typescript
// Semantically correct interactive element
<AnimatedPressable
  onPress={() => onPress(album)}
  onPressIn={handlePressIn}
  onPressOut={handlePressOut}
  onLongPress={handleLongPress}
  delayLongPress={300}
  style={[styles.container, { backgroundColor: theme.backgroundDefault }, animatedStyle]}
  testID={`album-card-${album.id}`}
  accessibilityRole="button"
  accessibilityLabel={`Album: ${album.title} with ${album.photoIds.length} photos`}
  accessibilityHint="Opens album to view photos"
>
```

### Anti-Patterns
- ❌ Using Pressable without accessibilityRole for button-like actions
- ❌ Adding accessibilityRole to non-interactive elements
- ❌ Using generic labels like "Button" or "Press me"
- ❌ Forgetting accessibilityHint for complex actions
- ❌ Breaking TV navigation with improper roles

---

## Subtasks

#### [ ] A11Y-003-1: Update AlbumCard Component Accessibility
**Target Files**: `client/components/AlbumCard.tsx`
**Related Files**: `client/components/PhotoGrid.tsx`, `client/screens/AlbumsScreen.tsx`

#### [ ] A11Y-003-2: Add Semantic Roles to Photo Grid Items
**Target Files**: `client/components/PhotoGrid.tsx`
**Related Files**: `client/components/AlbumCard.tsx`, `client/screens/PhotosScreen.tsx`

#### [ ] A11Y-003-3: Update Floating Action Button Accessibility
**Target Files**: `client/components/FloatingActionButton.tsx`
**Related Files**: `client/screens/PhotosScreen.tsx`, `client/components/Button.tsx`

---

## [ ] A11Y-004: Implement Mobile Keyboard Navigation

### Definition of Done
- [ ] Tab navigation works through all interactive elements
- [ ] Focus indicators are clearly visible
- [ ] Enter/Space keys activate buttons and links
- [ ] Arrow keys navigate within grids and lists
- [ ] Escape key closes modals and dialogs

### Out of Scope
- Complete keyboard navigation overhaul
- Custom keyboard shortcuts
- Advanced focus management
- Keyboard macros
- Voice navigation

### Strict Rules to Follow
- Must not break existing TV navigation
- Must maintain touch interaction functionality
- Focus indicators must meet WCAG contrast requirements
- Cannot interfere with system keyboard behavior
- Must work across all supported platforms

### Existing Code Patterns
```typescript
// client/tv/TVGalleryScreen.tsx:90-106
// Refs for TV navigation
const videoRef = useRef<Video>(null);
const flatListRef = useRef<FlatList>(null);
const searchInputRef = useRef<TextInput>(null);
```

### Advanced Code Patterns
```typescript
// Keyboard navigation hook for mobile
const useKeyboardNavigation = (enabled: boolean = Platform.OS !== 'web') => {
  useEffect(() => {
    if (!enabled) return;

    const handleTab = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        // Implement tab navigation logic
      }
    };

    const handleEnter = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        // Activate focused element
      }
    };

    document.addEventListener('keydown', handleTab);
    document.addEventListener('keydown', handleEnter);

    return () => {
      document.removeEventListener('keydown', handleTab);
      document.removeEventListener('keydown', handleEnter);
    };
  }, [enabled]);
};
```

### Anti-Patterns
- ❌ Breaking TV navigation when adding mobile keyboard support
- ❌ Using focus traps incorrectly
- ❌ Forgetting to handle Escape key for modals
- ❌ Not providing visible focus indicators
- ❌ Ignoring platform-specific keyboard behavior

---

## Subtasks

#### [ ] A11Y-004-1: Create Keyboard Navigation Hook
**Target Files**: `client/hooks/useKeyboardNavigation.ts`
**Related Files**: `client/tv/TVGalleryScreen.tsx`, `client/hooks/useTheme.ts`

#### [ ] A11Y-004-2: Add Focus Management to Photo Grid
**Target Files**: `client/components/PhotoGrid.tsx`
**Related Files**: `client/components/AlbumCard.tsx`, `client/screens/PhotosScreen.tsx`

#### [ ] A11Y-004-3: Implement Keyboard Navigation in Forms
**Target Files**: `client/screens/LoginScreen.tsx`, `client/screens/RegisterScreen.tsx`
**Related Files**: `client/components/AccessibleTextInput.tsx`, `client/hooks/useKeyboardNavigation.ts`

---

## [ ] A11Y-005: Implement Color Contrast Monitoring

### Definition of Done
- [ ] All text combinations meet WCAG AA contrast (4.5:1 normal, 3:1 large)
- [ ] Interactive elements have sufficient focus contrast
- [ ] Automated contrast testing in CI/CD pipeline
- [ ] Theme system validates contrast ratios
- [ ] Documentation includes contrast requirements

### Out of Scope
- Complete visual redesign
- Advanced color theory implementation
- User-customizable color themes
- Dynamic contrast adjustment
- Color blindness simulation

### Strict Rules to Follow
- Must maintain existing visual design intent
- Cannot break light/dark theme functionality
- Must test all color combinations in theme
- Cannot impact performance significantly
- Must support TV platform requirements

### Existing Code Patterns
```typescript
// client/constants/theme.ts:14-48
export const Colors = {
  light: {
    text: "#1A202C",
    textSecondary: "#718096",
    buttonText: "#FFFFFF",
    backgroundDefault: "#FFFFFF",
    // ... more colors
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#A0AEC0",
    buttonText: "#FFFFFF",
    backgroundDefault: "#2D3748",
    // ... more colors
  },
};
```

### Advanced Code Patterns
```typescript
// Contrast validation utility
const validateContrast = (foreground: string, background: string, isLarge: boolean = false): boolean => {
  const ratio = calculateContrastRatio(foreground, background);
  const minimumRatio = isLarge ? 3.0 : 4.5;
  return ratio >= minimumRatio;
};

// Theme validation
const validateTheme = (theme: ColorTheme): ValidationResult => {
  const issues: string[] = [];
  
  if (!validateContrast(theme.text, theme.backgroundDefault)) {
    issues.push('Text on background default fails contrast');
  }
  
  if (!validateContrast(theme.buttonText, theme.accent)) {
    issues.push('Button text on accent fails contrast');
  }
  
  return { isValid: issues.length === 0, issues };
};
```

### Anti-Patterns
- ❌ Hardcoding contrast values without validation
- ❌ Only testing light theme contrast
- ❌ Ignoring focus state contrast
- ❌ Using color as the only indicator of state
- ❌ Not testing edge cases in color combinations

---

## Subtasks

#### [ ] A11Y-005-1: Create Contrast Validation Utility
**Target Files**: `client/lib/contrast-validation.ts`, `client/constants/theme.ts`
**Related Files**: `client/hooks/useTheme.ts`, `client/test-utils/accessibility.ts`

#### [ ] A11Y-005-2: Add Automated Contrast Testing
**Target Files**: `scripts/test-contrast.js`, `client/test-utils/accessibility.ts`
**Related Files**: `vitest.config.ts`, `package.json`, `.github/workflows/accessibility.yml`

#### [ ] A11Y-005-3: Update Theme System with Contrast Validation
**Target Files**: `client/constants/theme.ts`, `client/hooks/useTheme.ts`
**Related Files**: `client/lib/contrast-validation.ts`, `client/components/ThemedText.tsx`

---

## Implementation Priority

1. **A11Y-001**: Add Accessibility Labels to Photo Grid Items (Critical - WCAG 1.1.1)
2. **A11Y-002**: Add Form Accessibility Labels and Associations (Critical - WCAG 3.3.2)
3. **A11Y-003**: Add Semantic Roles to Interactive Elements (High - WCAG 4.1.2)
4. **A11Y-005**: Implement Color Contrast Monitoring (Medium - WCAG 1.4.3)
5. **A11Y-004**: Implement Mobile Keyboard Navigation (Medium - WCAG 2.1.1)

## Notes

- All accessibility improvements must maintain TV platform compatibility
- Use existing accessibility testing infrastructure in `client/test-utils/accessibility.ts`
- Follow React Native accessibility patterns, not web ARIA patterns
- Test with actual screen readers (VoiceOver, TalkBack) during development
- Document any accessibility-specific component props for future reference
- Consider accessibility impact when adding new features or components
