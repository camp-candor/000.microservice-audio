import * as ActCol from '../../97.collect.unit/collect.action.js'

import { CollectModel } from '../collect.model.js'
import CollectBit from '../fce/collect.bit.js'
import State from '../../99.core/state.js'
import CaboodleBit from '../fce/caboodle.bit.js'
import S from 'string'

import * as doT from 'dot'

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type {
    SealStemPayload,
    ExportManifestPayload,
} from '../fce/collect.bit.js'
import type {
    StemTimingReceipt,
    EpisodeStemManifest,
} from '../fce/collect.interface.js'

const UPDATE_CONSOLE = '[Console action] Update Console'
const EMPTY_SHA256 =
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

const logConsole = async (
    ste: State | undefined,
    src: string,
): Promise<void> => {
    // Library-owned console actions must be hunted on the master LIBRARY bus;
    // hunting them on the package bus never settles (no library slv attached).
    if ((globalThis as any).LIBRARY?.hunt) {
        await (globalThis as any).LIBRARY.hunt(UPDATE_CONSOLE, {
            idx: 'cns00',
            src,
        }).catch(() => {})
        return
    }
    if (ste && typeof ste.hunt === 'function') {
        await ste.hunt(UPDATE_CONSOLE, { idx: 'cns00', src }).catch(() => {})
    }
}
var bit, lst, dat, idx, val, src, dex

export const initCollect = (cpy: CollectModel, bal: CollectBit, ste: State) => {
    cpy.stemsSealedCount = 0
    cpy.cumulativeDurationMs = 0
    cpy.stemReceipts = {}
    cpy.lastManifestPath = null
    cpy.lastManifestDigest = null
    return cpy
}

export const updateCollect = (
    cpy: CollectModel,
    bal: CollectBit,
    ste: State,
) => {
    return cpy
}

//return the first item in a collection
export const fetchCollect = (
    cpy: CollectModel,
    bal: CollectBit,
    ste: State,
) => {
    if (bal.val == null) bal.val = 1

    if (bal.bit == null)
        bal.slv({ clcBit: { idx: 'fetch-collect-err', src: 'no-bit' } })
    var type = bal.bit.split(' ').slice(-1).pop().toLowerCase()
    var cabBit: CaboodleBit = cpy.caboodleBitList[cpy.caboodleBits[type]]

    if (bal.val == 1) bit = cabBit.bitList[0]
    else bit = cabBit

    if (bal.slv != null) bal.slv({ clcBit: { idx: 'fetch-collect', dat: bit } })
    return cpy
}

export const readCollect = async (
    cpy: CollectModel,
    bal: CollectBit,
    ste: State,
) => {
    if (bal.bit == null)
        bal.slv({ clcBit: { idx: 'read-collect-err', src: 'no-bit' } })

    var type = bal.bit.split(' ').slice(-1).pop().toLowerCase()
    if (cpy.caboodleBits[type] == null) createCollect(cpy, { idx: type }, ste)

    var cabBit: CaboodleBit = cpy.caboodleBitList[cpy.caboodleBits[type]]

    if (cabBit.bits[bal.idx] == null) {
        bit = await ste.hunt(ActCol.WRITE_COLLECT, {
            idx: bal.idx,
            src: bal.src,
            bit: bal.bit,
        })
    } else {
        dat = cabBit.bitList[cabBit.bits[bal.idx]]
    }

    if (bal.slv != null) bal.slv({ clcBit: { idx: 'read-collect', dat } })
    return cpy
}

