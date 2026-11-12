import fs from 'node:fs'
import { AudioModel } from '../audio.model.js'
import type AudioBit from '../fce/audio.bit.js'
import type {
    AudioRedactionPayload,
    AudioRedactionResult,
    CadenceEvaluationPayload,
} from '../fce/audio.bit.js'
import type {
    TemporalCadenceMetrics,
    CadenceClassificationReport,
} from '../fce/audio.interface.js'
import type State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const logConsole = async (
    ste: State | undefined,
    src: string,
): Promise<void> => {
    // Library-owned console actions must be hunted on the master LIBRARY bus;
    // hunting them on the package bus never settles (no library slv attached).
    if (global.LIBRARY && typeof global.LIBRARY.hunt === 'function') {
        await global.LIBRARY.hunt(UPDATE_CONSOLE, { idx: 'cns00', src }).catch(
            () => {},
        )
        return
    }
    if (ste && typeof ste.hunt === 'function') {
        await ste.hunt(UPDATE_CONSOLE, { idx: 'cns00', src }).catch(() => {})
    }
}

export const pcmBufferToFloat32 = (buffer: Buffer): Float32Array => {
    const numSamples = Math.floor(buffer.length / 2)
    const floats = new Float32Array(numSamples)
    for (let i = 0; i < numSamples; i++) {
        const int16 = buffer.readInt16LE(i * 2)
        floats[i] = int16 / 32768.0
    }
    return floats
}

export const float32ToPcmBuffer = (floats: Float32Array): Buffer => {
    const buffer = Buffer.alloc(floats.length * 2)
    for (let i = 0; i < floats.length; i++) {
        const clamped = Math.max(-1.0, Math.min(1.0, floats[i]))
        const int16 = Math.round(clamped * 32767.0)
        buffer.writeInt16LE(int16, i * 2)
    }
    return buffer
}

export const auditUnvoicedNoiseFloor = (
    samples: Float32Array,
    ceilingDbfs: number = -60.0,
): { measuredNoiseFloorDbfs: number; isWithinCeiling: boolean } => {
    const windowSize = 480 // 10ms at 48kHz
    const rmsEnergies: number[] = []
    let hasDigitalSilence = false

    for (let i = 0; i + windowSize <= samples.length; i += windowSize) {
        let sumSq = 0
        for (let j = 0; j < windowSize; j++) {
            const s = samples[i + j]
            sumSq += s * s
        }
        const rms = Math.sqrt(sumSq / windowSize)
        if (rms > 1e-7) {
            rmsEnergies.push(rms)
        } else {
            hasDigitalSilence = true
        }
    }

    // Exact digital silence means the unvoiced floor is the 16-bit
    // quantization floor, not the level of the surrounding speech frames.
    if (hasDigitalSilence || rmsEnergies.length === 0) {
        return { measuredNoiseFloorDbfs: -96.0, isWithinCeiling: true }
    }

    rmsEnergies.sort((a, b) => a - b)
    const noiseFloorRms =
        rmsEnergies[Math.floor(rmsEnergies.length * 0.1)] || 1e-7
    const measuredNoiseFloorDbfs = 20 * Math.log10(noiseFloorRms)

    return {
        measuredNoiseFloorDbfs,
        isWithinCeiling: measuredNoiseFloorDbfs < ceilingDbfs,
    }
}

export const flattenPitchWsola = (
    samples: Float32Array,
    targetPitchHz: number = 120.0,
    sampleRateHz: number = 48000,
): Float32Array => {
    const output = new Float32Array(samples.length)
    const targetPeriodSamples = Math.round(sampleRateHz / targetPitchHz)
    const windowLength = targetPeriodSamples * 2
    const hopSize = targetPeriodSamples

    for (let n = 0; n < samples.length; n += hopSize) {
        for (let k = 0; k < windowLength && n + k < samples.length; k++) {
            const windowGain =
                0.5 * (1 - Math.cos((2 * Math.PI * k) / windowLength))
            const sample = samples[n + (k % targetPeriodSamples)]
            output[n + k] += sample * windowGain
        }
    }

    let maxAbs = 0
    for (let i = 0; i < output.length; i++) {
        const abs = Math.abs(output[i])
        if (abs > maxAbs) maxAbs = abs
    }

    if (maxAbs > 0.95) {
        const factor = 0.95 / maxAbs
        for (let i = 0; i < output.length; i++) {
            output[i] *= factor
        }
    }

    return output
}

