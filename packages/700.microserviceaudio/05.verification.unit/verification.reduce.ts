import clone from 'clone-deep'
import * as Act from './verification.action'
import { VerificationModel } from './verification.model'
import * as Buzz from './verification.buzzer'
import State from '../99.core/state'

export function reducer(
    model: VerificationModel = new VerificationModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_VERIFICATION:
            return Buzz.updateVerification(clone(model), act.bale, state)

        case Act.INIT_VERIFICATION:
            return Buzz.initVerification(clone(model), act.bale, state)

        default:
            return model
    }
}
