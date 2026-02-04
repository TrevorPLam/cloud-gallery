# CI/CD Pipeline Hardening

[← Back to Security Index](./00_INDEX.md)

**Purpose**: Secure the Cloud Gallery CI/CD pipeline against attacks, prevent vulnerable code from reaching production, and establish mandatory security gates. Implements defense-in-depth for the software delivery lifecycle.

**Last Updated**: 2026-02-04  
**Next Review**: Monthly or on pipeline changes

## Table of Contents
- [Current CI Setup](#current-ci-setup)
- [Threat Model for CI/CD](#threat-model-for-cicd)
- [Least Privilege](#least-privilege)
- [Secret Protection](#secret-protection)
- [Security Gates](#security-gates)
- [Blocking Policies](#blocking-policies)
- [Branch Protection](#branch-protection)
- [Code Review Requirements](#code-review-requirements)
- [Signed Commits](#signed-commits)
- [Deployment Security](#deployment-security)
- [Audit and Monitoring](#audit-and-monitoring)

---

## Current CI Setup

### Workflow Analysis

**File**: [.github/workflows/test-coverage.yml](../../.github/workflows/test-coverage.yml)

**Triggers**:
```yaml
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]
```
**Evidence**: Lines 4-7

**Jobs**: 1 job (`test`) with matrix strategy

**Runner**: `ubuntu-latest` (GitHub-hosted)
**Evidence**: Line 11

**Node.js Versions**: 18.x, 20.x
**Evidence**: Lines 14-15

### Current Security Controls

✅ **Implemented**:
- **Dependency Pinning**: Uses `npm ci` (enforces lockfile)
  - **Evidence**: Line 28
- **Linting**: `npm run lint`
  - **Evidence**: Line 31
- **Type Checking**: `npm run check:types` (TypeScript)
  - **Evidence**: Line 34
- **Testing**: `npm run test:coverage`
  - **Evidence**: Line 37
- **Code Coverage**: Uploads to Codecov, comments on PRs
  - **Evidence**: Lines 39-98
- **Artifact Retention**: Coverage reports stored 30 days
  - **Evidence**: Line 52

⚠️ **Missing**:
- SAST (Static Application Security Testing)
- Dependency vulnerability scanning (`npm audit`)
- Secret scanning (beyond GitHub's automatic scanning)
- Container scanning (N/A - not containerized)
- SBOM generation
- Security policy enforcement (blocking on critical vulns)

### Workflow Permissions

**Current**: ⚠️ No explicit permissions defined (defaults to permissive)

**GitHub Default Permissions**:
```yaml
# Implicit (current state)
permissions: write-all  # ⚠️ Overly broad
```

**Should Be**:
```yaml
# Explicit least privilege
permissions:
  contents: read        # Read source code
  pull-requests: write  # Comment on PRs
  checks: write         # Update check status
```

---

## Threat Model for CI/CD

### Attack Vectors

**1. Malicious Pull Request**
- **Threat**: Attacker submits PR with malicious code or exfiltrates secrets
- **Impact**: Code execution in CI, secret leakage, supply chain compromise
- **Mitigation**: Fork PR isolation, secret protection, code review

**2. Compromised Dependency**
- **Threat**: npm package introduces vulnerability or backdoor
- **Impact**: Malicious code in production build
- **Mitigation**: Dependency scanning, lockfile enforcement, SBOM

**3. Build System Compromise**
- **Threat**: Attacker gains access to GitHub Actions runner or secrets
- **Impact**: Inject malicious code, steal credentials, tamper with artifacts
- **Mitigation**: Least privilege, audit logs, ephemeral runners

**4. Branch Protection Bypass**
- **Threat**: Force push to `main` without review, disable required checks
- **Impact**: Unreviewed or vulnerable code deployed
- **Mitigation**: Branch protection rules, admin enforcement

**5. Insider Threat**
- **Threat**: Malicious maintainer commits vulnerable code or disables security
- **Impact**: Backdoor, data breach, supply chain attack
- **Mitigation**: Multi-party review, audit logs, secrets rotation

### STRIDE Analysis

| Threat | Example | Control |
|--------|---------|---------|
| **Spoofing** | Attacker impersonates maintainer | Signed commits, 2FA |
| **Tampering** | Modify code in CI without detection | Provenance, artifact signing |
| **Repudiation** | Maintainer denies making malicious commit | Git audit log, signed commits |
| **Information Disclosure** | Secrets logged in CI output | Secret masking, env vars |
| **Denial of Service** | CI bombing (excessive runs) | Rate limits, cost controls |
| **Elevation of Privilege** | PR from fork gains write access to secrets | Fork protection, permissions |

---

## Least Privilege

### Workflow Permissions (CRITICAL)

**Add to ALL workflows**:
```yaml
# .github/workflows/test-coverage.yml
name: Test Coverage

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

permissions:
  contents: read        # Read repository code
  pull-requests: write  # Comment coverage on PRs
  checks: write         # Update check run status

jobs:
  test:
    runs-on: ubuntu-latest
    # ... rest of workflow
```

**Explanation**:
- `contents: read` - Only needs to checkout code, not write
- `pull-requests: write` - Allows commenting coverage reports (line 54-98)
- `checks: write` - Updates CI status checks
- ❌ Removed: `actions: write`, `deployments: write`, `packages: write`

### Action Pinning

**⚠️ CURRENT ISSUE**: Actions use mutable tags (e.g., `@v4`)

**Evidence**:
```yaml
uses: actions/checkout@v4        # Line 19
uses: actions/setup-node@v4      # Line 22
uses: codecov/codecov-action@v4  # Line 40
uses: actions/upload-artifact@v4 # Line 48
uses: actions/github-script@v7   # Line 56
```

**RECOMMENDATION**: Pin to immutable SHA256 digests
```yaml
# BEFORE (mutable)
uses: actions/checkout@v4

# AFTER (immutable)
uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
```

**Why?**: Prevents supply chain attack if action maintainer is compromised.

**Automated Pinning**:
```bash
# Install Dependabot for GitHub Actions
# Add to .github/dependabot.yml:

version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "chore(ci)"
```

### Runner Security

**Current**: `ubuntu-latest` (GitHub-hosted)
**Evidence**: Line 11

**Security Benefits**:
- ✅ Ephemeral runners (destroyed after job)
- ✅ Isolated from each other
- ✅ Maintained by GitHub (patched regularly)

**Self-Hosted Runners** (if using):
- ⚠️ **DON'T use for public repos** (PRs can execute arbitrary code)
- ⚠️ Persistent disk (secrets may persist)
- ⚠️ Requires hardening (OS patches, firewall, auditing)

---

## Secret Protection

### Secret Management

**Current Secrets** (inferred):
- `CODECOV_TOKEN` (used in line 40-45, though not explicitly shown)
- Likely: Database credentials, API keys (for future features)

### GitHub Secrets Best Practices

**1. Never Log Secrets**:
```yaml
# ❌ BAD
- name: Deploy
  run: |
    echo "API_KEY=${{ secrets.API_KEY }}"  # LEAKED IN LOGS

# ✅ GOOD
- name: Deploy
  run: deploy.sh
  env:
    API_KEY: ${{ secrets.API_KEY }}  # Automatically masked
```

**2. Environment-Specific Secrets**:
```yaml
# Use GitHub Environments for prod vs staging
jobs:
  deploy:
    environment: production  # Requires approval + environment secrets
    steps:
      - run: deploy.sh
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}  # From 'production' environment
```

**3. Secret Rotation**:
- Rotate credentials quarterly
- Rotate immediately if leaked or suspected compromise
- Use short-lived tokens (OIDC) instead of long-lived secrets

### Fork Pull Request Protection

**⚠️ CRITICAL ISSUE**: PRs from forks MUST NOT have access to secrets.

**Current State**: Workflow runs on `pull_request` trigger (safe by default)

**Safe Triggers**:
```yaml
on:
  pull_request:  # ✅ Secrets NOT available to forks
  pull_request_target:  # ⚠️ Secrets available, use with caution
```

**NEVER DO THIS**:
```yaml
# ❌ DANGEROUS
on:
  pull_request_target:  # Runs with write permissions + secrets from fork PR

jobs:
  test:
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}  # Checks out fork code
      - run: npm install && npm test  # Fork code can access secrets!
```

**Safe Alternative**:
```yaml
# ✅ SAFE
on:
  pull_request:  # Secrets not available to forks

jobs:
  test:
    steps:
      - uses: actions/checkout@v4  # Checks out PR merge commit
      - run: npm ci && npm test  # No secrets exposed
  
  # Separate job for trusted operations
  comment-coverage:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
    steps:
      - uses: actions/github-script@v7  # Can comment on PR, no fork code execution
        with:
          script: |
            // Read coverage from artifact, comment on PR
```

### Secret Scanning

**GitHub Advanced Security** (free for public repos):
- Automatically scans commits for leaked secrets
- Alerts on push of AWS keys, GitHub tokens, etc.

**Enable**:
1. Repository Settings → Code security and analysis
2. Enable "Secret scanning"
3. Enable "Push protection" (blocks commits with secrets)

**Pre-Commit Hook**:
```bash
# Install git-secrets
brew install git-secrets

# Configure
git secrets --install
git secrets --register-aws  # AWS keys
git secrets --add 'ghp_[a-zA-Z0-9]{36}'  # GitHub tokens
git secrets --add 'sk_live_[a-zA-Z0-9]{24}'  # Stripe keys
git secrets --add 'postgres://.*:.*@'  # Database URLs

# Add to package.json
"scripts": {
  "precommit": "git secrets --pre_commit_hook"
}
```

### OIDC Tokens (Recommended)

**Replace long-lived secrets with short-lived OIDC tokens**:

```yaml
# Example: AWS deployment without static credentials
jobs:
  deploy:
    permissions:
      id-token: write  # Required for OIDC
      contents: read
    steps:
      - name: Configure AWS Credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789:role/GitHubActions
          aws-region: us-east-1
      
      - name: Deploy
        run: aws s3 sync dist/ s3://my-bucket/
```

**Benefits**:
- No static credentials in GitHub Secrets
- Tokens expire after job (15 minutes)
- Traceable to specific workflow/commit

---

## Security Gates

### Mandatory Checks

**Add to test-coverage.yml** (expand current workflow):

#### 1. Linting (Already Implemented ✅)
```yaml
- name: Run linter
  run: npm run lint
```
**Evidence**: Line 30-31

**Script**: [package.json:13](../../package.json)
```json
"lint": "npx expo lint"
```

#### 2. Type Checking (Already Implemented ✅)
```yaml
- name: Type check
  run: npm run check:types
```
**Evidence**: Line 33-34

**Script**: [package.json:15](../../package.json)
```json
"check:types": "tsc --noEmit"
```

#### 3. Unit Tests (Already Implemented ✅)
```yaml
- name: Run tests with coverage
  run: npm run test:coverage
```
**Evidence**: Line 36-37

**Script**: [package.json:20](../../package.json)
```json
"test:coverage": "vitest run --coverage"
```

#### 4. SAST Scanning (⚠️ MISSING)

**Add ESLint Security Plugins**:
```bash
npm install --save-dev eslint-plugin-security
```

**Update `eslint.config.js`**:
```javascript
import security from 'eslint-plugin-security';

export default [
  // ... existing config
  {
    plugins: {
      security
    },
    rules: {
      'security/detect-object-injection': 'error',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'error'
    }
  }
];
```

**Add to CI**:
```yaml
- name: Security Linting (SAST)
  run: npm run lint  # Now includes security rules
```

**Alternative**: Use Semgrep (more comprehensive)
```yaml
- name: Semgrep SAST Scan
  uses: returntocorp/semgrep-action@v1
  with:
    config: >-
      p/security-audit
      p/secrets
      p/owasp-top-ten
```

#### 5. Dependency Scanning (⚠️ MISSING)

**Add to workflow**:
```yaml
- name: Audit dependencies
  run: |
    npm audit --audit-level=moderate
    npm audit --production --audit-level=high
  continue-on-error: false  # Fail build on vulnerabilities
```

**Or use GitHub Dependency Review**:
```yaml
- name: Dependency Review
  uses: actions/dependency-review-action@v4
  with:
    fail-on-severity: moderate
    deny-licenses: GPL-3.0, AGPL-3.0
```

#### 6. Secret Scanning (⚠️ MISSING - Add Pre-Commit)

**Pre-commit hook with TruffleHog**:
```yaml
- name: TruffleHog Secret Scan
  uses: trufflesecurity/trufflehog@main
  with:
    path: ./
    base: ${{ github.event.repository.default_branch }}
    head: HEAD
```

#### 7. Container Scanning (N/A)

**Not applicable**: Cloud Gallery not containerized.
**Evidence**: No Dockerfile in repository.

**If containerizing**:
```yaml
- name: Build container
  run: docker build -t cloud-gallery:${{ github.sha }} .

- name: Scan container with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: cloud-gallery:${{ github.sha }}
    severity: 'CRITICAL,HIGH'
    exit-code: '1'
```

### Complete Hardened Workflow

**Proposed `.github/workflows/security-gates.yml`**:
```yaml
name: Security Gates

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main, develop ]

permissions:
  contents: read
  pull-requests: write
  security-events: write  # For CodeQL/Semgrep

jobs:
  security-checks:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [20.x]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11  # v4.1.1
      
      - name: Setup Node.js
        uses: actions/setup-node@60edb5dd545a775178f52524783378180af0d1f8  # v4.0.2
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --audit
      
      - name: Run linter (includes security rules)
        run: npm run lint
      
      - name: Type check
        run: npm run check:types
      
      - name: Run tests
        run: npm run test:coverage
      
      - name: Dependency vulnerability scan
        run: |
          npm audit --audit-level=high --production
          npm audit --audit-level=critical
      
      - name: Secret scanning
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
      
      - name: SAST with Semgrep
        uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            p/security-audit
            p/owasp-top-ten
            p/typescript
          generateSarif: true
      
      - name: License compliance check
        run: |
          npm install -g license-checker
          license-checker --production --failOn 'GPL;AGPL;UNLICENSED'
      
      - name: Generate SBOM
        run: npx @cyclonedx/cyclonedx-npm --output-file sbom.json
      
      - name: Upload SBOM
        uses: actions/upload-artifact@65462800fd760344b1a7b4382951275a0abb4808  # v4.3.3
        with:
          name: sbom-${{ github.sha }}
          path: sbom.json
      
      - name: Security Gate Summary
        run: |
          echo "## Security Gate Results ✅" >> $GITHUB_STEP_SUMMARY
          echo "- Linting: Passed" >> $GITHUB_STEP_SUMMARY
          echo "- Type Check: Passed" >> $GITHUB_STEP_SUMMARY
          echo "- Tests: Passed" >> $GITHUB_STEP_SUMMARY
          echo "- Dependency Audit: Passed" >> $GITHUB_STEP_SUMMARY
          echo "- Secret Scan: Passed" >> $GITHUB_STEP_SUMMARY
          echo "- SAST: Passed" >> $GITHUB_STEP_SUMMARY
          echo "- License Check: Passed" >> $GITHUB_STEP_SUMMARY
```

---

## Blocking Policies

### Severity Thresholds

**Fail CI/CD on**:
- ❌ **Critical vulnerabilities** (CVSS ≥ 9.0)
- ❌ **High vulnerabilities** (CVSS 7.0-8.9) in production dependencies
- ❌ **Linting errors** (not warnings)
- ❌ **Type errors** (TypeScript strict mode)
- ❌ **Test failures**
- ❌ **Secrets detected** in commits
- ❌ **Prohibited licenses** (GPL, AGPL, unlicensed)

**Warn but Allow** (with review):
- ⚠️ **Moderate vulnerabilities** (CVSS 4.0-6.9)
- ⚠️ **Linting warnings**
- ⚠️ **Coverage decrease** (< threshold)
- ⚠️ **High vulnerabilities** in dev dependencies (non-prod)

**Informational Only**:
- ℹ️ **Low vulnerabilities** (CVSS < 4.0)
- ℹ️ **Outdated dependencies** (non-security)

### Policy Enforcement

**npm audit**:
```bash
# Fail on critical or high in production
npm audit --audit-level=high --production

# Warn on moderate
npm audit --audit-level=moderate || echo "⚠️ Moderate vulnerabilities found"
```

**Dependency Review Action**:
```yaml
- name: Dependency Review
  uses: actions/dependency-review-action@v4
  with:
    fail-on-severity: high  # Block high/critical
    fail-on-scopes: runtime  # Only production deps
    deny-licenses: GPL-3.0, AGPL-3.0, UNLICENSED
    comment-summary-in-pr: always
```

### Exception Process

**If Blocking Policy Prevents Merge**:

1. **Document Exception**:
   ```markdown
   # Security Exception Request
   
   **Vulnerability**: CVE-2024-1234 in `express@5.0.1`
   **Severity**: High (CVSS 7.5)
   **Reason**: No patch available, mitigated by WAF
   **Expiration**: 2026-03-01 (30 days)
   **Approved by**: Security Lead, CTO
   ```

2. **Implement Mitigation**:
   - Add input validation
   - Deploy compensating control (e.g., rate limiting)
   - Document in threat model

3. **Track in Issue**:
   ```bash
   gh issue create --title "Security Exception: CVE-2024-1234" \
     --label security,exception \
     --body "$(cat exception.md)"
   ```

4. **Review Regularly**: Security exceptions expire in 30 days.

---

## Branch Protection

### GitHub Branch Protection Rules

**Configure for `main` and `develop` branches**:

**Settings → Branches → Add branch protection rule**:

✅ **Require pull request reviews before merging**:
- Required approving reviews: **2**
- Dismiss stale reviews when new commits pushed: **Yes**
- Require review from Code Owners: **Yes**
- Restrict who can dismiss reviews: **Maintainers only**

✅ **Require status checks to pass**:
- Require branches to be up to date: **Yes**
- Status checks that are required:
  - `test (18.x)` (current CI)
  - `test (20.x)` (current CI)
  - `security-checks` (proposed new workflow)
  - `dependency-review` (proposed)

✅ **Require conversation resolution before merging**: **Yes**

✅ **Require signed commits**: **Yes** (see below)

✅ **Require linear history**: **Yes** (no merge commits)

✅ **Include administrators**: **Yes** (admins follow same rules)

❌ **Allow force pushes**: **No**

❌ **Allow deletions**: **No**

### CODEOWNERS File

**Create `.github/CODEOWNERS`**:
```
# Global owners (all files)
* @cloud-gallery/maintainers

# Security-sensitive files require security team review
/docs/security/ @cloud-gallery/security-team
/.github/workflows/ @cloud-gallery/security-team @cloud-gallery/devops
/server/ @cloud-gallery/backend-team @cloud-gallery/security-team
/drizzle.config.ts @cloud-gallery/backend-team

# Require maintainer for infrastructure
package.json @cloud-gallery/maintainers
package-lock.json @cloud-gallery/maintainers
tsconfig.json @cloud-gallery/maintainers

# Database migrations require DBA review
/server/db/migrations/ @cloud-gallery/dba-team
```

### Rulesets (New GitHub Feature)

**Alternative to branch protection** (more flexible):

**Settings → Rules → Rulesets → New ruleset**:

**Target**: `main`, `develop`

**Rules**:
- Restrict creations: Tag patterns only
- Restrict updates: No force pushes
- Restrict deletions: Yes
- Require pull request: 2 approvals
- Require status checks: (list all required checks)
- Require code owners review: Yes
- Require workflow approval: For first-time contributors
- Block force pushes: Yes

**Bypass List**: None (not even admins)

---

## Code Review Requirements

### Review Checklist

**Reviewers MUST verify**:

**1. Security**:
- [ ] No hardcoded secrets or credentials
- [ ] User input properly validated (Zod schemas)
- [ ] SQL queries parameterized (Drizzle ORM)
- [ ] Authentication/authorization checks present
- [ ] No sensitive data logged
- [ ] File uploads validated (type, size)

**2. Code Quality**:
- [ ] Linter passes (`npm run lint`)
- [ ] Type checks pass (`npm run check:types`)
- [ ] Tests pass (`npm run test`)
- [ ] Code coverage maintained or improved
- [ ] No commented-out code
- [ ] Functions documented (if complex)

**3. Dependencies**:
- [ ] New dependencies justified
- [ ] Licenses compatible (MIT, Apache, BSD)
- [ ] No known vulnerabilities (`npm audit`)
- [ ] package-lock.json updated (if deps changed)

**4. Testing**:
- [ ] New features have tests
- [ ] Edge cases covered
- [ ] Error handling tested
- [ ] Manual testing performed (if UI changes)

### Automated Review Comments

**Use Danger.js for automated PR checks**:

**Install**:
```bash
npm install --save-dev danger
```

**Create `dangerfile.ts`**:
```typescript
import { danger, warn, fail, message } from 'danger';

// Check for package.json changes without package-lock.json
const packageChanged = danger.git.modified_files.includes('package.json');
const lockfileChanged = danger.git.modified_files.includes('package-lock.json');

if (packageChanged && !lockfileChanged) {
  fail('package.json changed but package-lock.json not updated. Run `npm install`.');
}

// Check for large PRs
const bigPR = danger.github.pr.additions + danger.github.pr.deletions > 500;
if (bigPR) {
  warn('This PR is quite large. Consider breaking it into smaller PRs.');
}

// Check for missing tests
const hasAppChanges = danger.git.modified_files.some(f => f.startsWith('client/') || f.startsWith('server/'));
const hasTestChanges = danger.git.modified_files.some(f => f.includes('.test.'));

if (hasAppChanges && !hasTestChanges) {
  warn('Application code changed but no tests added. Please add tests.');
}

// Check for CHANGELOG update
const changelogChanged = danger.git.modified_files.includes('CHANGELOG.md');
if (!changelogChanged && !danger.github.pr.title.startsWith('chore')) {
  message('Consider updating CHANGELOG.md for this change.');
}

// Check for security-sensitive files
const securityFiles = ['server/index.ts', 'drizzle.config.ts', '.github/workflows/'];
const touchesSecurityFiles = danger.git.modified_files.some(f =>
  securityFiles.some(sf => f.includes(sf))
);

if (touchesSecurityFiles) {
  message('⚠️ This PR modifies security-sensitive files. Extra scrutiny required.');
}
```

**Add to CI**:
```yaml
- name: Run Danger
  run: npx danger ci
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Signed Commits

### GPG Commit Signing

**Why**: Verify commit authenticity, prevent impersonation.

**Setup for Developers**:

**1. Generate GPG Key**:
```bash
gpg --full-generate-key
# Select: RSA and RSA, 4096 bits, key does not expire
# Enter: Name, email (must match GitHub email)
```

**2. Export Public Key**:
```bash
gpg --list-secret-keys --keyid-format=long
# Copy key ID (e.g., 3AA5C34371567BD2)

gpg --armor --export 3AA5C34371567BD2
# Copy entire output including BEGIN/END lines
```

**3. Add to GitHub**:
- Settings → SSH and GPG keys → New GPG key
- Paste public key

**4. Configure Git**:
```bash
git config --global user.signingkey 3AA5C34371567BD2
git config --global commit.gpgsign true
git config --global tag.gpgsign true
```

**5. Sign Commits**:
```bash
git commit -S -m "feat: add photo encryption"
# -S flag (auto-enabled if gpgsign=true)
```

### SSH Commit Signing (Alternative)

**GitHub now supports SSH signing** (simpler than GPG):

**1. Generate SSH Key** (if not exists):
```bash
ssh-keygen -t ed25519 -C "your-email@example.com"
```

**2. Add to GitHub**:
- Settings → SSH and GPG keys → New SSH key
- Key type: **Signing Key**
- Paste `~/.ssh/id_ed25519.pub`

**3. Configure Git**:
```bash
git config --global gpg.format ssh
git config --global user.signingkey ~/.ssh/id_ed25519.pub
git config --global commit.gpgsign true
```

**4. Sign Commits**:
```bash
git commit -m "feat: add feature"  # Automatically signed
```

### Enforce Signed Commits

**Branch Protection**:
- Settings → Branches → `main` → Require signed commits: **Yes**

**Verify in CI**:
```yaml
- name: Verify commit signatures
  run: |
    git verify-commit HEAD || {
      echo "❌ Commit is not signed"
      exit 1
    }
```

### Batch Signing (for existing commits)

**Rebase and sign all commits**:
```bash
# Sign last 5 commits
git rebase --exec 'git commit --amend --no-edit -S' -i HEAD~5

# Force push (only if not merged to main!)
git push --force-with-lease
```

---

## Deployment Security

### Deployment Environments

**Recommended Setup**:

**1. Development** (auto-deploy from `develop` branch):
- No approval required
- Deploys to staging infrastructure
- Test data only

**2. Staging** (auto-deploy from `main` branch):
- Approval from 1 maintainer
- Production-like environment
- Sanitized production data

**3. Production** (manual trigger from `main` tag):
- Approval from 2 maintainers
- Signed release tag required
- Rollback plan documented

### GitHub Environments

**Settings → Environments → New environment**:

**Environment: `production`**:
- **Deployment branches**: `main` only
- **Required reviewers**: 2 maintainers
- **Wait timer**: 5 minutes (cooldown period)
- **Environment secrets**:
  - `DATABASE_URL`
  - `AWS_ACCESS_KEY_ID`
  - `API_SECRET_KEY`

**Workflow Example**:
```yaml
name: Deploy to Production

on:
  release:
    types: [published]

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # Requires approval
    
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.release.tag_name }}
      
      - name: Verify signed tag
        run: git verify-tag ${{ github.event.release.tag_name }}
      
      - name: Build
        run: |
          npm ci
          npm run server:build
      
      - name: Deploy
        run: ./scripts/deploy.sh
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          API_KEY: ${{ secrets.API_KEY }}
      
      - name: Health check
        run: curl -f https://cloud-gallery.com/health || exit 1
      
      - name: Notify team
        if: success()
        run: |
          echo "✅ Deployed ${{ github.event.release.tag_name }} to production"
```

### Deployment Checklist

**Before Production Deploy**:
- [ ] Release tag signed and verified
- [ ] All security gates passed (linting, tests, audits)
- [ ] SBOM generated and attached to release
- [ ] Changelog updated
- [ ] Database migrations tested in staging
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] Team notified (Slack, email)

**After Deployment**:
- [ ] Health check passed (`/health` endpoint)
- [ ] Smoke tests executed
- [ ] Error rates normal (monitor for 30 minutes)
- [ ] Performance metrics acceptable
- [ ] Update status page (if applicable)

### Rollback Process

**Automated Rollback**:
```yaml
- name: Monitor health
  id: health
  run: |
    sleep 60  # Wait 1 minute
    curl -f https://cloud-gallery.com/health || echo "failed=true" >> $GITHUB_OUTPUT

- name: Rollback on failure
  if: steps.health.outputs.failed == 'true'
  run: |
    echo "❌ Health check failed, rolling back"
    ./scripts/rollback.sh ${{ github.event.release.tag_name }}
```

**Manual Rollback**:
```bash
# Redeploy previous version
git tag -l --sort=-v:refname | head -2  # Get last 2 tags
gh release view v1.0.0  # Previous version
./scripts/deploy.sh v1.0.0  # Rollback
```

---

## Audit and Monitoring

### CI/CD Audit Logging

**GitHub Audit Log**:
- Settings → Audit log
- Tracks:
  - Workflow runs
  - Secret access
  - Branch protection changes
  - Repository settings modifications

**Export Audit Log**:
```bash
gh api /orgs/{org}/audit-log --paginate > audit-log.json
```

### Monitoring CI/CD Security

**1. Failed Workflows**:
```bash
# Alert on repeated failures
gh run list --status failure --limit 10
```

**2. Unauthorized Changes**:
- Enable GitHub Advanced Security
- Monitor for:
  - Disabled branch protection
  - New secrets added
  - Workflow file modifications

**3. Secret Access**:
```yaml
# Log when secrets are used
- name: Audit secret usage
  run: |
    echo "Secret accessed at $(date) by workflow ${{ github.workflow }}" >> audit.log
    # Upload to secure logging service
```

**4. Anomalous Activity**:
- Workflow runs at unusual times
- High number of failed builds
- Excessive secret access
- Large number of dependency changes

### Security Metrics

**Track Monthly**:
- Number of vulnerabilities detected vs fixed
- Mean Time to Remediate (MTTR) for critical CVEs
- Percentage of PRs blocked by security gates
- Code review coverage (% PRs with security review)
- Signed commits percentage
- Security gate bypass requests

**Dashboard** (GitHub Insights):
- Settings → Insights → Security
- Shows:
  - Dependency alerts
  - Secret scanning alerts
  - Code scanning alerts (if enabled)

---

## Implementation Roadmap

### Phase 1: Immediate (Week 1)
- [x] Document current CI/CD setup
- [ ] Add explicit `permissions` to test-coverage.yml
- [ ] Enable branch protection on `main` and `develop`
- [ ] Add `npm audit` to CI workflow
- [ ] Configure Dependabot for GitHub Actions

### Phase 2: Short-term (Sprint 1-2)
- [ ] Pin GitHub Actions to SHA digests
- [ ] Add secret scanning (TruffleHog/GitHub)
- [ ] Create CODEOWNERS file
- [ ] Add ESLint security rules
- [ ] Enforce 2 reviewers for `main` merges
- [ ] Document code review checklist

### Phase 3: Medium-term (Month 2-3)
- [ ] Implement signed commits requirement
- [ ] Add SAST scanning (Semgrep/CodeQL)
- [ ] Create security-gates.yml workflow
- [ ] Set up GitHub Environments (staging, prod)
- [ ] Add Danger.js automated PR comments
- [ ] Implement license compliance checking

### Phase 4: Long-term (Quarter 2)
- [ ] Implement SLSA Level 2 (provenance)
- [ ] Add deployment approval workflows
- [ ] Set up CI/CD audit log monitoring
- [ ] Create security metrics dashboard
- [ ] Conduct CI/CD security training for team
- [ ] Perform annual CI/CD security audit

---

## Related Documents
- [Supply Chain Security](./20_SUPPLY_CHAIN.md)
- [SBOM and Provenance](./21_SBOM_AND_PROVENANCE.md)
- [Identity and Access](./11_IDENTITY_AND_ACCESS.md)
- [Threat Model](./10_THREAT_MODEL.md)

---

**Maintained by**: DevOps + Security Team  
**Review Cycle**: Monthly or on pipeline changes  
**Escalation**: CI/CD compromise → Incident Response within 1 hour
