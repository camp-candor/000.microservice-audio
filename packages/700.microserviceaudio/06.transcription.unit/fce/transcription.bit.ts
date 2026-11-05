export interface HeaderSentinelReport {
    hasRiffHeader: boolean
    hasWaveMarker: boolean
    byteLength: number
    valid: boolean
    error?: string
}

export interface TranscriptionParityReport {
    status: 'PASSED' | 'FAILED'
    filePath: string
    expectedText: string
    normalizedInput: string
    sentinel: HeaderSentinelReport
    error?: string
}

export default interface TranscriptionBit {
    idx: string
    src?: string
    val?: number
    dat?: {
        filePath: string
        expectedText: string
        buffer?: Buffer
    }
    result?: TranscriptionParityReport
    slv?: (result: { trnBit: TranscriptionBit }) => void
}
