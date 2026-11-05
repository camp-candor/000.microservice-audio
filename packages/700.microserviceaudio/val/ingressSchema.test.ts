import { describe, it, expect } from 'vitest'
import {
    IngressSceneASTSchema,
    IngressDialogueLineSchema,
} from '../08.schemas.unit/val/dialogueAst.val.js'
import {
    assertDialogueLineParity,
    checkBannedPronunciations,
} from '../08.schemas.unit/buz/schemas.buzz.js'

describe('Phase 8: Ingress Schema Contract Validation Pipeline', () => {
    it('rejects un-schemaed keys via .strict() validation at Stage T0', () => {
        const dirtyLine = {
            lineId: 'line_01',
            shotIndex: 0,
            character: 'char_wart',
            text: 'Hold the gates.',
            emotion: 'tense',
            tonePacing: 1.0,
            hallucinatedLlmTag: 'UNAUTHORIZED_KEY',
        }

        const res = IngressDialogueLineSchema.safeParse(dirtyLine)
        expect(res.success).toBe(false)
        if (!res.success) {
            expect(res.error.issues[0].code).toBe('unrecognized_keys')
        }
    })

    it('rejects malformed state snapshot hashes that diverge from 64-char lowercase hex', () => {
        const invalidAst = {
            sceneId: 'sc_01',
            seriesId: 'series_001',
            state_snapshot_hash: 'not_a_valid_64_char_sha256_hash',
            dialogueLines: [
                {
                    lineId: 'line_01',
                    shotIndex: 0,
                    character: 'char_wart',
                    text: 'Hold the gates.',
                },
            ],
        }

        const res = IngressSceneASTSchema.safeParse(invalidAst)
        expect(res.success).toBe(false)
    })

    it('rejects non-ASCII unicode emojis in dialogue text', () => {
        const emojiLine = {
            lineId: 'line_01',
            shotIndex: 0,
            character: 'char_wart',
            text: 'Hold the gates! \u{1F6E1}\u{FE0F}',
        }

        const res = IngressDialogueLineSchema.safeParse(emojiLine)
        expect(res.success).toBe(false)
        if (!res.success) {
            expect(res.error.issues[0].message).toContain(
                'NON_ASCII_DIALOGUE_DETECTED',
            )
        }
    })

    it('asserts verbatim parity between ingress text and locked screenplay AST', () => {
        expect(() => {
            assertDialogueLineParity('Hold the gates.', 'Hold the gate.')
        }).toThrow(/VERBATIM_PARITY_BREACH/)

        expect(() => {
            assertDialogueLineParity('  Hold the gates.  ', 'Hold the gates.')
        }).not.toThrow()
    })

    it('flags banned pronunciation lexicon entries', () => {
        const tokens = checkBannedPronunciations(
            'Wart said we must retreat immediately.',
            ['wart', 'retreat'],
        )
        expect(tokens).toContain('wart')
        expect(tokens).toContain('retreat')
    })
})
