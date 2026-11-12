import type ModelBit from './model.bit.js'

export type VocoderEngineType =
    'styletts2' | 'parler' | 'piper' | 'cosyvoice' | 'kokoro'

export interface VocoderEngineDescriptor {
    engineId: VocoderEngineType
    displayName: string
    checkpointRelativePath: string
    supportsMmapLatent: boolean
    sampleRateHz: number
    minimumRamRequiredBytes: number
    executableSubprocessPath: string
}

export interface LatentTensorDescriptor {
    characterId: string
    versionNumber: number
    absoluteTensorPath: string
    fileSizeBytes: number
    isMemoryMapped: boolean
    sha256Hash?: string
}

export default interface Model {
    idx: string
    activeEngine: VocoderEngineType
    maxAllowedRamBytes: number
    engines: Record<VocoderEngineType, VocoderEngineDescriptor>
    loadedTensors: Record<string, LatentTensorDescriptor>
    modelsLoadedCount: number
    modelBits: Record<string, ModelBit>
}
