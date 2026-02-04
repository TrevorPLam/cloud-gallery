# API Documentation

[← Back to Architecture Index](../architecture/00_INDEX.md)

## Current State: No Active API

**MVP Status**: The mobile app operates entirely with local AsyncStorage. No API calls are made to the backend server.

**Server State**: Express server exists but only serves:
- Static files (Expo production builds)
- Landing page HTML for Expo Go
- No `/api/*` routes implemented

**Evidence**: `/server/routes.ts` line 15-22 (empty route registration)

---

## Future API Architecture

### Base URL

**Development**:
- Local: `http://localhost:5000`
- Replit: `https://{REPLIT_DEV_DOMAIN}`

**Production** (not deployed):
- TBD (e.g., `https://api.cloud-gallery.com`)

### Route Prefix

All API routes will be prefixed with `/api`:
- ✅ Correct: `/api/photos`, `/api/auth/login`
- ❌ Wrong: `/photos`, `/login`

**Evidence**: `/server/routes.ts` comment "prefix all routes with /api"

---

## Planned API Endpoints

### Authentication

#### `POST /api/auth/register`
**Purpose**: Create new user account  
**Request**:
```json
{
  "username": "string (required)",
  "password": "string (required, min 8 chars)"
}
```
**Response**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "string"
  },
  "token": "jwt-token"
}
```
**Errors**:
- 400: Invalid input (username taken, password too short)
- 500: Server error

---

#### `POST /api/auth/login`
**Purpose**: Authenticate user  
**Request**:
```json
{
  "username": "string",
  "password": "string"
}
```
**Response**:
```json
{
  "success": true,
  "user": {
    "id": "uuid",
    "username": "string"
  },
  "token": "jwt-token"
}
```
**Errors**:
- 401: Invalid credentials
- 500: Server error

---

### Photos

#### `GET /api/photos`
**Purpose**: Fetch user's photos  
**Auth**: Required (JWT in Authorization header)  
**Query Params**:
- `limit` (optional): Number of photos (default: 50)
- `offset` (optional): Pagination offset (default: 0)
- `favorites` (optional): Filter favorites only (boolean)

**Response**:
```json
{
  "photos": [
    {
      "id": "string",
      "uri": "string (S3 URL)",
      "width": 1920,
      "height": 1080,
      "createdAt": 1234567890000,
      "modifiedAt": 1234567890000,
      "filename": "IMG_1234.jpg",
      "isFavorite": false,
      "albumIds": ["album1", "album2"]
    }
  ],
  "total": 150,
  "hasMore": true
}
```

---

#### `POST /api/photos`
**Purpose**: Upload new photo  
**Auth**: Required  
**Content-Type**: `multipart/form-data`  
**Request**:
```
file: <binary> (required)
filename: string (optional)
```
**Response**:
```json
{
  "success": true,
  "photo": {
    "id": "string",
    "uri": "string",
    "width": 1920,
    "height": 1080,
    "filename": "IMG_1234.jpg",
    "createdAt": 1234567890000
  }
}
```
**Errors**:
- 400: Invalid file format (not image)
- 413: File too large (> 10MB)
- 507: Storage quota exceeded

---

#### `DELETE /api/photos/:photoId`
**Purpose**: Delete photo  
**Auth**: Required  
**Response**:
```json
{
  "success": true,
  "message": "Photo deleted"
}
```
**Errors**:
- 404: Photo not found
- 403: Not authorized (not owner)

---

#### `PATCH /api/photos/:photoId/favorite`
**Purpose**: Toggle favorite status  
**Auth**: Required  
**Request**:
```json
{
  "isFavorite": true
}
```
**Response**:
```json
{
  "success": true,
  "photo": {
    "id": "string",
    "isFavorite": true
  }
}
```

---

### Albums

#### `GET /api/albums`
**Purpose**: Fetch user's albums  
**Auth**: Required  
**Response**:
```json
{
  "albums": [
    {
      "id": "string",
      "title": "Vacation 2026",
      "coverPhotoUri": "string",
      "photoIds": ["photo1", "photo2"],
      "createdAt": 1234567890000,
      "modifiedAt": 1234567890000
    }
  ]
}
```

---

#### `POST /api/albums`
**Purpose**: Create new album  
**Auth**: Required  
**Request**:
```json
{
  "title": "string (required)"
}
```
**Response**:
```json
{
  "success": true,
  "album": {
    "id": "string",
    "title": "Vacation 2026",
    "coverPhotoUri": null,
    "photoIds": [],
    "createdAt": 1234567890000
  }
}
```

---

#### `POST /api/albums/:albumId/photos`
**Purpose**: Add photos to album  
**Auth**: Required  
**Request**:
```json
{
  "photoIds": ["photo1", "photo2"]
}
```
**Response**:
```json
{
  "success": true,
  "album": {
    "id": "string",
    "photoIds": ["photo1", "photo2"]
  }
}
```

---

#### `DELETE /api/albums/:albumId`
**Purpose**: Delete album (photos remain)  
**Auth**: Required  
**Response**:
```json
{
  "success": true,
  "message": "Album deleted"
}
```

---

## API Organization

### Middleware Stack (Future)

```
Request
  ↓
CORS Middleware (configured)
  ↓
