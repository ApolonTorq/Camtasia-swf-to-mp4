/**
 * @fileoverview SWF to MP4 Converter
 *
 * This module handles the complete workflow of converting Camtasia SWF files to MP4:
 *
 * 1. **Frame Rate Detection**: Uses FFmpeg to detect the original SWF frame rate
 * 2. **Content Extraction**: Delegates to extractor module for frames and audio
 * 3. **MP4 Creation**: Uses FFmpeg to combine frames into H.264 video with audio
 * 4. **Cleanup**: Optionally removes temporary extraction files
 *
 * The converter is optimized for Camtasia SWF files and includes:
 * - Automatic frame rate detection from source SWF
 * - Smart frame pattern recognition for FFmpeg input
 * - H.264 video encoding with AAC audio
 * - Progress reporting and error handling
 * - Cleanup of temporary files
 *
 * @requires Java JDK 8+ (for JPEXS extraction)
 * @requires FFmpeg (bundled via @ffmpeg-installer/ffmpeg)
 */

import * as fs from 'fs'
import * as path from 'path'
import ffmpeg from 'fluent-ffmpeg'
import { extractSWF, analyzeExtractedContent } from './extractor'
import { log, colors, createStyledSpinner } from '../utils/cli-styling'
import { getFFmpegPath, validatePlatformSupport } from '../utils/platform'

/**
 * Initialize fluent-ffmpeg with cross-platform FFmpeg binaries
 *
 * This function validates that both Java and FFmpeg are available (full platform support)
 * and configures fluent-ffmpeg to use the detected binary paths. This is required
 * for the complete SWF-to-MP4 conversion workflow.
 *
 * @returns True if both Java and FFmpeg are available and configured
 */
const initializeFFmpeg = (): boolean => {
  const platformStatus = validatePlatformSupport()

  if (!platformStatus.isFullySupported) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('⚠️  Platform support validation failed:')
      if (!platformStatus.ffmpeg) {
        console.warn('   - FFmpeg not available')
      }
      if (!platformStatus.java) {
        console.warn('   - Java not available')
      }
    }
    return false
  }

  // Configure fluent-ffmpeg with detected binary paths
  if (platformStatus.ffmpeg) {
    ffmpeg.setFfmpegPath(platformStatus.ffmpeg)
  }

  return true
}

// Initialize FFmpeg on module load for immediate availability
const ffmpegInitialized = initializeFFmpeg()

/** Configuration options for SWF to MP4 conversion */
export interface ConversionOptions {
  /** Target frame rate for output video (or detected rate if 30fps default) */
  framerate: number
  /** Whether to keep extracted frames/audio files after conversion */
  keepExtracted: boolean
}

/**
 * Convert a Camtasia SWF file to MP4 format with complete workflow
 *
 * This is the main conversion function that orchestrates the entire process:
 *
 * 1. **Frame Rate Detection**: Analyzes SWF to detect original frame rate
 * 2. **Content Extraction**: Extracts frames and audio using dual-strategy approach
 * 3. **Content Analysis**: Catalogs extracted files and validates completeness
 * 4. **Video Creation**: Combines frames into H.264 MP4 with synchronized audio
 * 5. **Cleanup**: Removes temporary files unless requested to keep them
 *
 * The function handles frame rate intelligently:
 * - If user specifies 30fps (default), uses detected frame rate instead
 * - Otherwise respects user's explicit frame rate choice
 * - Falls back to 30fps if detection fails
 *
 * @param swfFile - Path to input SWF file
 * @param outputMP4 - Path where MP4 file will be created
 * @param options - Conversion configuration (frame rate, cleanup preferences)
 * @returns Promise that resolves when conversion completes
 * @throws Error if extraction fails or no frames are found
 */
