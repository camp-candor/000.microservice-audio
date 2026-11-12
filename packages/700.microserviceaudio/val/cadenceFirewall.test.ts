import { describe, it, expect } from 'vitest'
import { DialogueModel } from '../15.dialogue.unit/dialogue.model.js'
import {
    normalizeCadenceToken,
    assertAllowedCadence,
    evaluateCadenceFeasibility,
    auditProhibitedCadence,
} from '../15.dialogue.unit/buz/dialogue.buzz.js'

describe('Feature 4.2: Prohibited Cadence Pre-Synthesis Firewall', () => {
    const bannedCadences = [
        'RAPID_STACCATO',
        'RISING_INFLECTION_INTERROGATIVE',
        'BREATHLESS_WHISPER',
    ]

    it('normalizeCadenceToken standardizes whitespace, casing, and hyphens', () => {
        expect(normalizeCadenceToken('rapid staccato')).toBe('RAPID_STACCATO')
        expect(normalizeCadenceToken('  breathless-whisper  ')).toBe(
            'BREATHLESS_WHISPER',
        )
        expect(normalizeCadenceToken('Rising_Inflection_Interrogative')).toBe(
            'RISING_INFLECTION_INTERROGATIVE',
        )
    })

    it('assertAllowedCadence throws BANNED_CADENCE_BREACH when cadence is in banned list', () => {
        expect(() => {
            assertAllowedCadence('rapid staccato', bannedCadences)
        }).toThrow(/BANNED_CADENCE_BREACH/)

        expect(() => {
            assertAllowedCadence('BREATHLESS_WHISPER', bannedCadences)
        }).toThrow(/BANNED_CADENCE_BREACH/)
    })

    it('assertAllowedCadence permits deliveries not present in banned list', () => {
        expect(() => {
            assertAllowedCadence('MEASURED_DRAWL', bannedCadences)
        }).not.toThrow()

        expect(() => {
            assertAllowedCadence('CONTEMPLATIVE_LOW', bannedCadences)
        }).not.toThrow()
    })

    it('evaluateCadenceFeasibility safely emits structured error result on prohibited delivery', () => {
        const result = evaluateCadenceFeasibility(
            'char_silas',
            'rapid-staccato',
            bannedCadences,
        )

        expect(result.status).toBe('BANNED_CADENCE_BREACH')
        expect(result.characterId).toBe('char_silas')
        expect(result.evaluatedCadence).toBe('RAPID_STACCATO')
        expect(result.error).toContain('BANNED_CADENCE_BREACH')
    })

    it('auditProhibitedCadence buzzer logs to console and records breach metrics in model', async () => {
        const model = new DialogueModel()
        const bal: any = {
            idx: 'test-cadence-audit',
            dat: {
                seriesSlug: 'wiregrass-basin',
                characterId: 'char_silas',
                requestedCadence: 'rapid-staccato',
                bannedCadences,
            },
        }

        const logs: string[] = []
        const mockSte: any = {
            hunt: async (_action: string, payload: any) => {
                if (payload?.src) logs.push(payload.src)
                return {}
            },
        }

        await auditProhibitedCadence(model, bal, mockSte)

        expect(bal.cadenceResult?.status).toBe('BANNED_CADENCE_BREACH')
        expect(model.cadenceAuditsCompleted).toBe(1)
        expect(model.prohibitedBreachesDetected).toBe(1)
        expect(model.cadenceAuditLog.length).toBe(1)
        expect(model.cadenceAuditLog[0].isPermitted).toBe(false)
        expect(logs.some((l) => l.includes(':: [FIREWALL:BREACH]'))).toBe(true)
    })

    it('auditProhibitedCadence buzzer records permitted delivery clean pass', async () => {
        const model = new DialogueModel()
        const bal: any = {
            idx: 'test-cadence-pass',
            dat: {
                seriesSlug: 'wiregrass-basin',
                characterId: 'char_silas',
                requestedCadence: 'measured_drawl',
                bannedCadences,
            },
        }

        const logs: string[] = []
        const mockSte: any = {
            hunt: async (_action: string, payload: any) => {
                if (payload?.src) logs.push(payload.src)
                return {}
            },
        }

        await auditProhibitedCadence(model, bal, mockSte)

        expect(bal.cadenceResult?.status).toBe('PERMITTED')
        expect(model.cadenceAuditsCompleted).toBe(1)
        expect(model.prohibitedBreachesDetected).toBe(0)
        expect(model.cadenceAuditLog[0].isPermitted).toBe(true)
        expect(logs.some((l) => l.includes('>> [FIREWALL:OK]'))).toBe(true)
    })
})
