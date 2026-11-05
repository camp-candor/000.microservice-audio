import { describe, it, expect, beforeEach } from 'vitest'
import type { Env } from '../../src/types/env.js'
import { AudioLeaseDO } from '../../src/objects/AudioLeaseDO.js'

// High-fidelity in-memory SQLite storage mock simulating Cloudflare Durable Object transactional SQL
class MockSqliteStorage {
    private tables: Record<string, any[]> = {
        active_leases: [],
        epoch_metadata: [{ id: 1, current_epoch: 1 }],
    }

    exec(query: string, ...params: any[]) {
        const q = query.trim().toUpperCase()

        if (q.includes('CREATE TABLE')) {
            return { toArray: () => [] }
        }

        if (q.startsWith('SELECT CURRENT_EPOCH FROM EPOCH_METADATA')) {
            return { toArray: () => [...this.tables.epoch_metadata] }
        }

        if (q.startsWith('SELECT * FROM ACTIVE_LEASES')) {
            return { toArray: () => [...this.tables.active_leases] }
        }

        if (q.startsWith('INSERT INTO ACTIVE_LEASES')) {
            this.tables.active_leases = [
                {
                    lease_id: params[0],
                    holder_id: params[1],
                    line_id: params[2],
                    epoch: params[3],
                    acquired_at_ms: params[4],
                    heartbeat_at_ms: params[5],
                    expires_at_ms: params[6],
                },
            ]
            return { toArray: () => [] }
        }

        if (q.startsWith('DELETE FROM ACTIVE_LEASES')) {
            this.tables.active_leases = []
            return { toArray: () => [] }
        }

        if (q.startsWith('UPDATE EPOCH_METADATA')) {
            this.tables.epoch_metadata[0].current_epoch = params[0]
            return { toArray: () => [] }
        }

        if (q.startsWith('UPDATE ACTIVE_LEASES')) {
            if (this.tables.active_leases[0]) {
                this.tables.active_leases[0].heartbeat_at_ms = params[0]
                this.tables.active_leases[0].expires_at_ms = params[1]
            }
            return { toArray: () => [] }
        }

        return { toArray: () => [] }
    }
}

class MockDurableObjectContext {
    public storage = {
        sql: new MockSqliteStorage(),
        alarmTime: null as number | null,
        setAlarm: async (ms: number) => {
            this.storage.alarmTime = ms
        },
        deleteAlarm: async () => {
            this.storage.alarmTime = null
        },
    }

    public sockets: any[] = []
    acceptWebSocket(ws: any, tags: string[] = []) {
        ws.tags = tags
        this.sockets.push(ws)
    }
    getWebSockets(tag?: string) {
        if (!tag) return this.sockets
        return this.sockets.filter((s) => s.tags?.includes(tag))
    }
}

