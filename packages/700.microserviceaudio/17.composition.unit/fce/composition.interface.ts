import type CompositionBit from './composition.bit.js'

export type PrestonBlairVisemeCode =
    'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'X'

export interface VisemeKeyframe {
    viseme: PrestonBlairVisemeCode
    startFrame: number
    endFrame: number
    durationFrames: number
    startTimeMs: number
    endTimeMs: number
    phonemeToken: string
}

export interface VisemeSidecarManifest {
    schemaVersion: string
    lineId: string
    characterId: string
    stemSha256: string
    fps: number
    audioDurationMs: number
    totalAllocatedFrames: number
    leadSilenceFrames: number
    tailSilenceFrames: number
    sidecarRootSha256: string
    keyframes: VisemeKeyframe[]
}

export default interface Composition {
    idx: string
    targetFps: number
    sidecarsCompiledCount: number
    totalFramesAllocated: number
    lastSidecar: VisemeSidecarManifest | null
    lastSidecarPath: string | null
    compositionBits: Record<string, CompositionBit>
}
