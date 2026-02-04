# Architecture Decision Records (ADRs)

[← Back to Architecture Index](../architecture/00_INDEX.md)

## About ADRs

Architecture Decision Records document **why** important technical decisions were made. Each ADR captures:

- **Context**: What situation prompted the decision
- **Decision**: What was decided
- **Consequences**: Tradeoffs and implications
- **Status**: Accepted, Superseded, or Deprecated

## Format

Each ADR should follow this structure:

```markdown
# ADR-{NUMBER}: {Title}

**Status**: Accepted | Superseded | Deprecated  
**Date**: YYYY-MM-DD  
**Deciders**: Team/Person who made the decision

## Context

What is the issue we're facing? What constraints exist?

## Decision

What did we decide to do?

## Consequences

**Positive**:
- What benefits do we get?

**Negative**:
- What tradeoffs did we accept?

**Neutral**:
- What else changed?

## Alternatives Considered

What other options did we evaluate and why were they rejected?
```

---

## Current ADRs

### ADR-001: Use AsyncStorage for MVP Data Persistence

**Status**: Accepted  
**Date**: 2026-01-15 (estimated)  
**Context**: MVP needs local data storage  

**Decision**:  
Use React Native AsyncStorage for storing photos, albums, and user profile data locally on device.

**Rationale**:
- Simple API, no setup required
- Native to React Native ecosystem
- Sufficient for MVP (<1000 photos)
- Enables offline-first experience

**Consequences**:

✅ **Positive**:
- Zero backend infrastructure needed
- Works offline by default
- Fast development iteration
- No database costs

❌ **Negative**:
- Storage limits (~6-10MB)
- No multi-device sync
- Data lost on app uninstall
- No data backup
- Performance degrades with large datasets

**Alternatives Considered**:
- **SQLite**: More storage, better performance, but more complex
- **Realm**: Overkill for MVP, steeper learning curve
- **PostgreSQL**: Requires backend, slower development

**Migration Path**: When scaling beyond MVP, migrate to PostgreSQL with Drizzle ORM (schema already defined in `/shared/schema.ts`)

**Evidence**: `/client/lib/storage.ts`

---

### ADR-002: Bidirectional Photo-Album Relationships

**Status**: Accepted  
**Date**: 2026-01-20 (estimated)  
**Context**: Need efficient queries in both directions (photos in album, albums for photo)

**Decision**:  
Maintain bidirectional references where photos store `albumIds[]` AND albums store `photoIds[]`.

**Rationale**:
- Fast lookups: "Show me all albums for this photo"
- Fast lookups: "Show me all photos in this album"
- No database queries needed (using AsyncStorage)
- Enables cascading deletes

**Consequences**:

✅ **Positive**:
- O(1) lookups for photo → albums
- O(1) lookups for album → photos
- No N+1 query problems

❌ **Negative**:
- Must maintain consistency manually
- Every update touches two arrays
- Risk of desync if update fails partway
- More storage (IDs stored twice)

**Alternatives Considered**:
- **Single direction**: Would require scanning entire photos array for each album query
- **Junction table**: Overkill for in-memory data, would complicate AsyncStorage
- **Nested objects**: Would duplicate entire photo objects, waste storage

**Validation**: All CRUD operations in `/client/lib/storage.ts` maintain both sides

**Evidence**: 
- Types: `/client/types/index.ts` line 11-32
- Implementation: `/client/lib/storage.ts` line 106-180

---

### ADR-003: React Navigation for Routing

**Status**: Accepted  
**Date**: 2026-01-10 (estimated)  
**Context**: Need navigation solution for multi-screen mobile app

**Decision**:  
Use React Navigation v7 with native stack and tab navigators.

**Rationale**:
- De facto standard for React Native
- Native performance via react-native-screens
- Type-safe with TypeScript
- Well-maintained and documented
- Supports modal presentation

**Consequences**:

✅ **Positive**:
- Native animations and gestures
- Deep linking support
- Type-safe navigation params
- Large ecosystem

❌ **Negative**:
- Learning curve for nested navigators
- Verbose type definitions
- Performance requires proper configuration