describe('Task 7.2: Durable Object Lease Mutex Contention Test Suite', () => {
    let mockCtx: MockDurableObjectContext
    let mockEnv: Env
    let leaseDO: AudioLeaseDO

    beforeEach(() => {
        mockCtx = new MockDurableObjectContext()
        mockEnv = {
            AUDIO_LEASE_DO: {} as any,
            CANON_DB: {} as any,
            AUDIO_STEMS_BUCKET: {} as any,
            CF_ACCESS_CLIENT_ID: 'access_id',
            CF_ACCESS_CLIENT_SECRET: 'access_sec',
        }

        leaseDO = new AudioLeaseDO(mockCtx as any, mockEnv)
    })

    it('guarantees mutual exclusion: only 1 caller wins lease while concurrent callers receive HTTP 409', async () => {
        const callers = [
            { holderId: 'worker_node_alpha', lineId: 'scene01_shot01' },
            { holderId: 'worker_node_bravo', lineId: 'scene01_shot02' },
            { holderId: 'worker_node_charlie', lineId: 'scene01_shot03' },
            { holderId: 'worker_node_delta', lineId: 'scene01_shot04' },
            { holderId: 'worker_node_echo', lineId: 'scene01_shot05' },
        ]

        // Fire 5 simultaneous lease requests into the same Durable Object instance
        const responses = await Promise.all(
            callers.map((caller) =>
                leaseDO.fetch(
                    new Request('http://localhost/lease/acquire', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(caller),
                    }),
                ),
            ),
        )

        const statuses = responses.map((r) => r.status)
        const grantedResponses = responses.filter((r) => r.status === 200)
        const conflictResponses = responses.filter((r) => r.status === 409)

        // Exactly 1 winner, exactly 4 conflicts
        expect(grantedResponses.length).toBe(1)
        expect(conflictResponses.length).toBe(4)

        const winnerData = (await grantedResponses[0].json()) as any
        expect(winnerData.status).toBe('LEASE_GRANTED')
        expect(winnerData.lease.epoch).toBe(2) // Baseline epoch 1 increments to 2
        expect(
            callers.some((c) => c.holderId === winnerData.lease.holderId),
        ).toBe(true)

        // All conflict responses must report HARDWARE_MUTEX_BUSY
        for (const res of conflictResponses) {
            const conflictData = (await res.json()) as any
            expect(conflictData.error).toBe('HARDWARE_MUTEX_BUSY')
            expect(conflictData.code).toBe('LEASE_CONFLICT')
            expect(conflictData.activeLease.holderId).toBe(
                winnerData.lease.holderId,
            )
            expect(conflictData.activeLease.epoch).toBe(2)
        }
    })

    it('stress test: 25 simultaneous contending requests yield exactly 1 winner and 24 conflict responses', async () => {
        const burstCount = 25
        const requests = Array.from({ length: burstCount }, (_, i) =>
            leaseDO.fetch(
                new Request('http://localhost/lease/acquire', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        holderId: `burst_worker_${i}`,
                        lineId: `line_${i}`,
                        ttlMs: 30000,
                    }),
                }),
            ),
        )

        const results = await Promise.all(requests)
        const successCount = results.filter((r) => r.status === 200).length
        const conflictCount = results.filter((r) => r.status === 409).length

        expect(successCount).toBe(1)
        expect(conflictCount).toBe(burstCount - 1)

        const statusRes = await leaseDO.fetch(
            new Request('http://localhost/lease/status'),
        )
        const statusData = (await statusRes.json()) as any
        expect(statusData.isLocked).toBe(true)
        expect(statusData.currentEpoch).toBe(2)
    })

    it('fences out zombie heartbeats presenting stale epochs with HTTP 409', async () => {
        // 1. Acquire initial lease
        const acquireRes = await leaseDO.fetch(
            new Request('http://localhost/lease/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holderId: 'worker_rig1',
                    lineId: 'shot_101',
                }),
            }),
        )
        const { lease } = (await acquireRes.json()) as any
        const activeEpoch = lease.epoch

        // 2. Submit heartbeat with stale epoch (e.g. activeEpoch - 1)
        const staleHeartbeatRes = await leaseDO.fetch(
            new Request('http://localhost/lease/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leaseId: lease.leaseId,
                    epoch: activeEpoch - 1,
                }),
            }),
        )

        expect(staleHeartbeatRes.status).toBe(409)
        const staleData = (await staleHeartbeatRes.json()) as any
        expect(staleData.error).toBe('ZOMBIE_LEASE_EPOCH')
        expect(staleData.code).toBe('FENCING_BREACH')
        expect(staleData.currentEpoch).toBe(activeEpoch)
    })

    it('fences out zombie release attempts presenting stale epochs with HTTP 409', async () => {
        const acquireRes = await leaseDO.fetch(
            new Request('http://localhost/lease/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holderId: 'worker_rig1',
                    lineId: 'shot_102',
                }),
            }),
        )
        const { lease } = (await acquireRes.json()) as any

        const staleReleaseRes = await leaseDO.fetch(
            new Request('http://localhost/lease/release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leaseId: lease.leaseId,
                    epoch: 999, // Stale / future corrupted epoch
                }),
            }),
        )

        expect(staleReleaseRes.status).toBe(409)
        const releaseData = (await staleReleaseRes.json()) as any
        expect(releaseData.error).toBe('ZOMBIE_LEASE_EPOCH')
        expect(releaseData.code).toBe('FENCING_BREACH')
    })

    it('sequential lease lifecycle: release disarms alarm and bumps epoch for next contender', async () => {
        // Worker 1 acquires lease (Epoch 2)
        const res1 = await leaseDO.fetch(
            new Request('http://localhost/lease/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holderId: 'worker_1',
                    lineId: 'shot_01',
                }),
            }),
        )
        const data1 = (await res1.json()) as any
        expect(data1.lease.epoch).toBe(2)
        expect(mockCtx.storage.alarmTime).toBeGreaterThan(Date.now())

        // Worker 1 completes work and releases lease
        const releaseRes = await leaseDO.fetch(
            new Request('http://localhost/lease/release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leaseId: data1.lease.leaseId,
                    epoch: data1.lease.epoch,
                }),
            }),
        )
        expect(releaseRes.status).toBe(200)
        const releaseData = (await releaseRes.json()) as any
        expect(releaseData.status).toBe('LEASE_RELEASED')
        expect(releaseData.nextEpoch).toBe(3)
        expect(mockCtx.storage.alarmTime).toBeNull() // Watchdog disarmed

        // Worker 2 now acquires freed mutex (receives Epoch 4 because 3 increments to 4 on new acquire)
        const res2 = await leaseDO.fetch(
            new Request('http://localhost/lease/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holderId: 'worker_2',
                    lineId: 'shot_02',
                }),
            }),
        )
        expect(res2.status).toBe(200)
        const data2 = (await res2.json()) as any
        expect(data2.lease.epoch).toBe(4)
        expect(data2.lease.holderId).toBe('worker_2')
    })

    it('watchdog timeout autonomously evicts stalled lease and increments epoch to fence dead worker', async () => {
        const acquireRes = await leaseDO.fetch(
            new Request('http://localhost/lease/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holderId: 'crashed_worker',
                    lineId: 'shot_hung',
                }),
            }),
        )
        const { lease } = (await acquireRes.json()) as any

        // Simulate 30s watchdog alarm trigger
        await leaseDO.alarm()

        // Verify lease is unlocked and epoch has progressed
        const statusRes = await leaseDO.fetch(
            new Request('http://localhost/lease/status'),
        )
        const statusData = (await statusRes.json()) as any
        expect(statusData.isLocked).toBe(false)
        expect(statusData.currentEpoch).toBe(lease.epoch + 1)

        // Stalled worker attempts late heartbeat -> fails with HTTP 404 (or HTTP 409 if active lease renewed)
        const lateHeartbeatRes = await leaseDO.fetch(
            new Request('http://localhost/lease/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leaseId: lease.leaseId,
                    epoch: lease.epoch,
                }),
            }),
        )
        expect(lateHeartbeatRes.status).toBe(404)

        // Next worker acquires immediately without blocking
        const nextAcquireRes = await leaseDO.fetch(
            new Request('http://localhost/lease/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holderId: 'recovered_worker',
                    lineId: 'shot_recovered',
                }),
            }),
        )
        expect(nextAcquireRes.status).toBe(200)
    })
})
