# Cloud Gallery Desktop

Desktop application for Cloud Gallery built with Tauri + React Native Web.

## Architecture

This desktop app uses a hybrid architecture:
- **Backend**: Rust (Tauri) for native system integration
- **Frontend**: React Native Web for code reuse with mobile app
- **Communication**: Tauri's IPC system for frontend-backend communication

## Features

### Core Features
- **File System Integration**: Real-time folder monitoring with change detection
- **System Tray**: Background operation with tray menu
- **Global Shortcuts**: Keyboard shortcuts for common actions
- **Drag & Drop**: Native file drag and drop support
- **Window Management**: Proper desktop window controls

### Desktop-Specific Features
- **Automatic Photo Sync**: Monitor folders for new photos
- **Desktop Navigation**: Mouse and keyboard optimized UI
- **Native File Dialogs**: System file picker integration
- **Background Processing**: Continue sync when app is minimized

## Development

### Prerequisites
- Rust 1.70+ 
- Node.js 18+
- npm or yarn

### Setup

1. Install dependencies:
```bash
cd desktop
npm install
```

2. Install Rust dependencies:
```bash
cd src-tauri
cargo build
```

### Development

Start development server:
```bash
npm run desktop:tauri:dev
```

This will:
- Start the React Native Web development server
- Launch the Tauri application
- Enable hot reload for both frontend and backend

### Building

Build for production:
```bash
npm run desktop:tauri:build
```

This creates platform-specific executables in `src-tauri/target/release/bundle/`.

## File Structure

```
desktop/
├── src/                          # React Native Web frontend
│   ├── index.tsx                 # Entry point
│   ├── index.html                # HTML template
│   ├── file-service.ts           # File system API wrapper
│   ├── use-file-watcher.ts       # React hook for file watching
│   └── DesktopFileWatcherScreen.tsx # Desktop UI component
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs              # Main application
│   │   ├── file_watcher.rs      # File system monitoring
│   │   └── desktop_features.rs  # System tray, shortcuts
│   ├── Cargo.toml               # Rust dependencies
│   ├── tauri.conf.json          # Tauri configuration
│   └── build.rs                 # Build script
├── webpack.config.js            # Webpack configuration
└── package.json                 # Node.js dependencies
```

## Key Technologies

- **Tauri v2**: Cross-platform desktop framework
- **React Native Web**: Web implementation of React Native
- **Rust**: Backend system integration
- **notify**: File system watching
- **Webpack**: Frontend bundling

## Integration with Mobile App

The desktop app shares:
- **Business Logic**: All core photo management logic
- **UI Components**: Most React Native components work via RN Web
- **State Management**: React Query and context providers
- **API Integration**: Same backend endpoints

Desktop-specific additions:
- **File System APIs**: Native file operations
- **System Integration**: Tray, shortcuts, notifications
- **Desktop UI**: Mouse/keyboard optimized interactions

## Security

- **Zero-Knowledge**: All encryption happens client-side
- **Local Processing**: File operations stay on device
- **Permission Model**: Explicit user consent for file access
- **Sandboxed**: Tauri's security model limits system access

## Performance

- **Lightweight**: ~10MB binary size (vs ~100MB Electron)
- **Native Speed**: Rust backend for file operations
- **Efficient Watching**: Debounced file system events
- **Memory Management**: Optimized for large photo libraries

## Troubleshooting

### Common Issues

**Build fails with Rust errors:**
```bash
# Update Rust toolchain
rustup update

# Clean and rebuild
cargo clean && cargo build
```

**React Native Web components not rendering:**
- Check webpack aliases in `webpack.config.js`
- Ensure React Native modules are properly mocked
- Verify CSS styles are applied correctly

**File watching not working:**
- Check file permissions in target directory
- Verify Tauri capabilities in `tauri.conf.json`
- Check console for file system errors

### Development Tips

- Use `console.log` extensively - Tauri forwards to system console
- Test file operations with temporary directories first
- Enable hot reload for faster iteration
- Use browser dev tools for frontend debugging

## Future Enhancements

- **Multiple Directory Support**: Watch multiple folders simultaneously
- **Advanced Filtering**: File type and size filtering
- **Sync Conflicts**: Handle duplicate file scenarios
- **Background Sync**: Service worker for offline operation
- **Cloud Integration**: Direct cloud storage integration
