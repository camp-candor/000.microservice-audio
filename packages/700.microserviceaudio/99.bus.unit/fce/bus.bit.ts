import type { TelemetryEnvelope } from './bus.interface.js'

export interface EmitTelemetryPayload {
    message: string
    level?: 'INFO' | 'OK' | 'WARN' | 'FAIL' | 'TOOLTIP'
    sinkIdx?: string
}

export default interface BusBit {
    idx: string
    src?: string
    val?: number
    dat?: EmitTelemetryPayload
    envelope?: TelemetryEnvelope
    slv?: (result: { busBit: BusBit }) => void
}
