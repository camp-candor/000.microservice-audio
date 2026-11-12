import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { VerificationModel } from '../05.verification.unit/verification.model.js'
import {
    executeSixStageGauntlet,
    runConformanceFirewall,
    unlinkQuarantinedStem,
} from '../05.verification.unit/buz/verification.buzz.js'

const buildConformedTestWav = (
    sampleRate: number,
    speechAmplitudeInt16: number,
    noiseAmplitudeInt16: number = 0,
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

    const speechCutoff = Math.floor(sampleRate * 0.8)
    for (let i = 0; i < sampleRate; i++) {
        let val = 0
        if (i < speechCutoff) {
            val = Math.round(
                Math.sin((2 * Math.PI * 440 * i) / sampleRate) *
                    speechAmplitudeInt16,
            )
        } else if (noiseAmplitudeInt16 > 0) {
            val = Math.round((Math.random() - 0.5) * 2 * noiseAmplitudeInt16)
        }
        wav.writeInt16LE(Math.max(-32768, Math.min(32767, val)), 44 + i * 2)
    }
    return wav
}

describe('Feature 6.2: Multi-Gate Conformance Aggregator', () => {
    let scratchDir: string

    beforeEach(() => {
        scratchDir = fs.mkdtempSync(
            path.join(os.tmpdir(), 'verify_firewall_test_'),
        )
    })

    afterEach(() => {
        fs.rmSync(scratchDir, { recursive: true, force: true })
    })

    it('executeSixStageGauntlet passes all 6 gates on a broadcast-conformed 48 kHz WAV stem', async () => {
        const stemPath = path.join(scratchDir, 'ep01_sc01_ln01.wav')
        const wav = buildConformedTestWav(48000, 8500, 0) // ~ -19.7 LUFS after filter and deesser stages, peak ~ -11.7 dBFS, quiet tail
        fs.writeFileSync(stemPath, wav)

        const { report } = await executeSixStageGauntlet({
            filePath: stemPath,
            expectedText: 'Stand your ground.',
            sampleRateHz: 48000,
            targetLufs: -19.5,
            toleranceLufs: 1.0,
            maxTruePeakDbTp: -1.0,
            noiseFloorCeilingDbfs: -60.0,
        })

        expect(report.status).toBe('PASSED')
        expect(report.gatesPassedCount).toBe(6)
        expect(report.gateVerdicts.length).toBe(6)
        expect(report.quarantinedUnlinked).toBe(false)
        expect(fs.existsSync(stemPath)).toBe(true)
    })

    it('executeSixStageGauntlet fails closed on Gate 3 loudness breach and unlinks quarantined stem', async () => {
        const stemPath = path.join(scratchDir, 'quiet_breach.wav')
        const tmpPath = `${stemPath}.tmp`
        const quietWav = buildConformedTestWav(48000, 1200, 0) // ~ -32 LUFS (breaches -16 +/- 1 LUFS)
        fs.writeFileSync(stemPath, quietWav)
        fs.writeFileSync(tmpPath, quietWav)

        const { report } = await executeSixStageGauntlet({
            filePath: stemPath,
            expectedText: 'Stand your ground.',
            targetLufs: -16.0,
            toleranceLufs: 1.0,
            unlinkOnFailure: true,
        })

        expect(report.status).toBe('FAILED')
        expect(report.failedGate).toBe('INTEGRATED_LOUDNESS')
        expect(report.gatesPassedCount).toBe(2) // Gate 1 & Gate 2 passed before Gate 3 failed
        expect(report.quarantinedUnlinked).toBe(true)
        expect(fs.existsSync(stemPath)).toBe(false)
        expect(fs.existsSync(tmpPath)).toBe(false)
    })

    it('executeSixStageGauntlet fails closed on Gate 5 unvoiced noise floor breach (>= -60.0 dBFS)', async () => {
        const stemPath = path.join(scratchDir, 'noisy_floor.wav')
        const noisyWav = buildConformedTestWav(48000, 8500, 2000) // ~ -24 dBFS noise in tail
        fs.writeFileSync(stemPath, noisyWav)

        const { report } = await executeSixStageGauntlet({
            filePath: stemPath,
            expectedText: 'Stand your ground.',
            targetLufs: -19.5,
            noiseFloorCeilingDbfs: -60.0,
            unlinkOnFailure: true,
        })

        expect(report.status).toBe('FAILED')
        expect(report.failedGate).toBe('UNVOICED_NOISE_FLOOR')
        expect(report.gatesPassedCount).toBe(4)
        expect(report.quarantinedUnlinked).toBe(true)
        expect(fs.existsSync(stemPath)).toBe(false)
    })

    it('executeSixStageGauntlet fails closed on Gate 6 Zero-Byte Poison Sentinel (< 1024 bytes)', async () => {
        const poisonPath = path.join(scratchDir, 'poison_zero.wav')
        fs.writeFileSync(poisonPath, Buffer.alloc(256, 0x00))

        const { report } = await executeSixStageGauntlet({
            filePath: poisonPath,
            expectedText: 'Stand your ground.',
            unlinkOnFailure: true,
        })

        expect(report.status).toBe('FAILED')
        expect(report.quarantinedUnlinked).toBe(true)
        expect(fs.existsSync(poisonPath)).toBe(false)
    })

    it('runConformanceFirewall buzzer records pass/quarantine counters and emits 7-bit ASCII telemetry', async () => {
        const model = new VerificationModel()
        const wav = buildConformedTestWav(48000, 8500, 0)

        const logs: string[] = []
        const mockSte: any = {
            hunt: async (_action: string, payload: any) => {
                if (payload?.src) logs.push(payload.src)
                return {}
            },
        }

        const bal: any = {
            idx: 'test-vrf-buzz',
            dat: {
                filePath: 'in_memory_conformed.wav',
                expectedText: 'Stand your ground.',
                pcmBuffer: wav,
                targetLufs: -19.5,
                unlinkOnFailure: false,
            },
        }

        await runConformanceFirewall(model, bal, mockSte)

        expect(bal.report?.status).toBe('PASSED')
        expect(model.auditsCompleted).toBe(1)
        expect(model.stemsPassedCount).toBe(1)
        expect(model.stemsQuarantinedCount).toBe(0)
        expect(
            logs.some((l) =>
                l.includes('>> [VERIFY:OK] 6/6 Conformance Gates PASSED'),
            ),
        ).toBe(true)
    })
})
