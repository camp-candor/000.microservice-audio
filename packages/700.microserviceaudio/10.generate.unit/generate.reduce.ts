import clone from 'clone-deep'
import * as Act from './generate.action'
import { GenerateModel } from './generate.model'
import * as Buzz from './generate.buzzer'
import State from '../99.core/state'

export function reducer(
    model: GenerateModel = new GenerateModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_GENERATE:
            return Buzz.updateGenerate(clone(model), act.bale, state)

        case Act.INIT_GENERATE:
            return Buzz.initGenerate(clone(model), act.bale, state)

        default:
            return model
    }
}
