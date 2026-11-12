import type Collect from './fce/collect.interface.js'
import type { StemTimingReceipt } from './fce/collect.interface.js'
import type CollectBit from './fce/collect.bit.js'
import type CaboodleBit from './fce/caboodle.bit.js'

export class CollectModel implements Collect {
    idx: string = '97.collect'
    episodeId: string = 'ep01'
    seriesSlug: string = 'wiregrass-basin'
    stemsSealedCount: number = 0
    cumulativeDurationMs: number = 0
    stemReceipts: Record<string, StemTimingReceipt> = {}
    lastManifestPath: string | null = null
    lastManifestDigest: string | null = null
    collectBits: Record<string, CollectBit> = {}
    caboodleBitList: CaboodleBit[] = []
    caboodleBits: any = {}
}
