import fs from 'node:fs'
import path from 'node:path'
import { ProfileModel } from '../profile.model.js'
import type ProfileBit from '../fce/profile.bit.js'
import type {
  ProfileResolutionPayload,
  ProfileResolutionResult,
  VaultAuditReport,
} from '../fce/profile.bit.js'
import type { SeriesVoiceManifest, CharacterVoiceRecipe } from '../fce/profile.interface.js'
import type State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const logConsole = async (ste: State | undefined, src: string): Promise<void> => {
  if (ste && typeof ste.hunt === 'function') {
    await ste.hunt(UPDATE_CONSOLE, { idx: 'cns00', src }).catch(() => {})
  }
}

/**
 * Asserts zero local audio vault directories exist within 000.microservice-audio.
 */
export const assertZeroVaultRedundancy = (packageRoot: string): VaultAuditReport => {
  const repoRoot = path.resolve(packageRoot, '../..')
  const forbiddenSubpaths = [
    'voices/versions',
    'voices/active',
    'foley',
    'music',
    'packages/700.microserviceaudio/voices',
    'packages/700.microserviceaudio/foley',
    'packages/700.microserviceaudio/music',
  ]

  const redundantLocalDirectoriesFound: string[] = []

  for (const sub of forbiddenSubpaths) {
    const candidate = path.join(repoRoot, sub)
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      redundantLocalDirectoriesFound.push(sub)
    }
  }

  const passed = redundantLocalDirectoriesFound.length === 0

  return {
    status: passed ? 'PASSED' : 'FAILED',
    vaultRoot: repoRoot,
    redundantLocalDirectoriesFound,
    externalManifestAccessible: true,
    error: passed ? undefined : 'REDUNDANT_LOCAL_VAULT_POLLUTION_DETECTED',
  }
}

/**
 * Resolves the absolute filesystem path to the upstream series-assets-audio vault.
 */
export const resolveSeriesVaultPath = (seriesId: string, customRoot?: string): string => {
  if (customRoot && fs.existsSync(customRoot)) {
    return path.resolve(customRoot, 'voices', seriesId)
  }

  const defaultLocations = [
    path.resolve(process.cwd(), '../series-assets-audio/voices', seriesId),
    path.resolve(process.cwd(), '../../series-assets-audio/voices', seriesId),
    path.resolve(process.cwd(), 'node_modules/@camp_candor/series-assets-audio/voices', seriesId),
  ]

  for (const loc of defaultLocations) {
    if (fs.existsSync(loc)) {
      return loc
    }
  }

  // Fallback candidate path for test scaffolding
  return defaultLocations[0]
}

/**
 * Loads voice_manifest.json with filesystem mtimeMs cache invalidation.
 */
export const loadVoiceManifestCached = (
  model: ProfileModel,
  manifestPath: string,
): { manifest: SeriesVoiceManifest; reloaded: boolean } => {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`VOICE_MANIFEST_NOT_FOUND: ${manifestPath}`)
  }

  const stats = fs.statSync(manifestPath)
  const currentMtimeMs = stats.mtimeMs

  if (
    model.cachedManifest &&
    model.cachedManifestPath === manifestPath &&
    model.lastMtimeMs === currentMtimeMs
  ) {
    return { manifest: model.cachedManifest, reloaded: false }
  }

  const rawJson = fs.readFileSync(manifestPath, 'utf8')
  const parsed = JSON.parse(rawJson) as SeriesVoiceManifest

  model.cachedManifest = parsed
  model.cachedManifestPath = manifestPath
  model.lastMtimeMs = currentMtimeMs

  return { manifest: parsed, reloaded: true }
}

/**
 * Resolves character voice recipe and conditions with draft base_state fallback.
 */
export const resolveConditionedVoiceRecipe = (
  manifest: SeriesVoiceManifest,
  vaultSeriesDir: string,
  payload: ProfileResolutionPayload,
): ProfileResolutionResult => {
  const { seriesId, characterId, emotionTag, releaseMode = 'DRAFT' } = payload

  const recipe: CharacterVoiceRecipe | undefined = manifest.characters[characterId]
  if (!recipe) {
    return {
      status: 'BREACH',
      seriesId,
      characterId,
      requestedEmotion: emotionTag,
      resolvedAudioPath: '',
      isFallback: false,
      error: `UNKNOWN_CHARACTER_RECIPE: ${characterId}`,
    }
  }

  const baseAudioPath = path.resolve(vaultSeriesDir, recipe.baseTakePath)
  const baseEmbeddingPath = recipe.latentEmbeddingPath
    ? path.resolve(vaultSeriesDir, recipe.latentEmbeddingPath)
    : undefined

  // 1. If no specific emotion requested or emotion matches neutral baseline
  if (!emotionTag || emotionTag === 'neutral' || emotionTag === 'base_state') {
    return {
      status: 'RESOLVED',
      seriesId,
      characterId,
      requestedEmotion: emotionTag,
      resolvedAudioPath: baseAudioPath,
      resolvedEmbeddingPath: baseEmbeddingPath,
      isFallback: false,
    }
  }

  // 2. Lookup condition variant
  const variantTake = recipe.conditionVariants ? recipe.conditionVariants[emotionTag] : null

  if (typeof variantTake === 'string' && variantTake.trim().length > 0) {
    const variantAudioPath = path.resolve(vaultSeriesDir, variantTake)
    return {
      status: 'RESOLVED',
      seriesId,
      characterId,
      requestedEmotion: emotionTag,
      resolvedAudioPath: variantAudioPath,
      resolvedEmbeddingPath: baseEmbeddingPath,
      isFallback: false,
    }
  }

  // 3. Variant is unrecorded or explicitly null
  if (releaseMode === 'BROADCAST') {
    return {
      status: 'BREACH',
      seriesId,
      characterId,
      requestedEmotion: emotionTag,
      resolvedAudioPath: '',
      isFallback: false,
      error: `UNRECORDED_VARIANT_BROADCAST_BREACH: ${characterId}.${emotionTag}`,
    }
  }

  // 4. Draft fallback to base_state with algebraic DSP deltas
  const fallbackDeltas = {
    whisper: { pitchShiftDeltaSemitones: 1.5, formantDeltaFactor: 0.95, pacingMultiplier: 0.85 },
    shout: { pitchShiftDeltaSemitones: -2.0, formantDeltaFactor: 1.15, pacingMultiplier: 1.25 },
    tense: { pitchShiftDeltaSemitones: 0.5, formantDeltaFactor: 1.05, pacingMultiplier: 1.1 },
    exhausted: { pitchShiftDeltaSemitones: -1.0, formantDeltaFactor: 0.9, pacingMultiplier: 0.8 },
  } as Record<string, { pitchShiftDeltaSemitones: number; formantDeltaFactor: number; pacingMultiplier: number }>

  const appliedDspDeltas = fallbackDeltas[emotionTag] || {
    pitchShiftDeltaSemitones: 0.0,
    formantDeltaFactor: 1.0,
    pacingMultiplier: 1.0,
  }

  return {
    status: 'DEGRADED_TO_BASE',
    seriesId,
    characterId,
    requestedEmotion: emotionTag,
    resolvedAudioPath: baseAudioPath,
    resolvedEmbeddingPath: baseEmbeddingPath,
    isFallback: true,
    appliedDspDeltas,
  }
}

