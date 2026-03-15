# Cloud Gallery Server

<div align="center">

![Node.js Logo](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![Express Logo](https://img.shields.io/badge/Express-5.0.1-000000?logo=express)
![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)

</div>

Enterprise-grade Node.js backend for Cloud Gallery with comprehensive security, authentication, and photo management APIs.

## 🎯 Server Architecture

### 🏗️ Application Structure
```
server/
├── 🚀 index.ts                   # Express server bootstrap
├── 🛣️ routes.ts                   # API route registration
├── 🔐 auth-routes.ts              # Authentication endpoints
├── 📸 photo-routes.ts             # Photo CRUD operations
├── 🗂️ album-routes.ts             # Album management
├── 📤 upload-routes.ts            # File upload handling
├── 🛡️ middleware.ts               # Security middleware
├── 🔒 security.ts                 # Crypto utilities
├── 🗃️ db.ts                      # Database connection
├── 🔑 auth.ts                     # Authentication logic
├── 📊 audit.ts                    # Audit logging
├── 🧪 [module].test.ts            # Comprehensive test suite
└── 📋 templates/                  # HTML templates
    └── landing-page.html          # Static landing page
```

### 🔧 Core Technologies
- **Express 5.0.1** - Web framework with async/await support
- **TypeScript 5.9.2** - Type-safe JavaScript
- **PostgreSQL 15** - Primary database with full-text search
- **Drizzle ORM 0.39.3** - Type-safe database access
- **JWT + Argon2** - Authentication and secure password hashing
- **Multer 2.0.2** - File upload handling with validation
- **Winston** - Structured logging
- **Helmet + CORS** - Security middleware

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis (optional, for caching)

### Installation

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Set up environment variables
cp ../.env.example .env
# Edit .env with your configuration

# Set up database
npm run db:push

# Start development server
npm run server:dev
```

### Database Setup

```bash
# Install PostgreSQL
# macOS: brew install postgresql
# Ubuntu: sudo apt-get install postgresql postgresql-contrib
# Windows: Download from postgresql.org

# Create database
createdb cloudgallery

# Run migrations
npm run db:push

# Seed database (optional)
npm run db:seed
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
      "img-src": ["'self'", "data:", "https:"],
    },
  },
  hsts: { enabled: true, maxAge: 31536000 },
  otherHeaders: {
    xFrameOptions: true,
    xContentTypeOptions: true,
    xXssProtection: true,
    referrerPolicy: true,
  },
}));

// 2. Rate Limiting
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: "Too many requests",
}));

