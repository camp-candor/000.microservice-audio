import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    stripDcOffset,
    applyButterworthHighPass,
    applySpectralFilter,
} from '../11.filter.unit/buz/filter.buzz.js'
import { FilterModel } from '../11.filter.unit/filter.model.js'
import {
    compressSibilantBand,
    applyDynamicDeesser,
} from '../16.deesser.unit/buz/deesser.buzz.js'
import { DeesserModel } from '../16.deesser.unit/deesser.model.js'

describe('Phase 9: Pre-Conform Spectral Hygiene Conformance Gauntlet', () => {
    it('11.filter.unit: strips DC bias offset to 0.0 mean', () => {
        const samples = new Float32Array([0.5, 0.6, 0.5, 0.4, 0.5])
        stripDcOffset(samples)

        let sum = 0
        for (let i = 0; i < samples.length; i++) {
            sum += samples[i]
        }
        const mean = sum / samples.length
        expect(Math.abs(mean)).toBeLessThan(0.00001)
    })

    it('11.filter.unit: attenuates infrasonic low-frequency rumble via 4th-order Butterworth', () => {
        // Generate 30 Hz sub-bass sine wave at 48 kHz
        const sampleRate = 48000
        const freq = 30
        const count = 4800
        const samples = new Float32Array(count)

        for (let i = 0; i < count; i++) {
            samples[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate)
        }

        const initialMax = Math.max(...samples)
        applyButterworthHighPass(samples, 90.0, sampleRate)
        const filteredMax = Math.max(...samples.slice(2400)) // Sample after filter settling

        expect(filteredMax).toBeLessThan(initialMax * 0.2) // > 14 dB attenuation
    })

    it('16.deesser.unit: detects and compresses sibilance exceeding -18 dBFS threshold', () => {
        // Generate samples with extreme sibilance peak at 0 dBFS (amplitude 1.0)
        const samples = new Float32Array([0.1, 0.2, 0.95, 0.1, 0.05])
        const { eventsDetected, maxReductionDb } = compressSibilantBand(
            samples,
            -18.0,
        )

        expect(eventsDetected).toBe(1)
        expect(maxReductionDb).toBeGreaterThan(5.0)
        expect(samples[2]).toBeLessThan(0.95)
    })
})

describe('Phase 9: Missing File Fail-Closed Trap', () => {
    beforeEach(() => {
        delete (globalThis as any).LIBRARY
    })

    it('11.filter.unit + 16.deesser.unit: fail closed on missing filePath with :: [FAIL] telemetry', async () => {
        const hunt = vi.fn(async () => {})
        ;(globalThis as any).LIBRARY = { hunt }

        const filterModel = new FilterModel()
        let filterResult: any = null
        await applySpectralFilter(
            filterModel,
            {
                idx: 'trap-missing-filter',
                slv: (r) => {
                    filterResult = r
                },
            },
            {} as any,
        )
        expect(filterResult?.fltBit?.result?.status).toBe('FAILED')
        expect(filterResult?.fltBit?.result?.dcOffsetStripped).toBe(false)

        const deesserModel = new DeesserModel()
        let deesserResult: any = null
        await applyDynamicDeesser(
            deesserModel,
            {
                idx: 'trap-missing-deesser',
                slv: (r) => {
                    deesserResult = r
                },
            },
            {} as any,
        )
        expect(deesserResult?.dsrBit?.result?.status).toBe('FAILED')

        const logged = hunt.mock.calls.map((c: any[]) =>
            String(c[1]?.src ?? ''),
        )
        expect(logged.some((s) => s.includes(':: [FAIL] [FILTER]'))).toBe(true)
        expect(logged.some((s) => s.includes(':: [FAIL] [DEESSER]'))).toBe(true)

        delete (globalThis as any).LIBRARY
    })
})
