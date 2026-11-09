import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ProfileModel } from '../09.profile.unit/profile.model.js'
import {
  assertZeroVaultRedundancy,
  resolveSeriesVaultPath,
  loadVoiceManifestCached,
  resolveConditionedVoiceRecipe,
  resolveVoiceProfile,
  auditVaultBoundary,
} from '../09.profile.unit/buz/profile.buzz.js'
import type { SeriesVoiceManifest } from '../09.profile.unit/fce/profile.interface.js'

describe('Phase 2: Read-Only Asset Vault Consumer Bridge', () => {
  let scratchDir: string
  let mockVaultDir: string
  let manifestPath: string

  const mockManifest: SeriesVoiceManifest = {
    seriesId: 'wiregrass',
    version: '1.0.0',
    updatedAtUtc: '2026-11-08T22:00:00Z',
    characters: {
      char_silas: {
        characterId: 'char_silas',
        displayName: 'Silas Vance',
        gender: 'masculine',
        defaultEngine: 'styletts2',
        baseTakePath: 'active/silas.wav',
        latentEmbeddingPath: 'embeddings/silas_v1.pt',
        sampleRateHz: 48000,
        conditionVariants: {
          tense: 'active/silas--tense.wav',
          whisper: null, // explicitly unrecorded variant
        },
        bannedCadences: ['sing_song'],
      },
    },
  }

  beforeEach(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vault_bridge_test_'))
    mockVaultDir = path.join(scratchDir, 'series-assets-audio', 'voices', 'wiregrass')
    fs.mkdirSync(mockVaultDir, { recursive: true })
    fs.mkdirSync(path.join(mockVaultDir, 'active'), { recursive: true })
    fs.mkdirSync(path.join(mockVaultDir, 'embeddings'), { recursive: true })

    fs.writeFileSync(path.join(mockVaultDir, 'active', 'silas.wav'), 'RIFF mock base pcm data')
    fs.writeFileSync(path.join(mockVaultDir, 'active', 'silas--tense.wav'), 'RIFF mock tense pcm data')
    fs.writeFileSync(path.join(mockVaultDir, 'embeddings', 'silas_v1.pt'), 'mock latent embedding tensor')

    manifestPath = path.join(mockVaultDir, 'voice_manifest.json')
    fs.writeFileSync(manifestPath, JSON.stringify(mockManifest, null, 2), 'utf8')
  })

  afterEach(() => {
    fs.rmSync(scratchDir, { recursive: true, force: true })
  })

  it('assertZeroVaultRedundancy passes when local repository contains zero duplicate vaults', () => {
    const report = assertZeroVaultRedundancy(process.cwd())
    expect(report.status).toBe('PASSED')
    expect(report.redundantLocalDirectoriesFound).toEqual([])
  })

  it('loadVoiceManifestCached reloads manifest on cold start and serves from cache on identical mtimeMs', () => {
    const model = new ProfileModel()
    const firstPass = loadVoiceManifestCached(model, manifestPath)
    expect(firstPass.reloaded).toBe(true)
    expect(firstPass.manifest.characters.char_silas.displayName).toBe('Silas Vance')

    const secondPass = loadVoiceManifestCached(model, manifestPath)
    expect(secondPass.reloaded).toBe(false)
    expect(secondPass.manifest).toBe(firstPass.manifest)

    // Touch file modification time to simulate upstream git pull
    const futureTime = (Date.now() + 5000) / 1000
    fs.utimesSync(manifestPath, futureTime, futureTime)

    const thirdPass = loadVoiceManifestCached(model, manifestPath)
    expect(thirdPass.reloaded).toBe(true)
  })

  it('resolveConditionedVoiceRecipe resolves explicit condition variants directly from vault path', () => {
    const resolution = resolveConditionedVoiceRecipe(mockManifest, mockVaultDir, {
      seriesId: 'wiregrass',
      characterId: 'char_silas',
      emotionTag: 'tense',
      releaseMode: 'DRAFT',
    })

    expect(resolution.status).toBe('RESOLVED')
    expect(resolution.isFallback).toBe(false)
    expect(resolution.resolvedAudioPath).toBe(path.join(mockVaultDir, 'active', 'silas--tense.wav'))
    expect(resolution.resolvedEmbeddingPath).toBe(path.join(mockVaultDir, 'embeddings', 'silas_v1.pt'))
  })

  it('resolveConditionedVoiceRecipe degrades null emotion to base_state with DSP deltas in DRAFT mode', () => {
    const resolution = resolveConditionedVoiceRecipe(mockManifest, mockVaultDir, {
      seriesId: 'wiregrass',
      characterId: 'char_silas',
      emotionTag: 'whisper', // variant is null
      releaseMode: 'DRAFT',
    })

    expect(resolution.status).toBe('DEGRADED_TO_BASE')
    expect(resolution.isFallback).toBe(true)
    expect(resolution.resolvedAudioPath).toBe(path.join(mockVaultDir, 'active', 'silas.wav'))
    expect(resolution.appliedDspDeltas).toBeDefined()
    expect(resolution.appliedDspDeltas?.pitchShiftDeltaSemitones).toBe(1.5)
  })

  it('resolveConditionedVoiceRecipe fails closed with BREACH in BROADCAST mode on null variant', () => {
    const resolution = resolveConditionedVoiceRecipe(mockManifest, mockVaultDir, {
      seriesId: 'wiregrass',
      characterId: 'char_silas',
      emotionTag: 'whisper',
      releaseMode: 'BROADCAST',
    })

    expect(resolution.status).toBe('BREACH')
    expect(resolution.error).toContain('UNRECORDED_VARIANT_BROADCAST_BREACH')
  })

  it('resolveVoiceProfile buzzer handles hunt dispatch cleanly and emits 7-bit ASCII logs', async () => {
    const model = new ProfileModel()
    const bal: import('../09.profile.unit/fce/profile.bit.js').default = {
      idx: 'test-res',
      dat: {
        seriesId: 'wiregrass',
        characterId: 'char_silas',
        emotionTag: 'tense',
        vaultOverridePath: path.join(scratchDir, 'series-assets-audio'),
      },
    }

    const logs: string[] = []
    const mockSte: any = {
      hunt: async (_action: string, payload: any) => {
        if (payload?.src) logs.push(payload.src)
        return {}
      },
    }

    await resolveVoiceProfile(model, bal, mockSte)

    expect(bal.result?.status).toBe('RESOLVED')
    expect(model.profilesProcessed).toBe(1)
    expect(logs.some((l) => l.includes('>> [PROFILE:MTIME]'))).toBe(true)
    expect(logs.some((l) => l.includes('>> [PROFILE:RESOLVED]'))).toBe(true)
  })
})
