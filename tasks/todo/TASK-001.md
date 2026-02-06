# ## 🔴 **TASK 1: Connect Client to Server** 
**Priority**: Critical (P0)  
**Status**: Not Started  
**Assignee**: AGENT  
**Estimated Time**: 4-6 hours  

### Acceptance Requirements
- Client can create/read/update/delete photos via server API
- Photos persist across app restarts and devices
- Server endpoints respond correctly with authentication
- No data loss during migration from AsyncStorage

### Files to Create/Modify
- `shared/schema.ts` - Add photos and albums tables
- `server/db.ts` - Database connection helper
- `server/photo-routes.ts` - Photo CRUD endpoints
- `server/album-routes.ts` - Album CRUD endpoints
- `server/routes.ts` - Register new routes
- `client/screens/PhotosScreen.tsx` - Connect to API
- `client/screens/AlbumsScreen.tsx` - Connect to API

### Code Components
- PostgreSQL tables: photos, albums, album_photos
- RESTful API endpoints: GET/POST/PUT/DELETE /api/photos, /api/albums
- React Query integration for data fetching
- Authentication middleware for all endpoints

### Testing Requirements
- All endpoints return correct HTTP status codes
- Database migrations succeed without errors
- Client can upload and retrieve photos
- Error handling works for network failures

### Safety Constraints
- NEVER expose database credentials in client code
- NEVER allow users to access other users' data
- ALWAYS validate input data with Zod schemas
- NEVER use AsyncStorage for primary data storage

### Dependencies
- Drizzle ORM with PostgreSQL
- Zod for validation
- React Query for state management
- JWT authentication middleware

### Implementation Steps
1. **SUBTASK 1.1**: Create Photo Database Table (AGENT)
2. **SUBTASK 1.2**: Create Album Database Table (AGENT)
3. **SUBTASK 1.3**: Create Database Connection Helper (AGENT)
4. **SUBTASK 1.4**: Create Photo API Endpoints (AGENT)
5. **SUBTASK 1.5**: Register Photo Routes (AGENT)
6. **SUBTASK 1.6**: Update Client PhotosScreen (AGENT)
7. **SUBTASK 1.7**: Create Album Routes (AGENT)
8. **SUBTASK 1.8**: Update Client AlbumsScreen (AGENT)

---