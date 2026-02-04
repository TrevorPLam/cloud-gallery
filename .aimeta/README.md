# AI-META Documentation Directory

This directory contains AI-optimized documentation for configuration files that cannot have inline comments (JSON files).

## Purpose
Since JSON format does not support comments, we provide comprehensive documentation for JSON configuration files here as companion markdown files.

## Files
- `package.json.md` - npm package manifest documentation
- `app.json.md` - Expo configuration documentation
- `tsconfig.json.md` - TypeScript configuration documentation

## Format
Each file follows the AI-META standard format:
- **Purpose**: One-line description
- **Ownership**: Module/domain
- **Entrypoints**: How it's used
- **Dependencies**: Key dependencies
- **Danger Zones**: Critical considerations
- **Change Safety**: What's safe vs risky
- **Tests**: How to validate
- **Key Notes**: Important details

## Usage
When modifying JSON configuration files, consult the corresponding .md file in this directory to understand the implications of changes.
