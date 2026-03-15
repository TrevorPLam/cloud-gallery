# Cloud Gallery - AI Agent Instructions

<div align="center">

![Cloud Gallery](./assets/images/icon.png)

**AI-optimized documentation for Cloud Gallery photo management application**

</div>

## 🎯 Project Overview

Cloud Gallery is a premium React Native photo storage and organization application with enterprise-grade security. This is a monorepo containing React Native client, Node.js backend, and shared TypeScript types.

**One-Liner**: React Native photo gallery app with local-first storage, enterprise security, and bidirectional album-photo relationships.

## 🏗️ Architecture Overview

```
cloud-gallery/
├── client/          # React Native app (Expo SDK 54)
├── server/          # Node.js backend (Express 5.0)
├── shared/          # TypeScript types and schemas
├── scripts/         # Build and automation scripts
└── docs/            # Comprehensive documentation
```

### Key Technologies
- **Frontend**: React Native 0.81.5, Expo SDK 54, React Query 5.90.7
- **Backend**: Node.js 18+, Express 5.0.1, TypeScript 5.9.2
- **Database**: PostgreSQL 15 with Drizzle ORM 0.39.3
- **Security**: JWT + Argon2, comprehensive security headers
- **Testing**: Vitest 3.0.5 with 100% coverage requirement

## 🚀 Build & Test Commands

### Development
```bash
# Start React Native development server
npm run expo:dev

# Start backend server (optional for MVP)
npm run server:dev

# Start backend without database (MVP mode)
npm run server:dev:nodb
```

### Building
```bash
# Build static web version
npm run expo:static:build

# Build backend for production
npm run server:build

# Start production backend
npm run server:prod
```

### Testing
```bash
# Run all tests (100% coverage required)
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Quality Assurance
```bash
# Type checking
npm run check:types

# Linting
npm run lint

# Auto-fix linting
npm run lint:fix

# Code formatting
npm run format

# Check formatting
npm run check:format
```

### Security
```bash
# Comprehensive security validation
npm run security:check

# Dependency vulnerability scan
npm run security:audit

# Generate SBOM
npm run security:sbom
```

### Database
```bash
# Push schema changes
npm run db:push

# Generate migrations
npm run db:generate

# Reset database
npm run db:reset
```

## 📁 Module Structure

### Client Architecture
```
client/
├── App.tsx              # Root component with providers
├── navigation/           # React Navigation setup
├── screens/             # Main app screens
├── components/          # Reusable UI components
├── hooks/               # Custom React hooks
├── lib/                 # Core utilities and storage
├── types/               # TypeScript definitions
└── constants/           # App constants
```

### Server Architecture
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

## 🔐 Security Considerations

### Authentication & Authorization
- JWT tokens with 15-minute expiration
- Argon2id password hashing with proper parameters
- Biometric authentication support in mobile app
- Rate limiting on all endpoints (100 req/15min, 10 req/15min for auth)

### Data Protection
- End-to-end encryption for sensitive photos
- Field-level encryption for metadata
- Secure key management with environment variables
- Audit logging for all security-relevant operations

### Input Validation
- Zod schemas for runtime validation
- File upload validation (type, size, content)
- SQL injection prevention with parameterized queries
- XSS protection with CSP headers

### Security Testing
```bash
# Run penetration tests
./scripts/pen-test.sh

# Security validation
npm run security:check
```

## 📱 Platform-Specific Guidelines

### React Native (Client)
- Use Expo SDK 54 features and conventions
- Follow React Navigation v7 patterns
- Implement proper error boundaries
- Use React Query for data fetching and caching
- Platform-specific code in `.web.ts` or `.ios.ts` files

### Node.js (Server)
- Use async/await, never callbacks
- Implement proper error handling with try-catch
- Use TypeScript strict mode
- Follow Express 5.0 patterns
- Implement comprehensive logging

### Database
- Use Drizzle ORM with TypeScript
- All database operations must be typed
- Use transactions for multi-table operations
- Implement proper connection pooling
- Never expose raw SQL to client

## 🔄 Development Workflow

### Git Workflow
- Use conventional commits: `feat:`, `fix:`, `docs:`, `security:`
- All PRs must pass 100% test coverage
- Security changes require additional review
- Update documentation with code changes

### Code Style
- TypeScript strict mode enabled
- Use ES modules (import/export)
- Prefer named exports over default exports
- Use descriptive variable names
- Add JSDoc comments for complex functions

### Testing Strategy
- 100% test coverage required
- Unit tests for business logic
- Integration tests for API endpoints
- Security tests for authentication
- Performance tests for critical paths

## 🎨 Code Conventions

### TypeScript
```typescript
// Use interfaces for object shapes
interface Photo {
  id: string;
  uri: string;
  width: number;
  height: number;
}

// Use proper typing for functions
const createPhoto = async (photoData: CreatePhotoRequest): Promise<Photo> => {
  // Implementation
};

