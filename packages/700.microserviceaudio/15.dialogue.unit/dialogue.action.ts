import { Action } from '../99.core/interface/action.interface'
import DialogueBit from './fce/dialogue.bit'

// Dialogue actions

export const INIT_DIALOGUE = '[Dialogue action] Init Dialogue'
export class InitDialogue implements Action {
    readonly type = INIT_DIALOGUE
    constructor(public bale: DialogueBit) {}
}

export const UPDATE_DIALOGUE = '[Dialogue action] Update Dialogue'
export class UpdateDialogue implements Action {
    readonly type = UPDATE_DIALOGUE
    constructor(public bale: DialogueBit) {}
}

export type Actions = InitDialogue | UpdateDialogue
