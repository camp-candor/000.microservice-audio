import fs from 'node:fs'
import { VerificationModel } from '../verification.model.js'
import type VerificationBit from '../fce/verification.bit.js'
import type { ConformanceFirewallPayload } from '../fce/verification.bit.js'
import type {
    ConformanceGateVerdict,
    VerificationReport,
} from '../fce/verification.interface.js'
import { applySpectralFilter } from '../../11.filter.unit/buz/filter.buzz.js'
import { FilterModel } from '../../11.filter.unit/filter.model.js'
import { applyDynamicDeesser } from '../../16.deesser.unit/buz/deesser.buzz.js'
import { DeesserModel } from '../../16.deesser.unit/deesser.model.js'
import { auditLoudness } from '../../01.loudness.unit/buz/loudness.buzz.js'
import { LoudnessModel } from '../../01.loudness.unit/loudness.model.js'
import { auditPeaks } from '../../02.peaks.unit/buz/peaks.buzz.js'
import { PeaksModel } from '../../02.peaks.unit/peaks.model.js'
import {
    pcmBufferToFloat32,
    auditUnvoicedNoiseFloor,
} from '../../13.audio.unit/buz/audio.buzz.js'
import { verifyTranscriptionParity } from '../../06.transcription.unit/buz/transcription.buzz.js'
import { TranscriptionModel } from '../../06.transcription.unit/transcription.model.js'
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

/**
 * Extracts raw PCM payload bytes following the standard 44-byte RIFF/WAVE header.
 */
const extractPcmDataSlice = (wavBuffer: Buffer): Buffer => {
    let offset = 12
    while (offset < wavBuffer.length - 8) {
        const chunkId = wavBuffer.toString('ascii', offset, offset + 4)
        const chunkSize = wavBuffer.readUInt32LE(offset + 4)
        if (chunkId === 'data') {
            const start = offset + 8
            const end = Math.min(wavBuffer.length, start + chunkSize)
            return wavBuffer.subarray(start, end)
        }
        offset += 8 + chunkSize
    }
    return wavBuffer.length > 44 ? wavBuffer.subarray(44) : wavBuffer
}

/**
 * Unlinks failed .wav stem and any sibling .tmp staging buffer from disk.
 */
export const unlinkQuarantinedStem = (filePath: string): boolean => {
    let unlinked = false
    const candidates = [filePath, `${filePath}.tmp`]
    for (const target of candidates) {
        if (target && fs.existsSync(target)) {
            try {
                fs.unlinkSync(target)
                unlinked = true
            } catch {
                // Defensive unlink protection
            }
        }
    }
    return unlinked
}

/**
 * Executes the sequential 6-stage signal hygiene and broadcast conformance gauntlet.
 */
