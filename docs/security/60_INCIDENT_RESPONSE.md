# Incident Response and Recovery

**Status**: 🟡 Plan Defined, Testing Needed  
**Owner**: Security/Operations Team  
**Last Updated**: 2024-01-10

## Overview

A comprehensive incident response plan enables Cloud Gallery to detect, respond to, contain, and recover from security incidents efficiently. This document defines incident classification, response procedures, roles and responsibilities, and recovery processes.

## Incident Classification and Severity Levels

### Severity Matrix

| Severity | Impact | Response Time | Escalation | Examples |
|----------|--------|---------------|------------|----------|
| **P0 - Critical** | Data breach, service outage affecting all users | 15 minutes | CISO, CEO | Database breach, ransomware, credential leak |
| **P1 - High** | Compromised accounts, limited data exposure | 1 hour | Security Lead | Admin account compromise, SQL injection in production |
| **P2 - Medium** | Vulnerability discovered, no active exploitation | 4 hours | Security Team | XSS vulnerability, outdated dependency with CVE |
| **P3 - Low** | Minor security issue, minimal risk | 24 hours | Security Team | Misconfigured CORS in development, weak password accepted |

### Severity Calculation

```typescript
// Severity rubric algorithm
interface IncidentMetrics {
  dataExposure: 'none' | 'limited' | 'moderate' | 'extensive';
  userImpact: 'none' | 'single' | 'multiple' | 'all';
  confidentiality: boolean;  // Data confidentiality breached?
  integrity: boolean;        // Data integrity compromised?
  availability: boolean;     // Service availability impacted?
  exploitation: 'none' | 'theoretical' | 'active';
}

function calculateSeverity(incident: IncidentMetrics): 'P0' | 'P1' | 'P2' | 'P3' {
  let score = 0;
  
  // Data exposure scoring
  const exposureScore = {
    'none': 0,
    'limited': 1,
    'moderate': 2,
    'extensive': 3,
  };
  score += exposureScore[incident.dataExposure];
  
  // User impact scoring
  const impactScore = {
    'none': 0,
    'single': 1,
    'multiple': 2,
    'all': 3,
  };
  score += impactScore[incident.userImpact];
  
  // CIA triad (each +1)
  if (incident.confidentiality) score += 1;
  if (incident.integrity) score += 1;
  if (incident.availability) score += 1;
  
  // Active exploitation doubles score
  if (incident.exploitation === 'active') score *= 2;
  
  // Calculate severity
  if (score >= 10) return 'P0'; // Critical
  if (score >= 6) return 'P1';  // High
  if (score >= 3) return 'P2';  // Medium
  return 'P3';                   // Low
}
```

**Example Classifications**:

```typescript
// P0 - Critical: Active data breach
const criticalIncident: IncidentMetrics = {
  dataExposure: 'extensive',      // User emails, names leaked
  userImpact: 'all',              // All users affected
  confidentiality: true,          // PII exposed
  integrity: false,
  availability: false,
  exploitation: 'active',         // Attacker actively downloading data
};
// Score: (3 + 3 + 1) * 2 = 14 → P0

// P1 - High: SQL injection vulnerability exploited
const highIncident: IncidentMetrics = {
  dataExposure: 'moderate',       // Album metadata exposed
  userImpact: 'multiple',         // 50 users affected
  confidentiality: true,
  integrity: true,                // Attacker modified data
  availability: false,
  exploitation: 'active',
};
// Score: (2 + 2 + 1 + 1) * 2 = 12 → P0 (reclassified due to exploitation)

// P2 - Medium: Vulnerability disclosed, no exploitation
const mediumIncident: IncidentMetrics = {
  dataExposure: 'none',
  userImpact: 'none',
  confidentiality: false,
  integrity: false,
  availability: false,
  exploitation: 'theoretical',    // PoC published but no active attacks
};
// Score: 0 → P3, but upgraded to P2 due to public disclosure

// P3 - Low: Development environment misconfiguration
const lowIncident: IncidentMetrics = {
  dataExposure: 'none',
  userImpact: 'none',
  confidentiality: false,
  integrity: false,
  availability: false,
  exploitation: 'none',
};
// Score: 0 → P3
```

## Response Team Roles and Responsibilities

### Incident Response Team Structure

