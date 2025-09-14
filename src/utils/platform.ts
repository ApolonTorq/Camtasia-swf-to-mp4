/**
 * @fileoverview Cross-Platform Support Utilities
 *
 * This module handles platform detection and tool availability for the Camtasia SWF Tool.
 * It provides cross-platform support for Windows, Linux, and macOS with specific handling
 * for different binary formats and path requirements.
 *
 * Key Features:
 * - FFmpeg binary detection and path resolution
 * - WSL (Windows Subsystem for Linux) compatibility
 * - Java availability checking
 * - Platform-specific binary extension handling (.exe on Windows)
 * - Fallback path discovery for different ffmpeg-static configurations
 * - Comprehensive platform validation and reporting
 *
 * The module is designed to gracefully handle edge cases like:
 * - Missing binaries on specific platforms
 * - Different ffmpeg-static installation patterns
 * - WSL environments where Windows binaries can run on Linux
 * - Development vs production binary locations
 */

import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import ffmpegStatic from 'ffmpeg-static'

/** Platforms supported by the Camtasia SWF Tool */
export type SupportedPlatform = 'win32' | 'linux' | 'darwin'

/**
 * Get the current platform and validate it's supported
 *
 * This function determines the current operating system and ensures it's one
 * of the platforms supported by the Camtasia SWF Tool. If the platform is
 * unsupported, it provides helpful error messages and exits.
 *
 * The function uses Node.js process.platform which returns:
 * - 'win32' for Windows (including 64-bit)
 * - 'linux' for Linux distributions
 * - 'darwin' for macOS
 *
 * @returns The current platform identifier
 * @throws Exits process with error message if platform is unsupported
 */
export const getCurrentPlatform = (): SupportedPlatform => {
  const platform = process.platform as SupportedPlatform

  if (!isSupportedPlatform(platform)) {
    console.error(`❌ Unsupported platform: ${platform}`)
    console.error(`   Supported platforms: Windows (win32), Linux (linux), macOS (darwin)`)
    console.error(`   If you believe this platform should be supported, please check if ffmpeg-static`)
    console.error(`   provides binaries for ${platform} and update the platform support accordingly.`)
    process.exit(1)
  }

  return platform
}

/**
 * Type guard to check if a platform string is supported
 *
 * This function validates whether a given platform identifier corresponds
 * to one of the platforms supported by the application and its dependencies.
 *
 * @param platform - Platform string to validate
 * @returns True if platform is supported, false otherwise
 */
export const isSupportedPlatform = (platform: string): platform is SupportedPlatform => {
  return ['win32', 'linux', 'darwin'].includes(platform)
}

/**
 * Detect and resolve FFmpeg binary path with cross-platform support
 *
 * This is the core function for FFmpeg binary detection. It handles:
 * - Platform-specific binary extensions (.exe on Windows)
 * - Alternative installation paths from ffmpeg-static
 * - WSL compatibility (Windows binaries work in WSL environments)
 * - Graceful fallback when binaries are missing
 *
 * The function tries multiple strategies to find a working FFmpeg binary,
 * ensuring maximum compatibility across different installation scenarios.
 *
 * @returns Full path to FFmpeg binary, or null if not found
 */
export const getFFmpegPath = (): string | null => {
  const platform = getCurrentPlatform()

  if (!ffmpegStatic) {
    console.warn(`⚠️  FFmpeg static binary not available for platform: ${platform}`)
    return null
  }

  let ffmpegPath = ffmpegStatic

  // Handle platform-specific binary naming
  switch (platform) {
    case 'win32':
      // On Windows, ensure .exe extension
      if (!ffmpegPath.endsWith('.exe')) {
        ffmpegPath = ffmpegPath + '.exe'
      }
      break

    case 'linux':
    case 'darwin':
      // On Unix systems, remove .exe extension if present
      if (ffmpegPath.endsWith('.exe')) {
        ffmpegPath = ffmpegPath.slice(0, -4)
      }
      break
  }

  // Verify the binary actually exists
  if (!fs.existsSync(ffmpegPath)) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`⚠️  FFmpeg binary not found at expected path: ${ffmpegPath}`)
    }

    // Try alternative paths based on common ffmpeg-static patterns
    const alternatives = getAlternativeFFmpegPaths(platform)
    for (const altPath of alternatives) {
      if (fs.existsSync(altPath)) {
        if (process.env.NODE_ENV !== 'test') {
          console.log(`✅ Found FFmpeg binary at alternative path: ${altPath}`)
        }
        return altPath
      }
    }

    // Special case: On WSL/Linux, try Windows .exe binary (works via WSL interop)
    if (platform === 'linux' && process.env.WSL_DISTRO_NAME) {
      const windowsBinary = ffmpegPath + '.exe'
      if (fs.existsSync(windowsBinary)) {
        if (process.env.NODE_ENV !== 'test') {
          console.log(`✅ Found Windows FFmpeg binary for WSL: ${windowsBinary}`)
        }
        return windowsBinary
      }
    }

    return null
  }

  return ffmpegPath
}

