# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is "Camtasia SWF Tool" - a TypeScript CLI utility that processes Camtasia-generated Flash SWF files. The tool extracts frame sequences and audio content, then converts them to modern MP4 format. It's built on the JPEXS Free Flash Decompiler Java library.

## Build & Development Commands

```bash
# Build the project
npm run build

# Run the CLI tool
npm start

# Tests
npm test                    # Run all tests
npm run test:watch         # Run tests in watch mode  
npm run test:coverage      # Run tests with coverage report
```

## Architecture

### Core Module Structure

- **`src/index.ts`** - Main entry point, exports core SWF processing functions (extractor and converter)
- **`src/cli.ts`** - CLI interface using Commander.js with styled output and custom help system
- **`src/tools/`** - Core processing modules:
  - `extractor.ts` - Extracts frames (PNG) and audio (MP3/WAV) from SWF using JPEXS + FFmpeg fallback
  - `converter.ts` - Converts extracted content to MP4 with automatic frame rate detection
- **`src/utils/`** - Utility modules:
  - `platform.ts` - Cross-platform support (Windows/Linux/macOS, WSL compatibility)
  - `cli-styling.ts` - Visual styling for CLI output (colors, boxes, progress bars)
  - `cli-help.ts` - Custom help system with syntax highlighting

### External Dependencies

- **JPEXS Decompiler**: Java-based SWF decompiler located in `bin/ffdec.jar` with supporting libraries in `bin/lib/`
- **FFmpeg**: Used for video conversion (bundled via ffmpeg-static)
- **Fluent-FFmpeg**: Node.js wrapper for FFmpeg operations

### Processing Pipeline

1. **Frame Rate Detection**: Use FFmpeg to analyze SWF and detect original frame rate
2. **Extraction**: Use JPEXS to extract frames as PNG and audio as MP3/WAV files
3. **Fallback Audio**: Always attempt FFmpeg audio extraction for better reliability
4. **Conversion**: Use FFmpeg to combine frames into MP4 with detected frame rate and synchronized audio
5. **Cleanup**: Remove temporary files unless `--keep-extracted` is specified

## Key Implementation Details

### Java Integration

- Spawns Java processes to run JPEXS decompiler (`bin/ffdec.jar`)
- Requires Java JDK v8+ (tested up to v18)
- Error handling for missing Java installation

### Dual-Strategy Extraction

- **JPEXS Primary**: Excellent for frame extraction, sometimes struggles with audio
- **FFmpeg Fallback**: Reliable audio extraction, used automatically for better results
- Frames extracted to `frames/` subdirectory as sequential PNG files
- Audio extracted to `sounds/` subdirectory as MP3/WAV files
- FFmpeg combines frames using sequential patterns with detected frame rates

### CLI Commands

- `extract` - Extract frames and audio only
- `convert` - Extract and convert to MP4
- Both support recursive directory processing and custom output locations

### Test Structure

- Jest-based testing in `test/` directory
- Integration tests for end-to-end SWF processing
- Unit tests for extractor and converter modules
- 60-second timeout for conversion tests
- **`test/fixtures/test-outputs/`** - Generated MP4 files saved for manual review (NOT used for automated comparisons)

## Important Notes

- **Target audience**: Specifically optimized for Camtasia-generated SWF files
- **Node.js requirement**: v22.0.0+ 
- **Java requirement**: JDK installation required for JPEXS functionality
- **FFmpeg**: Bundled via ffmpeg-static for cross-platform compatibility
- **TypeScript paths**: Uses `@/*` alias for `src/*` imports