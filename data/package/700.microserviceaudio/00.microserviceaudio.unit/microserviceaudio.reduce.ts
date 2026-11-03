import clone from 'clone-deep'
import * as Act from './microserviceaudio.action.js'
import { MicroserviceaudioModel } from './microserviceaudio.model.js'
import * as Buzz from './microserviceaudio.buzzer.js'
import State from '../99.core/state.js'

export function reducer(
    model: MicroserviceaudioModel = new MicroserviceaudioModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_MICROSERVICEAUDIO:
            return Buzz.updateMicroserviceaudio(clone(model), act.bale, state)

        case Act.INIT_MICROSERVICEAUDIO:
            return Buzz.initMicroserviceaudio(clone(model), act.bale, state)

        case Act.TEST_MICROSERVICEAUDIO:
            return Buzz.testMicroserviceaudio(clone(model), act.bale, state)

        case Act.LIST_MICROSERVICEAUDIO:
            return Buzz.listMicroserviceaudio(clone(model), act.bale, state)

        default:
            return model
    }
}
