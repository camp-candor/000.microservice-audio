import clone from 'clone-deep'
import * as Act from './verification.action.js'
import { VerificationModel } from './verification.model.js'
import * as Buzz from './verification.buzzer.js'
import type State from '../99.core/state.js'

export function reducer(
    model: VerificationModel = new VerificationModel(),
    act: Act.Actions,
    state?: State,
): VerificationModel | Promise<VerificationModel> {
    switch (act.type) {
        case Act.INIT_VERIFICATION:
            return Buzz.initVerification(clone(model), act.bale, state)

        case Act.UPDATE_VERIFICATION:
            return Buzz.updateVerification(clone(model), act.bale, state)

        case Act.RUN_CONFORMANCE_FIREWALL:
            return Buzz.runConformanceFirewall(clone(model), act.bale, state)

        default:
            return model
    }
}
