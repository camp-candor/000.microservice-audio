import clone from 'clone-deep'
import * as Act from './conditioning.action'
import { ConditioningModel } from './conditioning.model'
import * as Buzz from './conditioning.buzzer'
import State from '../99.core/state'

export function reducer(
    model: ConditioningModel = new ConditioningModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_CONDITIONING:
            return Buzz.updateConditioning(clone(model), act.bale, state)

        case Act.INIT_CONDITIONING:
            return Buzz.initConditioning(clone(model), act.bale, state)

        default:
            return model
    }
}
