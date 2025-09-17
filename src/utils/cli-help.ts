import commandLineUsage from 'command-line-usage'
import chalk from 'chalk'

// Set terminal width for command-line-usage via environment variable
const setOptimalWidth = (): void => {
  // Get terminal width or default to wide screen
  const terminalWidth = process.stdout.columns || 140
  const optimalWidth = Math.max(100, Math.min(terminalWidth - 4, 160))
  
  // Set COLUMNS environment variable which many CLI tools use
  process.env.COLUMNS = optimalWidth.toString()
}

/**
 * CLI Help system with syntax highlighting for different command components
 * Uses different colors for: commands, options, arguments, values, descriptions
 */

// Color scheme for different CLI syntax elements
export const syntaxColors = {
  command: chalk.cyan.bold,        // Main commands (extract, convert)
  subcommand: chalk.blue.bold,     // Sub-commands
  option: chalk.green,             // Options like --output, -r
  argument: chalk.yellow,          // Required arguments like <input>
  optionalArg: chalk.yellow.dim,   // Optional arguments [input]
  value: chalk.magenta,            // Example values like "30", "presentation.swf"
  description: chalk.white,        // Description text
  example: chalk.gray,             // Example command text
  header: chalk.cyan.underline.bold, // Section headers
  flag: chalk.green.dim            // Boolean flags like --recursive
}

/**
 * Execution context types for the CLI
 */
type ExecutionContext = 'npm' | 'symlink'

/**
 * Detects how the CLI was started to provide appropriate usage examples
 */
const detectExecutionContext = (): ExecutionContext => {
  const scriptPath = process.argv[1] || ''
  const isNpmStart = process.argv.some(arg => arg.includes('npm') || arg === 'start')
  const isNodeModules = scriptPath.includes('node_modules')
  const isDirectNode = scriptPath.includes('dist/src/cli.js')

  // If running via npm start or directly via node
  if (isNpmStart || (isDirectNode && !isNodeModules)) {
    return 'npm'
  }

  return 'symlink'
}

/**
 * Generate context-appropriate command examples
 */
const getCommandPrefix = (context: ExecutionContext): string => {
  return context === 'npm' ? 'npm start --' : 'camtasia-swf'
}

/**
 * Generate syntax-highlighted help for the main command
 */
