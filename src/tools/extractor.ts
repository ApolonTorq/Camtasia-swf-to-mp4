/**
 * @fileoverview SWF Content Extractor
 *
 * This module handles extracting frames and audio from Camtasia-generated SWF files.
 * It uses a dual-extraction approach:
 *
 * 1. **Primary**: JPEXS Free Flash Decompiler (Java-based)
 *    - Excellent frame extraction capabilities
 *    - Sometimes struggles with certain audio formats
 *
 * 2. **Fallback**: FFmpeg direct extraction
 *    - Reliable audio extraction for various formats
 *    - Used when JPEXS audio extraction fails or produces poor results
 *
 * The extractor is specifically tuned for Camtasia SWF files, which have different
 * characteristics compared to general Flash animations.
 *
 * @requires Java JDK 8+ (for JPEXS)
 * @requires FFmpeg (bundled via ffmpeg-static)
 */

import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import ffmpeg from 'fluent-ffmpeg'
import { getFFmpegPath, getFFprobePath, validatePlatformSupport } from '../utils/platform'
// import { log, colors } from '../utils/cli-styling'  // Temporarily commented out for Jest compatibility

/**
 * Initialize fluent-ffmpeg with cross-platform FFmpeg binaries
 *
 * This function configures fluent-ffmpeg to use the bundled FFmpeg binaries
 * from ffmpeg-static, with proper cross-platform path detection.
 * This is crucial for the FFmpeg fallback audio extraction functionality.
 *
 * @returns True if FFmpeg was successfully configured, false otherwise
 */
const initializeFFmpeg = (): boolean => {
  const platformStatus = validatePlatformSupport()

  if (!platformStatus.ffmpeg) {
    return false
  }

  // Configure fluent-ffmpeg with detected binary paths
  ffmpeg.setFfmpegPath(platformStatus.ffmpeg)

  // Set FFprobe path if available (used for media analysis)
  if (platformStatus.ffprobe) {
    ffmpeg.setFfprobePath(platformStatus.ffprobe)
  }

  return true
}

// Initialize FFmpeg on module load for immediate availability
const ffmpegInitialized = initializeFFmpeg()

/** Configuration options for SWF extraction */
export interface ExtractorOptions {
  /** Path to the input SWF file */
  swfFile: string
  /** Directory where extracted content will be saved */
  outputDir: string
}

/** Callback functions for handling JPEXS extraction process events */
export interface ExtractorCallbacks {
  /** Called when an error occurs during extraction */
  onError: (err: string) => void
  /** Called when the extraction process completes successfully */
  onClose: () => void
  /** Called when JPEXS outputs progress information */
  onStdout: (data: string) => void
}

/**
 * Build command-line parameters for JPEXS decompiler
 *
 * Constructs the Java command arguments needed to run JPEXS with proper settings
 * for Camtasia SWF extraction. The function handles path resolution for both
 * development (src/) and production (dist/) environments.
 *
 * @param options - Extraction configuration with input SWF and output directory
 * @returns Array of command-line arguments for Java process
 */
const buildExtractionParameters = (options: ExtractorOptions) => {
  // Determine correct JAR path based on current execution environment
  let jarPath = path.resolve(__dirname, '../../bin/ffdec.jar')

  // Adjust path when running from compiled dist/ directory
  if (__dirname.includes('/dist/')) {
    jarPath = path.resolve(__dirname, '../../../bin/ffdec.jar')
  }

  const params = ['-jar', jarPath]

  // Configure JPEXS to export both frames (as PNG) and sounds (as MP3/WAV)
  params.push('-export')
  params.push('frame,sound')

  // Note: -format parameter removed as it causes "Input SWF file does not exist" error
  // JPEXS automatically detects appropriate output formats

  // Add output directory and input file (order matters for JPEXS CLI)
  params.push(options.outputDir)
  params.push(options.swfFile)

  return params
}

/**
 * Extract frames and audio from a Camtasia-generated SWF file using JPEXS
 *
 * This function spawns a Java process running JPEXS Free Flash Decompiler to extract:
 * - Sequential frame images (saved as PNG files in frames/ subdirectory)
 * - Audio content (saved as MP3/WAV files in sounds/ subdirectory)
 *
 * The function includes comprehensive directory setup and error handling specifically
 * tuned for Camtasia SWF files, which have different characteristics than general Flash files.
 *
 * @param options - Configuration with input SWF file and output directory
 * @param callbacks - Event handlers for process lifecycle and output
 */
