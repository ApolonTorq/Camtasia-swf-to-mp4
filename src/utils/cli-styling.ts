/**
 * @fileoverview CLI Styling and Output Utilities
 *
 * This module provides a comprehensive set of styling utilities for creating
 * beautiful, colorful command-line output. It's designed to make the CLI
 * experience engaging and informative with consistent visual styling.
 *
 * Features:
 * - Color-coded message types (success, error, warning, info)
 * - Gradient text effects for headers and special messages
 * - Bordered boxes for important messages
 * - Progress bars with automatic color coding
 * - Styled spinners for loading states
 * - File processing status indicators
 *
 * All styling is automatically applied based on message context, making
 * it easy to maintain consistent visual branding throughout the CLI.
 */

import chalk from 'chalk'
import boxen from 'boxen'
import gradient from 'gradient-string'
import ora from 'ora'

/**
 * Standard color palette for consistent CLI styling
 *
 * These color functions are used throughout the application to ensure
 * consistent visual styling and semantic meaning:
 * - success: Green for completed operations
 * - error: Red for failures and warnings
 * - warning: Yellow for caution messages
 * - info: Blue for informational content
 * - highlight: Cyan for emphasis and important values
 * - muted: Gray for secondary information
 */
export const colors = {
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  highlight: chalk.cyan,
  muted: chalk.gray,
  bold: chalk.bold,
  underline: chalk.underline
}

/**
 * Create gradient color functions for themed text effects
 *
 * This function provides predefined gradient themes for creating
 * eye-catching headers and special text effects. Each theme is
 * carefully chosen to be readable and visually appealing.
 *
 * @param theme - Name of gradient theme to use
 * @returns Gradient function that can style text with color transitions
 */
const getGradient = (theme: string) => {
  switch (theme) {
    case 'rainbow': return gradient(['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'])
    case 'ocean': return gradient(['cyan', 'blue'])
    case 'fire': return gradient(['red', 'orange', 'yellow'])
    case 'forest': return gradient(['green', 'lime'])
    case 'sunset': return gradient(['orange', 'red', 'purple'])
    case 'cool': return gradient(['blue', 'cyan', 'green'])
    default: return gradient(['cyan', 'blue']) // Default to ocean theme
  }
}

/**
 * Create a beautiful header with gradient text
 */
export const createHeader = (text: string, theme: string = 'ocean'): string => {
  const gradientFn = getGradient(theme)
  return boxen(gradientFn(text), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan',
    backgroundColor: 'black'
  })
}

/**
 * Create a success box
 */
export const createSuccessBox = (text: string): string => {
  return boxen(colors.success(text), {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: 'green'
  })
}

/**
 * Create an error box
 */
export const createErrorBox = (text: string): string => {
  return boxen(colors.error(text), {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: 'red'
  })
}

/**
 * Create an info box
 */
export const createInfoBox = (text: string): string => {
  return boxen(colors.info(text), {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: 'blue'
  })
}

/**
 * Create a warning box
 */
export const createWarningBox = (text: string): string => {
  return boxen(colors.warning(text), {
    padding: 1,
    margin: { top: 1, bottom: 1, left: 0, right: 0 },
    borderStyle: 'round',
    borderColor: 'yellow'
  })
}

/**
 * Log with automatic colors based on message type
 */
export const log = {
  success: (message: string) => console.log(colors.success(`✅ ${message}`)),
  error: (message: string) => console.log(colors.error(`❌ ${message}`)),
  warning: (message: string) => console.log(colors.warning(`⚠️  ${message}`)),
  info: (message: string) => console.log(colors.info(`ℹ️  ${message}`)),
  highlight: (message: string) => console.log(colors.highlight(`🔥 ${message}`)),
  muted: (message: string) => console.log(colors.muted(`   ${message}`)),
  gradient: (message: string, theme: string = 'rainbow') => {
    const gradientFn = getGradient(theme)
    console.log(gradientFn(`✨ ${message}`))
  }
}

/**
 * Create a spinner with automatic styling
 */
export const createStyledSpinner = (text: string, color: 'blue' | 'green' | 'yellow' | 'red' | 'cyan' = 'cyan') => {
  return ora({
    text: colors.highlight(text),
    color,
    spinner: 'dots12'
  })
}

/**
 * Create a progress indicator
 */
export const createProgress = (current: number, total: number, description: string = ''): string => {
  const percentage = Math.round((current / total) * 100)
  const barLength = 20
  const filledLength = Math.round((percentage / 100) * barLength)
  const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength)
  
  const coloredBar = percentage >= 100
    ? colors.success(bar)  // Green when complete
    : percentage >= 75
    ? colors.info(bar)     // Cyan when nearly done
    : percentage >= 25
    ? colors.warning(bar)  // Yellow when making progress
    : colors.muted(bar)    // Gray when just starting (not red)
  
  return `${coloredBar} ${colors.bold(`${percentage}%`)} ${colors.muted(`(${current}/${total})`)} ${description ? colors.highlight(description) : ''}`
}

/**
 * Display a file processing status
 */
export const fileStatus = {
  processing: (filename: string) => log.info(`Processing: ${colors.highlight(filename)}`),
  completed: (filename: string, outputPath?: string) => {
    const message = outputPath 
      ? `Completed: ${colors.highlight(filename)} → ${colors.success(outputPath)}`
      : `Completed: ${colors.highlight(filename)}`
    log.success(message)
  },
  failed: (filename: string, error: string) => 
    log.error(`Failed: ${colors.highlight(filename)} - ${error}`),
  error: (filename: string, error: string) => 
    log.error(`Failed: ${colors.highlight(filename)} - ${error}`)
}

/**
 * Display command usage with colors
 */
export const displayUsage = (command: string, description: string, examples: string[]) => {
  console.log(createHeader(`${command.toUpperCase()} COMMAND`, 'cool'))
  console.log(colors.info(description))
  console.log()
  console.log(colors.bold('Examples:'))
  examples.forEach(example => {
    console.log(colors.muted('  $'), colors.highlight(example))
  })
  console.log()
}
