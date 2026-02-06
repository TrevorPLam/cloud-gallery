# ## 🟡 **TASK 11: React Query Integration**
**Priority**: High (P1)  
**Status**: Not Started  
**Assignee**: AGENT  
**Estimated Time**: 3-4 hours  

### Acceptance Requirements
- All data fetching uses React Query
- Proper cache management
- Optimistic updates for all mutations
- Error handling and retry logic

### Files to Create/Modify
- `client/lib/query-client.ts` - Query configuration
- All screens to use useQuery/useMutation
- Custom hooks for common operations
- Error boundary integration

### Code Components
- React Query configuration
- Custom query hooks
- Mutation hooks with optimistic updates
- Cache management strategies

### Testing Requirements
- Data fetching works correctly
- Cache invalidation works
- Optimistic updates function
- Error handling works properly

### Safety Constraints
- NEVER have stale data in cache
- ALWAYS handle loading states
- NEVER show optimistic updates permanently
- ALWAYS retry failed requests

### Dependencies
- React Query/TanStack Query
- Custom hook utilities

### Implementation Steps
1. Configure React Query
2. Create custom hooks
3. Update all screens
4. Add optimistic updates
5. Test cache behavior

---