```yaml
Incident Commander (IC):
  Role: Overall incident coordination and decision-making
  Responsibilities:
    - Declare incident and severity level
    - Coordinate response team
    - Authorize emergency changes
    - Interface with executive leadership
    - Approve communications to customers
  On-Call: Security Lead (primary), Engineering Manager (backup)
  Contact: security-lead@company.com, +1-555-0100

Technical Lead (TL):
  Role: Technical investigation and remediation
  Responsibilities:
    - Analyze logs and forensics evidence
    - Identify root cause and attack vector
    - Implement technical fixes
    - Coordinate with engineering team
    - Document technical findings
  On-Call: Senior Backend Engineer (rotating)
  Contact: on-call-engineering@company.com, PagerDuty

Communications Lead (CL):
  Role: Internal and external communications
  Responsibilities:
    - Draft customer notifications
    - Update status page
    - Coordinate with PR/Legal
    - Manage social media response
    - Document timeline for postmortem
  On-Call: Product Manager (primary), Customer Success (backup)
  Contact: communications@company.com

Legal/Compliance:
  Role: Regulatory and legal guidance
  Responsibilities:
    - Assess regulatory reporting requirements (GDPR, CCPA)
    - Advise on customer notification obligations
    - Coordinate with law enforcement if needed
    - Review public statements
    - Document for potential litigation
  Contact: legal@company.com

Executive Sponsor:
  Role: Business decisions and resource allocation
  Responsibilities:
    - Approve major decisions (e.g., service shutdown)
    - Allocate emergency resources
    - Approve customer compensation
    - Interface with board of directors
  Contact: CTO (P0/P1), CEO (P0 only)
```

### RACI Matrix

| Activity | IC | TL | CL | Legal | Exec |
|----------|----|----|----|----|------|
| Declare incident | **R** | C | I | I | I |
| Severity assessment | **R** | C | I | C | I |
| Technical analysis | I | **R** | I | I | I |
| Implement fixes | A | **R** | I | I | I |
| Customer notification | **A** | I | **R** | C | C |
| Regulatory reporting | C | I | C | **R** | A |
| Postmortem | **A** | **R** | **R** | C | I |

**Legend**: R=Responsible, A=Accountable, C=Consulted, I=Informed

## Communication Plan

### Internal Communications

**Incident War Room** (Slack):
```markdown
# #incident-2024-01-10-001

**Severity**: P0 - Critical
**Status**: 🔴 Active Investigation
**Incident Commander**: @security-lead
**Technical Lead**: @backend-engineer
**Started**: 2024-01-10 15:23 UTC

## Current Status (updated every 15 min)
15:23 - Incident declared: Unauthorized access to user database
15:30 - Database access revoked, attacker IP blocked
15:45 - Forensics analysis in progress
16:00 - Breach confirmed: 1,234 user emails exposed

## Action Items
- [x] Block attacker IP (@tl)
- [x] Revoke database credentials (@tl)
- [ ] Identify entry point (@tl) - ETA 16:30
- [ ] Draft customer notification (@cl) - ETA 17:00
- [ ] Notify GDPR authority (@legal) - ETA 18:00

## Timeline
| Time | Event |
|------|-------|
| 15:15 | Alert triggered: Unusual database query |
| 15:20 | Security team investigated |
| 15:23 | Incident confirmed and declared |
| 15:30 | Containment actions completed |

## Stakeholders
- Engineering: @dev-team
- Customer Success: @cs-team
- Legal: @legal-team
- Executive: @cto
```

**Update Cadence**:
- **P0**: Every 15 minutes
- **P1**: Every 30 minutes
- **P2**: Every 4 hours
- **P3**: Daily

### External Communications

**Status Page** (status.cloudgallery.app):
```markdown
## Security Incident - Investigating (Jan 10, 2024, 15:30 UTC)

We are investigating a potential security issue affecting user data. 
We have taken immediate action to protect our systems and are working 
to understand the full scope of the issue.

We will provide updates every 30 minutes until resolved.

**Impact**: Login and photo upload temporarily disabled

**Next Update**: 16:00 UTC

---

## Update - Incident Contained (Jan 10, 2024, 16:15 UTC)

We have identified and contained a security incident that resulted in 
unauthorized access to a limited set of user email addresses. No passwords, 
payment information, or photos were accessed.

**Affected Users**: Approximately 1,234 users (0.5% of user base)

**Actions Taken**:
- Blocked unauthorized access
- Reset affected authentication systems
- Notified affected users via email
- Engaged third-party security firm for forensic analysis

**Required Actions**:
- Affected users: Check your email for notification and guidance
- All users: We recommend updating your password as a precaution

We sincerely apologize for this incident and are committed to preventing 
future occurrences.

**Next Update**: 18:00 UTC (or sooner if significant developments)
```

**Customer Notification Email**:
```html
Subject: Important Security Notice - Action Required

Dear [Name],

We are writing to inform you about a security incident that may have 
affected your Cloud Gallery account.

What Happened:
On January 10, 2024, we detected and immediately stopped unauthorized 
access to our systems. This incident resulted in exposure of email 
addresses for approximately 1,234 users, including yours.

What Was NOT Affected:
- Passwords (remain securely encrypted)
- Payment information (we do not store payment data)
- Photos and albums (not accessed)
- Other personal information

What We're Doing:
- Implemented additional security measures
- Engaged third-party security experts
- Reported incident to relevant authorities
- Conducting full security audit

What You Should Do:
1. Change your password immediately (use link below)
2. Enable two-factor authentication (recommended)
3. Review recent account activity
4. Be alert for phishing emails (we will never ask for your password)

Update Password: https://cloudgallery.app/reset-password?token=...

We take your security seriously and sincerely apologize for this incident. 
If you have questions, please contact security@cloudgallery.app.

Thank you for your understanding,
Cloud Gallery Security Team

---
Report Received: [Date]
Notification Sent: [Date]
Incident ID: INC-2024-001
```