export const extractSWFContent = (options: ExtractorOptions, callbacks: ExtractorCallbacks): void => {
  if (!options) {
    callbacks.onError('No options provided')
    return
  }
  
  if (!fs.existsSync(options.swfFile)) {
    callbacks.onError(`SWF file not found: ${options.swfFile}`)
    return
  }

  // Ensure output directory and subdirectories exist with proper permissions
  const outputDirResolved = path.resolve(options.outputDir)
  if (!fs.existsSync(outputDirResolved)) {
    fs.mkdirSync(outputDirResolved, { recursive: true, mode: 0o755 })
  }
  
  // Create frames and sounds subdirectories that JPEXS expects
  const framesDir = path.join(outputDirResolved, 'frames')
  const soundsDir = path.join(outputDirResolved, 'sounds')
  
  if (!fs.existsSync(framesDir)) {
    fs.mkdirSync(framesDir, { recursive: true, mode: 0o755 })
  }
  
  if (!fs.existsSync(soundsDir)) {
    fs.mkdirSync(soundsDir, { recursive: true, mode: 0o755 })
  }
  
  // Additional safety: ensure parent directories exist for potential subdirectories JPEXS might create
  try {
    // JPEXS sometimes creates numbered subdirectories within frames/
    for (let i = 0; i < 10; i++) {
      const subDir = path.join(framesDir, i.toString())
      if (!fs.existsSync(subDir)) {
        fs.mkdirSync(subDir, { recursive: true, mode: 0o755 })
      }
    }
  } catch (err) {
    // Ignore errors here as this is just preemptive directory creation
  }

  const javaProcess = spawn('java', buildExtractionParameters(options))

  javaProcess.stdout.on('data', (data: Buffer) => callbacks.onStdout(data.toString('utf8')))
  javaProcess.stderr.on('data', (data: Buffer) => {
    const stderrData = data.toString('utf8')
    // JPEXS writes many warnings to stderr that are not actual errors
    // Only treat actual command line errors as failures
    if (stderrData.includes('Input SWF file does not exist') || 
        stderrData.includes('Bad Commandline Arguments')) {
      callbacks.onError(stderrData)
    } else {
      // Log other stderr output as stdout (warnings, progress info, etc.)
      callbacks.onStdout(stderrData)
    }
  })
  javaProcess.on('close', () => callbacks.onClose())
  javaProcess.on('error', (error: Error) => {
    if (error.message.includes('ENOENT')) {
      callbacks.onError('Java Development Kit not found. Please install it.')
    } else {
      callbacks.onError(`Java process error: ${error.message}`)
    }
  })
}

/**
 * Fallback audio extraction using FFmpeg when JPEXS fails
 *
 * This function provides a reliable fallback for extracting audio from SWF files
 * when JPEXS fails or produces poor results. FFmpeg often handles Camtasia audio
 * formats better than JPEXS, especially for certain codecs.
 *
 * The function:
 * - Extracts audio directly from SWF without re-encoding (codec copy)
 * - Saves to sounds/0.mp3 following the expected directory structure
 * - Handles cases where SWF has no audio stream gracefully
 * - Provides detailed logging for debugging audio issues
 *
 * @param swfFile - Path to the input SWF file
 * @param outputDir - Base output directory (sounds/ will be created within)
 * @returns Promise that resolves when extraction completes or fails gracefully
 * @export Exported for testing purposes
 */
export const extractAudioWithFFmpeg = (swfFile: string, outputDir: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!ffmpegInitialized) {
      reject(new Error('FFmpeg not available for fallback audio extraction'))
      return
    }

    // Ensure sounds directory exists for audio output
    const soundsDir = path.join(outputDir, 'sounds')
    if (!fs.existsSync(soundsDir)) {
      fs.mkdirSync(soundsDir, { recursive: true })
    }

    const outputAudioPath = path.join(soundsDir, '0.mp3')
    
    // Use fluent-ffmpeg to extract audio directly from SWF
    ffmpeg(swfFile)
      .noVideo()  // Disable video
      .audioCodec('copy')  // Copy audio codec without re-encoding
      .output(outputAudioPath)
      .on('start', (commandLine) => {
        if (process.env.NODE_ENV !== 'test') {
          console.log(`🔄 DEBUG: Starting FFmpeg audio extraction: ${commandLine}`)
        }
      })
      .on('end', () => {
        if (fs.existsSync(outputAudioPath) && fs.statSync(outputAudioPath).size > 0) {
          if (process.env.NODE_ENV !== 'test') {
            console.log(`🎵 DEBUG: Fallback audio extraction successful using FFmpeg`)
          }
          resolve()
        } else {
          if (process.env.NODE_ENV !== 'test') {
            console.log(`ℹ️ DEBUG: No audio stream found in SWF file (empty output)`)
          }
          resolve()
        }
      })
      .on('error', (error) => {
        // Check if it's just a "no audio stream" error
        if (error.message.includes('Output file is empty') ||
            error.message.includes('does not contain any stream')) {
          if (process.env.NODE_ENV !== 'test') {
            console.log(`ℹ️ DEBUG: No audio stream found in SWF file: ${error.message}`)
          }
          resolve()
        } else {
          if (process.env.NODE_ENV !== 'test') {
            console.log(`❌ DEBUG: FFmpeg audio extraction failed: ${error.message}`)
          }
          reject(new Error(`FFmpeg audio extraction failed: ${error.message}`))
        }
      })
      .run()
  })
}

