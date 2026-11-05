import clone from 'clone-deep'
import * as Act from './acoustic.action.js'
import { AcousticModel } from './acoustic.model.js'
import * as Buzz from './acoustic.buzzer.js'
import State from '../99.core/state.js'

export function reducer(
    model: AcousticModel = new AcousticModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.INIT_ACOUSTIC:
            return Buzz.initAcoustic(clone(model), act.bale, state!)
        case Act.UPDATE_ACOUSTIC:
            return Buzz.updateAcoustic(clone(model), act.bale, state!)
        case Act.RESOLVE_DSP_MODIFIERS:
            return Buzz.resolveDspModifiers(clone(model), act.bale, state!)
        default:
            return model
    }
}
