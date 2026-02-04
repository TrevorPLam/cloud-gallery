#!/bin/bash
# Validation script for security documentation

set -e

echo "🔍 Validating Cloud Gallery Security Documentation"
echo "=================================================="
echo ""

# Check all files exist
echo "✓ Checking file existence..."
for file in 00_INDEX.md 10_THREAT_MODEL.md 11_IDENTITY_AND_ACCESS.md 12_CRYPTO_POLICY.md 13_APPSEC_BOUNDARIES.md; do
    if [ -f "docs/security/$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file MISSING"
        exit 1
    fi
done
echo ""

# Check evidence files exist
echo "✓ Checking evidence-linked files..."
evidence_files=(
    "server/index.ts"
    "client/lib/storage.ts"
    "shared/schema.ts"
    "package.json"
    "package-lock.json"
)
for file in "${evidence_files[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ⚠️  $file not found (may be moved)"
    fi
done
echo ""

# Check for broken internal links
echo "✓ Checking internal documentation links..."
broken_links=0
for md_file in docs/security/*.md; do
    while IFS= read -r link; do
        link_path=$(echo "$link" | sed 's/.*(\.\///;s/).*//')
        full_path="docs/security/$link_path"
        if [ ! -f "$full_path" ]; then
            echo "  ❌ Broken link in $(basename $md_file): $link_path"
            broken_links=$((broken_links + 1))
        fi
    done < <(grep -o "(\.\/[^)]*\.md)" "$md_file" 2>/dev/null || true)
done

if [ $broken_links -eq 0 ]; then
    echo "  ✅ All internal links valid"
else
    echo "  ❌ Found $broken_links broken link(s)"
    exit 1
fi
echo ""

# Check for required sections in each doc
echo "✓ Checking required sections..."
sections_check() {
    local file=$1
    shift
    local sections=("$@")
    local missing=0
    
    for section in "${sections[@]}"; do
        if ! grep -q "^## $section" "$file" 2>/dev/null && ! grep -q "^### $section" "$file" 2>/dev/null; then
            echo "  ⚠️  $(basename $file) missing section: $section"
            missing=$((missing + 1))
        fi
    done
    
    if [ $missing -eq 0 ]; then
        echo "  ✅ $(basename $file) - All required sections present"
    fi
    return $missing
}

sections_check "docs/security/00_INDEX.md" "Security Target" "Security Assurance Model" "Security Principles"
sections_check "docs/security/10_THREAT_MODEL.md" "Assets" "Actors" "Trust Boundaries" "STRIDE" "Risk Register"
sections_check "docs/security/11_IDENTITY_AND_ACCESS.md" "Authentication" "Authorization" "Session Management"
sections_check "docs/security/12_CRYPTO_POLICY.md" "Approved Algorithms" "Key Management" "TLS Requirements"
sections_check "docs/security/13_APPSEC_BOUNDARIES.md" "Input Validation" "Output Encoding" "Error Handling"
echo ""

# Statistics
echo "📊 Documentation Statistics"
echo "=========================="
total_lines=$(wc -l docs/security/*.md | tail -1 | awk '{print $1}')
total_size=$(du -sh docs/security/ | awk '{print $1}')
evidence_count=$(grep -o "\*\*Evidence\*\*:" docs/security/*.md | wc -l)
echo "Total lines: $total_lines"
echo "Total size: $total_size"
echo "Evidence citations: $evidence_count"
echo ""

echo "✅ All validation checks passed!"
echo ""
echo "Next steps:"
echo "  1. Review threat model before adding features"
echo "  2. Implement authentication per 11_IDENTITY_AND_ACCESS.md"
echo "  3. Follow crypto policy in 12_CRYPTO_POLICY.md"
echo "  4. Apply secure coding from 13_APPSEC_BOUNDARIES.md"
