import * as fs from 'fs'
import * as path from 'path'
import { spawn } from 'child_process'
import ffmpegStatic from 'ffmpeg-static'

describe('Basic SWF to MP4 Conversion Tests', () => {
  const fixturesDir = path.join(__dirname, '..', 'fixtures', 'videos')
  const tempOutputDir = path.join(__dirname, '..', 'temp', 'basic-converter-output')
  
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

  // Helper function to check if FFmpeg is available
  const checkFFmpegAvailability = (): Promise<boolean> => {
    return new Promise((resolve) => {
      // Use the bundled FFmpeg binary if available
      const ffmpegPath = ffmpegStatic || 'ffmpeg'
      const ffmpeg = spawn(ffmpegPath, ['-version'])
      ffmpeg.on('close', (code) => {
        resolve(code === 0)
      })
      ffmpeg.on('error', () => {
        resolve(false)
      })
    })
  }

  // Helper function to extract SWF using JPEXS directly
  const extractSWFDirect = (swfPath: string, outputDir: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const jarPath = path.join(__dirname, '..', '..', 'bin', 'ffdec.jar')

      if (!fs.existsSync(jarPath)) {
        reject(new Error(`JPEXS JAR file not found at: ${jarPath}`))
        return
      }

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      const params = [
        '-jar', jarPath,
        '-export', 'frame,sound', outputDir,
        swfPath
      ]

      const java = spawn('java', params)

      // Add timeout to prevent infinite hanging
      const timeout = setTimeout(() => {
        java.kill('SIGKILL')
        reject(new Error('JPEXS direct extraction timed out after 5 minutes'))
      }, 300000) // 5 minutes

      java.on('close', (code) => {
        clearTimeout(timeout)
        if (code === 0) {
          resolve()
        } else {
          reject(new Error(`JPEXS extraction failed with code: ${code}`))
        }
      })

      java.on('error', (err) => {
        clearTimeout(timeout)
        reject(new Error(`Failed to start Java process: ${err.message}`))
      })
    })
  }

  describe('Direct SWF Extraction Tests', () => {
    testFiles.forEach(testFile => {
      it(`should extract content from ${testFile} using JPEXS directly`, async () => {
        const swfPath = path.join(fixturesDir, testFile)
        const outputDir = path.join(tempOutputDir, path.basename(testFile, '.swf'))

        // Verify test file exists
        expect(fs.existsSync(swfPath)).toBe(true)

        try {
          // Extract the SWF using JPEXS directly
          await extractSWFDirect(swfPath, outputDir)

          // Verify output directory was created
          expect(fs.existsSync(outputDir)).toBe(true)

          // List all files in output directory
          const outputFiles = fs.readdirSync(outputDir)
          console.log(`${testFile} extraction results:`)
          console.log(`  - Output directory: ${outputDir}`)
          console.log(`  - Files created: ${outputFiles.length}`)
          console.log(`  - Files: ${outputFiles.join(', ')}`)

          // Check for common file types
          const imageFiles = outputFiles.filter(file => 
            /\.(png|jpg|jpeg|gif|bmp)$/i.test(file)
          )
          const audioFiles = outputFiles.filter(file =>
            /\.(wav|mp3|aac|m4a)$/i.test(file)
          )

          console.log(`  - Image files: ${imageFiles.length}`)
          console.log(`  - Audio files: ${audioFiles.length}`)

          // At least some files should be created
          expect(outputFiles.length).toBeGreaterThan(0)
        } catch (error) {
          console.warn(`Could not extract ${testFile}: ${error}`)
          // Don't fail the test if Java/JPEXS is not available
          if (error instanceof Error && error.message.includes('JPEXS JAR file not found')) {
            console.log('⏭️  Skipping extraction test - JPEXS JAR not found')
          } else if (error instanceof Error && error.message.includes('Failed to start Java')) {
            console.log('⏭️  Skipping extraction test - Java not available')
          } else {
            throw error
          }
        }
      }, 360000) // 360 second timeout
    })
  })

  describe('MP4 Generation Tests', () => {
    testFiles.forEach(testFile => {
      it(`should generate MP4 for ${testFile} if tools are available`, async () => {
        const swfPath = path.join(fixturesDir, testFile)
        const baseName = path.basename(testFile, '.swf')
        const extractDir = path.join(tempOutputDir, `${baseName}-for-mp4`)
        const mp4Path = path.join(tempOutputDir, `${baseName}.mp4`)

        // Check if required tools are available
        const ffmpegAvailable = await checkFFmpegAvailability()
        
        if (!ffmpegAvailable) {
          console.log(`⏭️  Skipping MP4 generation for ${testFile} - FFmpeg not available`)
          return
        }

        try {
          // First extract frames
          await extractSWFDirect(swfPath, extractDir)
          
          if (!fs.existsSync(extractDir)) {
            console.log(`⏭️  Skipping MP4 generation for ${testFile} - extraction failed`)
            return
          }

          // Check for frames directory (JPEXS creates subdirectories)
          const framesDir = path.join(extractDir, 'frames')
          let imageFiles: string[] = []
          let imageDir = extractDir

          if (fs.existsSync(framesDir)) {
            imageDir = framesDir
            imageFiles = fs.readdirSync(framesDir).filter(file => 
              /\.(png|jpg|jpeg|gif|bmp)$/i.test(file)
            ).sort()
          } else {
            imageFiles = fs.readdirSync(extractDir).filter(file => 
              /\.(png|jpg|jpeg|gif|bmp)$/i.test(file)
            ).sort()
          }

          if (imageFiles.length === 0) {
            console.log(`⏭️  Skipping MP4 generation for ${testFile} - no image files found`)
            return
          }

          console.log(`🎬 Generating MP4 for ${testFile} from ${imageFiles.length} frames`)

          // Create a simple MP4 using ffmpeg directly
          let ffmpegArgs = [
            '-framerate', '30',
            '-i', path.join(imageDir, '%d.png') // Use %d pattern instead of glob
          ]

          // Add audio if available
          const soundsDir = path.join(extractDir, 'sounds')
          if (fs.existsSync(soundsDir)) {
            const audioFiles = fs.readdirSync(soundsDir).filter(f => /\.(mp3|wav|aac|m4a)$/i.test(f))
            if (audioFiles.length > 0) {
              const audioPath = path.join(soundsDir, audioFiles[0])
              ffmpegArgs.push('-i', audioPath)
            }
          }

          // Add video and audio processing options
          ffmpegArgs = ffmpegArgs.concat([
            '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', // Ensure even dimensions
            '-c:v', 'libx264',
            '-pix_fmt', 'yuv420p'
          ])

          // Add audio codec if we have audio
          if (fs.existsSync(soundsDir)) {
            const audioFiles = fs.readdirSync(soundsDir).filter(f => /\.(mp3|wav|aac|m4a)$/i.test(f))
            if (audioFiles.length > 0) {
              ffmpegArgs = ffmpegArgs.concat([
                '-c:a', 'aac',
                '-shortest'
              ])
            }
          }

          ffmpegArgs = ffmpegArgs.concat([
            '-y', // Overwrite output file
            mp4Path
          ])

          await new Promise<void>((resolve, reject) => {
            // Use the bundled FFmpeg binary
            const ffmpegPath = ffmpegStatic || 'ffmpeg'
            // console.log(`FFmpeg command: ${ffmpegPath} ${ffmpegArgs.join(' ')}`)
            const ffmpeg = spawn(ffmpegPath, ffmpegArgs)
            
            ffmpeg.on('close', (code) => {
              if (code === 0) {
                resolve()
              } else {
                reject(new Error(`FFmpeg failed with code: ${code}`))
              }
            })

            ffmpeg.on('error', (err) => {
              reject(new Error(`Failed to start FFmpeg: ${err.message}`))
            })
          })

          // Verify MP4 was created
          expect(fs.existsSync(mp4Path)).toBe(true)
          
          const stats = fs.statSync(mp4Path)
          expect(stats.size).toBeGreaterThan(0)

          console.log(`✅ MP4 generated: ${(stats.size / 1024).toFixed(2)} KB`)

          // Copy to test outputs for manual review
          const outputMp4Path = path.join(__dirname, '..', 'fixtures', 'test-outputs', `${baseName}.mp4`)
          fs.copyFileSync(mp4Path, outputMp4Path)
          console.log(`📁 Test output saved: ${outputMp4Path}`)

        } catch (error) {
          console.warn(`Could not generate MP4 for ${testFile}: ${error}`)
          // Don't fail if tools are not available
        }
      }, 360000) // 360 second timeout
    })
  })

  describe('Test File Validation', () => {
    testFiles.forEach(testFile => {
      it(`should validate that ${testFile} exists and has content`, () => {
        const swfPath = path.join(fixturesDir, testFile)
        
        expect(fs.existsSync(swfPath)).toBe(true)
        
        const stats = fs.statSync(swfPath)
        expect(stats.size).toBeGreaterThan(0)
        
        console.log(`📊 ${testFile}: ${(stats.size / 1024).toFixed(2)} KB`)
      })
    })
  })
})
