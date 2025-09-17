#!/usr/bin/env node

/**
 * @fileoverview CLI interface for the Camtasia SWF Tool
 *
 * This command-line interface provides two main commands:
 * 1. `extract` - Extract frames and audio from SWF files
 * 2. `convert` - Extract and convert SWF files directly to MP4
 *
 * The CLI includes:
 * - Styled output with colors, progress bars, and spinners
 * - Platform validation (Java and FFmpeg availability)
 * - Batch processing support (single files or directories)
 * - Recursive directory scanning
 * - Custom help system with syntax highlighting
 *
 * @example Command usage
 * ```bash
 * # Extract single file
 * camtasia-swf extract input.swf -o output-dir
 *
 * # Convert directory of SWF files to MP4
 * camtasia-swf convert /path/to/swfs -r --framerate 30
 *
 * # Show help for specific command
 * camtasia-swf help extract
 * ```
 */

import { Command } from 'commander'
import * as path from 'path'
import * as fs from 'fs'
import { glob } from 'glob'
import { extractSWF } from './tools/extractor'
import { convertSWF } from './tools/converter'
import {
  createHeader,
  createSuccessBox,
  createErrorBox,
  log,
  fileStatus,
  createProgress,
  createStyledSpinner,
  colors
} from './utils/cli-styling'
import {
  generateMainHelp,
  generateExtractHelp,
  generateConvertHelp
} from './utils/cli-help'
import { validatePlatformSupport, logPlatformStatus } from './utils/platform'

// Initialize Commander.js program with custom configuration
const program = new Command()

program
  .name('camtasia-swf')
  .description('Flash SWF processing utility for Camtasia-generated files')
  .version('0.2.0')
  .configureHelp({
    // Dynamic help width based on terminal size (min 100, max 160 chars)
    helpWidth: Math.max(100, Math.min((process.stdout.columns || 140) - 4, 160)),
    sortSubcommands: true
  })
  .addHelpCommand(false) // Disable default help to use our styled help system

/**
 * Custom help command with styled output
 * Provides context-specific help with syntax highlighting and examples
 */
program
  .command('help')
  .description('Display help information with syntax highlighting')
  .argument('[command]', 'Show help for specific command')
  .action((command?: string) => {
    // Route to appropriate help generator based on command
    if (command === 'extract') {
      console.log(generateExtractHelp())
    } else if (command === 'convert') {
      console.log(generateConvertHelp())
    } else {
      console.log(generateMainHelp())
    }
  })

// Override default help option
program.option('-h, --help', 'Display help information with syntax highlighting')

/**
 * EXTRACT command - Extract frames and audio from SWF files
 *
 * This command uses JPEXS Free Flash Decompiler to extract:
 * - Frame images as sequential PNG files
 * - Audio content as MP3/WAV files
 * - Falls back to FFmpeg for audio extraction if JPEXS fails
 *
 * Supports both single files and batch processing of directories.
 */
