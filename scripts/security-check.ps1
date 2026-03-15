# Security validation script for Cloud Gallery (PowerShell version)
# Run this locally before committing changes

param(
    [switch]$SkipGitleaks,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "🔒 Cloud Gallery Security Validation Suite" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0
$WarningCount = 0

# Function to print status
function Print-Status {
    param(
        [bool]$Success,
        [string]$Message
    )
    
    if ($Success) {
        Write-Host "✅ $Message" -ForegroundColor Green
    } else {
        Write-Host "❌ $Message" -ForegroundColor Red
        $script:ErrorCount++
    }
}

function Print-Warning {
    param([string]$Message)
    Write-Host "⚠️  $Message" -ForegroundColor Yellow
    $script:WarningCount++
}

# 1. Check for secrets in code
Write-Host "1️⃣  Checking for secrets in code..."
if (Get-Command gitleaks -ErrorAction SilentlyContinue) {
    $gitleaksOutput = gitleaks detect --no-git -v 2>&1
    if ($LASTEXITCODE -eq 0 -or $gitleaksOutput -match "No leaks found") {
        Print-Status $true "Secret scanning"
    } else {
        Print-Status $false "Secret scanning"
    }
} else {
    if (-not $SkipGitleaks) {
        Print-Warning "gitleaks not installed - skipping secret scan (install: choco install gitleaks or use winget)"
    }
}

# 2. Dependency vulnerability check
Write-Host ""
Write-Host "2️⃣  Checking dependencies for vulnerabilities..."
try {
    $auditOutput = npm audit --audit-level=moderate 2>&1
    if ($LASTEXITCODE -eq 0 -or $auditOutput -match "found 0 vulnerabilities") {
        Print-Status $true "Dependency vulnerability check"
    } else {
        Print-Status $false "Dependency vulnerability check - vulnerabilities found"
        Write-Host "   Run 'npm audit' for details" -ForegroundColor Yellow
    }
} catch {
    Print-Status $false "Dependency vulnerability check - error running audit"
}

# 3. Lint check
Write-Host ""
Write-Host "3️⃣  Running linter..."
try {
    $lintOutput = npm run lint 2>&1
    if ($LASTEXITCODE -eq 0) {
        Print-Status $true "Linting"
    } else {
        Print-Status $false "Linting - errors found"
        Write-Host "   Run 'npm run lint' for details" -ForegroundColor Yellow
    }
} catch {
    Print-Status $false "Linting - error running linter"
}

# 4. Type check
Write-Host ""
Write-Host "4️⃣  Running TypeScript type check..."
try {
    $typeOutput = npm run check:types 2>&1
    if ($LASTEXITCODE -eq 0) {
        Print-Status $true "Type checking"
    } else {
        Print-Status $false "Type checking - errors found"
        Write-Host "   Run 'npm run check:types' for details" -ForegroundColor Yellow
    }
} catch {
    Print-Status $false "Type checking - error running type check"
}

# 5. Format check
Write-Host ""
Write-Host "5️⃣  Checking code formatting..."
try {
    $formatOutput = npm run check:format 2>&1
    if ($LASTEXITCODE -eq 0) {
        Print-Status $true "Code formatting"
    } else {
        Print-Status $false "Code formatting - issues found"
        Write-Host "   Run 'npm run format' to auto-fix" -ForegroundColor Yellow
    }
} catch {
    Print-Status $false "Code formatting - error running format check"
}

# 6. Test execution
Write-Host ""
Write-Host "6️⃣  Running tests..."
try {
    $testOutput = npm run test 2>&1
    if ($LASTEXITCODE -eq 0) {
        Print-Status $true "Tests"
    } else {
        Print-Status $false "Tests - failures found"
        Write-Host "   Run 'npm run test' for details" -ForegroundColor Yellow
    }
} catch {
    Print-Status $false "Tests - error running tests"
}

# 7. Check for common security anti-patterns
Write-Host ""
Write-Host "7️⃣  Checking for security anti-patterns..."
$AntipatternFound = $false

# Check for eval usage
$evalUsage = Select-String -Path "server\*.ts", "client\*.ts", "client\*.tsx", "shared\*.ts" -Pattern "eval\(" | Where-Object { $_.Line -notmatch "// SAFE:" }
if ($evalUsage) {
    Print-Warning "Found eval() usage - review for security implications"
    if ($Verbose) { $evalUsage | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Gray } }
}

