import clone from 'clone-deep'
import * as Act from './loudness.action.js'
import { LoudnessModel } from './loudness.model.js'
import * as Buzz from './loudness.buzzer.js'
import State from '../99.core/state.js'

export function reducer(
    model: LoudnessModel = new LoudnessModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.INIT_LOUDNESS:
            return Buzz.initLoudness(clone(model), act.bale, state!)
        case Act.UPDATE_LOUDNESS:
            return Buzz.updateLoudness(clone(model), act.bale, state!)
        case Act.AUDIT_LOUDNESS:
            return Buzz.auditLoudness(clone(model), act.bale, state!)
        default:
            return model
    }
}
