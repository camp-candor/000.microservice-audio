import clone from 'clone-deep'
import * as Act from './peaks.action.js'
import { PeaksModel } from './peaks.model.js'
import * as Buzz from './peaks.buzzer.js'
import State from '../99.core/state.js'

export function reducer(
    model: PeaksModel = new PeaksModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.INIT_PEAKS:
            return Buzz.initPeaks(clone(model), act.bale, state!)
        case Act.UPDATE_PEAKS:
            return Buzz.updatePeaks(clone(model), act.bale, state!)
        case Act.AUDIT_PEAKS:
            return Buzz.auditPeaks(clone(model), act.bale, state!)
        default:
            return model
    }
}
