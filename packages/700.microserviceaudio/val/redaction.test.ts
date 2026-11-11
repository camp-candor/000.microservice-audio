import type AudioBit from '../13.audio.unit/fce/audio.bit.js'
import { describe, it, expect } from 'vitest'
import { AudioModel } from '../13.audio.unit/audio.model.js'
import {
  pcmBufferToFloat32,
  float32ToPcmBuffer,
  auditUnvoicedNoiseFloor,
  flattenPitchWsola,
  flattenFormantsLpc,
  executeSpectralInversion,
} from '../13.audio.unit/buz/audio.buzz.js'

describe('Feature 5.1: Monotone Spectral Inversion Pre-Processor', () => {
  it('pcmBufferToFloat32 and float32ToPcmBuffer roundtrip cleanly with minimal quantization delta', () => {
    const original = Buffer.alloc(1000)
    for (let i = 0; i < 500; i++) {
      original.writeInt16LE(Math.round(Math.sin(i * 0.1) * 30000), i * 2)
    }

    const floats = pcmBufferToFloat32(original)
    const reconstituted = float32ToPcmBuffer(floats)

    expect(reconstituted.length).toBe(original.length)
    for (let i = 0; i < 500; i++) {
      const origSample = original.readInt16LE(i * 2)
      const reconSample = reconstituted.readInt16LE(i * 2)
      expect(Math.abs(origSample - reconSample)).toBeLessThanOrEqual(1)
    }
  })

  it('auditUnvoicedNoiseFloor detects low background noise and rejects elevated noise floors', () => {
    const cleanSamples = new Float32Array(48000)
    // Add tiny white noise below -60 dBFS
    for (let i = 0; i < cleanSamples.length; i++) {
      cleanSamples[i] = (Math.random() - 0.5) * 0.0001
    }
    const cleanAudit = auditUnvoicedNoiseFloor(cleanSamples, -60.0)
    expect(cleanAudit.isWithinCeiling).toBe(true)
    expect(cleanAudit.measuredNoiseFloorDbfs).toBeLessThan(-60.0)

    const loudNoiseSamples = new Float32Array(48000)
    for (let i = 0; i < loudNoiseSamples.length; i++) {
      loudNoiseSamples[i] = (Math.random() - 0.5) * 0.1 // ~ -20 dBFS
    }
    const loudAudit = auditUnvoicedNoiseFloor(loudNoiseSamples, -60.0)
    expect(loudAudit.isWithinCeiling).toBe(false)
  })

  it('flattenPitchWsola transposes audio samples without changing buffer duration', () => {
    const sampleRate = 48000
    const durationSeconds = 1.0
    const samples = new Float32Array(sampleRate * durationSeconds)
    // 220 Hz input sine wave
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.5
    }

    const output = flattenPitchWsola(samples, 120.0, sampleRate)
    expect(output.length).toBe(samples.length)
    expect(output.some((s) => s !== 0)).toBe(true)
  })

  it('flattenFormantsLpc executes inverse filtering without generating NaN or infinite values', () => {
    const samples = new Float32Array(4800)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = (Math.sin(i * 0.05) + Math.sin(i * 0.12)) * 0.4
    }

    const output = flattenFormantsLpc(samples, 16)
    expect(output.length).toBe(samples.length)
    for (let i = 0; i < output.length; i++) {
      expect(Number.isFinite(output[i])).toBe(true)
      expect(Number.isNaN(output[i])).toBe(false)
    }
  })

  it('executeSpectralInversion buzzer integrates WSOLA, LPC, and noise audit returning conformed buffer', async () => {
    const model = new AudioModel()
    const sampleRate = 48000
    const testBuffer = Buffer.alloc(sampleRate * 2)
    for (let i = 0; i < sampleRate; i++) {
      testBuffer.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 16384), i * 2)
    }

        const bal: AudioBit = {
      idx: 'test-inversion',
      dat: { pcmBuffer: testBuffer, sampleRateHz: sampleRate, noiseFloorCeilingDbfs: 10.0 },
    }

    const logs: string[] = []
    const mockSte: any = {
      hunt: async (_action: string, payload: any) => {
        if (payload?.src) logs.push(payload.src)
        return {}
      },
    }

    await executeSpectralInversion(model, bal, mockSte)

    expect(bal.result?.status).toBe('PASSED')
    expect(bal.result?.metrics.isPitchFlattened).toBe(true)
    expect(bal.result?.metrics.isFormantsNeutralized).toBe(true)
    expect(bal.result?.redactedPcmBuffer).toBeDefined()
    expect(model.spectralInversionsCompleted).toBe(1)
    expect(logs.some((l) => l.includes('>> [AUDIO:REDACT]'))).toBe(true)
  })
})
