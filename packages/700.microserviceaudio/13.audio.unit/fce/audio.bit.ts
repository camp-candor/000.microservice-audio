import type { SpectralInversionMetrics } from './audio.interface.js'

export interface AudioRedactionPayload {
  filePath?: string
  pcmBuffer?: Buffer
  sampleRateHz?: number
  targetPitchHz?: number
  lpcOrder?: number
  noiseFloorCeilingDbfs?: number
}

export interface AudioRedactionResult {
  status: 'PASSED' | 'FAILED' | 'NOISE_FLOOR_BREACH'
  metrics: SpectralInversionMetrics
  redactedPcmBuffer?: Buffer
  error?: string
}

export default interface AudioBit {
  idx: string
  src?: string
  val?: number
  dat?: AudioRedactionPayload
  result?: AudioRedactionResult
  slv?: (result: { audBit: AudioBit }) => void
}
