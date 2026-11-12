import type Bus from './fce/bus.interface.js'
import type { TelemetryEnvelope } from './fce/bus.interface.js'
import type BusBit from './fce/bus.bit.js'

export class BusModel implements Bus {
    idx: string = '99.bus'
    activeSinkIdx: string = 'cns00'
    messagesEmittedCount: number = 0
    nonAsciiBytesStrippedTotal: number = 0
    ringBuffer: TelemetryEnvelope[] = []
    maxRingBufferSize: number = 256
    busBits: Record<string, BusBit> = {}
}
