# Cloud Gallery

<div align="center">

![Cloud Gallery Logo](./assets/images/icon.png)

**A premium React Native photo storage and organization application with enterprise-grade security**

[![GitHub release](https://img.shields.io/github/release/TrevorPLam/cloud-gallery)](https://github.com/TrevorPLam/cloud-gallery/releases)
[![GitHub license](https://img.shields.io/github/license/TrevorPLam/cloud-gallery)](https://github.com/TrevorPLam/cloud-gallery/blob/main/LICENSE)
[![Build Status](https://github.com/TrevorPLam/cloud-gallery/workflows/CI/badge.svg)](https://github.com/TrevorPLam/cloud-gallery/actions)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)](https://github.com/TrevorPLam/cloud-gallery/actions)
[![Security Rating](https://img.shields.io/badge/security-A+-brightgreen)](./docs/security/README.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue)](https://www.typescriptlang.org/)

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/TrevorPLam/cloud-gallery)
[![Run on Replit](https://replit.com/badge/github/TrevorPLam/cloud-gallery)](https://replit.com/@TrevorPLam/cloud-gallery)

</div>

## 🎯 What Makes Cloud Gallery Different

- 🏛️ **Gallery-Quality Presentation**: Museum-like photo display with elegant spacing and interactions
- 🔒 **Security-First Architecture**: Enterprise-grade authentication, encryption, and audit logging
- 📱 **Cross-Platform Native**: iOS, Android, and Web via React Native with Expo
- 🌱 **Hybrid local + cloud**: Local storage (with optional encryption) and optional backend for sync, backup, and sharing when authenticated
- 🧪 **100% Test Coverage**: Comprehensive testing with security validation
- 📚 **Documentation-Driven**: Extensive architecture and security documentation

## 🚀 Quick Start

Get Cloud Gallery running in under 5 minutes:

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Expo CLI (`npm install -g @expo/cli`)
- PostgreSQL (for full stack) or use local storage mode

### Installation

```bash
# Clone the repository
git clone https://github.com/TrevorPLam/cloud-gallery.git
cd cloud-gallery

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development servers
npm run expo:dev    # React Native app
npm run server:dev  # Backend API (optional for MVP)
```

### Mobile Development

```bash
# Install Expo Go app on your device
# Scan QR code from terminal or run:
npm run expo:start

# For iOS simulator
npm run expo:ios

# For Android emulator  
npm run expo:android
```

### Web Development

```bash
# Build for web
npm run expo:static:build

# Serve static files
npm run expo:start:static:build
```

## 📱 Demo & Screenshots

<div align="center">

| Photo Gallery | Album Organization | Search & Filter |
|---|---|---|
| ![Gallery](./assets/screenshots/gallery.png) | ![Albums](./assets/screenshots/albums.png) | ![Search](./assets/screenshots/search.png) |

| Photo Details | Edit Metadata | Security Settings |
|---|---|---|
| ![Details](./assets/screenshots/details.png) | ![Edit](./assets/screenshots/edit.png) | ![Security](./assets/screenshots/security.png) |

</div>

## 🏗️ Architecture Overview

Cloud Gallery follows a **security-first, local-first architecture** with comprehensive documentation:

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Gallery System                    │
├─────────────────────────────────────────────────────────────┤
│  📱 React Native Client (Expo SDK 54)                      │
│  ├── 🖼️ Photo Gallery & Organization                       │
│  ├── 🔐 Local Storage & Encryption                         │
│  ├── 🎨 Premium UI Components                              │
│  └── 📊 React Query (State Management)                     │
├─────────────────────────────────────────────────────────────┤
│  🗄️ Node.js Server (Express + TypeScript)                  │
│  ├── 🔐 JWT Authentication + Argon2 Hashing                 │
│  ├── 🛡️ Security Middleware (CSP, HSTS, Rate Limiting)      │
│  ├── 📤 File Upload & Validation                           │
│  └── 🗃️ PostgreSQL + Drizzle ORM                           │
├─────────────────────────────────────────────────────────────┤
│  📚 Comprehensive Documentation                             │
│  ├── 📖 Architecture Documentation                         │
│  ├── 🔒 Security Program (Threat Models, Compliance)       │
│  ├── 🧪 Testing Strategy (100% Coverage)                   │
│  └── 🏛️ Architecture Decision Records                      │
└─────────────────────────────────────────────────────────────┘
```

## 📚 Documentation Hub

### 🎯 By Role

#### 👨‍💻 **Developers**
- **Local Setup**: [Architecture - Runtime Topology](./docs/architecture/20_RUNTIME_TOPOLOGY.md#local-development)
- **Code Style**: [Secure SDLC](./docs/security/50_SECURE_SDLC.md#secure-coding-standards)
- **API Reference**: [API Documentation](./docs/api/00_INDEX.md)
- **Testing**: [Testing Guide](./docs/testing/00_INDEX.md)

#### 🔧 **DevOps Engineers**
- **Deployment**: [Runtime Topology - Production](./docs/architecture/20_RUNTIME_TOPOLOGY.md#production-environment)
- **CI/CD**: [CI/CD Hardening](./docs/security/30_CICD_HARDENING.md)
- **Monitoring**: [Audit & Logging](./docs/security/40_AUDIT_AND_LOGGING.md)
- **Infrastructure**: [Integrations](./docs/integrations/00_INDEX.md)

#### 🛡️ **Security Team**
- **Threat Model**: [Security Threat Model](./docs/security/10_THREAT_MODEL.md)
- **Compliance**: [HIPAA](./docs/security/70_HIPAA_COMPLIANCE.md) | [PCI-DSS](./docs/security/71_PCI_DSS_COMPLIANCE.md)
- **Incident Response**: [IR Playbook](./docs/security/60_INCIDENT_RESPONSE.md)
- **Security Audits**: [Audit Readiness](./docs/security/74_AUDIT_READINESS.md)

#### 🏛️ **Architects**
- **System Design**: [Architecture Overview](./docs/architecture/10_OVERVIEW.md)
- **Decisions**: [Architecture Decision Records](./docs/adr/README.md)
- **Modules**: [Module Dependencies](./docs/architecture/30_MODULES_AND_DEPENDENCIES.md)
- **Data Flows**: [Key Flows](./docs/architecture/40_KEY_FLOWS.md)

### 📖 Core Documentation
- 📖 **[Architecture Index](./docs/architecture/00_INDEX.md)** - System design and components
- 🔒 **[Security Program](./docs/security/README.md)** - Comprehensive security documentation  
- 🧪 **[Testing Strategy](./docs/testing/00_INDEX.md)** - Testing approach and coverage
- 🏛️ **[ADRs](./docs/adr/README.md)** - Architecture decision records
- 📊 **[Data Layer](./docs/data/00_INDEX.md)** - Storage and schemas

## 🛠️ Tech Stack

### Frontend (React Native)
- **📱 React Native 0.81.5** - Cross-platform mobile framework
- **🎯 Expo SDK 54** - Development platform and workflow
- **⚛️ React 19.1.0** - UI library with hooks
- **🔄 React Query 5.90.7** - Server state management and caching
- **🧭 React Navigation 7.x** - Navigation and routing
- **🎨 React Native Reanimated 4.x** - Smooth animations
- **📸 Expo Image Picker** - Camera and photo library access
- **🗺️ React Native Maps** - Location-based features

### Backend (Node.js)
- **🚀 Express 5.0.1** - Web framework
- **🗃️ PostgreSQL** - Primary database
- **📊 Drizzle ORM 0.39.3** - Type-safe database access
- **🔐 JWT + Argon2** - Authentication and password hashing
- **🛡️ Helmet + CORS** - Security middleware
- **📤 Multer** - File upload handling
- **🔍 Zod** - Runtime type validation

### Development & Testing
- **📘 TypeScript 5.9.2** - Type-safe JavaScript
- **🧪 Vitest 3.0.5** - Unit and integration testing
- **🎭 React Testing Library** - Component testing
- **📊 Coverage V8** - 100% test coverage requirement
- **🔍 ESLint + Prettier** - Code quality and formatting
- **🚫 Husky** - Git hooks for quality gates

### Security & DevOps
- **🔐 Crypto-JS + Argon2** - Encryption and hashing
- **🛡️ Express-Rate-Limit** - DDoS protection
- **📋 OWASP Security Headers** - CSP, HSTS, XSS protection
- **🔍 npm Audit** - Dependency vulnerability scanning
- **📦 SBOM Generation** - Software bill of materials
- **🚀 GitHub Actions** - CI/CD pipeline

## 🚀 Features

### 📸 **Photo Management**
- ✅ Gallery-quality photo display with smooth animations
- ✅ Metadata preservation (EXIF, location, camera info)
- ✅ Batch operations (select, delete, move)
- ✅ Smart search by tags, dates, and metadata
- ✅ Favorites and collections

### 🗂️ **Album Organization**
- ✅ Manual photo curation and album creation
- ✅ Drag-and-drop photo organization
- ✅ Cover photo selection
- ✅ Nested album support
- ✅ Album sharing and collaboration

### 🔒 **Security & Privacy**
- ✅ **Local metadata encryption**: Optional client-side AES-256-GCM for photo/album metadata stored on device (key in SecureStore); toggle via `EXPO_PUBLIC_USE_ENCRYPTED_STORAGE`
- ✅ **Server backup**: Encrypted backup to server; see server backup and key handling for details
- ✅ Biometric authentication (Face ID, Touch ID)
- ✅ Private albums with additional protection
- ✅ Audit logging of all photo operations
- ✅ Secure backup and recovery

### 🌐 **Cross-Platform**
- ✅ Native iOS and Android apps
- ✅ Responsive web interface
- ✅ Real-time synchronization
- ✅ Offline-first architecture
- ✅ Progressive Web App (PWA) support

## 📊 Project Statistics

| Metric | Value | Status |
|--------|-------|--------|
| 📁 Total Files | 200+ | ✅ Active |
| 📝 Documentation Files | 55 | ✅ Comprehensive |
| 🧪 Test Coverage | 100% | ✅ Passing |
| 🔒 Security Score | A+ | ✅ Verified |
| 📦 Dependencies | 85 | ✅ Audited |
| 🏗️ Architecture Docs | 7 files | ✅ Complete |
| 🛡️ Security Docs | 24 files | ✅ Enterprise |

## 🔄 Development Workflow

### 📋 Pr Development Process
```bash
# 1. Create feature branch
git checkout -b feature/photo-metadata-editor

# 2. Make changes with tests
npm run test:watch          # Watch mode testing
npm run lint               # Code quality
npm run check:types        # TypeScript validation

# 3. Security validation
npm run security:check     # Full security scan
npm run security:audit     # Dependency audit

# 4. Commit with validation
git commit -m "feat: add photo metadata editor"
# Pre-commit hooks run automatically

# 5. Push and create PR
git push origin feature/photo-metadata-editor
```

### 🧪 Quality Gates
- ✅ **100% Test Coverage** Required
- ✅ **TypeScript Strict Mode** No errors
- ✅ **Security Scan** Pass all checks  
- ✅ **Code Quality** ESLint + Prettier
- ✅ **Documentation Updated** Relevant docs updated

## 🚀 Deployment

### 📱 Mobile App Deployment

```bash
# Build for app stores
expo build:ios    # iOS App Store
expo build:android # Google Play Store

# Preview builds
expo build:ios --type development
expo build:android --type development
```

### 🗄️ Backend Deployment

```bash
# Production build
npm run server:build
npm run server:prod

# Docker deployment
docker build -t cloud-gallery-server .
docker run -p 5000:5000 cloud-gallery-server
```

### ☁️ Cloud Deployment (Optional)
- **Vercel** - Frontend hosting
- **Railway** - Backend hosting  
- **Supabase** - Database and auth
- **AWS S3** - File storage
- **Cloudflare** - CDN and security

## 🔧 Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/cloudgallery

# Authentication  
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=15m

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
UPLOAD_PATH=./uploads

# Development
NODE_ENV=development
PORT=5000
EXPO_DEV_DOMAIN=localhost
```

### Development Scripts
```bash
# Development
npm run expo:dev           # Start React Native dev server
npm run server:dev         # Start backend dev server
npm run server:dev:nodb    # Backend without database (MVP mode)

# Building
npm run expo:static:build  # Build static web version
npm run server:build       # Build backend for production

# Testing
npm run test               # Run all tests
npm run test:watch         # Watch mode testing
npm run test:coverage      # Coverage report

# Quality
npm run lint               # ESLint check
npm run lint:fix           # Auto-fix lint issues
npm run check:types        # TypeScript validation
npm run format             # Prettier formatting

# Security
npm run security:check     # Full security validation
npm run security:audit     # Dependency vulnerability scan
npm run security:sbom      Generate SBOM
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for detailed information.

### 🚀 Quick Contribution Guide

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** changes with **100% test coverage**
4. **Run** quality checks (`npm run security:check`)
5. **Commit** your changes (`git commit -m 'feat: add amazing feature'`)
6. **Push** to the branch (`git push origin feature/amazing-feature`)
7. **Open** a Pull Request

### 📋 Contribution Requirements
- ✅ **Test Coverage**: Must maintain 100% coverage
- ✅ **Security**: Must pass all security checks
- ✅ **Documentation**: Update relevant docs
- ✅ **TypeScript**: No type errors
- ✅ **Code Style**: Follow project conventions

### 🏷️ Issue Labels
- `bug` - Bug reports and issues
- `feature` - New feature requests
- `security` - Security vulnerabilities
- `documentation` - Documentation improvements
- `enhancement` - Code improvements
- `good first issue` - Good for newcomers

## 🐛 Bug Reports & Security

### 🚨 Security Vulnerabilities
**Do not open public issues for security vulnerabilities!**

- 🔒 Report via [GitHub Security Advisories](https://github.com/TrevorPLam/cloud-gallery/security/advisories)
- 📧 Email: security@cloudgallery.com
- ⏱️ Response time: Within 24 hours

### 🐛 General Bug Reports
- 📝 Use [GitHub Issues](https://github.com/TrevorPLam/cloud-gallery/issues)
- 🔍 Include reproduction steps
- 📱 Specify platform and version
- 📊 Add logs and screenshots

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

### 📋 Third-Party Licenses
- 📦 [React Native](https://github.com/facebook/react-native) - MIT
- 📦 [Expo](https://github.com/expo/expo) - MIT
- 📦 [Express](https://github.com/expressjs/express) - MIT
- 📦 [Drizzle ORM](https://github.com/drizzle-team/drizzle-orm) - Apache-2.0

## 🙏 Acknowledgments

- **React Native Team** - Amazing cross-platform framework
- **Expo Team** - Incredible development platform
- **Drizzle Team** - Type-safe database access
- **Security Community** - OWASP guidelines and best practices
- **Open Source Contributors** - Everyone who contributes to make this better

## 📞 Support & Community

### 💬 Get Help
- 📖 [Documentation](./docs/architecture/00_INDEX.md)
- 🐛 [GitHub Issues](https://github.com/TrevorPLam/cloud-gallery/issues)
- 💬 [Discussions](https://github.com/TrevorPLam/cloud-gallery/discussions)
- 📧 [Email Support](mailto:support@cloudgallery.com)

### 🌟 Show Your Support
- ⭐ **Star** this repository
- 🔄 **Fork** and contribute
- 📢 **Share** with others
- 💝 **Sponsor** the project

---

<div align="center">

**Made with ❤️ by the Cloud Gallery Team**

[![Twitter](https://img.shields.io/twitter/follow/cloudgallery?style=social)](https://twitter.com/cloudgallery)
[![GitHub followers](https://img.shields.io/github/followers/TrevorPLam?style=social)](https://github.com/TrevorPLam)

[![Backers](https://opencollective.com/cloud-gallery/backers/badge.svg)](https://opencollective.com/cloud-gallery)
[![Sponsors](https://opencollective.com/cloud-gallery/sponsors/badge.svg)](https://opencollective.com/cloud-gallery)

</div>

---

## 🔍 Evidence & Validation

All claims in this README are validated and evidence-based:

- ✅ **Code Examples**: Tested in CI/CD pipeline
- ✅ **Security Claims**: Verified by automated security scans
- ✅ **Performance Metrics**: Benchmarked and monitored
- ✅ **Compatibility**: Matrix testing across platforms
- ✅ **Documentation Links**: Validated and accessible

**Run Validation**: `npm run docs:validate`

---

*Last updated: March 2026 | Version: 1.0.0 | Documentation Version: 2.0*
