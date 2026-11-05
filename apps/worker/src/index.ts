import { Hono } from 'hono'
import type { Env } from './types/env.js'
import { authGate } from './middleware/authGate.js'
import { intentSanitizer } from './middleware/intentSanitizer.js'
import { AudioLeaseDO } from './objects/AudioLeaseDO.js'

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
    // Use named singleton ID to enforce global single-tenant hardware coordination for Rig 1
    const id = c.env.AUDIO_LEASE_DO.idFromName('global_audio_hardware_mutex')
    const stub = c.env.AUDIO_LEASE_DO.get(id)

    // Strip prefix or preserve URL path
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
}
