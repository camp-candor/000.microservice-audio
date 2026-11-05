import { z } from 'zod'

export const PURE_ASCII_REGEX = /^[\x20-\x7E\r\n\t]+$/
export const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/

export const SomaticDspSchema = z
    .object({
        basePitchShiftSemitones: z.number().min(-12.0).max(12.0).optional(),
        formantWarpingFactor: z.number().min(0.5).max(2.0).optional(),
        breathinessPauseMultiplier: z.number().min(1.0).max(3.5).optional(),
        vocalFryDensity: z.number().min(0.0).max(1.0).optional(),
        somaticFatigueBps: z.number().int().min(0).max(10000).optional(),
        physicalPainBps: z.number().int().min(0).max(10000).optional(),
    })
    .strict()

export const IngressDialogueLineSchema = z
    .object({
        lineId: z.string().min(1),
        shotIndex: z.number().int().nonnegative(),
        character: z.string().min(1),
        text: z
            .string()
            .min(1)
            .regex(PURE_ASCII_REGEX, 'NON_ASCII_DIALOGUE_DETECTED'),
        emotion: z.string().default('neutral'),
        tonePacing: z.number().min(0.5).max(2.0).default(1.0),
        dspModifiers: SomaticDspSchema.optional(),
        activeConditions: z.array(z.string()).default([]),
        bannedKineticVerbs: z.array(z.string()).default([]),
    })
    .strict()

export const IngressSceneASTSchema = z
    .object({
        sceneId: z.string().min(1),
        seriesId: z.string().min(1),
        state_snapshot_hash: z
            .string()
            .regex(SHA256_HEX_REGEX, 'INVALID_SNAPSHOT_HASH'),
        dialogueLines: z.array(IngressDialogueLineSchema).min(1),
        lockedScreenplayText: z.string().min(1).optional(),
    })
    .strict()

export type IngressDialogueLine = z.infer<typeof IngressDialogueLineSchema>
export type IngressSceneAST = z.infer<typeof IngressSceneASTSchema>
export type SomaticDsp = z.infer<typeof SomaticDspSchema>
