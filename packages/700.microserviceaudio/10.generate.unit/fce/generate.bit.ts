export interface SomaticDspModifiers {
    basePitchShiftSemitones?: number
    formantWarpingFactor?: number
    breathinessPauseMultiplier?: number
    vocalFryDensity?: number
}

export interface PollingConfig {
    stagingPath: string
    targetPath: string
    intervalMs?: number
    timeoutMs?: number
    stabilityChecksRequired?: number
}

export interface PollingResult {
    status: 'STABILIZED' | 'TIMEOUT' | 'INODE_ERROR'
    bytesConfirmed: number
    pollAttempts: number
    elapsedMs: number
    error?: string
}

export interface GenerateConfig {
    engine: 'styletts2' | 'parler' | 'piper'
    character: string
    text: string
    emotion?: string
    tonePacing?: number
    outputPath: string
    referenceWav?: string
    styleVectorPath?: string
    dspModifiers?: SomaticDspModifiers
    pythonPath?: string
    synthesizeScriptPath?: string
    polling?: PollingConfig
}

export interface GenerateResult {
    status: 'SUCCESS' | 'FAILED'
    outputPath: string
    exitCode: number
    executionTimeMs: number
    bytesConfirmed?: number
    stderr?: string
}

export default interface GenerateBit {
    idx: string
    src?: string
    val?: number
    dat?: GenerateConfig
    pollDat?: PollingConfig
    pollResult?: PollingResult
    result?: GenerateResult
    slv?: (result: { genBit: GenerateBit }) => void
}