# Check for innerHTML usage
$innerHTMLUsage = Select-String -Path "client\*.ts", "client\*.tsx" -Pattern "innerHTML" | Where-Object { $_.Line -notmatch "// SAFE:" }
if ($innerHTMLUsage) {
    Print-Warning "Found innerHTML usage - ensure proper sanitization"
    if ($Verbose) { $innerHTMLUsage | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Gray } }
}

# Check for dangerouslySetInnerHTML
$dangerousHTML = Select-String -Path "client\*.tsx" -Pattern "dangerouslySetInnerHTML" | Where-Object { $_.Line -notmatch "// SAFE:" }
if ($dangerousHTML) {
    Print-Warning "Found dangerouslySetInnerHTML - ensure proper sanitization"
    if ($Verbose) { $dangerousHTML | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Gray } }
}

# Check for plaintext passwords
$passwordPattern = Select-String -Path "server\*.ts", "client\*.ts", "client\*.tsx", "shared\*.ts" -Pattern "password.*=.*['`"][^'`"]{8,}['`"]" 
if ($passwordPattern) {
    Print-Status $false "Security anti-patterns check - possible hardcoded credentials"
    $AntipatternFound = $true
    if ($Verbose) { $passwordPattern | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Gray } }
}

# Check for disabled SSL verification
$sslPattern = Select-String -Path "server\*.ts", "client\*.ts", "client\*.tsx" -Pattern "rejectUnauthorized.*false|NODE_TLS_REJECT_UNAUTHORIZED.*0"
if ($sslPattern) {
    Print-Status $false "Security anti-patterns check - SSL verification disabled"
    $AntipatternFound = $true
    if ($Verbose) { $sslPattern | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Gray } }
}

if (-not $AntipatternFound -and -not $evalUsage -and -not $innerHTMLUsage -and -not $dangerousHTML -and -not $passwordPattern -and -not $sslPattern) {
    Print-Status $true "Security anti-patterns check"
}

# 8. Check package-lock.json integrity
Write-Host ""
Write-Host "8️⃣  Verifying package-lock.json integrity..."
if (Test-Path "package-lock.json") {
    try {
        $lockCheck = npm install --package-lock-only --dry-run 2>&1
        if ($LASTEXITCODE -eq 0) {
            Print-Status $true "Package lock integrity"
        } else {
            Print-Status $false "Package lock integrity - out of sync"
            Write-Host "   Run 'npm install' to sync" -ForegroundColor Yellow
        }
    } catch {
        Print-Status $false "Package lock integrity - error checking integrity"
    }
} else {
    Print-Status $false "Package lock integrity - package-lock.json missing"
}

# 9. Check for TODO/FIXME security comments
Write-Host ""
Write-Host "9️⃣  Checking for security TODOs..."
$securityTodos = Select-String -Path "server\*.ts", "client\*.ts", "client\*.tsx", "shared\*.ts" -Pattern "TODO.*security|FIXME.*security|SECURITY.*TODO"
if ($securityTodos) {
    Print-Warning "Found $($securityTodos.Count) security-related TODOs/FIXMEs to address"
    if ($Verbose) { $securityTodos | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Gray } }
} else {
    Print-Status $true "Security TODOs check"
}

Write-Host ""
Write-Host "🔍 Pen test scaffold available: scripts/pen-test.sh" -ForegroundColor Cyan

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "📊 Security Validation Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Errors: $ErrorCount" -ForegroundColor Red
Write-Host "Warnings: $WarningCount" -ForegroundColor Yellow
Write-Host ""

if ($ErrorCount -eq 0 -and $WarningCount -eq 0) {
    Write-Host "✅ All security checks passed!" -ForegroundColor Green
    Write-Host "You're good to commit!" -ForegroundColor Green
    exit 0
} elseif ($ErrorCount -eq 0) {
    Write-Host "⚠️  All checks passed with warnings" -ForegroundColor Yellow
    Write-Host "Please review warnings before committing" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "❌ Security validation failed!" -ForegroundColor Red
    Write-Host "Please fix errors before committing" -ForegroundColor Red
    exit 1
}
