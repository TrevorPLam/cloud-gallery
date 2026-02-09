# Action Items: Updating Original Three Documents

**Document created:** 2026-02-08  
**Related Analysis:** [02_2026_COMPETITIVE_ANALYSIS_AND_RECOMMENDATIONS.md](./02_2026_COMPETITIVE_ANALYSIS_AND_RECOMMENDATIONS.md)

This document lists **specific sections to update** in the original design.md, requirements.md, and tasks.md files based on competitive analysis.

---

## File 1: design.md

### Section 1.2 - Technology Stack (UPDATE)

**Current:**
```
**ML/AI:**
- TensorFlow Lite (on-device mobile)
- TensorFlow.js (web)
- Cloud ML APIs (Google Vision, AWS Rekognition) as fallback
- ONNX Runtime (cross-platform inference)
```

**Update To:**
```
**ML/AI:**
- TensorFlow Lite (on-device): Object detection, scene detection, face detection
- TensorFlow.js (web): Same on-device processing
- Cloud ML APIs: 
  - Object/Scene/Face Detection: Google Cloud Vision API
  - Generative Editing: Replicate.com or Stability AI
  - Text Search: Gemini API for conversational queries
- Local Processing: Prioritized for privacy-sensitive operations
```

**Rationale:** Explicitly calls out generative AI requirement and Gemini integration

### Section 3.1 - New API Endpoints (UPDATE)

**Add New Section:**

```typescript
#### Generative Editing APIs

```typescript
// POST /api/photos/:id/edit/generate
// Apply generative AI edits using text prompts
Request: { 
  prompt: "remove the fence",  // e.g., "change sky to sunset"
  strength?: number,            // 0.5-1.0, effect intensity
  mask?: base64                 // Optional mask for region-specific edits
}
Response: { 
  editId: string,
  previewUri: string,           // Low-res preview
  status: "processing" | "complete" | "failed"
}

// GET /api/photos/:id/edit/generate/:editId
// Check generative edit status
Response: {
  status: "processing" | "complete" | "failed",
  editedUri?: string,
  progress?: number             // 0-100 for long operations
}

// POST /api/photos/:id/edit/magic-eraser
// One-tap object removal
Request: {
  boundingBox: { x, y, width, height }  // Area to remove
}
Response: {
  editId: string,
  previewUri: string
}

// POST /api/photos/:id/edit/background-replace
// Replace photo background
Request: {
  prompt: "beach sunset"  // Desired background description
}
Response: {
  editId: string,
  previewUri: string
}
```

#### Gemini Search API

```typescript
// POST /api/photos/ask
// Query your photo library conversationally
Request: {
  question: "What photos did I take at the beach last summer?",
  context?: string              // Optional previous questions for context
}
Response: {
  answer: string,               // Natural language answer
  suggestedPhotos: Photo[],     // Relevant photos from library
  clarifications?: string[]     // Follow-up questions if ambiguous
}
```

#### Video APIs (MOVED UP FROM PHASE 5)

```typescript
// POST /api/videos/:id/thumbnail
// Generate thumbnail at specific timestamp
Request: {
  timestamp: 2.5                // Seconds into video
}
Response: {
  thumbnailUri: string
}

// GET /api/videos/:id/metadata
// Get video properties
Response: {
  duration: number,             // Seconds
  width: number,
  height: number,
  fps: number,
  bitrate: number,
  codec: string
}
```

**Rationale:** Explicitly lists 2026 must-have APIs

### Section 4.1 - On-Device ML Pipeline (UPDATE)

**Current:**
```
class PhotoAnalyzer {
  private objectDetector: ObjectDetector;
  private faceDetector: FaceDetector;
  private ocrEngine: OCREngine;
```

**Update To:**
```
class PhotoAnalyzer {
  private objectDetector: ObjectDetector;       // Local TFLite
  private faceDetector: FaceDetector;           // Local TFLite  
  private ocrEngine: OCREngine;                 // Local TFLite
  private generativeClient: GenerativeAIClient; // Cloud-based
  
