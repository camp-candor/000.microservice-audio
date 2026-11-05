import { describe, it, expect } from 'vitest'
import app, { AudioLeaseDO } from '../../src/index.js'

describe('Phase 1: Edge Worker Workspace Scaffolding Setup', () => {
    it('GET /health returns HTTP 200 with HEALTHY status payload', async () => {
        const res = await app.fetch(
            new Request('http://localhost/health'),
            {} as any,
        )
        expect(res.status).toBe(200)

        const body = (await res.json()) as any
        expect(body.status).toBe('HEALTHY')
        expect(body.service).toBe('microservice-audio-worker')
        expect(typeof body.timestampMs).toBe('number')
    })

    it('GET / returns root gateway banner', async () => {
        const res = await app.fetch(new Request('http://localhost/'), {} as any)
        expect(res.status).toBe(200)
        const text = await res.text()
        expect(text).toBe('MICROSERVICE AUDIO EDGE GATEWAY ONLINE')
    })

    it('verifies pure 7-bit ASCII text response', async () => {
        const res = await app.fetch(new Request('http://localhost/'), {} as any)
        const text = await res.text()
        expect(/^[\x20-\x7E\r\n\t]+$/.test(text)).toBe(true)
    })

    it('instantiates AudioLeaseDO and handles fetch', async () => {
        const leaseDO = new AudioLeaseDO({} as any, {} as any)
        const res = await leaseDO.fetch(new Request('http://localhost/'))
        expect(res.status).toBe(200)
        const text = await res.text()
        expect(text).toBe('AUDIO_LEASE_DO_ONLINE')
    })
})
