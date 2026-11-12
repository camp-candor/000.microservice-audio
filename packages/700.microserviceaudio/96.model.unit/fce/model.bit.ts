import type {
    VocoderEngineType,
    VocoderEngineDescriptor,
    LatentTensorDescriptor,
} from './model.interface.js'

export interface ModelResolutionPayload {
    seriesId: string
    characterId: string
    versionNumber?: number
    engineOverride?: VocoderEngineType
    vaultRootPath?: string
}

export interface MmapArgsResult {
    engineId: VocoderEngineType
    cliArgs: string[]
    envOverrides: Record<string, string>
    resolvedTensorPath: string
    isBypassingWavResample: boolean
}

export interface MemoryBudgetReport {
    status: 'PASSED' | 'FAILED'
    currentRssBytes: number
    maxAllowedRamBytes: number
    headroomBytes: number
    rssMegabytes?: number
    error?: string
}

export interface LatentResolutionResult {
    status: 'RESOLVED' | 'MISSING_TENSOR' | 'RAM_OVERFLOW' | 'BREACH'
    characterId: string
    versionNumber: number
    tensorDescriptor?: LatentTensorDescriptor
    mmapArgs?: MmapArgsResult
    memoryReport?: MemoryBudgetReport
    error?: string
}

export default interface ModelBit {
    idx: string
    src?: string
    val?: number
    dat?: any
    slv?: Function
    result?: LatentResolutionResult
    memoryReport?: MemoryBudgetReport
}
