import clone from 'clone-deep'
import * as Act from './transcription.action'
import { TranscriptionModel } from './transcription.model'
import * as Buzz from './transcription.buzzer'
import State from '../99.core/state'

export function reducer(
    model: TranscriptionModel = new TranscriptionModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_TRANSCRIPTION:
            return Buzz.updateTranscription(clone(model), act.bale, state)

        case Act.INIT_TRANSCRIPTION:
            return Buzz.initTranscription(clone(model), act.bale, state)

        default:
            return model
    }
}