export const initProfile = (cpy: ProfileModel, bal: ProfileBit, _ste?: State): ProfileModel => {
  cpy.profilesProcessed = 0
  cpy.cachedManifest = null
  cpy.lastMtimeMs = 0
  cpy.cachedManifestPath = ''
  if (bal.slv) bal.slv({ prfBit: { idx: 'init-profile', val: 1 } })
  return cpy
}

export const updateProfile = (cpy: ProfileModel, bal: ProfileBit, _ste?: State): ProfileModel => {
  if (bal.idx) cpy.profileBits[bal.idx] = bal
  if (bal.slv) bal.slv({ prfBit: bal })
  return cpy
}

export const auditVaultBoundary = async (
  cpy: ProfileModel,
  bal: ProfileBit,
  ste?: State,
): Promise<ProfileModel> => {
  const packageRoot = path.resolve(process.cwd(), 'packages/700.microserviceaudio')
  const report = assertZeroVaultRedundancy(packageRoot)
  bal.auditReport = report

  await logConsole(
    ste,
    report.status === 'PASSED'
      ? '>> [VAULT:OK] Zero-redundancy workspace boundary verified. Zero local vault directories.'
      : `:: [VAULT:FAIL] Redundant local directories detected: ${report.redundantLocalDirectoriesFound.join(', ')}`,
  )

  if (bal.slv) bal.slv({ prfBit: bal })
  return cpy
}

export const resolveVoiceProfile = async (
  cpy: ProfileModel,
  bal: ProfileBit,
  ste?: State,
): Promise<ProfileModel> => {
  const payload = bal.dat
  if (!payload || !payload.characterId || !payload.seriesId) {
    bal.result = {
      status: 'BREACH',
      seriesId: payload?.seriesId || 'unknown',
      characterId: payload?.characterId || 'unknown',
      resolvedAudioPath: '',
      isFallback: false,
      error: 'MISSING_PROFILE_RESOLUTION_PAYLOAD',
    }
    if (bal.slv) bal.slv({ prfBit: bal })
    return cpy
  }

  try {
    const vaultSeriesDir = resolveSeriesVaultPath(payload.seriesId, payload.vaultOverridePath)
    const manifestPath = path.join(vaultSeriesDir, 'voice_manifest.json')

    const { manifest, reloaded } = loadVoiceManifestCached(cpy, manifestPath)

    if (reloaded) {
      await logConsole(ste, `>> [PROFILE:MTIME] Manifest updated or cold-loaded: ${manifestPath}`)
    } else {
      await logConsole(ste, `>> [PROFILE:CACHE] Manifest served from in-memory cache: ${manifestPath}`)
    }

    const resolution = resolveConditionedVoiceRecipe(manifest, vaultSeriesDir, payload)
    bal.result = resolution
    cpy.profilesProcessed += 1

    if (resolution.status === 'DEGRADED_TO_BASE') {
      await logConsole(
        ste,
        `>> [PROFILE:FALLBACK] Variant [${payload.emotionTag}] unrecorded for [${payload.characterId}]. Degraded to base_state.`,
      )
    } else if (resolution.status === 'BREACH') {
      await logConsole(
        ste,
        `:: [PROFILE:BREACH] Failed to resolve voice profile: ${resolution.error}`,
      )
    } else {
      await logConsole(
        ste,
        `>> [PROFILE:RESOLVED] Character [${payload.characterId}] resolved take: ${resolution.resolvedAudioPath}`,
      )
    }
  } catch (err: any) {
    bal.result = {
      status: 'BREACH',
      seriesId: payload.seriesId,
      characterId: payload.characterId,
      resolvedAudioPath: '',
      isFallback: false,
      error: err instanceof Error ? err.message : String(err),
    }
    await logConsole(ste, `:: [PROFILE:ERROR] ${bal.result.error}`)
  }

  if (bal.slv) bal.slv({ prfBit: bal })
  return cpy
}
