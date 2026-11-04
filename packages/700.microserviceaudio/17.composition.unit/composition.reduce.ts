import clone from 'clone-deep'
import * as Act from './composition.action'
import { CompositionModel } from './composition.model'
import * as Buzz from './composition.buzzer'
import State from '../99.core/state'

export function reducer(
    model: CompositionModel = new CompositionModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_COMPOSITION:
            return Buzz.updateComposition(clone(model), act.bale, state)

        case Act.INIT_COMPOSITION:
            return Buzz.initComposition(clone(model), act.bale, state)

        default:
            return model
    }
}