program
  .command('extract')
  .description('Extract frame images and audio content from SWF files')
  .argument('<input>', 'SWF file or directory containing SWF files')
  .option('-o, --output <dir>', 'Output directory (default: adjacent to SWF files)')
  .option('-r, --recursive', 'Process directories recursively')
  .option('-h, --help', 'Display help for extract command')
  .action(async (input: string, options: { output?: string; recursive?: boolean; help?: boolean }) => {
    if (options.help) {
      console.log(generateExtractHelp())
      return
    }
    console.log(createHeader('CAMTASIA SWF EXTRACTOR', 'forest'))

    // Validate platform support
    const platformStatus = validatePlatformSupport()
    if (!platformStatus.java) {
      console.log(createErrorBox('Java not found. Java is required for SWF extraction (JPEXS decompiler).'))
      logPlatformStatus()
      process.exit(1)
    }

    try {
      const spinner = createStyledSpinner('Scanning for SWF files...', 'cyan')
      spinner.start()
      
      const swfFiles = await findSWFFiles(input, options.recursive)
      spinner.stop()
      
      if (swfFiles.length === 0) {
        console.log(createErrorBox('No SWF files found in the specified input'))
        process.exit(1)
      }

      log.info(`Found ${colors.highlight(swfFiles.length.toString())} SWF file(s) to process`)
      console.log()

      const results = {
        successful: 0,
        failed: 0,
        errors: [] as Array<{ file: string; error: string }>
      }

      for (let i = 0; i < swfFiles.length; i++) {
        const swfFile = swfFiles[i]
        const progress = createProgress(i + 1, swfFiles.length, 'files processed')
        console.log(progress)
        
        fileStatus.processing(path.basename(swfFile))
        
        const outputDir = options.output 
          ? path.join(options.output, path.basename(swfFile, '.swf'))
          : path.join(path.dirname(swfFile), path.basename(swfFile, '.swf') + '-output')

        try {
          await extractSWF(swfFile, outputDir)
          fileStatus.completed(path.basename(swfFile), outputDir)
          results.successful++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          fileStatus.error(path.basename(swfFile), errorMessage)
          results.failed++
          results.errors.push({ file: path.basename(swfFile), error: errorMessage })
        }
        console.log()
      }
      
      // Show final results
      if (results.successful > 0) {
        console.log(createSuccessBox(`🎉 Successfully extracted ${results.successful} SWF file(s)!`))
      }
      
      if (results.failed > 0) {
        console.log(createErrorBox(`❌ Failed to extract ${results.failed} SWF file(s):`))
        results.errors.forEach(({ file, error }) => {
          console.log(`   ${colors.error('•')} ${file}: ${error}`)
        })
        
        // Exit with error code only if ALL files failed
        if (results.successful === 0) {
          process.exit(1)
        }
      }
    } catch (error) {
      console.log(createErrorBox(`Fatal error during extraction: ${error}`))
      process.exit(1)
    }
  })

/**
 * CONVERT command - Extract and convert SWF files to MP4 format
 *
 * This is the most common command - it performs a complete workflow:
 * 1. Detects frame rate from the SWF using FFmpeg
 * 2. Extracts frames and audio using JPEXS + FFmpeg fallback
 * 3. Combines frames into MP4 with synchronized audio
 * 4. Optionally cleans up temporary extraction files
 *
 * Requires both Java (for JPEXS) and FFmpeg (bundled) to be available.
 */
