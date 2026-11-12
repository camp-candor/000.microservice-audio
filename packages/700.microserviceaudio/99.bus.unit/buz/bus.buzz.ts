import { BusModel } from '../bus.model.js'
import type BusBit from '../fce/bus.bit.js'
import type { TelemetryEnvelope } from '../fce/bus.interface.js'
import type State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

/**
 * Strips multi-byte UTF-8 emojis and non-7-bit ASCII characters (outside 0x20-0x7E)
 * to prevent curses coordinate misalignment and Windows cmd.exe buffer tearing.
 */
export const sanitizeTo7BitAscii = (
    rawInput: string,
): {
    cleanAscii: string
    strippedCount: number
} => {
    const input = String(rawInput ?? '')
    let strippedCount = 0
    let cleanAscii = ''

    for (const ch of input) {
        const code = ch.codePointAt(0) ?? 0
        if (code >= 0x20 && code <= 0x7e) {
            cleanAscii += ch
        } else if (ch === '\n' || ch === '\r' || ch === '\t') {
            cleanAscii += ' '
            strippedCount += 1
        } else {
            strippedCount += 1
        }
    }

    return { cleanAscii, strippedCount }
}

/**
 * Formats a telemetry line with canonical 7-bit clean ASCII status prefixes.
 */
export const formatAsciiTelemetryLine = (
    message: string,
    level: TelemetryEnvelope['level'] = 'INFO',
): { formatted: string; strippedCount: number } => {
    const { cleanAscii, strippedCount } = sanitizeTo7BitAscii(message)
    const trimmed = cleanAscii.trim()

    if (trimmed.startsWith('>>') || trimmed.startsWith('::')) {
        return { formatted: trimmed, strippedCount }
    }

    const prefix =
        level === 'FAIL' || level === 'WARN' ? `:: [${level}]` : `>> [${level}]`

    return {
        formatted: `${prefix} ${trimmed}`,
        strippedCount,
    }
}

export const initBus = (cpy: BusModel, bal: BusBit, _ste?: State): BusModel => {
    cpy.activeSinkIdx = 'cns00'
    cpy.messagesEmittedCount = 0
    cpy.nonAsciiBytesStrippedTotal = 0
    cpy.ringBuffer = []
    cpy.busBits = {}
    if (bal.slv) bal.slv({ busBit: { idx: 'init-bus', val: 1 } })
    return cpy
}

export const updateBus = (
    cpy: BusModel,
    bal: BusBit,
    _ste?: State,
): BusModel => {
    if (bal.idx) cpy.busBits[bal.idx] = bal
    if (bal.slv) bal.slv({ busBit: bal })
    return cpy
}

export const flushBusRing = (
    cpy: BusModel,
    bal: BusBit,
    _ste?: State,
): BusModel => {
    cpy.ringBuffer = []
    if (bal.slv)
        bal.slv({ busBit: { idx: bal.idx || 'flush-bus-ring', val: 1 } })
    return cpy
}

/**
 * Sanitizes and routes telemetry envelopes exclusively to Blessed console sink cns00.
 * Degrades gracefully in headless CI / Vitest environments when LIBRARY is absent.
 */
export const emitAsciiTelemetry = async (
    cpy: BusModel,
    bal: BusBit,
    ste?: State,
): Promise<BusModel> => {
    const rawMessage = bal.dat?.message ?? bal.src ?? ''
    const level = bal.dat?.level ?? 'INFO'
    const sinkIdx = bal.dat?.sinkIdx ?? cpy.activeSinkIdx

    const { formatted, strippedCount } = formatAsciiTelemetryLine(
        rawMessage,
        level,
    )

    const envelope: TelemetryEnvelope = {
        timestampUtc: new Date().toISOString(),
        channel: 'cns00',
        level,
        message: formatted,
        sanitizedByteCount: Buffer.byteLength(formatted, 'ascii'),
        strippedNonAsciiCount: strippedCount,
    }

    cpy.messagesEmittedCount += 1
    cpy.nonAsciiBytesStrippedTotal += strippedCount
    cpy.ringBuffer.push(envelope)
    if (cpy.ringBuffer.length > cpy.maxRingBufferSize) {
        cpy.ringBuffer.shift()
    }

    // Library-owned console actions must be hunted on the master LIBRARY bus;
    // hunting them on the package bus never settles (no library slv attached).
    // Headless CI / Vitest degradation: when the LIBRARY global is absent, sink
    // through the injected state so automated runners can observe dispatches.
    if ((globalThis as any).LIBRARY?.hunt) {
        await (globalThis as any).LIBRARY.hunt(UPDATE_CONSOLE, {
            idx: sinkIdx,
            src: formatted,
        }).catch(() => {})
    } else if (ste && typeof ste.hunt === 'function') {
        await ste
            .hunt(UPDATE_CONSOLE, { idx: sinkIdx, src: formatted })
            .catch(() => {})
    }

    bal.val = 1
    bal.src = formatted
    bal.envelope = envelope

    if (bal.slv) bal.slv({ busBit: bal })
    return cpy
}
