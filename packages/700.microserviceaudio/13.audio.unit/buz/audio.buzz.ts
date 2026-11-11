import fs from 'fs'
import type { AudioModel } from '../audio.model.js'
import type AudioBit from '../fce/audio.bit.js'
import type State from '../../99.core/state.js'

// --- MOCK logConsole to satisfy dependencies ---
// In a real implementation this would probably import a logging utility
const logConsole = async (ste: any, message: string) => {
  if (ste?.hunt) {
    await ste.hunt('[Console action] Update Console', { idx: 'cns00', val: 1, src: message })
  }
}

/**
 * Converts a 16-bit linear PCM Buffer to a normalized Float32Array [-1.0, 1.0].
 */
export const pcmBufferToFloat32 = (buffer: Buffer): Float32Array => {
  const floats = new Float32Array(buffer.length / 2)
  for (let i = 0; i < floats.length; i++) {
    const int16 = buffer.readInt16LE(i * 2)
    floats[i] = int16 / 32768.0
  }
  return floats
}

/**
 * Converts a normalized Float32Array [-1.0, 1.0] back to a 16-bit linear PCM Buffer.
 */
export const float32ToPcmBuffer = (floats: Float32Array): Buffer => {
  const buffer = Buffer.alloc(floats.length * 2)
  for (let i = 0; i < floats.length; i++) {
    let s = Math.max(-1, Math.min(1, floats[i]))
    const int16 = s < 0 ? s * 32768 : s * 32767
    buffer.writeInt16LE(Math.round(int16), i * 2)
  }
  return buffer
}

/**
 * Measures the unvoiced RMS noise floor in dBFS across low-energy frames.
 */
export const auditUnvoicedNoiseFloor = (
  samples: Float32Array,
  ceilingDbfs: number = -60.0,
): { measuredNoiseFloorDbfs: number; isWithinCeiling: boolean } => {
  const windowSize = 480 // 10ms at 48kHz
  const rmsEnergies: number[] = []

  for (let i = 0; i + windowSize <= samples.length; i += windowSize) {
    let sumSq = 0
    for (let j = 0; j < windowSize; j++) {
      const s = samples[i + j]
      sumSq += s * s
    }
    const rms = Math.sqrt(sumSq / windowSize)
    if (rms > 1e-7) {
      rmsEnergies.push(rms)
    }
  }

  if (rmsEnergies.length === 0) {
    return { measuredNoiseFloorDbfs: -96.0, isWithinCeiling: true }
  }

  // Sort energies to find bottom 10th percentile (true unvoiced silence noise floor)
  rmsEnergies.sort((a, b) => a - b)
  const noiseFloorRms = rmsEnergies[Math.floor(rmsEnergies.length * 0.1)] || 1e-7
  const measuredNoiseFloorDbfs = 20 * Math.log10(noiseFloorRms)

  return {
    measuredNoiseFloorDbfs,
    isWithinCeiling: measuredNoiseFloorDbfs < ceilingDbfs,
  }
}

/**
 * WSOLA pitch-flattening simulation: normalizes pitch variations to a static 120.0 Hz monotone.
 */
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
      const windowGain = 0.5 * (1 - Math.cos((2 * Math.PI * k) / windowLength))
      const sample = samples[n + (k % targetPeriodSamples)]
      output[n + k] += sample * windowGain
    }
  }

  // Normalization pass to preserve signal amplitude
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

/**
 * Linear Predictive Coding (LPC) Formant Flattener via Levinson-Durbin inverse filtering.
 */
export const flattenFormantsLpc = (
  samples: Float32Array,
  order: number = 16,
): Float32Array => {
  const output = new Float32Array(samples.length)
  const frameLength = 512
  const hopLength = 256

  for (let i = 0; i + frameLength <= samples.length; i += hopLength) {
    // 1. Compute Autocorrelation R[0..order]
    const R = new Float64Array(order + 1)
    for (let k = 0; k <= order; k++) {
      let sum = 0
      for (let n = 0; n < frameLength - k; n++) {
        sum += samples[i + n] * samples[i + n + k]
      }
      R[k] = sum
    }

    if (R[0] < 1e-9) {
      // Near zero frame; pass samples through
      for (let n = 0; n < hopLength; n++) {
        output[i + n] = samples[i + n]
      }
      continue
    }

    // 2. Levinson-Durbin Recursion to calculate LPC coefficients a_k
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

    // 3. Inverse FIR Filter: e[n] = s[n] + sum_{k=1}^order a[k] * s[n-k]
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

export const initAudio = (cpy: AudioModel, bal: AudioBit, _ste?: State): AudioModel => {
  cpy.filesProcessed = 0
  cpy.spectralInversionsCompleted = 0
  cpy.lastMetrics = null
  if (bal.slv) bal.slv({ audBit: { idx: 'init-audio', val: 1 } })
  return cpy
}

export const updateAudio = (cpy: AudioModel, bal: AudioBit, _ste?: State): AudioModel => {
  if (bal.idx) cpy.audioBits[bal.idx] = bal
  if (bal.slv) bal.slv({ audBit: bal })
  return cpy
}

export const executeSpectralInversion = async (
  cpy: AudioModel,
  bal: AudioBit,
  ste?: State,
): Promise<AudioModel> => {
  const payload = bal.dat
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
  const ceilingDbfs = payload?.noiseFloorCeilingDbfs || cpy.noiseFloorCeilingDbfs

  const floatSamples = pcmBufferToFloat32(pcm)

  // 1. Audit unvoiced noise floor sentry
  const noiseAudit = auditUnvoicedNoiseFloor(floatSamples, ceilingDbfs)
  if (!noiseAudit.isWithinCeiling) {
    bal.result = {
      status: 'NOISE_FLOOR_BREACH',
      metrics: {
        originalSampleRateHz: sampleRate,
        targetPitchHz: targetPitch,
        lpcOrder,
        measuredUnvoicedNoiseFloorDbfs: noiseAudit.measuredNoiseFloorDbfs,
        isFormantsNeutralized: false,
        isPitchFlattened: false,
      },
      error: `NOISE_FLOOR_BREACH: Unvoiced noise floor [${noiseAudit.measuredNoiseFloorDbfs.toFixed(1)} dBFS] breaches ceiling [${ceilingDbfs} dBFS].`,
    }
    await logConsole(ste, `:: [AUDIO:FAIL] ${bal.result.error}`)
    if (bal.slv) bal.slv({ audBit: bal })
    return cpy
  }

  // 2. Flatten fundamental pitch via WSOLA simulation
  const pitchFlattened = flattenPitchWsola(floatSamples, targetPitch, sampleRate)

  // 3. Neutralize formants via LPC inverse filtering
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
