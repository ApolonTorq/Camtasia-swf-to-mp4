import * as fs from 'fs'
import * as path from 'path'
import { extractSWF, analyzeExtractedContent } from '../../src/tools/extractor'
import { convertSWF, checkFFmpegAvailability } from '../../src/tools/converter'

describe('SWF Processing Integration Tests', () => {
  const fixturesDir = path.join(__dirname, '..', 'fixtures', 'videos')
  const tempOutputDir = path.join(__dirname, '..', 'temp', 'integration-output')
  const testOutputsDir = path.join(__dirname, '..', 'fixtures', 'test-outputs')
  
  // Test fixture files
  const testFiles = [
    'silent-audio.swf',
    'with-audio.swf'
  ]

  beforeAll(async () => {
    // Ensure directories exist
    if (!fs.existsSync(tempOutputDir)) {
      fs.mkdirSync(tempOutputDir, { recursive: true })
    }
    if (!fs.existsSync(testOutputsDir)) {
      fs.mkdirSync(testOutputsDir, { recursive: true })
    }
  })

  afterAll(() => {
    // Clean up temp directory
    if (fs.existsSync(tempOutputDir)) {
      fs.rmSync(tempOutputDir, { recursive: true, force: true })
    }
  })

  describe('Complete SWF to MP4 Workflow', () => {
    testFiles.forEach(testFile => {
      it(`should complete full workflow for ${testFile}`, async () => {
        const swfPath = path.join(fixturesDir, testFile)
        const baseName = path.basename(testFile, '.swf')
        const extractDir = path.join(tempOutputDir, `${baseName}-extracted`)
        const mp4Path = path.join(tempOutputDir, `${baseName}.mp4`)

        // Verify test file exists
        expect(fs.existsSync(swfPath)).toBe(true)

        console.log(`\n🔄 Processing ${testFile}...`)

        // Step 1: Extract SWF content
        console.log('  📤 Extracting SWF content...')
        await extractSWF(swfPath, extractDir)
        expect(fs.existsSync(extractDir)).toBe(true)

        // Step 2: Analyze extracted content
        console.log('  🔍 Analyzing extracted content...')
        const analysis = analyzeExtractedContent(extractDir)
        
        console.log(`    - Frames: ${analysis.frameCount}`)
        console.log(`    - Audio files: ${analysis.audioFiles.length}`)
        console.log(`    - Frame files: ${analysis.frameFiles.length}`)

        // Step 3: Convert to MP4 (if FFmpeg is available)
        const ffmpegAvailable = await checkFFmpegAvailability()
        if (ffmpegAvailable) {
          console.log('  🎬 Converting to MP4...')
          await convertSWF(swfPath, mp4Path, {
            framerate: 30,
            keepExtracted: true
          })

          // Verify MP4 was created
          expect(fs.existsSync(mp4Path)).toBe(true)
          
          const mp4Stats = fs.statSync(mp4Path)
          expect(mp4Stats.size).toBeGreaterThan(0)
          
          console.log(`    - MP4 created: ${(mp4Stats.size / 1024).toFixed(2)} KB`)

          // Copy MP4 to test outputs for manual review
          const outputMp4Path = path.join(testOutputsDir, `${baseName}.mp4`)
          fs.copyFileSync(mp4Path, outputMp4Path)
          console.log(`    - Test output saved: ${outputMp4Path}`)
        } else {
          console.log('  ⏭️  Skipping MP4 conversion - FFmpeg not available')
        }

        console.log(`✅ Completed processing ${testFile}`)
      }, 360000) // 6 minute timeout for full workflow
    })
  })

  describe('Batch Processing Simulation', () => {
    it('should process multiple SWF files in sequence', async () => {
      const results: Array<{
        file: string
        extracted: boolean
        converted: boolean
        mp4Size?: number
        frameCount?: number
      }> = []

      const ffmpegAvailable = await checkFFmpegAvailability()
      
      console.log('\n🔄 Starting batch processing simulation...')

      for (const testFile of testFiles) {
        const swfPath = path.join(fixturesDir, testFile)
        const baseName = path.basename(testFile, '.swf')
        const extractDir = path.join(tempOutputDir, `batch-${baseName}-extracted`)
        const mp4Path = path.join(tempOutputDir, `batch-${baseName}.mp4`)

        const result: {
          file: string
          extracted: boolean
          converted: boolean
          mp4Size?: number
          frameCount?: number
        } = {
          file: testFile,
          extracted: false,
          converted: false
        }

        try {
          // Extract
          await extractSWF(swfPath, extractDir)
          result.extracted = fs.existsSync(extractDir)

          if (result.extracted) {
            const analysis = analyzeExtractedContent(extractDir)
            result.frameCount = analysis.frameCount
          }

          // Convert if FFmpeg available
          if (ffmpegAvailable) {
            await convertSWF(swfPath, mp4Path, {
              framerate: 30,
              keepExtracted: false
            })
            result.converted = fs.existsSync(mp4Path)
            
            if (result.converted) {
              const stats = fs.statSync(mp4Path)
              result.mp4Size = stats.size
            }
          }
        } catch (error) {
          console.error(`Error processing ${testFile}:`, error)
        }

        results.push(result)
      }

      // Verify all files were processed
      expect(results).toHaveLength(testFiles.length)
      results.forEach(result => {
        expect(result.extracted).toBe(true)
        if (ffmpegAvailable) {
          expect(result.converted).toBe(true)
        }
      })

      // Log summary
      console.log('\n📊 Batch Processing Summary:')
      results.forEach(result => {
        console.log(`  ${result.file}:`)
        console.log(`    - Extracted: ${result.extracted ? '✅' : '❌'}`)
        console.log(`    - Frames: ${result.frameCount || 'N/A'}`)
        console.log(`    - Converted: ${result.converted ? '✅' : '❌'}`)
        console.log(`    - MP4 Size: ${result.mp4Size ? `${(result.mp4Size / 1024).toFixed(2)} KB` : 'N/A'}`)
      })
    }, 480000) // 8 minute timeout for batch processing
  })

  describe('Error Handling', () => {
    it('should handle non-existent SWF files gracefully', async () => {
      const nonExistentPath = path.join(fixturesDir, 'does-not-exist.swf')
      const outputDir = path.join(tempOutputDir, 'error-test')

      await expect(extractSWF(nonExistentPath, outputDir)).rejects.toThrow()
    })

    it('should handle invalid output paths gracefully', async () => {
      const swfPath = path.join(fixturesDir, testFiles[0])
      const invalidOutputPath = '/invalid/path/that/does/not/exist/output.mp4'

      const ffmpegAvailable = await checkFFmpegAvailability()
      if (ffmpegAvailable) {
        await expect(convertSWF(swfPath, invalidOutputPath, {
          framerate: 30,
          keepExtracted: false
        })).rejects.toThrow()
      } else {
        console.log('⏭️  Skipping invalid path test - FFmpeg not available')
      }
    })
  })
})
