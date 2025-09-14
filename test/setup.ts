import * as fs from 'fs'
import * as path from 'path'

// Mock problematic ESM modules for testing
jest.mock('../src/utils/cli-styling', () => ({
  createHeader: jest.fn((title: string) => `=== ${title} ===`),
  createSuccessBox: jest.fn((message: string) => `✅ ${message}`),
  createErrorBox: jest.fn((message: string) => `❌ ${message}`),
  log: {
    info: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    muted: jest.fn()
  },
  fileStatus: {
    processing: jest.fn(),
    completed: jest.fn()
  },
  createProgress: jest.fn((current: number, total: number) => `${current}/${total}`),
  createStyledSpinner: jest.fn(() => ({
    start: jest.fn(),
    stop: jest.fn(),
    succeed: jest.fn(),
    fail: jest.fn()
  })),
  colors: {
    highlight: jest.fn((text: string) => text),
    info: jest.fn((text: string) => text),
    warning: jest.fn((text: string) => text),
    error: jest.fn((text: string) => text),
    success: jest.fn((text: string) => text),
    bold: jest.fn((text: string) => text)
  }
}))

// Environment variable to suppress platform warnings in tests
process.env.NODE_ENV = 'test'

// Global test setup
beforeAll(() => {
  // Ensure test temp directory exists
  const tempDir = path.join(__dirname, 'temp')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
})

// Global test teardown
afterAll(() => {
  // Clean up test temp directory if it exists
  const tempDir = path.join(__dirname, 'temp')
  if (fs.existsSync(tempDir)) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Could not clean up test temp directory:', error)
    }
  }
})

// Increase timeout for all tests since SWF processing can be slow
jest.setTimeout(120000) // 2 minutes default timeout