**Social Media Response** (Twitter/X):
```
We're currently investigating a security incident affecting some user 
accounts. We've taken immediate action to protect our systems. Affected 
users will receive direct email notification. More info: 
https://status.cloudgallery.app #SecurityUpdate
```

### Notification Requirements

**GDPR (EU Users)**:
- **Timeline**: Within 72 hours of discovery
- **Authority**: Data Protection Authority in affected EU country
- **Content**: Nature of breach, categories of data, number of users, remediation steps
- **Portal**: https://edpb.europa.eu/about-edpb/board/members_en

**CCPA (California Users)**:
- **Timeline**: "Without unreasonable delay"
- **Authority**: California Attorney General
- **Threshold**: 500+ California residents affected
- **Portal**: https://oag.ca.gov/privacy/databreach/reporting

**User Notification**:
- **Timeline**: "Without undue delay" after discovery
- **Method**: Direct email + status page
- **Content**: What happened, what data affected, what actions taken, what user should do

## Secret Leak Playbook

### Detection

**Automated Detection**:
```yaml
# .github/workflows/secret-detection.yml
name: Secret Scanning

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  detect-secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - name: TruffleHog Secret Scan
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --json --only-verified
      
      - name: Notify Security Team
        if: failure()
        uses: 8398a7/action-slack@v3
        with:
          status: failure
          text: '🚨 Secret detected in commit ${{ github.sha }}'
          webhook_url: ${{ secrets.SLACK_WEBHOOK_SECURITY }}
```

**Manual Detection Indicators**:
- Unusual authentication patterns in logs
- Unexpected API usage spikes
- Third-party service notifications (e.g., AWS GuardDuty)
- External security researcher report

### Secret Leak Response Timeline

```
T+0 min (Discovery)
├─ Alert security team
├─ Create incident ticket
└─ Assess secret type and exposure

T+15 min (Containment)
├─ Rotate compromised secret immediately
├─ Revoke API keys/tokens
├─ Block affected service account
└─ Enable enhanced monitoring

T+30 min (Investigation)
├─ Identify all exposed locations (Git history, logs, backups)
├─ Determine exposure duration
├─ Check for unauthorized usage (audit logs)
└─ Identify affected systems/users

T+1 hour (Remediation)
├─ Purge secret from Git history (BFG Repo-Cleaner)
├─ Update all services with new credentials
├─ Verify old credentials fully disabled
└─ Scan for other exposed secrets

T+2 hours (Notification)
├─ Notify affected users (if applicable)
├─ File incident report
└─ Update postmortem document

T+24 hours (Prevention)
├─ Add secret to secret scanner patterns
├─ Implement additional guardrails
└─ Security training for responsible party
```

### Secret Rotation Procedures

**Database Credentials**:
```bash
#!/bin/bash
# scripts/rotate-db-credentials.sh

echo "🔄 Rotating database credentials..."

# 1. Create new credentials
NEW_USER="cloud_gallery_$(date +%s)"
NEW_PASS=$(openssl rand -base64 32)

# 2. Create new database user
psql -U admin -c "CREATE USER $NEW_USER WITH PASSWORD '$NEW_PASS';"
psql -U admin -c "GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $NEW_USER;"

# 3. Update application configuration (zero-downtime)
kubectl set env deployment/api DATABASE_USER=$NEW_USER DATABASE_PASS=$NEW_PASS

# 4. Wait for rollout
kubectl rollout status deployment/api

# 5. Revoke old credentials
OLD_USER=$(kubectl get deployment/api -o jsonpath='{.spec.template.spec.containers[0].env[?(@.name=="DATABASE_USER")].value}')
psql -U admin -c "REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM $OLD_USER;"
psql -U admin -c "DROP USER $OLD_USER;"

echo "✅ Database credentials rotated successfully"
```

**API Keys**:
```bash
#!/bin/bash
# scripts/rotate-api-keys.sh

echo "🔄 Rotating API keys..."

# 1. Generate new key
NEW_KEY=$(uuidgen)

# 2. Add new key to database (grace period: 1 hour)
psql -U admin -c "INSERT INTO api_keys (key, expires_at) VALUES ('$NEW_KEY', NOW() + INTERVAL '1 hour');"

# 3. Update documentation
echo "New API Key: $NEW_KEY" >> docs/API_KEYS.md

# 4. Notify API consumers
./scripts/notify-api-consumers.sh "$NEW_KEY"

# 5. Wait for grace period
echo "Waiting 1 hour for consumers to migrate..."
sleep 3600

# 6. Revoke old key
OLD_KEY=$(psql -U admin -t -c "SELECT key FROM api_keys WHERE expires_at < NOW() - INTERVAL '1 hour' LIMIT 1;")
psql -U admin -c "DELETE FROM api_keys WHERE key = '$OLD_KEY';"

echo "✅ API key rotated successfully"
```

