import fs from 'node:fs'
import { FilterModel } from '../filter.model.js'
import FilterBit, { FilterReport } from '../fce/filter.bit.js'
import State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const logConsole = async (src: string): Promise<void> => {
    if ((globalThis as any).LIBRARY?.hunt) {
        await (globalThis as any).LIBRARY.hunt(UPDATE_CONSOLE, {
            idx: 'cns00',
            src,
        })
    }
}

export const initFilter = (
    cpy: FilterModel,
    bal: FilterBit,
    ste: State,
): FilterModel => {
    cpy.filtersProcessed = 0
    cpy.filterBits = {}
    if (bal.slv) bal.slv({ fltBit: { idx: 'init-filter', val: 1 } })
    return cpy
}

export const updateFilter = (
    cpy: FilterModel,
    bal: FilterBit,
    ste: State,
): FilterModel => {
    if (bal.idx) cpy.filterBits[bal.idx] = bal
    if (bal.slv) bal.slv({ fltBit: bal })
    return cpy
}

export const stripDcOffset = (samples: Float32Array): void => {
    let sum = 0
    for (let i = 0; i < samples.length; i++) {
        sum += samples[i]
    }
    const mean = sum / samples.length
    for (let i = 0; i < samples.length; i++) {
        samples[i] -= mean
    }
}

export const applyButterworthHighPass = (
    samples: Float32Array,
    cutoffHz: number = 90.0,
    sampleRate: number = 48000,
): void => {
    // 4th-order Butterworth implementation via cascaded 2nd-order biquad stages
    const w0 = (2 * Math.PI * cutoffHz) / sampleRate
    const cosW0 = Math.cos(w0)
    const sinW0 = Math.sin(w0)

    // Q values for 4th-order Butterworth
    const qValues = [0.5411961, 1.306563]

    for (const q of qValues) {
        const alpha = sinW0 / (2 * q)
        const b0 = (1 + cosW0) / 2
        const b1 = -(1 + cosW0)
        const b2 = (1 + cosW0) / 2
        const a0 = 1 + alpha
        const a1 = -2 * cosW0
        const a2 = 1 - alpha

        const normB0 = b0 / a0
        const normB1 = b1 / a0
        const normB2 = b2 / a0
        const normA1 = a1 / a0
        const normA2 = a2 / a0

        let x1 = 0
        let x2 = 0
        let y1 = 0
        let y2 = 0

        for (let i = 0; i < samples.length; i++) {
            const x0 = samples[i]
            const y0 =
                normB0 * x0 +
                normB1 * x1 +
                normB2 * x2 -
                normA1 * y1 -
                normA2 * y2
            x2 = x1
            x1 = x0
            y2 = y1
            y1 = y0
            samples[i] = y0
        }
    }
}

export const applySpectralFilter = async (
    cpy: FilterModel,
    bal: FilterBit,
    ste: State,
): Promise<FilterModel> => {
    const dat = bal.dat
    if (!dat?.filePath) {
        await logConsole(
            ':: [FAIL] [FILTER] Processing failed: MISSING_FILE_PATH',
        )
        if (bal.slv) {
            bal.slv({
                fltBit: {
                    idx: bal.idx,
                    result: {
                        status: 'FAILED',
                        filePath: '',
                        dcOffsetStripped: false,
                        lowEndAttenuatedDb: 0,
                        sampleRateHz: 48000,
                        error: 'MISSING_FILE_PATH',
                    },
                },
            })
        }
        return cpy
    }

    const cutoff = dat.profile?.cutoffHz ?? 90.0
    const sampleRate = dat.profile?.sampleRateHz ?? 48000

    try {
        const raw = dat.pcmBuffer || fs.readFileSync(dat.filePath)
        // Parse data chunk offset
        let dataOffset = 44
        for (let i = 12; i < raw.length - 8; i += 4) {
            if (raw.toString('ascii', i, i + 4) === 'data') {
                dataOffset = i + 8
                break
            }
        }

        const sampleCount = Math.floor((raw.length - dataOffset) / 2)
        const samples = new Float32Array(sampleCount)

        for (let i = 0; i < sampleCount; i++) {
            samples[i] = raw.readInt16LE(dataOffset + i * 2) / 32768.0
        }

        // Step 1: Strip DC bias offset
        stripDcOffset(samples)

        // Step 2: Apply 4th-order Butterworth High-Pass Filter (24 dB/octave)
        applyButterworthHighPass(samples, cutoff, sampleRate)

        // Write samples back into conformed buffer
        const outBuffer = Buffer.from(raw)
        for (let i = 0; i < sampleCount; i++) {
            const clamped = Math.max(-1.0, Math.min(1.0, samples[i]))
            outBuffer.writeInt16LE(
                Math.floor(clamped * 32767),
                dataOffset + i * 2,
            )
        }

        bal.filteredBuffer = outBuffer
        bal.result = {
            status: 'PASSED',
            filePath: dat.filePath,
            dcOffsetStripped: true,
            lowEndAttenuatedDb: 24.0,
            sampleRateHz: sampleRate,
        }

        await logConsole(
            `>> [OK] [FILTER] High-pass Butterworth applied at ${cutoff}Hz to [${dat.filePath}]`,
        )
        await logConsole(
            `>> [OK] [SPECTRAL] DC bias stripped to 0.0 mean across ${sampleCount} samples`,
        )
    } catch (err: any) {
        const cleanErr = (err?.message || 'FILTER_ERROR').slice(0, 150)
        await logConsole(`:: [FAIL] [FILTER] Processing failed: ${cleanErr}`)
        bal.result = {
            status: 'FAILED',
            filePath: dat.filePath,
            dcOffsetStripped: false,
            lowEndAttenuatedDb: 0,
            sampleRateHz: sampleRate,
            error: cleanErr,
        }
    }

    cpy.filtersProcessed += 1
    if (bal.slv) bal.slv({ fltBit: bal })
    return cpy
}
