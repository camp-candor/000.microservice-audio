import type { VisemeSidecarManifest } from './composition.interface.js'

export interface CompileVisemePayload {
    lineId: string
    characterId: string
    stemSha256: string
    normalizedDialogueText: string
    audioDurationMs: number
    leadSilenceMs?: number
    tailSilenceMs?: number
    fps?: number
    outputPath?: string
}

export default interface CompositionBit {
    idx: string
    src?: string
    val?: number
    dat?: CompileVisemePayload
    sidecar?: VisemeSidecarManifest
    error?: string
    slv?: (result: { cmpBit: CompositionBit }) => void
}
