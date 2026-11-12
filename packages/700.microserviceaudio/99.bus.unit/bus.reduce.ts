import clone from 'clone-deep'
import * as Act from './bus.action.js'
import { BusModel } from './bus.model.js'
import * as Buzz from './bus.buzzer.js'
import type State from '../99.core/state.js'

export function reducer(
    model: BusModel = new BusModel(),
    act: Act.Actions,
    state?: State,
): BusModel | Promise<BusModel> {
    switch (act.type) {
        case Act.INIT_BUS:
            return Buzz.initBus(clone(model), act.bale, state)

        case Act.UPDATE_BUS:
            return Buzz.updateBus(clone(model), act.bale, state)

        case Act.FLUSH_BUS_RING:
            return Buzz.flushBusRing(clone(model), act.bale, state)

        case Act.EMIT_ASCII_TELEMETRY:
            return Buzz.emitAsciiTelemetry(clone(model), act.bale, state)

        default:
            return model
    }
}