**JWT Secret**:
```bash
#!/bin/bash
# scripts/rotate-jwt-secret.sh

echo "🔄 Rotating JWT secret..."

# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. Add new secret to key rotation (dual-key support)
kubectl create secret generic jwt-secrets \
  --from-literal=current=$NEW_SECRET \
  --from-literal=previous=$CURRENT_SECRET \
  --dry-run=client -o yaml | kubectl apply -f -

# 3. Update application to validate both keys (grace period: 7 days)
kubectl set env deployment/api JWT_SECRETS="current,previous"

# 4. Wait for all tokens to expire (max 7 days)
echo "Waiting 7 days for token expiration..."
# In production, monitor token usage and proceed when old tokens < 1%

# 5. Remove old secret
kubectl create secret generic jwt-secrets \
  --from-literal=current=$NEW_SECRET \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✅ JWT secret rotated successfully"
```

### Git History Cleansing

```bash
#!/bin/bash
# scripts/purge-secret-from-git.sh

SECRET_PATTERN=$1

if [ -z "$SECRET_PATTERN" ]; then
  echo "Usage: ./purge-secret-from-git.sh <secret-pattern>"
  exit 1
fi

echo "⚠️  WARNING: This will rewrite Git history!"
echo "Pattern to remove: $SECRET_PATTERN"
read -p "Continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
  exit 0
fi

# 1. Install BFG Repo-Cleaner
brew install bfg  # macOS
# apt-get install bfg  # Linux

# 2. Clone a fresh copy
git clone --mirror https://github.com/company/cloud-gallery.git
cd cloud-gallery.git

# 3. Remove secret from all history
bfg --replace-text <(echo "$SECRET_PATTERN==>***REMOVED***")

# 4. Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push (DESTRUCTIVE!)
git push --force

echo "✅ Secret purged from Git history"
echo "⚠️  All developers must re-clone repository!"
```

### Audit After Secret Leak

```typescript
// scripts/audit-secret-usage.ts
import { getAuditLogs } from './lib/database';

interface SecretLeakAudit {
  secretType: string;
  exposedAt: Date;
  discoveredAt: Date;
  exposureDuration: number; // milliseconds
  suspiciousActivity: AuditEntry[];
  affectedResources: string[];
}

async function auditSecretLeak(
  secretType: string,
  exposedAt: Date,
  discoveredAt: Date
): Promise<SecretLeakAudit> {
  const exposureDuration = discoveredAt.getTime() - exposedAt.getTime();
  
  // Get all audit logs during exposure window
  const auditLogs = await getAuditLogs({
    startTime: exposedAt,
    endTime: discoveredAt,
    secretType,
  });
  
  // Identify suspicious activity
  const suspiciousActivity = auditLogs.filter(entry => {
    // Flag unusual patterns
    return (
      entry.action === 'data_export' ||
      entry.action === 'permission_change' ||
      entry.statusCode === 401 || // Failed auth attempts
      entry.ip && isUnusualIP(entry.ip) ||
      entry.userAgent && isUnusualUserAgent(entry.userAgent)
    );
  });
  
  // Identify affected resources
  const affectedResources = [
    ...new Set(auditLogs.map(entry => entry.resource))
  ];
  
  return {
    secretType,
    exposedAt,
    discoveredAt,
    exposureDuration,
    suspiciousActivity,
    affectedResources,
  };
}

// Example usage
const audit = await auditSecretLeak(
  'DATABASE_PASSWORD',
  new Date('2024-01-01T00:00:00Z'),
  new Date('2024-01-10T15:23:00Z')
);

console.log(`
Exposure Duration: ${audit.exposureDuration / (1000 * 60 * 60 * 24)} days
Suspicious Activity: ${audit.suspiciousActivity.length} events
Affected Resources: ${audit.affectedResources.join(', ')}
`);

if (audit.suspiciousActivity.length > 0) {
  console.error('⚠️  POTENTIAL UNAUTHORIZED ACCESS DETECTED');
  console.log(JSON.stringify(audit.suspiciousActivity, null, 2));
}
```

## Vulnerability Disclosure Policy

### Public Disclosure Policy

