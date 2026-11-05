export interface FilterProfile {
    cutoffHz?: number
    enableDcStripper?: boolean
    notchFrequencies?: number[]
    sampleRateHz?: number
}

export interface FilterReport {
    status: 'PASSED' | 'FAILED'
    filePath: string
    dcOffsetStripped: boolean
    lowEndAttenuatedDb: number
    sampleRateHz: number
    error?: string
}

export default interface FilterBit {
    idx: string
    src?: string
    val?: number
    dat?: {
        filePath: string
        profile?: FilterProfile
        pcmBuffer?: Buffer
    }
    result?: FilterReport
    filteredBuffer?: Buffer
    slv?: (result: { fltBit: FilterBit }) => void
}
