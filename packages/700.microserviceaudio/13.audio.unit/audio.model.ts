import type Audio from './fce/audio.interface.js'
import type { SpectralInversionMetrics } from './fce/audio.interface.js'
import type AudioBit from './fce/audio.bit.js'

export class AudioModel implements Audio {
  idx: string = '13.audio'
  monotoneTargetPitchHz: number = 120.0
  lpcOrder: number = 16
  noiseFloorCeilingDbfs: number = -60.0
  filesProcessed: number = 0
  spectralInversionsCompleted: number = 0
  lastMetrics: SpectralInversionMetrics | null = null
  audioBits: Record<string, AudioBit> = {}
}