export const convertSWF = async (
  swfFile: string,
  outputMP4: string,
  options: ConversionOptions
): Promise<void> => {
  const tempDir = path.join(path.dirname(outputMP4), `.temp-${path.basename(swfFile, '.swf')}`)
  
  try {
    // Step 0: Detect frame rate from SWF using FFmpeg
    log.muted('  Detecting frame rate from SWF...')
    const detectedFrameRate = await detectSWFFrameRate(swfFile)
    
    // Use detected frame rate from SWF, unless user explicitly provided a different rate
    // If user provided 30fps (the default), prefer the detected rate
    const actualFrameRate = (options.framerate !== 30) ? options.framerate : detectedFrameRate
    log.muted(`  SWF frame rate: ${colors.highlight(detectedFrameRate.toString())} FPS, using: ${colors.highlight(actualFrameRate.toString())} FPS`)
    
    log.muted('  Extracting frames and audio...')
    
    // Step 1: Extract content from SWF
    await extractSWF(swfFile, tempDir)
    
    // Step 2: Analyze extracted content
    const content = analyzeExtractedContent(tempDir)
    
    if (content.frameCount === 0) {
      throw new Error('No frames were extracted from the SWF file')
    }
    
    log.muted(`  Found ${colors.highlight(content.frameCount.toString())} frames and ${colors.highlight(content.audioFiles.length.toString())} audio file(s)`)
    
    // Step 3: Convert to MP4
    const conversionSpinner = createStyledSpinner('Converting to MP4...', 'green')
    conversionSpinner.start()
    
    await convertFramesToMP4(content, outputMP4, actualFrameRate)
    
    conversionSpinner.stop()
    log.muted('  Video conversion completed')
    
  } finally {
    // Clean up temporary files unless requested to keep them
    if (!options.keepExtracted && fs.existsSync(tempDir)) {
      log.muted('  Cleaning up temporary files...')
      await removeDirectory(tempDir)
    } else if (options.keepExtracted) {
      log.muted(`  Extracted files kept in: ${colors.highlight(tempDir)}`)
    }
  }
}

/**
 * Convert extracted frames and audio to MP4 using FFmpeg
 */
const convertFramesToMP4 = (
  content: any,
  outputPath: string,
  framerate: number
): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (content.frameFiles.length === 0) {
      reject(new Error('No frame files found for conversion'))
      return
    }
    
    // Create frame pattern for FFmpeg input
    const framePattern = createFramePattern(content.frameFiles)
    
    if (!framePattern) {
      reject(new Error('Could not create frame pattern for FFmpeg'))
      return
    }
    
    // Ensure output directory exists and is writable
    const outputDir = path.dirname(outputPath)
    try {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }
      // Test if the directory is writable by attempting to create a test file
      const testFile = path.join(outputDir, '.write-test')
      fs.writeFileSync(testFile, 'test')
      fs.unlinkSync(testFile)
    } catch (error) {
      reject(new Error(`Cannot write to output directory: ${outputDir}. ${error instanceof Error ? error.message : 'Unknown error'}`))
      return
    }
    
    // Build FFmpeg command
    let command = ffmpeg()
      .input(framePattern.pattern)
      .inputOptions([
        '-framerate', framerate.toString()
        // Removed -pattern_type glob since bundled FFmpeg doesn't support it
      ])
      .videoFilters([
        'pad=ceil(iw/2)*2:ceil(ih/2)*2'  // Ensure even dimensions for H.264
      ])
      .videoCodec('libx264')
      .outputOptions([
        '-pix_fmt', 'yuv420p',
        '-crf', '23'  // Good quality setting
      ])
    
    // Add audio if available
    if (content.audioFiles.length > 0) {
      // Use the first audio file found
      const audioFile = content.audioFiles[0]
      command = command.input(audioFile)
      
      // Set audio codec
      command = command.audioCodec('aac')
        // Removed -shortest to allow full audio duration
    } else {
      // No audio - create silent video
      log.warning('No audio found, creating silent video')
    }
    
    command
      .output(outputPath)
      .on('start', (commandLine: string) => {
        log.muted(`  FFmpeg command: ${commandLine}`)
      })
      .on('progress', (progress: any) => {
        if (progress.percent) {
          const percent = Math.round(progress.percent)
          const progressBar = '█'.repeat(Math.floor(percent / 5)) + '░'.repeat(20 - Math.floor(percent / 5))
          process.stdout.write(`\r  ${colors.info('Converting:')} ${colors.highlight(progressBar)} ${colors.bold(`${percent}%`)}`)
        }
      })
      .on('end', () => {
        process.stdout.write('\n')
        resolve()
      })
      .on('error', (err: Error) => {
        process.stdout.write('\n')
        log.error(`FFmpeg error: ${err.message}`)
        reject(err)
      })
      .run()
  })
}