**Alternatives Considered**:
- **Expo Router**: Too new, less stable
- **React Router Native**: Less native feel
- **Custom navigation**: Reinventing the wheel

**Evidence**: `/client/navigation/*.tsx` files

---

### ADR-004: Expo for Mobile Development

**Status**: Accepted  
**Date**: 2026-01-05 (estimated)  
**Context**: Need cross-platform mobile development framework

**Decision**:  
Use Expo SDK 54 as development platform and workflow.

**Rationale**:
- Faster development (no Xcode/Android Studio setup)
- Built-in modules (image picker, media library, haptics)
- OTA updates (future)
- Web support included
- Simplified build process

**Consequences**:

✅ **Positive**:
- Rapid prototyping
- Works on Replit (cloud development)
- Simplified native module access
- Cross-platform by default

❌ **Negative**:
- Larger app bundle size
- Less control over native code
- Expo Go limitations for custom native modules
- Must use Expo-compatible libraries

**Alternatives Considered**:
- **React Native CLI**: More control, steeper setup
- **Flutter**: Different language (Dart)
- **Native iOS/Android**: Too slow for MVP

**Evidence**: `/app.json`, `/package.json` expo dependencies

---

### ADR-005: React Query for State Management

**Status**: Accepted  
**Date**: 2026-01-22 (estimated)  
**Context**: Need to manage data fetching and caching from AsyncStorage

**Decision**:  
Use React Query (TanStack Query) for data synchronization and caching.

**Rationale**:
- Automatic background refetching
- Built-in cache invalidation
- Optimistic updates
- Loading/error states handled
- Reduces boilerplate vs Redux

**Consequences**:

✅ **Positive**:
- Less code for data fetching
- Automatic cache management
- Better UX (background updates)
- Easy query invalidation

❌ **Negative**:
- Another dependency to learn
- Overkill for purely local data
- Can be over-complicated for simple cases

**Alternatives Considered**:
- **Redux**: Too much boilerplate for local data
- **Context API**: No caching or refetch logic
- **Zustand**: Simpler but missing data fetching features
- **No state lib**: Would need manual cache management

**Evidence**: 
- Setup: `/client/lib/query-client.ts`
- Usage: Screens import `useQuery` hooks

---

## Superseded ADRs

None yet. When an ADR is replaced, it moves here with a link to the new ADR.

---

## Deprecated ADRs

None yet. When a decision is no longer relevant, it moves here.

---

## How to Add New ADRs

1. **Copy the template** above
2. **Number sequentially**: Next ADR is ADR-006
3. **Fill in all sections**: Don't skip consequences or alternatives
4. **Link evidence**: Point to files/lines of code
5. **Create file**: `docs/adr/ADR-{NUMBER}-{title-slug}.md`
6. **Update this index**: Add entry to "Current ADRs" section

### When to Write an ADR

Write an ADR when:
- ✅ Choosing a major library or framework
- ✅ Deciding architecture patterns
- ✅ Making tradeoffs that affect multiple modules
- ✅ Choosing between 2+ viable options
- ✅ Decision will be hard to reverse

Don't write an ADR for:
- ❌ Minor library choices (date formatting, etc.)
- ❌ Obvious decisions with no alternatives
- ❌ Implementation details (how to name a function)
- ❌ Temporary workarounds

---

## ADR Review Process

1. **Draft ADR**: Create markdown file with context and options
2. **Team Review**: Share with team for feedback
3. **Revise**: Update based on discussion
4. **Approve**: Mark as "Accepted" with date
5. **Implement**: Make the code changes
6. **Link**: Add references from code comments to ADR

---

## Evidence Files

**ADR Decisions Implemented**:
- AsyncStorage: `/client/lib/storage.ts`
- Bidirectional relationships: `/client/types/index.ts`
- React Navigation: `/client/navigation/*.tsx`
- Expo: `/app.json`, `/package.json`
- React Query: `/client/lib/query-client.ts`

**Configuration**:
- Dependencies: `/package.json`
- TypeScript: `/tsconfig.json`

---

[← Back to Architecture Index](../architecture/00_INDEX.md)
