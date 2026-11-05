import { Hono } from 'hono'
import type { Env } from './types/env.js'
import { authGate } from './middleware/authGate.js'
import { intentSanitizer } from './middleware/intentSanitizer.js'
import { astRoutes } from './routes/astRoutes.js'
import { stemRoutes } from './routes/stemRoutes.js'
import { AudioLeaseDO } from './objects/AudioLeaseDO.js'
import { purgeOrphanedStagingBuffers } from './crons/sweeper.js'

export { AudioLeaseDO }

const app = new Hono<{ Bindings: Env }>()

// Ingress Security Perimeter Middleware Pipeline
app.use('*', authGate)
app.use('*', intentSanitizer)

// Public Diagnostics
app.get('/health', (c) => {
    return c.json({
        status: 'HEALTHY',
        service: 'microservice-audio-worker',
        timestampMs: Date.now(),
    })
})

app.get('/', (c) => {
    return c.text('MICROSERVICE AUDIO EDGE GATEWAY ONLINE')
})

// Dialogue AST Validation Sub-Router
app.route('/ast', astRoutes)

// Edge Asset Relay R2 Storage Adapter Sub-Router
app.route('/stems', stemRoutes)

// Track 2: Zero Duration WebSocket Telemetry Hub Ingress
app.get('/ws/telemetry', async (c) => {
    if (c.req.header('Upgrade') !== 'websocket') {
        return c.text('Expected Upgrade: websocket', 426)
    }
    const id = c.env.AUDIO_LEASE_DO.idFromName('global_audio_hardware_mutex')
    const stub = c.env.AUDIO_LEASE_DO.get(id)
    return await stub.fetch(c.req.raw)
})

app.get('/ws', async (c) => {
    if (c.req.header('Upgrade') !== 'websocket') {
        return c.text('Expected Upgrade: websocket', 426)
    }
    const id = c.env.AUDIO_LEASE_DO.idFromName('global_audio_hardware_mutex')
    const stub = c.env.AUDIO_LEASE_DO.get(id)
    return await stub.fetch(c.req.raw)
})

app.post('/lease/request', (c) => {
    const auth = c.get('auth')
    return c.json({
        status: 'LEASE_REQUEST_ACCEPTED',
        authenticatedRole: auth.role,
        timestampMs: Date.now(),
    })
})

// Single-Threaded Audio Hardware Mutex Gateway Delegation
app.all('/lease/*', async (c) => {
    const id = c.env.AUDIO_LEASE_DO.idFromName('global_audio_hardware_mutex')
    const stub = c.env.AUDIO_LEASE_DO.get(id)

    const url = new URL(c.req.url)
    const doRequest = new Request(url.toString(), c.req.raw)

    return await stub.fetch(doRequest)
})

app.post('/synthesize', (c) => {
    const auth = c.get('auth')
    return c.json({
        status: 'SYNTHESIS_INTENT_DISPATCHED',
        clientRole: auth.role,
        dispatchedAtMs: Date.now(),
    })
})

export default {
    fetch: app.fetch,
    async scheduled(event: any, env: Env, ctx: any): Promise<void> {
        ctx.waitUntil(purgeOrphanedStagingBuffers(env))
    },
}