program
  .command('convert')
  .description('Extract and convert SWF files to MP4 format')
  .argument('<input>', 'SWF file or directory containing SWF files')
  .option('-o, --output <dir>', 'Output directory (default: adjacent to SWF files)')
  .option('-r, --recursive', 'Process directories recursively')
  .option('-f, --framerate <fps>', 'Frame rate for output video (default: 30)', '30')
  .option('--keep-extracted', 'Keep extracted frames and audio files after conversion')
  .option('-h, --help', 'Display help for convert command')
  .action(async (input: string, options: {
    output?: string;
    recursive?: boolean;
    framerate?: string;
    keepExtracted?: boolean;
    help?: boolean;
  }) => {
    if (options.help) {
      console.log(generateConvertHelp())
      return
    }
    console.log(createHeader('CAMTASIA SWF TO MP4 CONVERTER', 'fire'))

    // Validate platform support
    const platformStatus = validatePlatformSupport()
    if (!platformStatus.isFullySupported) {
      const missingTools: string[] = []
      if (!platformStatus.java) missingTools.push('Java (for SWF extraction)')
      if (!platformStatus.ffmpeg) missingTools.push('FFmpeg (for video conversion)')

      console.log(createErrorBox(`Missing required tools: ${missingTools.join(', ')}`))
      logPlatformStatus()
      process.exit(1)
    }

    try {
      const spinner = createStyledSpinner('Scanning for SWF files...', 'yellow')
      spinner.start()
      
      const swfFiles = await findSWFFiles(input, options.recursive)
      spinner.stop()
      
      if (swfFiles.length === 0) {
        console.log(createErrorBox('No SWF files found in the specified input'))
        process.exit(1)
      }

      log.info(`Found ${colors.highlight(swfFiles.length.toString())} SWF file(s) to convert`)
      log.info(`Frame rate: ${colors.highlight(options.framerate || '30')} FPS`)
      if (options.keepExtracted) {
        log.info('Extracted files will be kept after conversion')
      }
      console.log()

      const results = {
        successful: 0,
        failed: 0,
        errors: [] as Array<{ file: string; error: string }>
      }

      for (let i = 0; i < swfFiles.length; i++) {
        const swfFile = swfFiles[i]
        const progress = createProgress(i + 1, swfFiles.length, 'files converted')
        console.log(progress)
        
        fileStatus.processing(path.basename(swfFile))
        
        const outputDir = options.output 
          ? options.output
          : path.dirname(swfFile)

        const mp4Path = path.join(outputDir, path.basename(swfFile, '.swf') + '.mp4')
        
        try {
          await convertSWF(swfFile, mp4Path, {
            framerate: parseInt(options.framerate || '30'),
            keepExtracted: options.keepExtracted || false
          })
          
          fileStatus.completed(path.basename(swfFile), mp4Path)
          results.successful++
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error)
          fileStatus.error(path.basename(swfFile), errorMessage)
          results.failed++
          results.errors.push({ file: path.basename(swfFile), error: errorMessage })
        }
        console.log()
      }
      
      // Show final results
      if (results.successful > 0) {
        console.log(createSuccessBox(`🎬 Successfully converted ${results.successful} SWF file(s) to MP4!`))
      }
      
      if (results.failed > 0) {
        console.log(createErrorBox(`❌ Failed to convert ${results.failed} SWF file(s):`))
        results.errors.forEach(({ file, error }) => {
          console.log(`   ${colors.error('•')} ${file}: ${error}`)
        })
        
        // Exit with error code only if ALL files failed
        if (results.successful === 0) {
          process.exit(1)
        }
      }
    } catch (error) {
      console.log(createErrorBox(`Fatal error during conversion: ${error}`))
      process.exit(1)
    }
  })

/**
 * Helper function to find SWF files from input path
 *
 * Handles both single files and directory scanning:
 * - If input is a file, validates it's a .swf file
 * - If input is a directory, uses glob patterns to find .swf files
 * - Supports recursive scanning with ** glob pattern
 * - Case-insensitive file extension matching
 *
 * @param input - File path or directory path to scan
 * @param recursive - Whether to search subdirectories recursively
 * @returns Array of absolute paths to .swf files
 * @throws Error if input file is not .swf or path doesn't exist
 */
async function findSWFFiles(input: string, recursive: boolean = false): Promise<string[]> {
  const inputPath = path.resolve(input)

  // Handle single file input
  if (fs.statSync(inputPath).isFile()) {
    if (path.extname(inputPath).toLowerCase() === '.swf') {
      return [inputPath]
    } else {
      throw new Error('Input file must be a .swf file')
    }
  }

  // Handle directory input - use glob to find SWF files
  const pattern = recursive ? '**/*.swf' : '*.swf' // Recursive vs. flat directory scan
  const swfFiles = await glob(pattern, {
    cwd: inputPath,        // Search within the input directory
    absolute: true,        // Return absolute paths
    nocase: true          // Case-insensitive matching (.SWF, .swf, etc.)
  })

  return swfFiles
}

// Handle main help and no-command scenarios
program.on('option:help', () => {
  console.log(generateMainHelp())
  process.exit(0)
})

// If no arguments provided, show help
if (process.argv.length <= 2) {
  console.log(generateMainHelp())
  process.exit(0)
}

program.parse()
