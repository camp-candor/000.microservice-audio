import type VerificationBit from './verification.bit.js'

export type ConformanceGateName =
    | 'SPECTRAL_FILTER'
    | 'DYNAMIC_DEESSER'
    | 'INTEGRATED_LOUDNESS'
    | 'TRUE_PEAK_CEILING'
    | 'UNVOICED_NOISE_FLOOR'
    | 'TRANSCRIPTION_PARITY'

export interface ConformanceGateVerdict {
    gate: ConformanceGateName
    unit: string
    status: 'PASSED' | 'FAILED' | 'SKIPPED'
    metricSummary: string
    error?: string
}

export interface VerificationReport {
    status: 'PASSED' | 'FAILED'
    filePath: string
    gatesPassedCount: number
    totalGatesCount: number
    gateVerdicts: ConformanceGateVerdict[]
    quarantinedUnlinked: boolean
    failedGate?: ConformanceGateName
    error?: string
}

export default interface Verification {
    idx: string
    auditsCompleted: number
    stemsPassedCount: number
    stemsQuarantinedCount: number
    lastReport: VerificationReport | null
    verificationBits: Record<string, VerificationBit>
}
