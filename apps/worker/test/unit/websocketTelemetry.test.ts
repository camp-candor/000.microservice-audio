import { describe, it, expect, beforeEach } from 'vitest'
import app from '../../src/index.js'
import type { Env } from '../../src/types/env.js'
import { MAX_RING_BUFFER_SIZE } from '../../src/telemetry/sensoryRelay.js'

class MockWebSocket {
    public sentMessages: string[] = []
    public attachment: any = null
    public tags: string[] = []

    send(data: string) {
        this.sentMessages.push(data)
    }

    serializeAttachment(attachment: any) {
        this.attachment = attachment
    }

    deserializeAttachment() {
        return this.attachment
    }
}

class MockDurableObjectState {
    public sockets: MockWebSocket[] = []
    public storage = {
        sql: {
            exec: () => ({ toArray: () => [] }),
        },
        setAlarm: async () => {},
        deleteAlarm: async () => {},
    }

    acceptWebSocket(ws: any, tags: string[] = []) {
        ws.tags = tags
        this.sockets.push(ws)
    }

    getWebSockets(tag?: string) {
        if (!tag) return this.sockets
        return this.sockets.filter((s) => s.tags.includes(tag))
    }
}

describe('Phase 4: Zero Duration WebSocket Telemetry Hub', () => {
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
        }

        const { AudioLeaseDO } =
            await import('../../src/objects/AudioLeaseDO.js')
        audioDO = new AudioLeaseDO(mockState, mockEnv)
    })

    it('rejects plain HTTP GET requests lacking Upgrade header with HTTP 426', async () => {
        const req = new Request('http://localhost/ws/telemetry', {
            method: 'GET',
        })
        const res = await app.fetch(req, mockEnv as any)

        expect(res.status).toBe(426)
        const body = await res.text()
        expect(body).toBe('Expected Upgrade: websocket')
    })

    it('accepts valid WebSocket upgrades with HTTP 101 and transmits historical replay packet', async () => {
        const req = new Request('http://localhost/ws/telemetry?role=operator', {
            method: 'GET',
            headers: { Upgrade: 'websocket' },
        })

        const res = await audioDO.fetch(req)
        expect(res.status).toBe(101)
        expect(mockState.sockets.length).toBe(1)

        const serverSocket = mockState.sockets[0]
        expect(serverSocket.tags).toContain('operator')

        // Historical replay packet was sent immediately upon connection
        expect(serverSocket.sentMessages.length).toBe(1)
        const history = JSON.parse(serverSocket.sentMessages[0])
        expect(history.type).toBe('TELEMETRY_HISTORY')
        expect(Array.isArray(history.payload.items)).toBe(true)
    })

    it('stamps monotonic sequence numbers (seq: N + 1) on successive broadcasts', async () => {
        const ws = new MockWebSocket()
        mockState.acceptWebSocket(ws, ['operator'])

        const p1 = audioDO.broadcastTelemetry({
            type: 'SYNTHESIS_PROGRESS',
            source: 'PiperEngine',
            payload: { progress: 25 },
            ascii: '>> [OK] [SYNTH:PROGRESS] Piper 25% complete',
        })

        const p2 = audioDO.broadcastTelemetry({
            type: 'SYNTHESIS_PROGRESS',
            source: 'PiperEngine',
            payload: { progress: 50 },
            ascii: '>> [OK] [SYNTH:PROGRESS] Piper 50% complete',
        })

        expect(p1.seq).toBe(1)
        expect(p2.seq).toBe(2)
        expect(ws.sentMessages.length).toBe(2)

        const frame2 = JSON.parse(ws.sentMessages[1])
        expect(frame2.seq).toBe(2)
        expect(frame2.ascii).toContain('50%')
    })

    it('partitions role-based multicasting so broker packets route to operator/artist, not brokers', async () => {
        const operatorWs = new MockWebSocket()
        const artistWs = new MockWebSocket()
        const brokerWs = new MockWebSocket()

        mockState.acceptWebSocket(operatorWs, ['operator'])
        mockState.acceptWebSocket(artistWs, ['artist'])
        mockState.acceptWebSocket(brokerWs, ['broker'])

        // Broker client simulates incoming hardware progress frame
        brokerWs.serializeAttachment({
            clientId: 'rig1',
            role: 'broker',
            connectedAtMs: Date.now(),
        })

        await audioDO.webSocketMessage(
            brokerWs,
            JSON.stringify({
                type: 'HARDWARE_GPU_PROGRESS',
                source: 'Rig1Hw',
                payload: { vramUsedMb: 0 },
                ascii: '>> [OK] [HW:PROGRESS] Rig 1 synthesized 128 frames',
            }),
        )

        // Operator and Artist received the relayed packet
        expect(operatorWs.sentMessages.length).toBe(1)
        expect(artistWs.sentMessages.length).toBe(1)
        // The broker socket itself must not receive the echo
        expect(brokerWs.sentMessages.length).toBe(0)
    })

    it('maintains bounded ring buffer size (M <= 50) under high-frequency event bursts', async () => {
        const ws = new MockWebSocket()
        mockState.acceptWebSocket(ws, ['operator'])

        for (let i = 1; i <= 65; i++) {
            audioDO.broadcastTelemetry({
                type: 'BURST_EVENT',
                source: 'LoadGen',
                payload: { tick: i },
                ascii: `>> [TICK] Event ${i}`,
            })
        }

        // Connect a new client and inspect its replay buffer length
        const req = new Request('http://localhost/ws/telemetry?role=operator', {
            method: 'GET',
            headers: { Upgrade: 'websocket' },
        })
        await audioDO.fetch(req)

        const newlyAccepted = mockState.sockets[mockState.sockets.length - 1]
        const history = JSON.parse(newlyAccepted.sentMessages[0])
        expect(history.payload.items.length).toBe(MAX_RING_BUFFER_SIZE)
        expect(history.payload.items[0].seq).toBe(16) // Oldest 1-15 evicted
        expect(history.payload.items[MAX_RING_BUFFER_SIZE - 1].seq).toBe(65)
    })

    it('verifies 100% pure 7-bit clean ASCII compliance across all emitted telemetry frames', async () => {
        const ws = new MockWebSocket()
        mockState.acceptWebSocket(ws, ['operator'])

        audioDO.broadcastTelemetry({
            type: 'ASCII_AUDIT',
            source: 'TelemetryHub',
            payload: { status: 'CLEAN' },
            ascii: '>> [OK] [WS:TELEMETRY] Pure 7-bit ASCII verified without emojis',
        })

        const rawMessage = ws.sentMessages[0]
        expect(/^[\x20-\x7E\r\n\t]+$/.test(rawMessage)).toBe(true)
    })
})
