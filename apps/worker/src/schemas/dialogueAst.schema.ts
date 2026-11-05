import { Type, type Static } from '@sinclair/typebox'

export const PURE_ASCII_PATTERN = '^[\\x20-\\x7E\\r\\n\\t]+$'
export const SHA256_HEX_PATTERN = '^[0-9a-f]{64}$'

export const SomaticDspSchema = Type.Object(
    {
        basePitchShiftSemitones: Type.Optional(
            Type.Number({ minimum: -12.0, maximum: 12.0 }),
        ),
        formantWarpingFactor: Type.Optional(
            Type.Number({ minimum: 0.5, maximum: 2.0 }),
        ),
        breathinessPauseMultiplier: Type.Optional(
            Type.Number({ minimum: 1.0, maximum: 3.5 }),
        ),
        vocalFryDensity: Type.Optional(
            Type.Number({ minimum: 0.0, maximum: 1.0 }),
        ),
        somaticFatigueBps: Type.Optional(
            Type.Integer({ minimum: 0, maximum: 10000 }),
        ),
        physicalPainBps: Type.Optional(
            Type.Integer({ minimum: 0, maximum: 10000 }),
        ),
    },
    { additionalProperties: false },
)

export const IngressDialogueLineSchema = Type.Object(
    {
        lineId: Type.String({ minLength: 1 }),
        shotIndex: Type.Integer({ minimum: 0 }),
        character: Type.String({ minLength: 1 }),
        text: Type.String({ minLength: 1, pattern: PURE_ASCII_PATTERN }),
        emotion: Type.Optional(Type.String({ default: 'neutral' })),
        tonePacing: Type.Optional(
            Type.Number({ minimum: 0.5, maximum: 2.0, default: 1.0 }),
        ),
        dspModifiers: Type.Optional(SomaticDspSchema),
        activeConditions: Type.Optional(
            Type.Array(Type.String(), { default: [] }),
        ),
        bannedKineticVerbs: Type.Optional(
            Type.Array(Type.String(), { default: [] }),
        ),
    },
    { additionalProperties: false },
)

export const IngressSceneASTSchema = Type.Object(
    {
        sceneId: Type.String({ minLength: 1 }),
        seriesId: Type.String({ minLength: 1 }),
        state_snapshot_hash: Type.String({ pattern: SHA256_HEX_PATTERN }),
        dialogueLines: Type.Array(IngressDialogueLineSchema, { minItems: 1 }),
        lockedScreenplayText: Type.Optional(Type.String({ minLength: 1 })),
    },
    { additionalProperties: false },
)

export type SomaticDsp = Static<typeof SomaticDspSchema>
export type IngressDialogueLine = Static<typeof IngressDialogueLineSchema>
export type IngressSceneAST = Static<typeof IngressSceneASTSchema>