export const writeCollect = async (
    cpy: CollectModel,
    bal: CollectBit,
    ste: State,
) => {
    dat = null

    //let us check see if it exists
    var type = bal.bit.split(' ').slice(-1).pop().toLowerCase()

    if (cpy.caboodleBits[type] == null) createCollect(cpy, { idx: type }, ste)

    if (bal.bit == null)
        bal.slv({ rskBit: { idx: 'write-collect-err', src: 'no-bit' } })

    var cabBit: CaboodleBit = cpy.caboodleBitList[cpy.caboodleBits[type]]

    bal.idx

    val = 0

    if (cabBit.bits[bal.idx] == null) {
        bit = await ste.hunt(bal.bit, {
            idx: bal.idx,
            src: bal.src,
            dat: bal.dat,
        })
        var objDat = bit[Object.keys(bit)[0]]
        dat = objDat.dat

        if (dat == null) dat = {}

        dat.dex = cabBit.bitList.length
        cabBit.bitList.push(dat)

        var idx = bal.idx
        if (idx == null) idx = dat.idx

        if (idx == null) throw new Error('write collect has no idx')

        cabBit.bits[idx] = dat.dex
    } else {
        var cabDat = cabBit.bitList[cabBit.bits[bal.idx]]

        bal.dat

        val = 1

        for (var key in bal.dat) {
            if (cabDat == null) cabDat = {}
            cabDat[key] = bal.dat[key]
        }

        cabBit.bitList[cabBit.bits[bal.idx]] = cabDat
        dat = cabDat

        //!!! SUPER IMPORTANT
    }

    if (dat == null && bal.slv != null)
        bal.slv({ rskBit: { idx: 'write-collect-err', src: 'no-dat' } })

    if (bal.slv != null) bal.slv({ clcBit: { idx: 'write-collect', val, dat } })

    return cpy
}

export const createCollect = (
    cpy: CollectModel,
    bal: CollectBit,
    ste: State,
) => {
    var cabBit: CaboodleBit = { idx: bal.idx, dex: 0, bits: {}, bitList: [] }
    cabBit.dex = cpy.caboodleBitList.length

    cpy.caboodleBitList.push(cabBit)
    cpy.caboodleBits[cabBit.idx] = cabBit.dex

    if (bal.slv != null)
        bal.slv({ clcBit: { idx: 'create-collect', dat: cabBit } })

    return cpy
}

export const removeCollect = async (
    cpy: CollectModel,
    bal: CollectBit,
    ste: State,
) => {
    var type = bal.bit.split(' ').slice(-1).pop().toLowerCase()

    if (cpy.caboodleBits[type] == null)
        return bal.slv({ rskBit: { idx: 'remove-collect-not-present' } })

    var cabBit: CaboodleBit = cpy.caboodleBitList[cpy.caboodleBits[type]]

    if (cabBit.bits[bal.idx] == null)
        return bal.slv({ rskBit: { idx: 'remove-collect-idx-not-present' } })

    bit = await ste.hunt(bal.bit, { idx: bal.idx, src: bal.src, dat: bal.dat })
    var objDat = bit[Object.keys(bit)[0]]
    dat = objDat.dat

    dex = dat.dex

    for (var i = dex; i < cabBit.bitList.length - 1; i++) {
        var update = cabBit.bitList[i]
        update.dex -= 1
    }

    for (var key in dat) {
        dat[key] = null
    }

    delete cabBit.bits[bal.idx]
    var itm = cabBit.bitList.splice(dex, 1)

    cabBit.dex -= 1

    if (bal.slv != null)
        bal.slv({ clcBit: { idx: 'remove-collect', dat: itm[0] } })

    return cpy
}

export const putCollect = (cpy: CollectModel, bal: CollectBit, ste: State) => {
    cpy.caboodleBits[bal.idx] = bal.val
    cpy.caboodleBitList[bal.val] = bal.dat

    if (bal.slv != null)
        bal.slv({ clcBit: { idx: 'put-collect', dat: bal.dat } })
    return cpy
}

export const getCollect = (cpy: CollectModel, bal: CollectBit, ste: State) => {
    val = cpy.caboodleBits[bal.idx]
    dat = cpy.caboodleBitList[val]

    if (bal.slv != null) bal.slv({ clcBit: { idx: 'get-collect', val, dat } })
    return cpy
}