/**
 * Create FFmpeg-compatible frame input pattern from extracted frame files
 *
 * FFmpeg requires a specific pattern format to read sequential frame images.
 * This function analyzes the extracted frame files and creates the appropriate
 * input pattern for FFmpeg's image2 demuxer.
 *
 * Supported patterns:
 * - Sequential numbering: 1.png, 2.png, 3.png... → %d.png
 * - Prefixed numbering: frame1.png, frame2.png... → %d.png (fallback)
 *
 * The function always falls back to %d.png pattern, which works with most
 * JPEXS-generated frame sequences.
 *
 * @param frameFiles - Array of frame file paths, already sorted numerically
 * @returns Object with FFmpeg pattern string and frame count, or null if no frames
 */
const createFramePattern = (frameFiles: string[]): { pattern: string; count: number } | null => {
  if (frameFiles.length === 0) return null

  // Analyze frame naming pattern from first frame
  const firstFrame = frameFiles[0]
  const frameDir = path.dirname(firstFrame)

  // Check if files follow sequential numbering (1.png, 2.png, ...)
  const baseName = path.basename(firstFrame, path.extname(firstFrame))
  const numberMatch = baseName.match(/^(\d+)$/)

  if (numberMatch) {
    // Files are numbered sequentially - use %d pattern
    const ext = path.extname(firstFrame)
    const pattern = path.join(frameDir, `%d${ext}`)
    return { pattern, count: frameFiles.length }
  }
  
  // Check for prefix + number pattern (e.g. frame1.png, frame2.png, ...)
  const prefixMatch = baseName.match(/^(.+?)(\d+)$/)
  if (prefixMatch && frameFiles.length > 1) {
    // For now, fallback to sequential pattern - could be enhanced later
    const ext = path.extname(firstFrame)
    const pattern = path.join(frameDir, `%d${ext}`)
    return { pattern, count: frameFiles.length }
  }
  
  // Last resort: use sequential pattern
  const ext = path.extname(firstFrame)
  const pattern = path.join(frameDir, `%d${ext}`)
  return { pattern, count: frameFiles.length }
}

/**
 * Recursively remove a directory and all its contents
 *
 * This utility function safely cleans up temporary directories created during
 * the extraction process. It handles both files and subdirectories recursively.
 *
 * The function:
 * - Checks if directory exists before attempting removal
 * - Recursively removes subdirectories first
 * - Removes files before removing parent directory
 * - Handles the directory removal order correctly
 *
 * @param dirPath - Path to directory to remove
 * @returns Promise that resolves when removal is complete
 */
const removeDirectory = async (dirPath: string): Promise<void> => {
  if (fs.existsSync(dirPath)) {
    const files = fs.readdirSync(dirPath)

    // Process all files and subdirectories
    for (const file of files) {
      const filePath = path.join(dirPath, file)
      const stat = fs.statSync(filePath)

      if (stat.isDirectory()) {
        // Recursively remove subdirectories
        await removeDirectory(filePath)
      } else {
        // Remove individual files
        fs.unlinkSync(filePath)
      }
    }

    // Remove the now-empty parent directory
    fs.rmdirSync(dirPath)
  }
}

