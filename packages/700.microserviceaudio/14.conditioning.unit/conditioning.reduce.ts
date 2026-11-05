import clone from 'clone-deep'
import * as Act from './conditioning.action.js'
import { ConditioningModel } from './conditioning.model.js'
import * as Buzz from './conditioning.buzzer.js'
import State from '../99.core/state.js'

export function reducer(
    model: ConditioningModel = new ConditioningModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.INIT_CONDITIONING:
            return Buzz.initConditioning(clone(model), act.bale, state!)
        case Act.UPDATE_CONDITIONING:
            return Buzz.updateConditioning(clone(model), act.bale, state!)
        case Act.VALIDATE_PHONATION:
            return Buzz.validatePhonation(clone(model), act.bale, state!)
        default:
            return model
    }
}
