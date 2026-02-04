# AGENTS.md — Cloud Gallery Development Guide

**Version**: 2.0.0  
**Last Updated**: 2026-02-04  
**For**: AI Agents & Non-technical Builders  
**Purpose**: Comprehensive development guide with task breakdowns, code examples, and inline commentary

---

## � **TABLE OF CONTENTS**

### **🎯 Getting Started**
- [📋 Project Overview](#-project-overview)
- [🛠️ Tech Stack](#️-tech-stack)
- [📁 Repository Map](#-repository-map-with-inline-commentary)
- [🚨 Critical Issues Identified](#-critical-issues-identified-must-fix-before-features)
- [🎯 How AI Agents Should Use This Document](#-how-ai-agents-should-use-this-document)
- [📊 Project Injection](#-project-injection-ai-context)

### **📚 Reference Materials**
- [🏷️ Label System](#️-label-system)
- [🎯 Quick Reference Cards](#-quick-reference-cards)
- [📖 Glossary — Learn the Jargon First](#-glossary--learn-the-jargon-first)
  - [🏗️ Architecture Terms](#️-architecture-terms)
  - [💾 Data & Storage Terms](#-data--storage-terms)
  - [⚛️ React & TypeScript Terms](#️-react--typescript-terms)
  - [📡 Data Fetching Terms](#-data-fetching-terms)
  - [🎨 Code Architecture Terms](#-code-architecture-terms)
  - [🚀 Performance Terms](#-performance-terms)
  - [🔧 Development Tools Terms](#-development-tools-terms)

### **🗓️ Work Schedule**
- [🎯 Work Order: What Sequence to Follow](#-work-order-what-sequence-to-follow)

### **🔴 Critical Foundation Fixes** (Week 1-4)
- [📝 TASK 1: Connect Client to Server](#-task-1-connect-client-to-server--start-here) 🚨 **START HERE**
  - [SUBTASK 1.1: Create Photo Database Table](#-subtask-11-create-photo-database-table--agent)
  - [SUBTASK 1.2: Create Album Database Table](#-subtask-12-create-album-database-table--agent)
  - [SUBTASK 1.3: Create Database Connection Helper](#-subtask-13-create-database-connection-helper--agent)
  - [SUBTASK 1.4: Create Photo API Endpoints](#-subtask-14-create-photo-api-endpoints-server-side--agent)
  - [SUBTASK 1.5: Register Photo Routes](#-subtask-15-register-photo-routes-in-main-server--agent)
  - [SUBTASK 1.6: Update Client PhotosScreen](#-subtask-16-update-client-photosscreen-to-use-api--agent)
- [🔴 TASK 2: Fix Data Storage Layer](#-task-2-fix-data-storage-layer)
  - [SUBTASK 2.1: Create Validation Schemas](#-subtask-21-create-validation-schemas--agent)
  - [SUBTASK 2.2: Install UUID Generator](#-subtask-22-install-uuid-generator--agent)
  - [SUBTASK 2.3: Refactor storage.ts](#-subtask-23-refactor-storagets-with-validation--agent)
- [🔴 TASK 3: Environment Variables](#-task-3-environment-variables--agent-creation--trevor-testing)
- [🔴 TASK 4: Type Safety Improvements](#-task-4-type-safety-improvements--agent)
- [🔴 TASK 5: Responsive Layouts](#-task-5-responsive-layouts--agent-code--trevor-testing)
- [🟡 TASK 6: Logger Service](#-task-6-logger-service--agent)
- [🟡 TASK 7: Centralized Error Handling](#-task-7-centralized-error-handling--agent-code--trevor-testing)
- [🟡 TASK 8: Performance (Pagination)](#-task-8-performance-pagination--agent-code--trevor-testing)
- [🟡 TASK 9: Service/Repository Layers](#-task-9-servicerepository-layers--agent)
- [🟡 TASK 10: Offline/Online Management](#-task-10-offlineonline-management--agent-code--trevor-testing)
- [🟡 TASK 11: React Query Integration](#-task-11-react-query-integration--agent)

### **� Quality & Polish Tasks** (Week 5-8, From DIAMOND Analysis)
- [💎 Quality & Polish Tasks Overview](#-quality--polish-tasks-from-diamond-standards-analysis)
- [🔴 TASK 12: Create README.md](#-task-12-create-readmemd--agent)
- [🔴 TASK 13: Deploy Error Boundaries](#-task-13-deploy-error-boundaries--agent)
- [🟡 TASK 14: Accessibility Audit & Fixes](#-task-14-accessibility-audit--fixes--agent-fixes--trevor-testing)
- [🟢 TASK 15: API Documentation (OpenAPI/Swagger)](#-task-15-api-documentation-openapiswagger--agent)
- [🟢 TASK 16: E2E Tests (Detox)](#-task-16-e2e-tests-detox--agent)
- [🟢 TASK 17: Performance Monitoring](#-task-17-performance-monitoring--agent)
- [🟢 TASK 18: Production Deployment Documentation](#-task-18-production-deployment-documentation--agent)
- [💎 TASK 19: Publish AI-META Pattern](#-task-19-publish-ai-meta-pattern--trevor-strategic-decision)

### **�🟥 Features** (After Foundation)
- [🟥 P0-P3 Feature Roadmap](#-p0-p3-feature-roadmap-after-foundation-fixed)
  - [P0 — Critical Features](#p0--critical-features--trevor-decides-priority-agent-implements)
  - [P1 — High Priority Features](#p1--high-priority-features--trevor-decides-priority-agent-implements)
  - [P2 — Medium Priority](#p2--medium-priority--trevor-decides-priority-agent-implements)
  - [P3 — Nice-to-Have](#p3--nice-to-have--trevor-decides-priority-agent-implements)

### **🎓 Usage & Tracking**
- [🎓 How to Use This TODO with AI](#-how-to-use-this-todo-with-ai)
- [� Rollback & Recovery Procedures](#-rollback--recovery-procedures)
- [🆘 Error Recovery & Escalation](#-error-recovery--escalation)
- [🧪 Testing Strategy](#-testing-strategy)
- [🔀 Git Workflow & Commit Conventions](#-git-workflow--commit-conventions)
- [📊 Progress Tracking](#-progress-tracking)
- [📚 External Resources & Documentation](#-external-resources--documentation)

---

## �📋 **PROJECT OVERVIEW**

### 🎯 Project Name
**Cloud Gallery** — A React Native photo management application with cloud sync capabilities

### 💡 Project Purpose
Multi-platform (iOS, Android, Web) photo gallery app with:
- Cloud backup and sync across devices
- Album organization
- Photo metadata (EXIF, GPS, tags)
- User authentication and privacy controls
- Offline-first architecture with server sync

### 🤖 AI Agent Context
This document is designed for AI agents assisting a non-technical builder. Each task includes:
- **Beginner-friendly explanations** (plain English)
- **Complete code snippets** (copy-paste ready)
- **Exact file paths and line numbers**
- **Success criteria** (how to verify it worked)
- **Troubleshooting** (common errors and fixes)

---

## � **PREREQUISITES & INITIAL SETUP**

### 💻 System Requirements

**Before you begin, ensure you have:**

- **Node.js 18+** → Check: `node --version`
- **npm 9+** → Check: `npm --version`
- **PostgreSQL 15+** → Check: `psql --version`
- **Git** → Check: `git --version`
- **Code Editor** → VS Code recommended

**Operating System:**
- ✅ Windows 10/11
- ✅ macOS 12+
- ✅ Linux (Ubuntu 20.04+)

### 📥 Installation Guide

#### Step 1: Install Node.js
```bash
# Download from: https://nodejs.org/
# Verify installation:
node --version  # Should show v18.x.x or higher
npm --version   # Should show v9.x.x or higher
```

#### Step 2: Install PostgreSQL

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Windows:**
- Download from: https://www.postgresql.org/download/windows/
- Run installer, remember the password you set
- Add to PATH if not automatic

**Linux (Ubuntu):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Verify PostgreSQL:**
```bash
psql --version  # Should show PostgreSQL 15.x
```

#### Step 3: Install Expo CLI (for mobile development)
```bash
npm install -g expo-cli
expo --version  # Verify installation
```

### 🎬 First-Time Project Setup

**Run these commands in order:**

```bash
# 1. Navigate to project directory
cd c:\dev\Cloud-Gallery

# 2. Install all dependencies (takes 2-5 minutes)
npm install

# 3. Create PostgreSQL database
createdb cloudgallery

# 4. Create environment file from template
cp .env.example .env  # Linux/Mac
copy .env.example .env  # Windows

# 5. Edit .env file and set your DATABASE_URL
# Example: DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/cloudgallery

# 6. Push database schema (creates tables)
npm run db:push

# 7. Verify TypeScript compilation
npm run check:types

# 8. Run tests to ensure everything works
npm test
```

### ✅ First-Time Setup Checklist

**Complete these before starting ANY task:**

- [ ] Node.js 18+ installed and verified
- [ ] PostgreSQL 15+ installed and running
- [ ] Git installed and configured
- [ ] Repository cloned to local machine
- [ ] `npm install` completed successfully
- [ ] Database `cloudgallery` created
- [ ] `.env` file created from `.env.example`
- [ ] `DATABASE_URL` set in `.env` file
- [ ] Database migrations run: `npm run db:push`
- [ ] TypeScript check passes: `npm run check:types`
- [ ] Tests pass: `npm test`
- [ ] Server starts: `npm run server:dev` (should see "ready on port 5000")
- [ ] Client starts: `npm start` (Expo dev server opens)
- [ ] Can access http://localhost:5000 (server responding)

### 🐛 Setup Troubleshooting

**Problem: "command not found: node"**
- Solution: Node.js not installed or not in PATH
- Fix: Install Node.js from nodejs.org, restart terminal

**Problem: "command not found: psql"**
- Solution: PostgreSQL not installed or not in PATH
- Fix: Install PostgreSQL, add to PATH, restart terminal

**Problem: "createdb: could not connect to database"**
- Solution: PostgreSQL service not running
- Fix: Start PostgreSQL service (see installation commands above)

**Problem: "npm install" fails with permission errors**
- Solution: Permissions issue or corrupted cache
- Fix: Run `npm cache clean --force`, then `npm install` again

**Problem: "Database migration failed"**
- Solution: DATABASE_URL incorrect or database doesn't exist
- Fix: Check `.env` file, verify database exists with `psql -l`

---

## �🛠️ **TECH STACK**

### Frontend (Client)
- **React Native** (0.78.8) — Cross-platform mobile framework
- **Expo** (54.0.23) — React Native development platform
- **TypeScript** (5.9.2) — Type-safe JavaScript
- **React Navigation** (7.0+) — App navigation
- **React Query / TanStack Query** (5.90.7) — Server state management
- **AsyncStorage** — Local data persistence
- **Zod** (3.24.2) — Runtime validation

### Backend (Server)
- **Node.js** — JavaScript runtime
- **Express** (5.0.1) — Web server framework
- **PostgreSQL** — Relational database
- **Drizzle ORM** (0.39.3) — Type-safe database queries
- **JWT** — Authentication tokens
- **bcrypt** — Password hashing

### Development Tools
- **Vite** — Fast build tool
- **ESLint** — Code linting
- **Vitest** — Unit testing
- **TypeScript Compiler** — Type checking

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

## 📁 **REPOSITORY MAP** (with inline commentary)

```
c:\dev\Cloud-Gallery\
│
├─ 📄 package.json                    # Dependencies, scripts, project metadata
├─ 📄 tsconfig.json                   # TypeScript configuration (strict mode enabled)
├─ 📄 drizzle.config.ts              # Database ORM configuration
├─ 📄 vitest.config.ts               # Test runner configuration
├─ 📄 eslint.config.js               # Linting rules
├─ 📄 babel.config.js                # JavaScript transpiler config
├─ 📄 app.json                       # Expo app configuration
├─ 📄 AGENTS.md                      # ← THIS FILE (AI agent instructions)
├─ 📄 TODO.backup.md                 # Original code quality analysis
│
├─ 📁 client/ ................................. React Native mobile app
│   ├─ 📄 App.tsx                    # Application entry point (navigation setup)
│   ├─ 📄 index.js                   # Expo entry file
│   │
│   ├─ 📁 components/ ................. Reusable UI components
│   │   ├─ AlbumCard.tsx            # Album grid item
│   │   ├─ PhotoGrid.tsx            # High-performance photo grid (FlashList)
│   │   ├─ FloatingActionButton.tsx # + button for uploads
│   │   ├─ EmptyState.tsx           # "No photos yet" placeholder
│   │   ├─ ErrorBoundary.tsx        # React error catcher
│   │   ├─ SkeletonLoader.tsx       # Loading placeholders
│   │   └─ Themed*.tsx              # Dark/light mode wrappers
│   │
│   ├─ 📁 screens/ .................... Full-page views
│   │   ├─ PhotosScreen.tsx         # Main photo library (NEEDS API integration)
│   │   ├─ AlbumsScreen.tsx         # Album collection view (NEEDS API integration)
│   │   ├─ PhotoDetailScreen.tsx    # Single photo view with actions
│   │   ├─ AlbumDetailScreen.tsx    # Photos within one album
│   │   ├─ SearchScreen.tsx         # Photo search interface
│   │   └─ ProfileScreen.tsx        # User settings and account
│   │
│   ├─ 📁 navigation/ ................. React Navigation setup
│   │   ├─ RootStackNavigator.tsx   # Top-level navigation container
│   │   ├─ MainTabNavigator.tsx     # Bottom tab bar (Photos, Albums, Search, Profile)
│   │   ├─ PhotosStackNavigator.tsx # Photo-related screens stack
│   │   ├─ AlbumsStackNavigator.tsx # Album-related screens stack
│   │   ├─ SearchStackNavigator.tsx # Search screens stack
│   │   └─ ProfileStackNavigator.tsx# Profile screens stack
│   │
│   ├─ 📁 lib/ ........................ Utility libraries and services
│   │   ├─ storage.ts               # ⚠️ FRAGILE: Local data persistence (needs refactor)
│   │   ├─ storage.test.ts          # Storage unit tests
│   │   ├─ query-client.ts          # React Query configuration
│   │   ├─ query-client.test.ts     # Query client tests
│   │   ├─ secure-storage.ts        # Encrypted storage for sensitive data
│   │   └─ secure-storage.test.ts   # Secure storage tests
│   │
│   ├─ 📁 hooks/ ...................... Custom React hooks
│   │   ├─ useTheme.ts              # Dark/light theme hook
│   │   ├─ useColorScheme.ts        # Native color scheme detection
│   │   ├─ useColorScheme.web.ts    # Web color scheme detection
│   │   └─ useScreenOptions.ts      # Navigation header configs
│   │
│   ├─ 📁 constants/ .................. App-wide constants
│   │   └─ theme.ts                 # Colors, spacing, typography
│   │
│   └─ 📁 types/ ...................... TypeScript type definitions
│       └─ index.ts                 # Photo, Album, User types
│
├─ 📁 server/ ................................. Express backend API
│   ├─ 📄 index.ts                   # Server bootstrap (middleware, security)
│   ├─ 📄 routes.ts                  # ⚠️ INCOMPLETE: Route registration (needs photo/album routes)
│   ├─ 📄 auth-routes.ts             # Authentication endpoints (/api/auth)
│   ├─ 📄 auth.ts                    # Auth middleware (JWT validation)
│   ├─ 📄 upload-routes.ts           # File upload endpoints (/api/upload)
│   ├─ 📄 middleware.ts              # Custom middleware functions
│   ├─ 📄 security.ts                # Security utilities (rate limiting, CORS, CSP)
│   ├─ 📄 encryption.ts              # Data encryption utilities
│   ├─ 📄 backup-encryption.ts       # Backup file encryption
│   ├─ 📄 captcha.ts                 # CAPTCHA validation
│   ├─ 📄 audit.ts                   # Audit logging system
│   ├─ 📄 siem.ts                    # Security monitoring
│   ├─ 📄 file-validation.ts         # File upload validation
│   ├─ 📄 storage.ts                 # Server-side file storage
│   ├─ 📄 encrypted-storage.ts       # Encrypted file storage
│   ├─ 📄 db-encryption.ts           # Database encryption layer
│   │
│   └─ 📁 templates/                 # Email/notification templates
│
├─ 📁 shared/ ................................. Code shared between client & server
│   ├─ 📄 schema.ts                  # ⚠️ INCOMPLETE: Database schemas (only users table exists)
│   └─ 📄 schema.test.ts             # Schema validation tests
│
├─ 📁 tests/ .................................. Test utilities
│   └─ 📄 factories.ts               # Test data factories
│
├─ 📁 scripts/ ................................ Build and utility scripts
│   ├─ build.js                      # Production build script
│   ├─ security-check.sh             # Security scanning
│   └─ pen-test.sh                   # Penetration testing
│
├─ 📁 docs/ ................................... Project documentation
│   ├─ 📄 design_guidelines.md       # UI/UX design principles
│   │
│   ├─ 📁 api/                       # API documentation
│   │   └─ 00_INDEX.md
│   │
│   ├─ 📁 architecture/              # System architecture docs
│   │   ├─ 00_INDEX.md
│   │   ├─ 10_OVERVIEW.md
│   │   ├─ 20_RUNTIME_TOPOLOGY.md
│   │   ├─ 30_MODULES_AND_DEPENDENCIES.md
│   │   ├─ 40_KEY_FLOWS.md
│   │   └─ 90_GLOSSARY.md
│   │
│   ├─ 📁 adr/                       # Architecture Decision Records
│   │   └─ README.md
│   │
│   ├─ 📁 data/                      # Data models and schemas
│   │   └─ 00_INDEX.md
│   │
│   └─ 📁 archive/                   # Old documentation
│
└─ 📁 assets/ ................................. Static assets
    └─ 📁 images/                    # App images and icons
```

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

## 🚨 **CRITICAL ISSUES IDENTIFIED** (Must Fix Before Features)

### ❌ **Issue 1: Client-Server Disconnect** (BLOCKING)
- **Problem**: Client uses local `AsyncStorage`, server has no photo/album API endpoints
- **Impact**: No cloud sync, no multi-device support, data loss risk
- **Status**: Documented in TASK 1 below

### ⚠️ **Issue 2: Fragile Data Layer**
- **Problem**: No validation, collision-prone IDs, no transactions
- **Impact**: Data corruption risk, inconsistent state
- **Status**: Documented in TASK 2 below

### ⚠️ **Issue 3: Missing Environment Management**
- **Problem**: No `.env.example`, hardcoded secrets, no validation
- **Status**: Documented in TASK 3 below

### ⚠️ **Issue 4-11: Type Safety, Responsive UI, Logging, Error Handling, Performance**
- **Status**: All documented in tasks below

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

## 🎯 **HOW AI AGENTS SHOULD USE THIS DOCUMENT**

### 1. **Understand the Context**
   - Read PROJECT OVERVIEW and TECH STACK sections first
   - Review REPOSITORY MAP to understand codebase structure
   - Note CRITICAL ISSUES that block feature development

### 2. **Execute Tasks in Order**
   - Start with TASK 1 (most critical)
   - Follow 4-week schedule (Week 1 → Week 2 → Week 3 → Week 4)
   - Complete all subtasks before marking task complete

### 3. **Follow Label System**
   - **AGENT** = You execute (write code, create files, run commands)
   - **TREVOR** = Human verifies (tests, reviews, makes decisions)
   - **Mixed** = Collaboration required

### 4. **For Each Subtask**
   - Read "What This Means" section (plain English explanation)
   - Review "Why This Is Critical" (understand impact)
   - Follow "What To Do" steps exactly
   - Execute code changes
   - Report completion to human for verification

### 5. **Code Standards**
   - Use TypeScript strict mode (no `any` types)
   - Add inline comments explaining complex logic
   - Follow existing code patterns in the repo
   - Include error handling in all async operations
   - Write comprehensive JSDoc comments

### 6. **Communication**
   - Explain what you're doing in plain English
   - Show code before executing when destructive
   - Report errors with context and suggested fixes
   - Ask for clarification if task is ambiguous

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

## 📊 **PROJECT INJECTION** (AI Context)

### Current State Assessment
- **Code Quality**: 6/10 (functional but needs refactoring)
- **Test Coverage**: ~40% (many tests exist but not comprehensive)
- **Security**: 8/10 (strong auth, needs env hardening)
- **Architecture**: 7/10 (well-organized but client-server disconnect)
- **Performance**: 7/10 (good but needs pagination)

### Development Phase
- **Phase**: Foundation Repair (Pre-Feature Development)
- **Sprint**: 4-Week Critical Fixes
- **Next Phase**: P0 Feature Implementation

### Key Files Requiring Immediate Attention
1. `shared/schema.ts` — Missing photo/album tables
2. `server/routes.ts` — Missing photo/album endpoints
3. `client/lib/storage.ts` — Needs validation and UUIDs
4. `client/screens/PhotosScreen.tsx` — Needs API integration
5. `client/screens/AlbumsScreen.tsx` — Needs API integration

### Human Developer Profile
- **Name**: Trevor (non-technical)
- **Experience**: Uses AI to build entirely
- **Needs**: Maximum detail, beginner-friendly language, step-by-step guidance
- **Role**: Tests, verifies, makes product decisions

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

## 📦 **REQUIRED IMPORTS REFERENCE**

### 🎯 Purpose
This section provides all the import statements and helper functions that are referenced in tasks but not yet defined in your codebase. Copy these into the appropriate files when needed.

---

### `client/lib/query-client.ts` - API Request Helper

**Add this function to your existing query-client.ts file:**

```typescript
// ═══════════════════════════════════════════════════════════
// API REQUEST HELPER
// ═══════════════════════════════════════════════════════════
// Centralized API request function with authentication

import AsyncStorage from '@react-native-async-storage/async-storage';

// Base URL for API (change based on environment)
const API_BASE_URL = __DEV__ 
  ? 'http://localhost:5000'  // Development
  : 'https://your-production-api.com';  // Production

/**
 * Make authenticated API request
 * @param method - HTTP method (GET, POST, PUT, DELETE)
 * @param endpoint - API endpoint (e.g., '/api/photos')
 * @param body - Request body (optional)
 * @returns Promise<Response>
 */
export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: any
): Promise<Response> {
  // Get authentication token from storage
  const token = await AsyncStorage.getItem('authToken');
  
  // Build request configuration
  const config: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
  };
  
  // Add body for POST/PUT requests
  if (body && (method === 'POST' || method === 'PUT')) {
    config.body = JSON.stringify(body);
  }
  
  // Make request
  const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  
  // Handle unauthorized (token expired)
  if (response.status === 401) {
    await AsyncStorage.removeItem('authToken');
    throw new Error('Authentication required. Please log in again.');
  }
  
  // Handle other errors
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Request failed with status ${response.status}`);
  }
  
  return response;
}

/**
 * Set authentication token
 * @param token - JWT token from login
 */
export async function setAuthToken(token: string): Promise<void> {
  await AsyncStorage.setItem('authToken', token);
}

/**
 * Get current auth token
 * @returns Promise<string | null>
 */
export async function getAuthToken(): Promise<string | null> {
  return await AsyncStorage.getItem('authToken');
}

/**
 * Clear authentication token (logout)
 */
export async function clearAuthToken(): Promise<void> {
  await AsyncStorage.removeItem('authToken');
}
```

---

### `shared/schema.ts` - Required Imports

**Add these imports at the top of shared/schema.ts:**

```typescript
import { 
  pgTable, 
  varchar, 
  text, 
  integer, 
  boolean, 
  timestamp, 
  jsonb, 
  primaryKey 
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
```

**If you get "Cannot find module 'drizzle-zod'":**
```bash
npm install drizzle-zod
```

---

### `server/photo-routes.ts` - Required Imports

```typescript
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { db } from './db';
import { photos, insertPhotoSchema } from '../shared/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authenticateToken } from './auth';
```

---

### Common Import Errors & Solutions

| Error | Solution |
|-------|----------|
| `Cannot find module 'expo-crypto'` | Run: `npm install expo-crypto` |
| `Cannot find module 'drizzle-zod'` | Run: `npm install drizzle-zod` |
| `Cannot find name 'sql'` | Add: `import { sql } from 'drizzle-orm'` |
| `Cannot find name 'z'` | Add: `import { z } from 'zod'` |
| `Property 'user' does not exist on type 'Request'` | See TypeScript type extension below |

---

### TypeScript Type Extensions

**For Express Request with user property (server/types.ts or add to existing file):**

```typescript
// Extend Express Request type to include user
import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
      };
    }
  }
}

export {};
```

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

## 🏷️ **LABEL SYSTEM**

Every task and subtask is labeled with who should do it:

| Label | Who | What They Do |
|-------|-----|--------------|
| **AGENT** | AI Assistant | Writes code, creates files, runs commands, refactors |
| **TREVOR** | You | Tests, verifies, makes decisions, reviews output |
| **Mixed** | Both | AI codes → You test → AI fixes → You verify |

**Example Workflow:**
1. Find task labeled **AGENT** → Copy to AI, let it execute
2. AI completes → Check for **TREVOR** verification step
3. You test/verify → Report results back to AI
4. Move to next subtask

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

## 🎯 **QUICK REFERENCE CARDS**

### 🔧 Common Commands

**Daily Development:**
```bash
# Start everything (client + server)
npm run dev

# Server only (backend API)
npm run server:dev

# Client only (mobile app)
npm start
# or
expo start

# Client with cache cleared
expo start --clear
```

**Database:**
```bash
# Apply schema changes to database
npm run db:push

# Open visual database browser
npm run db:studio

# Direct database access (SQL command line)
psql cloudgallery

# View all tables
psql cloudgallery -c "\dt"

# View data in photos table
psql cloudgallery -c "SELECT * FROM photos LIMIT 10;"

# Backup database
pg_dump cloudgallery > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Testing:**
```bash
# Run all tests
npm test

# Run specific test file
npm test storage.test.ts

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Type checking
npm run check:types

# Linting
npm run lint
```

**Debugging:**
```bash
# Server with debugging enabled
npm run server:dev -- --inspect

# Clear all caches
rm -rf node_modules/.cache
expo start --clear

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# View server logs
npm run server:dev 2>&1 | tee server.log
```

---

### 📂 File Quick Access

**Bookmark these files for quick editing:**

```
🔴 Critical Files:
├─ 📄 shared/schema.ts ................ Database table definitions
├─ 📄 server/routes.ts ................ API endpoint registration
├─ 📄 server/db.ts .................... Database connection
├─ 📄 .env ............................ Environment configuration
└─ 📄 package.json .................... Dependencies and scripts

🟡 Common Edit Locations:
├─ 📄 client/lib/storage.ts ........... Data access layer
├─ 📄 client/lib/query-client.ts ...... API client & React Query config
├─ 📄 client/screens/PhotosScreen.tsx . Main photo screen
├─ 📄 client/screens/AlbumsScreen.tsx . Main album screen
└─ 📄 client/types/index.ts ........... TypeScript type definitions

🟢 API Routes:
├─ 📄 server/photo-routes.ts .......... Photo CRUD endpoints
├─ 📄 server/album-routes.ts .......... Album CRUD endpoints (to be created)
├─ 📄 server/auth-routes.ts ........... Authentication endpoints
└─ 📄 server/upload-routes.ts ......... File upload endpoints
```

---

### 🚨 Troubleshooting Quick Hits

| Problem | Solution |
|---------|----------|
| **Port 5000 already in use** | `lsof -ti:5000 \| xargs kill` (Mac/Linux)<br>`netstat -ano \| findstr :5000` then `taskkill /PID <pid> /F` (Windows) |
| **Database connection failed** | Check `DATABASE_URL` in `.env` file<br>Verify PostgreSQL is running |
| **TypeScript errors** | Run `npm run check:types` to see all errors<br>Check imports are correct |
| **Can't find module** | Run `npm install`<br>Restart TypeScript server in VS Code |
| **Tests failing** | Run `npm test -- --clearCache`<br>Check test file imports |
| **Expo won't start** | Run `expo start --clear`<br>Delete `node_modules/.cache` |
| **White screen on mobile** | Check metro bundler is running<br>Look for errors in terminal |
| **API requests failing** | Check server is running on port 5000<br>Verify `API_BASE_URL` in query-client.ts |
| **Photos not appearing** | Check database has data: `psql cloudgallery -c "SELECT COUNT(*) FROM photos;"`<br>Check network tab in browser/React Native debugger |
| **Permission denied errors** | Check file permissions<br>Try running with `sudo` (Linux/Mac) or as Administrator (Windows) |

---

### 🔑 Environment Variables Quick Reference

**Required in `.env` file:**

```bash
# Database connection
DATABASE_URL=postgresql://username:password@localhost:5432/cloudgallery

# JWT secret (for authentication)
JWT_SECRET=your-super-secret-key-change-in-production

# Node environment
NODE_ENV=development

# Server port
PORT=5000

# Optional: File upload settings
MAX_FILE_SIZE=10485760  # 10MB in bytes
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp
```

**Access in code:**

```typescript
// Server-side (Node.js)
const dbUrl = process.env.DATABASE_URL;

// Client-side (React Native / Expo)
import Constants from 'expo-constants';
const apiUrl = Constants.expoConfig?.extra?.apiUrl;
```

---

### 📊 Git Quick Commands

```bash
# Check status
git status

# Create new branch for task
git checkout -b task-1-client-server

# Stage all changes
git add .

# Commit with message
git commit -m "feat(api): add photo CRUD endpoints"

# Push to remote
git push origin task-1-client-server

# View commit history
git log --oneline

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard all local changes (dangerous!)
git reset --hard HEAD

# Discard changes to specific file
git checkout -- <filename>
```

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

## 📖 **GLOSSARY — Learn the Jargon First**

### 🏗️ Architecture Terms
- **Client** = The mobile app users see and interact with → Code lives in `/client/` folder
- **Server/Backend** = The cloud computer that stores data for all users → Code lives in `/server/` folder
- **API** (Application Programming Interface) = How the client talks to the server (like a waiter taking orders)
- **Endpoint** = A specific URL path the server listens to (examples: `/api/photos`, `/api/albums`)
- **CRUD** = Create, Read, Update, Delete — The 4 basic operations for any data

### 💾 Data & Storage Terms
- **AsyncStorage** = Local storage on the phone (like a filing cabinet on your device)
- **Database** = Organized storage on the server (like a library catalog accessible to all users)
- **PostgreSQL/Postgres** = The type of professional database we use (reliable, powerful, industry-standard)
- **Schema** = Blueprint defining how data is structured (like a form defining what fields photos have)
- **UUID** (Universally Unique Identifier) = Special random ID that will never collide (looks like `a3f2-b9c4-8d1e-2f3a`)
- **Validation** = Checking data is correct before saving it (like proofreading before publishing)
- **Transaction** = Multiple database operations that all succeed or all fail together (prevents half-finished updates)
- **Migration** = Safely changing database structure without losing data (like renovating a house while people live in it)

### ⚛️ React & TypeScript Terms
- **Component** = Reusable UI piece (like LEGO blocks you assemble to build your interface)
- **Hook** = Special React function (always starts with `use` like `useState`, `useEffect`)
- **TypeScript** = JavaScript with type checking added (catches bugs before code runs)
- **Type Safety** = System that prevents type errors (ensures a name is text, not a number)
- **Type Guard** = Function that checks if data matches expected type (like checking ID before entry)
- **Props** = Data passed to components (like function arguments/parameters)
- **State** = Data that changes over time in a component (like current photo count)

### 📡 Data Fetching Terms
- **React Query** = Library managing server data (automatically handles loading, caching, errors, retrying)
- **Query** = Fetching/reading data from server (`useQuery` = "get me photos")
- **Mutation** = Changing data on server (`useMutation` = "delete this photo")
- **Optimistic Update** = Show change in UI immediately before server confirms (makes app feel instant)
- **Cache** = Temporarily saved data to avoid re-fetching (like remembering instead of looking up again)
- **Invalidation** = Marking cached data as stale so it refetches (refresh after changes)

### 🎨 Code Architecture Terms
- **Repository Pattern** = Organizing data access code (dedicated "librarians" for each data type)
- **Service Layer** = Business logic separate from UI (the "brains" between what you see and where data lives)
- **Abstraction Layer** = Hiding implementation details behind an interface (car pedal vs engine internals)
- **Dependency Injection** = Providing dependencies from outside (makes code testable and flexible)

### 🚀 Performance Terms
- **Pagination** = Loading data in chunks/pages (like a book with pages vs one giant scroll)
- **Virtual Scrolling** = Only rendering visible items on screen (FlashList does this automatically)
- **Lazy Loading** = Loading things only when needed (opening sections as you scroll to them)
- **Infinite Scroll** = Automatically loading more as you scroll down (like social media feeds)

### 🔧 Development Tools Terms
- **Error Boundary** = React component that catches errors without crashing entire app (like car airbags)
- **Logger** = Service for recording events and errors (better than random console.log everywhere)
- **Environment Variables** = Configuration values stored outside code (like settings.ini files)
- **.env.example** = Template showing what environment variables are needed (without actual secret values)

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

## 🎯 **WORK ORDER: What Sequence to Follow**

```
┌─────────────────────────────────────────────────────────┐
│  📅 4-WEEK FOUNDATION REPAIR SCHEDULE                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  WEEK 1: CONNECTIVITY (Make client & server talk)       │
│  ╔══════════════════════════════════════════════════╗   │
│  ║ Day 1-2 → Task 1: Client↔Server Connection      ║   │
│  ║           • Create database tables               ║   │
│  ║           • Build photo API endpoints            ║   │
│  ║           • Build album API endpoints            ║   │
│  ║           • Connect screens to API               ║   │
│  ╟──────────────────────────────────────────────────╢   │
│  ║ Day 3-4 → Task 3: Environment Variables         ║   │
│  ║           • Create .env.example                  ║   │
│  ║           • Add validation on startup            ║   │
│  ║           • Type-safe env config                 ║   │
│  ╟──────────────────────────────────────────────────╢   │
│  ║ Day 5   → Testing & Documentation                ║   │
│  ║           • Test end-to-end flow                 ║   │
│  ║           • Document API endpoints               ║   │
│  ╚══════════════════════════════════════════════════╝   │
│                                                          │
│  WEEK 2: DATA QUALITY (Make data reliable & safe)       │
│  ╔══════════════════════════════════════════════════╗   │
│  ║ Day 1-2 → Task 2: Storage Layer Fixes           ║   │
│  ║           • Add Zod validation schemas           ║   │
│  ║           • Replace bad ID generation with UUIDs ║   │
│  ║           • Add transaction support              ║   │
│  ╟──────────────────────────────────────────────────╢   │
│  ║ Day 3-4 → Task 4: Type Safety Improvements      ║   │
│  ║           • Remove all "as any" casts            ║   │
│  ║           • Add explicit return types            ║   │
│  ║           • Create type guards                   ║   │
│  ╟──────────────────────────────────────────────────╢   │
│  ║ Day 5   → Testing & Code Review                 ║   │
│  ╚══════════════════════════════════════════════════╝   │
│                                                          │
│  WEEK 3: MODERN PATTERNS (Use industry best practices)  │
│  ╔══════════════════════════════════════════════════╗   │
│  ║ Day 1-3 → Task 11: React Query Integration      ║   │
│  ║           • Convert all screens to useQuery      ║   │
│  ║           • Add useMutation for changes          ║   │
│  ║           • Implement optimistic updates         ║   │
│  ╟──────────────────────────────────────────────────╢   │
│  ║ Day 4-5 → Task 9: Service/Repository Layers     ║   │
│  ║           • Create service layer                 ║   │
│  ║           • Add repository pattern               ║   │
│  ╚══════════════════════════════════════════════════╝   │
│                                                          │
│  WEEK 4: UX & POLISH (Make it professional)             │
│  ╔══════════════════════════════════════════════════╗   │
│  ║ Day 1   → Task 5: Responsive Layouts             ║   │
│  ║ Day 2   → Task 6: Logger Service                 ║   │
│  ║ Day 3-4 → Task 7: Centralized Error Handling    ║   │
│  ║ Day 5   → Task 8: Performance (Pagination)       ║   │
│  ╚══════════════════════════════════════════════════╝   │
│                                                          │
│  ✅ Foundation Complete - Ready for features            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  📅 WEEKS 5-8: QUALITY & POLISH (From DIAMOND)          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  WEEK 5: DOCUMENTATION & ERROR RECOVERY                 │
│  ╔══════════════════════════════════════════════════╗   │
│  ║ Day 1   → Task 12: Create README.md              ║   │
│  ║ Day 2-3 → Task 13: Deploy Error Boundaries       ║   │
│  ║ Day 4-5 → Task 18: Deployment Documentation      ║   │
│  ╚══════════════════════════════════════════════════╝   │
│                                                          │
│  WEEK 6: ACCESSIBILITY & API DOCS                       │
│  ╔══════════════════════════════════════════════════╗   │
│  ║ Day 1-3 → Task 14: Accessibility Audit & Fixes   ║   │
│  ║ Day 4-5 → Task 15: OpenAPI/Swagger Documentation ║   │
│  ╚══════════════════════════════════════════════════╝   │
│                                                          │
│  WEEK 7: TESTING & MONITORING                           │
│  ╔══════════════════════════════════════════════════╗   │
│  ║ Day 1-3 → Task 16: E2E Tests (Detox)             ║   │
│  ║ Day 4-5 → Task 17: Performance Monitoring        ║   │
│  ╚══════════════════════════════════════════════════╝   │
│                                                          │
│  WEEK 8: STRATEGIC INITIATIVES                          │
│  ╔══════════════════════════════════════════════════╗   │
│  ║ Day 1-5 → Task 19: Publish AI-META Pattern       ║   │
│  ║           (Blog post / Conference submission)     ║   │
│  ╚══════════════════════════════════════════════════╝   │
│                                                          │
│  ✅ A+ Rating Achieved - Ready for P0-P3 features      │
└─────────────────────────────────────────────────────────┘
```

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

# 🔴 **CRITICAL FOUNDATION FIXES** (Do First)

---

## 📝 **TASK 1: Connect Client to Server** 🚨 **START HERE**

**👤 OWNER**: Mixed (AGENT creates code, TREVOR tests)

### 🎓 What This Means (Plain English)

**Current Problem**: Your app has two separate, disconnected parts:
- **Part A (Mobile Client)**: Saves photos only on your phone using `AsyncStorage` (like a local notepad)
- **Part B (Cloud Server)**: Can handle user login but has NO way to save/retrieve photos

**The Fix**: Build a bridge so they can talk to each other (create API endpoints and connect screens)

### 🎯 Why This Is Critical

Without this connection:
- ❌ Photos only exist on ONE device (can't access from other devices)
- ❌ If phone breaks/lost, photos are gone (no cloud backup)
- ❌ Can't sync between phone and tablet
- ❌ Can't share photos with others
- ❌ Multi-device support impossible

### 📂 Files You'll Touch

```
📁 Project Structure:
  📁 server/
    │── routes.ts               [EDIT] Register new routes
    │── photo-routes.ts         [CREATE] Photo CRUD endpoints
    │── album-routes.ts         [CREATE] Album CRUD endpoints
    │── db.ts                   [CREATE] Database connection
  📁 shared/
    └── schema.ts               [EDIT] Add photo & album tables
  📁 client/
    ├── screens/
    │   ├── PhotosScreen.tsx    [EDIT] Connect to API
    │   └── AlbumsScreen.tsx    [EDIT] Connect to API
    └── lib/
        └── storage.ts          [REFACTOR] Cache layer, not primary storage
```

---

### ✅ **SUBTASK 1.1: Create Photo Database Table** → **AGENT**

**🎯 Goal**: Define how photos are stored in PostgreSQL (the permanent cloud database)

**📍 Location**: `shared/schema.ts` (line ~50, after the `users` table)

**🔧 What To Do**:

1. **Open file**: `shared/schema.ts`
2. **Find insertion point**: Look for the `users` table definition (around line 20-30)
3. **Add this code after it**:

**⏱️ Estimated Time**: 30 minutes

**⚠️ COMMON PITFALLS:**
1. **Forgot to import `sql`** → Error: "sql is not defined"
   - Fix: Add `import { sql } from 'drizzle-orm'` at top of file
2. **Added code BEFORE users table** → Error: "users is not defined"
   - Fix: Scroll down, find users table, add AFTER it
3. **Typo in table name** → Photos table created as "photoss"
   - Fix: Check spelling exactly: `pgTable('photos', {`
4. **DATABASE_URL not set** → Error: "Connection refused"
   - Fix: Check .env file exists with DATABASE_URL
5. **PostgreSQL not running** → Error: "Could not connect"
   - Fix (Mac): `brew services start postgresql`
   - Fix (Linux): `sudo systemctl start postgresql`
   - Fix (Windows): Start PostgreSQL service manually

```typescript
// ─────────────────────────────────────────────────────────
// PHOTOS TABLE
// ─────────────────────────────────────────────────────────
// Stores all photos with metadata, linked to users
// Each row = one photo someone uploaded

export const photos = pgTable('photos', {
  // Primary key - unique ID for THIS photo
  // gen_random_uuid() = Postgres generates a UUID automatically
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  
  // Foreign key - WHO owns this photo
  // references(() => users.id) = must match a real user
  // onDelete: 'cascade' = if user deleted, delete their photos too
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  // Storage location for the image file
  // Could be: S3 URL, filesystem path, CDN URL, etc.
  uri: text('uri').notNull(),
  
  // Image dimensions (for layout calculations)
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  
  // Display filename (what user sees)
  filename: text('filename').notNull(),
  
  // Is this a favorite? (for filtering)
  isFavorite: boolean('is_favorite').default(false).notNull(),
  
  // Timestamps - track when created and last changed
  // defaultNow() = automatically set to current time
  createdAt: timestamp('created_at').defaultNow().notNull(),
  modifiedAt: timestamp('modified_at').defaultNow().notNull(),
  
  // ─── Optional metadata fields (can be null) ───
  
  // GPS location data (stored as JSON)
  // Example: { latitude: 37.7749, longitude: -122.4194, city: "SF" }
  location: jsonb('location'),
  
  // Camera information (stored as JSON)
  // Example: { make: "Apple", model: "iPhone 13", iso: 100 }
  camera: jsonb('camera'),
  
  // Raw EXIF data from photo (stored as JSON)
  // EXIF = metadata embedded in photo files
  exif: jsonb('exif'),
  
  // User-added tags (stored as array of strings)
  // Example: ["vacation", "beach", "2024"]
  tags: text('tags').array(),
  
  // User notes/caption for this photo
  notes: text('notes'),
  
  // Privacy flag - should this be hidden?
  isPrivate: boolean('is_private').default(false).notNull(),
});

// ─────────────────────────────────────────────────────────
// VALIDATION SCHEMAS (using Zod)
// ─────────────────────────────────────────────────────────
// These ensure data is correct BEFORE saving to database

// For creating new photos (INSERT operations)
// omit() = don't require these fields (DB generates them)
export const insertPhotoSchema = createInsertSchema(photos).omit({
  id: true,          // DB auto-generates UUID
  createdAt: true,   // DB auto-sets timestamp
  modifiedAt: true,  // DB auto-sets timestamp
});

// For reading photos (SELECT operations)
export const selectPhotoSchema = createSelectSchema(photos);

// ─────────────────────────────────────────────────────────
// TYPESCRIPT TYPES
// ─────────────────────────────────────────────────────────
// Auto-generated types for TypeScript type checking

export type Photo = typeof photos.$inferSelect;       // Complete photo from DB
export type InsertPhoto = z.infer<typeof insertPhotoSchema>;  // For creating new photo
```

4. **Save the file** (Ctrl+S or Cmd+S)

5. **Push changes to database**:
   ```bash
   npm run db:push
   ```

**✅ Success Check** → **TREVOR**:
- [ ] File compiles without errors (`npm run check:types`)
- [ ] Database migration succeeds (see "Schema pushed successfully" message)
- [ ] No red squiggly lines in VS Code

**🐛 Troubleshooting**:
- **Error: "Cannot find name 'sql'"** → Add import: `import { sql } from 'drizzle-orm'`
- **Error: "users is not defined"** → Make sure you added code AFTER users table, not before
- **Error: "Database connection failed"** → Check `DATABASE_URL` environment variable is set

---

### ✅ **SUBTASK 1.2: Create Album Database Table** → **AGENT**

**🎯 Goal**: Define albums + link albums to photos (many-to-many relationship)

**📍 Location**: `shared/schema.ts` (add after photos table)

**⏱️ Estimated Time**: 30 minutes

**💡 Why 3 Tables?**:
- `albums` = Album info (title, description, owner)
- `album_photos` = "Junction table" linking albums ↔ photos (many-to-many)
- (We already have `photos` from previous subtask)

**🔧 What To Do**:

Add this code in `shared/schema.ts` after the photos table:

```typescript
// ─────────────────────────────────────────────────────────
// ALBUMS TABLE
// ─────────────────────────────────────────────────────────
// Collections/folders of photos organized by user

export const albums = pgTable('albums', {
  id: varchar('id').primaryKey().default(sql`gen_random_uuid()`),
  
  // Who created this album
  userId: varchar('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  
  // Album name (e.g., "Summer Vacation 2024")
  title: text('title').notNull(),
  
  // Optional longer description
  description: text('description'),
  
  // Cover photo shown as album thumbnail
  // Stores URI (not actual photo ID) for performance
  coverPhotoUri: text('cover_photo_uri'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  modifiedAt: timestamp('modified_at').defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────
// ALBUM_PHOTOS JUNCTION TABLE
// ─────────────────────────────────────────────────────────
// Links photos to albums (many-to-many relationship)
// One photo can be in multiple albums
// One album can contain multiple photos

export const albumPhotos = pgTable('album_photos', {
  // Which album?
  albumId: varchar('album_id')
    .notNull()
    .references(() => albums.id, { onDelete: 'cascade' }),
  
  // Which photo?
  photoId: varchar('photo_id')
    .notNull()
    .references(() => photos.id, { onDelete: 'cascade' }),
  
  // When was photo added to this album?
  addedAt: timestamp('added_at').defaultNow().notNull(),
  
  // Order/position in album (for sorting)
  // Lower number = appears first
  position: integer('position').default(0).notNull(),
}, (table) => {
  // Composite primary key = combination of albumId + photoId must be unique
  // Prevents adding same photo to album twice
  return {
    pk: primaryKey({ columns: [table.albumId, table.photoId] }),
  };
});

// ─────────────────────────────────────────────────────────
// VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────

export const insertAlbumSchema = createInsertSchema(albums).omit({
  id: true,
  createdAt: true,
  modifiedAt: true,
});

export const selectAlbumSchema = createSelectSchema(albums);

// ─────────────────────────────────────────────────────────
// TYPESCRIPT TYPES
// ─────────────────────────────────────────────────────────

export type Album = typeof albums.$inferSelect;
export type InsertAlbum = z.infer<typeof insertAlbumSchema>;
export type AlbumPhoto = typeof albumPhotos.$inferSelect;
```

**Save and migrate** → **AGENT**:
```bash
npm run db:push
```

**✅ Success Check** → **TREVOR**:
- [ ] `npm run check:types` passes
- [ ] Database now has 3 new tables: `photos`, `albums`, `album_photos`
- [ ] Can see tables in database viewer (if using)

---

### ✅ **SUBTASK 1.3: Create Database Connection Helper** → **AGENT**

**🎯 Goal**: Make a reusable database connection that all server code can import

**📍 Location**: Create new file `server/db.ts`

**⏱️ Estimated Time**: 15 minutes

**💡 Why Needed**: Every server route needs to query the database. This creates one shared connection.

**🔧 What To Do**:

1. **Create new file**: `server/db.ts`
2. **Add this code**:

```typescript
// ═══════════════════════════════════════════════════════════
// DATABASE CONNECTION SINGLETON
// ═══════════════════════════════════════════════════════════
// Central database connection used by all server routes
// "Singleton" = only ONE instance exists, shared everywhere

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';

// ─────────────────────────────────────────────────────────
// Get database connection string from environment
// ─────────────────────────────────────────────────────────
// Format: postgresql://username:password@host:port/database
// Example: postgresql://user:pass@localhost:5432/cloudgallery

const connectionString = process.env.DATABASE_URL;

// Fail fast if not configured (better than cryptic errors later)
if (!connectionString) {
  throw new Error(
    '❌ DATABASE_URL environment variable is not set!\n' +
    'Add it to your .env file:\n' +
    'DATABASE_URL=postgresql://user:password@localhost:5432/cloudgallery'
  );
}

// ─────────────────────────────────────────────────────────
// Create PostgreSQL client
// ─────────────────────────────────────────────────────────
// This handles the actual TCP connection to Postgres server

const client = postgres(connectionString);

// ─────────────────────────────────────────────────────────
// Create Drizzle ORM instance
// ─────────────────────────────────────────────────────────
// ORM = Object-Relational Mapping (work with objects, not SQL strings)
// Drizzle gives us type-safe queries

export const db = drizzle(client, { schema });

// ─────────────────────────────────────────────────────────
// USAGE EXAMPLE (how other files will use this):
// ─────────────────────────────────────────────────────────
/*
import { db } from './db';
import { photos } from '../shared/schema';
import { eq } from 'drizzle-orm';

const userPhotos = await db
  .select()
  .from(photos)
  .where(eq(photos.userId, '123'));
*/
```

3. **Save file** → **AGENT**

**✅ Success Check** → **TREVOR**:
- [ ] File compiles (`npm run check:types`)
- [ ] No import errors
- [ ] Can import in other files: `import { db } from './db';`

---

### ✅ **SUBTASK 1.4: Create Photo API Endpoints (Server Side)** → **AGENT**

**🎯 Goal**: Build 5 endpoints so client can create/read/update/delete photos

**📍 Location**: Create new file `server/photo-routes.ts`

**⏱️ Estimated Time**: 1-2 hours

**💡 What Are We Building**:
- `GET /api/photos` → List all photos for logged-in user
- `GET /api/photos/:id` → Get one specific photo
- `POST /api/photos` → Create new photo
- `PUT /api/photos/:id` → Update photo (toggle favorite, add tags, etc.)
- `DELETE /api/photos/:id` → Delete photo

**🔧 What To Do**:

1. **Create file**: `server/photo-routes.ts`
2. **Add this comprehensive code**:

```typescript
// ═══════════════════════════════════════════════════════════
// PHOTO API ROUTES
// ═══════════════════════════════════════════════════════════
// RESTful API for photo CRUD operations
// All routes require authentication (user must be logged in)

import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "./db";
import { photos, insertPhotoSchema } from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticateToken } from "./auth";

// ─────────────────────────────────────────────────────────
// Create router instance
// ─────────────────────────────────────────────────────────
const router = Router();

// ─────────────────────────────────────────────────────────
// Require authentication for ALL routes in this file
// ─────────────────────────────────────────────────────────
// This middleware runs before every route below
// If user not logged in, returns 401 Unauthorized
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════
// GET /api/photos
// ═══════════════════════════════════════════════════════════
// Get all photos for logged-in user (with pagination)
//
// QUERY PARAMETERS (optional):
//   ?limit=100  → How many photos to return (default 100)
//   ?offset=0   → Skip first N photos (for pagination, default 0)
//
// RESPONSE:
//   {
//     photos: [...],
//     pagination: { limit: 100, offset: 0, total: 150 }
//   }

router.get("/", async (req: Request, res: Response) => {
  try {
    // Get logged-in user's ID (set by authenticateToken middleware)
    const userId = req.user!.id;
    
    // Parse pagination parameters from query string
    // parseInt() converts "100" string to 100 number
    // || provides default if not specified
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    
    // Query database using Drizzle ORM
    // .select() = get all columns
    // .from(photos) = from photos table
    // .where() = filter condition
    // .orderBy() = sort by date (newest first)
    // .limit() = max results
    // .offset() = skip first N
    const userPhotos = await db
      .select()
      .from(photos)
      .where(eq(photos.userId, userId))  // eq = equals
      .orderBy(desc(photos.createdAt))   // desc = descending (newest first)
      .limit(limit)
      .offset(offset);
    
    // Send JSON response
    res.json({
      photos: userPhotos,
      pagination: {
        limit,
        offset,
        total: userPhotos.length,
      },
    });
  } catch (error) {
    console.error("Error fetching photos:", error);
    res.status(500).json({ error: "Failed to fetch photos" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/photos/:id
// ═══════════════════════════════════════════════════════════
// Get a single photo by ID
//
// URL PARAMETERS:
//   :id  → Photo UUID (e.g., /api/photos/a3f2-b9c4-...)
//
// RESPONSE:
//   { photo: { id, uri, width, ... } }

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const photoId = req.params.id;  // Get ID from URL
    
    // Query for specific photo
    // and() = combine multiple conditions with AND logic
    // Returns array, we destructure first element with [photo]
    const [photo] = await db
      .select()
      .from(photos)
      .where(and(
        eq(photos.id, photoId),      // Match photo ID
        eq(photos.userId, userId)    // AND owned by this user
      ));
    
    // If no photo found, return 404
    if (!photo) {
      return res.status(404).json({ error: "Photo not found" });
    }
    
    res.json({ photo });
  } catch (error) {
    console.error("Error fetching photo:", error);
    res.status(500).json({ error: "Failed to fetch photo" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/photos
// ═══════════════════════════════════════════════════════════
// Create a new photo
//
// REQUEST BODY:
//   {
//     uri: "file:///path/to/photo.jpg",
//     width: 1920,
//     height: 1080,
//     filename: "vacation.jpg",
//     isFavorite: false,
//     tags: ["vacation", "beach"],
//     notes: "Beautiful sunset!"
//   }
//
// RESPONSE:
//   { photo: { id: "...", uri: "...", ... } }

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Validate input using Zod schema
    // This ensures all required fields present and correct types
    // Will throw ZodError if invalid
    const photoData = insertPhotoSchema.parse({
      ...req.body,
      userId,  // Force userId to logged-in user (security!)
    });
    
    // Insert into database
    // .returning() = return the created row (includes DB-generated ID)
    const [newPhoto] = await db
      .insert(photos)
      .values(photoData)
      .returning();
    
    // Return 201 Created status
    res.status(201).json({ photo: newPhoto });
    
  } catch (error) {
    // Check if it's a validation error
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,  // Array of specific field errors
      });
    }
    
    console.error("Error creating photo:", error);
    res.status(500).json({ error: "Failed to create photo" });
  }
});

// ═══════════════════════════════════════════════════════════
// PUT /api/photos/:id
// ═══════════════════════════════════════════════════════════
// Update a photo (e.g., toggle favorite, add tags, edit notes)
//
// REQUEST BODY (all fields optional, send only what you want to change):
//   {
//     isFavorite: true,
//     tags: ["vacation", "beach", "sunset"],
//     notes: "Updated caption"
//   }

router.put("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const photoId = req.params.id;
    
    // Validate updates (partial schema = all fields optional)
    const updates = insertPhotoSchema.partial().parse(req.body);
    
    // Update database
    const [updatedPhoto] = await db
      .update(photos)
      .set({
        ...updates,
        modifiedAt: new Date(),  // Always update timestamp
      })
      .where(and(
        eq(photos.id, photoId),
        eq(photos.userId, userId)  // Security: can only update own photos
      ))
      .returning();
    
    if (!updatedPhoto) {
      return res.status(404).json({ error: "Photo not found" });
    }
    
    res.json({ photo: updatedPhoto });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    
    console.error("Error updating photo:", error);
    res.status(500).json({ error: "Failed to update photo" });
  }
});

// ═══════════════════════════════════════════════════════════
// DELETE /api/photos/:id
// ═══════════════════════════════════════════════════════════
// Delete a photo permanently

router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const photoId = req.params.id;
    
    // Delete from database
    const [deletedPhoto] = await db
      .delete(photos)
      .where(and(
        eq(photos.id, photoId),
        eq(photos.userId, userId)  // Security: can only delete own photos
      ))
      .returning();
    
    if (!deletedPhoto) {
      return res.status(404).json({ error: "Photo not found" });
    }
    
    res.json({ message: "Photo deleted successfully" });
    
  } catch (error) {
    console.error("Error deleting photo:", error);
    res.status(500).json({ error: "Failed to delete photo" });
  }
});

// ─────────────────────────────────────────────────────────
// Export router for use in main server file
// ─────────────────────────────────────────────────────────
export default router;
```

3. **Save file** → **AGENT**

**✅ Success Check** → **TREVOR**:
- [ ] File compiles without errors
- [ ] All imports resolve correctly
- [ ] No TypeScript errors

---

### ✅ **SUBTASK 1.5: Register Photo Routes in Main Server** → **AGENT**

**🎯 Goal**: Tell Express server to use the photo routes we just created

**📍 Location**: `server/routes.ts`

**⏱️ Estimated Time**: 15 minutes

**🔧 What To Do**:

1. **Open `server/routes.ts`**

2. **Add import at top** (around line 5):

```typescript
import photoRoutes from "./photo-routes";
```

3. **Register routes** inside `registerRoutes` function (around line 20):

```typescript
// Photo routes (protected, requires authentication)
app.use("/api/photos", photoRoutes);
```

**Here's what the complete file should look like**:

```typescript
import type { Express } from "express";
import { createServer, type Server } from "node:http";
import authRoutes from "./auth-routes";
import uploadRoutes from "./upload-routes";
import photoRoutes from "./photo-routes";  // ← ADD THIS
import { authenticateToken, generalRateLimit } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication routes (login, register, etc.)
  app.use("/api/auth", authRoutes);
  
  // Upload routes (file uploads)
  app.use("/api/upload", uploadRoutes);
  
  // Photo routes (CRUD for photos)
  app.use("/api/photos", photoRoutes);  // ← ADD THIS
  
  // Example protected route (can keep or remove)
  app.get("/api/protected", authenticateToken, (req, res) => {
    res.json({
      message: "This is a protected route",
      user: req.user,
    });
  });
  
  // General API rate limiting
  app.use("/api", generalRateLimit);
  
  const httpServer = createServer(app);
  return httpServer;
}
```

4. **Save file**

5. **Test the server** → **TREVOR**:

```bash
npm run server:dev
```

**✅ Success Check** → **TREVOR**:
- [ ] Server starts without errors
- [ ] See "Server ready on port 5000" message
- [ ] Can access http://localhost:5000/api/photos (should return 401 if not logged in - that's correct!)

**🐛 Troubleshooting**:
- **Error: "Cannot find module './photo-routes'"** → Check file name is exactly `photo-routes.ts` in `server/` folder
- **Error: "Duplicate route"** → You may have added the line twice, remove duplicate
- **Server crashes on startup** → Check syntax errors in photo-routes.ts

---

**🎉 Checkpoint**: Server side is now complete! You can create/read/update/delete photos via API. Next, we connect the mobile app to use these endpoints.

---

### ✅ **SUBTASK 1.6: Update Client PhotosScreen to Use API** → **AGENT**

**🎯 Goal**: Change PhotosScreen from AsyncStorage to server API + React Query

**📍 Location**: `client/screens/PhotosScreen.tsx`

**⏱️ Estimated Time**: 1-2 hours

**💡 What We're Changing**:
- ❌ OLD: Manual `useState` + `useCallback` + AsyncStorage
- ✅ NEW: `useQuery` + `useMutation` + API calls

**🔧 What To Do**:

1. **Open `client/screens/PhotosScreen.tsx`**

2. **Replace the entire file with this**:

```typescript
// ═══════════════════════════════════════════════════════════
// PHOTOS SCREEN (Connected to Server)
// ═══════════════════════════════════════════════════════════
// Main screen showing user's photo library
// NOW USING: React Query for server state management

import React, { useCallback } from "react";
import { StyleSheet, View, Platform } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Photo } from "@/types";
import { groupPhotosByDate } from "@/lib/storage";  // Keep utility function
import { PhotoGrid } from "@/components/PhotoGrid";
import { FloatingActionButton } from "@/components/FloatingActionButton";
import { EmptyState } from "@/components/EmptyState";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { apiRequest } from "@/lib/query-client";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function PhotosScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  // ═══════════════════════════════════════════════════════════
  // FETCH PHOTOS (React Query)
  // ═══════════════════════════════════════════════════════════
  // useQuery automatically:
  //   • Fetches data when component mounts
  //   • Handles loading/error states
  //   • Caches results
  //   • Refetches when needed
  
  const { data: photos = [], isLoading, error } = useQuery<Photo[]>({
    queryKey: ['photos'],  // Unique key for this query
    queryFn: async () => {
      // Fetch from server API
      const res = await apiRequest('GET', '/api/photos');
      const data = await res.json();
      return data.photos;
    },
    // Optional: refetch when screen focused
    refetchOnWindowFocus: true,
  });

  // ═══════════════════════════════════════════════════════════
  // ADD PHOTO MUTATION (React Query)
  // ═══════════════════════════════════════════════════════════
  // useMutation for creating/updating/deleting data
  // Includes OPTIMISTIC UPDATE (show immediately, sync later)
  
  const addPhotoMutation = useMutation({
    // The actual API call
    mutationFn: async (photo: Omit<Photo, 'id' | 'createdAt' | 'modifiedAt'>) => {
      const res = await apiRequest('POST', '/api/photos', photo);
      return res.json();
    },
    
    // BEFORE sending to server (optimistic update)
    onMutate: async (newPhoto) => {
      // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
      await queryClient.cancelQueries({ queryKey: ['photos'] });
      
      // Save current state (for rollback if error)
      const previousPhotos = queryClient.getQueryData(['photos']);
      
      // Optimistically update UI (show photo immediately with temp ID)
      queryClient.setQueryData(['photos'], (old: Photo[] = []) => [
        {
          ...newPhoto,
          id: 'temp-' + Date.now(),  // Temporary ID until server responds
          createdAt: Date.now(),
          modifiedAt: Date.now(),
        } as Photo,
        ...old,
      ]);
      
      // Return context for rollback
      return { previousPhotos };
    },
    
    // If API call FAILS
    onError: (err, newPhoto, context) => {
      // Rollback to previous state
      if (context?.previousPhotos) {
        queryClient.setQueryData(['photos'], context.previousPhotos);
      }
      
      // Show error to user
      alert('Failed to upload photo. Please try again.');
    },
    
    // After API call completes (success OR failure)
    onSettled: () => {
      // Refetch from server to get accurate data
      // (Real IDs, server timestamps, etc.)
      queryClient.invalidateQueries({ queryKey: ['photos'] });
    },
  });

  // ═══════════════════════════════════════════════════════════
  // UPLOAD PHOTO HANDLER
  // ═══════════════════════════════════════════════════════════
  
  const handleUpload = async () => {
    // Haptic feedback (vibration on mobile)
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    // Open image picker (native photo library)
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,  // Can select multiple photos
      quality: 1,  // Highest quality
      exif: true,  // Include camera metadata
    });

    // If user cancelled, do nothing
    if (result.canceled) return;

    // Process each selected photo
    for (const asset of result.assets) {
      // Create photo object
      const newPhoto = {
        uri: asset.uri,
        width: asset.width || 0,
        height: asset.height || 0,
        filename: asset.fileName || `photo_${Date.now()}.jpg`,
        isFavorite: false,
        albumIds: [] as string[],
        // Optional fields can be added here (tags, notes, etc.)
      };
      
      // Send to server (with optimistic update)
      addPhotoMutation.mutate(newPhoto);
    }
    
    // Success haptic feedback
    if (Platform.OS !== "web" && result.assets.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  // ═══════════════════════════════════════════════════════════
  // PHOTO PRESS HANDLER (Navigate to detail screen)
  // ═══════════════════════════════════════════════════════════
  
  const handlePhotoPress = (photo: Photo, index: number) => {
    navigation.navigate("PhotoDetail", {
      photoId: photo.id,
      initialIndex: index,
    });
  };

  // Group photos by date for section headers
  const groupedData = groupPhotosByDate(photos);

  // ═══════════════════════════════════════════════════════════
  // RENDER UI
  // ═══════════════════════════════════════════════════════════
  
  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {/* LOADING STATE */}
      {isLoading ? (
        <View style={{ paddingTop: headerHeight + Spacing.xl }}>
          <SkeletonLoader type="photos" count={15} />
        </View>
      ) : (
        /* PHOTO GRID */
        <PhotoGrid
          photos={photos}
          groupedData={groupedData}
          onPhotoPress={handlePhotoPress}
          showSectionHeaders={true}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.fabSize + Spacing["3xl"],
            paddingHorizontal: Spacing.lg,
          }}
          scrollIndicatorInsets={{ bottom: insets.bottom }}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <EmptyState
                image={require("../../assets/images/empty-photos.png")}
                title="No photos yet"
                subtitle="Tap the + button to upload your first photo"
              />
            </View>
          }
        />
      )}
      
      {/* FLOATING ACTION BUTTON (+ button) */}
      <FloatingActionButton onPress={handleUpload} icon="plus" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    minHeight: 400,
    alignItems: "center",
    justifyContent: "center",
  },
});
```

3. **Save file** → **AGENT**

**✅ Success Check** → **TREVOR**:
- [ ] File compiles without errors
- [ ] Screen loads and shows photos
- [ ] Upload button works
- [ ] Photos appear immediately (optimistic update)
- [ ] Photos persist after app restart

**🐛 Troubleshooting**:
- **Error: "Cannot read property 'id' of undefined"** → Check apiRequest returns correct data format
- **Photos don't appear** → Check server is running, check network requests in DevTools
- **Upload fails silently** → Check mutation error callback, look at server logs

---

---

### ✅ **SUBTASK 1.7: Create Album Routes (Server Side)** → **AGENT**

**🎯 Goal**: Build CRUD endpoints for albums (following same pattern as photos)

**📍 Location**: Create new file `server/album-routes.ts`

**⏱️ Estimated Time**: 1 hour

**💡 What We're Building**:
- `GET /api/albums` → List all albums for user
- `GET /api/albums/:id` → Get one album with photos
- `POST /api/albums` → Create new album
- `PUT /api/albums/:id` → Update album (title, description)
- `DELETE /api/albums/:id` → Delete album
- `POST /api/albums/:id/photos` → Add photo to album
- `DELETE /api/albums/:id/photos/:photoId` → Remove photo from album

**🔧 What To Do**:

1. **Create file**: `server/album-routes.ts`
2. **Add this code**:

```typescript
// ═══════════════════════════════════════════════════════════
// ALBUM API ROUTES
// ═══════════════════════════════════════════════════════════

import { Router, Request, Response } from "express";
import { z } from "zod";
import { db } from "./db";
import { albums, albumPhotos, insertAlbumSchema } from "../shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { authenticateToken } from "./auth";

const router = Router();
router.use(authenticateToken);

// ═══════════════════════════════════════════════════════════
// GET /api/albums - List all albums
// ═══════════════════════════════════════════════════════════

router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const userAlbums = await db
      .select()
      .from(albums)
      .where(eq(albums.userId, userId))
      .orderBy(desc(albums.createdAt));
    
    res.json({ albums: userAlbums });
  } catch (error) {
    console.error("Error fetching albums:", error);
    res.status(500).json({ error: "Failed to fetch albums" });
  }
});

// ═══════════════════════════════════════════════════════════
// GET /api/albums/:id - Get album with photos
// ═══════════════════════════════════════════════════════════

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const albumId = req.params.id;
    
    const [album] = await db
      .select()
      .from(albums)
      .where(and(
        eq(albums.id, albumId),
        eq(albums.userId, userId)
      ));
    
    if (!album) {
      return res.status(404).json({ error: "Album not found" });
    }
    
    // Get photos in this album
    const albumPhotosList = await db
      .select()
      .from(albumPhotos)
      .where(eq(albumPhotos.albumId, albumId))
      .orderBy(albumPhotos.position);
    
    res.json({ album, photoIds: albumPhotosList.map(ap => ap.photoId) });
  } catch (error) {
    console.error("Error fetching album:", error);
    res.status(500).json({ error: "Failed to fetch album" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/albums - Create album
// ═══════════════════════════════════════════════════════════

router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    const albumData = insertAlbumSchema.parse({
      ...req.body,
      userId,
    });
    
    const [newAlbum] = await db
      .insert(albums)
      .values(albumData)
      .returning();
    
    res.status(201).json({ album: newAlbum });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation error",
        details: error.errors,
      });
    }
    console.error("Error creating album:", error);
    res.status(500).json({ error: "Failed to create album" });
  }
});

// ═══════════════════════════════════════════════════════════
// POST /api/albums/:id/photos - Add photo to album
// ═══════════════════════════════════════════════════════════

router.post("/:id/photos", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const albumId = req.params.id;
    const { photoId } = req.body;
    
    // Verify album belongs to user
    const [album] = await db
      .select()
      .from(albums)
      .where(and(
        eq(albums.id, albumId),
        eq(albums.userId, userId)
      ));
    
    if (!album) {
      return res.status(404).json({ error: "Album not found" });
    }
    
    // Add photo to album
    await db.insert(albumPhotos).values({
      albumId,
      photoId,
    });
    
    res.json({ message: "Photo added to album" });
  } catch (error) {
    console.error("Error adding photo to album:", error);
    res.status(500).json({ error: "Failed to add photo to album" });
  }
});

// PUT, DELETE routes follow same pattern...

export default router;
```

3. **Register routes** in `server/routes.ts`:
```typescript
import albumRoutes from "./album-routes";
app.use("/api/albums", albumRoutes);
```

**⚠️ COMMON PITFALLS:**
1. **Forgot to import albumPhotos** → Error: "albumPhotos is not defined"
   - Fix: Add to imports from shared/schema
2. **Wrong junction table query** → Photos don't show in album
   - Fix: Check you're querying albumPhotos table correctly
3. **Not checking album ownership** → Security issue
   - Fix: Always verify `eq(albums.userId, userId)` before operations

**✅ Success Check** → **TREVOR**:
- [ ] File compiles without errors
- [ ] Routes registered in server/routes.ts
- [ ] Can create album via API: `POST /api/albums`
- [ ] Can list albums: `GET /api/albums`
- [ ] Can add photo to album: `POST /api/albums/:id/photos`

---

### ✅ **SUBTASK 1.8: Update AlbumsScreen (Client)** → **AGENT**

**🎯 Goal**: Connect AlbumsScreen to server API using React Query

**📍 Location**: `client/screens/AlbumsScreen.tsx`

**⏱️ Estimated Time**: 1 hour

**🔧 What To Do**:

Follow the same pattern as PhotosScreen (SUBTASK 1.6), but for albums:

1. **Import React Query hooks**:
```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
```

2. **Replace AsyncStorage with useQuery**:
```typescript
const { data: albums = [], isLoading } = useQuery({
  queryKey: ['albums'],
  queryFn: async () => {
    const res = await apiRequest('GET', '/api/albums');
    const data = await res.json();
    return data.albums;
  },
});
```

3. **Add mutation for creating albums**:
```typescript
const createAlbumMutation = useMutation({
  mutationFn: async (album: { title: string; description?: string }) => {
    const res = await apiRequest('POST', '/api/albums', album);
    return res.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['albums'] });
  },
});
```

**⚠️ COMMON PITFALLS:**
1. **Forgot to invalidate albums query** → New albums don't appear
   - Fix: Add `queryClient.invalidateQueries({ queryKey: ['albums'] })` after mutations
2. **Not handling empty state** → Blank screen when no albums
   - Fix: Use `ListEmptyComponent` prop in FlatList

**✅ Success Check** → **TREVOR**:
- [ ] Screen compiles and loads
- [ ] Shows loading skeleton initially
- [ ] Displays albums from server
- [ ] Can create new album
- [ ] Albums persist after refresh

---

### ✅ **SUBTASK 1.9: End-to-End Testing** → **TREVOR**

**🎯 Goal**: Verify complete client-server integration works end-to-end

**⏱️ Estimated Time**: 1-2 hours

**📋 Complete Testing Checklist**:

#### Server Health
- [ ] Server starts without errors: `npm run server:dev`
- [ ] Database tables exist: `psql cloudgallery -c "\dt"`
- [ ] Can query tables: `SELECT COUNT(*) FROM photos;`

#### Authentication Flow
- [ ] Can register new user
- [ ] Can login and receive JWT token
- [ ] Token stored in AsyncStorage
- [ ] Logout clears token

#### Photo Management
- [ ] Upload photo from mobile device
- [ ] Photo appears immediately (optimistic update)
- [ ] Photo persists in database (check with `SELECT * FROM photos;`)
- [ ] Photo syncs to second device
- [ ] Can favorite/unfavorite photo
- [ ] Can delete photo
- [ ] Deletion syncs across devices

#### Album Management
- [ ] Create new album
- [ ] Album appears in list
- [ ] Can navigate into album
- [ ] Add photos to album
- [ ] Photos appear in album grid
- [ ] Remove photo from album
- [ ] Delete album
- [ ] Album deletion syncs across devices

#### Error Handling
- [ ] Server offline → Shows error message
- [ ] Invalid token → Redirects to login
- [ ] Network timeout → Shows retry option
- [ ] Duplicate upload → Prevented or handled

#### Performance
- [ ] App responds quickly (<1s)
- [ ] Scrolling smooth with 50+ photos
- [ ] No memory leaks (test with React DevTools Profiler)

#### Cross-Device Sync
- [ ] Upload on device A → appears on device B
- [ ] Delete on device B → disappears on device A
- [ ] Create album on web → appears on mobile

**🐛 If Tests Fail**:
1. Check server logs: `npm run server:dev`
2. Check client console: Press `j` in Expo terminal
3. Check database: `psql cloudgallery`
4. Verify API requests in Network tab
5. Review error messages carefully

**✅ When All Tests Pass** → **TASK 1 COMPLETE!**

---

## ✅ **TASK 1 COMPLETE! WHAT YOU'VE ACHIEVED:**

✅ **Client and server now communicate** (no longer isolated)  
✅ **Photos save to PostgreSQL cloud database** (not just local phone)  
✅ **Photos sync across devices** (any device with login sees them)  
✅ **Real-time UI updates** (React Query's optimistic updates)  
✅ **Type-safe API** (TypeScript + Zod validation)  
✅ **Foundation for all future cloud features** (albums, sharing, sync, etc.)

**🎉 Impact**: You can now access your photos from ANY device! The hardest part is done.

**➡️ Next**: Task 2 (Make data storage robust with validation and proper IDs)

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

# 🔴 **TASK 2: Fix Data Storage Layer**

### 🎓 What This Means

**Current Problem**: The `client/lib/storage.ts` file has fragile data handling:
- No validation = corrupt data can be saved
- Bad ID generation = collisions possible (two photos with same ID)
- No transactions = if something fails mid-save, data becomes inconsistent
- Silent errors = problems hidden, hard to debug

**The Fix**: Add validation, proper UUIDs, transaction-like behavior, explicit error handling

### 🎯 Why Critical

**Scenario Without Fixes**:
1. User deletes photo
2. Photo deleted from photos list ✅
3. App crashes before updating albums list ❌
4. Result: Albums still reference deleted photo (broken app state)

**With Fixes**:
1. Validate all data before any changes
2. Make changes atomically (all succeed or all fail)
3. Use UUIDs (no collision risk)
4. Clear error messages when something goes wrong

### 📂 Files You'll Modify

```
client/
  └── lib/
      ├── storage.ts          [MAJOR REFACTOR] Add validation, UUIDs, transactions
      └── storage-schemas.ts  [CREATE] Zod validation schemas
```

---

### ✅ **SUBTASK 2.1: Create Validation Schemas** → **AGENT**

**🎯 Goal**: Define exact shape of data using Zod

**📍 Location**: Create new file `client/lib/storage-schemas.ts`

**⏱️ Estimated Time**: 45 minutes

```typescript
// ═══════════════════════════════════════════════════════════
// STORAGE DATA VALIDATION SCHEMAS
// ═══════════════════════════════════════════════════════════
// Zod schemas ensure data correctness before saving
// Validates: types, required fields, formats

import { z } from 'zod';

// ─────────────────────────────────────────────────────────
// PHOTO SCHEMA
// ─────────────────────────────────────────────────────────

export const photoSchema = z.object({
  // UUID format validation
  id: z.string().uuid('Photo ID must be a valid UUID'),
  
  // URI validation
  uri: z.string().min(1, 'Photo URI cannot be empty'),
  
  // Dimensions must be positive integers
  width: z.number().int().positive('Width must be positive'),
  height: z.number().int().positive('Height must be positive'),
  
  // Timestamps must be valid
  createdAt: z.number().int('createdAt must be Unix timestamp'),
  modifiedAt: z.number().int('modifiedAt must be Unix timestamp'),
  
  // Filename required
  filename: z.string().min(1, 'Filename cannot be empty'),
  
  // Boolean flags
  isFavorite: z.boolean(),
  
  // Array of album IDs (each must be UUID)
  albumIds: z.array(z.string().uuid()).default([]),
  
  // Optional fields
  location: z.object({
    latitude: z.number(),
    longitude: z.number(),
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  
  camera: z.object({
    make: z.string(),
    model: z.string(),
    iso: z.number().optional(),
    aperture: z.string().optional(),
    shutter: z.string().optional(),
    focalLength: z.number().optional(),
  }).optional(),
  
  exif: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  isPrivate: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────
// ALBUM SCHEMA
// ─────────────────────────────────────────────────────────

export const albumSchema = z.object({
  id: z.string().uuid('Album ID must be a valid UUID'),
  title: z.string().min(1, 'Album title cannot be empty'),
  coverPhotoUri: z.string().nullable(),
  photoIds: z.array(z.string().uuid()).default([]),
  createdAt: z.number().int(),
  modifiedAt: z.number().int(),
});

// ─────────────────────────────────────────────────────────
// EXPORT TYPES
// ─────────────────────────────────────────────────────────
// TypeScript types inferred from schemas

export type ValidatedPhoto = z.infer<typeof photoSchema>;
export type ValidatedAlbum = z.infer<typeof albumSchema>;

// ─────────────────────────────────────────────────────────
// VALIDATION HELPERS
// ─────────────────────────────────────────────────────────

export function validatePhoto(photo: unknown): ValidatedPhoto {
  return photoSchema.parse(photo);
}

export function validatePhotoArray(photos: unknown): ValidatedPhoto[] {
  return z.array(photoSchema).parse(photos);
}

export function validateAlbum(album: unknown): ValidatedAlbum {
  return albumSchema.parse(album);
}

export function validateAlbumArray(albums: unknown): ValidatedAlbum[] {
  return z.array(albumSchema).parse(albums);
}
```

---

### ✅ **SUBTASK 2.2: Install UUID Generator** → **AGENT**

**🎯 Goal**: Add library for generating proper UUIDs

**⏱️ Estimated Time**: 5 minutes

```bash
npm install expo-crypto
```

**Why**: `expo-crypto` provides `randomUUID()` function that generates RFC-4122 compliant UUIDs (industry standard)

---

### ✅ **SUBTASK 2.3: Refactor storage.ts with Validation** → **AGENT**

**📍 Location**: `client/lib/storage.ts`

**⏱️ Estimated Time**: 1-2 hours

**🔧 Changes needed:**
1. Import validation schemas
2. Replace `Date.now() + Math.random()` with `randomUUID()`
3. Validate all data before saving
4. Add explicit error handling
5. Add data integrity checks on load

**Code example for key functions**:

```typescript
import { randomUUID } from 'expo-crypto';
import { validatePhoto, validatePhotoArray, photoSchema } from './storage-schemas';

export async function addPhoto(photo: Omit<Photo, 'id' | 'createdAt' | 'modifiedAt'>): Promise<Photo> {
  try {
    // Create complete photo object with proper UUID
    const newPhoto: Photo = {
      id: randomUUID(),  // ✅ Proper UUID instead of Date.now()
      ...photo,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
      albumIds: photo.albumIds || [],
    };
    
    // Validate before saving
    const validated = validatePhoto(newPhoto);
    
    // Load existing photos
    const photos = await getPhotos();
    
    // Add to beginning
    photos.unshift(validated);
    
    // Save (with validation)
    await savePhotos(photos);
    
    return validated;
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Invalid photo data: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw new Error(`Failed to add photo: ${error.message}`);
  }
}

export async function getPhotos(): Promise<Photo[]> {
  try {
    const data = await AsyncStorage.getItem(PHOTOS_KEY);
    if (!data) return [];
    
    const parsed = JSON.parse(data);
    
    // Validate ALL photos on load (data integrity check)
    return validatePhotoArray(parsed);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Corrupt photo data detected:', error.errors);
      // Could backup corrupt data and reset
      return [];
    }
    console.error('Failed to load photos:', error);
    return [];
  }
}
```

**📝 Full refactor too long for this doc - use AI with prompt**:
> "Refactor client/lib/storage.ts to use validation schemas from storage-schemas.ts, replace all ID generation with randomUUID() from expo-crypto, and add explicit error handling for every function"

---

## ✅ **TASK 2 COMPLETE! ACHIEVEMENTS:**

✅ **Data validation** (corrupt data caught before saving)  
✅ **Proper UUIDs** (no collision risk, RFC-4122 compliant)  
✅ **Explicit error handling** (know what went wrong)  
✅ **Data integrity checks** (corrupt data detected on load)  
✅ **Type safety** (Zod + TypeScript catch bugs early)

**➡️ Next**: Task 3 (Environment variables), Task 4 (Type safety), etc.

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

# 📚 **REMAINING TASKS** (Brief Overview)

**Due to size limits, I'm providing the structure. Use AI with prompts like:**  
*"Complete Task 3 following the detailed pattern shown in Task 1 and Task 2"*

## 🔴 **TASK 3: Environment Variables** → **AGENT** (creation) + **TREVOR** (testing)

- Create `.env.example` → **AGENT**
- Create `shared/env.ts` with Zod validation → **AGENT**
- Add startup validation → **AGENT**
- Document all variables in README → **AGENT**
- Test all env scenarios → **TREVOR**

## 🔴 **TASK 4: Type Safety Improvements** → **AGENT**

- Remove all `as any` casts (search codebase) → **AGENT**
- Add explicit return types to functions → **AGENT**
- Create type guards (e.g., `isJWTPayload`) → **AGENT**
- Extend Express Request type properly → **AGENT**
- Verify no type errors remain → **TREVOR**

## 🔴 **TASK 5: Responsive Layouts** → **AGENT** (code) + **TREVOR** (testing)

- Replace static `Dimensions.get()` with `useWindowDimensions()` hook → **AGENT**
- Make columns responsive based on screen width → **AGENT**
- Test on phone, tablet, web → **TREVOR**

## 🟡 **TASK 6: Logger Service** → **AGENT**

- Create `client/lib/logger.ts` → **AGENT**
- Replace all `console.log` calls → **AGENT**
- Add environment-aware logging → **AGENT**
- Integrate with error tracking (Sentry) → **AGENT**
- Verify logging works in dev/prod → **TREVOR**

## 🟡 **TASK 7: Centralized Error Handling** → **AGENT** (code) + **TREVOR** (testing)

- Create `ErrorBoundary` for each major screen → **AGENT**
- Create global error handler → **AGENT**
- Show user-friendly error messages → **AGENT**
- Add retry mechanisms → **AGENT**
- Test error scenarios → **TREVOR**

## 🟡 **TASK 8: Performance (Pagination)** → **AGENT** (code) + **TREVOR** (testing)

- Add pagination to photo queries → **AGENT**
- Implement infinite scroll → **AGENT**
- Add loading indicators → **AGENT**
- Test with 1000+ photos → **TREVOR**

## 🟡 **TASK 9: Service/Repository Layers** → **AGENT**

- Create `client/services/` folder → **AGENT**
- Create `client/repositories/` folder → **AGENT**
- Move business logic to services → **AGENT**
- Abstract data access to repositories → **AGENT**
- Verify architecture separation → **TREVOR**

## 🟡 **TASK 10: Offline/Online Management** → **AGENT** (code) + **TREVOR** (testing)

- Install `@react-native-community/netinfo` → **AGENT**
- Detect online/offline status → **AGENT**
- Show sync status in UI → **AGENT**
- Queue mutations when offline → **AGENT**
- Test offline scenarios → **TREVOR**

## 🟡 **TASK 11: React Query Integration** → **AGENT**

- Convert all remaining screens to use `useQuery` → **AGENT**
- Convert all data changes to `useMutation` → **AGENT**
- Add optimistic updates everywhere → **AGENT**
- Implement proper cache invalidation → **AGENT**
- Verify all screens work with React Query → **TREVOR**

---

# � **QUALITY & POLISH TASKS** (From DIAMOND Standards Analysis)

**📊 Source**: Based on comprehensive code quality analysis in DIAMOND.md  
**🎯 Purpose**: Address gaps preventing "A+" rating, improve professional polish  
**⏱️ Timeline**: Week 5-8 (after foundation complete)

---

## 🔴 **TASK 12: Create README.md** → **AGENT**

**Severity**: 🔴 HIGH  
**DIAMOND Score Impact**: +15 points (70% → 85%)  
**Why Critical**: Repository has no front door - GitHub page looks unprofessional

### 🎓 What This Means

**Current Problem**: 
- No README.md in repository root
- New developers have no entry point
- GitHub repository page shows no description
- Installation instructions buried in AGENTS.md (not visible)

**The Fix**: Create comprehensive README.md following GitHub best practices

### 📂 File To Create

```
c:\dev\Cloud-Gallery\README.md  [CREATE]
```

### 🔧 What To Do

**⏱️ Estimated Time**: 1 hour

1. **Create file**: `c:\dev\Cloud-Gallery\README.md`
2. **Add comprehensive content**:

```markdown
# ☁️ Cloud Gallery

> Premium photo management app with cloud sync, built with React Native + Expo

[![Test Coverage](https://github.com/yourusername/cloud-gallery/workflows/Test%20Coverage/badge.svg)](https://github.com/yourusername/cloud-gallery/actions)
[![Security Scan](https://github.com/yourusername/cloud-gallery/workflows/Security%20Scan/badge.svg)](https://github.com/yourusername/cloud-gallery/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

![Cloud Gallery Screenshot](assets/images/screenshot.png)

## ✨ Features

- 📱 **Cross-Platform**: iOS, Android, and Web from one codebase
- ☁️ **Cloud Sync**: Automatic backup and multi-device sync
- 🎨 **Smart Albums**: Organize photos with intelligent collections
- 🔒 **Privacy-First**: End-to-end encryption, local-first architecture
- 🎭 **Dark Mode**: Beautiful light and dark themes
- 🏃 **High Performance**: FlashList optimization for 10,000+ photos
- 🔍 **Advanced Search**: Find photos by date, location, tags, or AI analysis
- 🌐 **Offline-First**: Full functionality without internet connection

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- PostgreSQL 15+ ([Download](https://www.postgresql.org/download/))
- Expo CLI: `npm install -g expo-cli`

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/cloud-gallery.git
cd cloud-gallery

# Install dependencies
npm install

# Create database
createdb cloudgallery

# Set up environment variables
cp .env.example .env
# Edit .env and set your DATABASE_URL

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Development Commands

```bash
npm start              # Start Expo dev server (mobile)
npm run server:dev     # Start backend API server
npm run dev            # Start both client + server
npm test               # Run all tests
npm run check:types    # TypeScript type checking
npm run lint           # ESLint code linting
npm run db:studio      # Open database GUI
```

## 🏗️ Tech Stack

### Frontend
- **React Native** 0.81.5 - Cross-platform mobile framework
- **Expo** 54.0.23 - Development platform
- **TypeScript** 5.9.2 - Type-safe JavaScript
- **React Query** 5.90.7 - Server state management
- **React Navigation** 7.0+ - App navigation
- **FlashList** - High-performance lists (10x faster than FlatList)

### Backend
- **Node.js** - JavaScript runtime
- **Express** 5.0.1 - Web server framework
- **PostgreSQL** - Relational database
- **Drizzle ORM** 0.39.3 - Type-safe database queries
- **Argon2id** - Password hashing (PHC winner)
- **JWT** - Authentication tokens

### Development Tools
- **Vitest** 3.0.5 - Modern test runner
- **ESLint** 9.25.0 - Code linting
- **Prettier** 3.6.2 - Code formatting
- **GitHub Actions** - CI/CD automation

## 📁 Project Structure

```
cloud-gallery/
├── client/           # React Native mobile app
│   ├── screens/      # Full-page views
│   ├── components/   # Reusable UI components
│   ├── navigation/   # React Navigation setup
│   ├── lib/          # Utilities and services
│   └── hooks/        # Custom React hooks
├── server/           # Express backend API
│   ├── auth-routes.ts     # Authentication endpoints
│   ├── photo-routes.ts    # Photo CRUD endpoints
│   └── security.ts        # Security utilities
├── shared/           # Code shared between client & server
│   └── schema.ts     # Database schemas (Drizzle ORM)
├── docs/             # Documentation
│   ├── architecture/ # System architecture docs
│   ├── api/          # API documentation
│   └── adr/          # Architecture Decision Records
└── tests/            # Test utilities
```

## 📖 Documentation

- **[Architecture Overview](docs/architecture/10_OVERVIEW.md)** - System design and key decisions
- **[API Documentation](docs/api/00_INDEX.md)** - Backend API reference
- **[AI Agent Guide](AGENTS.md)** - Complete guide for AI-assisted development (2000+ lines)
- **[Quality Standards](DIAMOND.md)** - Code quality analysis and standards
- **[Design Guidelines](docs/design_guidelines.md)** - UI/UX design principles

## 🧪 Testing

```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# UI test runner
npm run test:ui
```

**Current Test Coverage**:
- Unit Tests: ✅ 92%
- Integration Tests: ✅ 88%
- Server Tests: ✅ 95%
- Goal: 100% (ambitious!)

## 🔒 Security

Security is a first-class concern in Cloud Gallery:

- ✅ **Argon2id Password Hashing** - Memory-hard, GPU-resistant (PHC winner)
- ✅ **Password Breach Checking** - HaveIBeenPwned API integration
- ✅ **Adaptive CAPTCHA** - Triggered after repeated failures
- ✅ **Rate Limiting** - Brute force protection (5 attempts/15min)
- ✅ **Security Headers** - CSP, HSTS, X-Frame-Options, etc.
- ✅ **Audit Logging** - Comprehensive security event tracking
- ✅ **Supply Chain Security** - SBOM generation, license compliance
- ✅ **Automated Scanning** - Weekly dependency + secret scanning

See [Security Documentation](docs/security/README.md) for details.

## 🤝 Contributing

We welcome contributions! Please read [CONTRIBUTING.md](CONTRIBUTING.md) first.

**Development Workflow**:
1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Make changes with tests
4. Run `npm test && npm run lint && npm run check:types`
5. Commit using conventional commits (`feat:`, `fix:`, `docs:`, etc.)
6. Push to branch
7. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Expo Team** - Excellent developer experience
- **Drizzle ORM** - Type-safe database queries
- **TanStack Query** - Best-in-class server state management
- **React Navigation** - Robust navigation solution

## 📧 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/cloud-gallery/issues)
- **Discussions**: [Ask questions or share ideas](https://github.com/yourusername/cloud-gallery/discussions)
- **Documentation**: [Read the docs](docs/)

---

**Built with ❤️ by Trevor and AI Assistants**
```

3. **Add screenshot** (optional but recommended):
   - Take screenshot of app
   - Save as `assets/images/screenshot.png`

4. **Save file**

### ✅ Success Criteria

- [ ] README.md exists in repository root
- [ ] File is properly formatted (Markdown)
- [ ] All sections present (Features, Quick Start, Tech Stack, etc.)
- [ ] Installation instructions are complete
- [ ] Links work (internal and external)
- [ ] GitHub repository page now shows professional description

### 🐛 Troubleshooting

**Problem**: "Links to docs don't work"  
**Fix**: Verify files exist at paths specified in links

**Problem**: "Badges show 'unknown'"  
**Fix**: Update GitHub Actions workflow names to match badges

---

## 🔴 **TASK 13: Deploy Error Boundaries** → **AGENT**

**Severity**: 🟡 MEDIUM  
**DIAMOND Finding**: Components exist but not implemented in app  
**Why Important**: React errors crash entire app instead of showing friendly error screen

### 🎓 What This Means

**Current State**:
```typescript
// ✅ ErrorBoundary component exists
client/components/ErrorBoundary.tsx
client/components/ErrorFallback.tsx

// ❌ But not used in screens
client/screens/PhotosScreen.tsx  // No wrapper
client/screens/AlbumsScreen.tsx  // No wrapper
```

**Impact**: If any component throws error, entire app crashes (white screen)

**The Fix**: Wrap each major screen in `<ErrorBoundary>` component

### 📂 Files To Modify

```
client/screens/PhotosScreen.tsx    [EDIT]
client/screens/AlbumsScreen.tsx    [EDIT]
client/screens/PhotoDetailScreen.tsx [EDIT]
client/screens/AlbumDetailScreen.tsx [EDIT]
client/screens/SearchScreen.tsx    [EDIT]
client/screens/ProfileScreen.tsx   [EDIT]
```

### 🔧 What To Do

**⏱️ Estimated Time**: 1-2 hours

#### STEP 1: Verify ErrorBoundary exists

Check that these files are present:
```bash
# Should exist:
client/components/ErrorBoundary.tsx
client/components/ErrorFallback.tsx
```

#### STEP 2: Import ErrorBoundary in each screen

**Example for PhotosScreen.tsx**:

```typescript
// Add import at top of file
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function PhotosScreen() {
  // ... existing code
  
  return (
    <ErrorBoundary>
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        {/* ... existing JSX ... */}
      </View>
    </ErrorBoundary>
  );
}
```

#### STEP 3: Apply to all screens

Wrap each screen's return statement:

**AlbumsScreen.tsx**:
```typescript
return (
  <ErrorBoundary>
    {/* existing JSX */}
  </ErrorBoundary>
);
```

**PhotoDetailScreen.tsx**:
```typescript
return (
  <ErrorBoundary>
    {/* existing JSX */}
  </ErrorBoundary>
);
```

**Repeat for**:
- AlbumDetailScreen.tsx
- SearchScreen.tsx
- ProfileScreen.tsx

#### STEP 4: Test error boundaries

Create intentional error to verify:

```typescript
// Temporary test code
const TestError = () => {
  throw new Error("Test error boundary");
};

return (
  <ErrorBoundary>
    <TestError />  {/* Should show error fallback, not crash */}
  </ErrorBoundary>
);
```

### ✅ Success Criteria

- [ ] All 6 screens wrapped in `<ErrorBoundary>`
- [ ] Test error shows ErrorFallback component (not white screen)
- [ ] Error boundary catches render errors
- [ ] Other screens still work when one errors

---

## 🟡 **TASK 14: Accessibility Audit & Fixes** → **AGENT** (fixes) + **TREVOR** (testing)

**Severity**: 🟡 MEDIUM  
**DIAMOND Score**: Current 6/10, Goal 9/10  
**Why Important**: Accessibility is legal requirement in many jurisdictions, ethically important

### 🎓 What This Means

**Current State**: Basic accessibility support (dark mode, touch targets) but missing:
- No `accessibilityLabel` props
- No screen reader testing
- No keyboard navigation (web)
- No focus management

### 📂 Files To Modify

```
client/components/FloatingActionButton.tsx  [EDIT]
client/components/PhotoGrid.tsx             [EDIT]
client/components/AlbumCard.tsx             [EDIT]
All screens with interactive elements       [EDIT]
```

### 🔧 What To Do

**⏱️ Estimated Time**: 4-6 hours

#### STEP 1: Add accessibility labels to buttons

```typescript
// FloatingActionButton.tsx
<Pressable
  style={styles.fab}
  onPress={onPress}
  accessibilityLabel="Upload photos"         // ← ADD THIS
  accessibilityHint="Opens photo picker to add new photos"  // ← ADD THIS
  accessibilityRole="button"                 // ← ADD THIS
>
  <Icon name="plus" size={24} color="white" />
</Pressable>
```

#### STEP 2: Add labels to images

```typescript
// PhotoGrid.tsx
<Image
  source={{ uri: photo.uri }}
  accessibilityLabel={`Photo: ${photo.filename}`}  // ← ADD THIS
  accessibilityRole="image"                        // ← ADD THIS
/>
```

#### STEP 3: Group related content

```typescript
// AlbumCard.tsx
<View
  accessible={true}                              // ← ADD THIS
  accessibilityLabel={`Album: ${album.title}`}  // ← ADD THIS
  accessibilityHint="Double tap to open album"  // ← ADD THIS
>
  <Image source={{ uri: album.coverPhotoUri }} />
  <Text>{album.title}</Text>
</View>
```

#### STEP 4: Test with screen readers

**iOS (VoiceOver)**:
1. Settings → Accessibility → VoiceOver → On
2. Navigate app with swipe gestures
3. Verify all elements are announced correctly

**Android (TalkBack)**:
1. Settings → Accessibility → TalkBack → On
2. Navigate app
3. Verify announcements

#### STEP 5: Add keyboard navigation (web)

```typescript
// For web version
<Pressable
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onPress();
    }
  }}
  tabIndex={0}  // ← Makes keyboard focusable
>
```

### ✅ Success Criteria

- [ ] All interactive elements have `accessibilityLabel`
- [ ] Images have descriptive labels
- [ ] Screen reader announces all content correctly
- [ ] Keyboard navigation works on web
- [ ] Focus indicators visible
- [ ] Touch targets minimum 44x44 pt

### 📚 Resources

- [React Native Accessibility](https://reactnative.dev/docs/accessibility)
- [Expo Accessibility](https://docs.expo.dev/guides/accessibility/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)

---

## 🟢 **TASK 15: API Documentation (OpenAPI/Swagger)** → **AGENT**

**Severity**: 🟢 LOW  
**DIAMOND Finding**: No machine-readable API spec  
**Why Helpful**: Interactive API documentation, automatic client generation

### 🎓 What This Means

**Current State**: API routes exist in code but no formal documentation

**Benefits of OpenAPI/Swagger**:
- Interactive API explorer (try endpoints in browser)
- Auto-generated client SDKs
- Contract-first development
- API versioning support

### 📂 Files To Create/Modify

```
server/swagger.ts           [CREATE]  # OpenAPI configuration
server/index.ts             [EDIT]    # Register Swagger UI
package.json                [EDIT]    # Add dependencies
```

### 🔧 What To Do

**⏱️ Estimated Time**: 2-3 hours

#### STEP 1: Install dependencies

```bash
npm install swagger-jsdoc swagger-ui-express
npm install --save-dev @types/swagger-jsdoc @types/swagger-ui-express
```

#### STEP 2: Create Swagger configuration

**File**: `server/swagger.ts`

```typescript
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cloud Gallery API',
      version: '1.0.0',
      description: 'Photo management and cloud sync API',
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
      contact: {
        name: 'API Support',
        email: 'support@cloudgallery.app',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Development server',
      },
      {
        url: 'https://api.cloudgallery.app',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./server/*-routes.ts'], // Files containing annotations
};

export const swaggerSpec = swaggerJsdoc(options);
```

#### STEP 3: Add JSDoc annotations to routes

**Example**: `server/auth-routes.ts`

```typescript
/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - username
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 8
 *               username:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid input
 *       409:
 *         description: User already exists
 */
router.post("/register", async (req, res) => {
  // ... existing code
});
```

#### STEP 4: Register Swagger UI in server

**File**: `server/index.ts`

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';

// ... existing code

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// JSON spec endpoint
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});
```

#### STEP 5: Document all routes

Add JSDoc annotations for:
- GET /api/photos
- POST /api/photos
- PUT /api/photos/:id
- DELETE /api/photos/:id
- GET /api/albums
- POST /api/albums
- (etc.)

### ✅ Success Criteria

- [ ] Swagger UI accessible at http://localhost:5000/api-docs
- [ ] All endpoints documented
- [ ] Can test endpoints directly in browser
- [ ] JSON spec downloadable at /api-docs.json
- [ ] Request/response examples present

### 📸 Example Result

After completion, visiting http://localhost:5000/api-docs will show:

```
Cloud Gallery API v1.0.0

Authentication
  POST /api/auth/register      Register new user
  POST /api/auth/login         Login
  POST /api/auth/refresh       Refresh token

Photos
  GET    /api/photos            List photos
  POST   /api/photos            Upload photo
  GET    /api/photos/:id        Get photo details
  PUT    /api/photos/:id        Update photo
  DELETE /api/photos/:id        Delete photo
```

---

## 🟢 **TASK 16: E2E Tests (Detox)** → **AGENT**

**Severity**: 🟢 LOW  
**DIAMOND Finding**: Unit/integration tests exist, no end-to-end tests  
**Why Helpful**: Test complete user flows (upload → view → delete)

### 🎓 What This Means

**Current Testing**:
- ✅ Unit tests (individual functions)
- ✅ Integration tests (API endpoints)
- ❌ E2E tests (full user flows)

**E2E Testing Benefits**:
- Test app like real user would use it
- Catch integration issues
- Verify navigation flows
- Test on real devices/simulators

### 📂 Files To Create

```
e2e/                    [CREATE]
  ├── jest.config.js    [CREATE]
  ├── .detoxrc.js       [CREATE]
  └── tests/            [CREATE]
      ├── photos.e2e.ts [CREATE]
      ├── albums.e2e.ts [CREATE]
      └── auth.e2e.ts   [CREATE]
```

### 🔧 What To Do

**⏱️ Estimated Time**: 6-8 hours (complex setup)

#### STEP 1: Install Detox

```bash
npm install --save-dev detox jest-circus
npx detox init -r jest
```

#### STEP 2: Configure Detox

**File**: `.detoxrc.js`

```javascript
module.exports = {
  testRunner: 'jest',
  runnerConfig: 'e2e/jest.config.js',
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/CloudGallery.app',
      build: 'xcodebuild -workspace ios/CloudGallery.xcworkspace -scheme CloudGallery -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build'
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug && cd ..'
    }
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 15'
      }
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_7_API_33'
      }
    }
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug'
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug'
    }
  }
};
```

#### STEP 3: Write E2E test for photo upload

**File**: `e2e/tests/photos.e2e.ts`

```typescript
describe('Photo Upload Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should upload a photo successfully', async () => {
    // Navigate to Photos tab
    await element(by.text('Photos')).tap();
    
    // Tap upload button
    await element(by.id('upload-button')).tap();
    
    // Select photo from picker (mocked)
    // Note: Photo picker interaction is tricky in E2E tests
    // May need to use device.takeScreenshot() for manual testing
    
    // Verify photo appears in grid
    await expect(element(by.id('photo-grid'))).toBeVisible();
    
    // Verify new photo is first item
    await expect(element(by.id('photo-item-0'))).toBeVisible();
  });

  it('should favorite a photo', async () => {
    // Tap first photo
    await element(by.id('photo-item-0')).tap();
    
    // Tap favorite button
    await element(by.id('favorite-button')).tap();
    
    // Verify favorite icon shows
    await expect(element(by.id('favorite-icon'))).toBeVisible();
    
    // Go back
    await element(by.id('back-button')).tap();
  });

  it('should delete a photo', async () => {
    // Long press photo
    await element(by.id('photo-item-0')).longPress();
    
    // Tap delete in context menu
    await element(by.text('Delete')).tap();
    
    // Confirm deletion
    await element(by.text('Confirm')).tap();
    
    // Verify photo removed from grid
    await expect(element(by.id('photo-item-0'))).not.toBeVisible();
  });
});
```

#### STEP 4: Add test IDs to components

```typescript
// FloatingActionButton.tsx
<Pressable testID="upload-button" onPress={onPress}>

// PhotoGrid.tsx
<View testID="photo-grid">
  {photos.map((photo, index) => (
    <Pressable key={photo.id} testID={`photo-item-${index}`}>
```

#### STEP 5: Run E2E tests

```bash
# Build app
npx detox build --configuration ios.sim.debug

# Run tests
npx detox test --configuration ios.sim.debug
```

### ✅ Success Criteria

- [ ] Detox configured for iOS and Android
- [ ] E2E tests run successfully
- [ ] Can upload, favorite, delete photos
- [ ] Can create albums
- [ ] Authentication flow tested
- [ ] Tests run in CI/CD

---

## 🟢 **TASK 17: Performance Monitoring** → **AGENT**

**Severity**: 🟢 LOW  
**DIAMOND Finding**: No runtime performance tracking  
**Why Helpful**: Detect performance regressions, monitor real-world usage

### 🎓 What This Means

**Missing Monitoring**:
- Frame rate tracking
- Memory usage
- Network request timing
- Crash reporting
- Error tracking

**Solution**: Integrate Sentry or similar monitoring tool

### 🔧 What To Do

**⏱️ Estimated Time**: 2-3 hours

#### STEP 1: Choose monitoring service

Options:
- **Sentry** (recommended) - Error tracking + performance
- **DataDog** - Full observability
- **Firebase Crashlytics** - Crash reporting

#### STEP 2: Install Sentry

```bash
npm install --save @sentry/react-native
npx @sentry/wizard -i reactNative -p ios android
```

#### STEP 3: Configure Sentry

**File**: `client/App.tsx`

```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  tracesSampleRate: 1.0, // 100% in dev, reduce in prod
  enableAutoSessionTracking: true,
  sessionTrackingIntervalMillis: 30000,
});

function App() {
  // existing code
}

export default Sentry.wrap(App);
```

#### STEP 4: Add performance tracking

```typescript
// Trace expensive operations
const transaction = Sentry.startTransaction({
  name: 'Load Photos',
  op: 'db.query',
});

const photos = await getPhotos();

transaction.finish();
```

#### STEP 5: Add custom breadcrumbs

```typescript
Sentry.addBreadcrumb({
  category: 'user-action',
  message: 'User uploaded photo',
  level: 'info',
});
```

### ✅ Success Criteria

- [ ] Sentry integrated in client and server
- [ ] Errors reported to Sentry dashboard
- [ ] Performance metrics tracked
- [ ] Crash reports captured
- [ ] Can view traces in Sentry UI

---

## 🟢 **TASK 18: Production Deployment Documentation** → **AGENT**

**Severity**: 🟡 MEDIUM  
**DIAMOND Finding**: No deployment strategy documented  
**Why Important**: Reproducible deployments, disaster recovery

### 🔧 What To Do

**⏱️ Estimated Time**: 2-3 hours

Create comprehensive deployment guide:

**File**: `docs/DEPLOYMENT.md`

```markdown
# Deployment Guide

## Prerequisites
- AWS account (or preferred cloud provider)
- Domain name
- SSL certificate
- PostgreSQL hosted database

## Server Deployment

### Option 1: Railway
1. Connect GitHub repository
2. Add environment variables
3. Deploy automatically on push

### Option 2: AWS EC2
1. Launch t3.medium instance
2. Install Node.js, PostgreSQL
3. Clone repository
4. Set up systemd service
5. Configure nginx reverse proxy

### Option 3: Docker
```bash
docker build -t cloud-gallery-server .
docker run -p 5000:5000 cloud-gallery-server
```

## Mobile App Deployment

### iOS (App Store)
1. Create App Store Connect listing
2. Build production bundle: `eas build --platform ios`
3. Upload to App Store Connect
4. Submit for review

### Android (Google Play)
1. Create Play Console listing
2. Build production bundle: `eas build --platform android`
3. Upload to Play Console
4. Submit for review

## Monitoring

- Set up Sentry for error tracking
- Configure CloudWatch/DataDog for metrics
- Set up uptime monitoring (UptimeRobot)

## Rollback Procedure

If deployment fails:
1. Revert to previous git commit
2. Redeploy previous version
3. Check error logs
4. Fix issue in development
5. Redeploy

## Disaster Recovery

Database backups:
```bash
# Daily automated backups
pg_dump cloudgallery > backup_$(date +%Y%m%d).sql

# Store in S3
aws s3 cp backup.sql s3://backups/cloudgallery/
```
```

### ✅ Success Criteria

- [ ] Deployment documentation complete
- [ ] Multiple deployment options documented
- [ ] Rollback procedure defined
- [ ] Disaster recovery plan documented
- [ ] Environment configuration documented

---

## 💎 **TASK 19: Publish AI-META Pattern** → **TREVOR** (strategic decision)

**Severity**: 📢 STRATEGIC  
**DIAMOND Finding**: Innovative documentation pattern worth sharing  
**Why Important**: Industry contribution, project visibility

### 🎓 What This Means

**AI-META Pattern**: Novel approach to documenting code for AI-assisted development

**Potential Impact**:
- Could become industry standard
- Conference talk material
- Blog post with high engagement
- Establish thought leadership

### 🔧 What To Do

**⏱️ Estimated Time**: 4-8 hours (writing + promotion)

#### Option 1: Blog Post

**Title**: "AI-META: A New Documentation Pattern for AI-Assisted Development"

**Outline**:
1. Problem: Traditional comments don't help AI agents
2. Solution: Structured AI-META headers
3. Pattern specification
4. Real-world examples
5. Benefits and results
6. Call to action (try it in your project)

**Publish on**:
- Dev.to
- Medium
- Your personal blog
- Hacker News (for visibility)

#### Option 2: Conference Talk

**Conferences**:
- React Conf
- Node Congress
- JSConf
- GitHub Universe

**Talk Structure** (20-30 min):
- Introduction (5 min)
- Problem statement (5 min)
- AI-META pattern deep dive (10 min)
- Live coding demo (5 min)
- Q&A (5 min)

#### Option 3: Open Source Specification

**Create**:
- GitHub repository: `AI-META-spec`
- Specification document
- Example implementations
- Linter/validator tool
- VS Code extension (auto-generate AI-META headers)

#### Option 4: Academic Paper

**Venues**:
- ICSE (International Conference on Software Engineering)
- FSE (Foundations of Software Engineering)
- MSR (Mining Software Repositories)

### ✅ Success Criteria

- [ ] AI-META pattern documented formally
- [ ] Published in at least one medium
- [ ] Community feedback collected
- [ ] Adoption tracked (GitHub stars, blog views, etc.)

---

# �🟥 **P0-P3 FEATURE ROADMAP** (After Foundation Fixed)

**👤 OWNER**: TREVOR (prioritizes) + AGENT (implements)

*(These are product features to build after foundation is fixed)*

## P0 — Critical Features → **TREVOR decides priority, AGENT implements**
- True Backup Mode → **AGENT**
- Sync Health Dashboard → **AGENT**
- Deletion Semantics → **AGENT**
- Duplicate Prevention → **AGENT**
- Export/Migration Tools → **AGENT**
- [etc... full list from original]

## P1 — High Priority Features → **TREVOR decides priority, AGENT implements**
- Search & AI → **AGENT**
- Library Organization → **AGENT**
- [etc...]

## P2 — Medium Priority → **TREVOR decides priority, AGENT implements**
- Editing Tools → **AGENT**
- Sharing & Collaboration → **AGENT**
- [etc...]

## P3 — Nice-to-Have → **TREVOR decides priority, AGENT implements**
- Hybrid Local/Cloud → **AGENT**
- Smart Cleanup → **AGENT**
- [etc...]

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

# 🎓 **HOW TO USE THIS TODO WITH AI**

## 🏷️ **Understanding Labels**

- **AGENT** = Let AI execute this (code generation, file creation, refactoring)
- **TREVOR** = You do this (testing, verification, decision-making, reviewing output)
- **Mixed** = Collaboration (AI codes, you test and verify)

### When Working on a Task:

1. **Copy the full task** from this file
2. **Paste into AI chat** with prompt:
   > "I want to complete TASK X. Here's the task description: [paste]. Walk me through each subtask step-by-step. After I complete each subtask, I'll tell you 'done' and you give me the next one."

3. **For AGENT subtasks**: Let AI generate and execute code
4. **For TREVOR subtasks**: You run tests, verify output, make decisions
5. **Mark completed** as you go

### Example AI Prompt Template:

```
I'm a non-coder using AI to build. I want to work on:

TASK 1: Connect Client to Server

Start with SUBTASK 1.1. Give me:
- Exact code to add
- Exact file location
- Exact line numbers where possible
- Commands to run
- How to verify it worked

Wait for me to say "done" before giving next subtask.
```

---

# � **EXTERNAL RESOURCES & DOCUMENTATION**

### 🎯 Official Documentation (Bookmark These)

**Core Technologies:**
- 📘 [React Query / TanStack Query](https://tanstack.com/query/latest/docs/react/overview) - Server state management
- 📘 [Drizzle ORM](https://orm.drizzle.team/docs/overview) - Type-safe database queries
- 📘 [Zod](https://zod.dev) - Runtime schema validation
- 📘 [React Navigation](https://reactnavigation.org/docs/getting-started) - App navigation
- 📘 [Expo](https://docs.expo.dev) - React Native tooling
- 📘 [TypeScript](https://www.typescriptlang.org/docs/) - Type system
- 📘 [PostgreSQL](https://www.postgresql.org/docs/current/) - Database
- 📘 [Express.js](https://expressjs.com/en/5x/api.html) - Web framework

---

### 🎥 Video Tutorials

**Quick Overviews (< 15 minutes):**
- [React Query in 100 Seconds](https://www.youtube.com/watch?v=novnyCaa7To) - Fireship
- [TypeScript in 100 Seconds](https://www.youtube.com/watch?v=zQnBQ4tB3ZA) - Fireship
- [PostgreSQL in 100 Seconds](https://www.youtube.com/watch?v=n2Fluyr3lbc) - Fireship

**In-Depth Courses:**
- [React Query Course](https://www.youtube.com/watch?v=8K1N3fE-cDs) - Codevolution
- [TypeScript Full Course](https://www.youtube.com/watch?v=BCg4U1FzODs) - freeCodeCamp
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/) - Text-based

---

### 📖 Learning Resources

**React Query:**
- [TanStack Query Docs](https://tanstack.com/query/latest) - Official documentation
- [React Query DevTools](https://tanstack.com/query/latest/docs/react/devtools) - Debugging
- [Practical React Query](https://tkdodo.eu/blog/practical-react-query) - Blog series

**TypeScript:**
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/) - Free book
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) - Official guide

**React Native:**
- [React Native Docs](https://reactnative.dev/docs/getting-started) - Official docs
- [Expo Docs](https://docs.expo.dev) - Expo-specific features

**Database:**
- [Drizzle ORM Quickstart](https://orm.drizzle.team/docs/quick-start) - Getting started
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/) - SQL basics
- [SQL Practice](https://www.sql-practice.com/) - Interactive exercises

---

### 💬 Community Support

**Discord Servers:**
- [Expo Discord](https://chat.expo.dev) - Expo and React Native help
- [TanStack Discord](https://discord.gg/tanstack) - React Query support
- [Reactiflux](https://discord.gg/reactiflux) - React community

**Forums:**
- [Expo Forums](https://forums.expo.dev) - Expo-specific issues
- [Stack Overflow](https://stackoverflow.com) - General programming
  - Tags: `react-native`, `react-query`, `drizzle-orm`, `typescript`, `postgresql`

**Reddit:**
- [r/reactnative](https://reddit.com/r/reactnative) - React Native community
- [r/typescript](https://reddit.com/r/typescript) - TypeScript discussions
- [r/PostgreSQL](https://reddit.com/r/PostgreSQL) - Database help

---

### 🛠️ Debugging Tools

**Essential Tools (already in project or should install):**

1. **React DevTools**
   - [Chrome Extension](https://chrome.google.com/webstore/detail/react-developer-tools/fmkadmapgofadopljbjfkapdkoienihi)
   - View component tree, props, state

2. **React Query DevTools**
   - Already installed in project
   - Shows query cache, mutations, status
   - Access: Look for floating icon in dev mode

3. **Drizzle Studio**
   - Visual database browser
   - Start: `npm run db:studio`
   - Opens web interface to browse tables

4. **React Native Debugger**
   - Press `j` in Expo terminal
   - Opens Chrome DevTools
   - View console, network, elements

5. **Expo Dev Tools**
   - Opens when you run `npm start`
   - Shows logs, errors, QR code

6. **VS Code Extensions**
   - ESLint - Show linting errors
   - Prettier - Code formatting
   - TypeScript - Type checking
   - GitLens - Git history

---

### 🔍 When You're Stuck

**Search Strategy:**

1. **Read the error message carefully**
   - Often contains solution
   - Google the exact error: "ECONNREFUSED postgresql"

2. **Check official docs first**
   - More reliable than random blogs
   - Use docs search feature

3. **Search Stack Overflow**
   - Add tags: `[react-native] [typescript] keyword`
   - Look for answers with high upvotes
   - Check date (newer is usually better)

4. **Search GitHub Issues**
   - Check package's GitHub issues:
     - https://github.com/TanStack/query/issues
     - https://github.com/drizzle-team/drizzle-orm/issues
   - Search closed issues too (might be solved)

5. **Ask in community**
   - Discord, forums, Reddit
   - Provide context (see Error Recovery section)

---

### 📋 Cheat Sheets

**Quick reference guides:**
- [TypeScript Cheat Sheet](https://www.typescriptlang.org/cheatsheets) - Official
- [SQL Cheat Sheet](https://www.sqltutorial.org/sql-cheat-sheet/) - Common queries
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf) - GitHub's official
- [React Hooks Cheat Sheet](https://react-hooks-cheatsheet.com/) - All hooks

---

### 🎓 Advanced Topics (After Foundation Complete)

**Read these after completing Week 1-4 tasks:**
- [React Query Best Practices](https://tkdodo.eu/blog/practical-react-query) - Advanced patterns
- [TypeScript Performance](https://github.com/microsoft/TypeScript/wiki/Performance) - Optimization
- [React Native Performance](https://reactnative.dev/docs/performance) - Speed up app
- [PostgreSQL Query Optimization](https://www.postgresql.org/docs/current/performance-tips.html) - Database speed

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

# 📊 **PROGRESS TRACKING**

### 📊 Visual Progress Tracker

**Update this after each task/subtask completion:**

```
═══════════════════════════════════════════════════════════
  FOUNDATION REPAIR PROGRESS (4 Week Sprint)
═══════════════════════════════════════════════════════════

Week 1: CONNECTIVITY ████──────────── 40% (2/5 complete)
├─ ✅ SUBTASK 1.1: Photo database table
├─ ✅ SUBTASK 1.2: Album database table  
├─ ⏳ SUBTASK 1.3: Database connection (IN PROGRESS)
├─ ⏸️ SUBTASK 1.4: Photo API endpoints (PENDING)
├─ ⏸️ SUBTASK 1.5: Register routes (PENDING)
├─ ⏸️ SUBTASK 1.6: Update PhotosScreen (PENDING)
├─ ⏸️ SUBTASK 1.7: Album API endpoints (PENDING)
├─ ⏸️ SUBTASK 1.8: Update AlbumsScreen (PENDING)
└─ ⏸️ SUBTASK 1.9: E2E Testing (PENDING)

Week 2: DATA QUALITY ────────────── 0% (0/2 complete)
├─ ⏸️ Task 2: Storage Layer Fixes
└─ ⏸️ Task 4: Type Safety Improvements

Week 3: MODERN PATTERNS ───────────── 0% (0/2 complete)
├─ ⏸️ Task 11: React Query Integration
└─ ⏸️ Task 9: Service/Repository Layers

Week 4: UX & POLISH ───────────────── 0% (0/4 complete)
├─ ⏸️ Task 5: Responsive Layouts
├─ ⏸️ Task 6: Logger Service
├─ ⏸️ Task 7: Centralized Error Handling
└─ ⏸️ Task 8: Performance (Pagination)

═══════════════════════════════════════════════════════════
  QUALITY & POLISH PROGRESS (Week 5-8, From DIAMOND)
═══════════════════════════════════════════════════════════

Week 5: DOCS & ERROR RECOVERY ──────── 0% (0/3 complete)
├─ ⏸️ Task 12: Create README.md
├─ ⏸️ Task 13: Deploy Error Boundaries
└─ ⏸️ Task 18: Deployment Documentation

Week 6: ACCESSIBILITY & API ────────── 0% (0/2 complete)
├─ ⏸️ Task 14: Accessibility Audit & Fixes
└─ ⏸️ Task 15: OpenAPI/Swagger Documentation

Week 7: TESTING & MONITORING ───────── 0% (0/2 complete)
├─ ⏸️ Task 16: E2E Tests (Detox)
└─ ⏸️ Task 17: Performance Monitoring

Week 8: STRATEGIC ──────────────────── 0% (0/1 complete)
└─ ⏸️ Task 19: Publish AI-META Pattern

═══════════════════════════════════════════════════════════
  OVERALL PROGRESS: ███──────────────────── 15%
═══════════════════════════════════════════════════════════

Legend:
✅ Complete | ⏳ In Progress | ⏸️ Pending | ❌ Blocked
```

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

## Current Sprint → **TREVOR updates this**
- [ ] Task 1: Client-Server Connection (Week 1) → **Mixed**
  - [ ] SUBTASK 1.1: Photo database table → **AGENT**
  - [ ] SUBTASK 1.2: Album database table → **AGENT**
  - [ ] SUBTASK 1.3: Database connection → **AGENT**
  - [ ] SUBTASK 1.4: Photo API endpoints → **AGENT**
  - [ ] SUBTASK 1.5: Register routes → **AGENT**
  - [ ] SUBTASK 1.6: Update PhotosScreen → **AGENT**
  - [ ] Test end-to-end → **TREVOR**

## Completed → **TREVOR updates this**
- [x] Code quality assessment → **AGENT**
- [x] Created comprehensive TODO guide → **AGENT**

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---

**📌 Remember**: Each task is broken into subtasks. Each subtask has code examples, file paths, and success criteria. Use AI to execute each subtask systematically. This is your complete Battle Plan!

---

# 🔄 CROSS-POLLINATION TASKS (From Multi-Repo Analysis)

**Source:** Triple Repository Analysis (February 4, 2026)  
**Priority:** These tasks incorporate production-tested patterns from sibling repositories.

---

## 🔴 TASK 20: Add CSRF Protection (4 hours) → **AGENT**

**Source Pattern:** Production-tested CSRF implementation from UBOS repository  
**Priority:** P0 - Security Critical  
**Why Critical:** Prevents attackers from tricking authenticated users into performing unwanted actions

### 🎓 What This Means (Plain English)

**Current Problem**: Your app has no CSRF (Cross-Site Request Forgery) protection. An attacker could create a malicious website that makes requests to your API using your logged-in user's session.

**The Fix**: Add CSRF tokens that must be included in all state-changing requests (POST, PUT, DELETE).

### 📂 Files You'll Create/Modify

```
📁 Project Structure:
  📁 server/
    │── csrf.ts           [CREATE] CSRF token generation and validation
    │── csrf.test.ts      [CREATE] CSRF tests
    │── routes.ts         [EDIT] Register CSRF middleware
  📁 client/
    └── lib/
        └── query-client.ts [EDIT] Add CSRF token to requests
```

### 🔧 What To Do

#### SUBTASK 20.1: Create CSRF Module → **AGENT**

**File:** `server/csrf.ts`

```typescript
// AI-META-BEGIN
// AI-META: CSRF token generation and validation
// OWNERSHIP: server/security
// ENTRYPOINTS: server/routes.ts
// DEPENDENCIES: crypto (randomBytes)
// DANGER: CSRF protection critical - timing-safe comparison required
// CHANGE-SAFETY: Review changes carefully - security-critical code
// TESTS: server/csrf.test.ts
// AI-META-END

/**
 * CSRF (Cross-Site Request Forgery) Protection
 * 
 * Implements synchronizer token pattern for state-changing operations.
 * 
 * Standards Compliance:
 * - OWASP ASVS 4.2.2: CSRF protection for state-changing operations
 */

import { randomBytes } from "crypto";
import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Extend Express Request type to include CSRF token
 */
declare module "express-serve-static-core" {
  interface Request {
    csrfToken?: string;
    generateCsrfToken?: () => string;
  }
}

/**
 * Session storage for CSRF tokens.
 * In production, this should be backed by Redis.
 */
const csrfTokenStore = new Map<string, { token: string; createdAt: number }>();

/**
 * CSRF token lifetime (24 hours)
 */
const CSRF_TOKEN_LIFETIME = 24 * 60 * 60 * 1000;

/**
 * Generate cryptographically secure CSRF token.
 * @returns Base64-encoded random token (32 bytes = 256 bits)
 */
export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64");
}

/**
 * Get or create CSRF token for a user session.
 */
export function getOrCreateCsrfToken(userId: string): string {
  const existing = csrfTokenStore.get(userId);
  
  if (existing && Date.now() - existing.createdAt < CSRF_TOKEN_LIFETIME) {
    return existing.token;
  }
  
  const newToken = generateCsrfToken();
  csrfTokenStore.set(userId, {
    token: newToken,
    createdAt: Date.now(),
  });
  
  return newToken;
}

/**
 * Invalidate CSRF token (e.g., on logout).
 */
export function invalidateCsrfToken(userId: string): void {
  csrfTokenStore.delete(userId);
}

/**
 * Validate CSRF token from request against stored token.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function validateCsrfToken(userId: string, providedToken: string | undefined): boolean {
  if (!providedToken) {
    return false;
  }
  
  const stored = csrfTokenStore.get(userId);
  
  if (!stored || Date.now() - stored.createdAt >= CSRF_TOKEN_LIFETIME) {
    return false;
  }
  
  // Constant-time comparison to prevent timing attacks
  if (stored.token.length !== providedToken.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < stored.token.length; i++) {
    result |= stored.token.charCodeAt(i) ^ providedToken.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Extract CSRF token from request.
 */
function extractCsrfToken(req: Request): string | undefined {
  const headerToken = req.header("X-CSRF-Token") || req.header("x-csrf-token");
  if (headerToken) return headerToken;
  
  if (req.body && typeof req.body._csrf === "string") {
    return req.body._csrf;
  }
  
  if (req.query && typeof req.query.csrf === "string") {
    return req.query.csrf;
  }
  
  return undefined;
}

/**
 * CSRF protection middleware for state-changing routes.
 * 
 * Usage:
 *   app.post("/api/resource", requireAuth, requireCsrf, handler);
 */
export const requireCsrf: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }
  
  // Extract user ID from authenticated session
  const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
  if (!userId) {
    return res.status(401).json({ 
      message: "Unauthorized - Authentication required for CSRF validation" 
    });
  }
  
  const providedToken = extractCsrfToken(req);
  
  if (!validateCsrfToken(userId, providedToken)) {
    console.warn(
      `[SECURITY] CSRF validation failed for user ${userId}, ` +
      `method ${req.method}, path ${req.path}, IP ${req.ip}`
    );
    
    return res.status(403).json({
      message: "Forbidden - Invalid or missing CSRF token",
      code: "CSRF_VALIDATION_FAILED",
    });
  }
  
  next();
};

/**
 * Middleware to attach CSRF token to request and response.
 */
export const attachCsrfToken: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
  
  if (userId) {
    const token = getOrCreateCsrfToken(userId);
    req.csrfToken = token;
    req.generateCsrfToken = () => token;
    res.setHeader("X-CSRF-Token", token);
  }
  
  next();
};

/**
 * Handler to explicitly return CSRF token.
 */
export const getCsrfTokenHandler: RequestHandler = (req: Request, res: Response) => {
  const userId = (req as any).user?.id || (req as any).user?.claims?.sub;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  const token = getOrCreateCsrfToken(userId);
  res.json({ csrfToken: token, expiresIn: CSRF_TOKEN_LIFETIME });
};

/**
 * Clean up expired CSRF tokens periodically.
 */
export function cleanupExpiredCsrfTokens(): void {
  const now = Date.now();
  const expired: string[] = [];
  
  for (const [userId, data] of csrfTokenStore.entries()) {
    if (now - data.createdAt >= CSRF_TOKEN_LIFETIME) {
      expired.push(userId);
    }
  }
  
  expired.forEach(userId => csrfTokenStore.delete(userId));
}

// Schedule cleanup every hour
setInterval(cleanupExpiredCsrfTokens, 60 * 60 * 1000);
```

#### SUBTASK 20.2: Create CSRF Tests → **AGENT**

**File:** `server/csrf.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateCsrfToken,
  getOrCreateCsrfToken,
  validateCsrfToken,
  invalidateCsrfToken,
} from './csrf';

describe('CSRF Protection', () => {
  const testUserId = 'test-user-123';

  beforeEach(() => {
    invalidateCsrfToken(testUserId);
  });

  describe('generateCsrfToken', () => {
    it('should generate a base64 token', () => {
      const token = generateCsrfToken();
      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);
    });

    it('should generate unique tokens', () => {
      const token1 = generateCsrfToken();
      const token2 = generateCsrfToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('getOrCreateCsrfToken', () => {
    it('should create a new token for new user', () => {
      const token = getOrCreateCsrfToken(testUserId);
      expect(token).toBeTruthy();
    });

    it('should return same token for same user within lifetime', () => {
      const token1 = getOrCreateCsrfToken(testUserId);
      const token2 = getOrCreateCsrfToken(testUserId);
      expect(token1).toBe(token2);
    });
  });

  describe('validateCsrfToken', () => {
    it('should validate correct token', () => {
      const token = getOrCreateCsrfToken(testUserId);
      expect(validateCsrfToken(testUserId, token)).toBe(true);
    });

    it('should reject missing token', () => {
      getOrCreateCsrfToken(testUserId);
      expect(validateCsrfToken(testUserId, undefined)).toBe(false);
    });

    it('should reject invalid token', () => {
      getOrCreateCsrfToken(testUserId);
      expect(validateCsrfToken(testUserId, 'invalid-token')).toBe(false);
    });

    it('should reject token for unknown user', () => {
      expect(validateCsrfToken('unknown-user', 'any-token')).toBe(false);
    });
  });

  describe('invalidateCsrfToken', () => {
    it('should invalidate existing token', () => {
      const token = getOrCreateCsrfToken(testUserId);
      expect(validateCsrfToken(testUserId, token)).toBe(true);
      
      invalidateCsrfToken(testUserId);
      expect(validateCsrfToken(testUserId, token)).toBe(false);
    });
  });
});
```

#### SUBTASK 20.3: Register CSRF Middleware → **AGENT**

**File:** `server/routes.ts` (add these lines)

```typescript
import { attachCsrfToken, requireCsrf, getCsrfTokenHandler } from './csrf';

// After authentication middleware
app.use(attachCsrfToken);

// CSRF token endpoint
app.get('/api/csrf-token', getCsrfTokenHandler);

// Apply CSRF protection to state-changing routes
app.post('/api/*', requireCsrf);
app.put('/api/*', requireCsrf);
app.delete('/api/*', requireCsrf);
```

#### SUBTASK 20.4: Update Client API → **AGENT**

**File:** `client/lib/query-client.ts` (add CSRF handling)

```typescript
let csrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (!csrfToken) {
    const response = await fetch('/api/csrf-token', { credentials: 'include' });
    const data = await response.json();
    csrfToken = data.csrfToken;
  }
  return csrfToken!;
}

// Update apiRequest to include CSRF token
export async function apiRequest(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: any
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add CSRF token for state-changing requests
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    headers['X-CSRF-Token'] = await getCsrfToken();
  }
  
  // ... rest of existing apiRequest implementation
}

// Clear CSRF token on logout
export function clearCsrfToken(): void {
  csrfToken = null;
}
```

### ✅ Success Criteria

- [ ] `server/csrf.ts` created with all functions
- [ ] `server/csrf.test.ts` created and passing
- [ ] CSRF middleware registered in routes
- [ ] Client includes CSRF token in requests
- [ ] Manual test: POST without CSRF token returns 403
- [ ] All tests pass: `npm test`

---

## 🟡 TASK 21: Add AI-META Headers to Server Files (2 hours) → **AGENT**

**Source Pattern:** Standardized AI documentation headers from UBOS repository  
**Priority:** P2 - Developer Experience  
**Why Helpful:** Helps AI assistants understand code purpose, ownership, and safety constraints

### 🎓 What This Means (Plain English)

**Current Problem**: AI assistants analyzing your code don't have structured metadata to understand file purpose, dependencies, and change safety.

**The Fix**: Add standardized AI-META headers to all server files.

### 📋 AI-META Header Template

Add this header to the top of each server file:

```typescript
// AI-META-BEGIN
// AI-META: <Brief description of file purpose>
// OWNERSHIP: <domain>/<subdomain>
// ENTRYPOINTS: <Where this code is called from>
// DEPENDENCIES: <Key external dependencies>
// DANGER: <Critical risks or side effects - REQUIRED if any>
// CHANGE-SAFETY: <Guidance on when changes are safe/unsafe>
// TESTS: <Path to test files>
// AI-META-END
```

### 📂 Files to Update

**Priority Order:**

1. **`server/auth.ts`** (authentication is security-critical):
```typescript
// AI-META-BEGIN
// AI-META: JWT authentication and session management for photo gallery
// OWNERSHIP: server/security
// ENTRYPOINTS: server/routes.ts, server/auth-routes.ts
// DEPENDENCIES: jsonwebtoken, bcrypt, @shared/schema
// DANGER: Authentication bypass = full account compromise
// CHANGE-SAFETY: Any JWT/session changes require security review
// TESTS: server/auth.test.ts
// AI-META-END
```

2. **`server/routes.ts`** (main routing):
```typescript
// AI-META-BEGIN
// AI-META: Express route registration and API endpoint definitions
// OWNERSHIP: server/api
// ENTRYPOINTS: server/index.ts
// DEPENDENCIES: express, all route handlers
// DANGER: Route ordering matters - auth middleware must run first
// CHANGE-SAFETY: Safe to add routes; be careful reordering middleware
// TESTS: server/routes.test.ts
// AI-META-END
```

3. **`server/audit.ts`** (compliance logging):
```typescript
// AI-META-BEGIN
// AI-META: Comprehensive audit logging for security compliance
// OWNERSHIP: server/security
// ENTRYPOINTS: server/routes.ts, server/index.ts
// DEPENDENCIES: crypto, drizzle-orm, @shared/schema
// DANGER: Audit logs required for compliance; ensure sensitive data redacted
// CHANGE-SAFETY: Safe to add event types; never remove existing types
// TESTS: server/audit.test.ts
// AI-META-END
```

4. **`server/encryption.ts`** (data protection):
```typescript
// AI-META-BEGIN
// AI-META: AES-256-GCM encryption utilities for sensitive data at rest
// OWNERSHIP: server/security
// ENTRYPOINTS: server/storage.ts, server/backup-encryption.ts
// DEPENDENCIES: crypto (native Node.js)
// DANGER: Encryption key loss = permanent data loss
// CHANGE-SAFETY: Never change encryption parameters without migration plan
// TESTS: server/encryption.test.ts
// AI-META-END
```

5. **Continue for**: `server/captcha.ts`, `server/db-encryption.ts`, `server/siem.ts`

### ✅ Success Criteria

- [ ] All server/*.ts files have AI-META headers
- [ ] Headers accurately describe each file
- [ ] DANGER sections highlight real risks
- [ ] Tests pass after changes

---

## 🟡 TASK 22: Add Test Coverage Enforcement (1 hour) → **AGENT**

**Source Pattern:** Prevent focused/skipped tests from being committed  
**Priority:** P2 - CI/CD Quality  
**Why Important:** Developers sometimes forget to remove `.only()` or `.skip()` before committing

### 🔧 What To Do

#### SUBTASK 22.1: Update Vitest Config → **AGENT**

**File:** `vitest.config.ts`

Add `allowOnly: false` to prevent `.only()` and `.skip()` in committed tests:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    allowOnly: false, // ← ADD THIS LINE
    // ... existing config
  },
});
```

#### SUBTASK 22.2: Add Pre-commit Check Script → **AGENT**

**File:** `package.json` (add to scripts)

```json
{
  "scripts": {
    "test:check-focused": "grep -rn '\\.only\\|describe\\.skip\\|it\\.skip\\|test\\.skip' server/ client/src/ && exit 1 || exit 0"
  }
}
```

### ✅ Success Criteria

- [ ] `allowOnly: false` in vitest.config.ts
- [ ] Tests with `.only()` fail in CI
- [ ] Check script added to package.json

---

## 🟡 TASK 23: Add Presigned URL Pattern (4 hours) → **AGENT**

**Source Pattern:** Secure file upload/download URLs from CloudVault (secure_file) repository  
**Priority:** P2 - Performance & Security  
**Why Helpful:** Allows direct client-to-storage uploads without proxying through server

### 🎓 What This Means (Plain English)

**Current Flow**: Client → Server → Storage → Server → Client (slow, server bottleneck)

**With Presigned URLs**: Client → Storage (server only signs URLs, doesn't handle file data)

### 📂 Files You'll Create/Modify

```
📁 server/
  └── presigned-urls.ts     [CREATE] URL generation and validation
📁 .env.example             [EDIT] Add PRESIGNED_URL_SECRET
```

### 🔧 What To Do

#### SUBTASK 23.1: Create Presigned URL Module → **AGENT**

**File:** `server/presigned-urls.ts`

```typescript
// AI-META-BEGIN
// AI-META: Presigned URL generation for secure file uploads/downloads
// OWNERSHIP: server/storage
// ENTRYPOINTS: server/upload-routes.ts
// DEPENDENCIES: crypto (native Node.js)
// DANGER: Weak secret = URL forgery; expired URLs must be rejected
// CHANGE-SAFETY: Safe to add new URL types; never change signature algorithm without migration
// TESTS: server/presigned-urls.test.ts
// AI-META-END

import { createHmac, randomBytes } from "crypto";

/**
 * Configuration for presigned URLs
 */
const PRESIGNED_CONFIG = {
  DEFAULT_EXPIRY: 15 * 60, // 15 minutes in seconds
  MAX_EXPIRY: 7 * 24 * 60 * 60, // 7 days in seconds
  SIGNATURE_ALGORITHM: "sha256",
} as const;

/**
 * Generate a presigned URL for file upload
 */
export function generateUploadUrl(
  key: string,
  contentType: string,
  expirySeconds: number = PRESIGNED_CONFIG.DEFAULT_EXPIRY
): { url: string; expiresAt: Date } {
  const secret = process.env.PRESIGNED_URL_SECRET;
  if (!secret) {
    throw new Error("PRESIGNED_URL_SECRET not configured");
  }

  const expiresAt = new Date(Date.now() + expirySeconds * 1000);
  const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);
  
  const dataToSign = `PUT:${key}:${contentType}:${expiresTimestamp}`;
  const signature = createHmac(PRESIGNED_CONFIG.SIGNATURE_ALGORITHM, secret)
    .update(dataToSign)
    .digest("hex");

  const baseUrl = process.env.STORAGE_BASE_URL || "/api/storage";
  const params = new URLSearchParams({
    key,
    contentType,
    expires: expiresTimestamp.toString(),
    signature,
  });

  return {
    url: `${baseUrl}/upload?${params.toString()}`,
    expiresAt,
  };
}

/**
 * Generate a presigned URL for file download
 */
export function generateDownloadUrl(
  key: string,
  expirySeconds: number = PRESIGNED_CONFIG.DEFAULT_EXPIRY
): { url: string; expiresAt: Date } {
  const secret = process.env.PRESIGNED_URL_SECRET;
  if (!secret) {
    throw new Error("PRESIGNED_URL_SECRET not configured");
  }

  const expiresAt = new Date(Date.now() + expirySeconds * 1000);
  const expiresTimestamp = Math.floor(expiresAt.getTime() / 1000);
  
  const dataToSign = `GET:${key}:${expiresTimestamp}`;
  const signature = createHmac(PRESIGNED_CONFIG.SIGNATURE_ALGORITHM, secret)
    .update(dataToSign)
    .digest("hex");

  const baseUrl = process.env.STORAGE_BASE_URL || "/api/storage";
  const params = new URLSearchParams({
    key,
    expires: expiresTimestamp.toString(),
    signature,
  });

  return {
    url: `${baseUrl}/download?${params.toString()}`,
    expiresAt,
  };
}

/**
 * Validate a presigned URL signature (constant-time comparison)
 */
export function validatePresignedUrl(
  method: "GET" | "PUT",
  key: string,
  contentType: string | null,
  expires: string,
  providedSignature: string
): boolean {
  const secret = process.env.PRESIGNED_URL_SECRET;
  if (!secret) return false;

  // Check expiry
  const expiresTimestamp = parseInt(expires, 10);
  if (isNaN(expiresTimestamp) || expiresTimestamp < Math.floor(Date.now() / 1000)) {
    return false;
  }

  // Compute expected signature
  const dataToSign = method === "PUT"
    ? `${method}:${key}:${contentType}:${expiresTimestamp}`
    : `${method}:${key}:${expiresTimestamp}`;
  
  const expectedSignature = createHmac(PRESIGNED_CONFIG.SIGNATURE_ALGORITHM, secret)
    .update(dataToSign)
    .digest("hex");

  // Constant-time comparison
  if (expectedSignature.length !== providedSignature.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < expectedSignature.length; i++) {
    result |= expectedSignature.charCodeAt(i) ^ providedSignature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate secure share token
 */
export function generateShareToken(): string {
  return randomBytes(32).toString("hex");
}
```

#### SUBTASK 23.2: Update Environment Example → **AGENT**

**File:** `.env.example` (add these lines)

```bash
# Presigned URL secret (64 hex chars)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
PRESIGNED_URL_SECRET=

# Storage base URL (for presigned URL generation)
STORAGE_BASE_URL=https://your-domain.com/api/storage
```

### ✅ Success Criteria

- [ ] `server/presigned-urls.ts` created
- [ ] URL generation works
- [ ] URL validation rejects expired/tampered URLs
- [ ] Constant-time comparison used for signatures
- [ ] Environment variables documented

---

## 🟢 TASK 24: Add Environment Validation (2 hours) → **AGENT**

**Source Pattern:** Zod-based environment validation from UBOS repository  
**Priority:** P3 - Developer Experience  
**Why Helpful:** Fail fast on startup if required environment variables missing

### 🔧 What To Do

**File:** `server/config.ts`

```typescript
import { z } from 'zod';

/**
 * Environment variable schema with validation
 */
export const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  
  // Optional with defaults
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  
  // CSRF (required in production)
  PRESIGNED_URL_SECRET: z.string().length(64).optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate and parse environment variables
 * Throws on invalid configuration (fail-fast)
 */
export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(issue => 
        `  - ${issue.path.join('.')}: ${issue.message}`
      ).join('\n');
      
      console.error(`\n❌ Environment validation failed:\n${issues}\n`);
      console.error('Check your .env file and ensure all required variables are set.\n');
      process.exit(1);
    }
    throw error;
  }
}

// Validate on import
export const env = validateEnv();
```

### ✅ Success Criteria

- [ ] `server/config.ts` created with Zod schema
- [ ] Server fails fast on missing required env vars
- [ ] Clear error messages for invalid values
- [ ] All `process.env` accesses use validated config

---

[↑ Table of Contents](#-table-of-contents) | [→ Tasks](#-critical-foundation-fixes-do-first)

---
