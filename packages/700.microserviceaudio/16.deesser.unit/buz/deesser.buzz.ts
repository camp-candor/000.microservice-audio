import fs from 'node:fs'
import { DeesserModel } from '../deesser.model.js'
import DeesserBit, { DeesserReport } from '../fce/deesser.bit.js'
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

export const initDeesser = (
    cpy: DeesserModel,
    bal: DeesserBit,
    ste: State,
): DeesserModel => {
    cpy.filesProcessed = 0
    cpy.deesserBits = {}
    if (bal.slv) bal.slv({ dsrBit: { idx: 'init-deesser', val: 1 } })
    return cpy
}

export const updateDeesser = (
    cpy: DeesserModel,
    bal: DeesserBit,
    ste: State,
): DeesserModel => {
    if (bal.idx) cpy.deesserBits[bal.idx] = bal
    if (bal.slv) bal.slv({ dsrBit: bal })
    return cpy
}

export const compressSibilantBand = (
    samples: Float32Array,
    thresholdDbfs: number = -18.0,
): { eventsDetected: number; maxReductionDb: number } => {
    const thresholdLinear = Math.pow(10, thresholdDbfs / 20)
    let events = 0
    let maxReduction = 0
    let inEvent = false

    for (let i = 0; i < samples.length; i++) {
        const absVal = Math.abs(samples[i])
        if (absVal > thresholdLinear) {
            if (!inEvent) {
                events++
                inEvent = true
            }
            const currentDb = 20 * Math.log10(absVal)
            const overDb = currentDb - thresholdDbfs
            // 4:1 compression ratio above threshold
            const reducedDb = thresholdDbfs + overDb / 4.0
            const reductionDb = currentDb - reducedDb
            if (reductionDb > maxReduction) maxReduction = reductionDb

            const newLinear = Math.pow(10, reducedDb / 20)
            samples[i] = (samples[i] / absVal) * newLinear
        } else {
            inEvent = false
        }
    }

    return {
        eventsDetected: events,
        maxReductionDb: Math.round(maxReduction * 10) / 10,
    }
}

export const applyDynamicDeesser = async (
    cpy: DeesserModel,
    bal: DeesserBit,
    ste: State,
): Promise<DeesserModel> => {
    const dat = bal.dat
    if (!dat?.filePath) {
        await logConsole(
            ':: [FAIL] [DEESSER] Execution failed: MISSING_FILE_PATH',
        )
        if (bal.slv) {
            bal.slv({
                dsrBit: {
                    idx: bal.idx,
                    result: {
                        status: 'FAILED',
                        filePath: '',
                        sibilanceEventsDetected: 0,
                        maxReductionDb: 0,
                        error: 'MISSING_FILE_PATH',
                    },
                },
            })
        }
        return cpy
    }

    const thresholdDbfs = dat.profile?.thresholdDbfs ?? -18.0

    try {
        const raw = dat.pcmBuffer || fs.readFileSync(dat.filePath)
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

        const { eventsDetected, maxReductionDb } = compressSibilantBand(
            samples,
            thresholdDbfs,
        )

        const outBuffer = Buffer.from(raw)
        for (let i = 0; i < sampleCount; i++) {
            const clamped = Math.max(-1.0, Math.min(1.0, samples[i]))
            outBuffer.writeInt16LE(
                Math.floor(clamped * 32767),
                dataOffset + i * 2,
            )
        }

        bal.deessedBuffer = outBuffer
        bal.result = {
            status: 'PASSED',
            filePath: dat.filePath,
            sibilanceEventsDetected: eventsDetected,
            maxReductionDb,
        }

        await logConsole(
            `>> [OK] [DEESSER] Dynamic de-essing completed (${eventsDetected} events, -${maxReductionDb}dB max reduction)`,
        )
    } catch (err: any) {
        const cleanErr = (err?.message || 'DEESSER_ERROR').slice(0, 150)
        await logConsole(`:: [FAIL] [DEESSER] Execution failed: ${cleanErr}`)
        bal.result = {
            status: 'FAILED',
            filePath: dat.filePath,
            sibilanceEventsDetected: 0,
            maxReductionDb: 0,
            error: cleanErr,
        }
    }

    cpy.filesProcessed += 1
    if (bal.slv) bal.slv({ dsrBit: bal })
    return cpy
}