// Use enums for constants
enum PhotoStatus {
  Active = 'active',
  Deleted = 'deleted',
  Archived = 'archived',
}
```

### React Native
```typescript
// Use functional components with hooks
const PhotoGrid: React.FC<PhotoGridProps> = ({ photos, onPhotoPress }) => {
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  
  // Implementation
};

// Use proper TypeScript for props
interface PhotoGridProps {
  photos: Photo[];
  onPhotoPress: (photo: Photo, index: number) => void;
}
```

### Node.js/Express
```typescript
// Use proper middleware patterns
app.use('/api/photos', authenticateToken, photoRoutes);

// Use async route handlers
router.get('/', async (req: Request, res: Response) => {
  try {
    const photos = await getUserPhotos(req.user.id);
    res.json({ photos });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

## 📋 Important Gotchas

### Critical Files to Never Modify Directly
- `package-lock.json` - Use npm commands
- `node_modules/` - Never edit directly
- Database migrations - Use migration scripts
- Environment files - Copy from `.env.example`

### Known Workarounds
- Expo development requires `EXPO_DEV_DOMAIN` for network access
- AsyncStorage has size limits (~6-10MB)
- Image picker requires explicit permissions on iOS
- CORS configuration must allow specific origins in production

### Performance Considerations
- Use FlashList for large photo grids
- Implement lazy loading for images
- Cache React Query responses appropriately
- Optimize bundle size with dynamic imports

## 🔍 External Dependencies

### Required Services
- **PostgreSQL 15+**: Primary database
- **Redis** (optional): Caching and sessions
- **Expo**: Build and deployment platform

### Environment Variables
See `.env.example` for required variables:
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: JWT signing secret
- `NODE_ENV`: Environment (development/production)
- `EXPO_DEV_DOMAIN`: Development network access

### External APIs
- **Expo APIs**: Image picker, media library, location
- **Cloud services**: Optional for cloud sync (S3, Cloudinary)
- **Push notifications**: Via Expo push notifications

## 📚 Documentation References

### Essential Reading
- `@README.md` - Project overview and quick start
- `@docs/architecture/00_INDEX.md` - System architecture
- `@docs/security/README.md` - Security program
- `@docs/testing/00_INDEX.md` - Testing strategy

### Code References
- `@shared/schema.ts` - Database schema definitions
- `@client/types/index.ts` - TypeScript type definitions
- `@server/middleware.ts` - Security middleware patterns

### API Documentation
- `@docs/api/00_INDEX.md` - API endpoint documentation
- Authentication flows in `@docs/security/11_IDENTITY_AND_ACCESS.md`
- File upload handling in `@server/upload-routes.ts`

## 🧪 Testing Patterns

### Unit Tests
```typescript
describe('Photo Storage', () => {
  it('should add photo with valid data', async () => {
    const photo = await addPhoto(mockPhotoData);
    expect(photo.id).toBeDefined();
    expect(photo.uri).toBe(mockPhotoData.uri);
  });
});
```

### Integration Tests
```typescript
describe('Photo API', () => {
  it('should create photo via API', async () => {
    const response = await request(app)
      .post('/api/photos')
      .set('Authorization', `Bearer ${token}`)
      .send(photoData)
      .expect(201);
    
    expect(response.body.photo.id).toBeDefined();
  });
});
```

### Security Tests
```typescript
describe('Authentication', () => {
  it('should reject requests without token', async () => {
    await request(app)
      .get('/api/photos')
      .expect(401);
  });
});
```

## 🚨 Agent Behavior Guidelines

### What to Do
- Always run tests before suggesting changes
- Use exact commands from this file
- Check security implications of changes
- Update documentation when adding features
- Follow the established code patterns

### What to Avoid
- Never commit sensitive data (API keys, passwords)
- Don't disable security features
- Avoid breaking existing API contracts
- Don't add dependencies without justification
- Never skip type checking or linting

### Verification Steps
1. Run `npm run check:types` - No TypeScript errors
2. Run `npm run lint` - No linting errors
3. Run `npm run test` - All tests pass
4. Run `npm run security:check` - Security validation passes
5. Test the specific feature being modified

## 🔧 Advanced Agent Capabilities

### Progressive Disclosure
- Use `@docs/` references for detailed information
- Load security docs when working on auth features
- Reference testing docs when writing tests
- Import architecture docs for structural changes

### Context Management
- Focus on relevant modules for specific tasks
- Use subdirectory AGENT.md files for module-specific rules
- Load external references only when needed
- Maintain context efficiency with targeted imports

### Error Recovery
If something goes wrong:
1. Check if commands match this file exactly
2. Verify environment setup
3. Review security configurations
4. Check for missing dependencies
5. Consult relevant documentation

---

## 📊 Project Metrics

- **Test Coverage**: 100% required
- **Security Score**: A+ rating
- **Documentation**: 55+ files
- **Dependencies**: 85+ packages
- **Architecture**: Client/Server/Shared separation

---

*Last updated: March 2026 | Version: 1.0.0 | Compatible with: AGENTS.md standard v1.0*
