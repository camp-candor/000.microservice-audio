import clone from 'clone-deep'
import * as Act from './deesser.action.js'
import { DeesserModel } from './deesser.model.js'
import * as Buzz from './deesser.buzzer.js'
import State from '../99.core/state.js'

export function reducer(
    model: DeesserModel = new DeesserModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.INIT_DEESSER:
            return Buzz.initDeesser(clone(model), act.bale, state!)
        case Act.UPDATE_DEESSER:
            return Buzz.updateDeesser(clone(model), act.bale, state!)
        case Act.APPLY_DYNAMIC_DEESSER:
            return Buzz.applyDynamicDeesser(clone(model), act.bale, state!)
        default:
            return model
    }
}