export const executeSixStageGauntlet = async (
    payload: ConformanceFirewallPayload,
    ste?: State,
): Promise<{ report: VerificationReport; conformedBuffer?: Buffer }> => {
    const {
        filePath,
        expectedText,
        sampleRateHz = 48000,
        targetLufs = -16.0,
        toleranceLufs = 1.0,
        maxTruePeakDbTp = -1.0,
        noiseFloorCeilingDbfs = -60.0,
        unlinkOnFailure = true,
    } = payload

    const verdicts: ConformanceGateVerdict[] = []

    const failAndQuarantine = async (
        failedVerdict: ConformanceGateVerdict,
        skippedGates: Array<{
            gate: ConformanceGateVerdict['gate']
            unit: string
        }>,
    ): Promise<{ report: VerificationReport }> => {
        verdicts.push(failedVerdict)
        for (const s of skippedGates) {
            verdicts.push({
                gate: s.gate,
                unit: s.unit,
                status: 'SKIPPED',
                metricSummary: 'SKIPPED_DUE_TO_UPSTREAM_BREACH',
            })
        }

        const quarantinedUnlinked = unlinkOnFailure
            ? unlinkQuarantinedStem(filePath)
            : false

        if (quarantinedUnlinked) {
            await logConsole(
                ste,
                `:: [QUARANTINE] Unlinked non-conforming stem from disk: ${filePath}`,
            )
        }

        const passedCount = verdicts.filter((v) => v.status === 'PASSED').length
        const report: VerificationReport = {
            status: 'FAILED',
            filePath,
            gatesPassedCount: passedCount,
            totalGatesCount: 6,
            gateVerdicts: verdicts,
            quarantinedUnlinked,
            failedGate: failedVerdict.gate,
            error: failedVerdict.error,
        }

        return { report }
    }

    // Acquire initial WAV buffer
    let activeBuffer: Buffer | undefined = payload.pcmBuffer
    if (!activeBuffer && filePath && fs.existsSync(filePath)) {
        activeBuffer = fs.readFileSync(filePath)
    }

    if (!activeBuffer) {
        return failAndQuarantine(
            {
                gate: 'SPECTRAL_FILTER',
                unit: '11.filter.unit',
                status: 'FAILED',
                metricSummary: 'MISSING_BUFFER',
                error: `MISSING_STEM_BUFFER: ${filePath}`,
            },
            [
                { gate: 'DYNAMIC_DEESSER', unit: '16.deesser.unit' },
                { gate: 'INTEGRATED_LOUDNESS', unit: '01.loudness.unit' },
                { gate: 'TRUE_PEAK_CEILING', unit: '02.peaks.unit' },
                { gate: 'UNVOICED_NOISE_FLOOR', unit: '13.audio.unit' },
                { gate: 'TRANSCRIPTION_PARITY', unit: '06.transcription.unit' },
            ],
        )
    }

    // --------------------------------------------------------------------------
    // GATE 1: 11.filter.unit (DC Offset Stripper + 4th-Order Butterworth HPF)
    // --------------------------------------------------------------------------
    const filterBit: any = {
        idx: 'gate-1-filter',
        dat: {
            filePath,
            pcmBuffer: activeBuffer,
            profile: { cutoffHz: 85, enableDcStripper: true, sampleRateHz },
        },
    }
    await applySpectralFilter(new FilterModel(), filterBit, ste)
    if (filterBit.result?.status !== 'PASSED') {
        return failAndQuarantine(
            {
                gate: 'SPECTRAL_FILTER',
                unit: '11.filter.unit',
                status: 'FAILED',
                metricSummary: 'FILTER_FAILED',
                error: filterBit.result?.error || 'SPECTRAL_FILTER_GATE_BREACH',
            },
            [
                { gate: 'DYNAMIC_DEESSER', unit: '16.deesser.unit' },
                { gate: 'INTEGRATED_LOUDNESS', unit: '01.loudness.unit' },
                { gate: 'TRUE_PEAK_CEILING', unit: '02.peaks.unit' },
                { gate: 'UNVOICED_NOISE_FLOOR', unit: '13.audio.unit' },
                { gate: 'TRANSCRIPTION_PARITY', unit: '06.transcription.unit' },
            ],
        )
    }
    if (filterBit.filteredBuffer) activeBuffer = filterBit.filteredBuffer
    verdicts.push({
        gate: 'SPECTRAL_FILTER',
        unit: '11.filter.unit',
        status: 'PASSED',
        metricSummary: `HPF 85Hz | LowEnd -${filterBit.result.lowEndAttenuatedDb} dB`,
    })

    // --------------------------------------------------------------------------
    // GATE 2: 16.deesser.unit (6-8 kHz Dynamic De-Esser + 22 kHz Ultrasonic LPF)
    // --------------------------------------------------------------------------
    const deesserBit: any = {
        idx: 'gate-2-deesser',
        dat: {
            filePath,
            pcmBuffer: activeBuffer,
            profile: {
                bandStartHz: 6000,
                bandEndHz: 8000,
                thresholdDbfs: -18.0,
                sampleRateHz,
            },
        },
    }
    await applyDynamicDeesser(new DeesserModel(), deesserBit, ste)
    if (deesserBit.result?.status !== 'PASSED') {
        return failAndQuarantine(
            {
                gate: 'DYNAMIC_DEESSER',
                unit: '16.deesser.unit',
                status: 'FAILED',
                metricSummary: 'DEESSER_FAILED',
                error:
                    deesserBit.result?.error || 'DYNAMIC_DEESSER_GATE_BREACH',
            },
            [
                { gate: 'INTEGRATED_LOUDNESS', unit: '01.loudness.unit' },
                { gate: 'TRUE_PEAK_CEILING', unit: '02.peaks.unit' },
                { gate: 'UNVOICED_NOISE_FLOOR', unit: '13.audio.unit' },
                { gate: 'TRANSCRIPTION_PARITY', unit: '06.transcription.unit' },
            ],
        )
    }
    if (deesserBit.deessedBuffer) activeBuffer = deesserBit.deessedBuffer
    verdicts.push({
        gate: 'DYNAMIC_DEESSER',
        unit: '16.deesser.unit',
        status: 'PASSED',
        metricSummary: `Events: ${deesserBit.result.sibilanceEventsDetected} | MaxRed: -${deesserBit.result.maxReductionDb} dB`,
    })

    // --------------------------------------------------------------------------
    // GATE 3: 01.loudness.unit (EBU R128 / ATSC A/85 Integrated Loudness Audit)
    // --------------------------------------------------------------------------
    const loudnessBit: any = {
        idx: 'gate-3-loudness',
        dat: {
            filePath,
            pcmBuffer: activeBuffer,
            profile: { targetLufs, toleranceLufs },
        },
    }
    await auditLoudness(new LoudnessModel(), loudnessBit, ste)
    if (loudnessBit.result?.status !== 'PASSED') {
        return failAndQuarantine(
            {
                gate: 'INTEGRATED_LOUDNESS',
                unit: '01.loudness.unit',
                status: 'FAILED',
                metricSummary: `Measured ${loudnessBit.result?.measuredLufs ?? -99} LUFS`,
                error:
                    loudnessBit.result?.error ||
                    'INTEGRATED_LOUDNESS_GATE_BREACH',
            },
            [
                { gate: 'TRUE_PEAK_CEILING', unit: '02.peaks.unit' },
                { gate: 'UNVOICED_NOISE_FLOOR', unit: '13.audio.unit' },
                { gate: 'TRANSCRIPTION_PARITY', unit: '06.transcription.unit' },
            ],
        )
    }
    verdicts.push({
        gate: 'INTEGRATED_LOUDNESS',
        unit: '01.loudness.unit',
        status: 'PASSED',
        metricSummary: `${loudnessBit.result.measuredLufs} LUFS (Target ${targetLufs})`,
    })

    // --------------------------------------------------------------------------
    // GATE 4: 02.peaks.unit (Brickwall True-Peak Ceiling Audit <= -1.0 dBTP)
    // --------------------------------------------------------------------------
    const peaksBit: any = {
        idx: 'gate-4-peaks',
        dat: {
            filePath,
            pcmBuffer: activeBuffer,
            maxTruePeakDbTp,
        },
    }
    await auditPeaks(new PeaksModel(), peaksBit, ste)
    if (peaksBit.result?.status !== 'PASSED') {
        return failAndQuarantine(
            {
                gate: 'TRUE_PEAK_CEILING',
                unit: '02.peaks.unit',
                status: 'FAILED',
                metricSummary: `Peak ${peaksBit.result?.measuredPeakDbTp ?? 0} dBTP`,
                error:
                    peaksBit.result?.error || 'TRUE_PEAK_CEILING_GATE_BREACH',
            },
            [
                { gate: 'UNVOICED_NOISE_FLOOR', unit: '13.audio.unit' },
                { gate: 'TRANSCRIPTION_PARITY', unit: '06.transcription.unit' },
            ],
        )
    }
    verdicts.push({
        gate: 'TRUE_PEAK_CEILING',
        unit: '02.peaks.unit',
        status: 'PASSED',
        metricSummary: `${peaksBit.result.measuredPeakDbTp} dBTP (Ceiling ${maxTruePeakDbTp})`,
    })

    // --------------------------------------------------------------------------
    // GATE 5: 13.audio.unit (Unvoiced Silence RMS Noise Floor Sentry < -60.0 dBFS)
    // --------------------------------------------------------------------------
    const rawPcmSlice = extractPcmDataSlice(activeBuffer!)
    const floatSamples = pcmBufferToFloat32(rawPcmSlice)
    const noiseAudit = auditUnvoicedNoiseFloor(
        floatSamples,
        noiseFloorCeilingDbfs,
    )

    if (!noiseAudit.isWithinCeiling) {
        return failAndQuarantine(
            {
                gate: 'UNVOICED_NOISE_FLOOR',
                unit: '13.audio.unit',
                status: 'FAILED',
                metricSummary: `Noise ${noiseAudit.measuredNoiseFloorDbfs.toFixed(1)} dBFS`,
                error: `NOISE_FLOOR_BREACH: Unvoiced noise floor ${noiseAudit.measuredNoiseFloorDbfs.toFixed(1)} dBFS exceeds ${noiseFloorCeilingDbfs} dBFS`,
            },
            [{ gate: 'TRANSCRIPTION_PARITY', unit: '06.transcription.unit' }],
        )
    }
    verdicts.push({
        gate: 'UNVOICED_NOISE_FLOOR',
        unit: '13.audio.unit',
        status: 'PASSED',
        metricSummary: `${noiseAudit.measuredNoiseFloorDbfs.toFixed(1)} dBFS (< ${noiseFloorCeilingDbfs})`,
    })

    // --------------------------------------------------------------------------
    // GATE 6: 06.transcription.unit (Zero-Byte RIFF/WAVE Sentinel & Script Parity)
    // --------------------------------------------------------------------------
    const trnBit: any = {
        idx: 'gate-6-transcription',
        dat: {
            filePath,
            expectedText,
            buffer: activeBuffer,
        },
    }
    await verifyTranscriptionParity(new TranscriptionModel(), trnBit, ste)
    if (trnBit.result?.status !== 'PASSED') {
        return failAndQuarantine(
            {
                gate: 'TRANSCRIPTION_PARITY',
                unit: '06.transcription.unit',
                status: 'FAILED',
                metricSummary: 'PARITY_OR_SENTINEL_FAILED',
                error:
                    trnBit.result?.error || 'TRANSCRIPTION_PARITY_GATE_BREACH',
            },
            [],
        )
    }
    verdicts.push({
        gate: 'TRANSCRIPTION_PARITY',
        unit: '06.transcription.unit',
        status: 'PASSED',
        metricSummary: `RIFF/WAVE ${trnBit.result.sentinel.byteLength}B | Parity OK`,
    })

    // Write conformed buffer back to disk atomically if filePath exists on disk
    if (filePath && fs.existsSync(filePath) && activeBuffer) {
        const tmpPath = `${filePath}.tmp`
        fs.writeFileSync(tmpPath, activeBuffer)
        fs.renameSync(tmpPath, filePath)
    }

    return {
        conformedBuffer: activeBuffer,
        report: {
            status: 'PASSED',
            filePath,
            gatesPassedCount: 6,
            totalGatesCount: 6,
            gateVerdicts: verdicts,
            quarantinedUnlinked: false,
        },
    }
}

