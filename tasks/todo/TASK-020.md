# ## 🔴 **TASK 020: Create Database Connection Helper**
**Priority**: Critical (P0)  
**Status**: Not Started  
**Assignee**: AGENT  
**Estimated Time**: 2-3 hours  

### Acceptance Requirements
- Database connection pool is properly configured
- Connection handles errors gracefully
- Environment variables are securely loaded
- Connection can be established and tested

### Files to Create/Modify
- `server/db.ts` - Create database connection helper
- `server/config.ts` - Create configuration loader
- `.env.example` - Add database configuration variables

### Code Components
- PostgreSQL connection pool using pg library
- Environment variable validation with Zod
- Connection health check endpoint
- Graceful shutdown handling

### Testing Requirements
- Database connection succeeds with valid credentials
- Connection fails gracefully with invalid credentials
- Connection pool limits are respected
- Health check endpoint returns correct status

### Safety Constraints
- NEVER hardcode database credentials
- NEVER expose database connection details in error messages
- ALWAYS use connection pooling to prevent exhaustion
- ALWAYS validate environment variables on startup

### Dependencies
- pg (PostgreSQL client)
- @types/pg
- zod for validation
- dotenv for environment loading

### Implementation Steps
1. **SUBTASK 20.1**: Install PostgreSQL dependencies (AGENT)
2. **SUBTASK 20.2**: Create database configuration schema (AGENT)
3. **SUBTASK 20.3**: Implement connection pool (AGENT)
4. **SUBTASK 20.4**: Add health check endpoint (AGENT)

### Success Criteria
- [ ] Database connection established successfully
- [ ] Connection pool handles multiple requests
- [ ] Environment variables are validated
- [ ] Health check returns 200 OK

### Rollback Plan
- Remove `server/db.ts` and `server/config.ts`
- Uninstall pg dependencies
- Restore original `.env.example`

### Notes & Context
This is a prerequisite for all database operations. The connection helper will be used by all route handlers and must be robust enough for production use.

---
