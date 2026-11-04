import clone from 'clone-deep'
import * as Act from './dialogue.action'
import { DialogueModel } from './dialogue.model'
import * as Buzz from './dialogue.buzzer'
import State from '../99.core/state'

export function reducer(
    model: DialogueModel = new DialogueModel(),
    act: Act.Actions,
    state?: State,
) {
    switch (act.type) {
        case Act.UPDATE_DIALOGUE:
            return Buzz.updateDialogue(clone(model), act.bale, state)

        case Act.INIT_DIALOGUE:
            return Buzz.initDialogue(clone(model), act.bale, state)

        default:
            return model
    }
}