Body Parser (configured)
  ↓
Request Logger (configured)
  ↓
JWT Auth Middleware (not implemented)
  ↓
Rate Limiter (not implemented)
  ↓
Route Handler
  ↓
Error Handler (configured)
  ↓
Response
```

**Evidence**: `/server/index.ts` line 67-130

---

## Auth Model

### JWT Authentication (Future)

**Flow**:
1. User logs in → server validates credentials
2. Server generates JWT with user ID
3. Client stores JWT in AsyncStorage
4. Client includes JWT in `Authorization: Bearer <token>` header
5. Server middleware validates JWT on protected routes

**Token Payload**:
```typescript
{
  userId: string,
  username: string,
  iat: number,  // issued at
  exp: number   // expires (24 hours)
}
```

**Token Storage**:
- Client: AsyncStorage key `@photo_vault_auth_token`
- Server: No storage (stateless JWT)

**Schema Ready**: `/shared/schema.ts` has users table

---

## Error Conventions

### Standard Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {} // Optional additional info
  }
}
```

### Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `AUTH_REQUIRED` | 401 | No auth token provided |
| `AUTH_INVALID` | 401 | Token expired or invalid |
| `FORBIDDEN` | 403 | User not authorized for resource |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `DUPLICATE_ERROR` | 409 | Resource already exists (username taken) |
| `STORAGE_QUOTA_EXCEEDED` | 507 | User storage limit reached |
| `SERVER_ERROR` | 500 | Internal server error |

### Error Handler (Implemented)

**Development**: Returns full error details + stack trace  
**Production**: Sanitizes error messages, hides stack traces

**Evidence**: `/server/index.ts` line 112-130

---

## API Versioning

### Strategy: URL Versioning (Future)

**Pattern**: `/api/v1/photos`, `/api/v2/photos`

**Current**: No versioning (MVP not deployed)

**When to Version**:
- Breaking changes to request/response format
- Removed fields
- Changed validation rules

**Backward Compatibility**:
- Maintain `/api/v1/*` for 6 months after `/api/v2/*` release
- Deprecation headers in v1 responses

---

## CORS Configuration

**Current State**: Configured for development

**Allowed Origins**:
- `http://localhost:*` (any port)
- `http://127.0.0.1:*` (any port)
- `https://{REPLIT_DEV_DOMAIN}`
- `https://{REPLIT_DOMAINS}` (comma-separated)

**Allowed Methods**: GET, POST, PUT, PATCH, DELETE  
**Allowed Headers**: Content-Type, Authorization  
**Credentials**: Allowed (cookies/auth)

**Evidence**: `/server/index.ts` line 26-65

---

## Rate Limiting (Not Implemented)

### Future Strategy

**Endpoints**:
- `/api/auth/*`: 5 requests/minute per IP
- `/api/photos`: 100 requests/minute per user
- `/api/albums`: 50 requests/minute per user

**Headers** (future):
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1234567890
```

---

## File Upload Handling (Future)

### Photo Upload Strategy

1. **Client** → Compresses image (optional)
2. **Server** → Receives multipart/form-data
3. **Server** → Validates: file type, size, quota
4. **Server** → Uploads to S3/R2 (object storage)
5. **Server** → Saves metadata to PostgreSQL
6. **Server** → Returns photo object with S3 URL

**Storage**:
- Original: S3/CloudFlare R2
- Thumbnails: Generated on upload, stored in S3
- Database: Only metadata (URLs, dimensions, etc.)

---

## API Security (Future Considerations)

### Required Security Measures

1. **HTTPS Only**: Enforce in production
2. **JWT Secret**: Store in environment variable (not in code)
3. **Password Hashing**: Use bcrypt (min 10 rounds)
4. **Input Validation**: Validate all inputs with Zod schemas
5. **SQL Injection**: Protected by Drizzle ORM
6. **Rate Limiting**: Prevent brute force attacks
7. **CORS**: Restrict to known domains in production
8. **File Uploads**: Validate MIME types, scan for malware

### Security Headers (Not Implemented)

```javascript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});
```

---

## Testing API (Future)

### Manual Testing with cURL

```bash
# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"password123"}'

# Get photos with auth
curl http://localhost:5000/api/photos \
  -H "Authorization: Bearer <token>"

# Upload photo
curl -X POST http://localhost:5000/api/photos \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/photo.jpg"
```

### Integration Tests (Not Implemented)

```typescript
// Future test example
describe('POST /api/photos', () => {
  it('uploads photo successfully', async () => {
    const response = await request(app)
      .post('/api/photos')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', 'test-photo.jpg')
      .expect(200);
    
    expect(response.body.photo.id).toBeDefined();
  });
});
```

---

## Evidence Files

**Server Setup**:
- `/server/index.ts` - Express app + middleware (150 lines)
- `/server/routes.ts` - Route registration (empty) (23 lines)

**Schema**:
- `/shared/schema.ts` - User schema for auth (32 lines)

**Configuration**:
- `/drizzle.config.ts` - Database config (future)

**Dependencies**:
- `express@5.0.1` - HTTP server
- `drizzle-orm@0.39.3` - Database ORM (future)

---

[← Back to Architecture Index](../architecture/00_INDEX.md)
