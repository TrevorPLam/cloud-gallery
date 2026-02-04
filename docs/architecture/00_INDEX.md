# Architecture Documentation Index

**Purpose**: This is the front door to Cloud Gallery's architecture documentation. Start here to understand the system.

## 📚 What to Read First

1. **New to the project?** Start with [10_OVERVIEW.md](./10_OVERVIEW.md) to understand what Cloud Gallery does
2. **Need to run it?** Check [20_RUNTIME_TOPOLOGY.md](./20_RUNTIME_TOPOLOGY.md) for deployment and local setup
3. **Making code changes?** Read [30_MODULES_AND_DEPENDENCIES.md](./30_MODULES_AND_DEPENDENCIES.md) to understand the module structure
4. **Implementing a feature?** See [40_KEY_FLOWS.md](./40_KEY_FLOWS.md) for critical user journeys
5. **Confused by terms?** Reference [90_GLOSSARY.md](./90_GLOSSARY.md) for definitions

## 📖 Documentation Map

### Core Architecture (Start Here)
- [**00_INDEX.md**](./00_INDEX.md) (you are here) - Navigation guide
- [**10_OVERVIEW.md**](./10_OVERVIEW.md) - Product purpose, high-level design, major components
- [**20_RUNTIME_TOPOLOGY.md**](./20_RUNTIME_TOPOLOGY.md) - What runs where, environments, boot sequence
- [**30_MODULES_AND_DEPENDENCIES.md**](./30_MODULES_AND_DEPENDENCIES.md) - Folder structure, import rules
- [**40_KEY_FLOWS.md**](./40_KEY_FLOWS.md) - Critical user journeys with validation tips
- [**90_GLOSSARY.md**](./90_GLOSSARY.md) - Terms and acronyms

### Deep-Dive Documentation
- [**Data Layer**](../data/00_INDEX.md) - Storage, schemas, persistence
- [**API Layer**](../api/00_INDEX.md) - Routes, error handling, conventions
- [**Integrations**](../integrations/00_INDEX.md) - Third-party services, secrets
- [**Architecture Decision Records**](../adr/README.md) - Why we made key decisions

## 🎯 Quick Links

### For Developers
- **Local setup**: [Runtime Topology - Local Environment](./20_RUNTIME_TOPOLOGY.md#local-development)
- **Adding a screen**: [Modules - Navigation](./30_MODULES_AND_DEPENDENCIES.md#navigation-structure)
- **Data operations**: [Key Flows - Data Write Path](./40_KEY_FLOWS.md#3-data-write-path-photo-upload)

### For Architects
- **System boundaries**: [Overview - Component Architecture](./10_OVERVIEW.md#component-architecture)
- **Technology choices**: [ADRs](../adr/README.md)
- **Scaling considerations**: [Runtime Topology - Production](./20_RUNTIME_TOPOLOGY.md#production-environment)

### For QA/Testers
- **Test strategies**: [Key Flows - Validation Tips](./40_KEY_FLOWS.md)
- **Failure modes**: Each flow in [40_KEY_FLOWS.md](./40_KEY_FLOWS.md)

## 🔍 Finding What You Need

**By Technology:**
- React Native → [Modules - Client](./30_MODULES_AND_DEPENDENCIES.md#client-architecture)
- Express → [Modules - Server](./30_MODULES_AND_DEPENDENCIES.md#server-architecture)
- AsyncStorage → [Data Index](../data/00_INDEX.md)
- Navigation → [Modules - Navigation](./30_MODULES_AND_DEPENDENCIES.md#navigation-structure)

**By Feature:**
- Photos → [Key Flows - Photo Upload](./40_KEY_FLOWS.md#3-data-write-path-photo-upload)
- Albums → [Key Flows - Album Management](./40_KEY_FLOWS.md#5-album-management-flow)
- Search → [Key Flows - Search](./40_KEY_FLOWS.md#6-search-flow)

## 📝 Quick Reference

### Key Directories
```
client/           Mobile app (React Native + Expo)
server/           Backend API (Express.js)
shared/           Shared types and schemas
docs/             Architecture documentation
```

### Key Commands
```bash
npm run expo:dev      # Start mobile app
npm run server:dev    # Start backend server
npm run check:types   # TypeScript validation
npm run lint          # Code linting
```

### Key Contacts
- Design Guidelines: [/design_guidelines.md](../../design_guidelines.md)
- Project Overview: [/replit.md](../../replit.md)
- AI Documentation: [/AI_DOCUMENTATION_REPORT.md](../../AI_DOCUMENTATION_REPORT.md)

## 🔄 Keeping Docs Current

See the **Doc Maintenance Rules** section at the bottom of [10_OVERVIEW.md](./10_OVERVIEW.md#doc-maintenance-rules) for guidelines on updating documentation.

---

**Last Updated**: 2026-02-04  
**Maintained By**: Development Team