export const modelCollect = (
    cpy: CollectModel,
    bal: CollectBit,
    ste: State,
) => {
    if (bal.slv != null) bal.slv({ clcBit: { idx: 'model-collect', dat: cpy } })
    return cpy
}

export const deleteCollect = (
    cpy: CollectModel,
    bal: CollectBit,
    ste: State,
) => {
    return cpy
}

export const emptyCollect = (
    cpy: CollectModel,
    bal: CollectBit,
    ste: State,
) => {
    return cpy
}

export const dotCollect = (cpy: CollectModel, bal: CollectBit, ste: State) => {
    var gel = bal.dat
    var out = []

    bal.src.split('\n').forEach((a, b) => {
        if (a.includes('//') == true) return
        var doTCompiled = doT.template(a)
        var outLine = doTCompiled(gel)
        out.push(outLine)
    })

    if (bal.slv != null)
        bal.slv({ clcBit: { idx: 'dot-vurt', lst: out, src: out.join('\n') } })

    return cpy
}

export const formatCollect = (
    cpy: CollectModel,
    bal: CollectBit,
    ste: State,
) => {
    lst = bal.src.split(':')

    var idx = lst[0]

    var out = []

    idx = S(idx).collapseWhitespace().s
    var opt = lst[1].split(',')
    opt.forEach((a, b) => {
        var now = S(a).collapseWhitespace().s
        if (a.length < 1) return
        out.push(now)
    })

    dat = [idx, out]

    bal.slv({ clcBit: { idx: 'format-collect', dat } })
    return cpy
}

export const listCollect = (cpy: CollectModel, bal: CollectBit, ste: State) => {
    if (bal.val == null) bal.val = 1
    var type = bal.bit.split(' ').slice(-1).pop().toLowerCase()
    if (cpy.caboodleBits[type] == null) createCollect(cpy, { idx: type }, ste)

    var cabBit: CaboodleBit = cpy.caboodleBitList[cpy.caboodleBits[type]]

    lst = []

    cabBit.bitList.forEach((a) => {
        if (bal.val == 0) {
            lst.push(a)
        } else if (bal.val == 1) {
            if (a.idx != null) lst.push(a.idx)
            if (a.id != null) lst.push(a.id)
        }
    })

    bal.slv({ clcBit: { idx: 'list-collect', lst } })

    return cpy
}

export const hashCollect = (cpy: CollectModel, bal: CollectBit, ste: State) => {
    if (bal.src == null) bal.src = ''
    lst = bal.src.split('\n')

    dat = {}

    lst.forEach((a) => {
        a = S(a).collapseWhitespace().s
        if (a.length < 3) return

        var hold = a.split(':')

        var dom = hold[0]
        var sub = hold[1]

        var now = sub.split(',')

        now.forEach((b, c) => {
            now[c] = S(b).collapseWhitespace().s
        })

        dat[dom] = now
    })

    bal.slv({ clcBit: { idx: 'hash-collect', dat } })

    return cpy
}

/**
 * Computes lowercase 64-character SHA-256 hex digest over binary WAV buffers.
 */
export const computeStemSha256 = (buffer: Buffer): string => {
    if (!buffer || buffer.length === 0) {
        throw new Error(
            `ZERO_BYTE_POISON_BREACH: Buffer is empty (${EMPTY_SHA256}).`,
        )
    }
    const digest = crypto
        .createHash('sha256')
        .update(buffer)
        .digest('hex')
        .toLowerCase()
    if (digest === EMPTY_SHA256) {
        throw new Error(
            `ZERO_BYTE_POISON_BREACH: Digest matches empty string hash (${EMPTY_SHA256}).`,
        )
    }
    return digest
}

/**
 * Parses RIFF/WAVE header chunks and calculates exact millisecond audio duration.
 */
