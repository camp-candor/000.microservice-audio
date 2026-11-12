import type AudioBit from './audio.bit.js'

export interface SpectralInversionMetrics {
    originalSampleRateHz: number
    targetPitchHz: number
    lpcOrder: number
    measuredUnvoicedNoiseFloorDbfs: number
    isFormantsNeutralized: boolean
    isPitchFlattened: boolean
}

export interface TemporalCadenceMetrics {
    consonantAttackVelocity: number // d(RMS)/dt at phonetic onsets (dB/ms)
    averageSyllableDurationMs: number
    pauseToSpeechRatio: number // P2SR
    rhythmEnergyVariance: number
}

export interface CadenceClassificationReport {
    characterId: string
    metrics: TemporalCadenceMetrics
    cadenceMatchConfidence: number // P(Identity) [0.0, 1.0]
    isIdentityConfirmed: boolean // confidence >= 0.95
    isNoiseFloorClean: boolean // noise floor < -60.0 dBFS
    isProhibitedCadenceDetected: boolean
    status:
        'PASSED' | 'FAILED' | 'PROSODIC_EXCLUSION_LEAK' | 'NOISE_FLOOR_BREACH'
    error?: string
}

export default interface Audio {
    idx: string
    monotoneTargetPitchHz: number
    lpcOrder: number
    noiseFloorCeilingDbfs: number
    filesProcessed: number
    spectralInversionsCompleted: number
    cadenceClassificationsCompleted: number
    lastMetrics: SpectralInversionMetrics | null
    lastClassificationReport: CadenceClassificationReport | null
    audioBits: Record<string, AudioBit>
}
