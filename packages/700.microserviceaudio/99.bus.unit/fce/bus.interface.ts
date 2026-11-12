import type BusBit from './bus.bit.js'

export interface TelemetryEnvelope {
    timestampUtc: string
    channel: 'cns00'
    level: 'INFO' | 'OK' | 'WARN' | 'FAIL' | 'TOOLTIP'
    message: string
    sanitizedByteCount: number
    strippedNonAsciiCount: number
}

export default interface Bus {
    idx: string
    activeSinkIdx: string
    messagesEmittedCount: number
    nonAsciiBytesStrippedTotal: number
    ringBuffer: TelemetryEnvelope[]
    maxRingBufferSize: number
    busBits: Record<string, BusBit>
}