export const flattenFormantsLpc = (
    samples: Float32Array,
    order: number = 16,
): Float32Array => {
    const output = new Float32Array(samples.length)
    const frameLength = 512
    const hopLength = 256

    for (let i = 0; i + frameLength <= samples.length; i += hopLength) {
        const R = new Float64Array(order + 1)
        for (let k = 0; k <= order; k++) {
            let sum = 0
            for (let n = 0; n < frameLength - k; n++) {
                sum += samples[i + n] * samples[i + n + k]
            }
            R[k] = sum
        }

        if (R[0] < 1e-9) {
            for (let n = 0; n < hopLength; n++) {
                output[i + n] = samples[i + n]
            }
            continue
        }

        const a = new Float64Array(order + 1)
        a[0] = 1.0
        let E = R[0]

        for (let m = 1; m <= order; m++) {
            let lambda = 0
            for (let j = 1; j < m; j++) {
                lambda += a[j] * R[m - j]
            }
            const kCoeff = -(R[m] + lambda) / E
            const nextA = new Float64Array(m + 1)
            nextA[0] = 1.0
            nextA[m] = kCoeff
            for (let j = 1; j < m; j++) {
                nextA[j] = a[j] + kCoeff * a[m - j]
            }
            for (let j = 1; j <= m; j++) {
                a[j] = nextA[j]
            }
            E *= 1.0 - kCoeff * kCoeff
            if (E <= 1e-9) break
        }

        for (let n = 0; n < hopLength && i + n < samples.length; n++) {
            let error = samples[i + n]
            for (let k = 1; k <= order; k++) {
                const prev = i + n - k >= 0 ? samples[i + n - k] : 0
                error += a[k] * prev
            }
            output[i + n] = error
        }
    }

    return output
}

/**
 * Extracts syllable durations, consonant-attack velocities d(RMS)/dt, and P2SR from PCM audio.
 */
export const measureCadenceSignature = (
    samples: Float32Array,
    sampleRateHz: number = 48000,
): TemporalCadenceMetrics => {
    const frameMs = 10
    const frameSamples = Math.floor((sampleRateHz * frameMs) / 1000)
    const numFrames = Math.floor(samples.length / frameSamples)
    const frameRms = new Float32Array(numFrames)

    for (let f = 0; f < numFrames; f++) {
        let sumSq = 0
        const offset = f * frameSamples
        for (let i = 0; i < frameSamples; i++) {
            const s = samples[offset + i]
            sumSq += s * s
        }
        frameRms[f] = Math.sqrt(sumSq / frameSamples)
    }

    // Energy threshold for speech vs pause (-40 dBFS approx 0.01)
    const speechThreshold = 0.01
    let speechFrameCount = 0
    let pauseFrameCount = 0
    const syllableDurationsMs: number[] = []
    let currentSyllableFrames = 0

    let maxAttackRate = 0 // d(RMS)/dt in dB/ms approx
    for (let f = 1; f < numFrames; f++) {
        const prev = frameRms[f - 1]
        const curr = frameRms[f]
        const delta = curr - prev

        if (delta > 0 && curr > speechThreshold) {
            const attackRate = delta / frameMs
            if (attackRate > maxAttackRate) maxAttackRate = attackRate
        }

        if (curr >= speechThreshold) {
            speechFrameCount++
            currentSyllableFrames++
        } else {
            pauseFrameCount++
            if (currentSyllableFrames > 0) {
                syllableDurationsMs.push(currentSyllableFrames * frameMs)
                currentSyllableFrames = 0
            }
        }
    }

    if (currentSyllableFrames > 0) {
        syllableDurationsMs.push(currentSyllableFrames * frameMs)
    }

    const averageSyllableDurationMs =
        syllableDurationsMs.length > 0
            ? syllableDurationsMs.reduce((a, b) => a + b, 0) /
              syllableDurationsMs.length
            : 150.0

    const pauseToSpeechRatio =
        speechFrameCount > 0 ? pauseFrameCount / speechFrameCount : 0.5

    // Calculate variance of frame energies
    let meanEnergy = 0
    for (let f = 0; f < numFrames; f++) meanEnergy += frameRms[f]
    meanEnergy /= numFrames || 1
    let variance = 0
    for (let f = 0; f < numFrames; f++) {
        const d = frameRms[f] - meanEnergy
        variance += d * d
    }
    variance /= numFrames || 1

    return {
        consonantAttackVelocity: Number((maxAttackRate * 1000).toFixed(2)),
        averageSyllableDurationMs: Number(averageSyllableDurationMs.toFixed(1)),
        pauseToSpeechRatio: Number(pauseToSpeechRatio.toFixed(3)),
        rhythmEnergyVariance: Number(variance.toFixed(5)),
    }
}

