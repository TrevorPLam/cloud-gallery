#!/bin/bash

# Cloud Gallery Desktop Build Script
# This script builds the desktop application for all platforms

set -e

echo "🚀 Building Cloud Gallery Desktop Application..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the desktop directory"
    exit 1
fi

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    print_error "Rust is not installed. Please install Rust first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v npm &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Install Node.js dependencies
print_status "Installing Node.js dependencies..."
npm install

# Install Rust dependencies
print_status "Installing Rust dependencies..."
cd src-tauri
cargo build
cd ..

# Build frontend
print_status "Building frontend..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    print_error "Frontend build failed - dist directory not found"
    exit 1
fi

print_success "Frontend build completed"

# Build Tauri app for development
print_status "Building Tauri application for development..."
npm run tauri:build

# Check if build was successful
if [ ! -d "src-tauri/target/release/bundle" ]; then
    print_error "Tauri build failed"
    exit 1
fi

print_success "Desktop application build completed!"

# Show build artifacts
print_status "Build artifacts:"
find src-tauri/target/release/bundle -name "*.exe" -o -name "*.app" -o -name "*.deb" -o -name "*.rpm" | while read file; do
    size=$(du -h "$file" | cut -f1)
    print_success "✓ $file ($size)"
done

print_status "Build completed successfully!"
print_status "To run the application:"
print_status "  macOS: Open src-tauri/target/release/bundle/macos/Cloud Gallery.app"
print_status "  Windows: Run src-tauri/target/release/bundle/windows/Cloud Gallery.exe"
print_status "  Linux: Run src-tauri/target/release/bundle/linux/cloud-gallery"

# Optional: Run tests if they exist
if [ -f "package.json" ] && grep -q "test" package.json; then
    print_status "Running tests..."
    npm test
    print_success "Tests completed"
fi

print_success "🎉 Cloud Gallery Desktop is ready!"
