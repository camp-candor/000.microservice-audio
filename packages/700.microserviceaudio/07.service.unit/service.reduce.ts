import clone from 'clone-deep'
import * as Act from './service.action'
import { ServiceModel } from './service.model'
import * as Buzz from './service.buzzer'
import State from '../99.core/state'

export function reducer(
    model: ServiceModel = new ServiceModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_SERVICE:
            return Buzz.updateService(clone(model), act.bale, state)

        case Act.INIT_SERVICE:
            return Buzz.initService(clone(model), act.bale, state)

        default:
            return model
    }
}
