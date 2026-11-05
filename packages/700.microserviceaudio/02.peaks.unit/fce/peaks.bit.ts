export interface TruePeakReport {
    status: 'PASSED' | 'FAILED'
    filePath: string
    measuredPeakDbTp: number
    maxTruePeakDbTp: number
    clippingDetected: boolean
    error?: string
}

export default interface PeaksBit {
    idx: string
    src?: string
    val?: number
    dat?: {
        filePath: string
        maxTruePeakDbTp?: number
        pcmBuffer?: Buffer
    }
    result?: TruePeakReport
    slv?: (result: { pekBit: PeaksBit }) => void
}
