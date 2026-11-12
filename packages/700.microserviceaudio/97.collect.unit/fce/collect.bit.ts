import type {
    StemTimingReceipt,
    EpisodeStemManifest,
} from './collect.interface.js'

export interface SealStemPayload {
    lineId: string
    filePath: string
    stemRelativePath?: string
    pcmBuffer?: Buffer
    measuredLufs?: number
    measuredPeakDbTp?: number
}

export interface ExportManifestPayload {
    outputPath: string
    episodeId?: string
    seriesSlug?: string
}

export default interface CollectBit {
    idx?: string
    src?: string
    val?: number
    dex?: number
    dat?: any
    bit?: any
    receipt?: StemTimingReceipt
    manifest?: EpisodeStemManifest
    error?: string
    slv?: Function
}
