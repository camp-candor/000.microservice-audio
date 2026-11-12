import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { PipelineModel } from '../03.pipeline.unit/pipeline.model.js'
import {
    alignCausalVaeLattice,
    runTenUnitPipelineSequence,
    executeSynthesisPipeline,
} from '../03.pipeline.unit/buz/pipeline.buzz.js'
import { MicroserviceaudioModel } from '../00.microserviceaudio.unit/microserviceaudio.model.js'
import { synthesizeMicroserviceaudio } from '../00.microserviceaudio.unit/buz/microserviceaudio.buzz.js'

describe('Feature 8.1: Deterministic Synthesis Pipeline Sequencer', () => {
    let scratchDir: string

    beforeEach(() => {
        scratchDir = fs.mkdtempSync(
            path.join(os.tmpdir(), 'pipeline_seq_test_'),
        )
    })

    afterEach(() => {
        fs.rmSync(scratchDir, { recursive: true, force: true })
    })

    it('alignCausalVaeLattice enforces 4n+1 temporal modulo lattice geometry', () => {
        expect(alignCausalVaeLattice(1)).toBe(1) // 4(0)+1 = 1
        expect(alignCausalVaeLattice(2)).toBe(5) // 4(1)+1 = 5
        expect(alignCausalVaeLattice(36)).toBe(37) // 4(9)+1 = 37
        expect(alignCausalVaeLattice(37)).toBe(37) // 4(9)+1 = 37
        expect(alignCausalVaeLattice(38)).toBe(41) // 4(10)+1 = 41
    })

    it('runTenUnitPipelineSequence executes all 10 stages and seals WAV stem and viseme sidecar', async () => {
        const wavPath = path.join(scratchDir, 'ep01_sc01_ln01.wav')
        const sidecarPath = path.join(scratchDir, 'ep01_sc01_ln01.viseme.json')

        const report = await runTenUnitPipelineSequence({
            lineId: 'ep01_sc01_ln01',
            seriesSlug: 'wiregrass-basin',
            characterId: 'char_silas',
            rawDialogueText: 'Stand your ground.',
            outputWavPath: wavPath,
            sidecarOutputPath: sidecarPath,
            mruType: 'stimulus',
            somaticState: {
                pulmonaryFatigueBp: 2500,
                emotionalStressBp: 4000,
                isConscious: true,
                hasFunctionalGlottis: true,
            },
        })

        expect(report.status).toBe('PASSED')
        expect(report.stagesCompletedCount).toBe(10)
        expect(report.stageTraces.length).toBe(10)
        expect(report.stemReceipt?.sha256Hash).toMatch(/^[0-9a-f]{64}$/)
        expect(report.visemeSidecar?.totalAllocatedFrames).toBe(36)
        expect(report.causalVaeFrames).toBe(37)
        expect(fs.existsSync(wavPath)).toBe(true)
        expect(fs.existsSync(sidecarPath)).toBe(true)
    })

    it('runTenUnitPipelineSequence halts at Stage 3 (14.conditioning) at T0=$0.00 when character is unconscious', async () => {
        const wavPath = path.join(scratchDir, 'unconscious_halt.wav')

        const report = await runTenUnitPipelineSequence({
            lineId: 'ep01_sc01_ln02',
            seriesSlug: 'wiregrass-basin',
            characterId: 'char_silas',
            rawDialogueText: 'I cannot speak.',
            outputWavPath: wavPath,
            somaticState: {
                isConscious: false,
            },
        })

        expect(report.status).toBe('FAILED')
        expect(report.failedStage).toBe('14.SOMATIC_CONDITIONING')
        expect(report.stagesCompletedCount).toBe(2)
        expect(fs.existsSync(wavPath)).toBe(false) // Zero synthesis execution at T0=$0.00
    })

    it('runTenUnitPipelineSequence halts at Stage 5 (15.dialogue) on prohibited cadence breach', async () => {
        const wavPath = path.join(scratchDir, 'cadence_halt.wav')

        const report = await runTenUnitPipelineSequence({
            lineId: 'ep01_sc01_ln03',
            seriesSlug: 'wiregrass-basin',
            characterId: 'char_silas',
            rawDialogueText: 'Move fast.',
            outputWavPath: wavPath,
            requestedCadence: 'RAPID_STACCATO',
            bannedCadences: ['RAPID_STACCATO'],
        })

        expect(report.status).toBe('FAILED')
        expect(report.failedStage).toBe('15.DIALOGUE_PROSODY')
        expect(report.error).toContain('BANNED_CADENCE_BREACH')
        expect(fs.existsSync(wavPath)).toBe(false)
    })

    it('synthesizeMicroserviceaudio delegates batch line synthesis cleanly to 03.pipeline.unit', async () => {
        const msaModel = new MicroserviceaudioModel()
        const wav1 = path.join(scratchDir, 'batch_01.wav')
        const wav2 = path.join(scratchDir, 'batch_02.wav')

        const logs: string[] = []
        const mockSte: any = {
            hunt: async (_action: string, payload: any) => {
                if (payload?.src) logs.push(payload.src)
                return {}
            },
        }

        const bal: any = {
            idx: 'test-msa-batch',
            dat: {
                lines: [
                    {
                        lineId: 'batch_01',
                        seriesSlug: 'wiregrass-basin',
                        characterId: 'char_silas',
                        rawDialogueText: 'First line.',
                        outputWavPath: wav1,
                    },
                    {
                        lineId: 'batch_02',
                        seriesSlug: 'wiregrass-basin',
                        characterId: 'char_silas',
                        rawDialogueText: 'Second line.',
                        outputWavPath: wav2,
                    },
                ],
            },
        }

        await synthesizeMicroserviceaudio(msaModel, bal, mockSte)

        expect(bal.val).toBe(1)
        expect(fs.existsSync(wav1)).toBe(true)
        expect(fs.existsSync(wav2)).toBe(true)
        expect(
            logs.some((l) => l.includes('>> [OK] [MSA] Delegated 2 line(s)')),
        ).toBe(true)
    })
})
