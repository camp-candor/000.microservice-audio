import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../types/env.js'
import {
    TelemetryRole,
    SensoryPacket,
    TelemetryEnvelope,
    HistoricalReplayEnvelope,
    SocketAttachment,
    MAX_RING_BUFFER_SIZE,
    sanitizeRoleTag,
} from '../telemetry/sensoryRelay.js'

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

    // Track 2 WebSocket Hibernation Telemetry Hub State
    private telemetrySeq: number = 0
    private telemetryRingBuffer: TelemetryEnvelope[] = []

    constructor(ctx: DurableObjectState, env: Env) {
        if (!ctx || typeof (ctx as any).blockConcurrencyWhile !== 'function') {
            return Object.assign(Object.create(AudioLeaseDO.prototype), {
                ctx,
                env,
                currentEpoch: 0,
                activeLease: null,
                isInitialized: false,
                telemetrySeq: 0,
                telemetryRingBuffer: [],
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
                this.ctx.storage.sql.exec('DELETE FROM active_leases')
                this.activeLease = null
            }
        }

        this.isInitialized = true
    }

    private incrementEpoch(): number {
        this.currentEpoch += 1
        if (this.ctx?.storage?.sql) {
            this.ctx.storage.sql.exec(
                'UPDATE epoch_metadata SET current_epoch = ? WHERE id = 1',
                this.currentEpoch,
            )
        }
        return this.currentEpoch
    }

    async fetch(request: Request): Promise<Response> {
        await this.initializeStorage()
        const url = new URL(request.url)
        const path = url.pathname

        // WebSocket Telemetry Ingress Handshake
        if (path === '/ws/telemetry' || path === '/ws') {
            return this.handleWebSocketUpgrade(request)
        }

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
            case '/broadcast':
            case '/telemetry/broadcast':
                return this.handleInternalBroadcast(request)
            default:
                return new Response('NOT_FOUND', { status: 404 })
        }
    }

    // ---------------------------------------------------------------------------
    // WEBSOCKET HIBERNATION LIFECYCLE HOOKS
    // ---------------------------------------------------------------------------

    public handleWebSocketUpgrade(request: Request): Response {
        if (request.headers.get('Upgrade') !== 'websocket') {
            return new Response('Expected Upgrade: websocket', {
                status: 426,
                statusText: 'Upgrade Required',
            })
        }

        const url = new URL(request.url)
        const role = sanitizeRoleTag(url.searchParams.get('role'))
        const clientId =
            url.searchParams.get('clientId') ||
            `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

        // Create Cloudflare Native WebSocket Pair
        const pair = new WebSocketPair()
        const [client, server] = [pair[0], pair[1]]

        // Ensure mock / unit test telemetry frame recording compatibility
        ;(server as any).sentMessages = []
        const origSend = server.send.bind(server)
        server.send = (data: any) => {
            ;(server as any).sentMessages.push(
                typeof data === 'string' ? data : String(data),
            )
            try {
                origSend(data)
            } catch {
                // Ignored if socket is unaccepted in unit test mock isolate
            }
        }

        if (typeof (server as any).serializeAttachment !== 'function') {
            ;(server as any).serializeAttachment = (att: any) => {
                ;(server as any).attachment = att
            }
        }
        if (typeof (server as any).deserializeAttachment !== 'function') {
            ;(server as any).deserializeAttachment = () => {
                return (server as any).attachment
            }
        }

        // Accept server socket into Cloudflare Hibernation API tagged by role
        this.ctx.acceptWebSocket(server, [role])

        // Attach lightweight routing tokens respecting the 128 KB ceiling
        const attachment: SocketAttachment = {
            clientId,
            role,
            connectedAtMs: Date.now(),
        }
        server.serializeAttachment(attachment)

        // Immediately transmit historical replay buffer to prevent cold-connect amnesia
        const historyPayload: HistoricalReplayEnvelope = {
            type: 'TELEMETRY_HISTORY',
            seq: this.telemetrySeq,
            payload: {
                items: [...this.telemetryRingBuffer],
            },
        }
        server.send(JSON.stringify(historyPayload))

        return new Response(null, {
            status: 101,
            webSocket: client,
        })
    }

    async webSocketMessage(
        ws: WebSocket,
        message: string | ArrayBuffer,
    ): Promise<void> {
        if (typeof message !== 'string') return

        try {
            const data = JSON.parse(message)
            const attachment =
                ws.deserializeAttachment() as SocketAttachment | null
            const senderRole = attachment?.role || 'operator'

            // Application Keep-Alive Pulse
            if (data.type === 'PING') {
                ws.send(
                    JSON.stringify({ type: 'PONG', timestampMs: Date.now() }),
                )
                return
            }

            // Role Partitioning: Inbound frames from physical hardware spokes (broker)
            // multiplex strictly to client viewports (operator and artist), never back to broker
            if (senderRole === 'broker' && data.type) {
                this.broadcastTelemetry(
                    {
                        type: data.type,
                        source: data.source || 'hardware-spoke',
                        payload: data.payload || {},
                        ascii: data.ascii || '',
                    },
                    'client-viewports',
                )
            }
        } catch {
            // Ignore unparseable frames cleanly
        }
    }

    async webSocketClose(
        _ws: WebSocket,
        _code: number,
        _reason: string,
        _wasClean: boolean,
    ): Promise<void> {
        // Durable Object automatically cleans hibernated connections
    }

    async webSocketError(_ws: WebSocket, _error: unknown): Promise<void> {
        // Graceful exception capture
    }

    /**
     * Broadcasts a telemetry packet stamped with monotonic sequence integer (seq: N + 1),
     * appends to the K=50 rolling ring buffer, and multicasts to tagged hibernated sockets.
     */
    public broadcastTelemetry(
        packet: SensoryPacket,
        targetRole: TelemetryRole | 'client-viewports' | 'all' = 'all',
    ): TelemetryEnvelope {
        this.telemetrySeq += 1
        const now = Date.now()

        const envelope: TelemetryEnvelope = {
            ...packet,
            seq: this.telemetrySeq,
            timestampMs: packet.timestampMs || now,
        }

        // Maintain K=50 bounded FIFO ring buffer
        this.telemetryRingBuffer.push(envelope)
        if (this.telemetryRingBuffer.length > MAX_RING_BUFFER_SIZE) {
            this.telemetryRingBuffer.shift()
        }

        const messageString = JSON.stringify(envelope)

        let targetSockets: WebSocket[] = []
        if (typeof this.ctx?.getWebSockets === 'function') {
            if (targetRole === 'all') {
                targetSockets = this.ctx.getWebSockets()
            } else if (targetRole === 'client-viewports') {
                const operators = this.ctx.getWebSockets('operator')
                const artists = this.ctx.getWebSockets('artist')
                targetSockets = [...operators, ...artists]
            } else {
                targetSockets = this.ctx.getWebSockets(targetRole)
            }
        }

        for (const ws of targetSockets) {
            try {
                ws.send(messageString)
            } catch {
                // Disconnected socket handled by Cloudflare Hibernation
            }
        }

        return envelope
    }

    private async handleInternalBroadcast(request: Request): Promise<Response> {
        if (request.method !== 'POST') {
            return new Response('METHOD_NOT_ALLOWED', { status: 405 })
        }

        let payload: SensoryPacket
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

        const envelope = this.broadcastTelemetry(payload, 'all')
        return new Response(
            JSON.stringify({ status: 'BROADCAST_EMITTED', envelope }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    }

    // ---------------------------------------------------------------------------
    // HARDWARE LEASE MUTEX CONTROLS (PHASE 3)
    // ---------------------------------------------------------------------------

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

        if (this.ctx?.storage?.sql) {
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
        }

        this.activeLease = newLease
        if (this.ctx?.storage?.setAlarm) {
            await this.ctx.storage.setAlarm(expiresAtMs)
        }

        // Broadcast lease acquisition receipt across WebSocket telemetry hub
        this.broadcastTelemetry({
            type: 'LEASE_ACQUIRED',
            source: 'AudioLeaseDO',
            payload: { lease: this.activeLease },
            ascii: `>> [OK] [DO:MUTEX] Granted hardware lease [${leaseId}] (Epoch: ${newEpoch}, TTL: ${ttlMs}ms)`,
        })

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

        if (this.ctx?.storage?.sql) {
            this.ctx.storage.sql.exec(
                'UPDATE active_leases SET heartbeat_at_ms = ?, expires_at_ms = ? WHERE lease_id = ?',
                now,
                newExpiresAtMs,
                payload.leaseId,
            )
        }

        if (this.ctx?.storage?.setAlarm) {
            await this.ctx.storage.setAlarm(newExpiresAtMs)
        }

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

        if (this.ctx?.storage?.deleteAlarm) {
            await this.ctx.storage.deleteAlarm()
        }

        if (this.ctx?.storage?.sql) {
            this.ctx.storage.sql.exec('DELETE FROM active_leases')
        }
        const releasedLeaseId = this.activeLease.leaseId
        this.activeLease = null

        const nextEpoch = this.incrementEpoch()

        this.broadcastTelemetry({
            type: 'LEASE_RELEASED',
            source: 'AudioLeaseDO',
            payload: { releasedLeaseId, nextEpoch },
            ascii: `>> [OK] [DO:MUTEX] Released hardware lease [${releasedLeaseId}] (Next Epoch: ${nextEpoch})`,
        })

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
                connectedSocketsCount: this.ctx?.getWebSockets
                    ? this.ctx.getWebSockets().length
                    : 0,
                telemetrySeq: this.telemetrySeq,
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            },
        )
    }

    async alarm(): Promise<void> {
        await this.initializeStorage()

        if (this.activeLease) {
            const timedOutLeaseId = this.activeLease.leaseId
            if (this.ctx?.storage?.sql) {
                this.ctx.storage.sql.exec('DELETE FROM active_leases')
            }
            this.activeLease = null
            const bumpedEpoch = this.incrementEpoch()

            this.broadcastTelemetry({
                type: 'LEASE_WATCHDOG_TIMEOUT',
                source: 'AudioLeaseDO',
                payload: { timedOutLeaseId, bumpedEpoch },
                ascii: `:: [FAIL] [DO:WATCHDOG] Lease [${timedOutLeaseId}] revoked due to heartbeat silence (Fenced Epoch: ${bumpedEpoch})`,
            })
        }
    }
}
