# ## 🔴 **TASK 022: Update Client PhotosScreen to Use API**
**Priority**: Critical (P0)  
**Status**: Not Started  
**Assignee**: AGENT  
**Estimated Time**: 3-4 hours  

### Acceptance Requirements
- PhotosScreen fetches data from server API
- Photo upload works through API endpoints
- Offline mode gracefully handles network failures
- UI updates reflect real-time data changes

### Files to Create/Modify
- `client/screens/PhotosScreen.tsx` - Connect to API
- `client/hooks/usePhotos.ts` - Custom hook for photo operations
- `client/lib/api.ts` - API client utilities
- `client/components/PhotoUpload.tsx` - Photo upload component

### Code Components
- React Query integration for data fetching
- Photo upload with progress tracking
- Error handling and retry logic
- Offline/online state management

### Testing Requirements
- Photos load correctly from API
- Upload progress is displayed
- Network errors are handled gracefully
- UI updates when data changes

### Safety Constraints
- NEVER expose API keys in client code
- NEVER store sensitive data in AsyncStorage
- ALWAYS handle network failures gracefully
- ALWAYS validate API responses

### Dependencies
- @tanstack/react-query for data fetching
- axios for HTTP requests
- react-native-fs for file operations

### Implementation Steps
1. **SUBTASK 22.1**: Create API client utilities (AGENT)
2. **SUBTASK 22.2**: Implement usePhotos hook (AGENT)
3. **SUBTASK 22.3**: Update PhotosScreen with API integration (AGENT)
4. **SUBTASK 22.4**: Add photo upload functionality (AGENT)

### Success Criteria
- [ ] Photos load from server API
- [ ] Can upload new photos
- [ ] Network errors are handled
- [ ] UI updates in real-time

### Rollback Plan
- Restore original PhotosScreen.tsx
- Remove new hooks and components
- Uninstall react-query and axios

---
