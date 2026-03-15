# Security validation script for Cloud Gallery (PowerShell version)
# Run this locally before committing changes

param(
    [switch]$SkipGitleaks,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"

Write-Host "Cloud Gallery Security Validation Suite" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorCount = 0
$WarningCount = 0

# Function to print status
function Show-Status {
    param(
        [bool]$Success,
        [string]$Message
    )
    
    if ($Success) {
        Write-Host "PASS: $Message" -ForegroundColor Green
    } else {
        Write-Host "FAIL: $Message" -ForegroundColor Red
        $script:ErrorCount++
    }
}

function Show-Warning {
    param([string]$Message)
    Write-Host "WARN: $Message" -ForegroundColor Yellow
    $script:WarningCount++
}

# 1. Check for secrets in code
Write-Host "1. Checking for secrets in code..."
if (Get-Command gitleaks -ErrorAction SilentlyContinue) {
    try {
        $gitleaksOutput = gitleaks detect --no-git -v 2>&1
        if ($LASTEXITCODE -eq 0 -or $gitleaksOutput -match "No leaks found") {
            Show-Status $true "Secret scanning"
        } else {
            Show-Status $false "Secret scanning"
        }
    } catch {
        Show-Status $false "Secret scanning - error running gitleaks"
    }
} else {
    if (-not $SkipGitleaks) {
        Show-Warning "gitleaks not installed - skipping secret scan"
    }
}

# 2. Dependency vulnerability check
Write-Host ""
Write-Host "2. Checking dependencies for vulnerabilities..."
try {
    npm audit --audit-level=moderate | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Show-Status $true "Dependency vulnerability check"
    } else {
        Show-Status $false "Dependency vulnerability check - vulnerabilities found"
        Write-Host "   Run 'npm audit' for details" -ForegroundColor Yellow
    }
} catch {
    Show-Status $false "Dependency vulnerability check - error running audit"
}

# 3. Lint check
Write-Host ""
Write-Host "3. Running linter..."
try {
    npm run lint | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Show-Status $true "Linting"
    } else {
        Show-Status $false "Linting - errors found"
        Write-Host "   Run 'npm run lint' for details" -ForegroundColor Yellow
    }
} catch {
    Show-Status $false "Linting - error running linter"
}

# 4. Type check
Write-Host ""
Write-Host "4. Running TypeScript type check..."
try {
    npm run check:types | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Show-Status $true "Type checking"
    } else {
        Show-Status $false "Type checking - errors found"
        Write-Host "   Run 'npm run check:types' for details" -ForegroundColor Yellow
    }
} catch {
    Show-Status $false "Type checking - error running type check"
}

# 5. Format check
Write-Host ""
Write-Host "5. Checking code formatting..."
try {
    npm run check:format | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Show-Status $true "Code formatting"
    } else {
        Show-Status $false "Code formatting - issues found"
        Write-Host "   Run 'npm run format' to auto-fix" -ForegroundColor Yellow
    }
} catch {
    Show-Status $false "Code formatting - error running format check"
}

# 6. Test execution
Write-Host ""
Write-Host "6. Running tests..."
try {
    npm run test | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Show-Status $true "Tests"
    } else {
        Show-Status $false "Tests - failures found"
        Write-Host "   Run 'npm run test' for details" -ForegroundColor Yellow
    }
} catch {
    Show-Status $false "Tests - error running tests"
}

# 7. Check for common security anti-patterns
Write-Host ""
Write-Host "7. Checking for security anti-patterns..."
$AntipatternFound = $false

# Check for eval usage
$evalUsage = Select-String -Path "server\*.ts", "client\*.ts", "client\*.tsx", "shared\*.ts" -Pattern "eval\(" | Where-Object { $_.Line -notmatch "// SAFE:" }
if ($evalUsage) {
    Show-Warning "Found eval() usage - review for security implications"
    if ($Verbose) { $evalUsage | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Gray } }
}

