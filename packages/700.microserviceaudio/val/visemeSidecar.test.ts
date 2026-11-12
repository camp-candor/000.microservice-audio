import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { CompositionModel } from '../17.composition.unit/composition.model.js'
import {
    quantizeMsToFrames,
    mapGraphemeToViseme,
    compileVisemeSidecar,
    buildVisemeSidecar,
} from '../17.composition.unit/buz/composition.buzz.js'

describe('Feature 7.2: Viseme Map Temporal Lattice Sidecar Builder', () => {
    let scratchDir: string

    beforeEach(() => {
        scratchDir = fs.mkdtempSync(
            path.join(os.tmpdir(), 'viseme_sidecar_test_'),
        )
    })

    afterEach(() => {
        fs.rmSync(scratchDir, { recursive: true, force: true })
    })

    it('quantizeMsToFrames enforces ceiling allocation and 1-frame sub-frame clamp', () => {
        expect(quantizeMsToFrames(1000, 24)).toBe(24)
        expect(quantizeMsToFrames(1001, 24)).toBe(25) // Zero-underrun ceiling
        expect(quantizeMsToFrames(12, 24)).toBe(1) // Sub-frame (< 41.67ms) clamped to 1
        expect(quantizeMsToFrames(0, 24)).toBe(1)
    })

    it('mapGraphemeToViseme maps phonetic graphemes to Preston Blair mouth codes', () => {
        expect(mapGraphemeToViseme('P')).toBe('A')
        expect(mapGraphemeToViseme('M')).toBe('A')
        expect(mapGraphemeToViseme('F')).toBe('G')
        expect(mapGraphemeToViseme('O')).toBe('E')
        expect(mapGraphemeToViseme('U')).toBe('F')
        expect(mapGraphemeToViseme('A')).toBe('D')
        expect(mapGraphemeToViseme('L')).toBe('H')
        expect(mapGraphemeToViseme(' ')).toBe('X')
    })

    it('compileVisemeSidecar tiles contiguous zero-gap frames across full allocated budget', () => {
        const sidecar = compileVisemeSidecar({
            lineId: 'ep01_sc01_ln01',
            characterId: 'char_silas',
            stemSha256:
                '111122223333444455556666777788889999aaaabbbbccccddddeeeeffff0000',
            normalizedDialogueText: 'Stand your ground.',
            audioDurationMs: 1500, // 36 frames @ 24fps
            leadSilenceMs: 125, // 3 frames
            tailSilenceMs: 125, // 3 frames
            fps: 24,
        })

        expect(sidecar.totalAllocatedFrames).toBe(36)
        expect(sidecar.leadSilenceFrames).toBe(3)
        expect(sidecar.tailSilenceFrames).toBe(3)
        expect(sidecar.sidecarRootSha256).toMatch(/^[0-9a-f]{64}$/)

        // Verify contiguous zero-gap tiling from frame 0 to frame 35
        expect(sidecar.keyframes[0].startFrame).toBe(0)
        expect(sidecar.keyframes[0].viseme).toBe('X')
        const lastKf = sidecar.keyframes[sidecar.keyframes.length - 1]
        expect(lastKf.endFrame).toBe(35)
        expect(lastKf.viseme).toBe('X')

        for (let i = 1; i < sidecar.keyframes.length; i++) {
            expect(sidecar.keyframes[i].startFrame).toBe(
                sidecar.keyframes[i - 1].endFrame + 1,
            )
        }
    })

    it('buildVisemeSidecar buzzer atomically writes sidecar JSON and streams 7-bit ASCII logs', async () => {
        const model = new CompositionModel()
        const outPath = path.join(scratchDir, 'ep01_sc01_ln01.viseme.json')

        const logs: string[] = []
        const mockSte: any = {
            hunt: async (_action: string, payload: any) => {
                if (payload?.src) logs.push(payload.src)
                return {}
            },
        }

        const bal: any = {
            idx: 'test-build-sidecar',
            dat: {
                lineId: 'ep01_sc01_ln01',
                characterId: 'char_silas',
                stemSha256:
                    'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
                normalizedDialogueText: 'Hold the gate.',
                audioDurationMs: 2000,
                fps: 24,
                outputPath: outPath,
            },
        }

        await buildVisemeSidecar(model, bal, mockSte)

        expect(bal.val).toBe(1)
        expect(model.sidecarsCompiledCount).toBe(1)
        expect(model.totalFramesAllocated).toBe(48)
        expect(fs.existsSync(outPath)).toBe(true)

        const written = JSON.parse(fs.readFileSync(outPath, 'utf8'))
        expect(written.totalAllocatedFrames).toBe(48)
        expect(
            logs.some((l) =>
                l.includes(
                    '>> [OK] [VISEME] Compiled [ep01_sc01_ln01] -> 48 frames',
                ),
            ),
        ).toBe(true)
    })
})
