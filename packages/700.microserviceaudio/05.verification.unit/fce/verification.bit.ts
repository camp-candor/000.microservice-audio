import type { VerificationReport } from './verification.interface.js'

export interface ConformanceFirewallPayload {
    filePath: string
    expectedText: string
    pcmBuffer?: Buffer
    sampleRateHz?: number
    targetLufs?: number
    toleranceLufs?: number
    maxTruePeakDbTp?: number
    noiseFloorCeilingDbfs?: number
    unlinkOnFailure?: boolean
}

export default interface VerificationBit {
    idx: string
    src?: string
    val?: number
    dat?: ConformanceFirewallPayload
    report?: VerificationReport
    conformedBuffer?: Buffer
    slv?: (result: { vrfBit: VerificationBit }) => void
}