```markdown
# Security Vulnerability Disclosure Policy

Cloud Gallery welcomes security researchers to report vulnerabilities 
responsibly. We are committed to working with the security community to 
verify and respond to legitimate reports.

## Reporting a Vulnerability

**Email**: security@cloudgallery.app
**PGP Key**: https://cloudgallery.app/.well-known/pgp-key.txt

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your contact information (optional, for updates)

## What to Expect

1. **Acknowledgment**: Within 24 hours
2. **Initial Assessment**: Within 72 hours
3. **Regular Updates**: Every 7 days until resolved
4. **Resolution Timeline**: 
   - Critical: 7 days
   - High: 30 days
   - Medium: 60 days
   - Low: 90 days

## Our Commitment

- We will not pursue legal action against researchers acting in good faith
- We will credit researchers in our security advisories (if desired)
- We will keep you informed of our progress

## Scope

**In Scope**:
- cloudgallery.app (production)
- api.cloudgallery.app
- Mobile apps (iOS, Android)

**Out of Scope**:
- staging.cloudgallery.app (testing environment)
- Third-party services we use
- Social engineering attacks
- Physical security

## Safe Harbor

We consider security research conducted in good faith to be:
- Authorized under the Computer Fraud and Abuse Act (CFAA)
- Exempt from DMCA anti-circumvention provisions
- Protected from legal action

## Guidelines

**DO**:
- Report vulnerabilities promptly
- Give us reasonable time to fix issues
- Keep vulnerability details confidential until resolved
- Test only your own accounts

**DON'T**:
- Access other users' data
- Perform denial-of-service attacks
- Spam or social engineer our users
- Physically test our facilities

## Recognition

We maintain a Hall of Fame for security researchers:
https://cloudgallery.app/security/hall-of-fame

Thank you for helping keep Cloud Gallery secure!
```

### Coordinated Disclosure Process

```
Reporter Submits Vulnerability
          ↓
    [24 hours]
          ↓
Security Team Acknowledges
          ↓
    [72 hours]
          ↓
Initial Triage & Severity Assessment
          ↓
    [7-90 days depending on severity]
          ↓
Development & Testing of Fix
          ↓
Deploy Fix to Production
          ↓
    [7 days grace period]
          ↓
Coordinated Public Disclosure
          ↓
Security Advisory Published
```

## Patch Management Process

### Vulnerability Triage Severity Rubric

```typescript
interface VulnerabilityAssessment {
  cvss: number;              // CVSS score (0-10)
  exploitability: 'none' | 'poc' | 'functional' | 'weaponized';
  affectedUsers: number;
  attackVector: 'network' | 'adjacent' | 'local' | 'physical';
  privileges: 'none' | 'low' | 'high';
  dataImpact: 'none' | 'limited' | 'significant';
}

function calculatePatchPriority(vuln: VulnerabilityAssessment): 'P0' | 'P1' | 'P2' | 'P3' {
  // Critical (P0): Immediate patch required
  if (
    vuln.cvss >= 9.0 ||
    (vuln.cvss >= 7.0 && vuln.exploitability === 'weaponized') ||
    (vuln.attackVector === 'network' && vuln.privileges === 'none' && vuln.affectedUsers > 1000)
  ) {
    return 'P0';
  }
  
  // High (P1): Patch within 7 days
  if (
    vuln.cvss >= 7.0 ||
    (vuln.cvss >= 5.0 && vuln.exploitability === 'functional') ||
    vuln.dataImpact === 'significant'
  ) {
    return 'P1';
  }
  
  // Medium (P2): Patch within 30 days
  if (
    vuln.cvss >= 4.0 ||
    vuln.exploitability === 'poc'
  ) {
    return 'P2';
  }
  
  // Low (P3): Patch within 90 days
  return 'P3';
}
```

**Patch SLAs**:
- **P0 (Critical)**: 24 hours
- **P1 (High)**: 7 days
- **P2 (Medium)**: 30 days
- **P3 (Low)**: 90 days

### Patch Deployment Process

```bash
#!/bin/bash
# scripts/emergency-patch.sh

VULNERABILITY=$1
FIX_BRANCH=$2

echo "🚨 Emergency Patch Deployment"
echo "Vulnerability: $VULNERABILITY"
echo "Fix Branch: $FIX_BRANCH"

# 1. Fast-track code review (security team only)
echo "Requesting security review..."
gh pr create --title "SECURITY: Fix $VULNERABILITY" \
  --body "Emergency security patch. Security team review only." \
  --label "security,priority:critical"

# 2. Run security tests
echo "Running security tests..."
npm run test:security

# 3. Deploy to staging for verification
echo "Deploying to staging..."
git push staging $FIX_BRANCH:main

# 4. Smoke test critical paths
echo "Running smoke tests..."
npm run test:smoke -- --env=staging

# 5. Production deployment (with rollback plan)
echo "Deploying to production..."
git push production $FIX_BRANCH:main

# 6. Monitor for issues (30 min observation)
echo "Monitoring deployment..."
kubectl logs -f deployment/api --since=30m | grep -i "error\|exception"

# 7. Verify fix effectiveness
echo "Verifying fix..."
npm run test:vulnerability -- --vuln=$VULNERABILITY

echo "✅ Emergency patch deployed successfully"
```

### Rollback Procedure

```bash
#!/bin/bash
# scripts/rollback-deployment.sh

PREVIOUS_VERSION=$1

echo "⏪ Rolling back deployment..."

# 1. Immediate rollback
kubectl rollout undo deployment/api

# 2. Verify rollback
kubectl rollout status deployment/api

# 3. Update DNS/load balancer if needed
# (if deployment was multi-stage)

# 4. Verify service health
curl -f https://api.cloudgallery.app/health || exit 1

# 5. Notify team
./scripts/notify-team.sh "Rollback completed: $PREVIOUS_VERSION"

echo "✅ Rollback successful"
```

