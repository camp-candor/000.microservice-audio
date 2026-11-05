import { describe, it, expect } from 'vitest'
import {
    measureIntegratedLufs,
    auditLoudness,
} from '../01.loudness.unit/buz/loudness.buzz.js'
import { LoudnessModel } from '../01.loudness.unit/loudness.model.js'
import LoudnessBit from '../01.loudness.unit/fce/loudness.bit.js'
import { scanTruePeak, auditPeaks } from '../02.peaks.unit/buz/peaks.buzz.js'
import { PeaksModel } from '../02.peaks.unit/peaks.model.js'
import PeaksBit from '../02.peaks.unit/fce/peaks.bit.js'
import {
    validateWaveHeaderSentinel,
    verifyTranscriptionParity,
} from '../06.transcription.unit/buz/transcription.buzz.js'
import { TranscriptionModel } from '../06.transcription.unit/transcription.model.js'
import TranscriptionBit from '../06.transcription.unit/fce/transcription.bit.js'

const writeWavHeader = (header: Buffer, sampleCount: number): void => {
    header.write('RIFF', 0, 'ascii')
    header.writeUInt32LE(36 + sampleCount * 2, 4)
    header.write('WAVE', 8, 'ascii')
    header.write('fmt ', 12, 'ascii')
    header.writeUInt32LE(16, 16)
    header.writeUInt16LE(1, 20) // PCM
    header.writeUInt16LE(1, 22) // Mono
    header.writeUInt32LE(48000, 24) // 48kHz
    header.writeUInt32LE(48000 * 2, 28)
    header.writeUInt16LE(2, 32)
    header.writeUInt16LE(16, 34) // 16-bit
    header.write('data', 36, 'ascii')
    header.writeUInt32LE(sampleCount * 2, 40)
}

const createSyntheticWav = (sampleCount: number, amplitude: number): Buffer => {
    const header = Buffer.alloc(44)
    writeWavHeader(header, sampleCount)

    const data = Buffer.alloc(sampleCount * 2)
    const intVal = Math.floor(amplitude * 32767)
    for (let i = 0; i < sampleCount * 2; i += 2) {
        data.writeInt16LE(intVal, i)
    }

    return Buffer.concat([header, data])
}

const createSparsePeakWav = (
    sampleCount: number,
    peakAmplitude: number,
    hotSamples: number,
): Buffer => {
    const header = Buffer.alloc(44)
    writeWavHeader(header, sampleCount)

    const data = Buffer.alloc(sampleCount * 2)
    const intVal = Math.floor(peakAmplitude * 32767)
    for (let i = 0; i < hotSamples; i += 1) {
        data.writeInt16LE(intVal, i * 2)
    }

    return Buffer.concat([header, data])
}

