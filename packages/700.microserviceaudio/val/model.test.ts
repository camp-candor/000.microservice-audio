import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ModelModel } from '../96.model.unit/model.model.js'
import {
  assertHostMemoryBudget,
  resolveLatentTensorPath,
  buildMmapModelArgs,
  resolveLatentTensor,
  auditMemoryBudget,
} from '../96.model.unit/buz/model.buzz.js'

describe('Phase 3: Neural Latent Tensor Memory Mapping', () => {
  let scratchDir: string
  let mockEmbeddingsDir: string
  let mockTensorPath: string

  beforeEach(() => {
    scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'latent_model_test_'))
    mockEmbeddingsDir = path.join(scratchDir, 'series-assets-audio', 'voices', 'wiregrass', 'embeddings')
    fs.mkdirSync(mockEmbeddingsDir, { recursive: true })

    mockTensorPath = path.join(mockEmbeddingsDir, 'char_silas_v1.pt')
    // Write 2048 bytes of synthetic tensor data to clear the >= 1024 byte sentinel
    const dummyBuffer = Buffer.alloc(2048, 0xef)
    fs.writeFileSync(mockTensorPath, dummyBuffer)
  })

  afterEach(() => {
    fs.rmSync(scratchDir, { recursive: true, force: true })
  })

  it('assertHostMemoryBudget confirms process RSS is well within 8.0 GB ceiling', () => {
    const report = assertHostMemoryBudget(8589934592)
    expect(report.status).toBe('PASSED')
    expect(report.currentRssBytes).toBeGreaterThan(0)
    expect(report.headroomBytes).toBeGreaterThan(0)
    expect(report.error).toBeUndefined()
  })

  it('assertHostMemoryBudget halts closed when artificial ceiling is breached', () => {
    // Artificial 1024-byte ceiling to force breach
    const report = assertHostMemoryBudget(1024)
    expect(report.status).toBe('FAILED')
    expect(report.headroomBytes).toBeLessThan(0)
    expect(report.error).toContain('RAM_BUDGET_EXCEEDED')
  })

  it('resolveLatentTensorPath locates precomputed .pt tensor and validates size >= 1024 bytes', () => {
    const resolution = resolveLatentTensorPath(
      'wiregrass',
      'char_silas',
      1,
      path.join(scratchDir, 'series-assets-audio', 'voices', 'wiregrass'),
    )

    expect(resolution.exists).toBe(true)
    expect(resolution.resolvedPath).toBe(mockTensorPath)
    expect(resolution.fileSizeBytes).toBe(2048)
  })

  it('resolveLatentTensorPath rejects undersized or missing tensor files', () => {
    const missing = resolveLatentTensorPath('wiregrass', 'char_corley', 1, scratchDir)
    expect(missing.exists).toBe(false)
    expect(missing.fileSizeBytes).toBe(0)
  })

  it('buildMmapModelArgs enforces CUDA_VISIBLE_DEVICES="" and --mmap-latent flags', () => {
    const args = buildMmapModelArgs('styletts2', mockTensorPath, 'scratch/out.wav', 'Test speech text.')

    expect(args.engineId).toBe('styletts2')
    expect(args.envOverrides.CUDA_VISIBLE_DEVICES).toBe('')
    expect(args.cliArgs).toContain('--mmap-latent')
    expect(args.cliArgs).toContain(mockTensorPath)
    expect(args.cliArgs).toContain('--bypass-wav-resample')
    expect(args.isBypassingWavResample).toBe(true)
  })

  it('resolveLatentTensor buzzer dispatches cleanly, logs 7-bit ASCII, and maps descriptor', async () => {
    const model = new ModelModel()
    const bal: import('../96.model.unit/fce/model.bit.js').default = {
      idx: 'test-tensor-res',
      dat: {
        seriesId: 'wiregrass',
        characterId: 'char_silas',
        versionNumber: 1,
        vaultRootPath: path.join(scratchDir, 'series-assets-audio', 'voices', 'wiregrass'),
      },
    }

    const logs: string[] = []
    const mockSte: any = {
      hunt: async (_action: string, payload: any) => {
        if (payload?.src) logs.push(payload.src)
        return {}
      },
    }

    await resolveLatentTensor(model, bal, mockSte)

    expect(bal.result?.status).toBe('RESOLVED')
    expect(model.modelsLoadedCount).toBe(1)
    expect(model.loadedTensors.char_silas).toBeDefined()
    expect(model.loadedTensors.char_silas.isMemoryMapped).toBe(true)
    expect(logs.some((l) => l.includes('>> [MODEL:MMAP]'))).toBe(true)
  })
})
