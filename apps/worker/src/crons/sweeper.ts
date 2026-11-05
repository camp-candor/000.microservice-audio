import type { Env } from '../types/env.js'

export interface SweeperReport {
    status: 'COMPLETED' | 'EMPTY' | 'FAILED'
    scannedCount: number
    deletedCount: number
    reclaimedBytes: number
    timestampMs: number
    error?: string
}

/**
 * Scans the ephemeral staging prefix 'staging/' in AUDIO_STEMS_BUCKET,
 * purging orphaned scratch buffers older than maxAgeMs (default: 24 hours).
 */
export async function purgeOrphanedStagingBuffers(
    env: Env,
    maxAgeMs: number = 24 * 60 * 60 * 1000,
): Promise<SweeperReport> {
    const now = Date.now()
    const threshold = now - maxAgeMs

    let scannedCount = 0
    let deletedCount = 0
    let reclaimedBytes = 0

    try {
        // List staging objects with batch pagination
        const listed = await env.AUDIO_STEMS_BUCKET.list({
            prefix: 'staging/',
            limit: 100,
        })

        scannedCount = listed.objects.length

        for (const obj of listed.objects) {
            const uploadTime = obj.uploaded
                ? new Date(obj.uploaded).getTime()
                : 0
            if (uploadTime > 0 && uploadTime < threshold) {
                await env.AUDIO_STEMS_BUCKET.delete(obj.key)
                deletedCount += 1
                reclaimedBytes += obj.size
            }
        }

        return {
            status: deletedCount > 0 ? 'COMPLETED' : 'EMPTY',
            scannedCount,
            deletedCount,
            reclaimedBytes,
            timestampMs: now,
        }
    } catch (err: any) {
        return {
            status: 'FAILED',
            scannedCount,
            deletedCount,
            reclaimedBytes,
            timestampMs: now,
            error: (err?.message || 'SWEEPER_EXECUTION_ERROR').slice(0, 150),
        }
    }
}