  // Continue supporting local processing for privacy
  // But handle cloud fallback when needed
```

**Rationale:** Clarifies dual local/cloud ML approach

### Section 5 - Client Architecture (ADD SUBSECTION)

**Add New Section 5.5: Offline-First Design**

```typescript
// client/lib/offline/offline-manager.ts

class OfflineManager {
  /**
   * Offline-first architecture:
   * 1. All reads come from local cache first
   * 2. Writes queue for sync when online
   * 3. Metadata indexed locally for search
   * 4. High-resolution photos lazy-downloaded
   */
  
  async getPhoto(id: string): Promise<Photo> {
    // Check local cache first
    const cached = await this.getLocalPhoto(id);
    if (cached) return cached;
    
    // Fall back to server if online
    if (this.isOnline) {
      return await this.fetchFromServer(id);
    }
    
    // Return placeholder or cached metadata if offline
    return this.getOfflineUnavailable(id);
  }
  
  async searchOffline(query: string): Promise<Photo[]> {
    // Search local index (metadata cached)
    return await this.localIndex.search(query);
  }
  
  async editPhotoOffline(photoId: string, edit: Edit): Promise<string> {
    // Queue edit for sync
    await this.syncQueue.add({
      type: 'edit',
      photoId,
      edit,
      timestamp: Date.now()
    });
    
    // Apply edit to local cache preview
    return await this.applyEditLocally(photoId, edit);
  }
}
```

**Rationale:** Explains offline-first as architectural decision, not feature

### Section 7.1 - New Screens (ADD)

**Add:**

```typescript
// GeminiSearchScreen.tsx
/**
 * Chat-based photo discovery powered by Gemini
 * 
 * Features:
 * - Natural language questions: "What beaches did I visit?"
 * - Conversational context: Previous questions inform suggestions
 * - Visual results: Suggested photos appear below answer
 * - Smart refining: "Show me the ones with John"
 * 
 * Design:
 * - Chat bubbles (user question, Gemini answer)
 * - Suggested photos carousel below
 * - Tap photo to view full-screen
 */
```

**Rationale:** Highlights new Gemini-powered experience

---

## File 2: requirements.md

### Section 2 - Current State Analysis (UPDATE)

**Current:**
```
### Critical Gaps vs. Best-in-Class Apps
- ❌ No AI/ML features (object/face/scene recognition)
- ❌ No intelligent search (natural language, visual search)
- ❌ No automatic backup or sync
```

**Update To:**
```
### Critical Gaps vs. Best-in-Class Apps (Feb 2026)

**IMMEDIATE (Phase 1) - Deal Breakers:**
- ❌ No generative AI editing (Magic Eraser, remove/fill objects)
- ❌ No multi-device sync (edits, favorites, albums across devices)
- ❌ No offline access (can't browse without internet)
- ❌ Face recognition not opt-in by default (privacy issue)
- ❌ No video support

**IMPORTANT (Phase 2) - Competitive Parity:**
- ❌ No Gemini-powered search (conversational queries)
- ❌ No automatic event detection (vacations, celebrations)
- ❌ No smart album auto-generation
- ❌ No collaborative features (comments, reactions)

**NICE TO HAVE (Phase 3+) - Differentiation:**
- ❌ No collages/animations
- ❌ No print products
- ❌ No professional tools
```

**Rationale:** Clarifies urgency and phasing

### Section 2 (NEW SUBSECTION) - Add After "Current State"

**Add New Subsection: "2026 Market Reality"**

```markdown
### 2026 Market Reality

The photo app landscape has shifted dramatically since initial specification:

**What Google Photos Does Now (Q1 2026):**
- Generative editing with natural language ("Remove object", "Change sky")
- Gemini integration for photo search ("Show me beach photos from summer")
- Automatic event detection (vacations, celebrations)
- Photo Stacks (auto-grouping similar scenes)
- Cross-device sync (instant)
- Offline browsing (cached photos)
- Magic Eraser as primary editing feature

**What Users Now Expect:**
1. AI-powered editing out of the box
2. Photos available on all devices instantly
3. Browsing offline without streaming
4. Automatic organization (no manual album creation)
5. Conversational search ("What did I cook in January?")

**Competitive Implications:**
- Amazon Photos' weakness: No generative editing, minimal AI
- OneDrive's weakness: Not photos-first, no generative features
- Flickr's opportunity: Community + creative tools, but lacking AI
- Cloud Gallery's opportunity: Privacy-first + full feature parity

**This Spec Assumes:**
- User willing to pay for generative AI features (freemium model)
- Cloud infrastructure available (not just local ML)
- Privacy must be preserved while enabling advanced AI
- Offline experience is expected, not optional
```

### Epic 1 - NEW EPIC (INSERT AT BEGINNING)

**Add New Epic 1a: Generative Photo Editing**

```markdown

## Epic 1a: Generative AI Photo Editing

### User Stories

#### 1a.1 Magic Eraser (Remove Objects)
**As a** user  
**I want** to remove unwanted objects from photos with one tap  
**So that** I can clean up photos without learning complex tools

**Acceptance Criteria:**
- Long-press object in photo to enter removal mode
- Tap object or draw around it to mark for removal
- AI intelligently fills background
- See preview before applying
- Edit saved to history with undo capability
- Works on 95%+ of common object types (people, animals, signs, etc.)
- Latency < 3 seconds for typical photo

#### 1a.2 Natural Language Photo Editing
**As a** user  
**I want** to describe photo edits in plain language  
**So that** complex edits feel intuitive

**Acceptance Criteria:**
- Text input: "make the sky more dramatic"
- Prompt examples shown (make sky blue, remove shadows, etc.)
- AI applies edit to photo
- Preview before applying
- Works offline for queuing (applies when online)
- Support at least 20 common edit types

#### 1a.3 Background Replacement
**As a** user  
**I want** to replace or remove photo backgrounds  
**So that** I can improve portrait shots

**Acceptance Criteria:**
- Automatic subject detection and segmentation
- Gallery of background presets (blur, solid colors, nature scenes)
- Text prompt for custom backgrounds ("snowy mountain")
- Real-time preview
- Works for portrait and landscape photos

#### 1a.4 Generative Fill
**As a** user  
**I want** to extend/expand photo content using AI  
**So that** I can recompose photos creatively

**Acceptance Criteria:**
- Draw area to fill or describe what to add
- AI generates realistic content to fill area
- Works for: extending sky, adding missing elements
- Multiple suggestions to choose from

### Technical Requirements

**Non-Functional:**
- Latency: < 3 seconds 95th percentile
- Availability: 99.5% uptime for edit service
- Cost: Sustainable pricing model (no more than $1 per user per month in API costs)
- Device support: iOS 14+, Android 10+

**Quality Metrics:**
- User satisfaction: > 80% users satisfaction with edit quality
- Edit success rate: > 95% successful edits (not erroring)
- Adoption: > 50% of active users try generative edit within 30 days
```

**Rationale:** Elevates generative editing to primary epic

### Epic 3 - RENAME & EXPAND

**Current:** "Shared Albums"  
**Update To:** "Real-Time Collaboration"

**Add new user story:**

```markdown
#### 3.4 Comments & Reactions
**As a** user  
**I want** to leave comments and reactions on shared album photos  
**So that** I can engage with others' contributions

**Acceptance Criteria:**
- Comment on individual photo in shared album
- See all comments in thread for each photo
- Reactions: ❤️ 👍 😂 (emoji reactions)
- Real-time notification when someone comments
- Edit/delete own comments
- Support @ mentions to tag friends
```

### Epic 10 - RENAME & PRIORITIZE

**Current:** "Performance & Offline Support" (Phase 10, implicit low priority)  
**Update To:** "Multi-Device Sync & Offline" (Phase 1, high priority)

**Add to Epic Description:**

```markdown
## Epic 10: Multi-Device Sync & Offline Support

Multi-device sync and offline access are **table stakes in 2026**, not advanced features. Users expect:
- Photos uploaded on iPhone instantly appear on iPad
- Edits on desktop sync back to mobile
- Can browse photos without internet
- Edits queue offline, apply when synced

This epic consolidates previously-separate sync (Phase 4) and offline (Phase 10) requirements into unified Phase 1.
```

### Section 3 (Risk & Mitigations) - UPDATE

**Add New Risk:**

```markdown
### 10.3 Generative AI Quality & Failures
- **Risk**: AI-generated edits produce poor quality results
- **Mitigation**: 
  - Start with high-confidence use cases (Magic Eraser)
  - Provide multiple suggestions for generative fill
  - Require explicit user approval before applying
  - Easy undo and revert-to-original
  - User feedback loop to improve prompts
  - Graceful degradation (if API fails, show error, don't corrupt photo)

### 10.4 Privacy vs. AI Intelligence
- **Risk**: Advanced AI requires sending photo data to cloud
- **Mitigation**:
  - On-device processing for detection, cloud only for generation
  - Convert photos to embeddings (not full images) for search
  - User control: each AI feature has explicit on/off toggle
  - Data retention: auto-delete cloud copies after processing
  - Compliance: GDPR/CCPA data deletion requests honored

### 10.5 Generative AI Cost Overrun
- **Risk**: Generative API costs exceed sustainable levels
- **Mitigation**:
  - Freemium pricing: 5 free edits/month, unlimited for Pro
  - Aggressive caching of common prompts
  - Batch processing during off-peak hours
  - Fallback to local image processing when possible
  - Monitor unit economics per user
```

**Rationale:** Explicitly addresses 2026 concerns

---

## File 3: tasks.md

### MAJOR RESTRUCTURING - Phase 1

**Current Phase 1:** 7 main tasks (3 months)

**New Phase 1:** 6 main tasks (4 months, reorganized)

**Changes:**

1. **MOVE TO PHASE 1** (previously Phase 4-9):
   - Multi-Device Sync (2.X becomes 1.8)
   - Offline Support (was Phase 10 > 1.9)
   - Privacy Controls (was Phase 9 > 1.10)
   - Video Support (was Phase 5 > 1.11)

2. **ADD TO PHASE 1**:
   - Generative AI Editing (completely new > 1.12)

3. **MOVE TO PHASE 2**:
   - Face Recognition (keep but defer)
   - Smart Albums (defer - calendar-driven)
   - Memories & Highlights (defer)
   - Natural Language Search (defer to after basic search works)

### New Phase 1 Structure

**Phase 1: Foundation (4 months)**

#### Section 1: Database & Architecture (1 week)
```markdown
- [ ] 1.1 Extend schema for versioning/sync
- [ ] 1.2 Add video table columns
- [ ] 1.3 Add privacy controls columns
- [ ] 1.4 Index optimization for 100k+ photos
```

#### Section 2: Generative AI Editing (2.5 weeks) - NEW
```markdown
- [ ] 2.1 Evaluate generative AI providers (Replicate, Stability, etc.)
- [ ] 2.2 Implement Magic Eraser API
  - [ ] 2.2.1 Integration with provider
  - [ ] 2.2.2 UI bounding box selection
  - [ ] 2.2.3 Preview before apply
  - [ ] 2.2.4 Edit history + undo
- [ ] 2.3 Implement background remove/replace
- [ ] 2.4 Implement natural language prompts
- [ ] 2.5 Cost optimization & rate limiting
- [ ] 2.6 Safety checks (flag inappropriate content)
```

#### Section 3: Basic ML Analysis (1.5 weeks) - MOVED FROM 1.1
```markdown
- [ ] 3.1 Object detection (on-device TFLite)
- [ ] 3.2 Scene detection
- [ ] 3.3 OCR text extraction
- [ ] 3.4 Perceptual hash for duplicates
- [ ] 3.5 Index labels for search
```

#### Section 4: Multi-Device Sync (2 weeks) - NEW
```markdown
- [ ] 4.1 Device registration system
- [ ] 4.2 Change tracking (add/update/delete)
  - [ ] 4.2.1 Photo changes
  - [ ] 4.2.2 Album changes
  - [ ] 4.2.3 Favorite changes
  - [ ] 4.2.4 Edit changes
- [ ] 4.3 Conflict resolution algorithm
- [ ] 4.4 Background sync service
- [ ] 4.5 Sync UI indicators
- [ ] 4.6 Tests for multi-device scenarios
```

#### Section 5: Offline Support (1.5 weeks) - NEW
```markdown
- [ ] 5.1 Offline-first storage architecture
- [ ] 5.2 Smart thumbnail caching
  - [ ] 5.2.1 Automatic thumbnail download
  - [ ] 5.2.2 Disk space management
  - [ ] 5.2.3 Configurable cache size
- [ ] 5.3 Offline action queue
  - [ ] 5.3.1 Queue edits offline
  - [ ] 5.3.2 Queue favorites offline
  - [ ] 5.3.3 Replay queue when online
- [ ] 5.4 Offline search via local index
- [ ] 5.5 Offline UI indicators
- [ ] 5.6 Tests for offline scenarios
```

#### Section 6: Video Support (1 week) - MOVED UP
```markdown
- [ ] 6.1 Extend schema for video metadata
- [ ] 6.2 Video file validation & upload
- [ ] 6.3 Video thumbnail generation
- [ ] 6.4 Video playback component
- [ ] 6.5 Video duration tracking
- [ ] 6.6 Tests for video support
```

#### Section 7: Privacy Controls (1 week) - MOVED UP
```markdown
- [ ] 7.1 Face recognition opt-in (disabled by default)
- [ ] 7.2 Location management
  - [ ] 7.2.1 View location on photo
  - [ ] 7.2.2 Remove location from single photo
  - [ ] 7.2.3 Batch remove location
  - [ ] 7.2.4 Strip location before sharing
- [ ] 7.3 Hidden photos with biometric auth
- [ ] 7.4 Data export functionality
- [ ] 7.5 Data deletion (permanent)
- [ ] 7.6 Privacy settings UI
- [ ] 7.7 GDPR/CCPA compliance checks
```

#### Section 8: Advanced Editing (1 week) - SIMPLIFIED
```markdown
Note: Generative editing (Section 2) is primary. This covers traditional edits.
- [ ] 8.1 Crop with aspect ratios
- [ ] 8.2 Filter system (15+ presets)
- [ ] 8.3 Adjustments (brightness, contrast, saturation)
- [ ] 8.4 Edit history & undo/redo
- [ ] 8.5 Save as new or overwrite option
```

#### Section 9: Duplicate Detection (1 week)
```markdown
- [ ] 9.1 Perceptual hash grouping
- [ ] 9.2 Burst sequence detection
- [ ] 9.3 DuplicatesScreen UI
- [ ] 9.4 Batch delete operations
- [ ] 9.5 Tests for duplicate detection
```

#### Section 10: Storage Management (0.5 weeks)
```markdown
- [ ] 10.1 Storage usage dashboard
- [ ] 10.2 Free up space tool
- [ ] 10.3 Compress photos
- [ ] 10.4 Tests for storage operations
```

### Phase 2: Intelligence (Unchanged concept, but contents updated)

**Rename to:** "Intelligence & AI"

**Update to include:**
```markdown
- [ ] Face Recognition (moved from Phase 2, now 2.1)
- [ ] Smart Albums (moved from Phase 2, now 2.2)
- [ ] Memories (moved from Phase 2, now 2.3)
- [ ] Natural Language Search (advanced, now 2.4)
- [ ] Gemini Integration (NEW, 2.5)
- [ ] Event Detection (NEW, 2.6)
```

**Add new section for Gemini:**
```markdown
#### Gemini Integration (2.5)
- [ ] 2.5.1 Set up Gemini API access
- [ ] 2.5.2 Build conversational search interface
- [ ] 2.5.3 Photo library indexing for Gemini
- [ ] 2.5.4 Natural language understanding
- [ ] 2.5.5 Result ranking & suggestion
- [ ] 2.5.6 Context memory across questions
- [ ] 2.5.7 Tests for chat-based search
```

### Remove/Consolidate from Later Phases

**Phase 5 Changes:**
- Move Video Support to Phase 1 (done)
- Move Live Photos to Phase 2 (minor change)
- Keep Collages/Animations/Year Review in Phase 5 (creation focus)

**Phase 6 Changes:**
- Keep Print Products as Phase 6 (commerce focus)

### Add Checkpoint System

**Phase 1 Checkpoint (Week 16):**
```markdown
- [ ] All tests pass (100% unit test coverage for business logic)
- [ ] Generative editing works (Magic Eraser + 5 prompt types)
- [ ] Multi-device sync tested (2-device scenarios)
- [ ] Offline mode verified (browsing, searching, editing queued)
- [ ] Privacy controls enabled (face recognition off by default)
- [ ] Video upload/playback working
- [ ] Performance: < 200ms search response for 50k photos
- [ ] Security: audit log captures all operations
- [ ] Performance: can handle 10,000 concurrent users
```

---

## Summary Table: What Moves Where

| Feature |Current Phase | New Phase | Rationale |
|---------|-------------|----------|-----------|
| Generative Editing | NEW | 1 | Table stakes 2026 |
| Multi-Device Sync | 4 | 1 | User expectation |
| Offline Support | 10 | 1 | Table stakes |
| Video Support | 5 | 1 | Much simpler than cutting edge |
| Privacy Controls | 9 | 1 | Compliance mandatory |
| Basic ML Search | 1 | 1 | Keep (foundational) |
| Face Recognition | 2 | 2 | Can defer slightly |
| Smart Albums | 2 | 2 | Automatic, can be async |
| Memories | 2 | 2 | Automatic background task |
| Gemini Integration | N/A | 2 | New feature, Phase 2 |
| Natural Language Search | 2 | 2 | Keep advanced version here |
| Event Detection | N/A | 2 | New, Phase 2 |
| Comments/Reactions | 3 | 3 | Keep in collaboration |
| Collages/Animations | 5 | 5 | Keep in creations |
| Printing | 6 | 6 | Keep as last phase |

---

## Implementation Philosophy

The new Phase 1 (4 months) is demanding but achievable because it:

1. **Focuses on experience, not quantity**
   - Fewer features, but each is fully polished
   - Better to do 5 things great than 10 things OK

2. **Enables fast Phase 2-3**
   - Architecture in place for everything
   - API patterns established
   - No major rework needed

3. **Addresses competitive parity**
   - After Phase 1: Can compete on editing & offline with Google Photos
   - After Phase 2: Can compete on search & intelligence with Google Photos
   - After Phase 3: Can compete on collaboration & creation

4. **Respects privacy**
   - Face recognition off by default (vs. Google Photos)
   - Offline capability (vs. pure cloud)
   - No ads or data selling (vs. Google)

---

## Questions for Review

Before finalizing, consider:

1. **Generative AI Provider:** Which provider? (Replicate recommended for ease)
2. **Sync Strategy:** CRDTs vs. operational transformation? (CRDTs recommended)
3. **Offline Cache Sync:** All thumbnails or just recently viewed? (Recently viewed + recent 30 days)
4. **Generative Edit Cost:** Free tier limits? (5/month free, unlimited for Pro)
5. **Timeline:** Can team deliver Phase 1 in 4 months? (Depends on team size)

