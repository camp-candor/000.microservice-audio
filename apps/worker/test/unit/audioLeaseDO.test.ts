import { describe, it, expect, beforeEach } from 'vitest'
import app from '../../src/index.js'
import type { Env } from '../../src/types/env.js'

// In-memory SQLite Mock for isolated unit testing
class MockSqlStorage {
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

class MockDurableObjectState {
    storage = {
        sql: new MockSqlStorage(),
        alarmTime: null as number | null,
        setAlarm: async (ms: number) => {
            this.storage.alarmTime = ms
        },
        deleteAlarm: async () => {
            this.storage.alarmTime = null
        },
    }
}

describe('Phase 3: Hardware Lease State Mutex (AudioLeaseDO)', () => {
    let mockState: any
    let mockEnv: Env
    let audioDO: any

    beforeEach(async () => {
        mockState = new MockDurableObjectState()
        mockEnv = {
            AUDIO_LEASE_DO: {
                idFromName: () => ({}),
                get: () => audioDO,
            } as any,
            CANON_DB: {} as any,
            AUDIO_STEMS_BUCKET: {} as any,
            CF_ACCESS_CLIENT_ID: 'access_id',
            CF_ACCESS_CLIENT_SECRET: 'access_sec',
        }

        const { AudioLeaseDO } =
            await import('../../src/objects/AudioLeaseDO.js')
        audioDO = new AudioLeaseDO(mockState, mockEnv)
    })

    it('acquires hardware lease and issues monotonic epoch token N=2', async () => {
        const req = new Request('http://localhost/lease/acquire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                holderId: 'worker_rig1',
                lineId: 'ep01_sc01_sh01',
            }),
        })

        const res = await audioDO.fetch(req)
        expect(res.status).toBe(200)

        const body = (await res.json()) as any
        expect(body.status).toBe('LEASE_GRANTED')
        expect(body.lease.epoch).toBe(2) // Initial epoch 1 increments to 2
        expect(body.lease.holderId).toBe('worker_rig1')
        expect(body.lease.lineId).toBe('ep01_sc01_sh01')
        expect(mockState.storage.alarmTime).toBeGreaterThan(Date.now())
    })

    it('rejects concurrent lease requests with HTTP 409 Conflict', async () => {
        // Acquire initial lease
        await audioDO.fetch(
            new Request('http://localhost/lease/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holderId: 'worker_rig1',
                    lineId: 'line_01',
                }),
            }),
        )

        // Attempt concurrent acquire by second worker
        const concurrentReq = new Request('http://localhost/lease/acquire', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                holderId: 'worker_rig2',
                lineId: 'line_02',
            }),
        })

        const res = await audioDO.fetch(concurrentReq)
        expect(res.status).toBe(409)

        const body = (await res.json()) as any
        expect(body.error).toBe('HARDWARE_MUTEX_BUSY')
        expect(body.code).toBe('LEASE_CONFLICT')
    })

    it('renews lease expiration via valid heartbeat', async () => {
        const acquireRes = await audioDO.fetch(
            new Request('http://localhost/lease/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holderId: 'worker_rig1',
                    lineId: 'line_01',
                }),
            }),
        )
        const { lease } = (await acquireRes.json()) as any

        const heartbeatRes = await audioDO.fetch(
            new Request('http://localhost/lease/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leaseId: lease.leaseId,
                    epoch: lease.epoch,
                    ttlMs: 40000,
                }),
            }),
        )

        expect(heartbeatRes.status).toBe(200)
        const body = (await heartbeatRes.json()) as any
        expect(body.status).toBe('HEARTBEAT_ACKNOWLEDGED')
        expect(body.epoch).toBe(lease.epoch)
    })

    it('rejects stale epoch tokens on heartbeat with HTTP 409 ZOMBIE_LEASE_EPOCH', async () => {
        const acquireRes = await audioDO.fetch(
            new Request('http://localhost/lease/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holderId: 'worker_rig1',
                    lineId: 'line_01',
                }),
            }),
        )
        const { lease } = (await acquireRes.json()) as any

        // Dispatch heartbeat with obsolete epoch
        const staleHeartbeatRes = await audioDO.fetch(
            new Request('http://localhost/lease/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leaseId: lease.leaseId,
                    epoch: lease.epoch - 1,
                }),
            }),
        )

        expect(staleHeartbeatRes.status).toBe(409)
        const body = (await staleHeartbeatRes.json()) as any
        expect(body.error).toBe('ZOMBIE_LEASE_EPOCH')
        expect(body.code).toBe('FENCING_BREACH')
    })

    it('releases lease, deletes watchdog alarm, and increments monotonic epoch', async () => {
        const acquireRes = await audioDO.fetch(
            new Request('http://localhost/lease/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holderId: 'worker_rig1',
                    lineId: 'line_01',
                }),
            }),
        )
        const { lease } = (await acquireRes.json()) as any
        expect(mockState.storage.alarmTime).not.toBeNull()

        const releaseRes = await audioDO.fetch(
            new Request('http://localhost/lease/release', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    leaseId: lease.leaseId,
                    epoch: lease.epoch,
                }),
            }),
        )

        expect(releaseRes.status).toBe(200)
        const body = (await releaseRes.json()) as any
        expect(body.status).toBe('LEASE_RELEASED')
        expect(body.nextEpoch).toBe(lease.epoch + 1)
        expect(mockState.storage.alarmTime).toBeNull() // Disarmed alarm
    })

    it('watchdog alarm revokes stalled lease and advances epoch to fence dead worker', async () => {
        const acquireRes = await audioDO.fetch(
            new Request('http://localhost/lease/acquire', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    holderId: 'worker_rig1',
                    lineId: 'line_01',
                }),
            }),
        )
        const { lease } = (await acquireRes.json()) as any

        // Trigger watchdog alarm timeout directly
        await audioDO.alarm()

        // Status shows un-locked state and bumped epoch
        const statusRes = await audioDO.fetch(
            new Request('http://localhost/lease/status'),
        )
        const statusBody = (await statusRes.json()) as any
        expect(statusBody.isLocked).toBe(false)
        expect(statusBody.currentEpoch).toBe(lease.epoch + 1)

        // Stalled worker returning after timeout receives HTTP 409
        const lateHeartbeatRes = await audioDO.fetch(
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
    })
})
