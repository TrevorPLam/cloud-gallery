# Cloud Gallery Server - AI Agent Instructions

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![Express](https://img.shields.io/badge/Express-5.0.1-000000?logo=express)
![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)

</div>

AI-optimized documentation for Node.js backend development in Cloud Gallery.

## 🎯 Server Overview

Node.js backend for Cloud Gallery with comprehensive security, authentication, and photo management APIs. Uses Express 5.0 with TypeScript and PostgreSQL.

**One-Liner**: Express.js API server with JWT auth, PostgreSQL, Drizzle ORM, and enterprise security features.

## 🏗️ Server Architecture

```
server/
├── index.ts             # Express server bootstrap
├── routes.ts            # API route registration
├── auth-routes.ts       # Authentication endpoints
├── photo-routes.ts      # Photo CRUD operations
├── album-routes.ts      # Album management
├── upload-routes.ts     # File upload handling
├── middleware.ts        # Security middleware
├── security.ts          # Crypto utilities
├── db.ts               # Database connection
└── templates/          # HTML templates
```

### Key Dependencies
- **Express 5.0.1**: Web framework with async/await support
- **TypeScript 5.9.2**: Type-safe JavaScript
- **PostgreSQL 15**: Primary database
- **Drizzle ORM 0.39.3**: Type-safe database access
- **JWT + Argon2**: Authentication and password hashing
- **Multer 2.0.2**: File upload handling

## 🚀 Development Commands

### Starting Development
```bash
# Start development server
npm run server:dev

# Start without database (MVP mode)
npm run server:dev:nodb

# Build for production
npm run server:build

# Start production server
npm run server:prod
```

### Database Operations
```bash
# Push schema changes
npm run db:push

# Generate migrations
npm run db:generate

# Reset database
npm run db:reset
```

### Testing
```bash
# Run server tests
npm run test server/

# Run specific route tests
npm run test server/auth-routes.test.ts

# Run tests in watch mode
npm run test:watch
```

### Security
```bash
# Run security checks
npm run security:check

# Run penetration tests
./scripts/pen-test.sh
```

## 🔐 Security Architecture

### Multi-Layer Security
```typescript
// 1. Security Headers (middleware.ts)
app.use(securityHeaders({
  csp: {
    enabled: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
    },
  },
  hsts: { enabled: true, maxAge: 31536000 },
}));

// 2. Rate Limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
}));

// 3. CORS with strict origins
app.use((req, res, next) => {
  const allowedOrigins = [
    "https://yourdomain.com",
    "http://localhost:19000",
  ];
  // Strict origin validation
});
```

### Authentication Flow
```typescript
// JWT Authentication
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid token" });
    req.user = user;
    next();
  });
};

// Password Hashing with Argon2
export const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 2 ** 16,
    timeCost: 3,
    parallelism: 1,
  });
};
```

## 🗄️ Database Patterns

### Drizzle ORM Usage
```typescript
// Use typed database operations
import { db } from './db';
import { photos, users } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';

// Type-safe queries
export const getUserPhotos = async (userId: string, options: GetPhotosOptions) => {
  let query = db
    .select()
    .from(photos)
    .where(and(
      eq(photos.userId, userId),
      isNull(photos.deletedAt)
    ));

  if (options.favorites) {
    query = query.where(eq(photos.isFavorite, true));
  }

  return await query
    .orderBy(desc(photos.createdAt))
    .limit(options.limit || 50)
    .offset(options.offset || 0);
};

// Transactions for complex operations
export const addPhotosToAlbum = async (albumId: string, photoIds: string[]) => {
  return await db.transaction(async (tx) => {
    // Update album
    await tx
      .update(albums)
      .set({ modifiedAt: new Date() })
      .where(eq(albums.id, albumId));

    // Add photos to album
    for (const photoId of photoIds) {
      await tx.insert(albumPhotos).values({
        albumId,
        photoId,
        addedAt: new Date(),
      });
    }
  });
};
```

### Schema Relationships
```typescript
// Maintain bidirectional relationships
export const photos = pgTable("photos", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // ... other fields
});

export const albums = pgTable("albums", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  // ... other fields
});

// Junction table for many-to-many
export const albumPhotos = pgTable("album_photos", {
  albumId: varchar("album_id").notNull().references(() => albums.id, { onDelete: "cascade" }),
  photoId: varchar("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});
```

## 🛣️ API Development Patterns

### Route Structure
```typescript
// Use consistent route patterns
router.get('/', async (req: Request, res: Response) => {
  try {
    // Validate request
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Process request
    const photos = await getUserPhotos(userId, req.query);

    // Send response
    res.json({ photos });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

### Request Validation
```typescript
// Use Zod for runtime validation
import { z } from 'zod';
import { insertPhotoSchema } from '../shared/schema';

const createPhotoSchema = insertPhotoSchema.extend({
  uri: z.string().url(),
  width: z.number().positive(),
  height: z.number().positive(),
});

router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const photoData = createPhotoSchema.parse(req.body);
    
    // Process with validated data
    const photo = await createPhoto(req.user.id, photoData);
    
    res.status(201).json({ photo });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Validation failed',
        details: error.errors 
      });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### Error Handling
