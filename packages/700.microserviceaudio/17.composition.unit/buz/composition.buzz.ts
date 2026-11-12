import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { CompositionModel } from '../composition.model.js'
import type CompositionBit from '../fce/composition.bit.js'
import type { CompileVisemePayload } from '../fce/composition.bit.js'
import type {
    PrestonBlairVisemeCode,
    VisemeKeyframe,
    VisemeSidecarManifest,
} from '../fce/composition.interface.js'
import type State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

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

/**
 * Quantizes continuous acoustic duration in ms to integer video frames via ceiling arithmetic.
 * Enforces minimum 1-frame allocation for sub-frame interjections (< 41.67 ms at 24 fps).
 */
export const quantizeMsToFrames = (
    durationMs: number,
    fps: number = 24,
): number => {
    if (!Number.isFinite(durationMs) || durationMs <= 0) {
        return 1
    }
    const rawFrames = Math.ceil((durationMs / 1000.0) * fps)
    return Math.max(1, rawFrames)
}

/**
 * Maps orthographic or phonetic grapheme tokens onto Preston Blair viseme shapes (A-H, X).
 */
export const mapGraphemeToViseme = (
    charToken: string,
): PrestonBlairVisemeCode => {
    const c = charToken.toUpperCase()
    if (
        c === ' ' ||
        c === '.' ||
        c === ',' ||
        c === '?' ||
        c === '!' ||
        c === '-'
    ) {
        return 'X' // Closed mouth rest
    }
    if (c === 'P' || c === 'B' || c === 'M') {
        return 'A' // Bilabial closed lips
    }
    if (c === 'F' || c === 'V') {
        return 'G' // Labiodental lower lip tucked under upper teeth
    }
    if (c === 'O' || c === 'W' || c === 'Q') {
        return 'E' // Rounded medium-open vowel
    }
    if (c === 'U') {
        return 'F' // Tightly puckered lips
    }
    if (c === 'A' || c === 'I') {
        return 'D' // Wide open jaw vowel
    }
    if (c === 'E' || c === 'Y') {
        return 'C' // Open medium vowel
    }
    if (c === 'L' || c === 'T' || c === 'D' || c === 'N') {
        return 'H' // Alveolar tongue-behind-teeth
    }
    return 'B' // Default clenched teeth / fricative consonant (S, Z, K, G, R, TH)
}

/**
 * Compiles a deterministic, zero-drift contiguous Preston Blair viseme keyframe lattice.
 */
export const compileVisemeSidecar = (
    payload: CompileVisemePayload,
): VisemeSidecarManifest => {
    const fps = payload.fps || 24
    const audioDurationMs = Math.max(1, Math.round(payload.audioDurationMs))
    const totalAllocatedFrames = quantizeMsToFrames(audioDurationMs, fps)
    const frameDurationMs = 1000.0 / fps

    const leadSilenceMs = Math.max(0, payload.leadSilenceMs ?? 0)
    const tailSilenceMs = Math.max(0, payload.tailSilenceMs ?? 0)

    let leadSilenceFrames =
        leadSilenceMs > 0 ? Math.floor((leadSilenceMs / 1000.0) * fps) : 0
    let tailSilenceFrames =
        tailSilenceMs > 0 ? Math.floor((tailSilenceMs / 1000.0) * fps) : 0

    // Guarantee at least 1 active speech frame if audio duration > 0
    if (leadSilenceFrames + tailSilenceFrames >= totalAllocatedFrames) {
        leadSilenceFrames = 0
        tailSilenceFrames = 0
    }

    const activeSpeechFrames =
        totalAllocatedFrames - leadSilenceFrames - tailSilenceFrames
    const keyframes: VisemeKeyframe[] = []
    let cursorFrame = 0

    // 1. Lead silence rest frame block ('X')
    if (leadSilenceFrames > 0) {
        const endF = cursorFrame + leadSilenceFrames - 1
        keyframes.push({
            viseme: 'X',
            startFrame: cursorFrame,
            endFrame: endF,
            durationFrames: leadSilenceFrames,
            startTimeMs: Math.round(cursorFrame * frameDurationMs),
            endTimeMs: Math.round((endF + 1) * frameDurationMs),
            phonemeToken: '<SIL_LEAD>',
        })
        cursorFrame = endF + 1
    }

    // 2. Active dialogue viseme tiling over [cursorFrame, cursorFrame + activeSpeechFrames - 1]
    const cleanText =
        (payload.normalizedDialogueText || 'A')
            .replace(/<[^>]+>/g, '')
            .trim() || 'A'
    const rawTokens = cleanText
        .split('')
        .filter((ch) => /[a-zA-Z .,?!-]/.test(ch))
    const tokens = rawTokens.length > 0 ? rawTokens : ['A']

    const speechStartFrame = cursorFrame
    for (let f = 0; f < activeSpeechFrames; f++) {
        const tokenIdx = Math.min(
            tokens.length - 1,
            Math.floor((f / activeSpeechFrames) * tokens.length),
        )
        const charToken = tokens[tokenIdx]
        const viseme = mapGraphemeToViseme(charToken)
        const currentAbsFrame = speechStartFrame + f

        const prev = keyframes[keyframes.length - 1]
        if (
            prev &&
            prev.viseme === viseme &&
            prev.phonemeToken !== '<SIL_LEAD>'
        ) {
            prev.endFrame = currentAbsFrame
            prev.durationFrames += 1
            prev.endTimeMs = Math.round((currentAbsFrame + 1) * frameDurationMs)
        } else {
            keyframes.push({
                viseme,
                startFrame: currentAbsFrame,
                endFrame: currentAbsFrame,
                durationFrames: 1,
                startTimeMs: Math.round(currentAbsFrame * frameDurationMs),
                endTimeMs: Math.round((currentAbsFrame + 1) * frameDurationMs),
                phonemeToken: charToken === ' ' ? '<SPACE>' : charToken,
            })
        }
    }
    cursorFrame = speechStartFrame + activeSpeechFrames

    // 3. Tail silence rest frame block ('X')
    if (tailSilenceFrames > 0) {
        const endF = totalAllocatedFrames - 1
        keyframes.push({
            viseme: 'X',
            startFrame: cursorFrame,
            endFrame: endF,
            durationFrames: endF - cursorFrame + 1,
            startTimeMs: Math.round(cursorFrame * frameDurationMs),
            endTimeMs: audioDurationMs,
            phonemeToken: '<SIL_TAIL>',
        })
    } else if (keyframes.length > 0) {
        // Clamp final keyframe exact frame boundary & millisecond tail
        const last = keyframes[keyframes.length - 1]
        last.endFrame = totalAllocatedFrames - 1
        last.durationFrames = last.endFrame - last.startFrame + 1
        last.endTimeMs = audioDurationMs
    }

    const baseManifest = {
        schemaVersion: '1.0.0',
        lineId: payload.lineId,
        characterId: payload.characterId,
        stemSha256: payload.stemSha256,
        fps,
        audioDurationMs,
        totalAllocatedFrames,
        leadSilenceFrames,
        tailSilenceFrames,
        keyframes,
    }

    const sidecarRootSha256 = crypto
        .createHash('sha256')
        .update(JSON.stringify(baseManifest), 'utf8')
        .digest('hex')
        .toLowerCase()

    return {
        ...baseManifest,
        sidecarRootSha256,
    }
}

