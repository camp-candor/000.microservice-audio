import clone from 'clone-deep'
import * as Act from './acoustic.action'
import { AcousticModel } from './acoustic.model'
import * as Buzz from './acoustic.buzzer'
import State from '../99.core/state'

export function reducer(
    model: AcousticModel = new AcousticModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_ACOUSTIC:
            return Buzz.updateAcoustic(clone(model), act.bale, state)

        case Act.INIT_ACOUSTIC:
            return Buzz.initAcoustic(clone(model), act.bale, state)

        default:
            return model
    }
}
