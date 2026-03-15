# Cloud Gallery Scripts - AI Agent Instructions

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![Shell](https://img.shields.io/badge/Shell-Bash-4EAA25?logo=gnu-bash)
![Security](https://img.shields.io/badge/Security-A+-brightgreen)

</div>

AI-optimized documentation for build scripts, security automation, and deployment utilities in Cloud Gallery.

## 🎯 Scripts Overview

Automation scripts for Cloud Gallery including build processes, security validation, and deployment utilities. Ensures consistent, secure, and automated development workflows.

**One-Liner**: Build automation, security validation, and deployment scripts for Cloud Gallery development.

## 🏗️ Scripts Architecture

```
scripts/
├── build.js                   # Expo static build automation
├── security-check.sh          # Comprehensive security validation
├── pen-test.sh                # Penetration testing automation
└── (future automation scripts)
```

### Script Types
- **JavaScript**: Build automation and complex workflows
- **Shell Scripts**: Security validation and system operations
- **Future**: CI/CD pipelines, deployment automation

## 🚀 Build Script (build.js)

### Purpose
Automates the build process for React Native web deployment with optimization and asset handling.

### Usage
```bash
# Build static web version
npm run expo:static:build

# Build and start development server
npm run expo:start:static:build
```

### Key Features
```javascript
// Build process includes:
1. Environment validation
2. Asset optimization
3. Bundle analysis
4. Production optimization
5. Build reporting
```

### Build Configuration
```javascript
const buildConfig = {
  platforms: ['web', 'ios', 'android'],
  optimization: {
    minify: true,
    compress: true,
    treeShaking: true,
    deadCodeElimination: true,
  },
  assets: {
    imageOptimization: true,
    fontSubsetting: true,
    iconGeneration: true,
  },
  output: {
    directory: 'static-build',
    clean: true,
    sourceMaps: false,
  },
};
```

## 🔐 Security Scripts

### Security Check (security-check.sh)

#### Purpose
Comprehensive security validation including dependency scanning, code analysis, and compliance checks.

#### Usage
```bash
# Run full security validation
npm run security:check

# Individual security checks
npm run security:audit      # Dependency vulnerability scan
npm run security:sbom       # Generate SBOM
```

#### Security Checks Performed
```bash
# 1. Dependency Vulnerability Scanning
npm audit --audit-level=moderate

# 2. Code Security Analysis
# - SQL injection detection
# - XSS vulnerability scanning
# - Hardcoded secrets detection
# - Insecure crypto usage detection

# 3. Configuration Security
# - Environment variable validation
# - Check for exposed secrets
# - Validate secure defaults
# - Review permission settings

# 4. License Compliance
# - License compatibility check
# - Review all dependencies
# - Check for GPL conflicts
# - Validate commercial use
```

#### Security Report Output
```json
{
  "timestamp": "2026-03-14T20:37:00.000Z",
  "status": "PASS",
  "checks": {
    "dependencies": {
      "status": "PASS",
      "vulnerabilities": 0,
      "audit": "clean"
    },
    "code": {
      "status": "PASS",
      "issues": 0,
      "secrets": "none detected"
    },
    "configuration": {
      "status": "PASS",
      "environment": "secure",
      "permissions": "appropriate"
    },
    "licenses": {
      "status": "PASS",
      "compatible": true,
      "conflicts": 0
    }
  },
  "score": "A+",
  "recommendations": []
}
```

### Penetration Testing (pen-test.sh)

#### Purpose
Automated penetration testing for API endpoints and security controls validation.

#### Usage
```bash
# Run penetration tests
./scripts/pen-test.sh

# Test specific endpoints
./scripts/pen-test.sh --endpoint /api/auth/login
./scripts/pen-test.sh --endpoint /api/photos
```

#### Penetration Test Categories
```bash
# 1. Authentication Testing
# - Authentication bypass attempts
# - Brute force attacks
# - Token manipulation
# - Session hijacking
# - Authorization bypass

# 2. Input Validation Testing
# - SQL injection vulnerabilities
# - NoSQL injection attempts
# - XSS attacks
# - Command injection
# - Path traversal attacks

# 3. Rate Limiting Testing
# - DDoS simulation
# - API abuse detection
# - Resource exhaustion
# - Rate limit bypass attempts

# 4. File Upload Testing
# - Malicious file upload
# - File type validation
# - Size limit enforcement
# - Path traversal attacks
```

#### Penetration Test Results
```json
{
  "timestamp": "2026-03-14T20:37:00.000Z",
  "target": "http://localhost:5000",
  "tests": {
    "authentication": {
      "status": "PASS",
      "bypass_attempts": 0,
      "brute_force_blocked": true
    },
    "input_validation": {
      "status": "PASS",
      "injection_attempts": 0,
      "xss_blocked": true
    },
    "rate_limiting": {
      "status": "PASS",
      "ddos_blocked": true,
      "api_protected": true
    },
    "file_upload": {
      "status": "PASS",
      "malicious_blocked": true,
      "validation_working": true
    }
  },
  "overall_score": "A+",
  "vulnerabilities": 0,
  "recommendations": []
}
```

## 🔧 Script Development Guidelines

### Security Script Standards
```bash
# 1. Principle of Least Privilege
# - Run with minimal permissions
# - Use read-only access where possible
# - Validate all inputs

# 2. Fail-Safe Defaults
# - Exit on security violations
# - Default to secure configurations
# - Provide clear error messages

# 3. Audit Logging
# - Log all security checks
# - Track failed attempts
# - Maintain audit trails
```

### Error Handling
```bash
# Standard error handling pattern
handle_error() {
  local error_code=$?
  local error_message="$1"
  
  # Log error
  echo "ERROR: $error_message" >&2
  
  # Exit with appropriate code
  exit $error_code
}

# Usage
command || handle_error "Command failed"
```

### Logging Standards
```bash
# Structured logging
log_info() {
  echo "INFO: $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
  echo "WARN: $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_error() {
  echo "ERROR: $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}

log_security() {
  echo "SECURITY: $(date '+%Y-%m-%d %H:%M:%S') - $1" >&2
}
```

## 📊 Script Performance

### Execution Times
```bash
# Security check performance
security-check.sh: ~30 seconds
- Dependency audit: 10s
- Code analysis: 15s
- Configuration check: 3s
- License check: 2s

# Penetration test performance
pen-test.sh: ~2 minutes
- Authentication tests: 30s
- Input validation: 45s
- Rate limiting: 20s
- File upload: 25s
```

### Resource Usage
```bash
# Memory usage during execution
security-check.sh: ~50MB peak
pen-test.sh: ~100MB peak
build.js: ~200MB peak (during optimization)

# CPU usage
security-check.sh: ~25% CPU
pen-test.sh: ~60% CPU
build.js: ~80% CPU (during minification)
```

## 🧪 Testing Scripts

### Unit Testing
```bash
# Test script syntax
bash -n scripts/security-check.sh
bash -n scripts/pen-test.sh
bash -n scripts/build.js
```

### Integration Testing
```bash
# Test scripts in CI/CD pipeline
name: Script Validation
on: [push, pull_request]
jobs:
  test-scripts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test Security Script
        run: ./scripts/security-check.sh
      - name: Test Pen Test Script
        run: ./scripts/pen-test.sh --test-mode
      - name: Test Build Script
        run: npm run expo:static:build
```

### Mock Testing
```bash
# Test with mock data
./scripts/security-check.sh --mock-data
./scripts/pen-test.sh --dry-run
```

## 🔧 Custom Script Development

### Adding New Scripts
```bash
# 1. Create script file
touch scripts/new-script.sh
chmod +x scripts/new-script.sh

# 2. Add header
cat << 'EOF' > scripts/new-script.sh
#!/bin/bash
# Cloud Gallery - New Script
# Purpose: Description of script purpose
# Usage: ./scripts/new-script.sh [options]
# Author: Cloud Gallery Team
# Date: $(date +%Y-%m-%d)

set -euo pipefail  # Strict error handling
EOF

# 3. Implement functionality
# Add your script logic here

# 4. Add to package.json
npm pkg set scripts.new-script="./scripts/new-script.sh"
```

### Script Template
```bash
#!/bin/bash
# Cloud Gallery - Script Template
# Purpose: Template for new scripts
# Usage: ./scripts/template.sh [options]
# Author: Cloud Gallery Team
# Date: $(date +%Y-%m-%d)

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
  echo -e "${GREEN}INFO:${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}WARN:${NC} $1"
}

log_error() {
  echo -e "${RED}ERROR:${NC} $1" >&2
}

# Main function
main() {
  log_info "Starting script execution..."
  
  # Add your logic here
  
  log_info "Script completed successfully"
}

# Error handling
trap 'log_error "Script failed with exit code $?"' ERR

# Run main function
main "$@"
```

## 🔍 Script Validation

### Automated Testing
```bash
# Test script syntax
bash -n scripts/security-check.sh
bash -n scripts/pen-test.sh

# Test script functionality
./scripts/security-check.sh --dry-run
./scripts/pen-test.sh --test-mode

# Validate permissions
ls -la scripts/
# All scripts should be executable (755)
```

### CI/CD Integration
```bash
# GitHub Actions workflow
name: Script Validation
on: [push, pull_request]
jobs:
  validate-scripts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Validate Scripts
        run: |
          bash -n scripts/*.sh
          node -c scripts/build.js
      - name: Test Security Script
        run: ./scripts/security-check.sh
      - name: Test Build Script
        run: npm run expo:static:build
```

## 📝 Script Maintenance

### Regular Updates
```bash
# Monthly maintenance tasks:
1. Update security vulnerability databases
2. Review penetration test scenarios
3. Optimize build performance
4. Update dependency versions
5. Review error handling patterns
```

### Monitoring
```bash
# Monitor script performance
time ./scripts/security-check.sh
time ./scripts/pen-test.sh
time npm run expo:static:build

# Monitor script failures
# Check CI/CD logs
# Review error reports
# Track success rates
```

## 📋 Scripts-Specific Gotchas

### Security Scripts
- **False Positives**: Security scans may flag safe code
- **Performance**: Security checks can be resource-intensive
- **Environment**: Some checks require specific environment setup

### Build Scripts
- **Dependencies**: Build scripts depend on specific Node.js versions
- **Network**: Some build steps require internet access
- **Permissions**: Build scripts may need write permissions

### Shell Scripts
- **Portability**: Consider cross-platform compatibility
- **Permissions**: Scripts must be executable
- **Paths**: Use relative paths for portability

## 🔍 External Dependencies

### Security Tools
- **npm audit**: Dependency vulnerability scanning
- **semgrep**: Static analysis security testing
- **OWASP ZAP**: Dynamic application security testing

### Build Tools
- **Expo CLI**: React Native build system
- **Node.js**: JavaScript runtime
- **npm**: Package manager

### Testing Tools
- **Bash**: Shell scripting
- **Node.js**: JavaScript execution
- **GitHub Actions**: CI/CD platform

## 📚 Documentation References

### Script Documentation
- `@scripts/README.md` - Complete script documentation
- Individual script comments and help text

### Security Documentation
- `@docs/security/README.md` - Security program overview
- `@docs/security/30_CICD_HARDENING.md` - Pipeline security

### Build Documentation
- `@docs/architecture/20_RUNTIME_TOPOLOGY.md` - Build and deployment

## 🚨 Agent Behavior Guidelines

### What to Do
- Follow security-first development practices
- Use proper error handling and logging
- Test scripts before deployment
- Keep scripts simple and focused
- Document script usage and options

### What to Avoid
- Don't skip security validation
- Avoid hardcoded credentials in scripts
- Don't ignore script failures
- Avoid complex logic in shell scripts
- Don't skip testing for new scripts

### Verification Steps
1. Test script syntax: `bash -n script.sh`
2. Test script functionality: `./script.sh --dry-run`
3. Validate permissions: `ls -la scripts/`
4. Test in CI/CD environment
5. Review security implications

---

*Last updated: March 2026 | Compatible with: AGENTS.md standard v1.0*
