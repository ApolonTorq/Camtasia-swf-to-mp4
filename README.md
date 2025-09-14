# Camtasia SWF Tool

A command-line utility for processing Camtasia-generated Flash SWF files. Extract frame sequences and audio content, then convert them to modern MP4 format.

Built on the foundation of the JPEXS decompiler library, this tool is specifically optimized for handling SWF files created by Camtasia's Flash export feature.

## Features

- **Extract**: Extract frame images (PNG) and audio content (MP3/WAV) from SWF files
- **Convert**: Convert SWF files directly to MP4 format with synchronized audio
- **Smart Frame Rate Detection**: Automatically detects and preserves original SWF timing
- **Dual Audio Strategy**: Uses both JPEXS and FFmpeg for maximum audio compatibility
- **Cross-Platform**: Works on Windows, Linux, and macOS (including WSL)
- **Batch Processing**: Process multiple SWF files and entire directories
- **Flexible Output**: Choose output locations and folder structures
- **Beautiful CLI**: Colorful, informative command-line interface with progress indicators
- **TypeScript Support**: Full TypeScript support with comprehensive type definitions

## Prerequisites

- **Node.js** v22.0.0 or higher
- **Java Development Kit (JDK)** v8 or higher (up to v18 tested)

**Note:** FFmpeg is automatically bundled with the tool via `ffmpeg-static` - no separate installation required!

## Cross-Platform Binary Support

This tool installs FFmpeg binaries for all supported platforms (Windows, Linux, macOS) regardless of your current operating system. This approach enables seamless development and deployment across different environments:

- **Windows Development + WSL2 Linux**: Run the same codebase in both Windows and WSL2 without clearing `node_modules`
- **CI/CD Pipelines**: Deploy to different platforms without platform-specific builds
- **Cross-Platform Development**: Develop on one platform and test on another without dependency issues

The tool uses a postinstall script that forces installation of all platform-specific FFmpeg packages:
- `@ffmpeg-installer/win32-x64` and `@ffmpeg-installer/win32-ia32` for Windows
- `@ffmpeg-installer/linux-x64` and `@ffmpeg-installer/linux-ia32` for Linux
- `@ffmpeg-installer/darwin-x64` and `@ffmpeg-installer/darwin-arm64` for macOS

This ensures that the tool works correctly regardless of which platform it's running on, making it particularly useful for developers working in mixed Windows/WSL2 environments.

## Installation

### Global Installation (Recommended for CLI usage)

```bash
npm install -g camtasia-swf-tool
```

### Local Installation

```bash
npm install camtasia-swf-tool --save
```

## Command Line Usage

### Extract Command

Extract frame images and audio content from SWF files:

```bash
# Extract from a single SWF file
camtasia-swf extract presentation.swf

# Extract from a directory of SWF files
camtasia-swf extract ./swf-files/ -r

# Extract to a specific output directory
camtasia-swf extract presentation.swf -o ./extracted-content/

# Process directories recursively
camtasia-swf extract ./presentations/ -r -o ./output/
```

### Convert Command

Extract and convert SWF files to MP4 format:

```bash
# Convert a single SWF file to MP4
camtasia-swf convert presentation.swf

# Convert with custom frame rate
camtasia-swf convert presentation.swf -f 60

# Convert multiple files and keep extracted assets
camtasia-swf convert ./swf-files/ -r --keep-extracted

# Convert to specific output directory
camtasia-swf convert presentation.swf -o ./videos/
```

### Command Options

#### Extract Options

- `-o, --output <dir>`: Output directory (default: adjacent to SWF files)
- `-r, --recursive`: Process directories recursively

#### Convert Options

- `-o, --output <dir>`: Output directory (default: adjacent to SWF files)
- `-r, --recursive`: Process directories recursively
- `-f, --framerate <fps>`: Frame rate for output video (default: 30)
- `--keep-extracted`: Keep extracted frames and audio files after conversion

## Output Structure

### Extract Command Output

When extracting content, the tool creates organized folders:

```text
presentation.swf → presentation-output/
├── frames/
│   ├── frame_001.png
│   ├── frame_002.png
│   └── ...
└── sounds/
    └── sound_001.mp3
```

### Convert Command Output

The convert command creates MP4 files alongside the original SWF files:

```text
presentation.swf → presentation.mp4
```

## Programmatic Usage (TypeScript/JavaScript)

You can also use the library programmatically in your Node.js applications:

```typescript
import { extractSWF, convertSWF } from 'camtasia-swf-tool'

// Extract frames and audio
await extractSWF('presentation.swf', './output/')

// Convert to MP4
await convertSWF('presentation.swf', 'presentation.mp4', {
  framerate: 30,
  keepExtracted: false
})
```

### Additional Functions

You can also analyze extracted content:

```typescript
import { analyzeExtractedContent } from 'camtasia-swf-tool'

// Analyze what was extracted
const analysis = analyzeExtractedContent('./output/')
console.log(`Found ${analysis.frameCount} frames and ${analysis.audioFiles.length} audio files`)
```

## How It Works

The tool uses a dual-strategy approach for maximum reliability:

### 1. Frame Extraction

- **JPEXS Free Flash Decompiler** extracts frame images as sequential PNG files
- Handles Camtasia's specific SWF structure optimally

### 2. Audio Extraction

- **Primary**: JPEXS extracts audio when possible
- **Fallback**: FFmpeg provides reliable audio extraction for challenging formats
- Both strategies run automatically for best results

### 3. Video Creation

- **FFmpeg** detects original frame rate from SWF metadata
- Combines frames into H.264 MP4 with synchronized audio
- Maintains original timing and quality

## Supported SWF Types

This tool is optimized for **Camtasia-generated SWF files** that contain:

- Sequential frame images (typically PNG format)
- Synchronized audio tracks (MP3/WAV format)
- Timeline-based content structure

For general SWF decompilation, consider using the original JPEXS decompiler directly.

## Troubleshooting

### Java Not Found

Ensure Java JDK is installed and accessible via the `java` command:

```bash
java -version
```

### FFmpeg Issues

FFmpeg is bundled automatically, but if you encounter issues:

- **Windows**: The bundled .exe binary should work automatically
- **Linux**: May use Windows binary via WSL compatibility
- **macOS**: Native binary included

You can verify FFmpeg availability in the tool's output.

### Permission Issues

On Unix-like systems, you may need to make the CLI executable:

```bash
chmod +x ./node_modules/.bin/camtasia-swf
```

## License

GNU GPLv3 - See [LICENSE](LICENSE) file for details.

## Background

This tool is built upon the [JPEXS Free Flash Decompiler](https://github.com/jindrapetrik/jpexs-decompiler) library and was originally inspired by the jpexs-ts wrapper created by Roman Balzer (<https://github.com/roman-balzer/jpexs-ts>). However, this implementation has been significantly modified and enhanced specifically for Camtasia SWF processing, with a different focus than the original wrapper.

The functionality has been streamlined and optimized for the specific use case of extracting and converting Camtasia-generated SWF files to modern formats, rather than providing general-purpose SWF decompilation capabilities.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
