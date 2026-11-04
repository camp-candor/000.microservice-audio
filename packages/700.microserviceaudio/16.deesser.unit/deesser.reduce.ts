import clone from 'clone-deep'
import * as Act from './deesser.action'
import { DeesserModel } from './deesser.model'
import * as Buzz from './deesser.buzzer'
import State from '../99.core/state'

export function reducer(
    model: DeesserModel = new DeesserModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_DEESSER:
            return Buzz.updateDeesser(clone(model), act.bale, state)

        case Act.INIT_DEESSER:
            return Buzz.initDeesser(clone(model), act.bale, state)

        default:
            return model
    }
}
