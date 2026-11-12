import fs from 'node:fs'
import { LoudnessModel } from '../loudness.model.js'
import type LoudnessBit from '../fce/loudness.bit.js'
import type {
    LoudnessTargetProfile,
    LoudnessCalibrationReport,
} from '../fce/loudness.bit.js'
import type { LoudnessDeliveryStandard } from '../fce/loudness.interface.js'
import type State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const logConsole = async (
    ste: State | undefined,
    src: string,
): Promise<void> => {
    // Library-owned console actions must be hunted on the master LIBRARY bus;
    // hunting them on the package bus never settles (no library slv attached).
    if ((globalThis as any).LIBRARY?.hunt) {
        await (globalThis as any).LIBRARY.hunt(UPDATE_CONSOLE, {
            idx: 'cns00',
            src,
        }).catch(() => {})
        return
    }
    if (ste && typeof ste.hunt === 'function') {
        await ste.hunt(UPDATE_CONSOLE, { idx: 'cns00', src }).catch(() => {})
    }
}

export const resolveStandardTargetLufs = (
    standard?: LoudnessDeliveryStandard,
): number => {
    switch (standard) {
        case 'BROADCAST_ATSC':
            return -24.0
        case 'BROADCAST_EBU':
            return -23.0
        case 'WEB_STREAMING':
        default:
            return -16.0
    }
}

export const initLoudness = (
    cpy: LoudnessModel,
    bal: LoudnessBit,
    _ste?: State,
): LoudnessModel => {
    cpy.auditsCompleted = 0
    cpy.calibrationsCompleted = 0
    cpy.loudnessBits = {}
    if (bal.slv) bal.slv({ ldnBit: { idx: 'init-loudness', val: 1 } })
    return cpy
}

export const updateLoudness = (
    cpy: LoudnessModel,
    bal: LoudnessBit,
    _ste?: State,
): LoudnessModel => {
    if (bal.idx) cpy.loudnessBits[bal.idx] = bal
    if (bal.slv) bal.slv({ ldnBit: bal })
    return cpy
}

export const measureIntegratedLufs = (buffer: Buffer): number => {
    let offset = 12
    while (offset < buffer.length - 8) {
        const chunkId = buffer.toString('ascii', offset, offset + 4)
        const chunkSize = buffer.readUInt32LE(offset + 4)
        if (chunkId === 'data') {
            const dataStart = offset + 8
            const dataEnd = Math.min(buffer.length, dataStart + chunkSize)
            let sumSquares = 0
            let sampleCount = 0

            for (let i = dataStart; i <= dataEnd - 2; i += 2) {
                const sample = buffer.readInt16LE(i) / 32768.0
                sumSquares += sample * sample
                sampleCount++
            }

            if (sampleCount === 0) return -70.0
            const rms = Math.sqrt(sumSquares / sampleCount)
            if (rms <= 0.000001) return -70.0
            return Math.round((20 * Math.log10(rms) - 0.691) * 10) / 10
        }
        offset += 8 + chunkSize
    }
    return -70.0
}

/**
 * Pass-2 Linear Gain Normalization Scaler for 16-bit PCM WAV buffers.
 */
export const normalizePcmToTargetLufs = (
    buffer: Buffer,
    profile?: LoudnessTargetProfile,
): {
    calibratedBuffer: Buffer
    report: LoudnessCalibrationReport
} => {
    const standard: LoudnessDeliveryStandard =
        profile?.standard || 'WEB_STREAMING'
    const targetLufs =
        profile?.targetLufs ?? resolveStandardTargetLufs(standard)
    const maxTruePeakDbTp = profile?.maxTruePeakDbTp ?? -1.0
    const allowPeakClamping = profile?.allowPeakClamping ?? false

    // Pass 1: Non-destructive integrated loudness probe
    const pass1MeasuredLufs = measureIntegratedLufs(buffer)
    if (pass1MeasuredLufs <= -69.5) {
        return {
            calibratedBuffer: Buffer.from(buffer),
            report: {
                status: 'FAILED',
                filePath: '',
                standard,
                pass1MeasuredLufs,
                pass2CalibratedLufs: pass1MeasuredLufs,
                appliedGainDb: 0,
                postCalibrationPeakDbTp: -90.0,
                error: 'SILENT_OR_INVALID_WAV_DATA_CHUNK',
            },
        }
    }

    const appliedGainDb = Number((targetLufs - pass1MeasuredLufs).toFixed(2))
    const gainScalar = Math.pow(10, appliedGainDb / 20.0)
    const ceilingLinear = Math.pow(10, maxTruePeakDbTp / 20.0)

    const outBuffer = Buffer.from(buffer)
    let offset = 12
    let maxScaledAbs = 0

    while (offset < outBuffer.length - 8) {
        const chunkId = outBuffer.toString('ascii', offset, offset + 4)
        const chunkSize = outBuffer.readUInt32LE(offset + 4)
        if (chunkId === 'data') {
            const dataStart = offset + 8
            const dataEnd = Math.min(outBuffer.length, dataStart + chunkSize)

            for (let i = dataStart; i <= dataEnd - 2; i += 2) {
                const rawFloat = outBuffer.readInt16LE(i) / 32768.0
                let scaled = rawFloat * gainScalar

                if (Math.abs(scaled) > ceilingLinear) {
                    if (!allowPeakClamping) {
                        const projectedPeakDb = Number(
                            (20 * Math.log10(Math.abs(scaled))).toFixed(2),
                        )
                        return {
                            calibratedBuffer: buffer,
                            report: {
                                status: 'CALIBRATION_CLIPPING_BREACH',
                                filePath: '',
                                standard,
                                pass1MeasuredLufs,
                                pass2CalibratedLufs: pass1MeasuredLufs,
                                appliedGainDb,
                                postCalibrationPeakDbTp: projectedPeakDb,
                                error: `CALIBRATION_CLIPPING_BREACH: Projected peak ${projectedPeakDb} dBTP breaches ceiling ${maxTruePeakDbTp} dBTP.`,
                            },
                        }
                    }
                    scaled = Math.sign(scaled) * ceilingLinear
                }

                const absScaled = Math.abs(scaled)
                if (absScaled > maxScaledAbs) maxScaledAbs = absScaled

                const clampedInt16 = Math.max(
                    -32768,
                    Math.min(32767, Math.round(scaled * 32767.0)),
                )
                outBuffer.writeInt16LE(clampedInt16, i)
            }
            break
        }
        offset += 8 + chunkSize
    }

    const pass2CalibratedLufs = measureIntegratedLufs(outBuffer)
    const postCalibrationPeakDbTp =
        maxScaledAbs > 0
            ? Number((20 * Math.log10(maxScaledAbs)).toFixed(2))
            : -90.0

    return {
        calibratedBuffer: outBuffer,
        report: {
            status: 'CALIBRATED',
            filePath: '',
            standard,
            pass1MeasuredLufs,
            pass2CalibratedLufs,
            appliedGainDb,
            postCalibrationPeakDbTp,
        },
    }
}

