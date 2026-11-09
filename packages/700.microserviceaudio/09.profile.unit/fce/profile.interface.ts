import type ProfileBit from './profile.bit.js'

export interface CharacterVoiceRecipe {
  characterId: string
  displayName: string
  gender: 'masculine' | 'feminine' | 'neutral'
  defaultEngine: 'styletts2' | 'parler' | 'piper'
  baseTakePath: string
  latentEmbeddingPath?: string
  sampleRateHz: number
  basePitchShiftSemitones?: number
  baseFormantWarpingFactor?: number
  conditionVariants: Record<string, string | null>
  bannedCadences?: string[]
}

export interface SeriesVoiceManifest {
  seriesId: string
  version: string
  updatedAtUtc: string
  characters: Record<string, CharacterVoiceRecipe>
}

export default interface Profile {
  idx: string
  vaultRoot: string
  activeSeriesId: string
  cachedManifestPath: string
  lastMtimeMs: number
  cachedManifest: SeriesVoiceManifest | null
  profilesProcessed: number
  profileBits: Record<string, ProfileBit>
}