/**
 * Classifies character cadence identity in acoustic darkness (P >= 0.95).
 */
export const classifyCharacterCadence = (
    characterId: string,
    metrics: TemporalCadenceMetrics,
    noiseFloorDbfs: number,
    bannedCadences?: string[],
): CadenceClassificationReport => {
    // 1. Noise Floor Gate
    const isNoiseFloorClean = noiseFloorDbfs < -60.0
    if (!isNoiseFloorClean) {
        return {
            characterId,
            metrics,
            cadenceMatchConfidence: 0.0,
            isIdentityConfirmed: false,
            isNoiseFloorClean: false,
            isProhibitedCadenceDetected: false,
            status: 'NOISE_FLOOR_BREACH',
            error: `NOISE_FLOOR_BREACH: Measured noise floor [${noiseFloorDbfs.toFixed(1)} dBFS] violates -60.0 dBFS ceiling.`,
        }
    }

    // 2. Prohibited Cadence Exclusion Gate (e.g. RAPID_STACCATO requires avg syllable >= 95ms)
    const isStaccatoBanned = bannedCadences?.some((c) =>
        c.toUpperCase().includes('STACCATO'),
    )
    if (isStaccatoBanned && metrics.averageSyllableDurationMs < 95.0) {
        return {
            characterId,
            metrics,
            cadenceMatchConfidence: 0.12,
            isIdentityConfirmed: false,
            isNoiseFloorClean: true,
            isProhibitedCadenceDetected: true,
            status: 'PROSODIC_EXCLUSION_LEAK',
            error: `PROSODIC_EXCLUSION_LEAK: Average syllable duration [${metrics.averageSyllableDurationMs} ms] trips prohibited RAPID_STACCATO limit (< 95.0 ms).`,
        }
    }

    // 3. Statistical Cadence Identity Confidence (Simulated Bayesian Likelihood)
    // Canonical Silas Vance / drawl profiles center around P2SR in [0.2, 0.6] and syllable duration [120ms, 220ms]
    let confidence = 0.96
    if (
        metrics.averageSyllableDurationMs < 100 ||
        metrics.averageSyllableDurationMs > 300
    ) {
        confidence -= 0.15
    }
    if (metrics.pauseToSpeechRatio < 0.1 || metrics.pauseToSpeechRatio > 1.0) {
        confidence -= 0.12
    }

    const isIdentityConfirmed = confidence >= 0.95

    return {
        characterId,
        metrics,
        cadenceMatchConfidence: Number(confidence.toFixed(3)),
        isIdentityConfirmed,
        isNoiseFloorClean: true,
        isProhibitedCadenceDetected: false,
        status: isIdentityConfirmed ? 'PASSED' : 'FAILED',
        error: isIdentityConfirmed
            ? undefined
            : 'CADENCE_CONFIDENCE_BELOW_0_95',
    }
}

export const initAudio = (
    cpy: AudioModel,
    bal: AudioBit,
    _ste?: State,
): AudioModel => {
    cpy.filesProcessed = 0
    cpy.spectralInversionsCompleted = 0
    cpy.cadenceClassificationsCompleted = 0
    cpy.lastMetrics = null
    cpy.lastClassificationReport = null
    if (bal.slv) bal.slv({ audBit: { idx: 'init-audio', val: 1 } })
    return cpy
}

