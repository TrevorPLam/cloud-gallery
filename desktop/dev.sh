#!/bin/bash

# Cloud Gallery Desktop Development Script
# This script sets up and runs the desktop application in development mode

set -e

echo "🔧 Starting Cloud Gallery Desktop Development..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Check dependencies
print_status "Checking dependencies..."

if ! command -v cargo &> /dev/null; then
    print_error "Rust is not installed. Please install Rust first."
    exit 1
fi

if ! command -v npm &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js first."
    exit 1
fi

print_success "Dependencies check passed"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing Node.js dependencies..."
    npm install
fi

if [ ! -d "src-tauri/target" ]; then
    print_status "Installing Rust dependencies..."
    cd src-tauri
    cargo build
    cd ..
fi

# Start development server
print_status "Starting development server..."
print_status "This will start both the frontend dev server and Tauri app"
print_status "Press Ctrl+C to stop the development server"

# Run Tauri in development mode
npm run tauri:dev
