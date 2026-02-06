# ## 🔴 **TASK 021: Create Photo API Endpoints**
**Priority**: Critical (P0)  
**Status**: Not Started  
**Assignee**: AGENT  
**Estimated Time**: 3-4 hours  

### Acceptance Requirements
- CRUD operations for photos work correctly
- File upload handling is secure and efficient
- Photo metadata is extracted and stored
- Authentication middleware protects all endpoints

### Files to Create/Modify
- `server/photo-routes.ts` - Photo CRUD endpoints
- `server/middleware/auth.ts` - Authentication middleware
- `server/utils/file-upload.ts` - File upload utilities
- `server/routes.ts` - Register photo routes

### Code Components
- GET /api/photos - List photos with pagination
- POST /api/photos - Upload new photo
- PUT /api/photos/:id - Update photo metadata
- DELETE /api/photos/:id - Delete photo
- File upload with size limits and validation

### Testing Requirements
- All endpoints return correct HTTP status codes
- File upload works with various image formats
- Authentication blocks unauthorized requests
- Pagination works correctly

### Safety Constraints
- NEVER allow arbitrary file uploads
- NEVER expose file system paths
- ALWAYS validate file types and sizes
- ALWAYS sanitize user inputs

### Dependencies
- multer for file uploads
- sharp for image processing
- express-validator for input validation
- JWT authentication

### Implementation Steps
1. **SUBTASK 21.1**: Create authentication middleware (AGENT)
2. **SUBTASK 21.2**: Implement file upload utilities (AGENT)
3. **SUBTASK 21.3**: Create photo CRUD endpoints (AGENT)
4. **SUBTASK 21.4**: Register routes in main server (AGENT)

### Success Criteria
- [ ] Can upload photos successfully
- [ ] Can retrieve photo lists with pagination
- [ ] Can update photo metadata
- [ ] Can delete photos
- [ ] Authentication blocks unauthorized access

### Rollback Plan
- Remove `server/photo-routes.ts`
- Restore original `server/routes.ts`
- Uninstall multer and sharp

---
