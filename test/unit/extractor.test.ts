import * as fs from 'fs'
import * as path from 'path'
import { extractSWF, analyzeExtractedContent } from '../../src/tools/extractor'

describe('SWF Extractor', () => {
  const fixturesDir = path.join(__dirname, '..', 'fixtures', 'videos')
  const tempOutputDir = path.join(__dirname, '..', 'temp', 'extractor-output')
  
  // Test fixture files
  const testFiles = [
    'silent-audio.swf',
    'with-audio.swf'
  ]

  beforeAll(() => {
    // Ensure temp directory exists
    if (!fs.existsSync(tempOutputDir)) {
      fs.mkdirSync(tempOutputDir, { recursive: true })
    }
  })

  afterAll(() => {
    // Clean up temp directory
    if (fs.existsSync(tempOutputDir)) {
      fs.rmSync(tempOutputDir, { recursive: true, force: true })
    }
  })

  describe('extractSWF function', () => {
    testFiles.forEach(testFile => {
      it(`should extract content from ${testFile}`, async () => {
        const swfPath = path.join(fixturesDir, testFile)
        const outputDir = path.join(tempOutputDir, path.basename(testFile, '.swf'))

        // Verify test file exists
        expect(fs.existsSync(swfPath)).toBe(true)

        // Extract the SWF
        await expect(extractSWF(swfPath, outputDir)).resolves.not.toThrow()

        // Verify output directory was created
        expect(fs.existsSync(outputDir)).toBe(true)

        // Check if frames directory exists and has content
        const framesDir = path.join(outputDir, 'frames')
        if (fs.existsSync(framesDir)) {
          const frameFiles = fs.readdirSync(framesDir)
          expect(frameFiles.length).toBeGreaterThan(0)
          
          // Verify frame files are images
          const imageFiles = frameFiles.filter(file => 
            /\.(png|jpg|jpeg|gif|bmp)$/i.test(file)
          )
          expect(imageFiles.length).toBeGreaterThan(0)
        }

        // Check if audio files were extracted
        const audioFiles = fs.readdirSync(outputDir).filter(file =>
          /\.(wav|mp3|aac|m4a)$/i.test(file)
        )
        
        console.log(`${testFile} extraction results:`)
        console.log(`  - Output directory: ${outputDir}`)
        console.log(`  - Frames extracted: ${fs.existsSync(framesDir) ? fs.readdirSync(framesDir).length : 0}`)
        console.log(`  - Audio files: ${audioFiles.length}`)
      }, 360000) // 360 second timeout for extraction
    })
  })

  describe('analyzeExtractedContent function', () => {
    testFiles.forEach(testFile => {
      it(`should analyze extracted content from ${testFile}`, async () => {
        const swfPath = path.join(fixturesDir, testFile)
        const outputDir = path.join(tempOutputDir, `analyze-${path.basename(testFile, '.swf')}`)

        // First extract the content
        await extractSWF(swfPath, outputDir)

        // Then analyze it
        const analysis = analyzeExtractedContent(outputDir)

        expect(analysis).toHaveProperty('framesDir')
        expect(analysis).toHaveProperty('frameFiles')
        expect(analysis).toHaveProperty('audioFiles')
        expect(analysis).toHaveProperty('frameCount')

        expect(Array.isArray(analysis.frameFiles)).toBe(true)
        expect(Array.isArray(analysis.audioFiles)).toBe(true)
        expect(typeof analysis.frameCount).toBe('number')
        expect(analysis.frameCount).toBeGreaterThanOrEqual(0)

        console.log(`${testFile} analysis results:`)
        console.log(`  - Frame count: ${analysis.frameCount}`)
        console.log(`  - Audio files: ${analysis.audioFiles.length}`)
        console.log(`  - Frames directory: ${analysis.framesDir}`)
      }, 360000) // 360 second timeout
    })
  })
})
