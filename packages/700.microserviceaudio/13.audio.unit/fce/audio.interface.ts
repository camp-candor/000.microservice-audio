import type AudioBit from './audio.bit.js'

export interface SpectralInversionMetrics {
  originalSampleRateHz: number
  targetPitchHz: number
  lpcOrder: number
  measuredUnvoicedNoiseFloorDbfs: number
  isFormantsNeutralized: boolean
  isPitchFlattened: boolean
}

export default interface Audio {
  idx: string
  monotoneTargetPitchHz: number
  lpcOrder: number
  noiseFloorCeilingDbfs: number
  filesProcessed: number
  spectralInversionsCompleted: number
  lastMetrics: SpectralInversionMetrics | null
  audioBits: Record<string, AudioBit>
}