export const extractWavDurationMs = (
    buffer: Buffer,
): {
    durationMs: number
    sampleRateHz: number
    bitDepth: number
    channels: number
    dataByteLength: number
} => {
    if (!buffer || buffer.length < 44) {
        throw new Error(
            'INVALID_WAV_HEADER: Buffer is smaller than 44-byte RIFF/WAVE header.',
        )
    }

    const riff = buffer.toString('ascii', 0, 4)
    const wave = buffer.toString('ascii', 8, 12)
    if (riff !== 'RIFF' || wave !== 'WAVE') {
        throw new Error(
            `INVALID_WAV_HEADER: Missing RIFF/WAVE markers (got ${riff}/${wave}).`,
        )
    }

    let sampleRateHz = 48000
    let bitDepth = 16
    let channels = 1
    let dataByteLength = 0
    let foundData = false

    let offset = 12
    while (offset <= buffer.length - 8) {
        const chunkId = buffer.toString('ascii', offset, offset + 4)
        const chunkSize = buffer.readUInt32LE(offset + 4)

        if (chunkId === 'fmt ' && offset + 24 <= buffer.length) {
            channels = buffer.readUInt16LE(offset + 10)
            sampleRateHz = buffer.readUInt32LE(offset + 12)
            bitDepth = buffer.readUInt16LE(offset + 22)
        } else if (chunkId === 'data') {
            dataByteLength = Math.min(
                chunkSize,
                Math.max(0, buffer.length - (offset + 8)),
            )
            foundData = true
            break
        }
        offset += 8 + chunkSize
    }

    if (!foundData || dataByteLength === 0) {
        throw new Error(
            'INVALID_WAV_DATA_CHUNK: Missing or zero-length PCM data chunk.',
        )
    }

    const bytesPerSample = Math.max(1, Math.floor(bitDepth / 8))
    const byteRate = sampleRateHz * Math.max(1, channels) * bytesPerSample
    const durationMs = Math.round((dataByteLength / byteRate) * 1000)

    return {
        durationMs,
        sampleRateHz,
        bitDepth,
        channels,
        dataByteLength,
    }
}

/**
 * RFC 8785 deterministic JSON canonicalization sorting keys lexicographically.
 */