/**
 * High-level SWF extraction with dual-strategy approach
 *
 * This is the main extraction function that combines JPEXS and FFmpeg for optimal results:
 *
 * 1. **Primary Extraction**: Uses JPEXS for frame extraction (with 5-minute timeout)
 * 2. **Audio Fallback**: Always attempts FFmpeg audio extraction for better reliability
 * 3. **Validation**: Ensures at least frames were extracted (audio is optional)
 * 4. **Error Handling**: Comprehensive error handling with helpful debug information
 *
 * This dual approach ensures maximum compatibility with various Camtasia SWF formats
 * while providing reliable extraction even when one method partially fails.
 *
 * @param swfFile - Path to the input SWF file
 * @param outputDir - Directory where extracted content will be saved
 * @returns Promise that resolves when extraction completes successfully
 * @throws Error if no frames could be extracted or critical errors occur
 */
export const extractSWF = async (swfFile: string, outputDir: string): Promise<void> => {
  let jpexsSucceeded = false

  if (process.env.NODE_ENV !== 'test') {
    console.log(`🚀 DEBUG: Starting extractSWF for ${swfFile}`)
  }
  
  try {
    // Try standard JPEXS extraction first with timeout
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('JPEXS extraction timed out after 5 minutes'))
      }, 300000) // 5 minutes for large files
      extractSWFContent(
        { swfFile, outputDir },
        {
          onError: (err: string) => {
            clearTimeout(timeout)
            if (err.trim() && process.env.NODE_ENV !== 'test') {
              console.error(`Extraction error: ${err.trim()}`)
            }
            // Don't reject immediately - we'll try FFmpeg fallback
            resolve()
          },
          onClose: () => {
            clearTimeout(timeout)
            jpexsSucceeded = true
            resolve()
          },
          onStdout: (data: string) => {
            // Log extraction progress (muted styling temporarily disabled)
            if (data.trim()) {
              // console.log(`${data.trim()}`)  // Temporarily muted
            }
          }
        }
      )
    })
    
    if (process.env.NODE_ENV !== 'test') {
      console.log(`📋 DEBUG: JPEXS extraction completed, jpexsSucceeded=${jpexsSucceeded}`)
    }

    // Check if audio extraction was successful
    const soundsDir = path.join(outputDir, 'sounds')
    const soundsDirExists = fs.existsSync(soundsDir)
    let audioFiles: string[] = []

    if (soundsDirExists) {
      audioFiles = fs.readdirSync(soundsDir).filter(f => /\.(mp3|wav)$/i.test(f))
    }

    const hasAudioFiles = soundsDirExists && audioFiles.length > 0

    if (process.env.NODE_ENV !== 'test') {
      console.log(`🔍 DEBUG: Audio check: sounds dir exists=${soundsDirExists}, audio files=${audioFiles.length}`)

      // Always try FFmpeg for audio extraction since JPEXS has issues with some SWF audio formats
      console.log(`🔄 DEBUG: Using FFmpeg for audio extraction...`)
    }

    try {
      await extractAudioWithFFmpeg(swfFile, outputDir)
      if (process.env.NODE_ENV !== 'test') {
        console.log(`✅ DEBUG: FFmpeg audio extraction completed`)
      }
    } catch (fallbackError: any) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`❌ DEBUG: FFmpeg audio extraction failed: ${fallbackError.message}`)
      }
    }
    
    // If JPEXS completely failed (no frames extracted), we need to fail
    // Check both frames subdirectory and root directory for PNG files
    const framesDir = path.join(outputDir, 'frames')
    const hasFramesInSubdir = fs.existsSync(framesDir) &&
                             fs.readdirSync(framesDir).filter(f => /\.png$/i.test(f)).length > 0
    const hasFramesInRoot = fs.existsSync(outputDir) &&
                           fs.readdirSync(outputDir).filter(f => /\.png$/i.test(f)).length > 0
    const hasFrames = hasFramesInSubdir || hasFramesInRoot

    if (process.env.NODE_ENV !== 'test') {
      console.log(`📁 DEBUG: Frames check: frames dir has ${hasFrames ? 'frames' : 'no frames'} (subdir: ${hasFramesInSubdir}, root: ${hasFramesInRoot})`)
    }

    if (!jpexsSucceeded && !hasFrames) {
      throw new Error('JPEXS extraction failed completely and no frames were extracted')
    }

    if (process.env.NODE_ENV !== 'test') {
      console.log(`🎉 DEBUG: extractSWF completed successfully`)
    }

  } catch (error) {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`💥 DEBUG: extractSWF error: ${error}`)
    }
    throw error
  }
}

