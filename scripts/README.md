# Cloud Gallery Scripts

<div align="center">

![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![Shell](https://img.shields.io/badge/Shell-Bash-4EAA25?logo=gnu-bash)
![Security](https://img.shields.io/badge/Security-A+-brightgreen)

</div>

Automation scripts for Cloud Gallery including build processes, security validation, and deployment utilities.

## 📁 Scripts Overview

```
scripts/
├── 🏗️ build.js                   # Expo static build automation
├── 🔐 security-check.sh           # Comprehensive security validation
└── 🎯 pen-test.sh                 # Penetration testing automation
```

## 🏗️ Build Script

### Purpose
Automates the build process for React Native web deployment with optimization and asset handling.

### Usage
```bash
# Build static web version
npm run expo:static:build

# Build and start development server
npm run expo:start:static:build
```

### Build Process
```javascript
// build.js key features:
1. ✅ Environment validation
2. 🗜️ Asset optimization
3. 📦 Bundle analysis
4. 🚀 Production optimization
5. 📊 Build reporting
```

### Build Configuration
```javascript
const buildConfig = {
  // Platform targets
  platforms: ['web', 'ios', 'android'],
  
  // Optimization settings
  optimization: {
    minify: true,
    compress: true,
    treeShaking: true,
    deadCodeElimination: true,
  },
  
  // Asset handling
  assets: {
    imageOptimization: true,
    fontSubsetting: true,
    iconGeneration: true,
  },
  
  // Output settings
  output: {
    directory: 'static-build',
    clean: true,
    sourceMaps: false,
  },
};
```

## 🔐 Security Check Script

### Purpose
Comprehensive security validation including dependency scanning, code analysis, and compliance checks.

### Usage
```bash
# Run full security validation
npm run security:check

# Individual security checks
npm run security:audit      # Dependency vulnerability scan
npm run security:sbom       # Generate SBOM
```

### Security Checks Performed

#### 1. Dependency Vulnerability Scanning
```bash
# npm audit with strict failure
npm audit --audit-level=moderate

# Check for known vulnerabilities in dependencies
# Review security advisories
# Validate package integrity
```

#### 2. Code Security Analysis
```bash
# Static Application Security Testing (SAST)
# - SQL injection detection
# - XSS vulnerability scanning
# - Hardcoded secrets detection
# - Insecure crypto usage detection
```

#### 3. Configuration Security
```bash
# Environment variable validation
# - Check for exposed secrets
# - Validate secure defaults
# - Review permission settings
```

#### 4. License Compliance
```bash
# License compatibility check
# - Review all dependencies
# - Check for GPL conflicts
# - Validate commercial use
```

### Security Report Output
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

## 🎯 Penetration Testing Script

### Purpose
Automated penetration testing for API endpoints and security controls validation.

### Usage
```bash
# Run penetration tests
./scripts/pen-test.sh

# Test specific endpoints
./scripts/pen-test.sh --endpoint /api/auth/login
./scripts/pen-test.sh --endpoint /api/photos
```

### Penetration Test Categories

#### 1. Authentication Testing
```bash
# Test authentication bypass attempts
# - Brute force attacks
# - Token manipulation
# - Session hijacking
# - Authorization bypass
```

#### 2. Input Validation Testing
```bash
# Test for injection vulnerabilities
# - SQL injection
# - NoSQL injection
# - XSS attacks
# - Command injection
```

#### 3. Rate Limiting Testing
```bash
# Test rate limiting effectiveness
# - DDoS simulation
# - API abuse detection
# - Resource exhaustion
```

#### 4. File Upload Testing
```bash
# Test file upload security
# - Malicious file upload
# - File type validation
# - Size limit enforcement
# - Path traversal attacks
```

### Penetration Test Results
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

## 🛠️ Script Development Guidelines

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
# Author: Your Name
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

## 🔗 Related Documentation

- **[Main README](../README.md)** - Project overview
- **[Client Documentation](../client/README.md)** - React Native app
- **[Server Documentation](../server/README.md)** - Node.js backend
- **[Security Program](../docs/security/README.md)** - Security documentation
- **[CI/CD Documentation](../docs/security/30_CICD_HARDENING.md)** - Pipeline security

---

<div align="center">

**Automation Scripts for Cloud Gallery**

[![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)](https://nodejs.org/)
[![Shell](https://img.shields.io/badge/Shell-Bash-4EAA25?logo=gnu-bash)](https://www.gnu.org/software/bash/)
[![Security](https://img.shields.io/badge/Security-A+-brightgreen)](../docs/security/README.md)

</div>