## Escalation Procedures

### Escalation Triggers

**Automatic Escalation**:
1. Incident unresolved after 2x expected resolution time
2. Severity increases (e.g., P2 → P1)
3. Customer impact exceeds threshold (>10% users)
4. Data breach confirmed
5. Regulatory reporting deadline approaching

**Manual Escalation**:
1. Incident Commander requests escalation
2. Technical complexity exceeds team capability
3. Business decision required
4. External resources needed (legal, PR, vendors)

### Escalation Path

```
Level 1: On-Call Engineer
         ↓ (Unable to resolve in 30 min)
Level 2: Security Team Lead
         ↓ (Unable to resolve in 1 hour)
Level 3: Engineering Manager + Security Lead
         ↓ (Unable to resolve in 2 hours OR P0/P1)
Level 4: CTO
         ↓ (Data breach OR regulatory issue)
Level 5: CEO + Legal + CISO
```

### Escalation Communication

```markdown
## Escalation Notification

**From**: Level 2 (Security Team Lead)
**To**: Level 3 (Engineering Manager + Security Lead)
**Incident**: INC-2024-001
**Severity**: P1 (High)
**Escalation Reason**: Unable to identify entry point after 1 hour

## Current Status
- Incident started: 2024-01-10 15:23 UTC (1.5 hours ago)
- Attacker access blocked: 15:30 UTC
- Data exposure confirmed: 1,234 user emails
- Root cause: Unknown (investigation ongoing)

## Blockers
- Attack vector not identified
- Need database forensics expertise
- Potential need for external security firm

## Requested Support
- Database forensics specialist
- Approval to engage external incident response team
- Guidance on customer notification timing

## Next Steps if Approved
1. Engage external IR firm (CrowdStrike / Mandiant)
2. Preserve evidence for forensic analysis
3. Expand monitoring to catch any ongoing activity
```

## Postmortem Template

```markdown
# Incident Postmortem: [Incident Title]

**Incident ID**: INC-2024-001
**Date**: 2024-01-10
**Severity**: P0 - Critical
**Duration**: 4 hours 37 minutes
**Impact**: 1,234 users, 0.5% of user base

## Executive Summary

In 50-100 words, describe:
- What happened
- Impact on users/business
- Root cause
- Key lessons learned

## Timeline

All times in UTC.

| Time | Event | Owner |
|------|-------|-------|
| 15:15 | Alert triggered: Unusual database queries | Monitoring |
| 15:20 | On-call engineer investigated alert | @engineer |
| 15:23 | Incident declared (P0) | @security-lead |
| 15:30 | Attacker IP blocked, database access revoked | @engineer |
| 15:45 | Forensics analysis started | @security-lead |
| 16:00 | Data breach confirmed: 1,234 user emails exposed | @security-lead |
| 16:15 | Customer notification drafted | @comms-lead |
| 17:00 | Affected users notified via email | @comms-lead |
| 18:00 | GDPR notification filed | @legal |
| 19:52 | Root cause identified: SQL injection in /api/search | @engineer |
| 20:00 | Fix deployed to production | @engineer |

## Root Cause

**Vulnerability**: SQL injection in album search endpoint

**Location**: `server/controllers/album.ts:145-150`

**Introduced**: 2024-01-05 (PR #234 - "Add advanced search")

**Attack Vector**:
```typescript
// Vulnerable code
const albums = await db.query(
  `SELECT * FROM albums WHERE title LIKE '%${req.query.q}%'`
);

// Attacker payload
GET /api/albums/search?q=' UNION SELECT email FROM users --
```

**Why Not Caught**:
1. PR lacked security review (bypassed via "hotfix" label)
2. Input validation tests missing for search endpoint
3. SQL injection scanner not run on PR (CI/CD gap)

## Impact

**Users Affected**: 1,234 (0.5% of user base)

**Data Exposed**:
- ✅ User email addresses
- ❌ Passwords (NOT exposed - properly hashed)
- ❌ Photos (NOT exposed - separate storage)
- ❌ Payment info (NOT exposed - not stored)

**Business Impact**:
- User trust damage
- Regulatory fines (potential): €10,000 - €50,000 (GDPR)
- Customer support load: 245 tickets
- Engineering time: 40 hours (incident response + fix)

## What Went Well

- ✅ Monitoring detected unusual activity within 5 minutes
- ✅ Containment completed in 15 minutes (blocked attacker)
- ✅ Clear escalation path followed
- ✅ Customer notification within 2 hours
- ✅ GDPR notification within 72 hours

## What Went Wrong

- ❌ Vulnerable code merged without security review
- ❌ No input validation on user-facing search
- ❌ SQL injection scanner not integrated into CI/CD
- ❌ Audit logging insufficient (couldn't determine full extent immediately)

## Action Items

| ID | Action | Owner | Deadline | Priority |
|----|--------|-------|----------|----------|
| AI-1 | Add SQL injection scanner to CI/CD | @eng-manager | 2024-01-15 | P0 |
| AI-2 | Mandatory security review for all DB queries | @security-lead | 2024-01-15 | P0 |
| AI-3 | Implement parameterized queries across codebase | @backend-team | 2024-01-30 | P0 |
| AI-4 | Enhance audit logging for data access | @backend-team | 2024-02-15 | P1 |
| AI-5 | Security training for all engineers | @security-lead | 2024-02-28 | P1 |
| AI-6 | Penetration test for all endpoints | @security-lead | 2024-03-15 | P1 |
| AI-7 | Implement database activity monitoring (DAM) | @devops | 2024-03-31 | P2 |

## Lessons Learned

1. **Process over urgency**: "Hotfix" label should not bypass security review
2. **Defense in depth**: Input validation + parameterized queries + monitoring
3. **Automation**: Manual security reviews don't scale - need automated scanning
4. **Testing**: Security tests as important as functional tests

## References

- Incident Slack thread: #incident-2024-01-10-001
- Forensics report: docs/security/forensics/INC-2024-001.pdf
- Customer notification: docs/security/notifications/INC-2024-001.txt
- GDPR filing: docs/security/compliance/GDPR-INC-2024-001.pdf

---

**Postmortem Review**:
- Reviewed by: @security-team, @eng-team
- Approved by: @cto
- Date: 2024-01-12
```

