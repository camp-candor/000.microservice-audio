import type Composition from './fce/composition.interface.js'
import type { VisemeSidecarManifest } from './fce/composition.interface.js'
import type CompositionBit from './fce/composition.bit.js'

export class CompositionModel implements Composition {
    idx: string = '17.composition'
    targetFps: number = 24
    sidecarsCompiledCount: number = 0
    totalFramesAllocated: number = 0
    lastSidecar: VisemeSidecarManifest | null = null
    lastSidecarPath: string | null = null
    compositionBits: Record<string, CompositionBit> = {}
}
