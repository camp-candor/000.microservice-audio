import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import app from '../../src/index.js'
import type { Env } from '../../src/types/env.js'

const MOCK_SECRET = 'studio_super_secret_edge_gateway_token_2026'

const generateHmac = (secret: string, body: string): string =>
    crypto.createHmac('sha256', secret).update(body).digest('hex')

const mockEnv: Env = {
    AUDIO_LEASE_DO: {} as any,
    CANON_DB: {} as any,
    AUDIO_STEMS_BUCKET: {} as any,
    AUDIO_GATEWAY_SECRET: MOCK_SECRET,
    CF_ACCESS_CLIENT_ID: 'access_client_id_001',
    CF_ACCESS_CLIENT_SECRET: 'access_client_secret_001',
}

describe('Phase 2: Ingress Route Authentication Guard', () => {
    it('allows public access to /health without credentials', async () => {
        const res = await app.fetch(
            new Request('http://localhost/health'),
            mockEnv as any,
        )
        expect(res.status).toBe(200)
        const body = (await res.json()) as any
        expect(body.status).toBe('HEALTHY')
    })

    it('rejects protected routes when authentication is missing with HTTP 401', async () => {
        const res = await app.fetch(
            new Request('http://localhost/lease/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sceneId: 'ep01_sc01' }),
            }),
            mockEnv as any,
        )

        expect(res.status).toBe(401)
        const body = (await res.json()) as any
        expect(body.error.code).toBe('UNAUTHORIZED_ACCESS')
    })

    it('authenticates valid HMAC signatures in constant time', async () => {
        const payload = JSON.stringify({
            sceneId: 'ep01_sc01',
            characterId: 'char_octavius',
        })
        const signature = generateHmac(MOCK_SECRET, payload)

        const res = await app.fetch(
            new Request('http://localhost/lease/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Signature-256': signature,
                    'X-Audio-Key-Id': 'key_alpha',
                },
                body: payload,
            }),
            mockEnv as any,
        )

        expect(res.status).toBe(200)
        const body = (await res.json()) as any
        expect(body.status).toBe('LEASE_REQUEST_ACCEPTED')
        expect(body.authenticatedRole).toBe('artist-viewport')
        expect(res.headers.has('X-Edge-Auth-Latency-Ms')).toBe(true)
    })

    it('rejects tampered HMAC signatures with HTTP 401', async () => {
        const payload = JSON.stringify({ sceneId: 'ep01_sc01' })
        const signature = generateHmac('wrong_secret', payload)

        const res = await app.fetch(
            new Request('http://localhost/lease/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Signature-256': signature,
                },
                body: payload,
            }),
            mockEnv as any,
        )

        expect(res.status).toBe(401)
        const body = (await res.json()) as any
        expect(body.error.code).toBe('UNAUTHORIZED_ACCESS')
    })

    it('authenticates valid Cloudflare Access Service Tokens as system-conductor', async () => {
        const res = await app.fetch(
            new Request('http://localhost/lease/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CF-Access-Client-Id': 'access_client_id_001',
                    'CF-Access-Client-Secret': 'access_client_secret_001',
                },
                body: JSON.stringify({ sceneId: 'ep01_sc01' }),
            }),
            mockEnv as any,
        )

        expect(res.status).toBe(200)
        const body = (await res.json()) as any
        expect(body.authenticatedRole).toBe('system-conductor')
    })

    it('rejects invalid Cloudflare Access Service Tokens with HTTP 403', async () => {
        const res = await app.fetch(
            new Request('http://localhost/lease/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CF-Access-Client-Id': 'access_client_id_001',
                    'CF-Access-Client-Secret': 'invalid_secret_token',
                },
                body: JSON.stringify({ sceneId: 'ep01_sc01' }),
            }),
            mockEnv as any,
        )

        expect(res.status).toBe(403)
        const body = (await res.json()) as any
        expect(body.error.code).toBe('INVALID_SERVICE_TOKEN')
    })

    it('traps command injection attempts via intentSanitizer with HTTP 403', async () => {
        const payload = JSON.stringify({
            sceneId: 'ep01_sc01',
            rawSql: 'DROP TABLE active_leases;',
        })
        const signature = generateHmac(MOCK_SECRET, payload)

        const res = await app.fetch(
            new Request('http://localhost/synthesize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Signature-256': signature,
                },
                body: payload,
            }),
            mockEnv as any,
        )

        expect(res.status).toBe(403)
        const body = (await res.json()) as any
        expect(body.error.code).toBe('FORBIDDEN_COMMAND_INJECTION')
        expect(body.error.message).toContain('rawSql')
    })

    it('traps non-ASCII unicode emoji injections in intent payloads with HTTP 403', async () => {
        const payload = JSON.stringify({
            sceneId: 'ep01_sc01',
            text: 'Hold the gates! \u{1F6E1}\u{FE0F}',
        })
        const signature = generateHmac(MOCK_SECRET, payload)

        const res = await app.fetch(
            new Request('http://localhost/synthesize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Signature-256': signature,
                },
                body: payload,
            }),
            mockEnv as any,
        )

        expect(res.status).toBe(403)
        const body = (await res.json()) as any
        expect(body.error.code).toBe('FORBIDDEN_COMMAND_INJECTION')
        expect(body.error.message).toContain('NON_ASCII_CHARACTER_DETECTED')
    })
})