export const canonicalizeJson = (value: unknown): string => {
    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value)
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => canonicalizeJson(item)).join(',')}]`
    }
    const obj = value as Record<string, unknown>
    const sortedKeys = Object.keys(obj).sort()
    const entries = sortedKeys
        .filter((k) => obj[k] !== undefined)
        .map((k) => `${JSON.stringify(k)}:${canonicalizeJson(obj[k])}`)
    return `{${entries.join(',')}}`
}

export const sealStemReceipt = async (
    cpy: CollectModel,
    bal: CollectBit,
    ste?: State,
): Promise<CollectModel> => {
    const payload = bal.dat as SealStemPayload | undefined
    if (!payload || !payload.lineId || !payload.filePath) {
        bal.val = 0
        bal.error = 'MISSING_STEM_ID_OR_PATH'
        await logConsole(
            ste,
            ':: [FAIL] [COLLECT] Missing lineId or filePath in sealStemReceipt.',
        )
        if (bal.slv) bal.slv({ clcBit: bal })
        return cpy
    }

    try {
        const buffer = payload.pcmBuffer || fs.readFileSync(payload.filePath)
        if (buffer.length <= 1024) {
            throw new Error(
                `ZERO_BYTE_POISON_BREACH: Stem byte length (${buffer.length}) <= 1024 bytes.`,
            )
        }

        const sha256Hash = computeStemSha256(buffer)
        const wavGeom = extractWavDurationMs(buffer)

        const receipt: StemTimingReceipt = {
            lineId: payload.lineId,
            stemRelativePath: payload.stemRelativePath || payload.filePath,
            sha256Hash,
            durationMs: wavGeom.durationMs,
            sampleRateHz: wavGeom.sampleRateHz,
            bitDepth: wavGeom.bitDepth,
            channels: wavGeom.channels,
            byteLength: buffer.length,
            measuredLufs: payload.measuredLufs ?? -16.0,
            measuredPeakDbTp: payload.measuredPeakDbTp ?? -1.5,
            sealedAtUtc: new Date().toISOString(),
        }

        // Recompute cumulative duration cleanly if overwriting an existing lineId
        const previousDuration =
            cpy.stemReceipts[payload.lineId]?.durationMs ?? 0
        if (!cpy.stemReceipts[payload.lineId]) {
            cpy.stemsSealedCount += 1
        }
        cpy.cumulativeDurationMs =
            cpy.cumulativeDurationMs - previousDuration + receipt.durationMs
        cpy.stemReceipts[payload.lineId] = receipt

        bal.val = 1
        bal.receipt = receipt

        await logConsole(
            ste,
            `>> [OK] [SEAL] Stem [${receipt.lineId}] sealed (${receipt.sha256Hash.slice(0, 12)}..., ${receipt.durationMs}ms, ${receipt.byteLength}b)`,
        )
    } catch (err: any) {
        bal.val = 0
        bal.error = (err?.message || 'STEM_SEALING_ERROR').slice(0, 160)
        await logConsole(
            ste,
            `:: [FAIL] [SEAL] Could not seal stem [${payload.lineId}]: ${bal.error}`,
        )
    }

    if (bal.slv) bal.slv({ clcBit: bal })
    return cpy
}

export const exportStemManifest = async (
    cpy: CollectModel,
    bal: CollectBit,
    ste?: State,
): Promise<CollectModel> => {
    const payload = bal.dat as ExportManifestPayload | undefined
    if (!payload || !payload.outputPath) {
        bal.val = 0
        bal.error = 'MISSING_MANIFEST_OUTPUT_PATH'
        await logConsole(
            ste,
            ':: [FAIL] [MANIFEST] Missing outputPath in exportStemManifest.',
        )
        if (bal.slv) bal.slv({ clcBit: bal })
        return cpy
    }

    try {
        const orderedReceipts = Object.values(cpy.stemReceipts).sort((a, b) =>
            a.lineId.localeCompare(b.lineId),
        )

        const baseManifest = {
            schemaVersion: '1.0.0',
            episodeId: payload.episodeId || cpy.episodeId,
            seriesSlug: payload.seriesSlug || cpy.seriesSlug,
            sealedAtUtc: new Date().toISOString(),
            totalStemsCount: orderedReceipts.length,
            cumulativeDurationMs: cpy.cumulativeDurationMs,
            stems: orderedReceipts,
        }

        const canonicalPayload = canonicalizeJson(baseManifest)
        const manifestRootSha256 = crypto
            .createHash('sha256')
            .update(canonicalPayload, 'utf8')
            .digest('hex')
            .toLowerCase()

        const fullManifest: EpisodeStemManifest = {
            ...baseManifest,
            manifestRootSha256,
        }

        const serialized = JSON.stringify(fullManifest, null, 2)
        const dir = path.dirname(payload.outputPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        const nonce = crypto.randomBytes(6).toString('hex')
        const tmpPath = `${payload.outputPath}.tmp_${nonce}`
        fs.writeFileSync(tmpPath, serialized, 'utf8')
        fs.renameSync(tmpPath, payload.outputPath)

        cpy.lastManifestPath = payload.outputPath
        cpy.lastManifestDigest = manifestRootSha256
        bal.val = 1
        bal.manifest = fullManifest

        await logConsole(
            ste,
            `>> [OK] [MANIFEST] Emitted atomic manifest to [${payload.outputPath}] (Digest: ${manifestRootSha256.slice(0, 12)}...)`,
        )
    } catch (err: any) {
        bal.val = 0
        bal.error = (err?.message || 'MANIFEST_EXPORT_ERROR').slice(0, 160)
        await logConsole(
            ste,
            `:: [FAIL] [MANIFEST] Export failed: ${bal.error}`,
        )
    }

    if (bal.slv) bal.slv({ clcBit: bal })
    return cpy
}
