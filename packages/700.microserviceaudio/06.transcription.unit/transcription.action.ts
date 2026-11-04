import { Action } from '../99.core/interface/action.interface'
import TranscriptionBit from './fce/transcription.bit'

// Transcription actions

export const INIT_TRANSCRIPTION = '[Transcription action] Init Transcription'
export class InitTranscription implements Action {
    readonly type = INIT_TRANSCRIPTION
    constructor(public bale: TranscriptionBit) {}
}

export const UPDATE_TRANSCRIPTION =
    '[Transcription action] Update Transcription'
export class UpdateTranscription implements Action {
    readonly type = UPDATE_TRANSCRIPTION
    constructor(public bale: TranscriptionBit) {}
}

export type Actions = InitTranscription | UpdateTranscription