## Recovery Procedures

### Service Recovery Checklist

```markdown
## Recovery Checklist for [Incident ID]

### Immediate Recovery (T+0 to T+1 hour)
- [ ] Attacker access blocked (IP, credentials, accounts)
- [ ] Affected services restarted
- [ ] Database connections reset
- [ ] Caches cleared
- [ ] Health checks passing

### Data Integrity (T+1 to T+4 hours)
- [ ] Database integrity check completed
- [ ] Unauthorized modifications identified and reverted
- [ ] Backups validated (uncorrupted)
- [ ] Data reconciliation completed
- [ ] Audit trail reviewed for tampering

### System Hardening (T+4 to T+24 hours)
- [ ] Vulnerability patched
- [ ] Additional monitoring deployed
- [ ] Access controls tightened
- [ ] Security controls tested
- [ ] Penetration test of fix completed

### User Recovery (T+24 to T+72 hours)
- [ ] Affected users notified
- [ ] Password resets (if needed)
- [ ] Account reviews completed
- [ ] Support tickets resolved
- [ ] User confidence restored

### Long-Term Prevention (T+72 hours onwards)
- [ ] Postmortem completed
- [ ] Action items assigned
- [ ] Security training scheduled
- [ ] Process improvements implemented
- [ ] Monitoring enhancements deployed
```

### Data Recovery

```bash
#!/bin/bash
# scripts/recover-from-backup.sh

BACKUP_TIMESTAMP=$1

echo "🔄 Recovering database from backup..."
echo "Backup timestamp: $BACKUP_TIMESTAMP"

# 1. Stop application (prevent new writes)
kubectl scale deployment/api --replicas=0

# 2. Backup current state (in case recovery fails)
pg_dump -U postgres cloud_gallery > /tmp/pre-recovery-backup.sql

# 3. Restore from backup
pg_restore -U postgres -d cloud_gallery /backups/cloud_gallery_$BACKUP_TIMESTAMP.dump

# 4. Verify restoration
RECORD_COUNT=$(psql -U postgres -d cloud_gallery -t -c "SELECT COUNT(*) FROM photos;")
echo "Restored $RECORD_COUNT photos"

# 5. Run data integrity checks
npm run db:integrity-check

# 6. Restart application
kubectl scale deployment/api --replicas=3

# 7. Verify application health
sleep 30
curl -f https://api.cloudgallery.app/health || exit 1

echo "✅ Recovery completed successfully"
```

## Evidence Preservation

### Forensics Capture

```bash
#!/bin/bash
# scripts/capture-forensics.sh

INCIDENT_ID=$1
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
EVIDENCE_DIR="/forensics/$INCIDENT_ID/$TIMESTAMP"

mkdir -p $EVIDENCE_DIR

echo "📦 Capturing forensics evidence for $INCIDENT_ID..."

# 1. System state
uname -a > $EVIDENCE_DIR/system-info.txt
ps auxww > $EVIDENCE_DIR/processes.txt
netstat -an > $EVIDENCE_DIR/network-connections.txt

# 2. Application logs (last 24 hours)
cp -r /var/log/cloud-gallery/*.log $EVIDENCE_DIR/logs/

# 3. Database query log
psql -U postgres -c "SELECT * FROM pg_stat_statements;" > $EVIDENCE_DIR/db-queries.txt

# 4. Web server access logs
cp /var/log/nginx/access.log $EVIDENCE_DIR/nginx-access.log
cp /var/log/nginx/error.log $EVIDENCE_DIR/nginx-error.log

# 5. Security logs
cp /var/log/auth.log $EVIDENCE_DIR/auth.log
cp /var/log/fail2ban.log $EVIDENCE_DIR/fail2ban.log

# 6. Docker/Kubernetes state
kubectl get pods -o yaml > $EVIDENCE_DIR/k8s-pods.yaml
kubectl get deployments -o yaml > $EVIDENCE_DIR/k8s-deployments.yaml
docker ps -a > $EVIDENCE_DIR/docker-ps.txt

# 7. Create evidence manifest
cat > $EVIDENCE_DIR/MANIFEST.txt << EOF
Incident ID: $INCIDENT_ID
Capture Time: $TIMESTAMP
Captured By: $(whoami)
System: $(uname -a)

Files:
$(ls -lhR $EVIDENCE_DIR)
EOF

# 8. Create cryptographic hash of evidence
find $EVIDENCE_DIR -type f -exec sha256sum {} \; > $EVIDENCE_DIR/SHA256SUMS

# 9. Compress and seal evidence
tar czf $EVIDENCE_DIR.tar.gz $EVIDENCE_DIR
sha256sum $EVIDENCE_DIR.tar.gz > $EVIDENCE_DIR.tar.gz.sha256

echo "✅ Evidence captured: $EVIDENCE_DIR.tar.gz"
echo "SHA256: $(cat $EVIDENCE_DIR.tar.gz.sha256)"
```

