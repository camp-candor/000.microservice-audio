import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { CollectModel } from '../97.collect.unit/collect.model.js'
import {
    computeStemSha256,
    extractWavDurationMs,
    canonicalizeJson,
    sealStemReceipt,
    exportStemManifest,
} from '../97.collect.unit/buz/collect.buzz.js'

const buildPcmWav = (
    sampleRateHz: number,
    bitDepth: number,
    durationMs: number,
): Buffer => {
    const bytesPerSample = bitDepth / 8
    const numSamples = Math.round((sampleRateHz * durationMs) / 1000)
    const dataBytes = numSamples * bytesPerSample
    const wav = Buffer.alloc(44 + dataBytes)
    wav.write('RIFF', 0, 'ascii')
    wav.writeUInt32LE(36 + dataBytes, 4)
    wav.write('WAVE', 8, 'ascii')
    wav.write('fmt ', 12, 'ascii')
    wav.writeUInt32LE(16, 16)
    wav.writeUInt16LE(1, 20)
    wav.writeUInt16LE(1, 22)
    wav.writeUInt32LE(sampleRateHz, 24)
    wav.writeUInt32LE(sampleRateHz * bytesPerSample, 28)
    wav.writeUInt16LE(bytesPerSample, 32)
    wav.writeUInt16LE(bitDepth, 34)
    wav.write('data', 36, 'ascii')
    wav.writeUInt32LE(dataBytes, 40)

    for (let i = 0; i < dataBytes; i++) {
        wav[44 + i] = (i * 31) & 0xff
    }
    return wav
}

describe('Feature 7.1: Content-Addressed WAV Stem Ledger', () => {
    let scratchDir: string

    beforeEach(() => {
        scratchDir = fs.mkdtempSync(
            path.join(os.tmpdir(), 'collect_ledger_test_'),
        )
    })

    afterEach(() => {
        fs.rmSync(scratchDir, { recursive: true, force: true })
    })

    it('computeStemSha256 produces 64-char lowercase hex digest and rejects empty buffers', () => {
        const wav = buildPcmWav(48000, 24, 1000)
        const hash = computeStemSha256(wav)
        expect(hash).toMatch(/^[0-9a-f]{64}$/)

        expect(() => computeStemSha256(Buffer.alloc(0))).toThrow(
            /ZERO_BYTE_POISON_BREACH/,
        )
    })

    it('extractWavDurationMs probes exact millisecond duration from 48kHz 24-bit WAV chunks', () => {
        const wav = buildPcmWav(48000, 24, 2375)
        const geom = extractWavDurationMs(wav)
        expect(geom.sampleRateHz).toBe(48000)
        expect(geom.bitDepth).toBe(24)
        expect(geom.channels).toBe(1)
        expect(geom.durationMs).toBe(2375)
    })

    it('canonicalizeJson sorts object keys deterministically per RFC 8785', () => {
        const a = { zebra: 1, alpha: { y: 2, x: 3 } }
        const b = { alpha: { x: 3, y: 2 }, zebra: 1 }
        expect(canonicalizeJson(a)).toBe(canonicalizeJson(b))
        expect(canonicalizeJson(a)).toBe('{"alpha":{"x":3,"y":2},"zebra":1}')
    })

    it('sealStemReceipt and exportStemManifest index stems and atomically write manifest JSON', async () => {
        const model = new CollectModel()
        const wav1 = buildPcmWav(48000, 24, 1500)
        const wav2 = buildPcmWav(48000, 24, 2250)

        const logs: string[] = []
        const mockSte: any = {
            hunt: async (_action: string, payload: any) => {
                if (payload?.src) logs.push(payload.src)
                return {}
            },
        }

        const bal1: any = {
            idx: 'seal-1',
            dat: {
                lineId: 'ep01_sc01_ln01',
                filePath: 'scratch/audio/ep01_sc01_ln01.wav',
                pcmBuffer: wav1,
            },
        }
        await sealStemReceipt(model, bal1, mockSte)
        expect(bal1.val).toBe(1)
        expect(bal1.receipt.durationMs).toBe(1500)

        const bal2: any = {
            idx: 'seal-2',
            dat: {
                lineId: 'ep01_sc01_ln02',
                filePath: 'scratch/audio/ep01_sc01_ln02.wav',
                pcmBuffer: wav2,
            },
        }
        await sealStemReceipt(model, bal2, mockSte)
        expect(model.stemsSealedCount).toBe(2)
        expect(model.cumulativeDurationMs).toBe(3750)

        const manifestPath = path.join(scratchDir, 'audio_manifest.json')
        const expBal: any = {
            idx: 'export-manifest',
            dat: {
                outputPath: manifestPath,
                episodeId: 'ep01',
                seriesSlug: 'wiregrass-basin',
            },
        }
        await exportStemManifest(model, expBal, mockSte)

        expect(expBal.val).toBe(1)
        expect(fs.existsSync(manifestPath)).toBe(true)
        const written = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
        expect(written.totalStemsCount).toBe(2)
        expect(written.cumulativeDurationMs).toBe(3750)
        expect(written.manifestRootSha256).toMatch(/^[0-9a-f]{64}$/)
        expect(logs.some((l) => l.includes('>> [OK] [MANIFEST]'))).toBe(true)
    })
})
