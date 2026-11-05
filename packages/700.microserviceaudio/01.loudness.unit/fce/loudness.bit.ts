export interface LoudnessTargetProfile {
    targetLufs: number
    toleranceLufs: number
    maxTruePeakDbTp?: number
}

export interface LoudnessAuditReport {
    status: 'PASSED' | 'FAILED'
    filePath: string
    measuredLufs: number
    targetLufs: number
    deltaLufs: number
    error?: string
}

export default interface LoudnessBit {
    idx: string
    src?: string
    val?: number
    dat?: {
        filePath: string
        profile?: LoudnessTargetProfile
        pcmBuffer?: Buffer
        sampleRate?: number
    }
    result?: LoudnessAuditReport
    slv?: (result: { ldnBit: LoudnessBit }) => void
}
