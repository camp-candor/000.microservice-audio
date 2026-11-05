import { Hono } from 'hono'
import type { Env } from '../types/env.js'

export interface SignedUploadRequest {
    leaseId: string
    epoch: number
    seriesId: string
    sceneId: string
    stemId: string
}

export interface ConfirmStemRequest {
    leaseId: string
    epoch: number
    objectKey: string
    sha256: string
    durationMs: number
    byteLength: number
}

export const stemRoutes = new Hono<{ Bindings: Env }>()

const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/

/**
 * Validates active lease ownership with AudioLeaseDO before permitting R2 writes.
 */
async function verifyActiveLease(
    env: Env,
    leaseId: string,
    epoch: number,
): Promise<{ ok: boolean; status: number; error?: string }> {
    const id = env.AUDIO_LEASE_DO.idFromName('global_audio_hardware_mutex')
    const stub = env.AUDIO_LEASE_DO.get(id)

    const statusRes = await stub.fetch(
        new Request('http://localhost/lease/status'),
    )
    if (!statusRes.ok) {
        return { ok: false, status: 500, error: 'LEASE_DO_UNAVAILABLE' }
    }

    const status = (await statusRes.json()) as any
    if (!status.isLocked || !status.activeLease) {
        return { ok: false, status: 403, error: 'NO_ACTIVE_HARDWARE_LEASE' }
    }

    if (status.activeLease.leaseId !== leaseId) {
        return { ok: false, status: 403, error: 'LEASE_ID_MISMATCH' }
    }

    if (status.activeLease.epoch !== epoch || status.currentEpoch !== epoch) {
        return { ok: false, status: 409, error: 'ZOMBIE_LEASE_EPOCH' }
    }

    return { ok: true, status: 200 }
}

/**
 * Generates an authorized upload key and mock/presigned URL structure for direct R2 transmission.
 */
stemRoutes.post('/signed-upload', async (c) => {
    let body: SignedUploadRequest
    try {
        body = await c.req.json()
    } catch {
        return c.json(
            {
                error: {
                    code: 'INVALID_JSON_PAYLOAD',
                    message: 'Malformed JSON.',
                },
            },
            400,
        )
    }

    if (
        !body.leaseId ||
        typeof body.epoch !== 'number' ||
        !body.seriesId ||
        !body.sceneId ||
        !body.stemId
    ) {
        return c.json(
            {
                error: {
                    code: 'MISSING_PARAMETERS',
                    message:
                        'leaseId, epoch, seriesId, sceneId, and stemId are required.',
                },
            },
            400,
        )
    }

    // 1. Hardware Lease Arbitration Sentry
    const leaseCheck = await verifyActiveLease(c.env, body.leaseId, body.epoch)
    if (!leaseCheck.ok) {
        return c.json(
            {
                error: {
                    code: leaseCheck.error || 'UNAUTHORIZED_STORAGE_ACCESS',
                    message:
                        'Caller does not hold an active hardware synthesis lease.',
                },
            },
            leaseCheck.status as any,
        )
    }

    // 2. Derive deterministic content namespace
    const cleanSeries = body.seriesId.replace(/[^a-zA-Z0-9_-]/g, '')
    const cleanScene = body.sceneId.replace(/[^a-zA-Z0-9_-]/g, '')
    const cleanStem = body.stemId.replace(/[^a-zA-Z0-9_-]/g, '')

    const objectKey = `stems/${cleanSeries}/${cleanScene}/${cleanStem}.wav`
    const uploadUrl = `https://storage.microservice-audio.internal/${objectKey}`
    const expiresAtMs = Date.now() + 15 * 60 * 1000 // 15-minute upload window

    return c.json({
        status: 'SIGNED_UPLOAD_GRANTED',
        objectKey,
        uploadUrl,
        expiresAtMs,
        headers: {
            'Content-Type': 'audio/wav',
            'x-amz-meta-lease-id': body.leaseId,
            'x-amz-meta-epoch': String(body.epoch),
        },
    })
})

/**
 * Confirms uploaded stem, probes R2 object existence, checks byte length,
 * and commits cryptographic provenance to Cloudflare D1.
 */
