import type TranscriptionBit from './transcription.bit.js'

export default interface Transcription {
    idx: string
    validationsCompleted: number
    transcriptionBits: Record<string, TranscriptionBit>
}
