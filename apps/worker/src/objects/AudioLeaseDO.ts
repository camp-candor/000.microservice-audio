import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../types/env.js'

export interface ActiveLeaseRecord {
    leaseId: string
    holderId: string
    lineId: string
    epoch: number
    acquiredAtMs: number
    heartbeatAtMs: number
    expiresAtMs: number
}

export interface AcquireLeasePayload {
    holderId: string
    lineId: string
    ttlMs?: number
}

export interface LeaseHeartbeatPayload {
    leaseId: string
    epoch: number
    ttlMs?: number
}

export interface ReleaseLeasePayload {
    leaseId: string
    epoch: number
}

export class AudioLeaseDO extends DurableObject {
    private currentEpoch: number = 0
    private activeLease: ActiveLeaseRecord | null = null
    private isInitialized: boolean = false

    constructor(ctx: DurableObjectState, env: Env) {
        if (!ctx || typeof (ctx as any).blockConcurrencyWhile !== 'function') {
            return Object.assign(Object.create(AudioLeaseDO.prototype), {
                ctx,
                env,
                currentEpoch: 0,
                activeLease: null,
                isInitialized: false,
            })
        }
        super(ctx, env)
    }

    private async initializeStorage(): Promise<void> {
        if (this.isInitialized) return
        if (!this.ctx?.storage?.sql) {
            this.isInitialized = true
            return
        }

        // Initialize SQLite relational schema for leases
        this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS active_leases (
        lease_id TEXT PRIMARY KEY,
        holder_id TEXT NOT NULL,
        line_id TEXT NOT NULL,
        epoch INTEGER NOT NULL,
        acquired_at_ms INTEGER NOT NULL,
        heartbeat_at_ms INTEGER NOT NULL,
        expires_at_ms INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS epoch_metadata (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        current_epoch INTEGER NOT NULL
      );
    `)

        // Hydrate current epoch
        const epochRow = this.ctx.storage.sql
            .exec('SELECT current_epoch FROM epoch_metadata WHERE id = 1')
            .toArray()

        if (epochRow.length > 0) {
            this.currentEpoch = Number(epochRow[0].current_epoch)
        } else {
            this.currentEpoch = 1
            this.ctx.storage.sql.exec(
                'INSERT INTO epoch_metadata (id, current_epoch) VALUES (1, 1)',
            )
        }

        // Hydrate active lease if unexpired
        const leaseRow = this.ctx.storage.sql
            .exec('SELECT * FROM active_leases LIMIT 1')
            .toArray()

        if (leaseRow.length > 0) {
            const row = leaseRow[0] as any
            if (row.expires_at_ms > Date.now()) {
                this.activeLease = {
                    leaseId: row.lease_id,
                    holderId: row.holder_id,
                    lineId: row.line_id,
                    epoch: Number(row.epoch),
                    acquiredAtMs: Number(row.acquired_at_ms),
                    heartbeatAtMs: Number(row.heartbeat_at_ms),
                    expiresAtMs: Number(row.expires_at_ms),
                }
            } else {
                // Expired on cold boot, clear record
                this.ctx.storage.sql.exec('DELETE FROM active_leases')
                this.activeLease = null
            }
        }

        this.isInitialized = true
    }

    private incrementEpoch(): number {
        this.currentEpoch += 1
        this.ctx.storage.sql.exec(
            'UPDATE epoch_metadata SET current_epoch = ? WHERE id = 1',
            this.currentEpoch,
        )
        return this.currentEpoch
    }

    async fetch(request: Request): Promise<Response> {
        await this.initializeStorage()
        const url = new URL(request.url)
        const path = url.pathname

        switch (path) {
            case '/':
                return new Response('AUDIO_LEASE_DO_ONLINE', { status: 200 })
            case '/acquire':
            case '/lease/acquire':
                return this.handleAcquire(request)
            case '/heartbeat':
            case '/lease/heartbeat':
                return this.handleHeartbeat(request)
            case '/release':
            case '/lease/release':
                return this.handleRelease(request)
            case '/status':
            case '/lease/status':
                return this.handleStatus()
            default:
                return new Response('NOT_FOUND', { status: 404 })
        }
    }

    private async handleAcquire(request: Request): Promise<Response> {
        if (request.method !== 'POST') {
            return new Response('METHOD_NOT_ALLOWED', { status: 405 })
        }

        let payload: AcquireLeasePayload
        try {
            payload = await request.json()
        } catch {
            return new Response(
                JSON.stringify({ error: 'INVALID_JSON_PAYLOAD' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        if (!payload.holderId || !payload.lineId) {
            return new Response(
                JSON.stringify({ error: 'MISSING_HOLDER_OR_LINE_ID' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        const now = Date.now()

        // Mutual Exclusion: If an active lease is present and not expired, reject with 409 Conflict
        if (this.activeLease && this.activeLease.expiresAtMs > now) {
            return new Response(
                JSON.stringify({
                    error: 'HARDWARE_MUTEX_BUSY',
                    code: 'LEASE_CONFLICT',
                    message:
                        'Hardware Rig 1 synthesis worker is actively leased.',
                    activeLease: {
                        leaseId: this.activeLease.leaseId,
                        holderId: this.activeLease.holderId,
                        lineId: this.activeLease.lineId,
                        epoch: this.activeLease.epoch,
                        expiresAtMs: this.activeLease.expiresAtMs,
                    },
                }),
                {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        // Advance Monotonic Epoch (N -> N+1)
        const newEpoch = this.incrementEpoch()
        const ttlMs =
            payload.ttlMs && payload.ttlMs > 0
                ? Math.min(payload.ttlMs, 60000)
                : 30000
        const expiresAtMs = now + ttlMs
        const leaseId = `lease_${payload.lineId}_${now}_ep${newEpoch}`

        const newLease: ActiveLeaseRecord = {
            leaseId,
            holderId: payload.holderId,
            lineId: payload.lineId,
            epoch: newEpoch,
            acquiredAtMs: now,
            heartbeatAtMs: now,
            expiresAtMs,
        }

        // Commit to SQLite storage atomically
        this.ctx.storage.sql.exec('DELETE FROM active_leases')
        this.ctx.storage.sql.exec(
            `INSERT INTO active_leases (
        lease_id, holder_id, line_id, epoch, acquired_at_ms, heartbeat_at_ms, expires_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            newLease.leaseId,
            newLease.holderId,
            newLease.lineId,
            newLease.epoch,
            newLease.acquiredAtMs,
            newLease.heartbeatAtMs,
            newLease.expiresAtMs,
        )

        this.activeLease = newLease

        // Arm the 30s storage alarm watchdog
        await this.ctx.storage.setAlarm(expiresAtMs)

        return new Response(
            JSON.stringify({
                status: 'LEASE_GRANTED',
                lease: this.activeLease,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    }

    private async handleHeartbeat(request: Request): Promise<Response> {
        if (request.method !== 'POST') {
            return new Response('METHOD_NOT_ALLOWED', { status: 405 })
        }

        let payload: LeaseHeartbeatPayload
        try {
            payload = await request.json()
        } catch {
            return new Response(
                JSON.stringify({ error: 'INVALID_JSON_PAYLOAD' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        if (!payload.leaseId || typeof payload.epoch !== 'number') {
            return new Response(
                JSON.stringify({ error: 'MISSING_LEASE_OR_EPOCH' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        // Monotonic Epoch Fencing: presented epoch must match active epoch exactly
        if (!this.activeLease || this.activeLease.leaseId !== payload.leaseId) {
            return new Response(
                JSON.stringify({
                    error: 'LEASE_NOT_FOUND',
                    message:
                        'No active lease matches the provided lease identifier.',
                }),
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        if (
            payload.epoch !== this.activeLease.epoch ||
            payload.epoch !== this.currentEpoch
        ) {
            return new Response(
                JSON.stringify({
                    error: 'ZOMBIE_LEASE_EPOCH',
                    code: 'FENCING_BREACH',
                    message: `Stale epoch [${payload.epoch}] rejected. Active epoch is [${this.currentEpoch}].`,
                    currentEpoch: this.currentEpoch,
                }),
                {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        const now = Date.now()
        const ttlMs =
            payload.ttlMs && payload.ttlMs > 0
                ? Math.min(payload.ttlMs, 60000)
                : 30000
        const newExpiresAtMs = now + ttlMs

        this.activeLease.heartbeatAtMs = now
        this.activeLease.expiresAtMs = newExpiresAtMs

        this.ctx.storage.sql.exec(
            'UPDATE active_leases SET heartbeat_at_ms = ?, expires_at_ms = ? WHERE lease_id = ?',
            now,
            newExpiresAtMs,
            payload.leaseId,
        )

        // Re-arm watchdog alarm to extended deadline
        await this.ctx.storage.setAlarm(newExpiresAtMs)

        return new Response(
            JSON.stringify({
                status: 'HEARTBEAT_ACKNOWLEDGED',
                epoch: this.activeLease.epoch,
                expiresAtMs: newExpiresAtMs,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    }

    private async handleRelease(request: Request): Promise<Response> {
        if (request.method !== 'POST') {
            return new Response('METHOD_NOT_ALLOWED', { status: 405 })
        }

        let payload: ReleaseLeasePayload
        try {
            payload = await request.json()
        } catch {
            return new Response(
                JSON.stringify({ error: 'INVALID_JSON_PAYLOAD' }),
                {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        if (!this.activeLease || this.activeLease.leaseId !== payload.leaseId) {
            return new Response(
                JSON.stringify({
                    error: 'LEASE_NOT_FOUND',
                    message: 'No active lease to release.',
                }),
                {
                    status: 404,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        // Fencing check on release
        if (payload.epoch !== this.activeLease.epoch) {
            return new Response(
                JSON.stringify({
                    error: 'ZOMBIE_LEASE_EPOCH',
                    code: 'FENCING_BREACH',
                    message: `Stale epoch [${payload.epoch}] cannot release lease at epoch [${this.activeLease.epoch}].`,
                }),
                {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                },
            )
        }

        // Delete watchdog alarm immediately upon lease completion
        await this.ctx.storage.deleteAlarm()

        // Clean SQLite active lease table
        this.ctx.storage.sql.exec('DELETE FROM active_leases')
        const releasedLeaseId = this.activeLease.leaseId
        this.activeLease = null

        // Advance epoch so subsequent acquires are cleanly fenced
        const nextEpoch = this.incrementEpoch()

        return new Response(
            JSON.stringify({
                status: 'LEASE_RELEASED',
                releasedLeaseId,
                nextEpoch,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    }

    private handleStatus(): Response {
        return new Response(
            JSON.stringify({
                status: 'DO_STATUS_OK',
                currentEpoch: this.currentEpoch,
                isLocked:
                    this.activeLease !== null &&
                    this.activeLease.expiresAtMs > Date.now(),
                activeLease: this.activeLease,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    }

    async alarm(): Promise<void> {
        await this.initializeStorage()

        // Watchdog triggered: lease timed out due to heartbeat silence
        if (this.activeLease) {
            this.ctx.storage.sql.exec('DELETE FROM active_leases')
            this.activeLease = null

            // Advance epoch to fence out dead worker if it attempts late completion
            this.incrementEpoch()
        }
    }
}
