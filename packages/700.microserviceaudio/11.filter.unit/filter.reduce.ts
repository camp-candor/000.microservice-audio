import clone from 'clone-deep'
import * as Act from './filter.action'
import { FilterModel } from './filter.model'
import * as Buzz from './filter.buzzer'
import State from '../99.core/state'

export function reducer(
    model: FilterModel = new FilterModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_FILTER:
            return Buzz.updateFilter(clone(model), act.bale, state)

        case Act.INIT_FILTER:
            return Buzz.initFilter(clone(model), act.bale, state)

        default:
            return model
    }
}
