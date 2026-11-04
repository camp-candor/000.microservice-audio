import clone from 'clone-deep'
import * as Act from './peaks.action'
import { PeaksModel } from './peaks.model'
import * as Buzz from './peaks.buzzer'
import State from '../99.core/state'

export function reducer(
    model: PeaksModel = new PeaksModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_PEAKS:
            return Buzz.updatePeaks(clone(model), act.bale, state)

        case Act.INIT_PEAKS:
            return Buzz.initPeaks(clone(model), act.bale, state)

        default:
            return model
    }
}