export const initVerification = (
    cpy: VerificationModel,
    bal: VerificationBit,
    _ste?: State,
): VerificationModel => {
    cpy.auditsCompleted = 0
    cpy.stemsPassedCount = 0
    cpy.stemsQuarantinedCount = 0
    cpy.lastReport = null
    cpy.verificationBits = {}
    if (bal.slv) bal.slv({ vrfBit: { idx: 'init-verification', val: 1 } })
    return cpy
}

export const updateVerification = (
    cpy: VerificationModel,
    bal: VerificationBit,
    _ste?: State,
): VerificationModel => {
    if (bal.idx) cpy.verificationBits[bal.idx] = bal
    if (bal.slv) bal.slv({ vrfBit: bal })
    return cpy
}

export const runConformanceFirewall = async (
    cpy: VerificationModel,
    bal: VerificationBit,
    ste?: State,
): Promise<VerificationModel> => {
    const payload = bal.dat
    if (!payload || !payload.filePath) {
        bal.report = {
            status: 'FAILED',
            filePath: '',
            gatesPassedCount: 0,
            totalGatesCount: 6,
            gateVerdicts: [],
            quarantinedUnlinked: false,
            error: 'MISSING_CONFORMANCE_FIREWALL_PAYLOAD',
        }
        if (bal.slv) bal.slv({ vrfBit: bal })
        return cpy
    }

    const { report, conformedBuffer } = await executeSixStageGauntlet(
        payload,
        ste,
    )
    bal.report = report
    bal.conformedBuffer = conformedBuffer
    cpy.lastReport = report
    cpy.auditsCompleted += 1

    if (report.status === 'PASSED') {
        cpy.stemsPassedCount += 1
        await logConsole(
            ste,
            `>> [VERIFY:OK] 6/6 Conformance Gates PASSED for [${payload.filePath}]. Stem certified.`,
        )
    } else {
        cpy.stemsQuarantinedCount += 1
        await logConsole(
            ste,
            `:: [VERIFY:BREACH] Stem rejected at [${report.failedGate}] (${report.gatesPassedCount}/6 passed): ${report.error}`,
        )
    }

    if (bal.slv) bal.slv({ vrfBit: bal })
    return cpy
}