```typescript
// Centralized error handling
export const errorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const error = err as {
    status?: number;
    statusCode?: number;
    message?: string;
    stack?: string;
  };

  const status = error.status || error.statusCode || 500;
  const correlationId = req.headers["x-request-id"] || "unknown";

  // Log full error server-side
  console.error(`[${correlationId}] Error:`, {
    status,
    message: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
  });

  // Send safe error to client
  const message = status < 500 
    ? error.message || "Bad Request"
    : "Internal Server Error";

  res.status(status).json({
    error: message,
    correlationId,
  });
};
```

## 📤 File Upload Handling

### Multer Configuration
```typescript
// Secure file upload setup
import multer from 'multer';
import { fileFilter, limits } from './file-validation';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5, // Max 5 files
  },
  fileFilter: fileFilter,
});

// Use in routes
router.post('/upload', upload.array('photos', 5), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    
    // Process and validate each file
    const processedFiles = await Promise.all(
      files.map(file => processUpload(file))
    );

    res.json({ files: processedFiles });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### File Validation
```typescript
// Validate file types and content
import fileType from 'file-type';

export const fileFilter = (req: Request, file: Express.Multer.File, cb: any) => {
  // Check MIME type
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type'), false);
  }

  // Additional validation can be done here
  cb(null, true);
};

export const processUpload = async (file: Express.Multer.File) => {
  // Validate actual file content
  const type = await fileType.fromBuffer(file.buffer);
  if (!type || !type.mime.startsWith('image/')) {
    throw new Error('Invalid image file');
  }

  // Process and store file
  const storageUri = await storeFile(file.buffer, file.originalname);
  
  return {
    originalName: file.originalname,
    size: file.size,
    type: type.mime,
    uri: storageUri,
  };
};
```

## 🧪 Testing Patterns

### Route Testing
```typescript
// Test API endpoints with Supertest
import request from 'supertest';
import { app } from '../index';

describe('Photo Routes', () => {
  describe('GET /api/photos', () => {
    it('should return user photos', async () => {
      const token = await getTestToken();
      
      const response = await request(app)
        .get('/api/photos')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.photos).toBeDefined();
      expect(Array.isArray(response.body.photos)).toBe(true);
    });

    it('should reject unauthenticated requests', async () => {
      await request(app)
        .get('/api/photos')
        .expect(401);
    });
  });
});
```

### Database Testing
```typescript
// Test database operations
import { db } from '../db';
import { users, photos } from '../shared/schema';