export const initComposition = (
    cpy: CompositionModel,
    bal: CompositionBit,
    _ste?: State,
): CompositionModel => {
    cpy.sidecarsCompiledCount = 0
    cpy.totalFramesAllocated = 0
    cpy.lastSidecar = null
    cpy.lastSidecarPath = null
    cpy.compositionBits = {}
    if (bal.slv) bal.slv({ cmpBit: { idx: 'init-composition', val: 1 } })
    return cpy
}

export const updateComposition = (
    cpy: CompositionModel,
    bal: CompositionBit,
    _ste?: State,
): CompositionModel => {
    if (bal.idx) cpy.compositionBits[bal.idx] = bal
    if (bal.slv) bal.slv({ cmpBit: bal })
    return cpy
}

export const buildVisemeSidecar = async (
    cpy: CompositionModel,
    bal: CompositionBit,
    ste?: State,
): Promise<CompositionModel> => {
    const payload = bal.dat
    if (!payload || !payload.lineId || !payload.stemSha256) {
        bal.val = 0
        bal.error = 'MISSING_VISEME_SIDECAR_PAYLOAD'
        await logConsole(
            ste,
            ':: [FAIL] [VISEME] Missing lineId or stemSha256 in buildVisemeSidecar.',
        )
        if (bal.slv) bal.slv({ cmpBit: bal })
        return cpy
    }

    try {
        const sidecar = compileVisemeSidecar(payload)
        bal.sidecar = sidecar
        bal.val = 1

        cpy.sidecarsCompiledCount += 1
        cpy.totalFramesAllocated += sidecar.totalAllocatedFrames
        cpy.lastSidecar = sidecar

        if (payload.outputPath) {
            const dir = path.dirname(payload.outputPath)
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
            }
            const nonce = crypto.randomBytes(6).toString('hex')
            const tmpPath = `${payload.outputPath}.tmp_${nonce}`
            fs.writeFileSync(tmpPath, JSON.stringify(sidecar, null, 2), 'utf8')
            fs.renameSync(tmpPath, payload.outputPath)
            cpy.lastSidecarPath = payload.outputPath
        }

        await logConsole(
            ste,
            `>> [OK] [VISEME] Compiled [${sidecar.lineId}] -> ${sidecar.totalAllocatedFrames} frames @ ${sidecar.fps}fps (${sidecar.keyframes.length} keyframes)`,
        )
    } catch (err: any) {
        bal.val = 0
        bal.error = (err?.message || 'VISEME_COMPILATION_ERROR').slice(0, 160)
        await logConsole(
            ste,
            `:: [FAIL] [VISEME] Compilation failed: ${bal.error}`,
        )
    }

    if (bal.slv) bal.slv({ cmpBit: bal })
    return cpy
}
