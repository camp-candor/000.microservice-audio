import clone from 'clone-deep'
import * as Act from './loudness.action'
import { LoudnessModel } from './loudness.model'
import * as Buzz from './loudness.buzzer'
import State from '../99.core/state'

export function reducer(
    model: LoudnessModel = new LoudnessModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_LOUDNESS:
            return Buzz.updateLoudness(clone(model), act.bale, state)

        case Act.INIT_LOUDNESS:
            return Buzz.initLoudness(clone(model), act.bale, state)

        default:
            return model
    }
}
