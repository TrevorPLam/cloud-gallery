#!/bin/bash
# Security validation script for Cloud Gallery
# Run this locally before committing changes

set -e

echo "🔒 Cloud Gallery Security Validation Suite"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        ERRORS=$((ERRORS + 1))
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    WARNINGS=$((WARNINGS + 1))
}

# 1. Check for secrets in code
echo "1️⃣  Checking for secrets in code..."
if command -v gitleaks &> /dev/null; then
    gitleaks detect --no-git -v 2>&1 | grep -q "No leaks found" && SECRET_STATUS=0 || SECRET_STATUS=1
    print_status $SECRET_STATUS "Secret scanning"
else
    print_warning "gitleaks not installed - skipping secret scan (install: brew install gitleaks)"
fi

# 2. Dependency vulnerability check
echo ""
echo "2️⃣  Checking dependencies for vulnerabilities..."
if npm audit --audit-level=moderate > /dev/null 2>&1; then
    print_status 0 "Dependency vulnerability check"
else
    AUDIT_OUTPUT=$(npm audit --audit-level=moderate 2>&1 || true)
    if echo "$AUDIT_OUTPUT" | grep -q "found 0 vulnerabilities"; then
        print_status 0 "Dependency vulnerability check"
    else
        print_status 1 "Dependency vulnerability check - vulnerabilities found"
        echo "   Run 'npm audit' for details"
    fi
fi

# 3. Lint check
echo ""
echo "3️⃣  Running linter..."
if npm run lint > /dev/null 2>&1; then
    print_status 0 "Linting"
else
    print_status 1 "Linting - errors found"
    echo "   Run 'npm run lint' for details"
fi

# 4. Type check
echo ""
echo "4️⃣  Running TypeScript type check..."
if npm run check:types > /dev/null 2>&1; then
    print_status 0 "Type checking"
else
    print_status 1 "Type checking - errors found"
    echo "   Run 'npm run check:types' for details"
fi

# 5. Format check
echo ""
echo "5️⃣  Checking code formatting..."
if npm run check:format > /dev/null 2>&1; then
    print_status 0 "Code formatting"
else
    print_status 1 "Code formatting - issues found"
    echo "   Run 'npm run format' to auto-fix"
fi

# 6. Test execution
echo ""
echo "6️⃣  Running tests..."
if npm run test > /dev/null 2>&1; then
    print_status 0 "Tests"
else
    print_status 1 "Tests - failures found"
    echo "   Run 'npm run test' for details"
fi

# 7. Check for common security anti-patterns
echo ""
echo "7️⃣  Checking for security anti-patterns..."
ANTIPATTERN_FOUND=0

# Check for eval usage
if grep -r "eval(" server client shared --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "// SAFE:"; then
    print_warning "Found eval() usage - review for security implications"
fi

# Check for innerHTML usage
if grep -r "innerHTML" client --include="*.ts" --include="*.tsx" 2>/dev/null | grep -v "// SAFE:"; then
    print_warning "Found innerHTML usage - ensure proper sanitization"
fi

# Check for dangerouslySetInnerHTML
if grep -r "dangerouslySetInnerHTML" client --include="*.tsx" 2>/dev/null | grep -v "// SAFE:"; then
    print_warning "Found dangerouslySetInnerHTML - ensure proper sanitization"
fi

# Check for plaintext passwords
if grep -ri "password.*=.*['\"][^'\"]\{8,\}['\"]" server client shared --include="*.ts" --include="*.tsx" 2>/dev/null; then
    print_status 1 "Security anti-patterns check - possible hardcoded credentials"
    ANTIPATTERN_FOUND=1
fi

# Check for disabled SSL verification
if grep -r "rejectUnauthorized.*false\|NODE_TLS_REJECT_UNAUTHORIZED.*0" server client --include="*.ts" --include="*.tsx" 2>/dev/null; then
    print_status 1 "Security anti-patterns check - SSL verification disabled"
    ANTIPATTERN_FOUND=1
fi

if [ $ANTIPATTERN_FOUND -eq 0 ]; then
    print_status 0 "Security anti-patterns check"
fi

# 8. Check package-lock.json integrity
echo ""
echo "8️⃣  Verifying package-lock.json integrity..."
if [ -f "package-lock.json" ]; then
    # Check if package-lock is in sync with package.json
    if npm install --package-lock-only --dry-run > /dev/null 2>&1; then
        print_status 0 "Package lock integrity"
    else
        print_status 1 "Package lock integrity - out of sync"
        echo "   Run 'npm install' to sync"
    fi
else
    print_status 1 "Package lock integrity - package-lock.json missing"
fi

# 9. Check for TODO/FIXME security comments
echo ""
echo "9️⃣  Checking for security TODOs..."
SECURITY_TODOS=$(grep -r "TODO.*security\|FIXME.*security\|SECURITY.*TODO" server client shared --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l || echo "0")
if [ "$SECURITY_TODOS" -gt 0 ]; then
    print_warning "Found $SECURITY_TODOS security-related TODOs/FIXMEs to address"
else
    print_status 0 "Security TODOs check"
fi

# Summary
echo ""
echo "=========================================="
echo "📊 Security Validation Summary"
echo "=========================================="
echo -e "Errors: ${RED}$ERRORS${NC}"
echo -e "Warnings: ${YELLOW}$WARNINGS${NC}"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All security checks passed!${NC}"
    echo "You're good to commit! 🚀"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠️  All checks passed with warnings${NC}"
    echo "Please review warnings before committing"
    exit 0
else
    echo -e "${RED}❌ Security validation failed!${NC}"
    echo "Please fix errors before committing"
    exit 1
fi
