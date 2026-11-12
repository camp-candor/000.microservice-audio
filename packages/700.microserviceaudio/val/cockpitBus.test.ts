import { describe, it, expect } from 'vitest'
import { BusModel } from '../99.bus.unit/bus.model.js'
import {
    sanitizeTo7BitAscii,
    formatAsciiTelemetryLine,
    emitAsciiTelemetry,
} from '../99.bus.unit/buz/bus.buzz.js'
import { MenuModel } from '../98.menu.unit/menu.model.js'
import {
    initMenu,
    streamMenuTooltip,
    CHOICE_TOOLTIPS,
} from '../98.menu.unit/buz/00.menu.buzz.js'

describe('Phase 9: Pure Seven-Bit ASCII Bus Blessed Terminal Cockpit', () => {
    it('sanitizeTo7BitAscii strips multi-byte UTF-8 emojis and non-ASCII bytes', () => {
        const dirty =
            '>> [OK] Synthesis complete \u{1F680}\u{2705} -> \u{00E9}clair'
        const { cleanAscii, strippedCount } = sanitizeTo7BitAscii(dirty)

        expect(strippedCount).toBe(3)
        expect(/[^\x20-\x7E]/.test(cleanAscii)).toBe(false)
        expect(cleanAscii).toBe('>> [OK] Synthesis complete  -> clair')
    })

    it('formatAsciiTelemetryLine enforces canonical >> and :: prefixes', () => {
        const info = formatAsciiTelemetryLine('Audio unit mounted', 'OK')
        expect(info.formatted).toBe('>> [OK] Audio unit mounted')

        const fail = formatAsciiTelemetryLine('Noise floor breach', 'FAIL')
        expect(fail.formatted).toBe(':: [FAIL] Noise floor breach')
    })

    it('emitAsciiTelemetry routes clean 7-bit ASCII envelopes to cns00 and updates ring buffer', async () => {
        const bus = new BusModel()
        const dispatched: Array<{ action: string; payload: any }> = []
        const mockSte: any = {
            hunt: async (action: string, payload: any) => {
                dispatched.push({ action, payload })
                return {}
            },
        }

        const bal: any = {
            idx: 'test-emit-1',
            dat: {
                level: 'OK',
                message: 'Stem sealed cleanly \u{1F512}',
            },
        }

        await emitAsciiTelemetry(bus, bal, mockSte)

        expect(bal.val).toBe(1)
        expect(bus.messagesEmittedCount).toBe(1)
        expect(bus.nonAsciiBytesStrippedTotal).toBe(1)
        expect(bus.ringBuffer.length).toBe(1)
        expect(dispatched.length).toBe(1)
        expect(dispatched[0].payload.idx).toBe('cns00')
        expect(/[^\x20-\x7E]/.test(dispatched[0].payload.src)).toBe(false)
    })

    it('streamMenuTooltip dispatches 7-bit ASCII tooltip envelopes to cns00 on cursor focus', async () => {
        const hunted: Array<{ action: string; payload: any }> = []
        const mockSte: any = {
            hunt: async (action: string, payload: any) => {
                hunted.push({ action, payload })
                return {}
            },
        }

        const targetChoice = '[BUS: VERIFY 7-BIT ASCII TELEMETRY]'
        expect(CHOICE_TOOLTIPS[targetChoice]).toBeDefined()

        await streamMenuTooltip(mockSte, targetChoice)

        expect(hunted.length).toBe(1)
        expect(hunted[0].action).toBe('[Bus action] Emit Ascii Telemetry')
        expect(hunted[0].payload.dat.level).toBe('TOOLTIP')
        expect(hunted[0].payload.dat.sinkIdx).toBe('cns00')
    })

    it('initMenu degrades gracefully in headless CI when LIBRARY global is absent', async () => {
        const model = new MenuModel()
        let resolved = false
        const bal: any = {
            idx: 'headless-init',
            slv: () => {
                resolved = true
            },
        }

        await initMenu(model, bal, undefined)
        expect(resolved).toBe(true)
    })
})
