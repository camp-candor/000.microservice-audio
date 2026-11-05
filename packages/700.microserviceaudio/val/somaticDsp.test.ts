import { describe, it, expect } from 'vitest'
import { assertPhonationFeasibility } from '../14.conditioning.unit/buz/conditioning.buzz.js'
import { calculateSomaticDspModifiers } from '../12.acoustic.unit/buz/acoustic.buzz.js'

describe('Phase 4: Somatic Trait DSP Parameter Resolution', () => {
    it('conditioning.unit: halts closed with VOCAL_DELIVERY_BREACH if character is mute', () => {
        expect(() => {
            assertPhonationFeasibility({
                characterId: 'char_mute_automaton',
                dialogueText: 'Testing sound generation.',
                activeConditions: ['mute'],
            })
        }).toThrow(/VOCAL_DELIVERY_BREACH/)
    })

    it('conditioning.unit: halts closed with VOCAL_DELIVERY_BREACH if speak verb is banned', () => {
        expect(() => {
            assertPhonationFeasibility({
                characterId: 'char_gagged_prisoner',
                dialogueText: 'Muffled shouts.',
                bannedKineticVerbs: ['speak'],
            })
        }).toThrow(/VOCAL_DELIVERY_BREACH/)
    })

    it('acoustic.unit: resolves neutral resting baselines at zero basis points', () => {
        const res = calculateSomaticDspModifiers({
            characterId: 'char_elias',
            meters: { somaticFatigueBps: 0, physicalPainBps: 0 },
        })

        expect(res.basePitchShiftSemitones).toBe(0.0)
        expect(res.formantWarpingFactor).toBe(1.0)
        expect(res.breathinessPauseMultiplier).toBe(1.0)
        expect(res.pause_frequency_multiplier).toBe(1.0)
        expect(res.vocalFryDensity).toBe(0.0)
        expect(res.bannedCadences).toEqual([])
    })

    it('acoustic.unit: dilates breath quadratically and locks pause multiplier on extreme fatigue (>8000 bps)', () => {
        const res = calculateSomaticDspModifiers({
            characterId: 'char_pilot',
            meters: { somaticFatigueBps: 8400, physicalPainBps: 2000 },
        })

        // Breathiness: 1.0 * (1.0 + 1.4 * 0.84^2) = 1.0 + 1.4 * 0.7056 = 1.9878 -> 1.99
        expect(res.breathinessPauseMultiplier).toBeCloseTo(1.99, 2)
        expect(res.pause_frequency_multiplier).toBe(2.8)
        expect(res.tonePacing).toBeCloseTo(0.748, 2)
        expect(res.vocalFryDensity).toBeCloseTo(0.5, 2)
        expect(res.bannedCadences).toContain('RAPID_STACCATO')
    })

    it('acoustic.unit: collapses formant to 0.7 and drops pitch on crushed laryngeal cartilage', () => {
        const res = calculateSomaticDspModifiers({
            characterId: 'char_victim',
            activeConditions: ['cnd_crushed_laryngeal_cartilage'],
        })

        expect(res.formantWarpingFactor).toBe(0.7)
        expect(res.basePitchShiftSemitones).toBe(-4.0)
        expect(res.bannedCadences).toContain('RISING_INFLECTION')
    })
})