export const generateMainHelp = (): string => {
  const context = detectExecutionContext()
  const cmdPrefix = getCommandPrefix(context)

  const sections = [
    {
      header: syntaxColors.header('Camtasia SWF Tool'),
      content: syntaxColors.description('A command-line utility for processing Camtasia-generated Flash SWF files. Extract frame sequences and audio content, then convert them to modern MP4 format.')
    },
    {
      header: syntaxColors.header('Synopsis'),
      content: [
        syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.option('<command>') + ' ' + syntaxColors.argument('[options]'),
        '',
        syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('extract') + ' ' + syntaxColors.argument('<input>') + ' ' + syntaxColors.option('[--output <dir>]') + ' ' + syntaxColors.flag('[--recursive]'),
        syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('convert') + ' ' + syntaxColors.argument('<input>') + ' ' + syntaxColors.option('[--output <dir>]') + ' ' + syntaxColors.flag('[--recursive]') + ' ' + syntaxColors.option('[--framerate <fps>]') + ' ' + syntaxColors.flag('[--keep-extracted]')
      ]
    },
    {
      header: syntaxColors.header('Commands'),
      content: [
        {
          name: syntaxColors.subcommand('extract'),
          summary: syntaxColors.description('Extract frame images and audio content from SWF files')
        },
        {
          name: syntaxColors.subcommand('convert'),
          summary: syntaxColors.description('Extract and convert SWF files to MP4 format')
        }
      ]
    },
    {
      header: syntaxColors.header('Global Options'),
      content: [
        {
          name: syntaxColors.option('-h, --help'),
          summary: syntaxColors.description('Display help information')
        },
        {
          name: syntaxColors.option('-V, --version'),
          summary: syntaxColors.description('Display version number')
        }
      ]
    },
    {
      header: syntaxColors.header('Examples'),
      content: [
        syntaxColors.description('Extract frames from a single SWF file:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('extract') + ' ' + syntaxColors.value('presentation.swf'),
        '',
        syntaxColors.description('Convert SWF to MP4 with custom frame rate:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('convert') + ' ' + syntaxColors.value('presentation.swf') + ' ' + syntaxColors.option('--framerate') + ' ' + syntaxColors.value('60'),
        '',
        syntaxColors.description('Process directory recursively:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('extract') + ' ' + syntaxColors.value('./swf-files/') + ' ' + syntaxColors.flag('--recursive') + ' ' + syntaxColors.option('--output') + ' ' + syntaxColors.value('./output/'),
        '',
        syntaxColors.description('Batch convert multiple files:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('convert') + ' ' + syntaxColors.value('./presentations/') + ' ' + syntaxColors.flag('--recursive') + ' ' + syntaxColors.option('--framerate') + ' ' + syntaxColors.value('30') + ' ' + syntaxColors.flag('--keep-extracted')
      ]
    }
  ]

  setOptimalWidth()
  return commandLineUsage(sections)
}

/**
 * Generate syntax-highlighted help for the extract command
 */
export const generateExtractHelp = (): string => {
  const context = detectExecutionContext()
  const cmdPrefix = getCommandPrefix(context)

  const sections = [
    {
      header: syntaxColors.header('Extract Command'),
      content: syntaxColors.description('Extract frame images (PNG) and audio content (MP3/WAV) from Camtasia-generated SWF files.')
    },
    {
      header: syntaxColors.header('Synopsis'),
      content: syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('extract') + ' ' + syntaxColors.argument('<input>') + ' ' + syntaxColors.option('[options]')
    },
    {
      header: syntaxColors.header('Arguments'),
      content: [
        {
          name: syntaxColors.argument('<input>'),
          summary: syntaxColors.description('SWF file or directory containing SWF files to process')
        }
      ]
    },
    {
      header: syntaxColors.header('Options'),
      content: [
        {
          name: syntaxColors.option('-o, --output') + ' ' + syntaxColors.value('<dir>'),
          summary: syntaxColors.description('Output directory (default: adjacent to SWF files with "-output" suffix)')
        },
        {
          name: syntaxColors.flag('-r, --recursive'),
          summary: syntaxColors.description('Process directories recursively to find SWF files')
        },
        {
          name: syntaxColors.option('--test-frames') + ' ' + syntaxColors.value('<count>'),
          summary: syntaxColors.description('Extract only the first N frames for testing (e.g., --test-frames 100)')
        }
      ]
    },
    {
      header: syntaxColors.header('Output Structure'),
      content: [
        syntaxColors.description('Each SWF file creates an organized output folder:'),
        '',
        syntaxColors.value('presentation.swf') + ' → ' + syntaxColors.value('presentation-output/'),
        '├── ' + syntaxColors.option('frames/'),
        '│   ├── ' + syntaxColors.example('frame_001.png'),
        '│   ├── ' + syntaxColors.example('frame_002.png'),
        '│   └── ' + syntaxColors.example('...'),
        '└── ' + syntaxColors.option('sounds/'),
        '    └── ' + syntaxColors.example('sound_001.mp3')
      ]
    },
    {
      header: syntaxColors.header('Examples'),
      content: [
        syntaxColors.description('Extract from single file:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('extract') + ' ' + syntaxColors.value('presentation.swf'),
        '',
        syntaxColors.description('Extract from directory to custom output:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('extract') + ' ' + syntaxColors.value('./swf-files/') + ' ' + syntaxColors.option('--output') + ' ' + syntaxColors.value('./extracted/'),
        '',
        syntaxColors.description('Recursive processing:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('extract') + ' ' + syntaxColors.value('./presentations/') + ' ' + syntaxColors.flag('--recursive'),
        '',
        syntaxColors.description('Test mode - extract only first 100 frames:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('extract') + ' ' + syntaxColors.value('presentation.swf') + ' ' + syntaxColors.option('--test-frames') + ' ' + syntaxColors.value('100')
      ]
    }
  ]

  setOptimalWidth()
  return commandLineUsage(sections)
}

/**
 * Generate syntax-highlighted help for the convert command
 */
export const generateConvertHelp = (): string => {
  const context = detectExecutionContext()
  const cmdPrefix = getCommandPrefix(context)

  const sections = [
    {
      header: syntaxColors.header('Convert Command'),
      content: syntaxColors.description('Extract frame sequences and audio from SWF files, then merge them into MP4 videos using FFmpeg.')
    },
    {
      header: syntaxColors.header('Synopsis'),
      content: syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('convert') + ' ' + syntaxColors.argument('<input>') + ' ' + syntaxColors.option('[options]')
    },
    {
      header: syntaxColors.header('Arguments'),
      content: [
        {
          name: syntaxColors.argument('<input>'),
          summary: syntaxColors.description('SWF file or directory containing SWF files to convert')
        }
      ]
    },
    {
      header: syntaxColors.header('Options'),
      content: [
        {
          name: syntaxColors.option('-o, --output') + ' ' + syntaxColors.value('<dir>'),
          summary: syntaxColors.description('Output directory for MP4 files (default: adjacent to SWF files)')
        },
        {
          name: syntaxColors.flag('-r, --recursive'),
          summary: syntaxColors.description('Process directories recursively to find SWF files')
        },
        {
          name: syntaxColors.option('-f, --framerate') + ' ' + syntaxColors.value('<fps>'),
          summary: syntaxColors.description('Frame rate for output video (default: ') + syntaxColors.value('30') + syntaxColors.description(')')
        },
        {
          name: syntaxColors.flag('--keep-extracted'),
          summary: syntaxColors.description('Keep extracted frames and audio files after conversion')
        },
        {
          name: syntaxColors.option('--test-frames') + ' ' + syntaxColors.value('<count>'),
          summary: syntaxColors.description('Extract only the first N frames for testing (e.g., --test-frames 100)')
        }
      ]
    },
    {
      header: syntaxColors.header('Output'),
      content: [
        syntaxColors.description('Creates MP4 files with the same base name as input SWF files:'),
        '',
        syntaxColors.value('presentation.swf') + ' → ' + syntaxColors.value('presentation.mp4')
      ]
    },
    {
      header: syntaxColors.header('Examples'),
      content: [
        syntaxColors.description('Convert single file:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('convert') + ' ' + syntaxColors.value('presentation.swf'),
        '',
        syntaxColors.description('Convert with custom frame rate:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('convert') + ' ' + syntaxColors.value('presentation.swf') + ' ' + syntaxColors.option('--framerate') + ' ' + syntaxColors.value('60'),
        '',
        syntaxColors.description('Convert directory and keep extracted files:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('convert') + ' ' + syntaxColors.value('./swf-files/') + ' ' + syntaxColors.flag('--recursive') + ' ' + syntaxColors.flag('--keep-extracted'),
        '',
        syntaxColors.description('Convert to specific output directory:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('convert') + ' ' + syntaxColors.value('presentation.swf') + ' ' + syntaxColors.option('--output') + ' ' + syntaxColors.value('./videos/'),
        '',
        syntaxColors.description('Test mode - convert only first 50 frames:'),
        syntaxColors.example('  $ ') + syntaxColors.command(cmdPrefix) + ' ' + syntaxColors.subcommand('convert') + ' ' + syntaxColors.value('presentation.swf') + ' ' + syntaxColors.option('--test-frames') + ' ' + syntaxColors.value('50')
      ]
    },
    {
      header: syntaxColors.header('Requirements'),
      content: [
        syntaxColors.description('• ') + syntaxColors.option('Java JDK') + syntaxColors.description(' - Required for SWF processing'),
        syntaxColors.description('• ') + syntaxColors.option('FFmpeg') + syntaxColors.description(' - Required for MP4 conversion'),
        syntaxColors.description('• ') + syntaxColors.option('Node.js v22+') + syntaxColors.description(' - Runtime requirement')
      ]
    }
  ]

  setOptimalWidth()
  return commandLineUsage(sections)
}