/**
 * Detect frame rate from SWF file using FFmpeg direct output parsing
 *
 * This function analyzes an SWF file to determine its original frame rate, which is
 * crucial for maintaining proper timing when converting to MP4. It uses FFmpeg's
 * built-in SWF format support to read metadata.
 *
 * The detection process:
 * 1. Spawns FFmpeg process to analyze the SWF file
 * 2. Captures stderr output (where FFmpeg writes format information)
 * 3. Parses output for fps patterns (e.g., "15 fps", "5 fps")
 * 4. Falls back to tbr (time base rate) if fps not found
 * 5. Returns 30fps as final fallback if parsing fails
 *
 * This approach is more reliable than using FFprobe for SWF files, as it
 * directly leverages FFmpeg's SWF format detection capabilities.
 *
 * @param swfFile - Path to the SWF file to analyze
 * @returns Promise resolving to detected frame rate (1-120 fps, fallback: 30)
 */
const detectSWFFrameRate = async (swfFile: string): Promise<number> => {
  return new Promise((resolve) => {
    // Use direct spawn for more reliable SWF analysis
    const { spawn } = require('child_process')
    const platformStatus = validatePlatformSupport()

    if (!platformStatus.ffmpeg) {
      resolve(30) // fallback to 30fps if FFmpeg not available
      return
    }

    const ffmpegProcess = spawn(platformStatus.ffmpeg, ['-i', swfFile], {
      stdio: ['ignore', 'ignore', 'pipe']
    })

    let stderrData = ''

    // Timeout after 30 seconds (increased for heavy test loads)
    const timeoutId = setTimeout(() => {
      ffmpegProcess.kill()
      console.log(`Warning: FFmpeg frame rate detection timed out, using default 30fps`)
      resolve(30)
    }, 30000)

    ffmpegProcess.stderr.on('data', (data: Buffer) => {
      stderrData += data.toString()
    })

    ffmpegProcess.on('close', () => {
      clearTimeout(timeoutId) // Clear timeout on successful completion
      try {
        // Look for frame rate in ffmpeg output (e.g., "5 fps", "15 fps")
        const fpsMatch = stderrData.match(/(\d+(?:\.\d+)?)\s+fps/)
        if (fpsMatch) {
          const fps = parseFloat(fpsMatch[1])
          if (fps > 0 && fps <= 120) {
            resolve(Math.round(fps))
            return
          }
        }

        // Alternative: look for tbr (time base rate)
        const tbrMatch = stderrData.match(/(\d+(?:\.\d+)?)\s+tbr/)
        if (tbrMatch) {
          const fps = parseFloat(tbrMatch[1])
          if (fps > 0 && fps <= 120) {
            resolve(Math.round(fps))
            return
          }
        }

        console.log(`Warning: Could not detect frame rate from SWF, using default 30fps`)
        resolve(30)
      } catch (error) {
        console.log(`Warning: Error parsing FFmpeg output: ${error}`)
        resolve(30)
      }
    })

    ffmpegProcess.on('error', (error: Error) => {
      clearTimeout(timeoutId) // Clear timeout on error
      console.log(`Warning: FFmpeg process error, using default 30fps: ${error.message}`)
      resolve(30)
    })
  })
}

/**
 * Check if FFmpeg is available and properly configured for video conversion
 *
 * This function tests FFmpeg availability by attempting to query available formats.
 * It's used by the CLI and tests to determine whether video conversion features
 * can be offered to the user.
 *
 * The check validates:
 * - FFmpeg was successfully initialized at module load
 * - FFmpeg can be executed and responds to format queries
 * - No errors occur during the availability check
 *
 * @returns Promise resolving to true if FFmpeg is available and working
 */
export const checkFFmpegAvailability = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (!ffmpegInitialized) {
      resolve(false)
      return
    }

    // Test FFmpeg by querying available formats
    ffmpeg.getAvailableFormats((err: any, formats: any) => {
      resolve(!err && !!formats)
    })
  })
}
