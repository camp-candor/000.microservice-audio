import { describe, it, expect } from 'vitest'
import { LoudnessModel } from '../01.loudness.unit/loudness.model.js'
import {
    measureIntegratedLufs,
    normalizePcmToTargetLufs,
    calibrateLoudnessTwoPass,
    resolveStandardTargetLufs,
} from '../01.loudness.unit/buz/loudness.buzz.js'

const buildSyntheticWav = (
    sampleRate: number,
    amplitudeLinear: number,
): Buffer => {
    const dataBytes = sampleRate * 2
    const wav = Buffer.alloc(44 + dataBytes)
    wav.write('RIFF', 0, 'ascii')
    wav.writeUInt32LE(36 + dataBytes, 4)
    wav.write('WAVE', 8, 'ascii')
    wav.write('fmt ', 12, 'ascii')
    wav.writeUInt32LE(16, 16)
    wav.writeUInt16LE(1, 20)
    wav.writeUInt16LE(1, 22)
    wav.writeUInt32LE(sampleRate, 24)
    wav.writeUInt32LE(sampleRate * 2, 28)
    wav.writeUInt16LE(2, 32)
    wav.writeUInt16LE(16, 34)
    wav.write('data', 36, 'ascii')
    wav.writeUInt32LE(dataBytes, 40)

    for (let i = 0; i < sampleRate; i++) {
        const sample = Math.round(
            Math.sin((2 * Math.PI * 440 * i) / sampleRate) *
                32767 *
                amplitudeLinear,
        )
        wav.writeInt16LE(sample, 44 + i * 2)
    }
    return wav
}

describe('Feature 6.1: Two-Pass Loudness Calibration Extension', () => {
    it('resolveStandardTargetLufs maps WEB_STREAMING, BROADCAST_ATSC, and BROADCAST_EBU accurately', () => {
        expect(resolveStandardTargetLufs('WEB_STREAMING')).toBe(-16.0)
        expect(resolveStandardTargetLufs('BROADCAST_ATSC')).toBe(-24.0)
        expect(resolveStandardTargetLufs('BROADCAST_EBU')).toBe(-23.0)
    })

    it('normalizePcmToTargetLufs scales a -24.0 LUFS web take up to -16.0 LUFS cleanly', () => {
        const wav = buildSyntheticWav(48000, 0.1) // ~ -23.7 LUFS
        const pass1 = measureIntegratedLufs(wav)
        expect(pass1).toBeLessThan(-22.0)

        const { calibratedBuffer, report } = normalizePcmToTargetLufs(wav, {
            targetLufs: -16.0,
            toleranceLufs: 1.0,
            maxTruePeakDbTp: -1.0,
            standard: 'WEB_STREAMING',
        })

        expect(report.status).toBe('CALIBRATED')
        expect(
            Math.abs(report.pass2CalibratedLufs - -16.0),
        ).toBeLessThanOrEqual(0.5)
        expect(report.postCalibrationPeakDbTp).toBeLessThanOrEqual(-1.0)
        expect(calibratedBuffer.length).toBe(wav.length)
    })

    it('normalizePcmToTargetLufs attenuates a hot -12.0 LUFS take down to -24.0 LKFS broadcast target', () => {
        const hotWav = buildSyntheticWav(48000, 0.4) // ~ -11.7 LUFS
        const { report } = normalizePcmToTargetLufs(hotWav, {
            targetLufs: -24.0,
            toleranceLufs: 1.0,
            maxTruePeakDbTp: -2.0,
            standard: 'BROADCAST_ATSC',
        })

        expect(report.status).toBe('CALIBRATED')
        expect(
            Math.abs(report.pass2CalibratedLufs - -24.0),
        ).toBeLessThanOrEqual(0.5)
        expect(report.appliedGainDb).toBeLessThan(0)
        expect(report.postCalibrationPeakDbTp).toBeLessThanOrEqual(-2.0)
    })

    it('normalizePcmToTargetLufs fails closed with CALIBRATION_CLIPPING_BREACH when linear boost exceeds -1.0 dBTP', () => {
        // Low RMS high-crest signal or aggressive target boost pushing peaks > -1.0 dBTP
        const wav = buildSyntheticWav(48000, 0.25) // ~ -15.7 LUFS, peak ~ -12 dBFS
        const { report } = normalizePcmToTargetLufs(wav, {
            targetLufs: -3.0, // +12.7 dB boost pushes peak above 0 dBFS
            toleranceLufs: 1.0,
            maxTruePeakDbTp: -1.0,
            allowPeakClamping: false,
        })

        expect(report.status).toBe('CALIBRATION_CLIPPING_BREACH')
        expect(report.error).toContain('CALIBRATION_CLIPPING_BREACH')
    })

    it('calibrateLoudnessTwoPass buzzer executes end-to-end and logs 7-bit ASCII telemetry', async () => {
        const model = new LoudnessModel()
        const wav = buildSyntheticWav(48000, 0.1)
        const bal: any = {
            idx: 'test-calibrate-buzz',
            dat: {
                filePath: 'synthetic_test.wav',
                pcmBuffer: wav,
                profile: {
                    targetLufs: -16.0,
                    toleranceLufs: 1.0,
                    maxTruePeakDbTp: -1.0,
                },
            },
        }

        const logs: string[] = []
        const mockSte: any = {
            hunt: async (_action: string, payload: any) => {
                if (payload?.src) logs.push(payload.src)
                return {}
            },
        }

        await calibrateLoudnessTwoPass(model, bal, mockSte)

        expect(bal.calibrationResult?.status).toBe('CALIBRATED')
        expect(model.calibrationsCompleted).toBe(1)
        expect(logs.some((l) => l.includes('>> [CALIBRATE:OK]'))).toBe(true)
    })
})
