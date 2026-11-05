import type { MiddlewareHandler } from 'hono'
import type { Env } from '../types/env.js'

export interface AuthContext {
    role: 'system-conductor' | 'artist-viewport' | 'service-broker'
    keyId?: string
    authenticatedAtMs: number
}

declare module 'hono' {
    interface ContextVariableMap {
        auth: AuthContext
    }
}

const hexToUint8Array = (hex: string): Uint8Array => {
    const cleanHex = hex.startsWith('sha256=') ? hex.slice(7) : hex
    const match = cleanHex.match(/.{1,2}/g)
    if (!match || cleanHex.length !== 64) {
        throw new Error('INVALID_HEX_LENGTH')
    }
    return new Uint8Array(match.map((byte) => parseInt(byte, 16)))
}

export const verifyHmacSignature = async (
    secret: string,
    rawBody: string,
    signatureHex: string,
): Promise<boolean> => {
    try {
        const encoder = new TextEncoder()
        const keyData = encoder.encode(secret)
        const bodyData = encoder.encode(rawBody)
        const signatureBytes = hexToUint8Array(signatureHex)

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['verify'],
        )

        return await crypto.subtle.verify(
            'HMAC',
            cryptoKey,
            signatureBytes,
            bodyData,
        )
    } catch {
        return false
    }
}

export const authGate: MiddlewareHandler<{ Bindings: Env }> = async (
    c,
    next,
) => {
    const t0 = performance.now()
    const path = c.req.path

    // Public diagnostics bypass
    if (path === '/health' || path === '/') {
        await next()
        return
    }

    // 1. Cloudflare Access Service Token Verification (Priority Fast Path)
    const cfClientId = c.req.header('CF-Access-Client-Id')
    const cfClientSecret = c.req.header('CF-Access-Client-Secret')

    if (cfClientId && cfClientSecret) {
        const expectedId = c.env.CF_ACCESS_CLIENT_ID
        const expectedSecret = c.env.CF_ACCESS_CLIENT_SECRET

        if (
            expectedId &&
            expectedSecret &&
            cfClientId === expectedId &&
            cfClientSecret === expectedSecret
        ) {
            c.set('auth', {
                role: 'system-conductor',
                keyId: cfClientId,
                authenticatedAtMs: Date.now(),
            })
            c.header(
                'X-Edge-Auth-Latency-Ms',
                (performance.now() - t0).toFixed(2),
            )
            await next()
            return
        }

        return c.json(
            {
                error: {
                    code: 'INVALID_SERVICE_TOKEN',
                    message: 'Cloudflare Access Service Token rejected.',
                },
            },
            403,
        )
    }

    // 2. Native Web Crypto Constant-Time HMAC Signature Verification
    const signature = c.req.header('X-Signature-256')
    const keyId = c.req.header('X-Audio-Key-Id')
    const gatewaySecret = c.env.AUDIO_GATEWAY_SECRET

    if (!signature || !gatewaySecret) {
        return c.json(
            {
                error: {
                    code: 'UNAUTHORIZED_ACCESS',
                    message:
                        'Missing required authentication signature or service credentials.',
                },
            },
            401,
        )
    }

    let rawBody = ''
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
        rawBody = await c.req.raw.clone().text()
    }

    const isValid = await verifyHmacSignature(gatewaySecret, rawBody, signature)

    if (!isValid) {
        return c.json(
            {
                error: {
                    code: 'UNAUTHORIZED_ACCESS',
                    message: 'Cryptographic signature verification failed.',
                },
            },
            401,
        )
    }

    c.set('auth', {
        role: 'artist-viewport',
        keyId: keyId || 'default-hmac-client',
        authenticatedAtMs: Date.now(),
    })

    c.header('X-Edge-Auth-Latency-Ms', (performance.now() - t0).toFixed(2))
    await next()
}
