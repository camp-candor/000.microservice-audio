import clone from 'clone-deep'
import * as Act from './composition.action.js'
import { CompositionModel } from './composition.model.js'
import * as Buzz from './composition.buzzer.js'
import type State from '../99.core/state.js'

export function reducer(
    model: CompositionModel = new CompositionModel(),
    act: Act.Actions,
    state?: State,
): CompositionModel | Promise<CompositionModel> {
    switch (act.type) {
        case Act.INIT_COMPOSITION:
            return Buzz.initComposition(clone(model), act.bale, state)

        case Act.UPDATE_COMPOSITION:
            return Buzz.updateComposition(clone(model), act.bale, state)

        case Act.BUILD_VISEME_SIDECAR:
            return Buzz.buildVisemeSidecar(clone(model), act.bale, state)

        default:
            return model
    }
}
