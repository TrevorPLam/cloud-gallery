# Security Policy

## Supported Versions

Currently supported versions of Cloud Gallery:

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security vulnerabilities via one of these channels:

1. **GitHub Security Advisories** (Preferred)
   - Go to the Security tab
   - Click "Report a vulnerability"
   - Provide detailed information about the vulnerability

2. **Email** (Alternative)
   - Email: security@cloudgallery.example (placeholder - update with actual contact)
   - Use PGP encryption if possible (key available on request)

### What to Include

When reporting a vulnerability, please include:

- **Description**: Clear description of the vulnerability
- **Impact**: What an attacker could potentially do
- **Steps to Reproduce**: Detailed steps to reproduce the issue
- **Proof of Concept**: Code, screenshots, or recordings demonstrating the issue
- **Affected Versions**: Which versions are affected
- **Suggested Fix**: If you have ideas on how to fix it (optional)

### Response Timeline

- **Initial Response**: Within 48 hours of report
- **Triage**: Within 7 days
- **Fix Development**: Depends on severity
  - Critical: 24-48 hours
  - High: 7 days
  - Medium: 30 days
  - Low: 90 days
- **Public Disclosure**: 90 days after fix is available (coordinated disclosure)

### Severity Levels

We use the following severity levels (aligned with CVSS):

- **Critical (9.0-10.0)**: Immediate exploitation risk, data breach potential
- **High (7.0-8.9)**: Significant security impact, privilege escalation
- **Medium (4.0-6.9)**: Security concern requiring attention
- **Low (0.1-3.9)**: Minor security consideration

### What Happens Next

1. **Acknowledgment**: We'll acknowledge receipt of your report
2. **Investigation**: Our security team will investigate and validate
3. **Fix Development**: We'll develop and test a fix
4. **Notification**: We'll notify you when the fix is ready
5. **Release**: We'll release the fix and publish a security advisory
6. **Credit**: We'll credit you in the advisory (if desired)

### Bug Bounty

Currently, we do not offer a bug bounty program. However, we deeply appreciate responsible disclosure and will publicly acknowledge security researchers who help improve Cloud Gallery's security.

### Security Best Practices for Users

While using Cloud Gallery, follow these security best practices:

1. **Keep Updated**: Always use the latest version
2. **Secure Device**: Use device lock screen and encryption
3. **App Permissions**: Only grant necessary permissions
4. **Network Security**: Use trusted networks or VPN
5. **Backup**: Regularly backup your photos
6. **Review Access**: Periodically review app permissions

### Out of Scope

The following are typically out of scope for security reports:

- Issues in third-party dependencies (report to the dependency maintainer)
- Social engineering attacks
- Physical attacks on user devices
- Denial of Service attacks requiring significant resources
- Issues requiring jailbroken/rooted devices (unless critical)
- Issues in old, unsupported versions

### Hall of Fame

We maintain a list of security researchers who have responsibly disclosed vulnerabilities:

<!-- To be populated as reports come in -->

*No vulnerabilities reported yet*

---

## Security Resources

- **Security Documentation**: See [docs/security/](docs/security/00_INDEX.md)
- **Threat Model**: See [docs/security/10_THREAT_MODEL.md](docs/security/10_THREAT_MODEL.md)
- **Incident Response**: See [docs/security/60_INCIDENT_RESPONSE.md](docs/security/60_INCIDENT_RESPONSE.md)

Thank you for helping keep Cloud Gallery secure! 🔒
