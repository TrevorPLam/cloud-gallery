# Cloud Gallery Desktop Build Script (PowerShell)
# This script builds the desktop application for Windows

param(
    [switch]$Release,
    [switch]$Debug,
    [switch]$Clean
)

# Colors for output
$Colors = @{
    Red = "Red"
    Green = "Green"
    Yellow = "Yellow"
    Blue = "Blue"
    White = "White"
}

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor $Colors.Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor $Colors.Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor $Colors.Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor $Colors.Red
}

try {
    Write-Status "🚀 Building Cloud Gallery Desktop Application..."

    # Check if we're in the right directory
    if (-not (Test-Path "package.json")) {
        Write-Error "Please run this script from the desktop directory"
        exit 1
    }

    # Check if Rust is installed
    if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
        Write-Error "Rust is not installed. Please install Rust first."
        exit 1
    }

    # Check if Node.js is installed
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Write-Error "Node.js is not installed. Please install Node.js first."
        exit 1
    }

    # Clean build if requested
    if ($Clean) {
        Write-Status "Cleaning previous builds..."
        if (Test-Path "dist") {
            Remove-Item -Recurse -Force "dist"
        }
        if (Test-Path "src-tauri/target") {
            Set-Location "src-tauri"
            cargo clean
            Set-Location ".."
        }
        Write-Success "Clean completed"
    }

    # Install Node.js dependencies
    Write-Status "Installing Node.js dependencies..."
    npm install

    # Install Rust dependencies
    Write-Status "Installing Rust dependencies..."
    Set-Location "src-tauri"
    cargo build
    Set-Location ".."

    # Build frontend
    Write-Status "Building frontend..."
    npm run build

    # Check if build was successful
    if (-not (Test-Path "dist")) {
        Write-Error "Frontend build failed - dist directory not found"
        exit 1
    }

    Write-Success "Frontend build completed"

    # Build Tauri app
    if ($Release) {
        Write-Status "Building Tauri application for release..."
        npm run tauri:build
    } elseif ($Debug) {
        Write-Status "Building Tauri application for debug..."
        npm run tauri:dev -- --no-dev-server
    } else {
        Write-Status "Building Tauri application..."
        npm run tauri:build
    }

    # Check if build was successful
    $bundlePath = "src-tauri/target/release/bundle"
    if ($Debug) {
        $bundlePath = "src-tauri/target/debug/bundle"
    }

    if (-not (Test-Path $bundlePath)) {
        Write-Error "Tauri build failed"
        exit 1
    }

    Write-Success "Desktop application build completed!"

    # Show build artifacts
    Write-Status "Build artifacts:"
    Get-ChildItem -Path $bundlePath -Recurse -Include "*.exe", "*.msi" | ForEach-Object {
        $size = [math]::Round($_.Length / 1MB, 2)
        Write-Success "✓ $($_.FullName) ($($size)MB)"
    }

    Write-Status "Build completed successfully!"
    Write-Status "To run the application:"
    if ($Debug) {
        Write-Status "  Run: src-tauri\target\debug\cloud-gallery-desktop.exe"
    } else {
        Write-Status "  Run: src-tauri\target\release\cloud-gallery-desktop.exe"
    }

    # Optional: Run tests if they exist
    $packageJson = Get-Content "package.json" | ConvertFrom-Json
    if ($packageJson.scripts -and $packageJson.scripts.test) {
        Write-Status "Running tests..."
        npm test
        Write-Success "Tests completed"
    }

    Write-Success "🎉 Cloud Gallery Desktop is ready!"

} catch {
    Write-Error "Build failed: $($_.Exception.Message)"
    exit 1
}