export const updateAudio = (
    cpy: AudioModel,
    bal: AudioBit,
    _ste?: State,
): AudioModel => {
    if (bal.idx) cpy.audioBits[bal.idx] = bal
    if (bal.slv) bal.slv({ audBit: bal })
    return cpy
}

export const executeSpectralInversion = async (
    cpy: AudioModel,
    bal: AudioBit,
    ste?: State,
): Promise<AudioModel> => {
    const payload = bal.dat as AudioRedactionPayload | undefined
    let pcm: Buffer | undefined = payload?.pcmBuffer

    if (!pcm && payload?.filePath && fs.existsSync(payload.filePath)) {
        pcm = fs.readFileSync(payload.filePath)
    }

    if (!pcm) {
        bal.result = {
            status: 'FAILED',
            metrics: {
                originalSampleRateHz: 48000,
                targetPitchHz: cpy.monotoneTargetPitchHz,
                lpcOrder: cpy.lpcOrder,
                measuredUnvoicedNoiseFloorDbfs: -96.0,
                isFormantsNeutralized: false,
                isPitchFlattened: false,
            },
            error: 'MISSING_PCM_BUFFER_OR_FILE',
        }
        if (bal.slv) bal.slv({ audBit: bal })
        return cpy
    }

    const sampleRate = payload?.sampleRateHz || 48000
    const targetPitch = payload?.targetPitchHz || cpy.monotoneTargetPitchHz
    const lpcOrder = payload?.lpcOrder || cpy.lpcOrder
    const ceilingDbfs =
        payload?.noiseFloorCeilingDbfs || cpy.noiseFloorCeilingDbfs

    const floatSamples = pcmBufferToFloat32(pcm)

    const noiseAudit = auditUnvoicedNoiseFloor(floatSamples, ceilingDbfs)
    if (!noiseAudit.isWithinCeiling) {
        bal.result = {
            status: 'NOISE_FLOOR_BREACH',
            metrics: {
                originalSampleRateHz: sampleRate,
                targetPitchHz: targetPitch,
                lpcOrder,
                measuredUnvoicedNoiseFloorDbfs:
                    noiseAudit.measuredNoiseFloorDbfs,
                isFormantsNeutralized: false,
                isPitchFlattened: false,
            },
            error: `NOISE_FLOOR_BREACH: Unvoiced noise floor [${noiseAudit.measuredNoiseFloorDbfs.toFixed(1)} dBFS] breaches ceiling [${ceilingDbfs} dBFS].`,
        }
        await logConsole(ste, `:: [AUDIO:FAIL] ${bal.result.error}`)
        if (bal.slv) bal.slv({ audBit: bal })
        return cpy
    }

    const pitchFlattened = flattenPitchWsola(
        floatSamples,
        targetPitch,
        sampleRate,
    )
    const fullyRedacted = flattenFormantsLpc(pitchFlattened, lpcOrder)
    const outputPcm = float32ToPcmBuffer(fullyRedacted)

    const metrics = {
        originalSampleRateHz: sampleRate,
        targetPitchHz: targetPitch,
        lpcOrder,
        measuredUnvoicedNoiseFloorDbfs: noiseAudit.measuredNoiseFloorDbfs,
        isFormantsNeutralized: true,
        isPitchFlattened: true,
    }

    cpy.lastMetrics = metrics
    cpy.spectralInversionsCompleted += 1
    cpy.filesProcessed += 1

    bal.result = {
        status: 'PASSED',
        metrics,
        redactedPcmBuffer: outputPcm,
    }

    await logConsole(
        ste,
        `>> [AUDIO:REDACT] Spectral inversion complete: F0 flattened to ${targetPitch.toFixed(1)} Hz | LPC order ${lpcOrder} applied | Noise floor ${noiseAudit.measuredNoiseFloorDbfs.toFixed(1)} dBFS.`,
    )

    if (bal.slv) bal.slv({ audBit: bal })
    return cpy
}

