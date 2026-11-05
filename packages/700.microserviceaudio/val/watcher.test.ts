import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { waitForBufferStabilization } from '../10.generate.unit/buz/generate.buzz.js'

describe('10.generate.unit: Non-Blocking Inode Polling File Watcher', () => {
    let testDir: string

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-test-'))
    })

    afterEach(() => {
        try {
            fs.rmSync(testDir, { recursive: true, force: true })
        } catch {}
    })

    it('detects byte-count quiescence and promotes .tmp to .wav via atomic rename', async () => {
        const stagingPath = path.join(testDir, 'test_stem.wav.tmp')
        const targetPath = path.join(testDir, 'test_stem.wav')

        // Simulate asynchronous writer writing chunks to the file
        fs.writeFileSync(stagingPath, Buffer.alloc(512, 0x01))

        setTimeout(() => {
            fs.appendFileSync(stagingPath, Buffer.alloc(1024, 0x02))
        }, 150)

        const result = await waitForBufferStabilization({
            stagingPath,
            targetPath,
            intervalMs: 100,
            timeoutMs: 5000,
            stabilityChecksRequired: 2,
        })

        expect(result.status).toBe('STABILIZED')
        expect(result.bytesConfirmed).toBe(1536)
        expect(fs.existsSync(stagingPath)).toBe(false)
        expect(fs.existsSync(targetPath)).toBe(true)
        expect(fs.statSync(targetPath).size).toBe(1536)
    })

    it('times out and unlinks orphaned staging file if buffer never materializes', async () => {
        const stagingPath = path.join(testDir, 'missing_stem.wav.tmp')
        const targetPath = path.join(testDir, 'missing_stem.wav')

        const result = await waitForBufferStabilization({
            stagingPath,
            targetPath,
            intervalMs: 50,
            timeoutMs: 300,
            stabilityChecksRequired: 2,
        })

        expect(result.status).toBe('TIMEOUT')
        expect(fs.existsSync(stagingPath)).toBe(false)
        expect(fs.existsSync(targetPath)).toBe(false)
    })

    it('rejects cross-directory staging and target configurations to prevent non-atomic copy degradation', async () => {
        const stagingPath = path.join(testDir, 'test_stem.wav.tmp')
        const altDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-alt-'))
        const targetPath = path.join(altDir, 'test_stem.wav')

        fs.writeFileSync(stagingPath, Buffer.alloc(128, 0xaa))

        const result = await waitForBufferStabilization({
            stagingPath,
            targetPath,
            intervalMs: 50,
            timeoutMs: 1000,
        })

        expect(result.status).toBe('INODE_ERROR')
        expect(result.error).toContain('CROSS_DIRECTORY_INODE_VIOLATION')

        fs.rmSync(altDir, { recursive: true, force: true })
    })
})
