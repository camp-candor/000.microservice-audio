import { describe, it, expect, beforeEach } from 'vitest'
import app from '../../src/index.js'
import type { Env } from '../../src/types/env.js'
import { purgeOrphanedStagingBuffers } from '../../src/crons/sweeper.js'

class MockR2Bucket {
    public objects: Map<
        string,
        { size: number; uploaded: Date; body?: Buffer }
    > = new Map()

    async head(key: string) {
        const obj = this.objects.get(key)
        if (!obj) return null
        return {
            key,
            size: obj.size,
            uploaded: obj.uploaded,
        }
    }

    async list(options?: { prefix?: string; limit?: number }) {
        const prefix = options?.prefix || ''
        const res: Array<{ key: string; size: number; uploaded: Date }> = []
        for (const [key, val] of this.objects.entries()) {
            if (key.startsWith(prefix)) {
                res.push({ key, size: val.size, uploaded: val.uploaded })
            }
        }
        return { objects: res }
    }

    async delete(key: string) {
        this.objects.delete(key)
    }
}

class MockD1Database {
    public statements: string[] = []
    prepare(sql: string) {
        return {
            bind: (...args: any[]) => ({
                run: async () => ({ success: true }),
            }),
            run: async () => ({ success: true }),
        }
    }
}

describe('Phase 6: Edge Asset Relay R2 Storage Adapter', () => {
    let mockEnv: Env
    let mockR2: MockR2Bucket
    let mockD1: MockD1Database
    let activeLeaseState: any

    beforeEach(() => {
        mockR2 = new MockR2Bucket()
        mockD1 = new MockD1Database()

        activeLeaseState = {
            isLocked: true,
            currentEpoch: 2,
            activeLease: {
                leaseId: 'lease_line_01_active',
                holderId: 'worker_rig1',
                epoch: 2,
            },
        }

        const mockDOStub = {
            fetch: async (req: Request) => {
                const url = new URL(req.url)
                if (url.pathname === '/lease/status') {
                    return new Response(JSON.stringify(activeLeaseState), {
                        status: 200,
                    })
                }
                return new Response('NOT_FOUND', { status: 404 })
            },
        }

        mockEnv = {
            AUDIO_LEASE_DO: {
                idFromName: () => ({}),
                get: () => mockDOStub,
            } as any,
            CANON_DB: mockD1 as any,
            AUDIO_STEMS_BUCKET: mockR2 as any,
            CF_ACCESS_CLIENT_ID: 'access_id',
            CF_ACCESS_CLIENT_SECRET: 'access_sec',
        }
    })

    it('rejects POST /stems/signed-upload when caller holds no active hardware lease', async () => {
        activeLeaseState.isLocked = false
        activeLeaseState.activeLease = null

        const req = new Request('http://localhost/stems/signed-upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CF-Access-Client-Id': 'access_id',
                'CF-Access-Client-Secret': 'access_sec',
            },
            body: JSON.stringify({
                leaseId: 'lease_invalid',
                epoch: 1,
                seriesId: 'series_01',
                sceneId: 'sc_01',
                stemId: 'stem_01',
            }),
        })

        const res = await app.fetch(req, mockEnv as any)
        expect(res.status).toBe(403)
        const body = (await res.json()) as any
        expect(body.error.code).toBe('NO_ACTIVE_HARDWARE_LEASE')
    })

    it('rejects POST /stems/signed-upload when epoch is stale with HTTP 409', async () => {
        const req = new Request('http://localhost/stems/signed-upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CF-Access-Client-Id': 'access_id',
                'CF-Access-Client-Secret': 'access_sec',
            },
            body: JSON.stringify({
                leaseId: 'lease_line_01_active',
                epoch: 1, // Stale: active is 2
                seriesId: 'series_01',
                sceneId: 'sc_01',
                stemId: 'stem_01',
            }),
        })

        const res = await app.fetch(req, mockEnv as any)
        expect(res.status).toBe(409)
        const body = (await res.json()) as any
        expect(body.error.code).toBe('ZOMBIE_LEASE_EPOCH')
    })

    it('grants signed upload URL and object namespace for authorized lease holder', async () => {
        const req = new Request('http://localhost/stems/signed-upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CF-Access-Client-Id': 'access_id',
                'CF-Access-Client-Secret': 'access_sec',
            },
            body: JSON.stringify({
                leaseId: 'lease_line_01_active',
                epoch: 2,
                seriesId: 'series_01',
                sceneId: 'sc_01',
                stemId: 'stem_01',
            }),
        })

        const res = await app.fetch(req, mockEnv as any)
        expect(res.status).toBe(200)
        const body = (await res.json()) as any
        expect(body.status).toBe('SIGNED_UPLOAD_GRANTED')
        expect(body.objectKey).toBe('stems/series_01/sc_01/stem_01.wav')
        expect(body.uploadUrl).toContain('stems/series_01/sc_01/stem_01.wav')
    })

    it('POST /stems/confirm fails with HTTP 404 if object is missing in R2', async () => {
        const req = new Request('http://localhost/stems/confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CF-Access-Client-Id': 'access_id',
                'CF-Access-Client-Secret': 'access_sec',
            },
            body: JSON.stringify({
                leaseId: 'lease_line_01_active',
                epoch: 2,
                objectKey: 'stems/series_01/sc_01/missing_stem.wav',
                sha256: '3a7894a4c1477ea53d7e5d2ea99401b34e402b896489370891d4e022064104d4',
                durationMs: 2500,
                byteLength: 240044,
            }),
        })

        const res = await app.fetch(req, mockEnv as any)
        expect(res.status).toBe(404)
        const body = (await res.json()) as any
        expect(body.error.code).toBe('OBJECT_NOT_FOUND_IN_R2')
    })

    it('POST /stems/confirm fails with HTTP 400 if byteLength mismatches R2 head', async () => {
        mockR2.objects.set('stems/series_01/sc_01/stem_01.wav', {
            size: 100000,
            uploaded: new Date(),
        })

        const req = new Request('http://localhost/stems/confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CF-Access-Client-Id': 'access_id',
                'CF-Access-Client-Secret': 'access_sec',
            },
            body: JSON.stringify({
                leaseId: 'lease_line_01_active',
                epoch: 2,
                objectKey: 'stems/series_01/sc_01/stem_01.wav',
                sha256: '3a7894a4c1477ea53d7e5d2ea99401b34e402b896489370891d4e022064104d4',
                durationMs: 2500,
                byteLength: 50000, // Mismatch: actual size is 100000
            }),
        })

        const res = await app.fetch(req, mockEnv as any)
        expect(res.status).toBe(400)
        const body = (await res.json()) as any
        expect(body.error.code).toBe('BYTE_LENGTH_MISMATCH')
    })

    it('POST /stems/confirm successfully validates R2 metadata and commits to D1', async () => {
        const key = 'stems/series_01/sc_01/stem_01.wav'
        mockR2.objects.set(key, {
            size: 240044,
            uploaded: new Date(),
        })

        const req = new Request('http://localhost/stems/confirm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'CF-Access-Client-Id': 'access_id',
                'CF-Access-Client-Secret': 'access_sec',
            },
            body: JSON.stringify({
                leaseId: 'lease_line_01_active',
                epoch: 2,
                objectKey: key,
                sha256: '3a7894a4c1477ea53d7e5d2ea99401b34e402b896489370891d4e022064104d4',
                durationMs: 2500,
                byteLength: 240044,
            }),
        })

        const res = await app.fetch(req, mockEnv as any)
        expect(res.status).toBe(200)
        const body = (await res.json()) as any
        expect(body.status).toBe('STEM_CONFIRMED_AND_SEALED')
        expect(body.stemId).toBe('stem_01')
        expect(body.byteLength).toBe(240044)
    })

    it('purges orphaned staging files older than 24 hours via cron sweeper', async () => {
        const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

        mockR2.objects.set('staging/scratch_old.tmp', {
            size: 5000,
            uploaded: twoDaysAgo,
        })
        mockR2.objects.set('staging/scratch_recent.tmp', {
            size: 3000,
            uploaded: fiveMinutesAgo,
        })
        mockR2.objects.set('stems/canonical.wav', {
            size: 100000,
            uploaded: twoDaysAgo,
        })

        const report = await purgeOrphanedStagingBuffers(mockEnv)
        expect(report.status).toBe('COMPLETED')
        expect(report.deletedCount).toBe(1)
        expect(report.reclaimedBytes).toBe(5000)

        // Old staging object deleted; recent staging and canonical stem preserved
        expect(mockR2.objects.has('staging/scratch_old.tmp')).toBe(false)
        expect(mockR2.objects.has('staging/scratch_recent.tmp')).toBe(true)
        expect(mockR2.objects.has('stems/canonical.wav')).toBe(true)
    })
})
