/**
 * @fileoverview Main entry point for the Camtasia SWF Tool library
 *
 * This module exports the core functionality for processing Camtasia-generated SWF files:
 * - Extracting frames (PNG) and audio (MP3/WAV) from SWF files using JPEXS decompiler
 * - Converting extracted content to modern MP4 format using FFmpeg
 *
 * The library is designed specifically for Camtasia SWF files, which have unique
 * characteristics compared to general Flash SWF files.
 *
 * @example Basic Usage
 * ```typescript
 * import { extractSWF, convertSWF } from 'camtasia-swf-tool'
 *
 * // Extract frames and audio from SWF
 * await extractSWF('input.swf', './output-dir')
 *
 * // Convert SWF directly to MP4
 * await convertSWF('input.swf', 'output.mp4', { framerate: 30, keepExtracted: false })
 * ```
 *
 * @requires Java JDK 8+ (for JPEXS decompiler)
 * @requires FFmpeg (bundled via @ffmpeg-installer/ffmpeg)
 */

// Export core SWF processing functions
export * from './tools/extractor'
export * from './tools/converter'
