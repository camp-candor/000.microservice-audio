import clone from 'clone-deep'
import * as Act from './dialogue.action.js'
import { DialogueModel } from './dialogue.model.js'
import * as Buzz from './dialogue.buzzer.js'
import type State from '../99.core/state.js'

export function reducer(
    model: DialogueModel = new DialogueModel(),
    act: Act.Actions,
    state?: State,
): DialogueModel | Promise<DialogueModel> {
    switch (act.type) {
        case Act.INIT_DIALOGUE:
            return Buzz.initDialogue(clone(model), act.bale, state)

        case Act.UPDATE_DIALOGUE:
            return Buzz.updateDialogue(clone(model), act.bale, state)

        case Act.APPLY_DIALECT_G2P:
            return Buzz.applyDialectG2p(clone(model), act.bale, state)

        case Act.CALCULATE_MRU_PAUSE:
            return Buzz.calculateMruPause(clone(model), act.bale, state)

        case Act.ASSERT_CADENCE_FEASIBILITY:
            return Buzz.assertCadenceFeasibility(clone(model), act.bale, state)

        case Act.AUDIT_PROHIBITED_CADENCE:
            return Buzz.auditProhibitedCadence(clone(model), act.bale, state)

        default:
            return model
    }
}
