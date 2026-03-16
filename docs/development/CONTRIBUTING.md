# Contributing to Cloud Gallery

<div align="center">

![Contributors](https://img.shields.io/github/contributors/TrevorPLam/cloud-gallery)
![Pull Requests](https://img.shields.io/github/issues-pr/TrevorPLam/cloud-gallery)
![Issues](https://img.shields.io/github/issues/TrevorPLam/cloud-gallery)
![License](https://img.shields.io/github/license/TrevorPLam/cloud-gallery)

</div>

Thank you for your interest in contributing to Cloud Gallery! This guide will help you get started with contributing to our premium photo storage application.

## 🎯 Contribution Areas

We welcome contributions in the following areas:

### 📱 **Frontend (React Native)**
- UI/UX improvements
- New photo editing features
- Performance optimizations
- Accessibility enhancements
- Platform-specific features (iOS/Android/Web)

### 🗄️ **Backend (Node.js)**
- API endpoint development
- Database optimization
- Security enhancements
- Performance improvements
- New authentication methods

### 🔒 **Security**
- Security vulnerability fixes
- Security testing improvements
- Documentation updates
- Compliance features
- Penetration testing

### 🧪 **Testing**
- Unit tests
- Integration tests
- End-to-end tests
- Performance tests
- Security tests

### 📚 **Documentation**
- API documentation
- User guides
- Architecture documentation
- Security documentation
- Code comments

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- PostgreSQL (for full development)
- Expo CLI (for mobile development)

### Development Setup

1. **Fork the Repository**
   ```bash
   # Fork the repository on GitHub
   git clone https://github.com/YOUR_USERNAME/cloud-gallery.git
   cd cloud-gallery
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Set Up Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set Up Database**
   ```bash
   # Create database
   createdb cloudgallery
   
   # Run migrations
   npm run db:push
   ```

5. **Start Development**
   ```bash
   # Start React Native app
   npm run expo:dev
   
   # Start backend server (optional for MVP)
   npm run server:dev
   ```

## 📋 Development Workflow

### Code Review Process

#### Testing Requirements for All PRs
All pull requests must include:

1. **100% Test Coverage** for new code
   - Use `npm run test:coverage` to verify
   - No coverage exceptions without team approval
   - Tests must be meaningful, not just for coverage

2. **Testing Best Practices**
   - Use sociable testing patterns (see [docs/testing/30_TEST_PATTERNS.md](../testing/30_TEST_PATTERNS.md))
   - Apply accessibility-first testing (semantic queries)
   - Use userEvent for user interactions
   - Include edge cases and error scenarios

3. **Test Quality Standards**
   - Tests must be readable and maintainable
   - Use descriptive test names and clear assertions
   - Avoid over-mocking internal dependencies
   - Focus on behavior, not implementation

#### Code Review Checklist

##### Before Submitting PR
- [ ] Run `npm run test:check-focused` to ensure no focused/skipped tests
- [ ] Run `npm run test:coverage` to verify 100% coverage
- [ ] Run `npm run lint` to check code style
- [ ] Run `npm run check:types` to verify TypeScript compliance
- [ ] Run `npm run test:accessibility` for accessibility tests
- [ ] Run `npm run test:security` for security tests
- [ ] Test all changes manually in development environment

##### During Code Review
**Reviewers must check:**

**Testing Quality**
- [ ] All new code has comprehensive tests
- [ ] Tests follow project testing patterns
- [ ] Test coverage is 100% for new code
- [ ] Tests are meaningful and assert behavior
- [ ] Edge cases and error scenarios are covered

**Code Quality**
- [ ] Code follows project style guidelines
- [ ] TypeScript types are properly defined
- [ ] Error handling is appropriate
- [ ] Performance implications are considered
- [ ] Security best practices are followed

**Documentation**
- [ ] Code is well-commented where necessary
- [ ] API changes are documented
- [ ] Testing patterns are explained if novel
- [ ] Breaking changes are clearly identified

#### Testing-Specific Review Guidelines

##### Unit Tests
- [ ] Tests focus on behavior, not implementation
- [ ] External dependencies are properly mocked
- [ ] Test data is generated using factories
- [ ] Multiple scenarios are tested (happy path, edge cases, errors)

##### Integration Tests
- [ ] Component interactions are tested
- [ ] Database operations are validated
- [ ] API endpoints are tested with contracts
- [ ] Error flows are end-to-end tested

##### Accessibility Tests
- [ ] Components use semantic queries
- [ ] Accessibility violations are fixed
- [ ] Screen reader compatibility is considered
- [ ] Keyboard navigation is tested

##### Performance Tests
- [ ] Critical paths have performance tests
- [ ] Regression thresholds are defined
- [ ] Memory usage is considered
- [ ] Database query efficiency is validated

### Testing Resources for Contributors

#### Documentation
- **[Testing Documentation Index](../testing/00_INDEX.md)** - Complete testing guide
- **[Testing Patterns](../testing/30_TEST_PATTERNS.md)** - Best practices and patterns
- **[Onboarding Guide](../testing/80_ONBOARDING_GUIDE.md)** - Structured learning path
- **[Workshop Materials](../testing/90_WORKSHOP_MATERIALS.md)** - Training resources

#### Quick Reference
```bash
# Essential testing commands
npm run test                    # Run all tests
npm run test:watch             # Watch mode
npm run test:coverage          # Coverage report
npm run test:accessibility     # Accessibility tests
npm run test:security          # Security tests
npm run test:check-focused     # Block focused tests
npm run test:metrics           # Extract test metrics
npm run test:flaky-detect      # Detect flaky tests
```

#### Common Testing Patterns
```typescript
// Example: Sociable testing pattern
describe('Photo Storage', () => {
  it('should save photo with metadata', async () => {
    const storage = createPhotoStorage();
    const photo = createTestPhoto();
    
    await storage.save(photo);
    
    const retrieved = await storage.get(photo.id);
    expect(retrieved).toEqual(photo);
  });
});

// Example: Accessibility-first testing
describe('PhotoGrid Component', () => {
  it('should display photos with proper accessibility', async () => {
    const photos = createTestPhotos(5);
    
    render(<PhotoGrid photos={photos} />);
    
    // Use semantic queries instead of test IDs
    const grid = screen.getByRole('grid');
    const items = screen.getAllByRole('img');
    
    expect(grid).toBeInTheDocument();
    expect(items).toHaveLength(5);
  });
});
```

### 1. Create an Issue
- Search existing issues first
- Use appropriate issue templates
- Provide detailed description
- Include reproduction steps for bugs

### 2. Create a Branch
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Or bug fix branch
git checkout -b fix/issue-number-description
```

### 3. Make Changes
- Follow coding standards
- Add tests for new functionality
- Update documentation
- Ensure 100% test coverage

### 4. Quality Checks
```bash
# Run all quality checks
npm run security:check
npm run lint
npm run check:types
npm run test
npm run format
```

### 5. Commit Changes
```bash
# Stage changes
git add .

# Commit with conventional message
git commit -m "feat: add photo metadata editor"

# Push to fork
git push origin feature/your-feature-name
```

### 6. Create Pull Request
- Use descriptive title
- Link to relevant issues
- Include screenshots for UI changes
- Ensure CI/CD passes

## 📝 Commit Message Standards

We use [Conventional Commits](https://www.conventionalcommits.org/) format:

### Format
```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `security`: Security-related changes

### Examples
```bash
feat(auth): add biometric authentication
fix(photo): resolve image upload timeout
docs(api): update authentication endpoints
test(albums): add integration tests for album creation
security(upload): validate file types server-side
```

## 🧪 Testing Requirements

### Test Coverage
- **100% coverage required** for new code
- All tests must pass
- Include unit tests for logic
- Include integration tests for APIs
- Include E2E tests for user flows

### Test Structure
```typescript
// Example test structure
describe('Photo Management', () => {
  describe('addPhoto', () => {
    it('should add photo with valid data', async () => {
      // Test implementation
    });
    
    it('should reject photo with invalid URI', async () => {
      // Test implementation
    });
  });
});
```

### Running Tests
```bash
# Run all tests
npm run test

# Run in watch mode
npm run test:watch

# Run coverage report
npm run test:coverage

# Run specific test file
npm run test PhotoGrid.test.tsx
```

## 🔒 Security Requirements

### Security Review
- All security changes require review
- Follow secure coding standards
- Update threat models if needed
- Add security tests for vulnerabilities

### Security Checklist
- [ ] No hardcoded secrets
- [ ] Input validation implemented
- [ ] Output encoding applied
- [ ] Authentication/authorization correct
- [ ] Error messages don't leak information
- [ ] Dependencies are secure

### Security Testing
```bash
# Run security tests
npm run security:check

# Run penetration tests
./scripts/pen-test.sh

# Audit dependencies
npm run security:audit
```

## 📏 Code Style & Standards

### TypeScript Standards
- Use strict TypeScript mode
- Provide explicit types
- Avoid `any` type
- Use interfaces for objects
- Document complex types

### React Native Standards
- Use functional components with hooks
- Follow React best practices
- Use TypeScript for props
- Implement proper error boundaries
- Optimize performance with useMemo/useCallback

### Node.js Standards
- Use async/await instead of callbacks
- Implement proper error handling
- Use environment variables for config
- Follow REST API conventions
- Implement proper logging

### Code Formatting
```bash
# Format code
npm run format

# Check formatting
npm run check:format

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📖 Documentation Standards

### Code Documentation
- Use JSDoc for functions
- Document complex algorithms
- Explain business logic
- Include usage examples

### README Updates
- Update relevant README files
- Document new features
- Update API documentation
- Add configuration examples

### Architecture Documentation
- Update ADRs for architectural changes
- Update diagrams if needed
- Document security implications
- Update deployment guides

## 🐛 Bug Reports

### Bug Report Template
```markdown
## Bug Description
Brief description of the bug

## Steps to Reproduce
1. Go to...
2. Click on...
3. See error

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [e.g., iOS 15.0, Android 12]
- App Version: [e.g., 1.0.0]
- Device: [e.g., iPhone 13, Pixel 6]

## Additional Context
Screenshots, logs, etc.
```

### Security Vulnerability Reports
**Do not open public issues for security vulnerabilities!**

- Report via [GitHub Security Advisories](https://github.com/TrevorPLam/cloud-gallery/security/advisories)
- Email: security@cloudgallery.com
- Include detailed reproduction steps
- Provide impact assessment

## 🚀 Feature Requests

### Feature Request Template
```markdown
## Feature Description
Clear description of the feature

## Problem Statement
What problem does this solve?

## Proposed Solution
How should this work?

## Alternatives Considered
Other approaches considered

## Additional Context
Mockups, examples, etc.
```

## 📊 Pull Request Guidelines

### PR Requirements
- [ ] Tests pass (100% coverage)
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] Security review passed (if applicable)
- [ ] Performance impact considered
- [ ] Breaking changes documented

### PR Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new security vulnerabilities
- [ ] Performance impact considered

## Issues Resolved
Closes #issue-number
```

## 🏷️ Issue Labels

### Type Labels
- `bug` - Bug reports
- `feature` - Feature requests
- `enhancement` - Improvements
- `documentation` - Documentation issues
- `security` - Security issues
- `performance` - Performance issues

### Priority Labels
- `critical` - Critical issues
- `high` - High priority
- `medium` - Medium priority
- `low` - Low priority

### Status Labels
- `help wanted` - Community help needed
- `good first issue` - Good for newcomers
- `wontfix` - Won't be fixed
- `duplicate` - Duplicate issue

## 🎖️ Recognition

### Contributor Recognition
- Contributors listed in README
- Special thanks in release notes
- Contributor badges on GitHub
- Annual contributor awards

### Ways to Contribute
- Code contributions
- Bug reports
- Feature suggestions
- Documentation improvements
- Security vulnerability reports
- Community support
- Translation help

## 🤝 Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Welcome newcomers
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

### Communication Channels
- [GitHub Issues](https://github.com/TrevorPLam/cloud-gallery/issues) - Bug reports and feature requests
- [GitHub Discussions](https://github.com/TrevorPLam/cloud-gallery/discussions) - General discussions
- [Discord Server](https://discord.gg/cloudgallery) - Real-time chat (if available)

### Getting Help
- Check existing issues and documentation
- Ask questions in GitHub Discussions
- Join our Discord server
- Contact maintainers directly for urgent issues

## 📚 Resources

### Development Resources
- [React Native Documentation](https://reactnative.dev/)
- [Expo Documentation](https://docs.expo.dev/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

### Security Resources
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/)
- [Security Testing Guide](https://owasp.org/www-project-security-testing-guide/)

### Design Resources
- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design](https://material.io/design/)
- [Expo Design Guidelines](./docs/design_guidelines.md)

## 🔗 Related Links

- **[Main README](./README.md)** - Project overview
- **[Architecture Documentation](./docs/architecture/00_INDEX.md)** - System design
- **[Security Program](./docs/security/README.md)** - Security documentation
- **[API Documentation](./docs/api/00_INDEX.md)** - API reference

---

<div align="center">

**Thank you for contributing to Cloud Gallery! 🎉**

[![GitHub contributors](https://contrib.rocks/image?repo=TrevorPLam/cloud-gallery)](https://github.com/TrevorPLam/cloud-gallery/graphs/contributors)

Made with ❤️ by the Cloud Gallery community

</div>