export const auditLoudness = async (
    cpy: LoudnessModel,
    bal: LoudnessBit,
    ste?: State,
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
            const err = `LOUDNESS_DEVIATION_BREACH: Measured ${measuredLufs} LUFS exceeds target ${targetLufs} LUFS (tol +/-${tolerance} LUFS)`
            await logConsole(ste, `:: [FAIL] [LOUDNESS] ${err}`)
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
                ste,
                `>> [OK] [LOUDNESS] Measured ${measuredLufs} LUFS matches target ${targetLufs} LUFS`,
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
        await logConsole(ste, `:: [FAIL] [LOUDNESS] Read failure: ${cleanErr}`)
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

export const calibrateLoudnessTwoPass = async (
    cpy: LoudnessModel,
    bal: LoudnessBit,
    ste?: State,
): Promise<LoudnessModel> => {
    const dat = bal.dat
    const filePath = dat?.filePath || 'in_memory_buffer.wav'

    try {
        const sourceBuffer =
            dat?.pcmBuffer ||
            (dat?.filePath ? fs.readFileSync(dat.filePath) : undefined)
        if (!sourceBuffer) {
            bal.calibrationResult = {
                status: 'FAILED',
                filePath,
                standard: dat?.profile?.standard || cpy.activeStandard,
                pass1MeasuredLufs: -99,
                pass2CalibratedLufs: -99,
                appliedGainDb: 0,
                postCalibrationPeakDbTp: -99,
                error: 'MISSING_PCM_BUFFER_OR_FILE',
            }
            await logConsole(
                ste,
                ':: [CALIBRATE:FAIL] Missing PCM buffer or valid WAV path.',
            )
            if (bal.slv) bal.slv({ ldnBit: bal })
            return cpy
        }

        const effectiveProfile: LoudnessTargetProfile = {
            targetLufs:
                dat?.profile?.targetLufs ??
                resolveStandardTargetLufs(
                    dat?.profile?.standard || cpy.activeStandard,
                ),
            toleranceLufs: dat?.profile?.toleranceLufs ?? 1.0,
            maxTruePeakDbTp: dat?.profile?.maxTruePeakDbTp ?? -1.0,
            standard: dat?.profile?.standard || cpy.activeStandard,
            allowPeakClamping: dat?.profile?.allowPeakClamping ?? false,
        }

        const { calibratedBuffer, report } = normalizePcmToTargetLufs(
            sourceBuffer,
            effectiveProfile,
        )
        report.filePath = filePath
        bal.calibrationResult = report

        if (report.status === 'CALIBRATED') {
            bal.calibratedBuffer = calibratedBuffer
            if (dat?.outputPath) {
                const tmpPath = `${dat.outputPath}.tmp`
                fs.writeFileSync(tmpPath, calibratedBuffer)
                fs.renameSync(tmpPath, dat.outputPath)
            }
            cpy.calibrationsCompleted += 1
            await logConsole(
                ste,
                `>> [CALIBRATE:OK] Pass1: ${report.pass1MeasuredLufs} LUFS -> Pass2: ${report.pass2CalibratedLufs} LUFS (Gain: ${report.appliedGainDb} dB | Peak: ${report.postCalibrationPeakDbTp} dBTP)`,
            )
        } else {
            await logConsole(ste, `:: [CALIBRATE:FAIL] ${report.error}`)
        }
    } catch (err: any) {
        const cleanErr = (err?.message || 'CALIBRATION_EXECUTION_ERROR').slice(
            0,
            150,
        )
        bal.calibrationResult = {
            status: 'FAILED',
            filePath,
            standard: dat?.profile?.standard || cpy.activeStandard,
            pass1MeasuredLufs: -99,
            pass2CalibratedLufs: -99,
            appliedGainDb: 0,
            postCalibrationPeakDbTp: -99,
            error: cleanErr,
        }
        await logConsole(ste, `:: [CALIBRATE:FAIL] ${cleanErr}`)
    }

    if (bal.slv) bal.slv({ ldnBit: bal })
    return cpy
}
