import type { CharacterVoiceRecipe, SeriesVoiceManifest } from './profile.interface.js'

export type ReleaseMode = 'DRAFT' | 'BROADCAST'

export interface ProfileResolutionPayload {
  seriesId: string
  characterId: string
  emotionTag?: string
  releaseMode?: ReleaseMode
  vaultOverridePath?: string
}

export interface ProfileResolutionResult {
  status: 'RESOLVED' | 'DEGRADED_TO_BASE' | 'BREACH'
  seriesId: string
  characterId: string
  requestedEmotion?: string
  resolvedAudioPath: string
  resolvedEmbeddingPath?: string
  isFallback: boolean
  appliedDspDeltas?: {
    pitchShiftDeltaSemitones: number
    formantDeltaFactor: number
    pacingMultiplier: number
  }
  error?: string
}

export interface VaultAuditReport {
  status: 'PASSED' | 'FAILED'
  vaultRoot: string
  redundantLocalDirectoriesFound: string[]
  externalManifestAccessible: boolean
  error?: string
}

export default interface ProfileBit {
  idx: string
  src?: string
  val?: number
  dat?: ProfileResolutionPayload
  auditReport?: VaultAuditReport
  result?: ProfileResolutionResult
  slv?: (result: { prfBit: ProfileBit }) => void
}
