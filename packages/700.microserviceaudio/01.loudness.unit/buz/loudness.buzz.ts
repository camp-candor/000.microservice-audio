import fs from 'node:fs'
import { LoudnessModel } from '../loudness.model.js'
import LoudnessBit, { LoudnessAuditReport } from '../fce/loudness.bit.js'
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

export const initLoudness = (
    cpy: LoudnessModel,
    bal: LoudnessBit,
    ste: State,
): LoudnessModel => {
    cpy.auditsCompleted = 0
    cpy.loudnessBits = {}
    if (bal.slv) bal.slv({ ldnBit: { idx: 'init-loudness', val: 1 } })
    return cpy
}

export const updateLoudness = (
    cpy: LoudnessModel,
    bal: LoudnessBit,
    ste: State,
): LoudnessModel => {
    if (bal.idx) cpy.loudnessBits[bal.idx] = bal
    if (bal.slv) bal.slv({ ldnBit: bal })
    return cpy
}

export const measureIntegratedLufs = (buffer: Buffer): number => {
    // Parse standard 16-bit or 24-bit linear PCM from WAV data chunk
    let offset = 12
    while (offset < buffer.length - 8) {
        const chunkId = buffer.toString('ascii', offset, offset + 4)
        const chunkSize = buffer.readUInt32LE(offset + 4)
        if (chunkId === 'data') {
            const dataStart = offset + 8
            const dataEnd = Math.min(buffer.length, dataStart + chunkSize)
            let sumSquares = 0
            let sampleCount = 0

            for (let i = dataStart; i < dataEnd - 2; i += 2) {
                const sample = buffer.readInt16LE(i) / 32768.0
                sumSquares += sample * sample
                sampleCount++
            }

            if (sampleCount === 0) return -70.0
            const rms = Math.sqrt(sumSquares / sampleCount)
            if (rms <= 0.000001) return -70.0
            // Approximation of integrated K-weighted loudness from full-scale RMS
            return Math.round((20 * Math.log10(rms) - 0.691) * 10) / 10
        }
        offset += 8 + chunkSize
    }
    return -70.0
}

export const auditLoudness = async (
    cpy: LoudnessModel,
    bal: LoudnessBit,
    ste: State,
): Promise<LoudnessModel> => {
    const dat = bal.dat
    if (!dat?.filePath) {
        if (bal.slv) {
            bal.slv({
                ldnBit: {
                    idx: bal.idx,
                    result: {
                        status: 'FAILED',
                        filePath: '',
                        measuredLufs: -99,
                        targetLufs: -16.0,
                        deltaLufs: 99,
                        error: 'MISSING_FILE_PATH',
                    },
                },
            })
        }
        return cpy
    }

    const targetLufs = dat.profile?.targetLufs ?? -16.0
    const tolerance = dat.profile?.toleranceLufs ?? 1.0

    try {
        const buffer = dat.pcmBuffer || fs.readFileSync(dat.filePath)
        const measuredLufs = measureIntegratedLufs(buffer)
        const delta = Math.abs(measuredLufs - targetLufs)

        if (delta > tolerance) {
            const err = `LOUDNESS_DEVIATION_BREACH: Measured ${fmt1(measuredLufs)} LUFS exceeds target ${fmt1(targetLufs)} LUFS (tol +/-${fmt1(tolerance)} LUFS)`
            await logConsole(`:: [FAIL] [LOUDNESS] ${err}`)
            bal.result = {
                status: 'FAILED',
                filePath: dat.filePath,
                measuredLufs,
                targetLufs,
                deltaLufs: delta,
                error: err,
            }
        } else {
            await logConsole(
                `>> [OK] [LOUDNESS] Measured ${fmt1(measuredLufs)} LUFS matches target ${fmt1(targetLufs)} LUFS`,
            )
            bal.result = {
                status: 'PASSED',
                filePath: dat.filePath,
                measuredLufs,
                targetLufs,
                deltaLufs: delta,
            }
        }
    } catch (err: any) {
        const cleanErr = (err?.message || 'LOUDNESS_AUDIT_ERROR').slice(0, 150)
        await logConsole(`:: [FAIL] [LOUDNESS] Read failure: ${cleanErr}`)
        bal.result = {
            status: 'FAILED',
            filePath: dat.filePath,
            measuredLufs: -99,
            targetLufs,
            deltaLufs: 99,
            error: cleanErr,
        }
    }

    cpy.auditsCompleted += 1
    if (bal.slv) bal.slv({ ldnBit: bal })
    return cpy
}
