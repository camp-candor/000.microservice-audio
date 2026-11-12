import type {
    SpectralInversionMetrics,
    TemporalCadenceMetrics,
    CadenceClassificationReport,
} from './audio.interface.js'

export interface AudioRedactionPayload {
    filePath?: string
    pcmBuffer?: Buffer
    sampleRateHz?: number
    targetPitchHz?: number
    lpcOrder?: number
    noiseFloorCeilingDbfs?: number
}

export interface AudioRedactionResult {
    status: 'PASSED' | 'FAILED' | 'NOISE_FLOOR_BREACH'
    metrics: SpectralInversionMetrics
    redactedPcmBuffer?: Buffer
    error?: string
}

export interface CadenceEvaluationPayload {
    characterId: string
    pcmBuffer?: Buffer
    sampleRateHz?: number
    bannedCadences?: string[]
    expectedP2srMin?: number
    expectedP2srMax?: number
    expectedAttackMin?: number
}

export default interface AudioBit {
    idx: string
    src?: string
    val?: number
    dat?: AudioRedactionPayload | CadenceEvaluationPayload
    result?: AudioRedactionResult
    cadenceReport?: CadenceClassificationReport
    slv?: (result: { audBit: AudioBit }) => void
}
