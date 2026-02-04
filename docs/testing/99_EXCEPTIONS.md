# Coverage Exceptions

Documented exceptions to the 100% coverage requirement with justifications and mitigation strategies.

## Overview

While we maintain **100% coverage for all first-party, non-generated code**, certain files are **explicitly excluded** from coverage requirements. This document lists all exceptions, their justifications, and how we mitigate the risks.

## Exception Categories

### 1. Platform Bootstrap Files

Files that initialize the platform runtime and cannot be practically unit tested.

#### `client/index.js`

**What it is**: Expo app registration entry point

**Why excluded**:
- Single line: `registerRootComponent(App)`
- Expo platform initialization
- Requires full React Native runtime
- No business logic to test

**Code**:
```javascript
import { registerRootComponent } from "expo";
import App from "@/App";
registerRootComponent(App);
```

**Mitigation**:
- Verified through E2E testing (app launches)
- Validated in Expo development mode
- No business logic to introduce bugs

**Risk**: Low - Boilerplate code, rarely changes

---

#### `client/App.tsx`

**What it is**: React Native root component with provider setup

**Why excluded**:
- Provider composition (declarative JSX)
- No business logic
- Testing requires full RN runtime with all providers

**Code structure**:
```tsx
export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider>
        <SafeAreaProvider>
          <GestureHandlerRootView>
            <KeyboardProvider>
              <NavigationContainer>
                <RootStackNavigator />
              </NavigationContainer>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

**Mitigation**:
- Provider composition is declarative
- Each provider is tested in isolation
- Integration verified through E2E tests

**Risk**: Low - Composition only, no logic

---

#### `server/index.ts`

**What it is**: Express server bootstrap and middleware setup

**Why excluded**:
- Server initialization wrapped in IIFE
- Middleware configuration
- Express server startup
- Requires actual HTTP server for integration testing

**What IS tested**:
- Individual middleware functions (unit tests in `server/index.test.ts`)
- CORS logic
- Request logging logic
- Error handling logic
- Manifest serving logic
- Landing page template logic

**Mitigation**:
- All middleware logic extracted and unit tested
- Individual functions have 100% coverage
- Integration tested via manual server startup
- E2E tests validate end-to-end flows

**Risk**: Medium - Some integration complexity, mitigated by unit tests

---

### 2. UI Components

React Native components that are primarily JSX/styling with minimal logic.

#### `client/components/**`

**What they are**: Reusable UI components

**Why excluded**:
- Primarily JSX markup and StyleSheet definitions
- Minimal business logic (already extracted to hooks/lib)
- Require React Native Test Renderer + full mock environment
- Visual testing better suited for E2E/snapshot tests

**Examples**:
- `Button.tsx`: Styled button component
- `Card.tsx`: Layout component
- `ThemedText.tsx`: Text with theme support
- `PhotoGrid.tsx`: Photo layout grid

**Mitigation**:
- Business logic extracted to `client/lib/*` (100% covered)
- Visual testing through development mode
- E2E tests cover user interactions
- Components follow established patterns

**Risk**: Low - Logic extracted, visual only

---

#### `client/screens/**`

**What they are**: Screen-level components

**Why excluded**:
- Composition of smaller components
- Navigation integration
- Primarily layout and rendering
- Require full navigation context and RN environment

**Examples**:
- `PhotosScreen.tsx`
- `AlbumsScreen.tsx`
- `ProfileScreen.tsx`

**Mitigation**:
- Data fetching logic in `client/lib/*` (100% covered)
- State management in hooks (tested separately)
- E2E tests cover complete user flows
- Follows established screen patterns

**Risk**: Low - Composition only

---

#### `client/navigation/**`

**What they are**: React Navigation configuration

**Why excluded**:
- Declarative navigation setup
- Navigator configuration
- Screen registration
- Requires React Navigation runtime

**Examples**:
- `RootStackNavigator.tsx`
- `MainTabNavigator.tsx`

**Mitigation**:
- Configuration is declarative
- Navigation tested through E2E tests
- Follows React Navigation patterns

**Risk**: Low - Configuration only

---

### 3. Type Definitions

Pure TypeScript types with no runtime code.

#### `client/types/**`

**What they are**: TypeScript interface definitions

**Why excluded**:
- No runtime code
- Types are erased during compilation
- Type checking happens at compile-time

**Example**:
```typescript
export interface Photo {
  id: string;
  uri: string;
  width: number;
  height: number;
}
```

**Mitigation**:
- TypeScript compiler validates usage
- Runtime behavior tested through actual usage
- Type errors caught at compile-time

**Risk**: None - No runtime code

---

### 4. Static Data

Constants and theme definitions.

#### `client/constants/**`

**What they are**: Theme colors, static configuration

**Why excluded**:
- Static data definitions
- No executable logic
- Cannot be "covered" (no branches to test)

**Example**:
```typescript
export const Colors = {
  light: {
    text: "#000",
    background: "#fff",
  },
  dark: {
    text: "#fff",
    background: "#000",
  },
};
```

**Mitigation**:
- Values validated through visual testing
- Used by tested components
- TypeScript ensures structure

**Risk**: None - Static data only

---

### 5. Platform-Specific Hooks

React hooks with tight platform coupling.

#### `client/hooks/**`

**What they are**: Custom React hooks

**Why excluded**:
- Depend on React Native runtime
- Platform-specific implementations (.web.ts, .native.ts)
- Require extensive platform mocking
- Logic already tested through consuming components

**Examples**:
- `useColorScheme.ts`: Re-export of RN hook
- `useColorScheme.web.ts`: Web-specific with hydration
- `useTheme.ts`: Theme hook using above
- `useScreenOptions.ts`: Navigation options

**Mitigation**:
- Minimal logic (mostly composition)
- Tested through component integration
- Platform specifics validated in development
- Follow established React patterns

**Risk**: Low - Simple hooks, tested via consumers

---

## Summary of Exclusions

| Path | Category | Reason | Risk | Mitigation |
|------|----------|--------|------|-----------|
| `client/index.js` | Bootstrap | Expo initialization | Low | E2E tests |
| `client/App.tsx` | Bootstrap | Provider composition | Low | E2E tests |
| `server/index.ts` | Bootstrap | Server initialization | Medium | Unit tests of functions |
| `client/components/**` | UI | JSX/styling | Low | Logic extracted |
| `client/screens/**` | UI | Layout composition | Low | E2E tests |
| `client/navigation/**` | UI | Navigation config | Low | E2E tests |
| `client/types/**` | Types | No runtime code | None | TypeScript |
| `client/constants/**` | Data | Static values | None | Visual testing |
| `client/hooks/**` | Platform | RN-specific | Low | Integration tests |

## What IS Covered (100%)

These critical modules have **mandatory 100% coverage**:

### Client Business Logic
- ✅ `client/lib/storage.ts` - AsyncStorage operations
- ✅ `client/lib/query-client.ts` - API client and error handling

### Server Business Logic
- ✅ `server/routes.ts` - Route registration
- ✅ `server/storage.ts` - In-memory storage implementation

### Shared Code
- ✅ `shared/schema.ts` - Data validation and schema definitions

## Exception Policy

### When to Add an Exception

Exceptions are **rare** and must meet ALL criteria:

1. **No business logic**: File contains only configuration, UI, or platform code
2. **Cannot be unit tested**: Requires full platform runtime
3. **Properly mitigated**: Logic extracted to testable modules OR covered by E2E tests
4. **Documented**: Added to this file with justification
5. **Approved**: Reviewed by tech lead

### When NOT to Add an Exception

Do NOT add exceptions for:
- ❌ Complex business logic
- ❌ Data transformations
- ❌ API interactions
- ❌ Storage operations
- ❌ Validation logic
- ❌ Error handling
- ❌ "It's hard to test" (extract logic instead!)

### Adding a New Exception

1. **Extract logic**: Move business logic to testable module
2. **Document**: Add to this file with:
   - What it is
   - Why it can't be tested
   - Risk level
   - Mitigation strategy
3. **Update config**: Add to `vitest.config.ts` exclusions
4. **Get approval**: PR review by tech lead
5. **Monitor**: Review exceptions quarterly

## Mitigation Strategies

### E2E Testing

UI components are validated through:
- Manual testing in Expo development mode
- Visual regression tests (planned)
- User acceptance testing

### Logic Extraction

Business logic is extracted from UI:
```
❌ Before (untestable):
<Screen>
  {photos.map(p => {
    // Complex logic here
    const grouped = groupByDate(p);
    return <Photo />
  })}
</Screen>

✅ After (testable):
// In client/lib/storage.ts (100% covered)
export function groupPhotosByDate(photos: Photo[]) {
  // Complex logic here - fully tested
}

// In Screen (UI only)
<Screen>
  {groupPhotosByDate(photos).map(group => <Photo />)}
</Screen>
```

### Integration Validation

- Development mode testing
- Manual QA for each PR
- Production monitoring

## Monitoring Exceptions

### Quarterly Review

Every quarter, review exceptions to:
1. **Minimize**: Can any exceptions be eliminated?
2. **Validate**: Are mitigation strategies working?
3. **Update**: Has risk level changed?

### Metrics to Track

- **Number of exceptions**: Should stay constant or decrease
- **Lines excluded**: Should not grow significantly
- **E2E test coverage**: Should increase over time

## Conclusion

While we maintain 100% coverage for all business logic, certain platform-specific and UI files are excluded with:

- ✅ Clear justifications
- ✅ Low risk profiles
- ✅ Strong mitigation strategies
- ✅ Regular reviews

**Goal**: Exceptions are **minimized**, **documented**, and **actively managed**.

## Questions?

- Why is X excluded? Check table above
- Can I exclude Y? Follow exception policy
- How do I add logic? Extract to `client/lib/*` or `server/*`
