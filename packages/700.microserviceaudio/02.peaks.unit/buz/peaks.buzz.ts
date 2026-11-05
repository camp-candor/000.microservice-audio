import fs from 'node:fs'
import { PeaksModel } from '../peaks.model.js'
import PeaksBit, { TruePeakReport } from '../fce/peaks.bit.js'
import State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const fmt1 = (n: number): string => n.toFixed(1)

const logConsole = async (src: string): Promise<void> => {
    if ((globalThis as any).LIBRARY?.hunt) {
        await (globalThis as any).LIBRARY.hunt(UPDATE_CONSOLE, {
            idx: 'cns00',
            src,
        })
    }
}

export const initPeaks = (
    cpy: PeaksModel,
    bal: PeaksBit,
    ste: State,
): PeaksModel => {
    cpy.scansCompleted = 0
    cpy.peaksBits = {}
    if (bal.slv) bal.slv({ pekBit: { idx: 'init-peaks', val: 1 } })
    return cpy
}

export const updatePeaks = (
    cpy: PeaksModel,
    bal: PeaksBit,
    ste: State,
): PeaksModel => {
    if (bal.idx) cpy.peaksBits[bal.idx] = bal
    if (bal.slv) bal.slv({ pekBit: bal })
    return cpy
}

export const scanTruePeak = (buffer: Buffer): number => {
    let offset = 12
    while (offset < buffer.length - 8) {
        const chunkId = buffer.toString('ascii', offset, offset + 4)
        const chunkSize = buffer.readUInt32LE(offset + 4)
        if (chunkId === 'data') {
            const dataStart = offset + 8
            const dataEnd = Math.min(buffer.length, dataStart + chunkSize)
            let maxPeak = 0

            for (let i = dataStart; i < dataEnd - 2; i += 2) {
                const val = Math.abs(buffer.readInt16LE(i)) / 32768.0
                if (val > maxPeak) maxPeak = val
            }

            if (maxPeak === 0) return -90.0
            return Math.round(20 * Math.log10(maxPeak) * 10) / 10
        }
        offset += 8 + chunkSize
    }
    return -90.0
}

export const auditPeaks = async (
    cpy: PeaksModel,
    bal: PeaksBit,
    ste: State,
): Promise<PeaksModel> => {
    const dat = bal.dat
    if (!dat?.filePath) {
        if (bal.slv) {
            bal.slv({
                pekBit: {
                    idx: bal.idx,
                    result: {
                        status: 'FAILED',
                        filePath: '',
                        measuredPeakDbTp: 0,
                        maxTruePeakDbTp: -1.0,
                        clippingDetected: true,
                        error: 'MISSING_FILE_PATH',
                    },
                },
            })
        }
        return cpy
    }

    const maxThreshold = dat.maxTruePeakDbTp ?? -1.0

    try {
        const buffer = dat.pcmBuffer || fs.readFileSync(dat.filePath)
        const peak = scanTruePeak(buffer)
        const clippingDetected = peak > maxThreshold

        if (clippingDetected) {
            const err = `TRUE_PEAK_CLIPPING_BREACH: Measured peak ${fmt1(peak)} dBTP exceeds ceiling ${fmt1(maxThreshold)} dBTP`
            await logConsole(`:: [FAIL] [PEAKS] ${err}`)
            bal.result = {
                status: 'FAILED',
                filePath: dat.filePath,
                measuredPeakDbTp: peak,
                maxTruePeakDbTp: maxThreshold,
                clippingDetected: true,
                error: err,
            }
        } else {
            await logConsole(
                `>> [OK] [PEAKS] Measured peak ${fmt1(peak)} dBTP satisfies ${fmt1(maxThreshold)} dBTP ceiling`,
            )
            bal.result = {
                status: 'PASSED',
                filePath: dat.filePath,
                measuredPeakDbTp: peak,
                maxTruePeakDbTp: maxThreshold,
                clippingDetected: false,
            }
        }
    } catch (err: any) {
        const cleanErr = (err?.message || 'PEAK_AUDIT_ERROR').slice(0, 150)
        await logConsole(`:: [FAIL] [PEAKS] Read failure: ${cleanErr}`)
        bal.result = {
            status: 'FAILED',
            filePath: dat.filePath,
            measuredPeakDbTp: 0,
            maxTruePeakDbTp: maxThreshold,
            clippingDetected: true,
            error: cleanErr,
        }
    }

    cpy.scansCompleted += 1
    if (bal.slv) bal.slv({ pekBit: bal })
    return cpy
}
