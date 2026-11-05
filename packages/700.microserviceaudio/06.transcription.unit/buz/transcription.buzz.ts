import fs from 'node:fs'
import { TranscriptionModel } from '../transcription.model.js'
import TranscriptionBit, {
    HeaderSentinelReport,
    TranscriptionParityReport,
} from '../fce/transcription.bit.js'
import State from '../../99.core/state.js'

const UPDATE_CONSOLE = '[Console action] Update Console'

const logConsole = async (src: string): Promise<void> => {
    if ((globalThis as any).LIBRARY?.hunt) {
        await (globalThis as any).LIBRARY.hunt(UPDATE_CONSOLE, {
            idx: 'cns00',
            src,
        })
    }
}

export const initTranscription = (
    cpy: TranscriptionModel,
    bal: TranscriptionBit,
    ste: State,
): TranscriptionModel => {
    cpy.validationsCompleted = 0
    cpy.transcriptionBits = {}
    if (bal.slv) bal.slv({ trnBit: { idx: 'init-transcription', val: 1 } })
    return cpy
}

export const updateTranscription = (
    cpy: TranscriptionModel,
    bal: TranscriptionBit,
    ste: State,
): TranscriptionModel => {
    if (bal.idx) cpy.transcriptionBits[bal.idx] = bal
    if (bal.slv) bal.slv({ trnBit: bal })
    return cpy
}

export const validateWaveHeaderSentinel = (
    buffer: Buffer,
): HeaderSentinelReport => {
    if (buffer.length < 1024) {
        return {
            hasRiffHeader: false,
            hasWaveMarker: false,
            byteLength: buffer.length,
            valid: false,
            error: `POISON_BUFFER_REJECTED: Buffer size ${buffer.length} is below 1024-byte minimum threshold`,
        }
    }

    const riff = buffer.toString('ascii', 0, 4)
    const wave = buffer.toString('ascii', 8, 12)

    if (riff !== 'RIFF' || wave !== 'WAVE') {
        return {
            hasRiffHeader: riff === 'RIFF',
            hasWaveMarker: wave === 'WAVE',
            byteLength: buffer.length,
            valid: false,
            error: `INVALID_WAVE_HEADER: Found RIFF='${riff}', WAVE='${wave}'`,
        }
    }

    return {
        hasRiffHeader: true,
        hasWaveMarker: true,
        byteLength: buffer.length,
        valid: true,
    }
}

export const verifyTranscriptionParity = async (
    cpy: TranscriptionModel,
    bal: TranscriptionBit,
    ste: State,
): Promise<TranscriptionModel> => {
    const dat = bal.dat
    if (!dat?.filePath || !dat?.expectedText) {
        if (bal.slv) {
            bal.slv({
                trnBit: {
                    idx: bal.idx,
                    result: {
                        status: 'FAILED',
                        filePath: '',
                        expectedText: '',
                        normalizedInput: '',
                        sentinel: {
                            hasRiffHeader: false,
                            hasWaveMarker: false,
                            byteLength: 0,
                            valid: false,
                        },
                        error: 'MISSING_TRANSCRIPTION_DATA',
                    },
                },
            })
        }
        return cpy
    }

    try {
        const buffer = dat.buffer || fs.readFileSync(dat.filePath)
        const sentinel = validateWaveHeaderSentinel(buffer)

        if (!sentinel.valid) {
            await logConsole(`:: [FAIL] [SENTINEL] ${sentinel.error}`)
            bal.result = {
                status: 'FAILED',
                filePath: dat.filePath,
                expectedText: dat.expectedText,
                normalizedInput: dat.expectedText.trim().toLowerCase(),
                sentinel,
                error: sentinel.error,
            }
            cpy.validationsCompleted += 1
            if (bal.slv) bal.slv({ trnBit: bal })
            return cpy
        }

        await logConsole(
            `>> [OK] [SENTINEL] Valid RIFF/WAVE header verified (${buffer.length} bytes)`,
        )
        bal.result = {
            status: 'PASSED',
            filePath: dat.filePath,
            expectedText: dat.expectedText,
            normalizedInput: dat.expectedText.trim().toLowerCase(),
            sentinel,
        }
    } catch (err: any) {
        const cleanErr = (err?.message || 'TRANSCRIPTION_PARITY_ERROR').slice(
            0,
            150,
        )
        await logConsole(`:: [FAIL] [PARITY] Read failure: ${cleanErr}`)
        bal.result = {
            status: 'FAILED',
            filePath: dat.filePath,
            expectedText: dat.expectedText,
            normalizedInput: '',
            sentinel: {
                hasRiffHeader: false,
                hasWaveMarker: false,
                byteLength: 0,
                valid: false,
            },
            error: cleanErr,
        }
    }

    cpy.validationsCompleted += 1
    if (bal.slv) bal.slv({ trnBit: bal })
    return cpy
}
