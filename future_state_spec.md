Cloud-Gallery: Future State Specification
1. Vision
To build a privacy-first, "magical" photo gallery that rivals Google Photos in User Experience and Intelligence, while exceeding it in Privacy and User Control.

2. Competitive Feature Matrix
Feature Category	Google Photos (Standard)	Cloud-Gallery (Target)	Notes
Core Storage	Cloud-based, compressed or original	Hybrid (Local + Cloud)	Focus on seamless offline-first experience with encrypted cloud backup.
Search	AI Semantic ("Dog on beach")	Private AI Semantic	Run lightweight models (e.g., MobileCLIP) on-device or on trusted server for index; no data mining.
Organization	Date, Location, People, Things	Smart Clusters + Manual	Auto-grouping by event/location. Secure "Vault" for sensitive photos.
Editing	Filters, Magic Eraser, Unblur	Non-Destructive + Filters	Save edit recipe separately from image data. preserve original.
Sharing	Joint albums, conversations	E2EE Sharing	Shared albums where keys are exchanged securely. Public links with expiration.
Privacy	Google has keys	Zero-Knowledge	User owns the keys (where possible).
3. Required Functionality (Roadmap)
Phase 1: Foundation & Performance (Fixing the Basics)
 Virtualized Search: Fix 
SearchScreen
 to use server-side search instead of loading all data.
 Background Sync: Implement robust background upload/sync service (using expo-task-manager).
 Metadata Extraction: Server-side extraction of EXIF data (Date taken, GPS, Camera model) upon upload.
 Thumbnail Generation: Create multiple sizes (thumbnail, preview, full) for faster loading.
Phase 2: Intelligence & Navigation
 Map View: Utilize GPS data to show a heatmap/clusters on MapScreen.
 Timeline Scroll: "Fast scrub" scroll bar by month/year (essential for large libraries).
 Smart Search: Implement a vector database (e.g., pgvector) for semantic search.
Implementation: Generate embeddings for photos (CLIP) and store in Postgres.
Phase 3: Advanced Editing & Visuals
 Non-Destructive Editing:
Store edits as JSON (e.g., { rotation: 90, brightness: 1.1 }).
Apply transforms on fly or generate cached preview.
 Filters & Adjustments: Add saturation, contrast, brightness sliders.
 Crop Tool: Standard aspect ratio cropping.
Phase 4: Social & Sharing
 Shared Albums: Allow other users to contribute.
 Public Links: Generate signed URLs for temporary public access.
4. Technical Architecture Evolution
Database Changes
Photos Table: Add exifData (JSONB), blurHash (for smooth loading), and embedding (vector).
Albums Table: Add isShared (boolean), shareToken (string).
Backend Services
Job Queue: Offload heavy tasks (thumbnail generation, AI embedding) to a background worker (e.g., Bull/Redis or simple in-memory queue for MVP).
Vector Search: Enable pgvector extension on Postgres instance.
AI Strategy
Option A (Privacy): Run object detection on the phone (TensorFlow Lite / ExecuTorch) and sync tags to server.
Option B (Power): Run models on server.
Recommendation: Server-side for consistency across devices, but strict data isolation policy.
5. Differentiators (Buying Criteria)
"The Private Alternative": Market heavily on the encryption/security stack already present.
No Advertising / No Training: Explicit promise not to train models on user photos.
Speed: Optimize for instant load times (optimistic UI updates).