// 3. CORS with strict origins
app.use((req, res, next) => {
  const allowedOrigins = [
    "https://yourdomain.com",
    "http://localhost:19000",
    "http://localhost:19001",
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

### Encryption Standards
```typescript
// Field-level encryption
export const encryptField = (data: string, key: string): string => {
  return CryptoJS.AES.encrypt(data, key).toString();
};

export const decryptField = (ciphertext: string, key: string): string => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, key);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Backup encryption
export const encryptBackup = (data: any, passphrase: string): string => {
  const salt = randomBytes(16);
  const key = pbkdf2Sync(passphrase, salt, 100000, 32, 'sha256');
  const cipher = createCipher('aes-256-gcm', key);
  // ... encryption logic
};
```

## 🛣️ API Documentation

### Authentication Endpoints
```typescript
// POST /api/auth/register
interface RegisterRequest {
  username: string;
  password: string;
  email?: string;
}

interface RegisterResponse {
  user: {
    id: string;
    username: string;
    email?: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

// POST /api/auth/login
interface LoginRequest {
  username: string;
  password: string;
}

// POST /api/auth/refresh
interface RefreshRequest {
  refreshToken: string;
}
```

### Photo Management
```typescript
// GET /api/photos
interface GetPhotosQuery {
  limit?: number;
  offset?: number;
  favorites?: boolean;
  albumId?: string;
  search?: string;
}

interface PhotoResponse {
  id: string;
  uri: string;
  width: number;
  height: number;
  filename: string;
  isFavorite: boolean;
  createdAt: string;
  modifiedAt: string;
  metadata?: PhotoMetadata;
}

// POST /api/photos
interface CreatePhotoRequest {
  uri: string;
  width: number;
  height: number;
  filename: string;
  metadata?: PhotoMetadata;
}

// PUT /api/photos/:id
interface UpdatePhotoRequest {
  filename?: string;
  isFavorite?: boolean;
  metadata?: PhotoMetadata;
  tags?: string[];
  notes?: string;
}
```

### Album Operations
```typescript
// GET /api/albums
interface AlbumResponse {
  id: string;
  title: string;
  description?: string;
  coverPhotoUri?: string;
  photoCount: number;
  createdAt: string;
  modifiedAt: string;
}

// POST /api/albums
interface CreateAlbumRequest {
  title: string;
  description?: string;
  coverPhotoUri?: string;
}

// POST /api/albums/:id/photos
interface AddPhotosRequest {
  photoIds: string[];
}
```

### File Upload
```typescript
// POST /api/upload/photo
// Content-Type: multipart/form-data
interface UploadPhotoRequest {
  file: File; // Image file
  metadata?: string; // JSON string of photo metadata
}

interface UploadResponse {
  photo: PhotoResponse;
  uri: string; // Storage URI
}
```

## 🗃️ Database Schema

### Core Tables
```sql
-- Users table
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Photos table
CREATE TABLE photos (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uri TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  filename TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  location JSONB,
  camera JSONB,
  exif JSONB,
  tags TEXT[],
  notes TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  modified_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

-- Albums table
CREATE TABLE albums (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_photo_uri TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  modified_at TIMESTAMP DEFAULT NOW()
);

-- Album-Photo junction table
CREATE TABLE album_photos (
  album_id VARCHAR NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  photo_id VARCHAR NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT NOW(),
  position INTEGER DEFAULT 0,
  PRIMARY KEY (album_id, photo_id)
);
```

### Database Operations
```typescript
// Drizzle ORM examples
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

  if (options.albumId) {
    query = query.innerJoin(
      albumPhotos,
      eq(photos.id, albumPhotos.photoId)
    ).where(eq(albumPhotos.albumId, options.albumId));
  }

  return await query
    .orderBy(desc(photos.createdAt))
    .limit(options.limit || 50)
    .offset(options.offset || 0);
};

export const createPhoto = async (userId: string, photoData: CreatePhotoRequest) => {
  const [photo] = await db.insert(photos)
    .values({
      userId,
      ...photoData,
      createdAt: new Date(),
      modifiedAt: new Date(),
    })
    .returning();
  return photo;
};
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
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ],
});

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: (req as any).user?.id,
    });
  });
  
  next();
};
```

### Performance Monitoring
```typescript
// Metrics collection
export const metrics = {
  requests: new Map<string, number>(),
  errors: new Map<string, number>(),
  responseTime: new Map<string, number[]>(),
};

export const trackMetric = (type: string, key: string, value: number) => {
  const map = metrics[type as keyof typeof metrics];
  if (map instanceof Map) {
    if (type === 'responseTime') {
      const values = map.get(key) || [];
      values.push(value);
      map.set(key, values);
    } else {
      map.set(key, (map.get(key) || 0) + value);
    }
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    metrics: Object.fromEntries(
      Object.entries(metrics).map(([key, map]) => [
        key,
        map instanceof Map ? Object.fromEntries(map) : map
      ])
    ),
  };
  res.json(health);
});
```

### Audit Logging
```typescript
export const auditLog = (action: string, userId: string, details: any) => {
  logger.info('Audit Event', {
    action,
    userId,
    details,
    timestamp: new Date().toISOString(),
    ip: details.ip,
    userAgent: details.userAgent,
  });
};

// Usage in routes
app.post('/api/photos', authenticateToken, async (req, res) => {
  const photo = await createPhoto(req.user.id, req.body);
  
  auditLog('photo_created', req.user.id, {
    photoId: photo.id,
    filename: photo.filename,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  res.json(photo);
});
```

## 🧪 Testing Strategy

### Unit Tests
```typescript
// Example: Authentication tests
describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
          email: 'test@example.com',
        })
        .expect(201);

      expect(response.body.user.username).toBe('testuser');
      expect(response.body.tokens.accessToken).toBeDefined();
      expect(response.body.tokens.refreshToken).toBeDefined();
    });

    it('should reject duplicate usernames', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password123',
        })
        .expect(201);

      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'testuser',
          password: 'password456',
        })
        .expect(400);
    });
  });
});
```

### Integration Tests
```typescript
// Database integration tests
describe('Photo Operations', () => {
  beforeEach(async () => {
    await resetDatabase();
    await createTestUser();
  });

  it('should create and retrieve photos', async () => {
    const createResponse = await request(app)
      .post('/api/photos')
      .set('Authorization', `Bearer ${testToken}`)
      .send({
        uri: 'https://example.com/photo.jpg',
        width: 1920,
        height: 1080,
        filename: 'test.jpg',
      })
      .expect(201);

    const getResponse = await request(app)
      .get('/api/photos')
      .set('Authorization', `Bearer ${testToken}`)
      .expect(200);

    expect(getResponse.body.photos).toHaveLength(1);
    expect(getResponse.body.photos[0].id).toBe(createResponse.body.photo.id);
  });
});
```

### Security Tests
```typescript
describe('Security', () => {
  it('should reject requests without authentication', async () => {
    await request(app)
      .get('/api/photos')
      .expect(401);
  });

  it('should reject invalid JWT tokens', async () => {
    await request(app)
      .get('/api/photos')
      .set('Authorization', 'Bearer invalid-token')
      .expect(403);
  });

  it('should enforce rate limiting', async () => {
    const requests = Array(101).fill(null).map(() =>
      request(app).post('/api/auth/login').send({
        username: 'testuser',
        password: 'wrongpassword',
      })
    );

    const responses = await Promise.all(requests);
    const rateLimitedResponses = responses.filter(res => res.status === 429);
    expect(rateLimitedResponses.length).toBeGreaterThan(0);
  });
});
```

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cloudgallery

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Server Configuration
NODE_ENV=development
PORT=5000
HOST=0.0.0.0

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_PATH=./uploads
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp

# Logging
LOG_LEVEL=info
LOG_FILE_PATH=./logs

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key
```

### Configuration Management
```typescript
// config/index.ts
export const config = {
  database: {
    url: process.env.DATABASE_URL!,
    ssl: process.env.NODE_ENV === 'production',
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  },
  server: {
    port: parseInt(process.env.PORT || '5000'),
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12'),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
    uploadPath: process.env.UPLOAD_PATH || './uploads',
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp').split(','),
  },
};
```

## 🚀 Deployment

### Docker Deployment
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run server:build

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set permissions
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 5000

CMD ["npm", "run", "server:prod"]
```

### Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/cloudgallery
    depends_on:
      - db
      - redis
    volumes:
      - ./uploads:/app/uploads

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=cloudgallery
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Production Deployment
```bash
# Build for production
npm run server:build

# Start production server
npm run server:prod

# With PM2 (process manager)
pm2 start server_dist/index.js --name cloud-gallery-api

# Systemd service
sudo systemctl enable cloud-gallery-api
sudo systemctl start cloud-gallery-api
```

## 📈 Performance Optimization

### Database Optimization
```typescript
// Connection pooling
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum number of connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Query optimization
export const getPhotosWithPagination = async (
  userId: string,
  limit: number,
  offset: number
) => {
  // Use cursor-based pagination for better performance
  const query = `
    SELECT * FROM photos 
    WHERE user_id = $1 AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `;
  
  return await pool.query(query, [userId, limit, offset]);
};
```

### Caching Strategy
```typescript
// Redis caching
import Redis from 'ioredis';

export const redis = new Redis(process.env.REDIS_URL);

export const cachePhoto = async (photoId: string, photo: Photo) => {
  await redis.setex(`photo:${photoId}`, 3600, JSON.stringify(photo));
};

export const getCachedPhoto = async (photoId: string): Promise<Photo | null> => {
  const cached = await redis.get(`photo:${photoId}`);
  return cached ? JSON.parse(cached) : null;
};

// Cache middleware
export const cacheMiddleware = (ttl: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const cacheKey = `cache:${req.method}:${req.originalUrl}`;
    const cached = await redis.get(cacheKey);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    // Override res.json to cache response
    const originalJson = res.json;
    res.json = function(data) {
      redis.setex(cacheKey, ttl, JSON.stringify(data));
      return originalJson.call(this, data);
    };
    
    next();
  };
};
```

## 🔍 Debugging & Monitoring

### Debug Mode
```bash
# Enable debug logging
DEBUG=cloud-gallery:* npm run server:dev

# Database query debugging
DEBUG=drizzle:* npm run server:dev
```

### Health Checks
```typescript
// Comprehensive health check
app.get('/health/detailed', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version,
    
    // Database health
    database: {
      status: 'connected',
      latency: await measureDatabaseLatency(),
    },
    
    // Redis health (if configured)
    redis: process.env.REDIS_URL ? {
      status: await checkRedisConnection(),
      latency: await measureRedisLatency(),
    } : null,
    
    // Memory usage
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
      percentage: (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100,
    },
    
    // Active connections
    connections: {
      active: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    },
  };
  
  res.json(health);
});
```

## 🔗 Related Documentation

- **[Main README](../README.md)** - Project overview
- **[Client Documentation](../client/README.md)** - React Native app
- **[Shared Types](../shared/README.md)** - Type definitions
- **[Architecture](../docs/architecture/00_INDEX.md)** - System design
- **[Security](../docs/security/README.md)** - Security documentation

---

<div align="center">

**Built with ❤️ using Node.js, Express & PostgreSQL**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.0.1-000000?logo=express)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue?logo=postgresql)](https://www.postgresql.org/)

</div>