stemRoutes.post('/confirm', async (c) => {
    let body: ConfirmStemRequest
    try {
        body = await c.req.json()
    } catch {
        return c.json(
            {
                error: {
                    code: 'INVALID_JSON_PAYLOAD',
                    message: 'Malformed JSON.',
                },
            },
            400,
        )
    }

    if (
        !body.leaseId ||
        typeof body.epoch !== 'number' ||
        !body.objectKey ||
        !body.sha256 ||
        typeof body.durationMs !== 'number' ||
        typeof body.byteLength !== 'number'
    ) {
        return c.json(
            {
                error: {
                    code: 'MISSING_PARAMETERS',
                    message:
                        'leaseId, epoch, objectKey, sha256, durationMs, and byteLength are required.',
                },
            },
            400,
        )
    }

    // 1. Cryptographic Hex Hash Validation
    if (!SHA256_HEX_REGEX.test(body.sha256)) {
        return c.json(
            {
                error: {
                    code: 'INVALID_SHA256_DIGEST',
                    message:
                        'sha256 must be a 64-character lowercase hexadecimal string.',
                },
            },
            400,
        )
    }

    // 2. Hardware Lease Mutex Verification
    const leaseCheck = await verifyActiveLease(c.env, body.leaseId, body.epoch)
    if (!leaseCheck.ok) {
        return c.json(
            {
                error: {
                    code: leaseCheck.error || 'UNAUTHORIZED_CONFIRMATION',
                    message: 'Active hardware lease required to commit stem.',
                },
            },
            leaseCheck.status as any,
        )
    }

    // 3. Probe R2 Object Existence & Invariant Verification
    const r2Head = await c.env.AUDIO_STEMS_BUCKET.head(body.objectKey)
    if (!r2Head) {
        return c.json(
            {
                error: {
                    code: 'OBJECT_NOT_FOUND_IN_R2',
                    message: `Object [${body.objectKey}] was not found in storage bucket.`,
                },
            },
            404,
        )
    }

    if (r2Head.size !== body.byteLength) {
        return c.json(
            {
                error: {
                    code: 'BYTE_LENGTH_MISMATCH',
                    message: `R2 object size (${r2Head.size}b) does not match reported byteLength (${body.byteLength}b).`,
                },
            },
            400,
        )
    }

    // 4. Commit to Relational D1 Stem Ledger
    const confirmedAtMs = Date.now()
    const stemId =
        body.objectKey.split('/').pop()?.replace('.wav', '') || body.objectKey

    try {
        if (c.env.CANON_DB?.prepare) {
            await c.env.CANON_DB.prepare(
                `
        CREATE TABLE IF NOT EXISTS audio_stem_ledger (
          stem_id TEXT PRIMARY KEY,
          object_key TEXT NOT NULL,
          sha256 TEXT NOT NULL,
          duration_ms INTEGER NOT NULL,
          byte_length INTEGER NOT NULL,
          epoch INTEGER NOT NULL,
          confirmed_at_ms INTEGER NOT NULL
        );
      `,
            ).run()

            await c.env.CANON_DB.prepare(
                `
        INSERT OR REPLACE INTO audio_stem_ledger (
          stem_id, object_key, sha256, duration_ms, byte_length, epoch, confirmed_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?);
      `,
            )
                .bind(
                    stemId,
                    body.objectKey,
                    body.sha256,
                    body.durationMs,
                    body.byteLength,
                    body.epoch,
                    confirmedAtMs,
                )
                .run()
        }
    } catch (err: any) {
        return c.json(
            {
                error: {
                    code: 'DATABASE_COMMIT_FAILED',
                    message: (err?.message || 'D1 insertion failed.').slice(
                        0,
                        150,
                    ),
                },
            },
            500,
        )
    }

    return c.json({
        status: 'STEM_CONFIRMED_AND_SEALED',
        stemId,
        objectKey: body.objectKey,
        sha256: body.sha256,
        durationMs: body.durationMs,
        byteLength: body.byteLength,
        confirmedAtMs,
    })
})