/**
 * Get alternative FFmpeg paths to check when the primary path fails
 */
const getAlternativeFFmpegPaths = (platform: SupportedPlatform): string[] => {
  if (!ffmpegStatic) return []

  const baseDir = path.dirname(ffmpegStatic)
  const alternatives: string[] = []

  switch (platform) {
    case 'win32':
      alternatives.push(
        path.join(baseDir, 'ffmpeg.exe'),
        path.join(baseDir, 'bin', 'ffmpeg.exe'),
        path.join(baseDir, '..', 'ffmpeg-static', 'ffmpeg.exe')
      )
      break

    case 'linux':
      alternatives.push(
        path.join(baseDir, 'ffmpeg'),
        path.join(baseDir, 'bin', 'ffmpeg'),
        path.join(baseDir, '..', 'ffmpeg-static', 'ffmpeg')
      )
      break

    case 'darwin':
      alternatives.push(
        path.join(baseDir, 'ffmpeg'),
        path.join(baseDir, 'bin', 'ffmpeg'),
        path.join(baseDir, '..', 'ffmpeg-static', 'ffmpeg')
      )
      break
  }

  return alternatives
}

/**
 * Get the FFprobe path corresponding to the FFmpeg path
 */
export const getFFprobePath = (ffmpegPath: string): string | null => {
  const platform = getCurrentPlatform()

  let ffprobePath = ffmpegPath.replace(/ffmpeg(\.exe)?$/, 'ffprobe')

  // Add platform-specific extension
  if (platform === 'win32' && !ffprobePath.endsWith('.exe')) {
    ffprobePath += '.exe'
  }

  // Verify ffprobe exists
  if (fs.existsSync(ffprobePath)) {
    return ffprobePath
  }

  // Special case: On WSL/Linux, try Windows .exe binary
  if (platform === 'linux' && process.env.WSL_DISTRO_NAME) {
    const windowsFFprobe = ffprobePath + '.exe'
    if (fs.existsSync(windowsFFprobe)) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`✅ Found Windows FFprobe binary for WSL: ${windowsFFprobe}`)
      }
      return windowsFFprobe
    }
  }

  if (process.env.NODE_ENV !== 'test') {
    console.warn(`⚠️  FFprobe not found at: ${ffprobePath}`)
  }
  return null
}

/**
 * Comprehensive platform and tool availability validation
 *
 * This function performs a complete check of all tools required for the
 * Camtasia SWF Tool functionality. It's the central validation point used
 * throughout the application to determine what features can be enabled.
 *
 * The validation checks:
 * - Current platform compatibility
 * - FFmpeg binary availability and path resolution
 * - FFprobe binary availability (for media analysis)
 * - Java JDK availability (for JPEXS decompiler)
 * - Overall platform support status
 *
 * @returns Comprehensive platform status object with all tool availability info
 */
export const validatePlatformSupport = (): {
  platform: SupportedPlatform
  ffmpeg: string | null
  ffprobe: string | null
  java: boolean
  isFullySupported: boolean
} => {
  const platform = getCurrentPlatform()
  const ffmpegPath = getFFmpegPath()
  const ffprobePath = ffmpegPath ? getFFprobePath(ffmpegPath) : null

  // Check Java availability (for JPEXS)
  const javaAvailable = checkJavaAvailability()

  const isFullySupported = !!(ffmpegPath && javaAvailable)

  return {
    platform,
    ffmpeg: ffmpegPath,
    ffprobe: ffprobePath,
    java: javaAvailable,
    isFullySupported
  }
}

/**
 * Check if Java is available in the system PATH
 */
const checkJavaAvailability = (): boolean => {
  try {
    const { execSync } = require('child_process')
    execSync('java -version', { stdio: 'ignore' })
    return true
  } catch (error) {
    return false
  }
}

/**
 * Log platform support status with helpful information
 */
export const logPlatformStatus = (): void => {
  const status = validatePlatformSupport()

  console.log(`🔍 Platform Support Status:`)
  console.log(`   Platform: ${status.platform} (${os.arch()})`)
  console.log(`   FFmpeg: ${status.ffmpeg ? '✅ Available' : '❌ Not found'}`)
  if (status.ffmpeg) {
    console.log(`           Path: ${status.ffmpeg}`)
  }
  console.log(`   FFprobe: ${status.ffprobe ? '✅ Available' : '❌ Not found'}`)
  console.log(`   Java: ${status.java ? '✅ Available' : '❌ Not found'}`)

  if (!status.isFullySupported) {
    console.log(`\n⚠️  Some features may not work properly:`)
    if (!status.ffmpeg) {
      console.log(`   • Video conversion requires FFmpeg`)
    }
    if (!status.java) {
      console.log(`   • SWF extraction requires Java (for JPEXS decompiler)`)
    }
  } else {
    console.log(`\n✅ All required tools are available`)
  }
}