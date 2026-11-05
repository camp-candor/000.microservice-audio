import type Transcription from './fce/transcription.interface.js'
import type TranscriptionBit from './fce/transcription.bit.js'

export class TranscriptionModel implements Transcription {
    idx: string = '06.transcription'
    validationsCompleted: number = 0
    transcriptionBits: Record<string, TranscriptionBit> = {}
}
