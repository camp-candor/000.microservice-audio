import type CollectBit from './collect.bit.js'
import type CaboodleBit from './caboodle.bit.js'

export interface StemTimingReceipt {
    lineId: string
    stemRelativePath: string
    sha256Hash: string
    durationMs: number
    sampleRateHz: number
    bitDepth: number
    channels: number
    byteLength: number
    measuredLufs: number
    measuredPeakDbTp: number
    sealedAtUtc: string
}

export interface EpisodeStemManifest {
    schemaVersion: string
    episodeId: string
    seriesSlug: string
    sealedAtUtc: string
    totalStemsCount: number
    cumulativeDurationMs: number
    manifestRootSha256: string
    stems: StemTimingReceipt[]
}

export default interface Collect {
    idx: string
    episodeId: string
    seriesSlug: string
    stemsSealedCount: number
    cumulativeDurationMs: number
    stemReceipts: Record<string, StemTimingReceipt>
    lastManifestPath: string | null
    lastManifestDigest: string | null
    collectBits: Record<string, CollectBit>
    caboodleBitList?: CaboodleBit[]
    caboodleBits?: any
}
