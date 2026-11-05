import clone from 'clone-deep'
import * as Act from './transcription.action.js'
import { TranscriptionModel } from './transcription.model.js'
import * as Buzz from './transcription.buzzer.js'
import State from '../99.core/state.js'

export function reducer(
    model: TranscriptionModel = new TranscriptionModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.INIT_TRANSCRIPTION:
            return Buzz.initTranscription(clone(model), act.bale, state!)
        case Act.UPDATE_TRANSCRIPTION:
            return Buzz.updateTranscription(clone(model), act.bale, state!)
        case Act.VERIFY_TRANSCRIPTION_PARITY:
            return Buzz.verifyTranscriptionParity(
                clone(model),
                act.bale,
                state!,
            )
        default:
            return model
    }
}