# Check for innerHTML usage
$innerHTMLUsage = Select-String -Path "client\*.ts", "client\*.tsx" -Pattern "innerHTML" | Where-Object { $_.Line -notmatch "// SAFE:" }
if ($innerHTMLUsage) {
    Show-Warning "Found innerHTML usage - ensure proper sanitization"
    if ($Verbose) { $innerHTMLUsage | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Gray } }
}

# Check for dangerouslySetInnerHTML
$dangerousHTML = Select-String -Path "client\*.tsx" -Pattern "dangerouslySetInnerHTML" | Where-Object { $_.Line -notmatch "// SAFE:" }
if ($dangerousHTML) {
    Show-Warning "Found dangerouslySetInnerHTML - ensure proper sanitization"
    if ($Verbose) { $dangerousHTML | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Gray } }
}

# Check for plaintext passwords
$passwordPattern = Select-String -Path "server\*.ts", "client\*.ts", "client\*.tsx", "shared\*.ts" -Pattern "password.*=.*['`"][^'`"]{8,}['`"]" 
if ($passwordPattern) {
    Show-Status $false "Security anti-patterns check - possible hardcoded credentials"
    $AntipatternFound = $true
    if ($Verbose) { $passwordPattern | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Gray } }
}

# Check for disabled SSL verification
$sslPattern = Select-String -Path "server\*.ts", "client\*.ts", "client\*.tsx" -Pattern "rejectUnauthorized.*false|NODE_TLS_REJECT_UNAUTHORIZED.*0"
if ($sslPattern) {
    Show-Status $false "Security anti-patterns check - SSL verification disabled"
    $AntipatternFound = $true
    if ($Verbose) { $sslPattern | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber)" -ForegroundColor Gray } }
}

if (-not $AntipatternFound -and -not $evalUsage -and -not $innerHTMLUsage -and -not $dangerousHTML -and -not $passwordPattern -and -not $sslPattern) {
    Show-Status $true "Security anti-patterns check"
}

# 8. Check package-lock.json integrity
Write-Host ""
Write-Host "8. Verifying package-lock.json integrity..."
if (Test-Path "package-lock.json") {
    try {
        npm install --package-lock-only --dry-run | Out-Null
        if ($LASTEXITCODE -eq 0) {
            Show-Status $true "Package lock integrity"
        } else {
            Show-Status $false "Package lock integrity - out of sync"
            Write-Host "   Run 'npm install' to sync" -ForegroundColor Yellow
        }
    } catch {
        Show-Status $false "Package lock integrity - error checking integrity"
    }
} else {
    Show-Status $false "Package lock integrity - package-lock.json missing"
}

# 9. Check for TODO/FIXME security comments
Write-Host ""
Write-Host "9. Checking for security TODOs..."
$securityTodos = Select-String -Path "server\*.ts", "client\*.ts", "client\*.tsx", "shared\*.ts" -Pattern "TODO.*security|FIXME.*security|SECURITY.*TODO"
if ($securityTodos) {
    Show-Warning "Found $($securityTodos.Count) security-related TODOs/FIXMEs to address"
    if ($Verbose) { $securityTodos | ForEach-Object { Write-Host "   $($_.Path):$($_.LineNumber) - $($_.Line.Trim())" -ForegroundColor Gray } }
} else {
    Show-Status $true "Security TODOs check"
}

Write-Host ""
Write-Host "Pen test scaffold available: scripts/pen-test.sh" -ForegroundColor Cyan

# Summary
Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Security Validation Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Errors: $ErrorCount" -ForegroundColor Red
Write-Host "Warnings: $WarningCount" -ForegroundColor Yellow
Write-Host ""

if ($ErrorCount -eq 0 -and $WarningCount -eq 0) {
    Write-Host "All security checks passed!" -ForegroundColor Green
    Write-Host "You are good to commit!" -ForegroundColor Green
    exit 0
} elseif ($ErrorCount -eq 0) {
    Write-Host "All checks passed with warnings" -ForegroundColor Yellow
    Write-Host "Please review warnings before committing" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "Security validation failed!" -ForegroundColor Red
    Write-Host "Please fix errors before committing" -ForegroundColor Red
    exit 1
}
