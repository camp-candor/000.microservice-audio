import type { Action } from '../99.core/interface/action.interface.js'
import type DialogueBit from './fce/dialogue.bit.js'

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

export const APPLY_DIALECT_G2P = '[Dialogue action] Apply Dialect G2P'
export class ApplyDialectG2p implements Action {
    readonly type = APPLY_DIALECT_G2P
    constructor(public bale: DialogueBit) {}
}

export const CALCULATE_MRU_PAUSE = '[Dialogue action] Calculate Mru Pause'
export class CalculateMruPause implements Action {
    readonly type = CALCULATE_MRU_PAUSE
    constructor(public bale: DialogueBit) {}
}

export const ASSERT_CADENCE_FEASIBILITY =
    '[Dialogue action] Assert Cadence Feasibility'
export class AssertCadenceFeasibility implements Action {
    readonly type = ASSERT_CADENCE_FEASIBILITY
    constructor(public bale: DialogueBit) {}
}

export const AUDIT_PROHIBITED_CADENCE =
    '[Dialogue action] Audit Prohibited Cadence'
export class AuditProhibitedCadence implements Action {
    readonly type = AUDIT_PROHIBITED_CADENCE
    constructor(public bale: DialogueBit) {}
}

export type Actions =
    | InitDialogue
    | UpdateDialogue
    | ApplyDialectG2p
    | CalculateMruPause
    | AssertCadenceFeasibility
    | AuditProhibitedCadence
