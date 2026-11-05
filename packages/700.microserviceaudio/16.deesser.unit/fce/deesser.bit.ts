export interface DeesserProfile {
    bandStartHz?: number
    bandEndHz?: number
    thresholdDbfs?: number
    ratio?: number
    sampleRateHz?: number
}

export interface DeesserReport {
    status: 'PASSED' | 'FAILED'
    filePath: string
    sibilanceEventsDetected: number
    maxReductionDb: number
    error?: string
}

export default interface DeesserBit {
    idx: string
    src?: string
    val?: number
    dat?: {
        filePath: string
        profile?: DeesserProfile
        pcmBuffer?: Buffer
    }
    result?: DeesserReport
    deessedBuffer?: Buffer
    slv?: (result: { dsrBit: DeesserBit }) => void
}
