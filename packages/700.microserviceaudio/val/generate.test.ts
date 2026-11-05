import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
    buildCliArgs,
    execGenerate,
} from '../10.generate.unit/buz/generate.buzz.js'
import { GenerateConfig } from '../10.generate.unit/fce/generate.bit.js'
import GenerateBit from '../10.generate.unit/fce/generate.bit.js'
import { GenerateModel } from '../10.generate.unit/generate.model.js'

vi.mock('node:child_process', () => ({ execFile: vi.fn() }))

describe('10.generate.unit: CLI Argument Serializer', () => {
    it('serializes StyleTTS-2 configuration with somatic DSP parameters', () => {
        const config: GenerateConfig = {
            engine: 'styletts2',
            character: 'char_wart',
            text: 'Stand your ground.',
            emotion: 'tense',
            tonePacing: 1.2,
            outputPath: 'scratch/audio/ep01_sh01.wav.tmp',
            styleVectorPath: 'assets/voices/wart_style.pt',
            dspModifiers: {
                basePitchShiftSemitones: -2.5,
                formantWarpingFactor: 1.15,
                breathinessPauseMultiplier: 2.0,
                vocalFryDensity: 0.8,
            },
        }

        const args = buildCliArgs(config)

        expect(args).toContain('--engine')
        expect(args).toContain('styletts2')
        expect(args).toContain('--character')
        expect(args).toContain('char_wart')
        expect(args).toContain('--style-vector')
        expect(args).toContain('assets/voices/wart_style.pt')
        expect(args).toContain('--pitch-shift')
        expect(args).toContain('-2.5')
        expect(args).toContain('--formant-warp')
        expect(args).toContain('1.15')
        expect(args).toContain('--breathiness')
        expect(args).toContain('2')
        expect(args).toContain('--vocal-fry')
        expect(args).toContain('0.8')
    })

    it('compiles Parler natural language description prompt on demand', () => {
        const config: GenerateConfig = {
            engine: 'parler',
            character: 'char_octavius',
            text: 'Lower the portcullis now!',
            emotion: 'enraged',
            outputPath: 'scratch/audio/ep01_sh02.wav.tmp',
        }

        const args = buildCliArgs(config)

        expect(args).toContain('--engine')
        expect(args).toContain('parler')
        expect(args).toContain('--description-prompt')
        const descIdx = args.indexOf('--description-prompt')
        expect(args[descIdx + 1]).toContain('Voice of char_octavius')
        expect(args[descIdx + 1]).toContain('Emotion: enraged')
    })
})

describe('10.generate.unit: Failure Handling and Zero-VRAM Invariant', () => {
    const testDirs: string[] = []

    beforeEach(() => {
        vi.clearAllMocks()
        delete (globalThis as any).LIBRARY
    })

    afterEach(() => {
        for (const dir of testDirs.splice(0)) {
            try {
                fs.rmSync(dir, { recursive: true, force: true })
            } catch {}
        }
    })

    it('traps non-zero exit codes with FAILED status and truncated stderr', async () => {
        const hunt = vi.fn(async () => {})
        ;(globalThis as any).LIBRARY = { hunt }
        const mocked = vi.mocked(execFile) as any
        mocked.mockImplementationOnce(
            (_file: any, _args: any, _opts: any, cb: any) => {
                const err: any = new Error('Command failed: synthesize.py')
                err.code = 1
                cb(
                    err,
                    '',
                    'Traceback (most recent call last): SyntaxError: missing checkpoint',
                )
                return {} as any
            },
        )

        const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-fail-'))
        testDirs.push(testDir)
        const stagingPath = path.join(testDir, 'probe.wav.tmp')
        fs.writeFileSync(stagingPath, Buffer.alloc(256, 0x03))

        const model = new GenerateModel()
        const bal: GenerateBit = {
            idx: 'gen-fail',
            dat: {
                engine: 'piper',
                character: 'char_probe',
                text: 'Probe line.',
                outputPath: stagingPath,
            },
        }

        const out = await execGenerate(model, bal, {} as any)

        expect(out.activeProcessCount).toBe(0)
        expect(bal.result?.status).toBe('FAILED')
        expect(bal.result?.exitCode).toBe(1)
        expect(bal.result?.stderr).toContain('SyntaxError')
        expect((bal.result?.stderr || '').length).toBeLessThanOrEqual(300)
        expect(fs.existsSync(stagingPath)).toBe(false)
        const msgs = hunt.mock.calls.map((c: any[]) => (c[1] ? c[1].src : ''))
        expect(msgs.some((m: string) => m.includes('>> [SPAWN]'))).toBe(true)
        expect(msgs.some((m: string) => m.includes(':: [FAIL]'))).toBe(true)
        expect(msgs.some((m: string) => m.includes(':: [STDERR]'))).toBe(true)
    })

    it('clamps subprocess env to CPU-only with timeout circuit breaker', async () => {
        const hunt = vi.fn(async () => {})
        ;(globalThis as any).LIBRARY = { hunt }
        const mocked = vi.mocked(execFile) as any
        mocked.mockImplementationOnce(
            (_file: any, _args: any, _opts: any, cb: any) => {
                cb(null, '', '')
                return {} as any
            },
        )

        const testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-ok-'))
        testDirs.push(testDir)
        const stagingPath = path.join(testDir, 'probe.wav.tmp')
        const targetPath = path.join(testDir, 'probe.wav')
        fs.writeFileSync(stagingPath, Buffer.alloc(2048, 0x04))

        const model = new GenerateModel()
        const bal: GenerateBit = {
            idx: 'gen-ok',
            dat: {
                engine: 'styletts2',
                character: 'char_probe',
                text: 'Probe line.',
                outputPath: stagingPath,
                polling: {
                    stagingPath,
                    targetPath,
                    intervalMs: 20,
                    timeoutMs: 5000,
                    stabilityChecksRequired: 2,
                },
            },
        }

        const out = await execGenerate(model, bal, {} as any)

        expect(out.activeProcessCount).toBe(0)
        expect(bal.result?.status).toBe('SUCCESS')
        expect(bal.result?.exitCode).toBe(0)
        expect(bal.result?.bytesConfirmed).toBe(2048)
        expect(fs.existsSync(stagingPath)).toBe(false)
        expect(fs.existsSync(targetPath)).toBe(true)
        expect(fs.statSync(targetPath).size).toBe(2048)
        const opts = mocked.mock.calls[0][2]
        expect(opts.env.CUDA_VISIBLE_DEVICES).toBe('')
        expect(opts.env.OMP_NUM_THREADS).toBe('4')
        expect(opts.timeout).toBe(30000)
        const cliArgs = mocked.mock.calls[0][1]
        expect(cliArgs).toContain('--engine')
        expect(cliArgs).toContain('styletts2')
        const msgs = hunt.mock.calls.map((c: any[]) => (c[1] ? c[1].src : ''))
        expect(msgs.some((m: string) => m.includes('>> [SUBPROCESS:OK]'))).toBe(
            true,
        )
        expect(msgs.some((m: string) => m.includes('>> [POLL]'))).toBe(true)
        expect(msgs.some((m: string) => m.includes('>> [RENAME]'))).toBe(true)
    })
})