/**
 * Result of analyzing extracted SWF content
 *
 * This interface describes the structure of content extracted from an SWF file,
 * providing all information needed for subsequent video conversion.
 */
export interface ExtractedContent {
  /** Directory containing the frame images (may be frames/ subdir or root) */
  framesDir: string
  /** Array of full paths to extracted frame files, sorted numerically */
  frameFiles: string[]
  /** Array of full paths to extracted audio files */
  audioFiles: string[]
  /** Total number of frame images found */
  frameCount: number
}

/**
 * Analyze extracted SWF content and prepare metadata for video conversion
 *
 * This function examines the output directory from extraction and catalogs all
 * extracted content. It handles the different directory structures that JPEXS
 * might create and ensures frame files are properly sorted for video creation.
 *
 * Key behaviors:
 * - Checks both frames/ subdirectory and root directory for PNG files
 * - Uses whichever location has more frames (or root directory if equal)
 * - Sorts frame files numerically to ensure correct video sequence
 * - Identifies all supported audio formats (MP3, WAV, FLV)
 *
 * @param outputDir - Base directory containing extracted content
 * @returns ExtractedContent object with organized file paths and metadata
 */
export const analyzeExtractedContent = (outputDir: string): ExtractedContent => {
  const framesDir = path.join(outputDir, 'frames')
  const soundsDir = path.join(outputDir, 'sounds')
  
  // Find frame files (check both frames subdirectory and root directory)
  let frameFiles: string[] = []
  let actualFramesDir = framesDir
  
  // First check if frames subdirectory has actual PNG files
  let framesInSubdir: string[] = []
  if (fs.existsSync(framesDir)) {
    framesInSubdir = fs.readdirSync(framesDir)
      .filter(file => file.toLowerCase().endsWith('.png'))
  }
  
  // Then check if root directory has PNG files
  let framesInRoot: string[] = []
  if (fs.existsSync(outputDir)) {
    framesInRoot = fs.readdirSync(outputDir)
      .filter(file => file.toLowerCase().endsWith('.png'))
  }
  
  // Use whichever location has more frames (or root if equal)
  if (framesInSubdir.length > framesInRoot.length) {
    frameFiles = framesInSubdir.map(file => path.join(framesDir, file))
    actualFramesDir = framesDir
  } else {
    frameFiles = framesInRoot.map(file => path.join(outputDir, file))
    actualFramesDir = outputDir
  }
  
  // Sort frame files by number
  frameFiles.sort((a, b) => {
    const aMatch = path.basename(a).match(/(\d+)/)
    const bMatch = path.basename(b).match(/(\d+)/)
    if (aMatch && bMatch) {
      return parseInt(aMatch[1]) - parseInt(bMatch[1])
    }
    return a.localeCompare(b)
  })
  
  // Find audio files
  let audioFiles: string[] = []
  if (fs.existsSync(soundsDir)) {
    audioFiles = fs.readdirSync(soundsDir)
      .filter(file => {
        const ext = path.extname(file).toLowerCase()
        return ext === '.mp3' || ext === '.wav' || ext === '.flv'
      })
      .map(file => path.join(soundsDir, file))
  }
  
  return {
    framesDir: actualFramesDir,
    frameFiles,
    audioFiles,
    frameCount: frameFiles.length
  }
}
