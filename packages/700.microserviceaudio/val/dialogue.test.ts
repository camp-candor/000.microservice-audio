import { describe, it, expect } from 'vitest'
import { DialogueModel } from '../15.dialogue.unit/dialogue.model.js'
import {
    calculateMruPauseEnvelope,
    assertAllowedCadence,
    applyDialectLexicon,
    applyDialectG2p,
} from '../15.dialogue.unit/buz/dialogue.buzz.js'
import type { SeriesLexiconDictionary } from '../15.dialogue.unit/fce/dialogue.interface.js'

describe('Phase 4: Dialogue Prosody & G2P Dialect Override Engine', () => {
    const wiregrassLexicon: SeriesLexiconDictionary = {
        schemaVersion: '2.0.0',
        seriesSlug: 'wiregrass-basin',
        phoneticAlphabet: 'CUSTOM_STRESS_EXPANSION',
        phoneticRules: {
            culvert: 'KULL-vert',
            gallbreaker: 'GAWL-bray-ker',
            creosote: 'KREE-uh-soht',
            slough: 'SLOO',
            diesel: 'DEEZ-ul',
            siphon: 'SAI-fun',
        },
        regexReplacements: [
            {
                pattern: "\\b(ain't)\\b",
                replacement: 'aynt',
                description: 'Standardizes dialect negation',
            },
            {
                pattern: '\\b(do you)\\b',
                replacement: 'dee-yoo',
                description: 'Softens interrogative onset into regional drawl',
            },
            {
                pattern: '\\b(\\w+)ing\\b',
                replacement: "$1-in'",
                description:
                    'Enforces dropped alveolar nasals across continuous verbs',
            },
            {
                pattern: '\\b(drainage)\\b',
                replacement: 'DRAY-nij',
                description: 'Suppresses secondary syllable enunciation',
            },
        ],
    }

    it('calculateMruPauseEnvelope returns deterministic padding for all Swain MRU types', () => {
        const reflex = calculateMruPauseEnvelope('reflex')
        expect(reflex.leadSilenceMs).toBe(30)
        expect(reflex.tailSilenceMs).toBe(60)
        expect(reflex.interPhraseMultiplier).toBe(0.8)

        const rational = calculateMruPauseEnvelope('rational_action')
        expect(rational.leadSilenceMs).toBe(250)
        expect(rational.tailSilenceMs).toBe(200)
        expect(rational.interPhraseMultiplier).toBe(1.15)
    })

    it('assertAllowedCadence halts closed on prohibited character deliveries', () => {
        expect(() => {
            assertAllowedCadence('RAPID_STACCATO', [
                'RAPID_STACCATO',
                'BREATHLESS_WHISPER',
            ])
        }).toThrow(/BANNED_CADENCE_BREACH/)
    })

    it('assertAllowedCadence permits non-conflicting prosodic delivery styles', () => {
        expect(() => {
            assertAllowedCadence('MEASURED_DRAWL', [
                'RAPID_STACCATO',
                'BREATHLESS_WHISPER',
            ])
        }).not.toThrow()
    })

    it('applyDialectLexicon executes four-stage normalization and preserves terminal punctuation', () => {
        const raw =
            "Do you hear what they are saying in the drainage culvert? It ain't right!"
        const result = applyDialectLexicon(raw, wiregrassLexicon, 'styletts2')

        // Verify word boundaries prevent substring collision ('in' inside 'drainage' or 'siphon')
        expect(result.normalizedText).toBe(
            "dee-yoo hear what they are say-in' in the DRAY-nij KULL-vert? It aynt right!",
        )
        expect(result.regexCount).toBe(4) // do you, saying, drainage, ain't
        expect(result.phoneticCount).toBe(1) // culvert
    })

    it('applyDialectLexicon formats CosyVoice SSML wrapper tags when requested', () => {
        const raw = 'The drainage siphon is open.'
        const result = applyDialectLexicon(raw, wiregrassLexicon, 'cosyvoice')

        expect(result.normalizedText).toContain(
            '<phoneme ph="SAI-fun">siphon</phoneme>',
        )
        expect(result.normalizedText).toContain('DRAY-nij')
    })

    it('applyDialectG2p buzzer executes end-to-end, logs 7-bit ASCII, and returns structured result', async () => {
        const model = new DialogueModel()
        const bal = {
            idx: 'test-g2p-line',
            dat: {
                seriesSlug: 'wiregrass-basin',
                characterId: 'char_silas',
                rawDialogueText: 'Do you hear the diesel engine run-in?',
                mruType: 'stimulus' as const,
                lexiconOverride: wiregrassLexicon,
            },
        }

        const logs: string[] = []
        const mockSte: any = {
            hunt: async (_action: string, payload: any) => {
                if (payload?.src) logs.push(payload.src)
                return {}
            },
        }

        await applyDialectG2p(model, bal, mockSte)

        expect((bal as any).result?.status).toBe('EXPANDED')
        expect((bal as any).result?.normalizedText).toBe(
            'dee-yoo hear the DEEZ-ul engine run-in?',
        )
        expect((bal as any).result?.pauseEnvelope.leadSilenceMs).toBe(80)
        expect(model.linesProcessed).toBe(1)
        expect(logs.some((l) => l.includes('>> [G2P:EXPAND]'))).toBe(true)
    })
})
