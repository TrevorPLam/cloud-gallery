# SBOM and Provenance

[← Back to Security Index](./00_INDEX.md)

**Purpose**: Establish Software Bill of Materials (SBOM) generation and build provenance tracking for Cloud Gallery. Enables supply chain transparency, vulnerability tracking, and compliance with emerging software supply chain security standards (SLSA, EO 14028).

**Last Updated**: 2026-02-04  
**Next Review**: Quarterly or on tooling changes

## Table of Contents
- [SBOM Overview](#sbom-overview)
- [SBOM Generation](#sbom-generation)
- [SBOM Formats](#sbom-formats)
- [Build Provenance](#build-provenance)
- [Artifact Signing](#artifact-signing)
- [SLSA Framework](#slsa-framework)
- [Container Security](#container-security)
- [Release Verification](#release-verification)
- [Supply Chain Attack Mitigation](#supply-chain-attack-mitigation)

---

## SBOM Overview

### What is an SBOM?

A Software Bill of Materials is a complete, formally structured list of components, libraries, and dependencies used in a software application.

**Purpose**:
- Vulnerability tracking: Identify affected systems when CVE disclosed
- License compliance: Audit open-source license obligations
- Supply chain transparency: Know what's in your software
- Regulatory compliance: Required by EO 14028 (US), NIS2 (EU)

### Cloud Gallery SBOM Scope

**Current Dependencies**: 56 direct + ~400 transitive (estimated)
**Evidence**: [package.json](../../package.json)

**SBOM Should Include**:
- ✅ npm packages (production + development)
- ✅ Transitive dependencies (full tree)
- ✅ Version numbers and licenses
- ✅ Package hashes (integrity)
- ⚠️ Native modules (Expo binaries) - Limited visibility
- ⚠️ System libraries (iOS/Android SDKs) - Not included

---

## SBOM Generation

### CycloneDX Generator (Recommended)

**Installation**:
```bash
npm install --save-dev @cyclonedx/cyclonedx-npm
```

**Add to `package.json`**:
```json
{
  "scripts": {
    "sbom:generate": "cyclonedx-npm --output-file sbom.json --output-format JSON",
    "sbom:generate:xml": "cyclonedx-npm --output-file sbom.xml --output-format XML"
  }
}
```

**Generate SBOM**:
```bash
npm run sbom:generate  # Creates sbom.json (CycloneDX format)
```

**Output Location**: `./sbom.json` (gitignored, generated per release)

### SPDX Generator (Alternative)

**Installation**:
```bash
npm install -g spdx-sbom-generator
```

**Generate**:
```bash
spdx-sbom-generator -p . -o spdx-sbom.json
```

### Syft (Multi-Language SBOM)

**Installation**:
```bash
# macOS
brew install syft

# Linux
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh
```

**Generate SBOM**:
```bash
syft dir:. -o cyclonedx-json > sbom-syft.json
syft dir:. -o spdx-json > sbom-spdx.json
```

### CI Integration

**Add to `.github/workflows/release.yml`**:
```yaml
name: Release with SBOM

on:
  release:
    types: [published]

jobs:
  sbom:
    runs-on: ubuntu-latest
    permissions:
      contents: write  # Upload SBOM as release asset
      
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate SBOM (CycloneDX)
        run: npx @cyclonedx/cyclonedx-npm --output-file sbom-cyclonedx.json
      
      - name: Generate SBOM (SPDX)
        run: npx spdx-sbom-generator -p . -o sbom-spdx.json
      
      - name: Upload SBOM to release
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ github.event.release.upload_url }}
          asset_path: ./sbom-cyclonedx.json
          asset_name: sbom-cyclonedx-${{ github.event.release.tag_name }}.json
          asset_content_type: application/json
      
      - name: Upload SPDX SBOM
        uses: actions/upload-release-asset@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ github.event.release.upload_url }}
          asset_path: ./sbom-spdx.json
          asset_name: sbom-spdx-${{ github.event.release.tag_name }}.json
          asset_content_type: application/json
```

---

## SBOM Formats

### CycloneDX vs SPDX

| Feature | CycloneDX | SPDX |
|---------|-----------|------|
| **Purpose** | Security-focused SBOM | License compliance SBOM |
| **Format** | JSON, XML, Protocol Buffers | JSON, YAML, RDF, Tag-Value |
| **Vulnerability Tracking** | ✅ Native VEX support | ⚠️ Via extensions |
| **License Info** | ✅ Supported | ✅✅ Primary focus |
| **Supply Chain** | ✅ Dependency graph | ✅ Relationships |
| **Adoption** | OWASP, CISA, NTIA | Linux Foundation, ISO/IEC 5962 |
| **Tooling** | cyclonedx-cli, Syft | spdx-tools, Syft |

### CycloneDX Format (Recommended)

**Example Output** (`sbom.json`):
```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.5",
  "serialNumber": "urn:uuid:...",
  "version": 1,
  "metadata": {
    "timestamp": "2026-02-04T10:00:00Z",
    "component": {
      "type": "application",
      "name": "cloud-gallery",
      "version": "1.0.0"
    }
  },
  "components": [
    {
      "type": "library",
      "name": "express",
      "version": "5.0.1",
      "purl": "pkg:npm/express@5.0.1",
      "licenses": [{"license": {"id": "MIT"}}],
      "hashes": [
        {"alg": "SHA-512", "content": "abc123..."}
      ]
    }
  ],
  "dependencies": [
    {
      "ref": "pkg:npm/express@5.0.1",
      "dependsOn": ["pkg:npm/body-parser@1.20.2"]
    }
  ]
}
```

**Benefits**:
- Machine-readable for vulnerability scanners
- Includes dependency graph (transitive relationships)
- VEX (Vulnerability Exploitability eXchange) support

### SPDX Format (Alternative)

**Example Output** (`sbom-spdx.json`):
```json
{
  "spdxVersion": "SPDX-2.3",
  "dataLicense": "CC0-1.0",
  "SPDXID": "SPDXRef-DOCUMENT",
  "name": "cloud-gallery-1.0.0",
  "documentNamespace": "https://cloud-gallery.com/sbom/...",
  "packages": [
    {
      "SPDXID": "SPDXRef-Package-express",
      "name": "express",
      "versionInfo": "5.0.1",
      "downloadLocation": "https://registry.npmjs.org/express/-/express-5.0.1.tgz",
      "licenseDeclared": "MIT",
      "filesAnalyzed": false,
      "checksums": [
        {"algorithm": "SHA256", "checksumValue": "abc123..."}
      ]
    }
  ]
}
```

**Benefits**:
- ISO/IEC standard (5962:2021)
- Better license compliance tracking
- Wider enterprise adoption

### Format Recommendation

**For Cloud Gallery**: Use **CycloneDX** primary, SPDX secondary.

**Rationale**:
- Security-first project (CycloneDX designed for vulnerability management)
- npm ecosystem well-supported
- GitHub Dependency Graph supports CycloneDX
- Can generate both formats simultaneously

---

## Build Provenance

### What is Provenance?

Build provenance is metadata about how, when, and where software was built.

**Includes**:
- Source repository and commit SHA
- Build platform (GitHub Actions runner)
- Build commands executed
- Build dependencies and tools
- Timestamp and build duration
- Builder identity (CI service account)

**Purpose**: Detect tampering, verify authenticity, comply with SLSA requirements.

### SLSA Provenance Format

**Example Provenance** (JSON):
```json
{
  "_type": "https://in-toto.io/Statement/v0.1",
  "subject": [
    {
      "name": "pkg:npm/cloud-gallery@1.0.0",
      "digest": {"sha256": "abc123..."}
    }
  ],
  "predicateType": "https://slsa.dev/provenance/v0.2",
  "predicate": {
    "builder": {
      "id": "https://github.com/actions/runner/github-hosted"
    },
    "buildType": "https://github.com/actions/workflow@v1",
    "invocation": {
      "configSource": {
        "uri": "git+https://github.com/cloud-gallery/cloud-gallery@refs/heads/main",
        "digest": {"sha1": "commit-sha"},
        "entryPoint": ".github/workflows/release.yml"
      }
    },
    "metadata": {
      "buildStartedOn": "2026-02-04T10:00:00Z",
      "buildFinishedOn": "2026-02-04T10:05:00Z",
      "completeness": {
        "parameters": true,
        "environment": false,
        "materials": true
      }
    },
    "materials": [
      {
        "uri": "git+https://github.com/cloud-gallery/cloud-gallery",
        "digest": {"sha1": "commit-sha"}
      }
    ]
  }
}
```

### GitHub Actions Provenance

**Generate Provenance Automatically**:
```yaml
# .github/workflows/release.yml
name: Release with Provenance

on:
  release:
    types: [published]

permissions:
  contents: write
  id-token: write  # Required for provenance generation

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
      
      - name: Build application
        run: |
          npm ci
          npm run server:build
          npm run expo:static:build
      
      - name: Generate provenance
        uses: actions/attest-build-provenance@v1
        with:
          subject-path: |
            server_dist/**
            dist/**
```

**Evidence**: Current CI uses `npm ci` ([test-coverage.yml:28](../../.github/workflows/test-coverage.yml)), ensuring reproducible builds.

### npm Provenance (Experimental)

**Publish with Provenance**:
```bash
npm publish --provenance
```

**Requires**:
- npm 9.5.0+ 
- GitHub Actions with OIDC token
- Public repository (or npm Enterprise)

**Adds to package metadata**:
- Commit SHA and repository URL
- GitHub Actions workflow that published
- SLSA provenance attestation

---

## Artifact Signing

### Code Signing Strategy

**Current State**: No artifact signing implemented.

**Goals**:
1. Sign npm packages (if publishing to registry)
2. Sign release binaries (iOS .ipa, Android .apk)
3. Sign container images (if deployed in containers)
4. Sign git commits and tags

### npm Package Signing

**⚠️ NOT IMPLEMENTED YET** (Cloud Gallery not published to npm)

**If publishing**:
```bash
# Sign package with npm provenance
npm publish --provenance --access public

# Verify signature
npm audit signatures
```

### Sigstore for Artifacts

**Sigstore** is a free, open-source signing service.

**Install Cosign**:
```bash
# macOS
brew install cosign

# Linux
curl -sSfL https://github.com/sigstore/cosign/releases/download/v2.0.0/cosign-linux-amd64 -o cosign
chmod +x cosign
```

**Sign Release Artifacts**:
```bash
# Sign with keyless signing (OIDC)
cosign sign-blob --bundle=signature.bundle artifact.tar.gz

# Verify
cosign verify-blob --bundle=signature.bundle --certificate-oidc-issuer=https://token.actions.githubusercontent.com artifact.tar.gz
```

### Git Commit Signing

**Setup GPG Signing**:
```bash
# Generate GPG key
gpg --full-generate-key

# Configure git
git config --global user.signingkey <key-id>
git config --global commit.gpgsign true
git config --global tag.gpgsign true

# Sign commits
git commit -S -m "Signed commit"
```

**GitHub Verification**: Add GPG public key to GitHub Settings → SSH and GPG keys.

**Enforcement**: See [CI/CD Hardening](./30_CICD_HARDENING.md) for branch protection rules.

---

## SLSA Framework

### SLSA Levels Overview

**SLSA** (Supply chain Levels for Software Artifacts) - Pronounced "salsa"

| Level | Requirements | Cloud Gallery Status |
|-------|-------------|----------------------|
| **SLSA 0** | No guarantees | ⚠️ Current state |
| **SLSA 1** | Provenance exists | 🎯 Target (Sprint 3) |
| **SLSA 2** | Signed provenance + hosted build service | 🎯 Target (Month 3) |
| **SLSA 3** | Hardened builds, non-falsifiable provenance | 🔮 Future goal |
| **SLSA 4** | Two-party review + hermetic builds | ❌ Not planned |

### SLSA Level 1 Requirements

✅ **Build Process**:
- Automated build (GitHub Actions)
- Evidence: [test-coverage.yml](../../.github/workflows/test-coverage.yml)

⚠️ **Provenance Generation**:
- NOT IMPLEMENTED: Need to add `actions/attest-build-provenance`

⚠️ **Provenance Distribution**:
- NOT IMPLEMENTED: Should attach to GitHub releases

**Implementation**:
```yaml
# Add to release workflow
- name: Generate provenance
  uses: actions/attest-build-provenance@v1
  with:
    subject-path: 'dist/**'
```

### SLSA Level 2 Requirements

✅ **Version Control**:
- Git + GitHub
- Evidence: Repository structure

✅ **Hosted Build Service**:
- GitHub Actions (not local builds)
- Evidence: [test-coverage.yml:11](../../.github/workflows/test-coverage.yml)

⚠️ **Signed Provenance**:
- NOT IMPLEMENTED: Need Sigstore integration

⚠️ **Build Service Authentication**:
- Use GitHub OIDC tokens (requires `id-token: write`)

**Implementation**: See [Build Provenance](#build-provenance) section.

### SLSA Level 3+ (Future)

❌ **Non-Falsifiable Provenance**: Build runs in isolated environment
❌ **Hardened Build Platform**: GitHub-hosted runners (partially compliant)
❌ **Build as Code**: Workflow checked into VCS (✅ Already done)

---

## Container Security

### Current State

**Cloud Gallery**: NOT containerized currently.

**Evidence**:
- No `Dockerfile` in repository
- Server runs with `tsx server/index.ts` (Node.js process)
- [package.json:7](../../package.json)

### If Containerizing (Future)

**Dockerfile Best Practices**:
```dockerfile
# Multi-stage build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run server:build

# Runtime image
FROM node:20-alpine AS runtime
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=builder --chown=appuser:appgroup /app/server_dist ./server_dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
USER appuser
EXPOSE 5000
CMD ["node", "server_dist/index.js"]
```

### Container Image Scanning

**Tools**:
- **Trivy** (Free, comprehensive)
- **Grype** (Anchore, open-source)
- **Snyk Container** (Commercial)
- **Docker Scout** (Built into Docker Desktop)

**Trivy Example**:
```bash
# Install
brew install trivy

# Scan image
trivy image cloud-gallery:latest

# Scan with severity filtering
trivy image --severity HIGH,CRITICAL cloud-gallery:latest

# Generate SBOM from image
trivy image --format cyclonedx cloud-gallery:latest > sbom.json
```

**CI Integration**:
```yaml
- name: Build container
  run: docker build -t cloud-gallery:${{ github.sha }} .

- name: Scan container with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: cloud-gallery:${{ github.sha }}
    severity: 'CRITICAL,HIGH'
    exit-code: '1'  # Fail build on vulnerabilities
```

### Container Image Signing

**Sign with Cosign**:
```bash
# Sign image
cosign sign --key cosign.key cloud-gallery:latest

# Verify
cosign verify --key cosign.pub cloud-gallery:latest
```

**Keyless Signing** (Recommended):
```bash
# Sign with OIDC (GitHub Actions)
cosign sign cloud-gallery:latest

# Verify with OIDC issuer
cosign verify --certificate-oidc-issuer=https://token.actions.githubusercontent.com cloud-gallery:latest
```

---

## Release Verification

### Verification Workflow

**End-User Verification Process**:

1. **Download Release Artifact**:
   ```bash
   wget https://github.com/cloud-gallery/cloud-gallery/releases/download/v1.0.0/cloud-gallery-1.0.0.tar.gz
   ```

2. **Download SBOM**:
   ```bash
   wget https://github.com/cloud-gallery/cloud-gallery/releases/download/v1.0.0/sbom-cyclonedx-v1.0.0.json
   ```

3. **Download Provenance**:
   ```bash
   wget https://github.com/cloud-gallery/cloud-gallery/releases/download/v1.0.0/provenance-v1.0.0.json
   ```

4. **Verify Checksum**:
   ```bash
   sha256sum -c checksums.txt
   ```

5. **Verify Signature** (if signed):
   ```bash
   cosign verify-blob --bundle=signature.bundle cloud-gallery-1.0.0.tar.gz
   ```

### Release Artifact Checklist

**Must Include in GitHub Release**:
- [ ] Source code archive (auto-generated by GitHub)
- [ ] Built binaries (if applicable)
- [ ] SBOM (CycloneDX and/or SPDX)
- [ ] Provenance attestation (SLSA format)
- [ ] Checksums file (SHA-256)
- [ ] Signature bundle (Cosign)
- [ ] CHANGELOG excerpt
- [ ] THIRD_PARTY_NOTICES.txt (license attributions)

**Example Release Assets**:
```
cloud-gallery-v1.0.0.tar.gz
cloud-gallery-v1.0.0.tar.gz.sha256
cloud-gallery-v1.0.0.tar.gz.sig
sbom-cyclonedx-v1.0.0.json
sbom-spdx-v1.0.0.json
provenance-v1.0.0.json
CHANGELOG-v1.0.0.md
THIRD_PARTY_NOTICES.txt
```

### Automated Release Workflow

**Complete `.github/workflows/release.yml`**:
```yaml
name: Release

on:
  release:
    types: [published]

permissions:
  contents: write
  id-token: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20.x'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: |
          npm run server:build
          npm run expo:static:build
      
      - name: Create release tarball
        run: |
          tar -czf cloud-gallery-${{ github.event.release.tag_name }}.tar.gz \
            server_dist/ dist/ package.json package-lock.json
      
      - name: Generate checksums
        run: |
          sha256sum cloud-gallery-*.tar.gz > checksums.txt
      
      - name: Generate SBOM
        run: |
          npx @cyclonedx/cyclonedx-npm --output-file sbom-cyclonedx.json
      
      - name: Generate provenance
        uses: actions/attest-build-provenance@v1
        with:
          subject-path: 'cloud-gallery-*.tar.gz'
      
      - name: Upload release assets
        uses: softprops/action-gh-release@v1
        with:
          files: |
            cloud-gallery-*.tar.gz
            checksums.txt
            sbom-cyclonedx.json
```

---

## Supply Chain Attack Mitigation

### Attack Vectors

**Common Supply Chain Attacks**:

1. **Dependency Confusion**
   - Attacker publishes malicious package with same name to public registry
   - Build system prioritizes public over private registry
   - **Mitigation**: Use scoped packages (`@cloud-gallery/`)

2. **Typosquatting**
   - Malicious package with similar name (e.g., `expres` vs `express`)
   - **Mitigation**: Code review dependency additions, use allowlists

3. **Malicious Maintainer**
   - Legitimate package compromised by maintainer account takeover
   - **Mitigation**: npm audit, Dependabot alerts, package signing

4. **Build System Compromise**
   - Attacker modifies CI/CD to inject malicious code
   - **Mitigation**: Least privilege, signed commits, audit logs

5. **Compromised Dependencies**
   - Transitive dependency introduces vulnerability or backdoor
   - **Mitigation**: SBOM tracking, vulnerability scanning, provenance

### Detection Strategies

**Pre-Commit**:
```bash
# Review new dependencies before adding
npm view <package> repository maintainers
npx @socketdev/cli audit <package>  # Socket.dev supply chain scanner
```

**Pre-Merge**:
```yaml
# CI checks
- npm audit --audit-level=high
- npm ls --depth=5  # Check for suspicious transitive deps
```

**Post-Merge**:
```bash
# Monitor deployed application
npm audit --production
# Review SBOM for unexpected changes
diff sbom-previous.json sbom-current.json
```

### Incident Response

**If Supply Chain Compromise Detected**:

1. **Isolate**: Stop deployments, rollback to last known good version
2. **Investigate**: Review SBOM, git history, build logs
3. **Notify**: Security team, affected users, GitHub Security Advisories
4. **Remediate**: Remove malicious dependency, patch vulnerability
5. **Verify**: Re-scan with multiple tools (npm audit, Snyk, Trivy)
6. **Document**: Update threat model, add detection rules

**Example Playbook**:
```bash
# 1. Identify compromised package
npm audit --json > audit-report.json

# 2. Check when it was introduced
git log -p package-lock.json | grep -A5 "compromised-package"

# 3. Rollback to safe version
npm install compromised-package@<safe-version>
npm ci  # Reinstall all with new lockfile

# 4. Generate new SBOM
npm run sbom:generate

# 5. Re-test and deploy
npm test && npm run server:build
```

---

## Implementation Roadmap

### Phase 1: SBOM Generation (Sprint 1-2)
- [ ] Install CycloneDX npm plugin
- [ ] Add `sbom:generate` script to package.json
- [ ] Generate SBOM manually, review output
- [ ] Add SBOM to `.gitignore` (generated per release)
- [ ] Document SBOM location in README

### Phase 2: CI Integration (Sprint 3-4)
- [ ] Create `.github/workflows/release.yml`
- [ ] Add SBOM generation step to release workflow
- [ ] Upload SBOM as release asset
- [ ] Test with pre-release tag

### Phase 3: Provenance (Month 2)
- [ ] Add `actions/attest-build-provenance@v1` to release workflow
- [ ] Configure `id-token: write` permission
- [ ] Generate provenance for release artifacts
- [ ] Verify provenance locally with `gh attestation verify`

### Phase 4: Signing (Month 3)
- [ ] Set up GPG keys for maintainers
- [ ] Enforce signed commits in branch protection
- [ ] Add Cosign signing to release workflow
- [ ] Document verification process for users

### Phase 5: SLSA Level 2 (Quarter 2)
- [ ] Audit CI/CD against SLSA requirements
- [ ] Implement missing controls (2FA, audit logs)
- [ ] Generate SLSA provenance JSON
- [ ] Publish SLSA compliance statement

---

## Compliance Mapping

### Executive Order 14028 (US)
**"Improving the Nation's Cybersecurity"** (May 2021)

**Requirement**: Software vendors must provide SBOM for federal procurement.

**Cloud Gallery Compliance**:
- ✅ Can generate SBOM (CycloneDX/SPDX)
- ⚠️ Not automated in release process yet
- ⚠️ No provenance attestation yet

### NTIA Minimum Elements
**National Telecommunications and Information Administration**

**Required SBOM Elements**:
- ✅ Author name (Cloud Gallery team)
- ✅ Supplier name (npm package publishers)
- ✅ Component name (package names)
- ✅ Version (semver)
- ✅ Dependency relationships (transitive deps)
- ✅ Unique identifier (npm package URL)
- ⚠️ Timestamp of SBOM generation (add to CI)

### SLSA Compliance
- **Current**: SLSA Level 0
- **Target**: SLSA Level 2 (Q2 2026)
- **Blocker**: Provenance generation not implemented

---

## Related Documents
- [Supply Chain Security](./20_SUPPLY_CHAIN.md)
- [CI/CD Hardening](./30_CICD_HARDENING.md)
- [Threat Model](./10_THREAT_MODEL.md)

---

**Maintained by**: Security Team  
**Review Cycle**: Quarterly + on release process changes  
**Escalation**: SBOM discrepancies → Security Lead within 24 hours