describe('Phase 3 Conformance Verification Gauntlet', () => {
    it('06.transcription.unit: rejects buffers under 1024 bytes with POISON_BUFFER_REJECTED', () => {
        const tinyBuffer = Buffer.alloc(512)
        const result = validateWaveHeaderSentinel(tinyBuffer)
        expect(result.valid).toBe(false)
        expect(result.error).toContain('POISON_BUFFER_REJECTED')
    })

    it('06.transcription.unit: verifies valid RIFF and WAVE header markers', () => {
        const validWav = createSyntheticWav(1000, 0.5)
        const result = validateWaveHeaderSentinel(validWav)
        expect(result.valid).toBe(true)
        expect(result.hasRiffHeader).toBe(true)
        expect(result.hasWaveMarker).toBe(true)
    })

    it('02.peaks.unit: detects sample values exceeding true-peak ceiling (-1.0 dBTP)', () => {
        // 0.95 amplitude corresponds to approx -0.45 dBFS, breaching -1.0 dBTP ceiling
        const hotWav = createSyntheticWav(2000, 0.95)
        const peak = scanTruePeak(hotWav)
        expect(peak).toBeGreaterThan(-1.0)
    })

    it('02.peaks.unit: passes compliant peaks below -1.0 dBTP', () => {
        // 0.50 amplitude corresponds to approx -6.0 dBFS
        const cleanWav = createSyntheticWav(2000, 0.5)
        const peak = scanTruePeak(cleanWav)
        expect(peak).toBeLessThanOrEqual(-1.0)
    })

    it('01.loudness.unit: measures integrated loudness from PCM samples', () => {
        const standardWav = createSyntheticWav(48000, 0.2)
        const lufs = measureIntegratedLufs(standardWav)
        expect(lufs).toBeGreaterThan(-70.0)
        expect(typeof lufs).toBe('number')
    })

    it('06.transcription.unit: rejects corrupted header magic with INVALID_WAVE_HEADER', () => {
        const corruptRifx = createSyntheticWav(2000, 0.5)
        corruptRifx.write('RIFX', 0, 'ascii')
        const rifxResult = validateWaveHeaderSentinel(corruptRifx)
        expect(rifxResult.valid).toBe(false)
        expect(rifxResult.error).toContain('INVALID_WAVE_HEADER')

        const corruptWave = createSyntheticWav(2000, 0.5)
        corruptWave.write('XXXX', 8, 'ascii')
        const waveResult = validateWaveHeaderSentinel(corruptWave)
        expect(waveResult.valid).toBe(false)
        expect(waveResult.error).toContain('INVALID_WAVE_HEADER')
    })

    it('02.peaks.unit: fails closed with TRUE_PEAK_CLIPPING_BREACH above -1.0 dBTP', async () => {
        const hotWav = createSyntheticWav(2000, 0.95)
        let resolved: { pekBit: PeaksBit } | null = null
        const bal: PeaksBit = {
            idx: 'peaks-breach',
            dat: { filePath: 'synthetic-hot.wav', pcmBuffer: hotWav },
            slv: (r: { pekBit: PeaksBit }) => {
                resolved = r
            },
        }

        await auditPeaks(new PeaksModel(), bal, {} as never)

        expect(bal.result?.status).toBe('FAILED')
        expect(bal.result?.clippingDetected).toBe(true)
        expect(bal.result?.error).toContain('TRUE_PEAK_CLIPPING_BREACH')
        expect(resolved).not.toBe(null)
    })

    it('01.loudness.unit: fails closed with LOUDNESS_DEVIATION_BREACH outside tolerance', async () => {
        const hotWav = createSyntheticWav(48000, 0.27184)
        expect(measureIntegratedLufs(hotWav)).toBeCloseTo(-12.0, 1)
        const bal: LoudnessBit = {
            idx: 'loudness-breach',
            dat: {
                filePath: 'synthetic-hot.wav',
                profile: { targetLufs: -16.0, toleranceLufs: 1.0 },
                pcmBuffer: hotWav,
            },
        }

        await auditLoudness(new LoudnessModel(), bal, {} as never)

        expect(bal.result?.status).toBe('FAILED')
        expect(bal.result?.error).toContain('LOUDNESS_DEVIATION_BREACH')
    })

    it('gauntlet: compliant -16.2 LUFS / -2.4 dBTP stem passes all three units', async () => {
        const cleanWav = createSparsePeakWav(100000, 0.7586, 4903)
        expect(measureIntegratedLufs(cleanWav)).toBeCloseTo(-16.2, 1)
        expect(scanTruePeak(cleanWav)).toBeCloseTo(-2.4, 1)

        const ldnBal: LoudnessBit = {
            idx: 'loudness-pass',
            dat: {
                filePath: 'synthetic-clean.wav',
                profile: { targetLufs: -16.0, toleranceLufs: 1.0 },
                pcmBuffer: cleanWav,
            },
        }
        await auditLoudness(new LoudnessModel(), ldnBal, {} as never)
        expect(ldnBal.result?.status).toBe('PASSED')
        expect(ldnBal.result?.error).toBeUndefined()

        const pekBal: PeaksBit = {
            idx: 'peaks-pass',
            dat: { filePath: 'synthetic-clean.wav', pcmBuffer: cleanWav },
        }
        await auditPeaks(new PeaksModel(), pekBal, {} as never)
        expect(pekBal.result?.status).toBe('PASSED')
        expect(pekBal.result?.error).toBeUndefined()

        const trnBal: TranscriptionBit = {
            idx: 'parity-pass',
            dat: {
                filePath: 'synthetic-clean.wav',
                expectedText: 'Compliant line.',
                buffer: cleanWav,
            },
        }
        await verifyTranscriptionParity(
            new TranscriptionModel(),
            trnBal,
            {} as never,
        )
        expect(trnBal.result?.status).toBe('PASSED')
        expect(trnBal.result?.error).toBeUndefined()
    })
})
