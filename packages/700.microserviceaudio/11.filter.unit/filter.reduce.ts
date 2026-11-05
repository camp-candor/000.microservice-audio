import clone from 'clone-deep'
import * as Act from './filter.action.js'
import { FilterModel } from './filter.model.js'
import * as Buzz from './filter.buzzer.js'
import State from '../99.core/state.js'

export function reducer(
    model: FilterModel = new FilterModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.INIT_FILTER:
            return Buzz.initFilter(clone(model), act.bale, state!)
        case Act.UPDATE_FILTER:
            return Buzz.updateFilter(clone(model), act.bale, state!)
        case Act.APPLY_SPECTRAL_FILTER:
            return Buzz.applySpectralFilter(clone(model), act.bale, state!)
        default:
            return model
    }
}
