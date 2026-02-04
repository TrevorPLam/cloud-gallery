# Supply Chain Security

[← Back to Security Index](./00_INDEX.md)

**Purpose**: Protect Cloud Gallery from supply chain attacks through dependency management, vulnerability scanning, and software composition security. Establishes policies for secure dependency lifecycle management.

**Last Updated**: 2026-02-04  
**Next Review**: Quarterly (with dependency updates)

## Table of Contents
- [Dependency Inventory](#dependency-inventory)
- [Dependency Security](#dependency-security)
- [Vulnerability Scanning](#vulnerability-scanning)
- [License Policy](#license-policy)
- [Dependency Hygiene](#dependency-hygiene)
- [Transitive Dependencies](#transitive-dependencies)
- [Package Integrity](#package-integrity)
- [Private Registry](#private-registry)
- [Dependency Pinning Strategy](#dependency-pinning-strategy)
- [Update Policy](#update-policy)

---

## Dependency Inventory

### Current Dependencies (38 production)

**Evidence**: [package.json](../../package.json)

#### Core Framework Dependencies
- `expo@^54.0.23` - Mobile framework (React Native)
- `react@19.1.0` - Core UI library (EXACT version)
- `react-native@0.81.5` - Native platform
- `react-dom@19.1.0` - Web rendering
- `express@^5.0.1` - HTTP server framework

#### Security-Critical Dependencies
- `zod@^3.24.2` - Input validation (prevents injection)
- `pg@^8.16.3` - PostgreSQL client (SQL parameterization)
- `drizzle-orm@^0.39.3` - Type-safe ORM layer
- `ws@^8.18.0` - WebSocket server

#### Navigation & UI (17 packages)
- `@react-navigation/*` family (4 packages)
- `expo-*` ecosystem (20+ packages for images, storage, permissions)
- `@shopify/flash-list@^2.2.1` - Performant list rendering
- `@tanstack/react-query@^5.90.7` - Data fetching

### Development Dependencies (18)
- `typescript@~5.9.2` - Type safety
- `eslint@^9.25.0` - Linting
- `vitest@^3.0.5` - Testing framework
- `prettier@3.6.2` - Code formatting (EXACT version)
- `drizzle-kit@^0.31.4` - Database migrations

### Lockfile Configuration
**Evidence**: [package-lock.json:3](../../package-lock.json)
```json
"lockfileVersion": 3
```
✅ **Status**: npm lockfile v3 in use (integrity hashes enforced)

---

## Dependency Security

### npm Configuration

#### Lockfile Enforcement (CRITICAL)
```bash
# Current setup
npm ci  # Used in CI (enforces package-lock.json)
```
**Evidence**: [.github/workflows/test-coverage.yml:28](../../.github/workflows/test-coverage.yml)

**⚠️ GAP**: No local enforcement against `npm install` (can modify lockfile)

**RECOMMENDATION**:
```bash
# Add to .npmrc (prevents accidental lockfile changes)
echo "package-lock=true" >> .npmrc
echo "save-exact=false" >> .npmrc  # Allow ^ ranges by default

# Add npm script to validate lockfile
npm run lockfile:check
```

Add to `package.json`:
```json
"scripts": {
  "lockfile:check": "npm ls --depth=0 && git diff --exit-code package-lock.json"
}
```

#### Integrity Verification
npm automatically verifies SHA-512 integrity hashes from `package-lock.json` during `npm ci`.

**Command**:
```bash
npm ci --audit  # Install with integrity check + audit
```

### Dependency Allowlisting

**Current State**: No allowlist policy exists.

**RECOMMENDATION**: Define approved package scopes:
```json
{
  "allowedScopes": [
    "@expo/*", "@react-navigation/*", "@tanstack/*",
    "@types/*", "@vitest/*", "@testing-library/*"
  ],
  "blockedPackages": [
    "moment",  // Use native Date or date-fns instead
    "request", // Deprecated, use axios/fetch
    "lodash"   // Prefer native JS or lodash-es
  ]
}
```

---

## Vulnerability Scanning

### npm Audit (Built-in)

**Command**:
```bash
npm audit
```

**Current CI Integration**: ⚠️ Not present in CI workflow

**RECOMMENDATION**: Add to `.github/workflows/test-coverage.yml`:
```yaml
- name: Audit dependencies
  run: |
    npm audit --audit-level=moderate
    npm audit --audit-level=critical --production
```

**Severity Levels**:
- `critical`: Block CI/CD (build fails)
- `high`: Block production deployments
- `moderate`: Warning, requires review within 30 days
- `low`: Informational

**Fix Process**:
```bash
npm audit fix              # Auto-fix compatible updates
npm audit fix --force      # Breaking changes (test required)
npm audit --json > audit.json  # Export for tracking
```

### GitHub Dependabot

**Current State**: Enabled by default for GitHub repos.

**Configuration**: Add `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "09:00"
      timezone: "America/New_York"
    open-pull-requests-limit: 10
    reviewers:
      - "cloud-gallery-security-team"
    labels:
      - "dependencies"
      - "security"
    commit-message:
      prefix: "chore(deps)"
    
    # Security updates only (disable feature updates)
    # open-pull-requests-limit: 5
    
    # Group non-security updates
    groups:
      dev-dependencies:
        patterns:
          - "@types/*"
          - "eslint*"
          - "prettier"
          - "vitest"
        update-types:
          - "minor"
          - "patch"
      
      expo-ecosystem:
        patterns:
          - "expo*"
          - "@expo/*"
        update-types:
          - "patch"

    # Ignore specific dependencies (if needed)
    ignore:
      - dependency-name: "react"
        update-types: ["version-update:semver-major"]
      - dependency-name: "react-native"
        update-types: ["version-update:semver-major"]
```

**Auto-merge Strategy**:
```yaml
# .github/workflows/dependabot-auto-merge.yml
name: Dependabot Auto-merge
on: pull_request

permissions:
  contents: write
  pull-requests: write

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: github.actor == 'dependabot[bot]'
    steps:
      - name: Dependabot metadata
        id: metadata
        uses: dependabot/fetch-metadata@v2
        with:
          github-token: "${{ secrets.GITHUB_TOKEN }}"
      
      - name: Enable auto-merge for patch updates
        if: steps.metadata.outputs.update-type == 'version-update:semver-patch'
        run: gh pr merge --auto --squash "$PR_URL"
        env:
          PR_URL: ${{github.event.pull_request.html_url}}
          GITHUB_TOKEN: ${{secrets.GITHUB_TOKEN}}
```

### Snyk (Optional Third-Party)

**Setup**:
```bash
npm install -g snyk
snyk auth
snyk test  # Scan for vulnerabilities
snyk monitor  # Continuous monitoring
```

**CI Integration**:
```yaml
- name: Snyk Security Scan
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
  with:
    args: --severity-threshold=high --fail-on=all
```

**Alternatives**:
- **Snyk Open Source**: Free for open-source projects
- **Socket.dev**: Detects supply chain attacks, typosquatting
- **Mend (WhiteSource)**: Enterprise dependency management
- **GitHub Advanced Security**: Code scanning + secret scanning

---

## License Policy

### License Compliance

**Current State**: No automated license scanning.

**Audit Current Licenses**:
```bash
npm install -g license-checker
license-checker --summary
license-checker --json > licenses.json
```

### Approved Licenses (Permissive)
✅ **Allowed**:
- MIT
- Apache-2.0
- BSD-2-Clause, BSD-3-Clause
- ISC
- CC0-1.0 (Public Domain)
- 0BSD

⚠️ **Review Required** (Copyleft):
- GPL-2.0, GPL-3.0 (requires source distribution)
- AGPL-3.0 (network copyleft)
- LGPL (dynamic linking exception)
- MPL-2.0 (file-level copyleft)

❌ **Prohibited**:
- Unlicensed / proprietary
- JSON license (legal ambiguity)
- Creative Commons with NonCommercial (CC BY-NC)

### License Scanning in CI

**Add to CI workflow**:
```bash
npm install --save-dev license-checker

# package.json
"scripts": {
  "license:check": "license-checker --failOn 'GPL;AGPL;LGPL;UNLICENSED'"
}
```

```yaml
- name: Check licenses
  run: npm run license:check
```

### Third-Party Notice Generation
```bash
# Generate THIRD_PARTY_NOTICES.txt
license-checker --production --out THIRD_PARTY_NOTICES.txt
```

---

## Dependency Hygiene

### Unmaintained Package Detection

**Check last publish date**:
```bash
npm view <package-name> time
npm outdated
```

**⚠️ WARNING SIGNS**:
- Last update > 2 years ago
- GitHub repo archived
- Multiple unpatched CVEs
- Major version behind ecosystem (e.g., React 16 when 19 is current)

**Current High-Risk Dependencies**: None identified (most are actively maintained Expo/React ecosystem)

### High-Risk Indicators

**Red Flags**:
1. **Typosquatting**: Similar names to popular packages
   - Check: `npms.io` reputation score
   - Verify: Publisher identity on npm

2. **Minimal Downloads**: <1000 weekly downloads (for new deps)

3. **No Repository Link**: Package without GitHub/GitLab URL

4. **Obfuscated Code**: Minified source without readable version

5. **Suspicious Install Scripts**: `preinstall`, `postinstall` with network calls

**Review Process**:
```bash
# Before adding new dependency
npm view <package-name> repository homepage
npm view <package-name> maintainers
npm view <package-name> dist-tags
npx @socketdev/cli audit <package-name>  # Socket.dev CLI
```

### Dependency Count Management

**Current Status**:
- Production: 38 dependencies
- Development: 18 dependencies
- Total: 56 direct dependencies

**Target**: Keep production dependencies < 50 (currently compliant)

**Audit Command**:
```bash
npm ls --depth=0 --prod  # Production only
npm ls --depth=0 --dev   # Dev only
```

---

## Transitive Dependencies

### Dependency Tree Analysis

**Current Depth**:
```bash
npm ls --depth=5  # View full tree
npm ls --depth=0  # Direct dependencies only
```

**⚠️ RISK**: Transitive dependencies can introduce vulnerabilities without direct visibility.

**Example**: `express@5.0.1` → `body-parser` → `iconv-lite` (3 levels deep)

### Transitive Vulnerability Management

**Scan Transitive Deps**:
```bash
npm audit --production  # Includes all transitive
npm ls <vulnerable-package>  # Find dependency path
```

**Mitigation**:
```bash
# If direct dependency won't update, override transitive
npm install --save-exact <vulnerable-package>@<patched-version>

# Or use npm overrides (package.json)
{
  "overrides": {
    "minimist": "^1.2.6",  # Force all transitive to use this version
    "express": {
      "iconv-lite": "^0.6.3"  # Force express's transitive only
    }
  }
}
```

### Pruning Unnecessary Transitive Deps
```bash
npm dedupe  # Remove duplicate transitive deps
npm prune   # Remove extraneous packages
```

---

## Package Integrity

### Subresource Integrity (SRI)

npm lockfile provides SHA-512 hashes for integrity verification.

**Verification**:
```bash
npm ci --integrity  # Default behavior, checks hashes
```

**Lockfile Hash Example**:
```json
{
  "integrity": "sha512-abc123...",
  "resolved": "https://registry.npmjs.org/package/-/package-1.0.0.tgz"
}
```

### Package Signing (Future)

npm supports package provenance (experimental):
```bash
npm publish --provenance  # Generate SLSA provenance
```

**Verification**:
```bash
npm audit signatures  # Verify npm signatures (npm 9.5+)
```

### Registry Source Verification

**Current Registry**: https://registry.npmjs.org (default)

**Security**:
- ✅ HTTPS enforced
- ✅ Two-factor auth for publishers
- ⚠️ No mandatory package signing

**Verification**:
```bash
npm config get registry  # Should be https://registry.npmjs.org/
```

---

## Private Registry

### Self-Hosted Options

**If Cloud Gallery needs private packages**:

1. **Verdaccio** (Open Source)
   ```bash
   npm install -g verdaccio
   verdaccio  # Starts on http://localhost:4873
   ```

2. **GitHub Packages** (Integrated with GitHub)
   ```bash
   npm login --registry=https://npm.pkg.github.com
   
   # .npmrc
   @cloud-gallery:registry=https://npm.pkg.github.com
   ```

3. **npm Enterprise** (Paid)

### Mixed Registry Configuration

**Example `.npmrc`**:
```ini
# Public packages from npm
registry=https://registry.npmjs.org/

# Private packages from GitHub
@cloud-gallery:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

### Registry Security

**⚠️ NEVER commit .npmrc with tokens**:
```bash
# .gitignore
.npmrc
npm-debug.log
```

**Use environment variables**:
```bash
NPM_TOKEN=xxx npm ci  # In CI
```

---

## Dependency Pinning Strategy

### Current Strategy

**Evidence**: [package.json](../../package.json)

**Semver Ranges Used**:
- `^X.Y.Z` (caret): Allow minor/patch updates (most deps)
- `~X.Y.Z` (tilde): Allow patch updates only (expo-* packages)
- `X.Y.Z` (exact): No updates (react@19.1.0, prettier@3.6.2)

**Example**:
```json
{
  "react": "19.1.0",              // Exact (major breaking changes)
  "react-native": "0.81.5",       // Exact (platform stability)
  "expo": "^54.0.23",             // Caret (minor updates OK)
  "expo-constants": "~18.0.9",    // Tilde (patch only)
  "prettier": "3.6.2"             // Exact (formatting consistency)
}
```

### Recommended Strategy by Dependency Type

| Type | Strategy | Reason |
|------|----------|--------|
| Core framework (React, RN) | Exact | Breaking changes, ecosystem compatibility |
| Security libs (zod, pg) | Caret `^` | Get security patches automatically |
| Build tools (TypeScript, ESLint) | Tilde `~` | Avoid breaking config changes |
| Formatting (Prettier) | Exact | Avoid spurious diffs |
| Testing (Vitest) | Caret `^` | Get bug fixes |
| Expo ecosystem | Tilde `~` | Coordinated releases |

### Pinning Commands
```bash
npm install --save-exact <package>@<version>  # Pin production
npm install --save-dev --save-exact <package>@<version>  # Pin dev
```

### Lockfile Pinning

**⚠️ CRITICAL**: Always commit `package-lock.json` to git.

```bash
# Verify lockfile is tracked
git ls-files package-lock.json

# If not tracked (BAD STATE):
git add package-lock.json
git commit -m "chore: add package-lock.json for dependency pinning"
```

---

## Update Policy

### Update Cadence

| Priority | Frequency | Trigger |
|----------|-----------|---------|
| **Critical CVE** | Immediate (<24h) | npm audit shows critical |
| **High CVE** | Within 7 days | npm audit shows high |
| **Security patch** | Within 30 days | Dependabot PR |
| **Minor updates** | Monthly | Scheduled maintenance |
| **Major updates** | Quarterly | Planned migration |

### Update Process

#### 1. Security Updates (Automated)
```bash
npm audit fix  # Auto-apply compatible security fixes
npm test       # Verify no breakage
git commit -m "chore(deps): security updates"
```

#### 2. Dependency Updates (Manual Review)
```bash
npm outdated  # Show available updates
npm update    # Update within semver ranges
npm test && npm run lint && npm run check:types
```

#### 3. Major Version Updates (Breaking)
```bash
npm install <package>@latest
# Review CHANGELOG.md
# Update code for breaking changes
npm test
# Update documentation if API changed
```

### Update Testing Requirements

**Before merging dependency updates**:
1. ✅ `npm run lint` passes
2. ✅ `npm run check:types` passes (TypeScript)
3. ✅ `npm run test` passes (unit tests)
4. ✅ `npm run test:coverage` meets threshold
5. ✅ Manual smoke test on iOS/Android (for mobile deps)
6. ✅ Check bundle size impact (for frontend deps)

**Command**:
```bash
npm run lint && npm run check:types && npm run test:coverage
```
**Evidence**: CI enforces these checks ([test-coverage.yml:30-37](../../.github/workflows/test-coverage.yml))

### SLA (Service Level Agreement)

**Commitment**:
- Critical vulnerabilities: Patch within 24 hours
- High vulnerabilities: Patch within 7 days
- Moderate vulnerabilities: Patch within 30 days
- Low vulnerabilities: Next quarterly update

**Exemptions**:
- No patch available: Document risk acceptance
- Patch causes breaking changes: Plan migration, apply workaround

### Update Rollback
```bash
npm install <package>@<previous-version>
npm ci  # Restore from lockfile
git checkout HEAD~1 -- package.json package-lock.json
```

### Monitoring
```bash
# Weekly automated check
npm outdated --json > outdated.json
npm audit --json > audit.json

# Track in issue tracker
gh issue create --title "Weekly Dependency Review" --body "$(npm outdated)"
```

---

## Implementation Checklist

- [ ] **Immediate** (Sprint 1):
  - [ ] Add `npm audit` to CI pipeline (blocking on critical/high)
  - [ ] Configure Dependabot with `.github/dependabot.yml`
  - [ ] Verify `package-lock.json` is committed and enforced
  - [ ] Run `npm audit` and fix existing vulnerabilities
  
- [ ] **Short-term** (Sprint 2-3):
  - [ ] Add license checking script (`license:check`)
  - [ ] Document approved/blocked licenses
  - [ ] Add `lockfile:check` npm script
  - [ ] Create `.npmrc` with `package-lock=true`
  
- [ ] **Medium-term** (Month 2-3):
  - [ ] Implement Dependabot auto-merge for patches
  - [ ] Add Snyk or Socket.dev scanning
  - [ ] Generate `THIRD_PARTY_NOTICES.txt`
  - [ ] Audit transitive dependencies depth
  
- [ ] **Long-term** (Quarterly):
  - [ ] Review and update pinning strategy
  - [ ] Audit unmaintained dependencies
  - [ ] Major version update planning
  - [ ] Supply chain security training for team

---

## Related Documents
- [SBOM and Provenance](./21_SBOM_AND_PROVENANCE.md)
- [CI/CD Hardening](./30_CICD_HARDENING.md)
- [Threat Model](./10_THREAT_MODEL.md)

---

**Maintained by**: Security Team  
**Review Cycle**: Quarterly + on major dependency changes  
**Escalation**: Critical CVEs → CTO within 1 hour