### Chain of Custody

```markdown
## Evidence Chain of Custody

**Incident**: INC-2024-001
**Evidence ID**: EVIDENCE-2024-001
**Description**: Server logs, database queries, network traffic

### Custody Log

| Date/Time | Action | Person | Location | Notes |
|-----------|--------|--------|----------|-------|
| 2024-01-10 15:30 | Collected | @security-lead | Server: api-01 | Original evidence captured |
| 2024-01-10 16:00 | Transferred | @security-lead → @forensics-team | Encrypted USB drive | SHA256: abc123... |
| 2024-01-11 09:00 | Analysis Started | @forensics-team | Forensics Lab | Evidence integrity verified |
| 2024-01-12 17:00 | Analysis Completed | @forensics-team | Forensics Lab | Report generated |
| 2024-01-12 18:00 | Archived | @forensics-team | Secure Storage | 7-year retention |

### Integrity Verification

**Original Hash**: abc123def456...
**Current Hash**: abc123def456...
**Status**: ✅ Verified
**Last Checked**: 2024-01-12 18:00 UTC
```

## Customer Notification Requirements

### GDPR Requirements (EU)

**When Required**:
- Personal data breach
- High risk to rights and freedoms of individuals

**Timeline**:
- Authority notification: 72 hours
- Individual notification: "Without undue delay"

**Content**:
- Nature of breach
- Contact point for more information
- Likely consequences
- Measures taken/proposed

**Authority**: Data Protection Authority (per country)

### CCPA Requirements (California)

**When Required**:
- Unauthorized access or disclosure of personal information

**Timeline**:
- "Without unreasonable delay"

**Content**:
- Date range of breach
- Types of information
- Toll-free number for more information
- Measures taken

**Threshold**: 500+ California residents

### Breach Notification Requirements by State

| State | Timeline | Threshold | Authority Notification |
|-------|----------|-----------|------------------------|
| CA | Without unreasonable delay | 500+ residents | Attorney General |
| NY | Without unreasonable delay | Any | Attorney General |
| TX | Without unreasonable delay | 250+ residents | Attorney General |
| FL | 30 days | 500+ residents | Dept of Legal Affairs |
| All Others | Varies by state | Varies | Varies |

## Regulatory Reporting

### GDPR Breach Notification Form

```markdown
## GDPR Breach Notification

**Organization**: Cloud Gallery Inc.
**DPO Contact**: dpo@cloudgallery.app
**Notification Date**: 2024-01-12

### 1. Description of Breach
Nature of breach: Unauthorized access via SQL injection vulnerability
Date/time of breach: 2024-01-10 15:15 UTC
Date/time discovered: 2024-01-10 15:20 UTC

### 2. Categories and Numbers of Data Subjects
Individuals affected: 1,234
Categories: Users with accounts created between 2023-01-01 and 2024-01-10

### 3. Categories and Numbers of Records
Records affected: 1,234
Data types: Email addresses

### 4. Likely Consequences
- Phishing risk (email addresses exposed)
- Account takeover risk (mitigated by password not exposed)
- Spam/unwanted contact

### 5. Measures Taken or Proposed
Immediate:
- Blocked attacker access (15 min)
- Revoked compromised credentials
- Notified affected individuals

Preventative:
- Fixed SQL injection vulnerability
- Implemented input validation
- Enhanced monitoring
- Security training for developers

### 6. Cross-Border Breach
Other EU countries affected: None
Lead supervisory authority: [Country]
```

## References

- NIST Incident Response Guide: https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-61r2.pdf
- OWASP Incident Response: https://owasp.org/www-community/Incident_Response
- SANS Incident Response Process: https://www.sans.org/white-papers/incident-handling-process/
- GDPR Breach Notification: https://gdpr.eu/data-breach-notification/

---
*This document should be tested annually through tabletop exercises and updated after each incident.*
