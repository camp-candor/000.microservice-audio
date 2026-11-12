import { describe, it, expect } from 'vitest'
import { AudioModel } from '../13.audio.unit/audio.model.js'
import {
    measureCadenceSignature,
    classifyCharacterCadence,
    classifyCharacterCadenceAction,
} from '../13.audio.unit/buz/audio.buzz.js'

describe('Feature 5.2: Rhythmic Cadence Classifier Noise Floor Probe', () => {
    it('measureCadenceSignature extracts finite syllabic duration and positive attack velocity', () => {
        const sampleRate = 48000
        const samples = new Float32Array(sampleRate) // 1.0s
        // 3 rhythmic pulses simulating syllables
        for (let i = 0; i < sampleRate; i++) {
            const inSyllable =
                (i >= 4800 && i <= 14400) ||
                (i >= 19200 && i <= 28800) ||
                (i >= 33600 && i <= 43200)
            samples[i] = inSyllable ? Math.sin(i * 0.1) * 0.4 : 0.0
        }

        const metrics = measureCadenceSignature(samples, sampleRate)
        expect(metrics.consonantAttackVelocity).toBeGreaterThan(0)
        expect(metrics.averageSyllableDurationMs).toBeGreaterThan(100)
        expect(metrics.averageSyllableDurationMs).toBeLessThan(300)
        expect(metrics.pauseToSpeechRatio).toBeGreaterThan(0.2)
    })

    it('classifyCharacterCadence confirms identity with P >= 0.95 in acoustic darkness', () => {
        const metrics = {
            consonantAttackVelocity: 145.2,
            averageSyllableDurationMs: 160.0,
            pauseToSpeechRatio: 0.35,
            rhythmEnergyVariance: 0.0042,
        }

        const report = classifyCharacterCadence('char_silas', metrics, -72.0)
        expect(report.status).toBe('PASSED')
        expect(report.isIdentityConfirmed).toBe(true)
        expect(report.cadenceMatchConfidence).toBeGreaterThanOrEqual(0.95)
        expect(report.isNoiseFloorClean).toBe(true)
    })

    it('classifyCharacterCadence halts closed on elevated noise floor (>= -60.0 dBFS)', () => {
        const metrics = {
            consonantAttackVelocity: 145.2,
            averageSyllableDurationMs: 160.0,
            pauseToSpeechRatio: 0.35,
            rhythmEnergyVariance: 0.0042,
        }

        const report = classifyCharacterCadence('char_silas', metrics, -52.4)
        expect(report.status).toBe('NOISE_FLOOR_BREACH')
        expect(report.isNoiseFloorClean).toBe(false)
        expect(report.error).toContain('NOISE_FLOOR_BREACH')
    })

    it('classifyCharacterCadence trips PROSODIC_EXCLUSION_LEAK on rapid staccato syllables (< 95ms)', () => {
        const rapidMetrics = {
            consonantAttackVelocity: 280.0,
            averageSyllableDurationMs: 78.0, // Trips < 95ms staccato threshold
            pauseToSpeechRatio: 0.15,
            rhythmEnergyVariance: 0.009,
        }

        const report = classifyCharacterCadence(
            'char_silas',
            rapidMetrics,
            -68.0,
            ['RAPID_STACCATO', 'BREATHLESS_WHISPER'],
        )

        expect(report.status).toBe('PROSODIC_EXCLUSION_LEAK')
        expect(report.isProhibitedCadenceDetected).toBe(true)
        expect(report.error).toContain('PROSODIC_EXCLUSION_LEAK')
    })

    it('classifyCharacterCadenceAction handles hunt dispatch cleanly and logs structured 7-bit ASCII', async () => {
        const model = new AudioModel()
        const sampleRate = 48000
        const buffer = Buffer.alloc(sampleRate * 2)
        for (let i = 0; i < sampleRate; i++) {
            const inSpeech = i % 12000 < 7200 // 150ms speech burst, 100ms silence
            const val = inSpeech
                ? Math.round(
                      Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 16384,
                  )
                : 0
            buffer.writeInt16LE(val, i * 2)
        }

        const bal: any = {
            idx: 'test-cadence-hunt',
            dat: {
                characterId: 'char_silas',
                pcmBuffer: buffer,
                sampleRateHz: sampleRate,
                bannedCadences: ['BREATHLESS_WHISPER'],
            },
        }

        const logs: string[] = []
        const mockSte: any = {
            hunt: async (_action: string, payload: any) => {
                if (payload?.src) logs.push(payload.src)
                return {}
            },
        }

        await classifyCharacterCadenceAction(model, bal, mockSte)

        expect(bal.cadenceReport?.status).toBe('PASSED')
        expect(model.cadenceClassificationsCompleted).toBe(1)
        expect(logs.some((l) => l.includes('>> [CADENCE:OK]'))).toBe(true)
    })
})