describe('Database Operations', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.delete(photos);
    await db.delete(users);
  });

  it('should create and retrieve photos', async () => {
    const user = await createTestUser();
    const photo = await createTestPhoto(user.id);
    
    const retrieved = await db
      .select()
      .from(photos)
      .where(eq(photos.id, photo.id))
      .limit(1);

    expect(retrieved[0]).toBeDefined();
    expect(retrieved[0].userId).toBe(user.id);
  });
});
```

### Security Testing
```typescript
// Test security measures
describe('Security', () => {
  it('should enforce rate limiting', async () => {
    const requests = Array(101).fill(null).map(() =>
      request(app).post('/api/auth/login').send({
        username: 'test',
        password: 'wrong'
      })
    );

    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(res => res.status === 429);
    expect(rateLimited.length).toBeGreaterThan(0);
  });

  it('should reject SQL injection attempts', async () => {
    const maliciousInput = "'; DROP TABLE users; --";
    
    await request(app)
      .post('/api/photos/search')
      .send({ query: maliciousInput })
      .expect(400); // Should be caught by validation
  });
});
```

## 🔧 Development Tools

### Environment Setup
```bash
# Environment variables
DATABASE_URL=postgresql://user:pass@localhost:5432/cloudgallery
JWT_SECRET=your-super-secret-key
NODE_ENV=development
PORT=5000

# Start with specific environment
NODE_ENV=production npm run server:prod
```

### Database Management
```bash
# Connect to database
psql $DATABASE_URL

# Run specific migration
npm run db:push

# Reset database
npm run db:reset

# View schema
npm run db:generate
```

### Debugging
```bash
# Enable debug logging
DEBUG=* npm run server:dev

# Use Node.js inspector
node --inspect server_dist/index.js
```

## 📊 Monitoring & Logging

### Structured Logging
```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'cloud-gallery-api' },
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.Console(),
  ],
});
```

### Health Checks
```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: await checkDatabaseHealth(),
    memory: process.memoryUsage(),
  };
  
  res.json(health);
});

const checkDatabaseHealth = async () => {
  try {
    await db.select().from(users).limit(1);
    return { status: 'connected' };
  } catch (error) {
    return { status: 'disconnected', error: error.message };
  }
};
```

## 📋 Server-Specific Gotchas

### Express 5.0 Changes
- **Async Route Handlers**: Now supported natively
- **Error Handling**: Must handle async errors properly
- **Middleware**: Order matters more than ever

### Database Connection
- **Connection Pooling**: Configure for production
- **Transaction Handling**: Use proper transaction patterns
- **Migrations**: Always run migrations before starting

### Security Considerations
- **CORS**: Must be configured for production domains
- **Rate Limiting**: Different limits for auth vs. regular endpoints
- **Headers**: Security headers must be configured properly

### File Upload
- **Memory Usage**: Large files can exhaust memory
- **Validation**: Always validate file content, not just extension
- **Storage**: Use secure storage with proper permissions

## 🔍 External Dependencies

### Database
- **PostgreSQL**: Primary data store
- **Redis** (optional): Caching and sessions

### Authentication
- **JWT**: Token-based authentication
- **Argon2**: Password hashing
- **bcrypt**: Alternative password hashing

### File Storage
- **Local**: Development and small deployments
- **S3**: Production file storage (optional)
- **Cloudinary**: Image processing (optional)

## 📚 Documentation References

### Server Documentation
- `@server/middleware.ts` - Security middleware
- `@server/security.ts` - Crypto utilities
- `@shared/schema.ts` - Database schema
- `@docs/security/README.md` - Security program

### API Documentation
- `@docs/api/00_INDEX.md` - API documentation
- Route-specific documentation in each route file

### Testing
- `@docs/testing/00_INDEX.md` - Testing strategy
- Test examples in each `*.test.ts` file

## 🚨 Agent Behavior Guidelines

### What to Do
- Use async/await for all async operations
- Implement proper error handling with try-catch
- Use TypeScript strict mode
- Follow Express 5.0 patterns
- Implement comprehensive logging

### What to Avoid
- Don't use callbacks (use async/await)
- Avoid raw SQL queries (use Drizzle)
- Don't skip input validation
- Avoid exposing sensitive data in responses
- Don't disable security features

### Verification Steps
1. Run `npm run check:types` - No TypeScript errors
2. Run `npm run lint` - No linting errors
3. Run `npm run test server/` - All server tests pass
4. Run `npm run security:check` - Security validation passes
5. Test API endpoints manually

---

*Last updated: March 2026 | Compatible with: AGENTS.md standard v1.0*
