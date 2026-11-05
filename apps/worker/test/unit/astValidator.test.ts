import { describe, it, expect } from 'vitest'
import {
    IngressSceneASTSchema,
    IngressDialogueLineSchema,
    SomaticDspSchema,
} from '../../src/schemas/dialogueAst.schema.js'
import { validateAgainstFirewall } from '../../src/lib/structuralValidator.js'
import app from '../../src/index.js'
import type { Env } from '../../src/types/env.js'

const mockEnv: Env = {
    AUDIO_LEASE_DO: {} as any,
    CANON_DB: {} as any,
    AUDIO_STEMS_BUCKET: {} as any,
    CF_ACCESS_CLIENT_ID: 'access_id',
    CF_ACCESS_CLIENT_SECRET: 'access_sec',
}

const validScenePayload = {
    sceneId: 'sc_01',
    seriesId: 'series_001',
    state_snapshot_hash:
        '3a7894a4c1477ea53d7e5d2ea99401b34e402b896489370891d4e022064104d4',
    dialogueLines: [
        {
            lineId: 'line_01',
            shotIndex: 0,
            character: 'char_wart',
            text: 'Hold the gates until dawn.',
            emotion: 'tense',
            tonePacing: 1.1,
            dspModifiers: {
                basePitchShiftSemitones: -2.0,
                formantWarpingFactor: 1.05,
                somaticFatigueBps: 2500,
            },
        },
    ],
}

describe('Task 5.1: Closed TypeBox Ingress Payload Validator', () => {
    it('validates compliant scene AST payload successfully', () => {
        const res = validateAgainstFirewall(
            IngressSceneASTSchema,
            validScenePayload,
        )
        expect(res.success).toBe(true)
        if (res.success) {
            expect(res.data.sceneId).toBe('sc_01')
            expect(res.data.dialogueLines.length).toBe(1)
        }
    })

    it('rejects undeclared keys in dialogue line via { additionalProperties: false }', () => {
        const dirtyLine = {
            lineId: 'line_01',
            shotIndex: 0,
            character: 'char_wart',
            text: 'Hold the gates.',
            hallucinatedLlmTag: 'UNAUTHORIZED_KEY',
        }

        const res = validateAgainstFirewall(
            IngressDialogueLineSchema,
            dirtyLine,
        )
        expect(res.success).toBe(false)
        if (!res.success) {
            expect(res.statusCode).toBe(400)
            expect(res.errorEnvelope.title).toBe(
                'Structural Firewall Validation Failure',
            )
            expect(res.errorEnvelope.invalidProperties.length).toBeGreaterThan(
                0,
            )
        }
    })

    it('rejects undeclared keys in somatic DSP modifiers via { additionalProperties: false }', () => {
        const dirtyDsp = {
            basePitchShiftSemitones: 0,
            unexpectedParameter: 'reverb_wet',
        }

        const res = validateAgainstFirewall(SomaticDspSchema, dirtyDsp)
        expect(res.success).toBe(false)
        if (!res.success) {
            expect(res.statusCode).toBe(400)
        }
    })

    it('rejects non-hexadecimal state snapshot hash', () => {
        const invalidHashPayload = {
            ...validScenePayload,
            state_snapshot_hash: 'not_a_64_character_hex_hash',
        }

        const res = validateAgainstFirewall(
            IngressSceneASTSchema,
            invalidHashPayload,
        )
        expect(res.success).toBe(false)
    })

    it('rejects dialogue text containing non-ASCII unicode characters or emojis', () => {
        const nonAsciiPayload = {
            ...validScenePayload,
            dialogueLines: [
                {
                    lineId: 'line_01',
                    shotIndex: 0,
                    character: 'char_wart',
                    text: 'Hold the gates! \u{1F6E1}\u{FE0F}',
                },
            ],
        }

        const res = validateAgainstFirewall(
            IngressSceneASTSchema,
            nonAsciiPayload,
        )
        expect(res.success).toBe(false)
    })

    it('POST /ast/validate endpoint accepts valid payload and returns 200 OK', async () => {
        const req = new Request('http://localhost/ast/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CF-Access-Client-Id': 'access_id',
                'CF-Access-Client-Secret': 'access_sec',
            },
            body: JSON.stringify(validScenePayload),
        })

        const res = await app.fetch(req, mockEnv as any)
        expect(res.status).toBe(200)

        const body = (await res.json()) as any
        expect(body.status).toBe('INGRESS_SCHEMA_VALIDATED')
        expect(body.sceneId).toBe('sc_01')
        expect(body.totalLines).toBe(1)
    })

    it('POST /ast/validate endpoint returns HTTP 400 on undeclared keys', async () => {
        const hostilePayload = {
            ...validScenePayload,
            rogueLLMAttribute: 'INJECTED_METADATA',
        }

        const req = new Request('http://localhost/ast/validate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CF-Access-Client-Id': 'access_id',
                'CF-Access-Client-Secret': 'access_sec',
            },
            body: JSON.stringify(hostilePayload),
        })

        const res = await app.fetch(req, mockEnv as any)
        expect(res.status).toBe(400)

        const body = (await res.json()) as any
        expect(body.title).toBe('Structural Firewall Validation Failure')
        expect(body.invalidProperties.length).toBeGreaterThan(0)
    })
})