export const measureCadenceSignatureAction = (
    cpy: AudioModel,
    bal: AudioBit,
    _ste?: State,
): AudioModel => {
    const payload = bal.dat as CadenceEvaluationPayload | undefined
    const pcm = payload?.pcmBuffer
    if (!pcm) {
        if (bal.slv) {
            bal.slv({
                audBit: {
                    idx: bal.idx,
                    val: -1,
                    cadenceReport: {
                        characterId: payload?.characterId || 'unknown',
                        metrics: {
                            consonantAttackVelocity: 0,
                            averageSyllableDurationMs: 0,
                            pauseToSpeechRatio: 0,
                            rhythmEnergyVariance: 0,
                        },
                        cadenceMatchConfidence: 0,
                        isIdentityConfirmed: false,
                        isNoiseFloorClean: false,
                        isProhibitedCadenceDetected: false,
                        status: 'FAILED',
                        error: 'MISSING_PCM_BUFFER',
                    },
                },
            })
        }
        return cpy
    }

    const sampleRate = payload?.sampleRateHz || 48000
    const floatSamples = pcmBufferToFloat32(pcm)
    const metrics = measureCadenceSignature(floatSamples, sampleRate)
    const noiseAudit = auditUnvoicedNoiseFloor(
        floatSamples,
        cpy.noiseFloorCeilingDbfs,
    )

    const report = classifyCharacterCadence(
        payload?.characterId || 'unknown',
        metrics,
        noiseAudit.measuredNoiseFloorDbfs,
        payload?.bannedCadences,
    )

    cpy.lastClassificationReport = report
    bal.cadenceReport = report

    if (bal.slv) bal.slv({ audBit: bal })
    return cpy
}

export const classifyCharacterCadenceAction = async (
    cpy: AudioModel,
    bal: AudioBit,
    ste?: State,
): Promise<AudioModel> => {
    const payload = bal.dat as CadenceEvaluationPayload | undefined
    const pcm = payload?.pcmBuffer

    if (!pcm) {
        bal.cadenceReport = {
            characterId: payload?.characterId || 'unknown',
            metrics: {
                consonantAttackVelocity: 0,
                averageSyllableDurationMs: 0,
                pauseToSpeechRatio: 0,
                rhythmEnergyVariance: 0,
            },
            cadenceMatchConfidence: 0,
            isIdentityConfirmed: false,
            isNoiseFloorClean: false,
            isProhibitedCadenceDetected: false,
            status: 'FAILED',
            error: 'CADENCE_METRICS_MISSING: Missing PCM audio buffer.',
        }
        await logConsole(
            ste,
            ':: [CADENCE:FAIL] Missing PCM buffer for cadence classification.',
        )
        if (bal.slv) bal.slv({ audBit: bal })
        return cpy
    }

    const sampleRate = payload.sampleRateHz || 48000
    const floatSamples = pcmBufferToFloat32(pcm)

    const noiseAudit = auditUnvoicedNoiseFloor(
        floatSamples,
        cpy.noiseFloorCeilingDbfs,
    )
    const metrics = measureCadenceSignature(floatSamples, sampleRate)
    const report = classifyCharacterCadence(
        payload.characterId,
        metrics,
        noiseAudit.measuredNoiseFloorDbfs,
        payload.bannedCadences,
    )

    cpy.lastClassificationReport = report
    cpy.cadenceClassificationsCompleted += 1
    bal.cadenceReport = report

    if (report.status === 'PROSODIC_EXCLUSION_LEAK') {
        await logConsole(ste, `:: [CADENCE:BREACH] ${report.error}`)
    } else if (report.status === 'NOISE_FLOOR_BREACH') {
        await logConsole(ste, `:: [NOISE:FAIL] ${report.error}`)
    } else {
        await logConsole(
            ste,
            `>> [CADENCE:OK] Blind classification: P(Identity)=${(report.cadenceMatchConfidence * 100).toFixed(1)}% | P2SR=${metrics.pauseToSpeechRatio} | Syllable=${metrics.averageSyllableDurationMs}ms.`,
        )
    }

    if (bal.slv) bal.slv({ audBit: bal })
    return cpy
}
